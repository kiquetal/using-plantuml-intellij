# C4 Model — Levels Guide & Reference

A practical reference for the C4 model (Context, Containers, Components, Code) for documenting software architecture. This guide explains the theory behind each level so you can apply it to any project.

---

## What is the C4 Model?

The C4 model is a set of hierarchical abstractions (Context, Containers, Components, Code) for describing software architecture at different levels of detail. Think of it like Google Maps: you can zoom in from country level → city → street → building.

**Key principles:**
- Each level adds detail by zooming into one element from the level above
- Different audiences need different levels of detail
- Not every system needs all 4 levels — pick what adds value
- Diagrams should be simple enough that a non-author can understand them

**Creator:** Simon Brown — [c4model.com](https://c4model.com/)

---

## Summary Table

| Level | Name | Shows | Audience | Required? |
|-------|------|-------|----------|-----------|
| 1 | System Context | Your system as a box + users + external systems | Everyone (business, dev, ops) | ✅ Always |
| 2 | Container | Services, apps, databases, message brokers inside your system | Dev team, architects, ops | ✅ Almost always |
| 3 | Component | Internal modules/classes within one container | Developers of that service | ⚠️ Only for complex containers |
| 4 | Code | Class diagrams, interfaces, relationships | Developers writing the code | ❌ Rarely (auto-generate from IDE) |
| — | Deployment | Infrastructure: nodes, pods, VMs, cloud services | Ops, DevOps, SRE | ✅ Recommended for production systems |

---

## Level 1 — System Context

### What it is
The highest-level view. Your system is a single box. Around it: the people who use it and the other systems it interacts with. No internal details.

### Audience
- Business stakeholders
- New team members (onboarding)
- Architecture review boards
- Anyone who needs the "big picture"

### Key elements
| Element | C4-PlantUML Macro | When to use |
|---------|-------------------|-------------|
| Person (internal) | `Person(alias, label, description)` | Users within your organization |
| Person (external) | `Person_Ext(alias, label, description)` | Users outside your organization |
| Your system | `System(alias, label, description)` | The system you are documenting |
| External system | `System_Ext(alias, label, description)` | Systems you don't own but depend on |
| Relationship | `Rel(from, to, label, technology)` | Communication between elements |

### What to include
- All user types (roles) that interact with your system
- All external systems your system sends data to or receives data from
- A short description on each element explaining its purpose
- Protocol/technology on relationships (HTTPS, gRPC, AMQP, etc.)

### What NOT to include
- Internal services, databases, or components (that's Level 2+)
- Implementation details or technology choices inside your system
- More than ~10-15 elements (it stops being a "big picture")

### Common mistakes
1. **Too much detail** — Showing internal services at this level defeats the purpose
2. **Missing external systems** — Forgetting about email providers, payment gateways, monitoring tools
3. **No descriptions** — Boxes without descriptions force readers to guess what things do
4. **Vague relationships** — "Uses" is less useful than "Sends order events via HTTPS"

### Applied example
> 📂 See [`c4_1_context.puml`](../c4_1_context.puml) — Shows the E-Commerce platform as a single system with Customer, Admin, and external services (Stripe, ShipCo, SendGrid).

---

## Level 2 — Container

### What it is
Zoom into your system. Shows the high-level technical building blocks: applications, services, databases, message queues, file systems. A "container" here is NOT a Docker container — it's any separately deployable/runnable unit.

### Audience
- Development team
- Software architects
- DevOps/SRE (understanding what runs where)
- Tech leads making technology decisions

### Key elements
| Element | C4-PlantUML Macro | When to use |
|---------|-------------------|-------------|
| Container (app/service) | `Container(alias, label, technology, description)` | Web apps, APIs, microservices, CLI tools |
| Container (database) | `ContainerDb(alias, label, technology, description)` | PostgreSQL, Redis, MongoDB, etc. |
| Container (queue) | `ContainerQueue(alias, label, technology, description)` | Kafka, RabbitMQ, SQS, etc. |
| System boundary | `System_Boundary(alias, label)` | Groups containers that belong to your system |
| External system | `System_Ext(alias, label, description)` | Same as Level 1 — systems you don't own |

### What to include
- All deployable units (services, databases, caches, brokers)
- Technology choices on each container (language, framework, database engine)
- Communication protocols between containers (HTTP, gRPC, TCP, async)
- External systems that containers talk to directly
- Brief description of each container's responsibility

### What NOT to include
- Internal classes, modules, or packages within a container (that's Level 3)
- Deployment details like pods, VMs, or cloud regions (that's the Deployment diagram)
- Every single API endpoint or database table

### Common mistakes
1. **Confusing containers with Docker containers** — A container is a logical deployment unit, not necessarily a Docker container
2. **Missing data stores** — Forgetting Redis, caches, or file storage
3. **No technology labels** — "Service A" without "Go, gRPC" gives no useful information
4. **Too many relationships** — If arrows make it unreadable, you may have too many containers or need to group them

### Applied example
> 📂 See [`c4_2_container.puml`](../c4_2_container.puml) — Shows the API Gateway (Kong), 4 microservices with their technologies, Redis, PostgreSQL, and Kafka inside the system boundary.

---

## Level 3 — Component

### What it is
Zoom into ONE container from Level 2. Shows the major structural building blocks inside it: controllers, services, repositories, clients, processors. These are the logical groupings of code — not individual classes.

### Audience
- Developers working on that specific container/service
- Tech leads reviewing internal design
- New developers onboarding to a specific service

### Key elements
| Element | C4-PlantUML Macro | When to use |
|---------|-------------------|-------------|
| Component | `Component(alias, label, technology, description)` | Controllers, services, repos, clients |
| Component (database) | `ComponentDb(alias, label, technology, description)` | Embedded data stores within the container |
| Container boundary | `Container_Boundary(alias, label)` | Wraps the container being detailed |
| External containers | `Container(...)` / `ContainerDb(...)` | Other containers this one talks to |

### What to include
- Major logical groupings (not every class — groups of related classes)
- Responsibilities of each component
- How components interact internally
- How components connect to external containers (database, cache, other services)

### What NOT to include
- Every single class or function (that's Level 4)
- Implementation details like algorithms or data structures
- Containers that don't interact with this one

### When to create this diagram
- The container is complex (many responsibilities, multiple integration points)
- Multiple developers work on it and need a shared mental model
- You're onboarding someone to the service

### When to skip it
- The container is simple (CRUD API with a database)
- The team is small and everyone knows the code
- The service will be rewritten soon

### Common mistakes
1. **Creating it for every container** — Only the complex/important ones need this level
2. **Too granular** — Showing individual classes instead of logical groupings
3. **Forgetting external connections** — Components don't exist in isolation; show what they talk to
4. **Stale diagrams** — Component diagrams rot fastest; only maintain them if they provide ongoing value

### Applied example
> 📂 See [`c4_3_component.puml`](../c4_3_component.puml) — Zooms into the Order Service showing OrderController, OrderProcessor, PaymentClient, InventoryClient, CacheManager, and OrderRepository.

---

## Level 4 — Code

### What it is
The lowest level: actual classes, interfaces, enums, and their relationships (inheritance, composition, dependency). This is essentially a UML class diagram.

### Audience
- Developers writing or modifying the code
- Code reviewers examining domain model design

### Key elements
Standard UML class diagram notation (NOT C4 macros):
- Classes with attributes and methods
- Interfaces
- Enums
- Relationships: inheritance (`--|>`), composition (`*--`), aggregation (`o--`), dependency (`..>`)

### What to include
- Core domain model (entities, value objects, aggregates)
- Key interfaces and their implementations
- Important design patterns (strategy, factory, repository)

### What NOT to include
- Every class in the codebase (only the core/important ones)
- Utility classes, DTOs, or framework boilerplate
- Implementation bodies (just signatures)

### When to create this diagram
- Complex domain model that benefits from visual documentation
- Shared libraries or SDKs that other teams consume
- Critical algorithms or patterns that aren't obvious from code

### When to skip it (most of the time)
- Your IDE generates better class diagrams automatically
- The code is the documentation (clean code with good naming)
- The domain model is simple or well-known (CRUD)

### Common mistakes
1. **Creating it at all when unnecessary** — This level is optional; most teams skip it
2. **Trying to show everything** — Focus on the domain model core, not the entire package
3. **Not keeping it updated** — A wrong class diagram is worse than no diagram
4. **Using C4 macros** — Level 4 uses standard PlantUML class syntax, not C4 macros

### Applied example
> 📂 See [`c4_4_code.puml`](../c4_4_code.puml) — Shows the Order aggregate root, OrderItem, OrderStatus enum, OrderRepository interface, and OrderService.

---

## Deployment Diagram (Supplementary)

### What it is
Shows WHERE containers from Level 2 run: which servers, pods, cloud services, clusters, and how they're networked. Not a C4 "level" per se, but a critical supplementary view for production systems.

### Audience
- DevOps / SRE
- Platform engineers
- Architects reviewing infrastructure decisions
- Developers debugging production issues

### Key elements
| Element | C4-PlantUML Macro | When to use |
|---------|-------------------|-------------|
| Deployment node | `Deployment_Node(alias, label, type, description)` | VMs, pods, clusters, cloud regions, namespaces |
| Node (shorthand) | `Node(alias, label, type, description)` | Same as above, shorter name |
| Container (deployed) | `Container(alias, label, technology, description)` | The actual running container inside a node |
| Container DB (deployed) | `ContainerDb(alias, label, technology, description)` | Database instance in a node |

### What to include
- Cloud provider / region / availability zone
- Kubernetes cluster, namespaces, pods
- Service mesh components (Istio ingress, sidecars)
- Load balancers, API gateways at infra level
- Replicas (if relevant to understanding the architecture)
- External services as nodes outside your cloud

### What NOT to include
- Internal component details (that's Level 3)
- Every Kubernetes label or annotation
- CI/CD pipeline details (separate diagram)

### Common mistakes
1. **Mixing with container diagram** — Deployment shows WHERE things run, Container shows WHAT runs
2. **Too much Kubernetes detail** — Show meaningful structure (namespaces, pods), not every ConfigMap
3. **Forgetting sidecars** — In service mesh architectures, sidecars are architecturally significant
4. **Not showing external dependencies** — Where do external API calls go? Through what path?

### Applied example
> 📂 See [`c4_5_deployment.puml`](../c4_5_deployment.puml) — Shows AWS → EKS cluster → Istio mesh with Envoy sidecars → namespaces (ecommerce, data, messaging) → pods.

---

## How to Decide Which Level You Need

```
Start here: Do you have a system to document?
│
├─ YES → Create Level 1 (System Context) — ALWAYS
│   │
│   └─ Is the system more than a single app + database?
│       │
│       ├─ YES → Create Level 2 (Container) — show all services/DBs
│       │   │
│       │   └─ Is any container complex (many responsibilities)?
│       │       │
│       │       ├─ YES → Create Level 3 (Component) for THAT container only
│       │       └─ NO  → Stop here
│       │
│       └─ NO → Level 1 might be enough. Add Level 2 if technology matters.
│
├─ Do you deploy to non-trivial infrastructure (K8s, multi-region, service mesh)?
│   │
│   ├─ YES → Create Deployment diagram
│   └─ NO  → Skip it (Heroku, single server = not worth diagramming)
│
└─ Is the domain model complex and shared across teams?
    │
    ├─ YES → Consider Level 4 (Code) for the core domain
    └─ NO  → Skip Level 4 (let the code speak for itself)
```

---

## Tips for Maintaining C4 Diagrams

1. **Level 1 and 2 are the most valuable** — Keep these current; they change infrequently
2. **Level 3 and 4 rot fast** — Only maintain them if they're actively used in onboarding or reviews
3. **Store diagrams as code** — `.puml` files in the repo, versioned alongside the code
4. **One diagram per file** — Easier to review in PRs and render independently
5. **Add comments in `.puml` files** — Mark sections with "CUSTOMIZE: ..." so others know what to change
6. **Use consistent naming** — Alias naming convention: `snake_case` for aliases, "Title Case" for labels
7. **Review diagrams in PRs** — When architecture changes, update the relevant diagram in the same PR

---

## C4-PlantUML Quick Reference

```plantuml
' === INCLUDES ===
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Deployment.puml

' === PEOPLE ===
Person(alias, "Label", "Description")
Person_Ext(alias, "Label", "Description")

' === SYSTEMS ===
System(alias, "Label", "Description")
System_Ext(alias, "Label", "Description")

' === CONTAINERS ===
Container(alias, "Label", "Technology", "Description")
ContainerDb(alias, "Label", "Technology", "Description")
ContainerQueue(alias, "Label", "Technology", "Description")

' === COMPONENTS ===
Component(alias, "Label", "Technology", "Description")
ComponentDb(alias, "Label", "Technology", "Description")

' === DEPLOYMENT ===
Deployment_Node(alias, "Label", "Type", "Description")
Node(alias, "Label", "Type", "Description")

' === BOUNDARIES ===
System_Boundary(alias, "Label") { }
Container_Boundary(alias, "Label") { }
Enterprise_Boundary(alias, "Label") { }

' === RELATIONSHIPS ===
Rel(from, to, "Label", "Technology")
Rel_U(from, to, "Label")    ' Up
Rel_D(from, to, "Label")    ' Down
Rel_L(from, to, "Label")    ' Left
Rel_R(from, to, "Label")    ' Right
BiRel(from, to, "Label")    ' Bidirectional

' === LAYOUT ===
LAYOUT_TOP_DOWN()
LAYOUT_LEFT_RIGHT()
LAYOUT_WITH_LEGEND()
SHOW_LEGEND()

' === TAGS (custom styling) ===
AddElementTag("tagName", $bgColor="color", $fontColor="color", $borderColor="color")
AddRelTag("tagName", $textColor="color", $lineColor="color")
```
