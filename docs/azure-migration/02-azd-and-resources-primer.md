# azd Workflow & Resource Primer

Read this before Phase 0. It explains two things every later phase assumes: how **Azure Developer CLI (azd)** drives the staging→prod workflow, and what every Azure resource this roadmap touches actually *is*. Come back to this file whenever a phase introduces a resource you don't recognize — each phase links back here instead of re-explaining.

## Why azd, and how it changes this roadmap

Everything in this roadmap is now organized around two **azd environments**: `staging` and `prod`. They are two independent, fully-isolated copies of the same infrastructure (own resource group, own database, own Container Apps, own everything except the shared image registry) driven by one shared set of Bicep files. The pattern for every phase from here on is the same:

```
azd env select staging
azd provision   # apply this phase's Bicep changes to the staging environment
azd deploy      # (phases with app code only) build + push + roll out the container
# → verify in staging, break things safely, iterate
azd env select prod
azd provision   # apply the *same* Bicep to prod
azd deploy
# → verify in prod
```

`azd provision` and `azd deploy` together are what `azd up` does in one shot — the roadmap generally does them separately so a phase's infra changes can be reviewed/verified before app code rolls out on top of them.

**Why this instead of hand-run `az` commands per environment (what earlier drafts of this roadmap did):** running the same imperative CLI commands twice, once per environment, is exactly the kind of copy-paste drift that causes staging and prod to quietly diverge. azd forces both environments through the *same* Bicep templates with only parameter values differing — if it works in staging, the exact same template is what runs in prod, not a remembered variation of it.

### The pieces

| Piece | What it is |
|---|---|
| `azure.yaml` | Repo-root manifest. Lists your app's deployable "services" (e.g. `web` = the Next.js container, `auth` = the GoTrue container) and which Azure resource type each maps to. |
| `infra/main.bicep` | The entrypoint template. Declares the resource group and wires in every module below. Takes an `environmentName` parameter azd supplies automatically (`staging` or `prod`). |
| `infra/modules/*.bicep` | One file per resource "family" (network, database, storage, container apps, etc.) — added incrementally, one module per phase. |
| `.azure/<env>/.env` | Per-environment parameter values azd manages for you (subscription ID, location, resource names). Two of these exist side by side — `staging` and `prod` — never shared. |
| `azd env select <name>` | Switches which environment subsequent `azd provision`/`azd deploy` commands target. This is *the* command that makes "experiment in staging, then move to prod" mechanical instead of a manual checklist. |
| `azd pipeline config` | One command that sets up a GitHub Actions workflow *and* the federated OIDC credentials it needs to deploy — replaces hand-writing both, covered in Phase 0. |

### AWS analogy

There isn't an exact one-to-one AWS tool, but the shape is closest to **AWS Copilot CLI**: an app-centric CLI that owns a manifest, understands "environments" as a first-class concept, and wraps CloudFormation the way azd wraps Bicep+ARM. If you've used Copilot's `copilot env init` / `copilot deploy --env staging`, `azd env new` / `azd env select` / `azd provision` will feel familiar.

---

## Resource glossary

Every resource introduced anywhere in this roadmap, explained plainly, with the phase it first shows up in and its nearest AWS equivalent.

