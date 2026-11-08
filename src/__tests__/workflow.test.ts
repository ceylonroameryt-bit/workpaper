import { describe, it, expect } from 'vitest';
import { buildWorkflow } from '@/lib/workflow';

describe('year workflow', () => {
  it('has the six steps in order and waits on the import for an empty engagement', () => {
    const steps = buildWorkflow('nothing_here');
    expect(steps.map((s) => s.key)).toEqual(['import', 'map', 'journals', 'papers', 'review', 'signoff']);
    expect(steps[0].state).toBe('todo');
    expect(steps[1]).toMatchObject({ state: 'blocked', blockedBy: 'Import the trial balance first' });
    expect(steps.every((s) => s.href.startsWith('/engagements/nothing_here/'))).toBe(true);
  });
});
