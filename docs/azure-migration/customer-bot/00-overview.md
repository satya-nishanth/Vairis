# Vairis Customer Bot — Azure Deployment (Overview)

This folder documents a *different* Azure project than the rest of `docs/azure-migration/`. The numbered `00`–`10` docs one level up are the future, staged migration of the **main Vairis website** off Vercel — a big, deliberate, multi-month plan (not urgent, see `CLAUDE.md` priority P9).

This subfolder is about something smaller and separate: deploying the **WhatsApp customer support bot** (a Node.js app in its own repo, [`Vairis_Customer_Bot`](https://github.com/MahammadFayazShaik/Vairis_Customer_Bot)) to Azure, done on 2026-07-21/22 as an immediate, direct-to-prod deploy — no staging environment, on your explicit instruction.

You said you're new to Azure, so these docs assume zero prior knowledge and explain things in depth, with real examples pulled from what actually happened during this deploy — including three real failures and how we found the root cause of each.

## Read order

1. **[01-azure-concepts-for-beginners.md](./01-azure-concepts-for-beginners.md)** — what a "subscription," "resource group," "region" etc. actually are. Read this first if any Azure noun in the other docs is unfamiliar.
2. **[02-cli-tools-explained.md](./02-cli-tools-explained.md)** — the three command-line tools we installed and used (`az`, `azd`, `gh`), what each one is for, and why we needed all three.
3. **[03-infra-folder-explained.md](./03-infra-folder-explained.md)** — a line-by-line walkthrough of the `infra/` folder and `azure.yaml` now sitting in the bot repo. This is "Infrastructure as Code" — explained from scratch.
4. **[04-what-we-did-step-by-step.md](./04-what-we-did-step-by-step.md)** — the full chronological narrative of the deploy session: every command run, in order, and what it accomplished.
5. **[05-failures-and-root-causes.md](./05-failures-and-root-causes.md)** — the deep-dive. Three real failures happened during this deploy. Each one is explained: what the error meant, how we diagnosed it, and why the fix worked.
6. **[06-current-state-and-next-steps.md](./06-current-state-and-next-steps.md)** — what's live right now, the one known unresolved issue (session persistence), and what fixing it properly would involve.

## The one-paragraph version

We installed three CLIs (`az`, `azd`, `gh`), logged into your Azure subscription, cloned the private bot repo, and wrote a small set of "Infrastructure as Code" files (Bicep) describing the Azure resources the bot needs: a place to run the container, a private registry to store its Docker image, and a bit of logging. We hit three unrelated bugs along the way — a missing subscription ID, a tool bug in `azd` that corrupted its own config file, and a data-entry mistake in your `.env.prod` file that mangled the Supabase credentials — and fixed each one. The bot is now live in Azure, connected to WhatsApp and Discord, with one known gap: the WhatsApp login session doesn't currently survive a container restart, which is explained in doc 06.