| Resource | What it actually is | Why Vairis needs it | AWS analog | First appears |
|---|---|---|---|---|
| **Resource Group** | A logical folder — every resource lives in exactly one, and deleting the group deletes everything in it. No AWS equivalent, closest is a CloudFormation stack's resource set. | One per azd environment (`rg-vairis-staging`, `rg-vairis-prod`) — gives each environment a clean, single blast-radius boundary you can inspect or tear down as a unit. | *(no direct equivalent)* | Phase 0 |
| **Azure Subscription** | The billing + access boundary above resource groups. | You have one; both environments' resource groups live inside it. | AWS Account | Phase 0 |
| **Microsoft Entra ID** | The identity directory — who (or what) can authenticate against this subscription at all. | Holds your admin user, your break-glass account, and the App Registration GitHub Actions authenticates as. | IAM (identity side) | Phase 0 |
| **Managed Identity** | An identity Azure manages the lifecycle and credentials of automatically, attached to a specific resource (e.g. a Container App). No password or key to leak or rotate. | Lets the Next.js Container App read Key Vault secrets without any connection string or key sitting in an env var. | EC2 instance profile / IAM role for a service | Phase 6 |
| **Azure RBAC role assignment** | "This identity may do X to this resource." | Grants the Container App's Managed Identity read access to specific Key Vault secrets, and nothing else. | IAM policy attached to a role | Phase 0 / 6 |
| **Federated Identity Credential** | A trust relationship on an App Registration that says "accept OIDC tokens from GitHub Actions for this specific repo/branch as proof of identity" — no stored secret. | How GitHub Actions authenticates to Azure to run `azd deploy` in CI, with nothing sitting in GitHub Secrets that could leak. | IAM OIDC identity provider + role trust policy (`aws-actions/configure-aws-credentials` pattern) | Phase 0 |
| **Bicep** | The IaC language itself — declarative resource definitions, compiled to ARM JSON at deploy time, no state file to manage (Azure tracks deployment state server-side). | Every resource in this roadmap is defined as a `.bicep` file, not a one-off CLI command, specifically so staging and prod can never drift. | CloudFormation / CDK | Phase 0 |
| **Container Apps Environment** | The shared network + logging boundary a group of Container Apps live inside — think "the cluster," except there's no cluster to patch or size, it's fully serverless. | One per azd environment; hosts both the Next.js app and GoTrue as separate Container Apps inside it. | An ECS cluster (Fargate-backed) | Phase 4 |
| **Container App** | One deployable containerized service — its own image, scaling rules, ingress, secrets — running inside a Container Apps Environment. | Two of these per environment: the Next.js app (`web`) and self-hosted GoTrue (`auth`). | ECS Fargate Service / App Runner service | Phase 3 / 4 |
| **Azure Container Registry (ACR)** | A private Docker image registry. | Holds every built Next.js image before Container Apps pulls it. Kept as the one resource **shared** across staging and prod (see note below) — images are tagged per environment/commit, no reason to duplicate the registry itself. | ECR | Phase 0 |
| **Azure Database for PostgreSQL — Flexible Server** | A fully-managed Postgres instance — Azure handles patching, backups, failover. | The database itself, one per environment. Staging gets a cheap tier for rehearsal; prod gets the real data. | RDS for PostgreSQL | Phase 2 |
| **Azure Blob Storage** (Storage Account + container) | Object storage for files. A "Storage Account" is the top-level resource; a "container" inside it is roughly a bucket. | Holds product images/video, replacing Supabase Storage. One storage account per environment. | S3 (container ≈ bucket) | Phase 3 |
| **Azure Key Vault** | A managed secret store with fine-grained access control and audit logging. | Every credential (DB password, Razorpay secret, JWT secret, etc.) lives here, never in a plaintext env var. One per environment — staging secrets and prod secrets never share a vault. | Secrets Manager | Phase 0 / 6 |
| **Virtual Network (VNet) + Subnets** | A private network boundary. Resources placed inside can reach each other over private IPs without touching the public internet. | Lets the Container Apps Environment and the database talk privately, so the database's public network access can be turned off entirely. One VNet per environment. | VPC + subnets | Phase 4 |
| **Private Endpoint** | A network interface that brings a normally-public-facing Azure service into your VNet with a private IP. | Used on the database so it's reachable from inside the VNet but has zero public internet exposure. | VPC Interface Endpoint / RDS deployed in a private subnet | Phase 4 |
| **Azure Front Door** | A global edge network: CDN caching, TLS termination, custom domain, and (Premium tier) WAF, sitting in front of Container Apps. | Fronts the app's public URL, handles the custom domain + certificate, and enforces rate limiting. One Front Door profile per environment (staging gets a throwaway subdomain, prod gets the real domain). | CloudFront + AWS WAF combined | Phase 5 |
| **WAF Policy** | The actual ruleset Front Door enforces — managed OWASP-style rules plus your own custom rules (e.g. rate limits). | Closes the "no rate limiting on public APIs" gap called out in LAUNCH.md. | AWS WAF Web ACL | Phase 5 |
| **Log Analytics Workspace** | The data store behind Azure Monitor — every log line and metric this roadmap generates lands here, queried with KQL. | One per environment, so staging noise never pollutes prod dashboards/alerts. | CloudWatch Logs (log group) | Phase 1 |
| **Application Insights** | The APM/tracing layer on top of Log Analytics — request rates, latencies, exceptions, a live traffic view. | Replaces `@vercel/analytics`; instrumented early (Phase 1) precisely so you're fluent in it before it matters. | X-Ray + CloudWatch metrics, combined | Phase 1 |
| **Azure Monitor Alert Rule + Action Group** | A condition ("5xx rate > N in 5 minutes") paired with what to do about it (email, webhook). | Prod gets real alert rules in Phase 6; staging typically doesn't need the same paging behavior. | CloudWatch Alarm + SNS topic | Phase 6 |
| **Cost Management Budget** | A spend threshold on a subscription or resource group, with alert emails at configurable percentages. | Set once, subscription-wide, in Phase 0, before any resource that costs money exists. | AWS Budgets | Phase 0 |

**Why ACR is the one shared exception:** every other resource is deliberately duplicated per environment so staging is a true, isolated rehearsal of prod. A container registry is different — it's just image storage, tagged by environment and commit SHA already (`vairisacr.azurecr.io/vairis:staging-<sha>` vs `...:prod-<sha>`), so splitting it in two would only add cost and complexity with no isolation benefit. It lives in its own `rg-vairis-shared` resource group, created once in Phase 0, outside azd's per-environment lifecycle.

---

*Back to [00-overview.md](./00-overview.md) · Previous: [01-aws-to-azure-glossary.md](./01-aws-to-azure-glossary.md) · Next: [03-phase0-foundations.md](./03-phase0-foundations.md)*
