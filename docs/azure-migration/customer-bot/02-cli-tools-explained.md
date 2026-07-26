# The CLI Tools — `az`, `azd`, and `gh`

We installed three separate command-line tools for this deploy. None of them are optional — each does a distinct job. This doc explains what each one is, and exactly which commands we ran and why.

## Why three tools, not one

| Tool | Full name | What it's actually for | Analogy |
|---|---|---|---|
| `az` | Azure CLI | The low-level, do-anything tool. Every Azure operation is possible through `az` — create a resource, delete a resource, read logs, update an environment variable. | The raw AWS CLI (`aws ...`) |
| `azd` | Azure Developer CLI | A higher-level, opinionated workflow tool built *on top of* `az`. It understands the idea of "my app" as a whole (via `azure.yaml`), and bundles "build my code, push the image, deploy it" into one command. | Something like AWS Copilot CLI — app-centric, not resource-centric |
| `gh` | GitHub CLI | Nothing to do with Azure — this is for talking to GitHub. We needed it to clone the *private* bot repository and to push commits back to it. | `git`, but with GitHub-specific superpowers like `gh repo clone` handling auth for you |

None of these came pre-installed. We installed all three with one command:

```
brew install azure-cli azd gh
```

`azure-cli` is the Homebrew package name for the `az` command; `azd` is the package name for the `azd` command.

## Logging in — three separate logins were needed

This tripped us up initially, worth knowing for next time: **`az` and `azd` do NOT share a login.** Logging into one does not log you into the other, even though they're both "Azure."

```
az login
```
Opens a browser, you sign in, and then — because your account had access to more than one thing — it needed you to pick *which* subscription to use as the default for `az` commands. (It listed exactly one option, `Azure subscription 1`, and you pressed Enter to accept it.)

```
azd auth login
```
A *separate* login, for `azd` specifically. In our case this one completed silently without needing a manual browser step (it reused/detected an existing session), and reported: `Logged in to Azure as vairis.corp@gmail.com`.

```
gh auth login --web --git-protocol https
```
A *third*, completely unrelated login — this is GitHub, not Azure. It uses a "device code" flow: it prints a one-time code (e.g. `AD70-FC4D`), you open a URL in your browser, paste the code, and approve it. This is how `gh` proved to GitHub that it's allowed to act as you (specifically, as `satya-nishanth`).

## Every `az` command we ran, and what it did

`az` commands generally follow the pattern `az <resource-type> <verb> [options]`. Here's every one we used:

```bash
az account show
```
"Who am I logged in as, and which subscription is currently active?" — used repeatedly just to sanity-check we were pointed at the right subscription.

```bash
az bicep install
```
Bicep (the infrastructure language, explained in doc 03) needs its own compiler binary. This downloads and installs it. `az` prompts to do this automatically the first time you try to use Bicep if it's missing — which is exactly what happened.

```bash
az deployment sub create --name ... --location centralindia --template-file infra/main.bicep --parameters @params.json
```
The big one. This is "take this Bicep file, and a JSON file of parameter values, compile the Bicep to ARM JSON, and make Azure create/update whatever resources it describes." The `sub` in `deployment sub` means "this deployment happens at the *subscription* level" (as opposed to inside an already-existing resource group) — appropriate here because our `main.bicep` file's very first job is to *create* the resource group itself, so nothing exists yet for the deployment to target underneath.

We used this command directly (bypassing `azd provision`, which normally does the same job) because of the `azd` bug explained in doc 05.

```bash
az containerapp update -n ca-vairis-bot-kcwsblmgxzvam -g rg-vairis-bot-prod --set-env-vars "SUPABASE_URL=..." "WWEBJS_AUTH_PATH=/tmp/.wwebjs_auth"
```
Change an already-running Container App's configuration — in our case, environment variables — without touching its Docker image at all. `-n` is the resource's name, `-g` is which resource group it's in (this `-n`/`-g` pairing shows up on almost every `az containerapp ...` command, since a Container App name alone isn't enough to find it — Azure needs to know which resource group to look inside).

