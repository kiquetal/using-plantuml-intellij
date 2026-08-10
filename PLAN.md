# Implementation Plan - C4-PlantUML Skeleton Template (E-Commerce Platform)

## Problem Statement

Create a reusable, portable C4-PlantUML skeleton template that documents a realistic E-Commerce Order Processing Platform architecture, with clear theory documentation explaining each C4 level, so it can be cloned and adapted for any project requiring architecture documentation.

## Requirements

- All 4 C4 levels + Deployment diagram (5 diagrams total)
- Remote GitHub includes (`raw.githubusercontent.com`)
- Realistic domain: E-Commerce with API Gateway, Istio mesh with sidecars, K8s microservices, Redis cache, external services (Stripe, shipping)
- Theory/reference documentation (hybrid: generic theory + callouts to the example files)
- Separate `.puml` files per diagram
- Portable — easy to copy into another project and adapt
- IntelliJ PlantUML Integration plugin compatible (`.puml` extension, remote includes work in live preview)
- README mentions plugin name minimally, no hand-holding setup

## Project Structure

```
using-plantuml-intellij/
├── PLAN.md                            # This implementation plan
├── README.md                          # Project overview, prerequisites, how to render, how to adapt
├── c4_1_context.puml                  # Level 1: System Context
├── c4_2_container.puml                # Level 2: Container
├── c4_3_component.puml                # Level 3: Component (zoom into Order Service)
├── c4_4_code.puml                     # Level 4: Code (class-level of Order domain)
├── c4_5_deployment.puml               # Deployment: K8s + Istio + Redis + API GW
└── docs/
    └── c4-levels-guide.md             # Theory + reference for each C4 level (hybrid approach)
```

## Domain Model (for the example)

- **Actors:** Customer (mobile/web), Admin, Stripe (payment), ShipCo (shipping), SendGrid (email)
- **System:** E-Commerce Order Platform
- **Containers:** API Gateway (Kong), Order Service (Go), Payment Service (Java), Inventory Service (Python), Notification Service (Node.js), Redis Cache, PostgreSQL, Kafka
- **Components (Order Service):** Order Controller, Order Processor, Payment Client, Inventory Client, Cache Manager, Order Repository
- **Code (Order Domain):** Order, OrderItem, OrderStatus, OrderRepository, OrderService
- **Deployment:** AWS → K8s cluster → Istio mesh (Ingress GW, Envoy sidecars) → namespaces → pods

---

## Task 0: Save this plan to PLAN.md

- **Objective:** Persist this entire plan as `PLAN.md` in the project root.
- **Commit:** `docs: add implementation plan`

## Task 1: Create README.md with project overview and usage instructions

- **Objective:** Create the main README explaining what this project is, how to render the diagrams, prerequisites, and a quick guide on how to adapt the template for a new project.
- **Implementation guidance:** Sections: What is this, Prerequisites (mention PlantUML Integration plugin for IntelliJ briefly), File overview (table mapping each file to its C4 level), How to render (just open .puml in IntelliJ with plugin), How to adapt (step-by-step: 1. replace domain, 2. adjust containers, 3. update deployment). Keep it concise and actionable.
- **Commit:** `docs: add README with project overview`

## Task 2: Create docs/c4-levels-guide.md — C4 theory and reference (hybrid)

- **Objective:** Create an in-depth reference guide documenting C4 model theory with generic explanations, plus callouts linking to the example `.puml` files.
- **Implementation guidance:** For each level include:
  - **What it is** (1-2 sentences)
  - **Audience** (who should read this diagram)
  - **Key elements** (what building blocks are used)
  - **Level of detail** (what to include, what NOT to include)
  - **Common mistakes** (over-detailing, wrong audience, etc.)
  - **Applied example callout** → "See `c4_X_*.puml` for a working example"
  - Include a summary comparison table of all levels
  - Include a section on "How to decide which level you need"
- **Commit:** `docs: add C4 levels theory and reference guide`

## Task 3: Create c4_1_context.puml — System Context Diagram

