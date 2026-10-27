<!-- Template: the supervisor copies this block into the working document under
     `## Worker Briefs`, before dispatch, one brief per agent. A brief is at most
     40 lines and holds only the task: the agent's operating rules (what to read,
     what not to touch, never committing, the return contract) live in its agent
     definition and are not repeated here. -->

### Brief: <agent-label>
- Agent: <worker-light | worker | worker-heavy | supervisor>, chosen by the routing table in the global AGENTS.md
- Repository: <this repository, and the branch or worktree to work in>
- Task: <what to accomplish, in enough detail that the agent needs nothing else>
- Required reads: <this document's Current State, plus the specific files by path>
- Owns (may edit): <explicit paths; no other brief may name the same file>
- Must not touch: <explicit paths, including the working document itself>
- Definition of done: <observable outcome, including the exact checks to run>
- Report to: docs/working/<effort-slug>/reports/<agent-label>.md

<!-- `Owns` and `Must not touch` are what make parallel work safe: partition by
     file, never by topic, because two agents editing one file silently lose
     each other's writes. If two briefs need the same file, the work is serial.
     Give each agent filenames unique to it, scratch files included.
     A worker under a sub-supervisor reports to
     docs/working/<effort-slug>/reports/<supervisor-label>/<worker-label>.md. -->
