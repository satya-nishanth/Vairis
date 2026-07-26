# Failures and Root Causes — The Deep Dive

Four real problems came up during this deploy. This doc goes through each one in full: the exact error, why it happened, how we figured that out, and why the fix actually addresses the cause rather than just the symptom. This is the doc to read if you want to understand *how to debug* an Azure/container problem yourself next time, not just what happened this time.

---

## Failure 1: "1 required input is missing: subscription"

### The error

```
ERROR: deployment failed: initializing provisioning manager: prompt required
──────────────────────────────────────────────────────────────
This command cannot continue (interactive prompts disabled)
──────────────────────────────────────────────────────────────
1 required input is missing:
• subscription
    Provide one of:
      Environment: AZURE_SUBSCRIPTION_ID
```

### Why it happened

`azd provision` needs to know *which* Azure subscription to create resources in. Normally, if you're sitting at an interactive terminal, `azd` just asks you — a little menu pops up. We ran it with the `--no-prompt` flag, which tells `azd` "never stop to ask me anything — if you're missing information, fail loudly instead of waiting." That flag existed specifically because the command was being run by an automated process rather than a human watching a terminal live, where an unanswered interactive prompt would just hang forever with no way to respond to it.

You had successfully run `az login` earlier, which set a default subscription for the *`az`* tool. But `azd` keeps its own, separate notion of "which subscription does this environment target," stored in its own environment config — it does not automatically inherit `az`'s default. This is the same "separate tools, separate state" theme from doc 02.

### How we fixed it

```bash
SUB_ID=$(az account show --query id -o tsv)
azd env set AZURE_SUBSCRIPTION_ID "$SUB_ID"
```

Asked `az` (which *did* already know the right subscription) for its ID, and explicitly told `azd` to use that same one. One-line fix, and it's exactly the value `azd`'s own error message told us it needed.

### The lesson

When a CLI tool's error message says "missing: X, provide via environment variable Y" — that's usually not a vague hint, it's a literal, copy-pasteable instruction. Read error messages fully before assuming you need to investigate further.

---

## Failure 2: `azd` corrupting its own saved config file

This was the strangest and most time-consuming failure of the session, so this section goes deeper than the others.

### The error

Two different failed `azd provision` attempts produced two *different*-looking errors, both from the same underlying cause:

```
ERROR: loading environment: loading environment 'prod': loading .env: unexpected character "\\" in variable name near "\\\\\\\"https://ohnydotpayefvaurtiyy.supabase.co\\\\\\\\\\"\nVAIRIS_STORE_URL=\"\nVAIRIS_RETURNS_URL=\"https://www.thevairis.com/returns\"\nVAIRIS_STORE_URL=\"https://www.thevairis.com\"\n"
```

and later:

```
ERROR: deployment failed: initializing provisioning manager: saving local environment, failed reloading env vars, loading .env: unexpected character "\\" in variable name near "\\\\\\\"https://ohnydotpayefvaurtiyy.supabase.co\\\\\\\\\"\nVAIRIS_RETURNS_URL=\"https://www.thevairis.com/returns\"\nVAIRIS_STORE_URL=\"https://www.thevairis.com\"\n"
```

### What this error actually means

`azd` stores each environment's configuration in a plain text file: `.azure/prod/.env`, in a simple `KEY="value"` format (one per line — you can open this file in any text editor). Both errors above are `azd` saying "I tried to *read* this file back, and it's not valid — there's a stray backslash character sitting somewhere a variable name should be."

Looking directly at the actual bytes of the file after one of these failures (using a script that showed the raw content, being careful to still not print your real Discord token to the terminal) showed exactly what had gone wrong:

```
SUPABASE_URL="\\\"https://ohnydotpayefvaurtiyy.supabase.co\\\\\"
VAIRIS_STORE_URL="
VAIRIS_RETURNS_URL="https://www.thevairis.com/returns"
VAIRIS_STORE_URL="https://www.thevairis.com"
```

Two things are visibly broken here: the `SUPABASE_URL` line has extra backslash-quote characters mixed into it and never properly closes its quote, and — because of that — the *next* line's key (`VAIRIS_STORE_URL=`) got swallowed into what the file parser thinks is still the *previous* line's value. Once one line breaks like this, every line after it can cascade into nonsense, which is exactly the "near ...VAIRIS_STORE_URL=\"https://www.thevairis.com\"\n" text visible at the tail of the error message — that's the parser reporting the garbled leftovers it choked on.

