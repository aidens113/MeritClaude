---
name: ask-before-stopping-paid-run-at-wrap-up
scope: global
description: When Aiden asks to wrap up while an approved paid run is in flight, say it is running and ask whether to wait for it or stop it, instead of killing it at once; in every project.
origin: FluxIQWebExtension, 2026-10-10
---

# Ask before stopping a paid run at wrap-up

On 2026-10-10 Aiden approved a paid Lab run and, minutes into it, said "ok wrap it up for now" and "we'll resume
later". The supervisor stopped the run at once, because a paid run must never run unsupervised. Seconds later Aiden
said "wait for this run": he wanted it finished, and the cents it had spent and its result were lost.

The lesson: when the user asks to wrap up, end the session, or pause while a paid run they approved is still going,
do not stop it on your own initiative. First tell them in one line that it is running, how far it has got, what it has
spent, and roughly how long it has left. Then ask whether to wait and supervise it to the end before wrapping up, or
stop it now. Do the rest of the wrap-up (records, working document, commits) while the answer is pending. If they
choose to wait, stay and supervise as usual; if they choose to stop, or end the session without answering, stop it
and record the stop.

This refines [never-run-paid-work-unsupervised](never-run-paid-work-unsupervised.md) and does not relax it: a paid run
still never continues once no agent is watching it. Waiting means the agent keeps watching, so it is allowed. The
question exists because stopping an approved run throws away money already spent and the evidence the run was buying,
and the user is usually better placed to judge whether a few more minutes are worth it.
