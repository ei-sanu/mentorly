// Typewriter reveal for chatbot replies (2026-11-21, chatbot
// typewriter slice). Pure helpers — no React, no DOM — so the reveal
// logic is unit-testable in plain node against this exact file.
//
// The widget drives these with a timeout chain: one character every
// TYPEWRITER_INTERVAL_MS until the reply is fully shown. Clicking the
// reply (or the message list) jumps straight to the full text.
export const TYPEWRITER_INTERVAL_MS = 15;

/** Advance the reveal by exactly one character, never past the end. */
export function nextTypedLength(prev: number, fullLength: number): number {
  return Math.min(prev + 1, fullLength);
}

/** What the user sees: the typed prefix while typing, the full text otherwise. */
export function visibleReplyText(
  content: string,
  typedLength: number,
  isTyping: boolean,
): string {
  return isTyping ? content.slice(0, typedLength) : content;
}

/** True only for the one message currently being typed. */
export function isTypingMessage(messageId: number, typingId: number | null): boolean {
  return typingId !== null && messageId === typingId;
}

/** True once every character of the reply is on screen. */
export function isTypingComplete(typedLength: number, fullLength: number): boolean {
  return typedLength >= fullLength;
}
