# Azure Concepts for Beginners

Azure organizes everything into a strict hierarchy. Understanding this hierarchy is 80% of understanding Azure — everything else is just "which specific resource type do I need."

```
Microsoft Entra ID (your identity / login)
  └── Azure Subscription (the billing boundary)
        └── Resource Group (a folder for related resources)
              └── Resources (the actual things: a container, a database, a storage account...)
```

## Microsoft Entra ID — "who can log in at all"

This is Azure's identity system (it used to be called "Azure Active Directory" — you may still see that name in older docs/tutorials). It's the layer that answers "who are you, and are you allowed to touch this Azure account at all."

When you ran `az login` and `azd auth login`, you were authenticating against Entra ID. Two separate logins were needed because `az` (the general Azure CLI) and `azd` (a higher-level tool built on top of it) keep independent credential caches — logging into one doesn't log you into the other. Annoying, but that's how it is.

**AWS comparison:** this is IAM's identity side — "who is this," separate from "what can they do."

## Azure Subscription — the billing + top-level access boundary

A subscription is the container everything else lives inside, and it's the unit Azure bills against. You have one: `Azure subscription 1` (ID `b4a90cf3-5e5c-4ddb-b391-08d541777c91`).

Every resource we created belongs to this one subscription. If you ever create a second subscription (e.g., to separate "personal experiments" billing from "Vairis production" billing), you'd need to explicitly select which one a deployment targets — which is exactly what the `AZURE_SUBSCRIPTION_ID` value in the bot's `azd` config controls (more on that in doc 05, since forgetting to set this was our first failure).

**AWS comparison:** an AWS Account.

## Resource Group — a folder with a blast radius

A resource group (often shortened "RG") is a logical folder. Every resource lives in exactly **one** resource group. Deleting a resource group deletes *everything inside it*, permanently, in one action.

This is the single most useful safety concept in Azure: **group things by "would I ever want to delete/tear these down together?"** We named the bot's resource group `rg-vairis-bot-prod` — everything the bot needs (its compute, its image registry, its logging, its storage) lives in that one group. If you ever wanted to completely remove the bot from Azure, one command — `az group delete --name rg-vairis-bot-prod` — would clean up every resource with zero leftovers. We have *not* run that command; this is just explaining why the resource group exists.

**AWS comparison:** there isn't a perfect one. The closest idea is "the set of resources in a CloudFormation stack," but in Azure this grouping is a first-class, always-present concept, not something you opt into via a specific tool.

## Region — where the physical servers are

Every resource is created in a specific geographic region (a cluster of Microsoft data centers). We used `centralindia` (Central India — Pune). This matters for two reasons: latency (closer to your customers = faster), and sometimes cost or resource availability (not every resource type exists in every region).

## Resources — the actual things

Everything below the resource group is a "resource": a running container, a storage account, a container registry, a logging workspace. Each resource has:
- A **name** (must usually be unique in some scope — sometimes just within the resource group, sometimes globally across all of Azure, depending on the resource type)
- A **type** (e.g. `Microsoft.App/containerApps` — Azure's internal type identifiers always look like `Provider/ResourceType`)
- A set of **properties** specific to that type

Here's exactly what we created inside `rg-vairis-bot-prod`, and what each one actually is:

| Resource | Name we gave it | What it actually is | Why the bot needs it |
|---|---|---|---|
| Log Analytics Workspace | `log-vairis-bot-kcwsblmgxzvam` | A database that stores log lines and metrics. | Every `console.log` the bot prints ends up queryable here. Required by Container Apps — you can't have a Container Apps Environment without one. |
| Container Apps Environment | `cae-vairis-bot-kcwsblmgxzvam` | A shared network + logging boundary that one or more Container Apps live inside. Despite the name, there's no cluster to patch or size — it's fully serverless. | The "neighborhood" the bot's container lives in. |
| Managed Identity | `id-vairis-bot-kcwsblmgxzvam` | An identity Azure manages automatically — no password, no key you could leak. | Lets the container log into the container registry (below) without a stored username/password. |
| Azure Container Registry (ACR) | `acrvairisbotkcwsblmgxzvam` | A private Docker image registry — like a private, Azure-hosted version of Docker Hub. | Stores the bot's built Docker image so the Container App can pull it. |
| Storage Account + File Share | `stvairisbotkcwsblmgxzvam` | A cloud file storage account. A "storage account" is the top-level container; a "file share" inside it is one specific network-mounted folder. | *Intended* to hold the bot's WhatsApp login session persistently. As explained in doc 05, this specific approach didn't actually work — this resource currently exists but isn't doing its job yet. |
| Container App | `ca-vairis-bot-kcwsblmgxzvam` | One deployable containerized service: its own Docker image, CPU/memory allocation, scaling rules, environment variables, secrets. | This is the bot itself — the actual running Node.js process. |

Every one of these names ends in the same random-looking suffix, `kcwsblmgxzvam`. That's not a coincidence — it's explained in doc 03 (it comes from a Bicep function called `uniqueString`, used to keep resource names globally unique without you having to invent them by hand).

## Bicep and ARM — how any of this actually gets created

You never click "create resource" by hand in Azure for anything meant to be reproducible. Instead you write a **declarative description** of what you want to exist, and a tool makes reality match that description. Azure's native format for this is called **ARM (Azure Resource Manager) JSON** — verbose and painful to hand-write. **Bicep** is a much friendlier language that *compiles down to* ARM JSON. Every `.bicep` file in the bot's `infra/` folder is Bicep source; when deployed, Azure silently compiles it to ARM JSON first. You never see that JSON, and you don't need to.

This is explained in full, file by file, in doc 03.

## A note on cost

Everything in the table above costs money while it exists (Azure has no meaningful free tier for Container Apps running 24/7). The Container App is configured to run exactly one replica, always on — because a WhatsApp session is tied to one running Chrome browser instance, it can't scale to zero or run multiple copies. This means it's billed continuously, not just when it's actively doing something. This is a normal tradeoff for "always-on bot," not a mistake — but worth knowing.
