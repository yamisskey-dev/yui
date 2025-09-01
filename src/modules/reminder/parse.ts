export type ParseResult = { when: number; text: string } | null;

/**
 * Parse natural language time expressions from the start of the input.
 * Returns { when: timestamp(ms), text: remainingText } or null when no time found.
 *
 * Note: we intentionally perform a dynamic import of `chrono-node` inside the
 * function so the module can be loaded under both ESM and CommonJS test runners.
 */
export async function parseTimeExpression(input: string): Promise<ParseResult> {
  try {
    const chrono = await import('chrono-node');
    const results = chrono.parse(input, new Date(), { forwardDate: true });
    if (results && results.length > 0) {
      const r = results[0];
      const when = r.date().getTime();
      const text = input.replace(r.text, '').trim();
      return { when, text };
    }
  } catch (err) {
    // If chrono unexpectedly fails, return null to let caller fall back.
    // Keep the error out of test noise.
  }
  return null;
}
