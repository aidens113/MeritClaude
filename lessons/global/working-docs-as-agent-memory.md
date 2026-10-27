---
name: working-docs-as-agent-memory
scope: global
description: The user wants working documents under docs/working/ used as the durable memory and coordination substrate for agents and subagents.
origin: FluxIQWebExtension auto-memory, promoted 2026-09-10
---

# Working documents are the agent memory substrate on FluxIQ

The user (Aiden) stated directly that using working documents as memory for
agents "is the way to go" for the FluxIQ projects. This covers both the
downstream `FluxIQWebExtension` repository and the `FluxIQ` core framework
repository in the sibling `F:\!FluxIQ` checkout.

The practical consequence is that durable task state must not live only in
conversation context or in a subagent's completion report. Before planning or
implementing, read the relevant document under `docs/working/`; while working,
record findings, decisions, ownership, validation results, and remaining work
there as the work happens rather than at the end. A working document should be
concrete enough that a different agent, in a later session with no shared
context, can continue the work without rediscovering the intended
architecture.

This matters because agent context does not persist across sessions and
subagents do not share context with each other or with the primary agent. The
working document is the only channel through which one agent's knowledge
reaches the next, so treating it as an afterthought silently destroys the
coordination the user is relying on.
