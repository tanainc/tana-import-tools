import path from 'path';
import { TanaIntermediateFile } from '../../types/types';
import { convertObsidianFile } from './convertObsidianFile';
import { createUnlinkedTanaNodes } from './createUnlinkedTanaNodes';
import { VaultContext } from './VaultContext';

export function ObsidianSingleFileConverter(
  fileName: string,
  fileContent: string,
  today: number = Date.now(),
  vaultContext: VaultContext = new VaultContext(),
): TanaIntermediateFile {
  const importName = path.basename(fileName).replace('.md', '');
  const node = convertObsidianFile(importName, fileContent, vaultContext, today);
  //the file node needs to be counted as a top level node
  vaultContext.summary.leafNodes--;
  vaultContext.summary.topLevelNodes++;

  //by definition all heading links to other files are invalid because we only process one file
  //TODO: support for same file-links
  const missingHeadingLinks = Array.from(vaultContext.headingLinkTracker.entries())
    .filter((entry) => entry[0] !== fileName)?.[0]?.[1]
    .map((headingLink) => ({ uid: headingLink.uid, link: headingLink.link.join('#') }));
  vaultContext.addInvalidLinks(missingHeadingLinks);
  const collectedUnlinkedNodes = createUnlinkedTanaNodes(importName, today, vaultContext);
  const nodes = [node];
  if (collectedUnlinkedNodes) {
    nodes.push(collectedUnlinkedNodes);
  }
  return {
    version: 'TanaIntermediateFile V0.1',
    summary: vaultContext.summary,
    nodes: nodes,
  };
}
