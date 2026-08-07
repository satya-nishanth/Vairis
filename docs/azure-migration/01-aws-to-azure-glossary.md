# AWS → Azure Glossary

Reference table. You know AWS; this maps every concept this migration touches (and a few common ones it doesn't, for completeness) to its Azure equivalent. Azure's naming is less consistent than AWS's — services get renamed more often (see the Entra/B2C note below) — so treat exact product names as "current as of mid-2026" and expect to double-check in the Azure Portal if something looks renamed by the time you read this.

## Core account/org concepts

| AWS | Azure | Notes |
|---|---|---|
| AWS Account | **Subscription** | The billing + resource boundary. You'll have one (maybe a `dev` and `prod` subscription, or just one with resource-group separation — this roadmap uses one subscription, split by resource group, since the store is small). |
| AWS Organization | **Management Group** | Only matters at multi-subscription scale. Not needed here. |
| IAM (users, roles, policies) | **Microsoft Entra ID** (directory/identity) + **Azure RBAC** (authorization) | Entra ID is the identity store (who you are); RBAC is what you can do. Roughly: Entra ID ≈ IAM Identity Center, RBAC role assignments ≈ IAM policies. |
| IAM Role + AssumeRole | **Managed Identity** + role assignment | A Managed Identity is an auto-managed Entra identity attached to a resource (e.g. a Container App) — no secrets to rotate, same spirit as an EC2 instance profile. |
| IAM Policy (JSON) | **RBAC Role Definition** (built-in or custom) | Built-ins like "Key Vault Secrets User" cover almost everything this roadmap needs. |
| Resource tags | **Tags** | Same concept, same use (cost allocation, env labeling). |
| *(no direct equivalent — closest is tagging/OUs)* | **Resource Group** | Azure's one genuinely new concept: every resource lives inside a Resource Group, which is just a logical folder with its own lifecycle (delete the group, delete everything in it). Think of it as a blast-radius boundary you choose, e.g. `rg-vairis-prod`. |
| Region | **Region** | Same concept. Pick one close to your users — for an India-based store, **Central India** or **South India** (nearest equivalent to Supabase's `ap-south-1`). |
| Availability Zone | **Availability Zone** | Same concept, same purpose. |
| CloudFormation / CDK | **Bicep** (or **Terraform** via `azurerm` provider) | Bicep is Azure-native IaC — no state file to manage (state lives server-side), roughly CDK-flavored declarative syntax. Terraform works identically to how you already use it for AWS, just a different provider. |
| AWS Copilot CLI | **Azure Developer CLI (azd)** | **Yes — this roadmap's deploy tool, throughout.** Both are app-centric CLIs wrapping the underlying IaC (CloudFormation / Bicep) with a first-class "environment" concept (`copilot deploy --env staging` ≈ `azd env select staging && azd provision`). See [02-azd-and-resources-primer.md](./02-azd-and-resources-primer.md). |
| Cost Explorer / Budgets | **Cost Management + Budgets** | Same concept, same UI location (`Cost Management` in the Portal). |
| AWS Organizations SCPs | **Azure Policy** | Guardrails-as-code. Not needed at this scale, mentioned for completeness. |
| Systems Manager (Session Manager, Parameter Store) | **Azure Bastion** (secure access) + **App Configuration** (parameters) | Not used in this migration — no VMs to SSH into. |

## Compute

| AWS | Azure | Used here? |
|---|---|---|
| EC2 | **Azure Virtual Machines** | No. |
| ECS / Fargate | **Azure Container Apps** | **Yes** — Phase 4. Closest analog to Fargate: serverless containers, no cluster to manage, scale-to-N (and to zero if you want), pay-per-use. |
| EKS | **Azure Kubernetes Service (AKS)** | No — overkill for this app's scale. Container Apps is the right-sized choice. |
| Lambda | **Azure Functions** | Not in this migration's core path, but mentioned as the likely home for the future WhatsApp bot's event-driven pieces. |
| Elastic Beanstalk | **Azure App Service** | Considered and rejected for compute (Phase 4 explains why — `sharp`/native deps are friendlier in a container you control). |
| Amplify Hosting | **Azure Static Web Apps** | Considered and rejected — Static Web Apps' Next.js hybrid-rendering support has more caveats around ISR/middleware than Container Apps running the standalone build directly. |
| ALB / NLB | **Azure Load Balancer** / **Application Gateway** | Not directly used — Front Door (below) handles the equivalent role at the edge; Container Apps has its own internal ingress/load-balancing. |

## Storage & database

| AWS | Azure | Used here? |
|---|---|---|
| S3 | **Azure Blob Storage** | **Yes** — Phase 3, replaces Supabase Storage. |
| EFS | **Azure Files** | Mentioned as a fallback option in Phase 3 if self-hosting Supabase Storage's file backend is preferred over a native Blob rewrite (not the recommended path). |
| RDS (Postgres) | **Azure Database for PostgreSQL — Flexible Server** | **Yes** — Phase 2, replaces Supabase's Postgres. |
| Aurora | *(no direct equivalent; Flexible Server's General Purpose/Memory Optimized tiers are the closest scale-up path)* | No. |
| ElastiCache (Redis) | **Azure Cache for Redis** | Optional — only needed if/when you add a shared ISR cache handler for multi-replica Next.js (Phase 4 appendix). Not required at initial cutover. |
| DynamoDB | **Azure Cosmos DB** | Not used — the app is relational (Prisma/Postgres) throughout. |

## Networking & edge

| AWS | Azure | Used here? |
|---|---|---|
| VPC | **Virtual Network (VNet)** | **Yes** — Phase 4 puts Container Apps and the database in the same VNet. |
| Subnet | **Subnet** | Same concept. |
| Security Group | **Network Security Group (NSG)** | Same concept. |
| CloudFront | **Azure Front Door** (or plain **Azure CDN** for simpler cases) | **Yes** — Phase 5, CDN + WAF + custom domain + TLS in front of Container Apps. |
| Route 53 | **Azure DNS** | **Yes** (or keep your existing registrar and just repoint records — Azure DNS isn't mandatory) — Phase 5. |
| ACM (certificates) | **App Service Managed Certificates** / **Front Door managed TLS** | **Yes**, via Front Door — Phase 5. |
| WAF (on CloudFront/ALB) | **Azure WAF** (on Front Door) | **Yes** — Phase 5, also closes the "rate limiting on public APIs" TODO from LAUNCH.md §4. |
| Shield | **Azure DDoS Protection** | Not needed at this scale (Front Door includes basic protection by default). |

## Identity, secrets, messaging

| AWS | Azure | Used here? |
|---|---|---|
| Cognito | **Microsoft Entra External ID** | Considered for auth, **not chosen** — see Phase 3 for why self-hosting GoTrue is the recommended path instead. Entra External ID is the modern replacement for the now-legacy Azure AD B2C (B2C stopped taking new customers May 2025, supported until ~2030 — don't build new things on it). |
| Secrets Manager | **Key Vault** | **Yes** — Phase 6. |
| Systems Manager Parameter Store | **App Configuration** (or plain Key Vault for this app's scale) | Key Vault covers everything needed here. |
| KMS | **Key Vault** (Keys) | Not directly used — no custom encryption keys needed beyond what managed services provide by default. |
| SNS | **Azure Event Grid** | Not used. |
| SQS | **Azure Storage Queues** / **Service Bus** | Not used — no async queue needs in this app today. |
| EventBridge (scheduled rules) | **Logic Apps** / **Azure Functions Timer trigger** | **Explicitly not used** — GitHub Actions stays the scheduler for both existing crons and any new ones, per CLAUDE.md's constraint and principle 3 in the overview. |
| Step Functions | **Logic Apps** / **Durable Functions** | Not used. |

## CI/CD & observability

| AWS | Azure | Used here? |
|---|---|---|
| ECR | **Azure Container Registry (ACR)** | **Yes** — Phase 5, Docker image registry for the Next.js container. |
| CodePipeline / CodeBuild / CodeDeploy | **GitHub Actions**, running `azd deploy` (this roadmap doesn't use Azure DevOps Pipelines at all) | **Yes** — Phase 0 sets it up via `azd pipeline config`, same CI/CD tool you already use, now also deploying to Azure. |
| IAM Role for GitHub OIDC | **Federated Identity Credential** on a Microsoft Entra App Registration | **Yes** — Phase 0, auto-created by `azd pipeline config`, same "no long-lived secret" pattern you'd use for `aws-actions/configure-aws-credentials` with OIDC. |
| CloudWatch (metrics/alarms) | **Azure Monitor** | **Yes** — Phase 6. |
| CloudWatch Logs | **Log Analytics Workspace** (queried with KQL instead of CloudWatch Logs Insights) | **Yes** — Phase 6. |
| X-Ray | **Application Insights** (distributed tracing) | **Yes** — Phase 1 (dry run) and Phase 6 (hardened). |

---

*Back to [00-overview.md](./00-overview.md) · Next: [02-azd-and-resources-primer.md](./02-azd-and-resources-primer.md)*
