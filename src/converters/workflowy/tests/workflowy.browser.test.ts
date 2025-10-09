import { describe, expect, it } from 'vitest';

import { WorkflowyConverter } from '../index.js';
import { convertFixture, findNodeByName, isBrowserEnvironment } from '../../../testUtils/browserTestUtils.js';
import smoketestFixture from './fixtures/smoketest.opml?raw';

describe.runIf(isBrowserEnvironment)('Workflowy converter (browser)', () => {
  it('parses OPML and keeps node hierarchy', () => {
    const converter = new WorkflowyConverter();
    const result = convertFixture(converter, smoketestFixture);

    expect(result.summary.totalNodes).toBeGreaterThan(0);

    const root = findNodeByName(result.nodes, 'Hello how are you');
    expect(root).toBeDefined();
    const childNames = (root?.children ?? []).map((child) => child.name);
    expect(childNames).toEqual(expect.arrayContaining(['Good', 'Great']));
  });
});
