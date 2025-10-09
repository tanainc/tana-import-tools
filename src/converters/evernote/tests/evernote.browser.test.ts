import { describe, expect, it } from 'vitest';

import { EvernoteConverter } from '../index.js';
import { TanaIntermediateNode } from '../../../types/types.js';
import smoketestFixture from './fixtures/smoketest.enex?raw';

function findNodeByName(nodes: TanaIntermediateNode[], name: string): TanaIntermediateNode | undefined {
  for (const node of nodes) {
    if (node.name === name) {
      return node;
    }

    const match = findNodeByName(node.children ?? [], name);
    if (match) {
      return match;
    }
  }

  return undefined;
}

const isBrowserEnvironment = typeof window !== 'undefined';

describe.runIf(isBrowserEnvironment)('Evernote converter (browser)', () => {
  it('converts the smoketest fixture and returns browser-compatible media', () => {
    const converter = new EvernoteConverter();
    const result = converter.convert(smoketestFixture);

    expect(result).toBeDefined();
    expect(result?.summary.totalNodes).toBeGreaterThan(0);
    expect(result?.summary.calendarNodes).toBe(2);

    const imageNode = findNodeByName(result?.nodes ?? [], 'unsplash-shrunk.jpg');
    expect(imageNode).toBeDefined();
    expect(imageNode?.mediaUrl?.startsWith('data:image/jpeg;base64,')).toBe(true);

    const dateNode = findNodeByName(result?.nodes ?? [], '2025-09-30');
    expect(dateNode).toBeDefined();
    expect(dateNode?.type).toBe('date');
  });
});
