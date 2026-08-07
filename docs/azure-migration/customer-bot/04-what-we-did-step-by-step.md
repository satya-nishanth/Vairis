# What We Did, Step by Step

A full chronological narrative of the deploy session. Cross-references point to doc 02 (CLI tools) and doc 03 (infra files) for deeper explanation of any individual command or file; doc 05 covers the three failures in depth — they're only mentioned briefly here, in their proper place in the timeline.

## 1. Understanding what we were actually deploying

Before writing any Azure config, we cloned the bot repo and read it — `package.json`, `Dockerfile`, `render.yaml`, `RENDER_DEPLOY.md`, and the top of `index.js`. This mattered because the *shape* of an app determines what kind of Azure resource it needs, and this app has an unusual shape:

- **No HTTP server, no port.** It's a background worker, not a website — it connects *out* to WhatsApp and Discord, nothing connects *in* to it. This ruled out resources designed around "receiving web traffic."
- **Needs a real Chrome browser.** The library `whatsapp-web.js` works by literally automating a headless Chrome browser that stays logged into web.whatsapp.com. The `Dockerfile` already installed a lightweight Chromium build for this.
- **Exactly one instance, forever.** A WhatsApp Web login session is tied to one specific browser instance. Two copies running at once would fight each other and both fail.
- **Was already fighting a memory ceiling.** `RENDER_DEPLOY.md` documented a whole history of out-of-memory crashes on Render.com's 512MB tier, including a hardcoded `--max-old-space-size=128` flag in `package.json`'s start script as a workaround.

This ruled out an ordinary "web app" hosting product and pointed straight at **Azure Container Apps**, running with **no ingress** (no public HTTP endpoint) and **fixed at 1 replica** (never 0, never more than 1) — see doc 01's resource table for what a Container App actually is.

## 2. Getting the tools installed and logged in

None of the CLI tools we needed (`az`, `azd`, `gh`) were on the machine. We installed all three with `brew install azure-cli azd gh` (doc 02 explains why three separate tools). Then, in order:

1. `az login` — browser login, then had to select a subscription from a list (only one existed: `Azure subscription 1`).
2. `gh auth login --web --git-protocol https` — separate GitHub login, needed to clone the private bot repo.
3. `azd auth login` — a third, separate login specifically for `azd`.

Each of these is a genuinely independent credential store — doc 02 explains why logging into one doesn't log you into the others.

## 3. Getting the bot's code and understanding it fully

```bash
gh repo view MahammadFayazShaik/Vairis_Customer_Bot --json name,description,defaultBranchRef,isPrivate,primaryLanguage
gh repo clone MahammadFayazShaik/Vairis_Customer_Bot <path>
gh api repos/MahammadFayazShaik/Vairis_Customer_Bot --jq '.permissions'
```

Confirmed the repo was private, written in JavaScript (not Python, which the original project notes had assumed), cloned it, and confirmed push access even though the repo belongs to a different GitHub account. Later in the session, on request, the cloned folder was physically moved from a temporary scratch location to sit alongside the main Vairis repo at `Vairis-all/Vairis_Customer_Bot` — a plain filesystem `mv`, nothing Azure-related.

## 4. Writing the infrastructure files

Four new files were written into the bot repo: `azure.yaml`, `infra/main.bicep`, `infra/resources.bicep`, `infra/main.parameters.json`. Doc 03 covers every line of these in depth. Before doing anything else with them, we ran:

```bash
az bicep build --file main.bicep --stdout
```

This compiles the Bicep files (without deploying anything) purely to catch typos and structural mistakes early — much faster than finding out about a syntax error 5 minutes into a real deployment.

## 5. Setting up the `azd` environment

```bash
azd env new prod --location centralindia
```

This is the point where we deliberately created *only* a `prod` environment, no `staging` — you'd explicitly asked for a direct, immediate deploy, and this was re-confirmed partway through the session when it came up again (a `staging` environment for the bot can be added later exactly the same way, with its own resource group, if it's ever wanted).

