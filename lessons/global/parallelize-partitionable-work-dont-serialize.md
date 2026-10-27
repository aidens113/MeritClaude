---
name: parallelize-partitionable-work-dont-serialize
scope: global
description: When work is queued behind one long-running agent, Aiden wants every piece that touches none of its files dispatched in parallel immediately, in every project.
origin: FluxIQWebExtension, 2026-10-05
---

# Parallelize partitionable work instead of queuing it behind one lead

Aiden, watching a day of integration on 2026-10-05, asked angrily why everything was working so slowly. The supervisor had queued every remaining fix behind one long-running lead because they lived near files that lead was editing, although most of them touched none of those files.

When a single agent is the bottleneck, list the exact files it is editing right now and dispatch every waiting piece that touches none of them at once, each as its own task with its own worktree and a file-partitioned brief. Send only the change that truly needs one of the busy files back to the agent that owns it, or apply that one small change yourself at integration. Re-check the busy agent's file list when it moves to a new stage, because what is free changes.

Commit and merge each verified unit as soon as it is checked, rather than letting several agents' work accumulate uncommitted in shared trees. Batching unverified work is what made the earlier integration slow and conflict-prone in the first place.

This matters because the user experiences idle parallel capacity as wasted time, and the cost of a few more worktrees and merges is small next to hours of serial waiting. The exception is two changes to the same file: those stay serial, and that is the only reason to wait.
