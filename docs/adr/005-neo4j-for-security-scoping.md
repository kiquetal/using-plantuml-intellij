# Neo4j for Security Scoping Rules (Users ↔ API Proxies)

## Status
Accepted

## Context

The platform needs to enforce fine-grained access control between **users** (and their roles/groups) and **API proxies** (the gateway routes they are allowed to invoke). The scoping rules are:

- Hierarchical: a team lead inherits permissions from their team, a department inherits from its child teams.
- Graph-shaped: a single user can belong to multiple groups, each group can access multiple proxies, and proxies can be shared across groups with different permission levels (read, write, admin).
- Dynamic: rules change frequently as teams onboard new APIs or rotate responsibilities.

A relational model requires recursive CTEs or multiple joins across 4-5 tables to answer "which proxies can user X access, and why?" — making both the query and the audit trail complex and slow at scale.

## Decision

Use **Neo4j** as the authorization rule engine for user-to-API-proxy scoping.

The graph model:

```
(:User)-[:MEMBER_OF]->(:Group)-[:HAS_ACCESS {level: "read|write|admin"}]->(:ApiProxy)
(:Group)-[:CHILD_OF]->(:Group)       // hierarchy
(:ApiProxy)-[:BELONGS_TO]->(:Domain) // API domain grouping
```

Key queries become single Cypher traversals:

```cypher
// All proxies user X can access (including inherited from parent groups)
MATCH (u:User {id: $userId})-[:MEMBER_OF]->(g:Group)-[:CHILD_OF*0..5]->(parent:Group)-[:HAS_ACCESS]->(proxy:ApiProxy)
RETURN proxy.name, parent.name AS granted_via, r.level AS permission

// Why does user X have access to proxy Y? (audit trail)
MATCH path = (u:User {id: $userId})-[:MEMBER_OF|CHILD_OF*..6]->(g:Group)-[r:HAS_ACCESS]->(p:ApiProxy {name: $proxyName})
RETURN path
```

## Consequences

**What becomes easier:**
- Traversing permission hierarchies — native graph operation, O(relationships) not O(joins)
- Audit queries ("show me the path from user to proxy") are trivial
- Adding new relationship types (e.g., `:DENIED`, `:TEMPORARY_ACCESS {expires}`) without schema migrations
- Visual debugging — Neo4j Browser shows the permission graph directly

**What becomes harder:**
- Operational overhead — another database to maintain, backup, and monitor
- Team needs basic Cypher knowledge
- Transactional consistency — if user creation happens in PostgreSQL, the graph must be kept in sync (we use Kafka events to propagate changes)
- Not suitable for the primary data store — Neo4j is the authorization layer only, not source of truth for user profiles

**Alternatives considered:**
- **PostgreSQL with recursive CTEs** — works for small hierarchies but query complexity and latency grow with depth; audit trail queries are painful
- **OPA/Rego policies** — good for static RBAC but awkward for dynamic, graph-shaped relationships that change hourly
- **Redis ACLs** — fast but no native graph traversal; would require denormalizing the full permission set per user (expensive to recompute on changes)

**Mitigations:**
- Neo4j is read-heavy, write-light — a single replica handles authorization checks
- Kafka consumer keeps the graph in sync with PostgreSQL user/group changes (eventual consistency acceptable for non-critical permission propagation, with a cache-invalidation fallback for immediate revocations)