We then needed to get four pieces of real configuration — a Discord bot token, a Discord channel ID, a Supabase project URL, and a Supabase key — into this environment. You provided these via a file, `.env.prod`, placed directly in the bot repo folder (**never committed to git** — more on this in doc 06's security notes). We loaded each value in with `azd env set KEY value`, deliberately choosing to have the assistant run these commands with values read directly from your file, so the raw secret values never appeared as visible text in the conversation itself.

This step is also where the second of our three failures happened — `azd env set` (and later, `azd provision`) has a real bug in this specific version that scrambled the saved config file. Full story in doc 05, section 2.

## 6. First deploy attempt — missing subscription ID

```bash
azd provision --no-prompt
```

Failed immediately: `1 required input is missing: subscription`. Explained in doc 05, section 1 — the short version is that `azd provision` needs to know *which* Azure subscription to deploy into, and normally asks interactively, but `--no-prompt` (used because this command was run non-interactively) disables that question, so it needs the answer supplied ahead of time instead. Fixed with:

```bash
azd env set AZURE_SUBSCRIPTION_ID "b4a90cf3-5e5c-4ddb-b391-08d541777c91"
```

## 7. Second and third deploy attempts — the `azd` config-corruption bug

Retrying `azd provision` failed differently each time, with `azd` reporting it couldn't parse its own saved config file. This turned out to be a genuine bug in `azd` version 1.28.0's internal save routine, not anything about our specific values — proven by reproducing (and *failing* to reproduce) the corruption in an isolated throwaway test folder. Full diagnostic story in doc 05, section 2.

The practical fix was to sidestep `azd provision` entirely for the initial resource creation, and use the equivalent lower-level `az` command instead:

```bash
az deployment sub create \
  --name vairis-bot-prod-<timestamp> \
  --location centralindia \
  --template-file infra/main.bicep \
  --parameters @bot-deploy-params.json
```

This succeeded. `rg-vairis-bot-prod` and everything inside it (registry, storage account, Container Apps Environment, the Container App itself running its placeholder "hello world" image) now existed in Azure.

## 8. Deploying the actual bot code

```bash
azd deploy bot --no-prompt
```

This step — build the Docker image, push it to the registry, update the Container App to run it — worked cleanly (after one more repair of the still-corrupted local config file it needed to *read*, even though this specific command doesn't have the same *write* bug that `provision` does). It reported success in about 3 minutes:

```
SUCCESS: Your application was deployed to Azure in 3 minutes 12 seconds.
```

## 9. The bot was running, but crashing

Checking logs (`az containerapp logs show`) and replica health (`az containerapp replica list`) showed the container was crash-looping — starting up, failing, and restarting, repeatedly. Two distinct problems surfaced in the logs, in order:

1. `Supabase Error: TypeError: fetch failed` — the bot couldn't reach Supabase at all.
2. `WhatsApp failed to start: Protocol error (Runtime.callFunctionOn): Execution context was destroyed.` — the embedded Chrome browser was crashing during startup.

These turned out to be two completely unrelated bugs, diagnosed and fixed independently. Full story for both in doc 05, sections 3 and 4.

**The Supabase fix:** the actual value stored for `SUPABASE_URL` and `SUPABASE_KEY` (traced all the way back to how they were originally entered into `.env.prod`) had extra, literal escaped-quote characters baked into the string itself — the app was trying to connect to a URL that literally started with a backslash and a quote character. Corrected the values and pushed them straight onto the already-running container:

```bash
az containerapp update -n ca-vairis-bot-kcwsblmgxzvam -g rg-vairis-bot-prod --set-env-vars "SUPABASE_URL=<corrected>" ...
az containerapp secret set -n ca-vairis-bot-kcwsblmgxzvam -g rg-vairis-bot-prod --secrets "supabase-key=<corrected>"
az containerapp revision restart -n ca-vairis-bot-kcwsblmgxzvam -g rg-vairis-bot-prod --revision <revision-name>
```

**The Chrome crash fix:** confirmed (by testing) that Chrome cannot reliably run its browser profile from the Azure Files network mount we'd set up for exactly that purpose — the file-locking behavior of that storage protocol (SMB) doesn't get along with how Chrome manages its profile directory. Worked around it by pointing the bot at local, temporary disk storage instead:

```bash
az containerapp update -n ca-vairis-bot-kcwsblmgxzvam -g rg-vairis-bot-prod --set-env-vars "WWEBJS_AUTH_PATH=/tmp/.wwebjs_auth"
```

## 10. Success — QR scan and go-live

After that change, the very next restart produced a clean startup: Supabase connected ("Loaded 25 sessions from Cloud"), Discord connected, and — for the first time — a WhatsApp login QR code was generated and posted to the Discord support channel, exactly as the bot's own code is designed to do. You scanned it from your phone within the ~60-second window, and the logs confirmed:

```
WhatsApp authenticated — waiting for full connection...
```

The bot was live.

## 11. Making the fix permanent, and committing everything

The `WWEBJS_AUTH_PATH` fix had only been applied *live*, directly to the running container — it wasn't yet reflected in the checked-in Bicep files, meaning a future `azd provision` run would silently undo it. `infra/resources.bicep` was updated to include this environment variable properly (with a comment explaining why it's there — see doc 03), verified to still compile cleanly, and committed:

```bash
git add azure.yaml infra/ .gitignore
git commit -m "infra: add azd/Bicep setup for Azure Container Apps prod deploy"
```

Note `.gitignore` is in that list too — `.env.prod` (the file holding your real secrets) was not being ignored by the bot repo's existing `.gitignore`, which was fixed (`.env.*` added) *before* staging anything, specifically so that file could never accidentally end up in a commit. Confirmed with `git status --short` that only the four intended infra files were staged, then pushed:

```bash
git push origin main
```

## Where things stand now

Everything above is done. The bot is live in Azure, connected and running. The one open item — WhatsApp session data not surviving a container restart — is a known, understood, and documented gap, not a mystery. See [06-current-state-and-next-steps.md](./06-current-state-and-next-steps.md) for exactly what fixing it properly would involve.
