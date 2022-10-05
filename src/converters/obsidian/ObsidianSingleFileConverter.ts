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

  const collectedUnlinkedNodes = createUnlinkedTanaNodes(importName, today, vaultContext);

  return {
    version: 'TanaIntermediateFile V0.1',
    summary: vaultContext.summary,
    nodes: [node, collectedUnlinkedNodes],
  };
}
