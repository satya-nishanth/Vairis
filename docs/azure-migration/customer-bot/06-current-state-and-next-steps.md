# Current State and Next Steps

## What's live right now

| Item | Value |
|---|---|
| Resource group | `rg-vairis-bot-prod` (Central India) |
| Container App | `ca-vairis-bot-kcwsblmgxzvam` — 1 vCPU, 2GB RAM, fixed at exactly 1 replica |
| Container Registry | `acrvairisbotkcwsblmgxzvam.azurecr.io` |
| Status | Running, connected to WhatsApp and Discord, storing tickets in Supabase |
| Infra code | Committed and pushed to the bot repo (`main` branch, commit `685b207`) |

You can view everything in the Azure Portal:
`https://portal.azure.com/#@/resource/subscriptions/b4a90cf3-5e5c-4ddb-b391-08d541777c91/resourceGroups/rg-vairis-bot-prod/overview`

## The one known gap: WhatsApp session doesn't survive a restart

As explained in depth in [05-failures-and-root-causes.md](./05-failures-and-root-causes.md) (Failure 4), the bot currently stores its WhatsApp login session on the container's local, temporary disk (`/tmp/.wwebjs_auth`) rather than on the persistent network storage we set up for exactly that purpose. This was a deliberate, working tradeoff to get the bot live immediately — but it has a real consequence:

**Any container restart wipes the session, and the bot needs a fresh WhatsApp QR scan to reconnect.**

Restarts can happen for a few reasons:
- You (or a future AI session) run `azd deploy` to ship a code update — this always restarts the container.
- The container crashes for any reason (a bug, an unhandled error).
- Azure itself occasionally moves a running container to different physical hardware for maintenance — this is rare but not something you control or get advance warning of on this tier of service.

When it happens: the bot will post a fresh QR code image to the Discord support channel (this is the bot's own existing, already-working behavior — nothing extra needs to be built for this part), and it needs to be scanned again within about 60 seconds, the same way we did during setup.

**This is not silently forgotten** — it's called out with a comment directly in `infra/resources.bicep` (see [03-infra-folder-explained.md](./03-infra-folder-explained.md)) so it's visible to anyone reading that file later.

## Option A: leave it as-is

If restarts are rare in practice (they should be — a stable container that isn't being redeployed or crashing can run for a long time undisturbed) and someone is available to rescan a QR code on the occasions it does happen, this may simply be acceptable. Costs nothing extra, requires no further Azure work.

## Option B: fix it properly with Premium Azure Files (NFS)

This is the real fix, but it's a meaningfully bigger piece of infrastructure than anything built so far. Worth understanding all of it before deciding whether it's worth doing:

1. **Switch the storage account to Premium, `FileStorage` kind.** The current `Standard_LRS` storage account (used for the "regular" SMB file share) would need to be replaced with a Premium-tier one, which is priced differently — Premium file storage is billed by *provisioned* capacity, and has a meaningfully higher minimum cost than the few-GB Standard share we have now, even though the bot barely needs any actual storage space.

2. **Create the file share with `NFS` protocol instead of `SMB`.** This is the actual piece that fixes Chrome's file-locking problem — NFS is a different network file-sharing protocol that behaves much closer to a real local disk.

3. **Put the whole Container Apps Environment inside a Virtual Network.** This is the big one. Azure Files shares using the NFS protocol are **not reachable over the public internet at all** — Microsoft requires them to be accessed only from inside a Virtual Network (a private network boundary, explained briefly in the main site's migration docs at `docs/azure-migration/02-azd-and-resources-primer.md`, which this bot deploy deliberately avoided needing so far). This means adding: a Virtual Network resource, a subnet specifically delegated for Container Apps to use, and reconfiguring the Container Apps Environment to launch inside that subnet instead of using its current default networking.

4. **Re-test.** After all of the above, re-verify Chrome can actually write its profile to the new mount without crashing — while NFS is the theoretically correct fix, we have not tested it in this specific setup, so this should be verified before removing the `/tmp` fallback.

Rough sizing, so this isn't a total unknown: this is roughly 3-4 new resource declarations in `resources.bicep` (a virtual network, a subnet, updating the storage account's kind/sku, updating the file share's protocol) plus one changed property on the existing Container Apps Environment resource to attach it to that subnet. It's a genuinely bigger change than anything in the current files, but it's incremental on top of what already exists — nothing already built needs to be thrown away.

## Option C: change the bot's own code instead

Worth knowing this option exists, even though it's out of scope for infrastructure work and wasn't done here: `whatsapp-web.js` (the library the bot uses) supports an alternative to `LocalAuth` called `RemoteAuth`, designed exactly for this situation — it stores the session in a *database* instead of on disk, syncing it in and out as needed. The bot already talks to Supabase for other things (it uses Supabase to store the "25 sessions" of customer support tickets you saw in the logs), so in principle the same Supabase project could also hold the WhatsApp login session, sidestepping the whole "network filesystem vs. Chrome" problem entirely — no Virtual Network, no Premium storage needed.

This would require writing actual application code changes inside the bot repo (a custom `RemoteAuth` store implementation, roughly 4 small functions), not infrastructure changes — a task for whoever maintains that codebase, not something to improvise as a side effect of an infra deploy.

## Recommendation

Given this was explicitly framed as an immediate requirement, Option A (leave as-is, live with occasional re-scans) is reasonable to start with — the bot is working today, which was the actual ask. If restarts turn out to happen often enough to be annoying in practice, Option C (the code-level fix) is probably the better long-term answer over Option B, since it avoids a meaningful chunk of new, ongoing-cost Azure infrastructure (Virtual Network + Premium storage) for a problem a moderate amount of application code can solve more cleanly. But that's a judgment call about how often restarts actually happen in practice — worth revisiting after running for a couple of weeks, not deciding blind today.

## A note on cost

Everything currently running (Container App at 1 vCPU/2GB, the Standard storage account, the Basic-tier registry, Log Analytics) is a modest, predictable monthly cost — the Container App running 24/7 is the dominant piece, since (as explained in doc 01) it can never scale to zero. If Option B is ever pursued, expect the total to increase meaningfully — Premium file storage and Virtual Network-integrated Container Apps both cost more than their simpler counterparts. Worth checking the exact current numbers in the Azure Portal's Cost Management view for `rg-vairis-bot-prod` before deciding.
