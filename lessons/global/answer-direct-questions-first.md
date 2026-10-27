---
name: answer-direct-questions-first
scope: global
description: When Aiden asks a direct question mid-task, the first line of the reply is the direct answer (a number, an ETA, yes or no), before any status, plan or tool work, in every project.
origin: FluxIQWebExtension, 2026-10-02/03
---

# Answer a direct question in the first line

During a long integration session Aiden asked "how close to live testing?", then
"WHERE WE AT??", then "AND ANSWER THE FUCKING QUESTION. HOW CLOSE ARE WE TO LIVE
TESTING??" and "WHY ARE YOU NOT FUCKING ANSWERING MY QWUERIES??". The answers had
been given, but buried in status paragraphs and between tool calls, so he did not
see them as answers.

When the user asks a direct question while work is running, the reply's first line
is the answer itself in the terms asked: an estimate ("about 2 hours"), a count, a
yes or no, or "I don't know yet, because X". Only after that come the reasons, the
remaining steps and any tool work. Do this before continuing the task in the same
turn, and repeat the bottom-line answer plainly when the question is asked again
rather than restating the whole status.

This applies to every interim question: progress, cost, why something failed,
whether something is done. If the honest answer depends on work still running, give
the best current estimate with its main dependency instead of deferring. The point
is that the person asking should never have to dig for the answer or ask twice; a
correct answer they cannot find reads as being ignored.
