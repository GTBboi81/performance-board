import { describe, expect, it } from 'vitest';

describe('test environment', () => {
  it('runs in jsdom', () => {
    expect(document.createElement('div')).toBeInstanceOf(HTMLDivElement);
  });
});
