import { describe, expect, it } from 'vitest';

import { createBrowserMarkdownConverter, convertFixture, findNodeByName, isBrowserEnvironment } from '../../../testUtils/browserTestUtils.js';
import headingsFixture from './fixtures/headings/headings.md?raw';

describe.runIf(isBrowserEnvironment)('Markdown converter (browser)', () => {
  it('parses headings and nested bullets from a single document', () => {
    const converter = createBrowserMarkdownConverter();
    const result = convertFixture(converter, headingsFixture);

    expect(result.summary.totalNodes).toBeGreaterThanOrEqual(3);

    const heading = findNodeByName(result.nodes, 'Header 1');
    expect(heading).toBeDefined();
    const bullet = findNodeByName(result.nodes, 'First bullet');
    expect(bullet).toBeDefined();
    const subBullet = bullet?.children?.find((child) => child.name === 'sub bullet');
    expect(subBullet).toBeDefined();
  });
});
