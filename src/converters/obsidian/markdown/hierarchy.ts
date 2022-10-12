import { isBulletNodeStart } from './bullet';
import { HierarchyType, MarkdownNode } from './extractMarkdownNodes';
import { isHeadingStart } from './heading';

export type Hierarchy = Omit<MarkdownNode, 'content'>;

//special case, where we want an extra bullet for block quotes
function isBlockQuoteStart(content: string, pos: number) {
  return content[pos] === '>' && content[pos + 1] === ' ';
}

/**
 * Returns a hierachy type, if a new type of hierachy starts at the given position.
 * Null means that no hierachy starts there, so the current hierarchy should continue.
 */
export function newTypeOfHierachyStarts(content: string, pos: number): HierarchyType | null {
  if (isHeadingStart(content, pos)) {
    return HierarchyType.HEADING;
  }
  if (isBulletNodeStart(content, pos)) {
    return HierarchyType.BULLET;
  }
  if (isBlockQuoteStart(content, pos)) {
    return HierarchyType.PARAGRAPH;
  }

  return null;
}
