// After /handoff, offer to clear the history (ported from the retired AgentBrain clear-prompt).
// A hook cannot run /clear or open a dialog, so this is a note the user answers by typing /clear.
// Not a hook of its own: git-checkpoint's Stop path shows it only when it is not sending the
// lead back, so a Stop never both blocks and suggests clearing.
// Keyed on the /handoff skill's closing line, `Next: /clear, then /resume <document>`.
const HANDOFF_FOOTER = /(^|\n)[\s>*`-]*Next:\s*\/clear\b/;

export const CLEAR_QUESTION = 'Unit handed off. Clear the message history now? Type /clear to start the next task clean; '
  + 'docs/working holds the state and /resume picks it up. Carry on instead if this task continues.';

export function clearPrompt(lastMessage) {
  return typeof lastMessage === 'string' && HANDOFF_FOOTER.test(lastMessage) ? CLEAR_QUESTION : null;
}