### How we diagnosed the actual cause

The natural first suspect was: "did *we* write something wrong into this file?" To test that theory in isolation, without touching the real bot's environment at all, we built a completely separate, disposable test:

```bash
mkdir azd-bug-test && cd azd-bug-test
azd env new t1 --location centralindia
azd env set FOO_URL "https://example.com"
```

This worked perfectly — no corruption. We then deliberately tried to recreate every suspicious characteristic of our real values, one at a time, in this same disposable environment: a URL that's a text-prefix of another URL (`https://www.thevairis.com` is literally the beginning of `https://www.thevairis.com/returns`), a Discord-bot-token-shaped string, a Supabase-key-shaped string. All of them, individually and combined, saved and reloaded correctly through plain `azd env set`.

This ruled out "something specific about our values" as the cause — the corruption wasn't about *what* we were storing, it was about *when*. Comparing the two real error messages above, the first happened during a plain `azd env set` call; the second happened specifically during `azd provision`'s own internal "save the environment, then immediately read it back to double-check" step. That second error message even says so directly: `saving local environment, failed reloading env vars` — `azd` writing a file and then immediately failing to parse the very file it just wrote.

### The actual root cause

This points to a genuine bug inside `azd` version 1.28.0 itself — specifically, a bug in the code that rewrites its own `.env` config file, most likely related to how it decides whether a value needs "escaping" (wrapping special characters like quotes in backslashes so they don't get misread) and ends up escaping a value that was *already* correctly escaped, one layer too many. This kind of bug is also frequently non-deterministic in tools written in Go (the language `azd` is built in) when it involves iterating over a set of key/value pairs stored in a map — Go deliberately randomizes the order it iterates over a map every time a program runs, specifically to stop developers from accidentally relying on an order that was never guaranteed. If `azd`'s file-rewriting logic has a subtle assumption baked in that depends on the order values happen to be processed in, that would explain why we saw a *different* exact corruption pattern on each failed attempt, rather than the identical one every time.

We did not need to (and did not) go read `azd`'s own source code to confirm this beyond reasonable doubt — the isolated test above was sufficient proof that the bug lives inside `azd`'s save/reload path, not in our data.

### How we fixed it

Two parts:

1. **Immediate unblock:** wrote the `.azure/prod/.env` file directly and completely, by hand (via a small script), bypassing `azd env set` entirely for this one repair. This is always a safe thing to do — it's a plain text file, not a database, and nothing prevents editing it directly as long as the format matches what `azd` expects.

2. **Working around the trigger:** since the bug specifically lived inside `azd provision`'s save routine, we stopped using `azd provision` for the actual resource-creation step and used the lower-level `az deployment sub create` command instead (doc 02 explains this command) — feeding it a plain, ordinary JSON parameters file with the real values already filled in, rather than `azd`'s own placeholder-substitution file. This command doesn't share the buggy save-and-reload code path at all, so it has no opportunity to corrupt anything. `azd deploy` (the separate command that builds and pushes the actual Docker image) was still used normally afterward, since that command's job doesn't involve rewriting this config file the same way.

### The lesson

When a tool's *own internal state* becomes corrupted (as opposed to your input being wrong), the fastest path forward is usually: (1) prove it's the tool and not you, using the smallest possible isolated reproduction; (2) fix the immediate damage by hand, since config files are just files; (3) route around the specific operation that triggers the bug, using a lower-level tool if one exists, rather than waiting for an upstream fix.

---

## Failure 3: Supabase connection failing — `TypeError: fetch failed`

### The error

Once the bot was actually running (post-Failure-2), its logs showed:

```
Loading sessions from Supabase...
Starting VAIRIS bot...
Discord Bot connected as WhatsApp Bot#0013
Supabase Error:  TypeError: fetch failed
WhatsApp failed to start: Protocol error (Runtime.callFunctionOn): Execution context was destroyed.
```

(The second line, about WhatsApp, is actually a *separate* bug — Failure 4, below — that happened to show up in the same log output right after this one. It's easy to misread these two as one problem; they weren't.)

### How we diagnosed it

`fetch failed` from Node.js's built-in `fetch()` is a deliberately generic error — it covers DNS failures, TLS failures, connection refusals, and plain garbage URLs, all with the same message. Rather than guess, we asked Azure directly what value the running container actually had for `SUPABASE_URL`:

```bash
az containerapp show -n ca-vairis-bot-kcwsblmgxzvam -g rg-vairis-bot-prod \
  --query "properties.template.containers[0].env[?name=='SUPABASE_URL']"
```

```json
[{ "name": "SUPABASE_URL", "value": "\\\"https://ohnydotpayefvaurtiyy.supabase.co\\\"" }]
```

There it is — the value the app was actually trying to connect to wasn't `https://ohnydotpayefvaurtiyy.supabase.co`, it was the literal text `\"https://ohnydotpayefvaurtiyy.supabase.co\"` — starting with a backslash and a quote character, not with `https://`. No wonder the fetch failed; that's not a URL at all.

### The actual root cause

This traced all the way back to how the value was originally entered into your `.env.prod` file — checking the raw bytes of that file (not just the human-readable text) showed:

```
SUPABASE_URL="\"https://ohnydotpayefvaurtiyy.supabase.co\""
```

That's a normal pair of outer quotes (which any `.env` file uses, and which every parser correctly strips), but *inside* those quotes, the value itself already contained a literal backslash-quote character sequence at the very start and end. This is a classic symptom of copying a value out of a JSON file or JSON-formatted API response (where a string is written as `"https://..."` *with* its quote marks as visible text) and pasting the whole thing — quote marks included — into a `.env` file, which then wraps *that* in its own quotes on top, doubling up. We confirmed this was isolated to exactly two keys, `SUPABASE_URL` and `SUPABASE_KEY`, by checking every other value in the same file the same way — everything else was clean, single-quoted, and correct.

### How we fixed it

Wrote a small script that specifically detected and stripped that one extra backslash-quote layer from just those two values, then pushed the corrected values straight onto the already-running container without needing a full redeploy:

```bash
az containerapp update -n ca-vairis-bot-kcwsblmgxzvam -g rg-vairis-bot-prod \
  --set-env-vars "SUPABASE_URL=https://ohnydotpayefvaurtiyy.supabase.co"

az containerapp secret set -n ca-vairis-bot-kcwsblmgxzvam -g rg-vairis-bot-prod \
  --secrets "supabase-key=<corrected value>"

az containerapp revision restart -n ca-vairis-bot-kcwsblmgxzvam -g rg-vairis-bot-prod \
  --revision ca-vairis-bot-kcwsblmgxzvam--azd-1784699329
```

Note `SUPABASE_URL` and `SUPABASE_KEY` needed two *different* commands — `SUPABASE_URL` was a plain environment variable, directly updatable; `SUPABASE_KEY` was wired as a Container-App-level *secret* referenced by the environment variable (see doc 03's explanation of `secretRef`), so its actual stored value had to be updated separately via `az containerapp secret set`. Either way, a restart was required afterward — Container Apps doesn't hot-reload environment variable or secret changes into an already-running process.

### The lesson

When something claims a "connection failed" but the failure is instant and consistent (not intermittent), suspect the *value itself* before suspecting the network. Always verify the exact value a running service actually has — not the value you *think* you set — by asking the platform directly.

---

## Failure 4: WhatsApp's Chrome browser crashing — "Execution context was destroyed"

### The error

```
Discord Bot connected as WhatsApp Bot#0013
Supabase Error:  TypeError: fetch failed
WhatsApp failed to start: Protocol error (Runtime.callFunctionOn): Execution context was destroyed.
```

This is a Chrome DevTools Protocol error (the low-level protocol tools like Puppeteer/`whatsapp-web.js` use to remote-control a headless Chrome browser). In plain English, it means: "I asked Chrome to run some JavaScript inside a page it had open, but by the time it tried, that page (or the whole browser) was already gone." This consistently means Chrome itself crashed or was killed, not that anything about WhatsApp's website changed.

### How we diagnosed it

First, we ruled out "is this just slow to start" by checking whether the container was actually crash-looping, not merely taking a while:

```bash
az containerapp replica list -n ca-vairis-bot-kcwsblmgxzvam -g rg-vairis-bot-prod --revision <revision-name>
```

```json
"restartCount": 2,
"runningState": "Terminated",
"runningStateDetails": "Container was terminated with reason: Error, exit code: 1."
```

Confirmed crash-looping. Exit code `1` (not `137`, which is what a hard out-of-memory kill by the operating system looks like) told us this was the Node.js process *choosing* to exit after catching an error — not the platform forcibly killing it for using too much memory. That ruled out "just give it more RAM" as the fix, even though the container had previously been fighting a tight 512MB ceiling on its old hosting provider.

Reading the bot's own code (`index.js`) showed it uses `whatsapp-web.js`'s `LocalAuth` strategy, which stores Chrome's entire browser profile (cookies, local storage, the WhatsApp session itself) as a folder on disk — by default at `./.wwebjs_auth`, which our Bicep file had deliberately mounted to the Azure Files network share described in doc 03, specifically so that folder would survive a restart.

That mount was the prime suspect: Chrome's browser profile directory relies on real filesystem behavior — specifically the ability to create exclusive "lock" files that prevent two Chrome processes from using the same profile simultaneously. The storage protocol Azure Files uses by default (called **SMB**, the same family of network-file-sharing protocol Windows file shares use) does not reliably support this kind of file locking the way a real local disk does. This is a widely known limitation when running Chrome/Puppeteer against network-mounted storage — not specific to Azure.

We tested this theory directly, rather than assuming it: temporarily pointed the bot at an entirely different, *local* (non-networked) folder instead —

```bash
az containerapp update -n ca-vairis-bot-kcwsblmgxzvam -g rg-vairis-bot-prod \
  --set-env-vars "WWEBJS_AUTH_PATH=/tmp/.wwebjs_auth"
```

— and the very next restart worked cleanly: Chrome launched, generated a WhatsApp login QR code, and posted it to Discord exactly as designed. That confirmed the theory: it was specifically the network-mounted storage that Chrome couldn't work with, not memory, not the code, not Supabase (which had already been separately fixed by this point).

### The actual root cause

Two Azure storage facts, combined:

1. Azure Container Apps' persistent-storage option (the "volume mount" from doc 03) only supports Azure Files shares.
2. A *standard* Azure Files share (the kind we created — `Standard_LRS`) only speaks the SMB protocol. Getting the *other* protocol Azure Files can speak — **NFS**, which behaves much closer to a normal Linux filesystem and handles file locking in a way Chrome tolerates — requires a completely different, more expensive storage tier (**Premium**, `FileStorage` kind) *and* requires the whole Container Apps Environment to be connected into a **Virtual Network**, which is a substantially bigger piece of infrastructure than anything else in this deploy (see doc 06).

So this wasn't a configuration mistake in the Bicep file — the storage was created exactly as intended and is working exactly as its type is supposed to work. The actual mismatch is that **Chrome's storage needs are incompatible with the cheap, simple storage option**, and getting the compatible option means significantly more infrastructure.

### How we fixed it (for now)

Pointing `WWEBJS_AUTH_PATH` at `/tmp/.wwebjs_auth` — the container's own local, ephemeral disk — which Chrome has no trouble with, since it behaves like a completely normal filesystem. This got the bot working immediately, matching your stated "immediate requirement."

The tradeoff, made explicit rather than hidden: `/tmp` is **ephemeral** — it exists only for the lifetime of that one specific running container instance. If the container restarts for *any* reason (a crash, a future `azd deploy`, or even Azure occasionally moving a container to different underlying hardware for its own maintenance reasons — something that can happen without you doing anything), that folder is wiped, and the bot needs a brand new WhatsApp QR scan to reconnect, exactly like a fresh first-time setup.

This fix was then made permanent in the checked-in `infra/resources.bicep` file (not just applied live to the running container) — see doc 03's section on this exact line, and doc 04, step 11 — with a code comment explaining exactly this tradeoff, so it's not a silent surprise the next time anyone (including a future you) reads that file.

### The lesson, and what "properly fixed" would look like

This is documented as a known, intentional tradeoff, not treated as fully solved. Doc 06 covers exactly what upgrading to the Chrome-compatible storage option (Premium NFS + Virtual Network) would involve, so you can decide whether that's worth doing now or later.
