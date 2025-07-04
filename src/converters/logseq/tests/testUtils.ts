import type { TanaIntermediateNode } from '../../../types/types.ts';
import { LogseqConverter } from '..';
import { IdLookupHelper, importFileAndGetHelpers } from '../../../testUtils/testUtils.js';

export function importLogseqFile(fileToLoad: string) {
  return importFileAndGetHelpers(new LogseqConverter(), `./src/converters/logseq/tests/fixtures/${fileToLoad}`);
}

export function getField(parentId: string | undefined, title: string, f: IdLookupHelper) {
  const parent = f(parentId);
  if (!parent) {
    throw new Error(`Node ${parentId} not found`);
  }
  const field = parent.children?.find((child) => (child.name = title));
  if (!field) {
    throw new Error(`Field with title ${title} not found`);
  }
  return field;
}

export function hasHeadingField(node: TanaIntermediateNode): boolean {
  if (!node || !node.children) {
    return false;
  }
  for (const child of node.children) {
    if (child.type === 'field' && child.name === 'heading') {
      return true;
    }
    if (hasHeadingField(child)) {
      return true;
    }
  }
  return false;
}