```bash
az containerapp secret set -n ... -g ... --secrets "supabase-key=..."
```
Container Apps has a separate concept of "secrets" (referenced by name from environment variables, rather than stored as plain env var values) — this updates the *value* of one of those.

```bash
az containerapp revision restart -n ... -g ... --revision <revision-name>
```
A "revision" is one specific version/configuration snapshot of a Container App. Env var and secret changes don't take effect on an already-running container until it restarts — this forces that restart.

```bash
az containerapp logs show -n ... -g ... --tail 40 --follow false
```
Print the last 40 log lines from the running container. This is how we watched the bot boot up, hit errors, and — eventually — successfully connect to WhatsApp. `--follow false` means "give me what you have and stop" rather than streaming live (which would never return control back to a script).

```bash
az containerapp revision list -n ... -g ... 
az containerapp replica list -n ... -g ... --revision ...
```
Diagnostic commands — "is this thing actually running, or is it crash-looping?" `replica list` in particular showed us `"restartCount": 2, "runningState": "Terminated"` — the smoking gun that told us the container was crashing repeatedly, not just slow to start.

```bash
az deployment sub show --name ... --query "properties.outputs"
```
After a deployment finishes, this reads back the `output` values the Bicep file declared (in our case: the registry's hostname, the resource group's name, the Container App's name) — needed because our first attempt to read these via a `--query` shortcut on the original `create` command used the wrong casing and returned nulls.

## Every `azd` command we ran, and what it did

```bash
azd env new prod --location centralindia
```
Creates a new named "environment" — `azd`'s term for one deployable instance of your app (you'd typically have `staging` and `prod` as separate environments; we only created `prod`, on your explicit "skip staging, deploy direct" instruction). This creates a local file, `.azure/prod/.env`, that stores config for this specific environment: subscription ID, location, and — as we'll get to — your secrets.

```bash
azd env set DISCORD_SUPPORT_CHANNEL_ID "..."
```
Writes one key/value pair into that `.azure/prod/.env` file. We used this (and, when it turned out to have a bug, a direct file-write workaround) to load in the Discord token, Supabase URL/key, and channel ID your bot needs.

```bash
azd provision
```
"Read `infra/main.bicep` + `infra/main.parameters.json`, fill in the `${VAR}` placeholders from the current environment's saved values, and deploy." This is `azd`'s wrapper around the exact same underlying operation as the `az deployment sub create` command above — except `azd provision` also handles substituting your saved secrets into the parameters file automatically. This is the command that hit the bug described in doc 05, which is why we fell back to running the equivalent `az deployment sub create` by hand.

```bash
azd deploy bot
```
The other half of `azd`'s job, and the one that worked without issue: build the Docker image from the bot's `Dockerfile`, push it to the Azure Container Registry we'd already created, and update the Container App to run that new image. The `bot` at the end is the service name — matches the `services: bot:` key in `azure.yaml` (doc 03 explains this file). `azd deploy` finds *which* Container App to update by looking for one tagged `azd-service-name: bot` inside the resource group tagged `azd-env-name: prod` — it doesn't need you to tell it the exact auto-generated resource name.

## Every `gh` command we ran, and what it did

```bash
gh auth login --web --git-protocol https
```
Covered above — proves to GitHub who you are.

```bash
gh repo view MahammadFayazShaik/Vairis_Customer_Bot --json name,description,defaultBranchRef,isPrivate,primaryLanguage
```
Ask GitHub for metadata about a repo without cloning it — this is how we discovered the repo was private and written in JavaScript before doing anything else.

```bash
gh repo clone MahammadFayazShaik/Vairis_Customer_Bot <path>
```
Clone the repo — functionally similar to `git clone`, but `gh` handles the private-repo authentication automatically using your `gh auth login` session, so you don't need a separate SSH key or personal access token set up.

```bash
gh api repos/MahammadFayazShaik/Vairis_Customer_Bot --jq '.permissions'
```
A direct call to GitHub's underlying REST API (`gh api` is an escape hatch for anything the friendlier `gh` subcommands don't cover), asking "what can I actually do to this repo?" This is how we confirmed you have push access (`"push": true`) even though you don't own the repo — necessary to know before we could commit and push the infra files back to it.
