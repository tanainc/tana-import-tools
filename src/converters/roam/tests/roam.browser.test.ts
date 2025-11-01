import { describe, expect, it } from 'vitest';

import { RoamConverter } from '../index.js';
import { convertFixture, findNodeByName, isBrowserEnvironment } from '../../../testUtils/browserTestUtils.js';
import smoketestFixture from './fixtures/smoketest.json?raw';

describe.runIf(isBrowserEnvironment)('Roam converter (browser)', () => {
  it('converts the smoketest fixture and produces date pages with references', () => {
    const converter = new RoamConverter();
    const result = convertFixture(converter, smoketestFixture);

    expect(result.summary.totalNodes).toBeGreaterThan(0);
    expect(result.summary.calendarNodes).toBeGreaterThan(0);

  const datePage = findNodeByName(result.nodes, '2022-02-08');
    expect(datePage?.type).toBe('date');
    const referencedNode = findNodeByName(result.nodes, '[*]([[y7Tvpja6V]])');
    expect(referencedNode?.refs).toContain('y7Tvpja6V');
  });
});
