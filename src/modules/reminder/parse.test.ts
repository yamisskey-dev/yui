let parseTimeExpression: any;

beforeAll(async () => {
  const mod = await import('./parse.ts');
  parseTimeExpression = mod.parseTimeExpression;
});

describe('parseTimeExpression', () => {
  test('parses "in 2 hours buy milk"', async () => {
    const input = 'in 2 hours buy milk';
    const res = await parseTimeExpression(input);
    expect(res).not.toBeNull();
    if (res) {
      expect(typeof res.when).toBe('number');
      expect(res.text.toLowerCase()).toBe('buy milk');
      // when should be in the future (>= now)
      expect(res.when).toBeGreaterThanOrEqual(Date.now());
    }
  });

  test('parses "tomorrow 09:00 meeting"', async () => {
    const input = 'tomorrow 09:00 meeting';
    const res = await parseTimeExpression(input);
    expect(res).not.toBeNull();
    if (res) {
      expect(res.text.toLowerCase()).toBe('meeting');
    }
  });

  test('returns null when no time expression', async () => {
    const input = 'just some random note';
    const res = await parseTimeExpression(input);
    expect(res).toBeNull();
  });
});
