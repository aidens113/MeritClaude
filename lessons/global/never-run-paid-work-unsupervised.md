---
name: never-run-paid-work-unsupervised
scope: global
description: Aiden forbids automation that spends real money (model API calls, paid services) without a live agent supervising it; paid work runs only for a reason and stops at the first balance error, in every project. He does not want a hard budget, only no unattended waste.
origin: FluxIQWebExtension, 2026-09-30
---

# Never let paid work run without an agent watching it

Overnight on 2026-09-29, lane agents built relaunch loops so that their live test slots would "never be idle". When the agents
died on a session limit, the loops kept starting paid model runs with nobody debugging them. They spent $4.25 of Aiden's
DeepSeek credits on 47 runs that fixed nothing, drained the balance, then fired about 1,050 failing runs. He said: "DONT HAVE
THEM MAKE AN AUTOMATIC LOOP THAT CAN JUST RUN WITHOUT ANY AGENT INTERVENTION… JUST BECAUSE THEY SHOULDNT BE IDLE DOESNT MEAN
THEY SHOULD JUST BURN CREDITS FOR NO REASON."

The lesson, for any project where work costs real money:
- **Only a live agent starts paid work, and only for a reason** (a fix to test, a question to answer). Never create keepers,
  relaunch loops, cron jobs or background scripts that start paid work by themselves.
- **"Don't sit idle" means act promptly.** It never means automate spending.
- **No hard budget unless the user asks for one** (he said: "i dont want a hard budget. I just dont want agents randomly setting
  up loops that waste credits for no reason unattended"). Keep spend visible and report it; prevent waste by construction instead.
- **Stop everything at the first insufficient-balance or quota error and tell the user.** Never retry against an empty balance.
- **The supervisor checks how an instruction is carried out,** not only that it was given, and makes sure a worker's loops and
  jobs die with the worker.
- **Enforce these mechanically where the tooling allows:** a runner that refuses a relaunch loop, a stop file on a balance
  error, and a refusal to rerun when nothing changed. Written rules alone failed here.

Why it matters: the money is the user's, the loss is irreversible, and a run nobody debugs teaches nothing. It is pure waste,
and it destroys trust in leaving agents to work overnight.