- **Objective:** Level 1 diagram showing the E-Commerce platform as a black box with its actors and external systems.
- **Implementation guidance:** Use `!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml`. Elements: `Person(customer)`, `Person(admin)`, `System(ecommerce_platform)`, `System_Ext(stripe)`, `System_Ext(shipco)`, `System_Ext(sendgrid)`. Add meaningful relationship labels with protocols. Include header comments explaining the level and what to customize.
- **Commit:** `feat: add C4 Level 1 - System Context diagram`

## Task 4: Create c4_2_container.puml — Container Diagram

- **Objective:** Zoom into the platform showing all containers: API Gateway, microservices, data stores, message broker.
- **Implementation guidance:** Use `!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml`. Use `System_Boundary`. Containers: Kong API GW, Order Service (Go), Payment Service (Java), Inventory Service (Python), Notification Service (Node.js), Redis (`ContainerDb`), PostgreSQL (`ContainerDb`), Kafka (`ContainerQueue`). Show external systems outside boundary. Comments explaining Container vs ContainerDb vs ContainerQueue choices.
- **Commit:** `feat: add C4 Level 2 - Container diagram`

## Task 5: Create c4_3_component.puml — Component Diagram (Order Service)

- **Objective:** Zoom into the Order Service showing its internal components.
- **Implementation guidance:** Use `!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml`. Use `Container_Boundary` for Order Service. Components: OrderController (REST API), OrderProcessor (business logic), PaymentClient (Stripe integration), InventoryClient (gRPC to Inventory Service), CacheManager (Redis interaction), OrderRepository (PostgreSQL). Show relationships to external containers. Comments explaining when Component diagrams are worth creating.
- **Commit:** `feat: add C4 Level 3 - Component diagram`

## Task 6: Create c4_4_code.puml — Code Diagram (Order Domain)

- **Objective:** Class-level diagram of the Order domain model.
- **Implementation guidance:** Use standard PlantUML class diagram syntax (not C4 macros — this is the convention for Level 4). Classes: Order (aggregate root), OrderItem (value object), OrderStatus (enum), OrderRepository (interface), OrderService (application service). Show composition, inheritance, dependency relationships. Header comment explaining Level 4 is optional and often auto-generated from IDE.
- **Commit:** `feat: add C4 Level 4 - Code diagram`

## Task 7: Create c4_5_deployment.puml — Deployment Diagram (K8s + Istio)

- **Objective:** Show production infrastructure with K8s, Istio service mesh, and all deployed containers.
- **Implementation guidance:** Use `!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Deployment.puml`. Structure with nested `Deployment_Node`:
  - AWS Cloud → K8s Cluster → Istio Mesh
    - `istio-system` namespace: Istio Ingress Gateway, Istiod (control plane)
    - `ecommerce` namespace:
      - Pod (Order Service + Envoy sidecar)
      - Pod (Payment Service + Envoy sidecar)
      - Pod (Inventory Service + Envoy sidecar)
      - Pod (Notification Service + Envoy sidecar)
    - `data` namespace: Redis Cluster, PostgreSQL
    - `messaging` namespace: Kafka
  - External: Stripe, ShipCo, SendGrid
  - Use `AddElementTag("sidecar", ...)` with distinct color for Envoy sidecars
  - Use `AddElementTag("istio", ...)` for mesh components
- **Commit:** `feat: add C4 Level 5 - Deployment diagram (K8s + Istio)`

---

## Git Strategy

- Each task gets its own commit
- Commit messages follow conventional commits format
- Stage specific files per commit (no `git add .`)

## Key References

- C4-PlantUML library: https://github.com/plantuml-stdlib/C4-PlantUML
- Remote include base URL: https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/
- Available includes: C4_Context.puml, C4_Container.puml, C4_Component.puml, C4_Dynamic.puml, C4_Deployment.puml, C4_Sequence.puml
- Macros reference: Person, Person_Ext, System, System_Ext, SystemDb, SystemQueue, Container, ContainerDb, ContainerQueue, Component, ComponentDb, Deployment_Node, Node
- Relationship macros: Rel, Rel_U, Rel_D, Rel_L, Rel_R, BiRel
- Layout: LAYOUT_TOP_DOWN(), LAYOUT_LEFT_RIGHT(), LAYOUT_WITH_LEGEND(), SHOW_LEGEND()
- Tags: AddElementTag, AddRelTag for custom styling
- Boundary macros: System_Boundary, Container_Boundary, Enterprise_Boundary, Boundary
