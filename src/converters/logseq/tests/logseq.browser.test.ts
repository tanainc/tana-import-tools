import { describe, expect, it } from 'vitest';

import { LogseqConverter } from '../index.js';
import { convertFixture, findNodeByName, isBrowserEnvironment } from '../../../testUtils/browserTestUtils.js';
import smoketestFixture from './fixtures/smoketest.json?raw';

describe.runIf(isBrowserEnvironment)('Logseq converter (browser)', () => {
  it('converts the smoketest fixture and resolves inline references', () => {
    const converter = new LogseqConverter();
    const result = convertFixture(converter, smoketestFixture);

    expect(result.summary.totalNodes).toBeGreaterThan(0);
    expect(result.summary.calendarNodes).toBeGreaterThan(0);

    const page = findNodeByName(result.nodes, 'Tana test');
    expect(page).toBeDefined();
    const inlineRef = findNodeByName(result.nodes, `Inline ref for [[${page!.uid}]]`);
    expect(inlineRef?.refs).toContain(page!.uid);
  });
});
