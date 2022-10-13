import { detectBulletHierarchy, findBulletSliceEndPosition, findBulletSliceStartPosition } from './bullets';
import { detectHeadingHierarchy, findHeadingSliceEndPosition, findHeadingSliceStartPosition } from './headings';
import { findParagraphSliceEndPosition, findParagraphSliceStartPosition } from './paragraphs';

//these types are just needed for splitting and for creating the correct hierarchy
export enum HierarchyType {
  ROOT = 'Root',
  HEADING = 'Heading',
  BULLET = 'Bullet Node',
  PARAGRAPH = 'Paragraph',
}

export interface MarkdownNode {
  content: string;
  type: HierarchyType;
  //lower = higher in the hierarchy
  //for bullet nodes also used as a measure of empty space
  //for heading nodes this is the number of #'s
  level: number;
}

export type Hierarchy = Omit<MarkdownNode, 'content'>;

export function extractMarkdownNodes(content: string, startPosition = 0): MarkdownNode[] {
  const nodeDescs: MarkdownNode[] = [];

  for (let index = startPosition; index < content.length; index++) {
    const element = content[index];
    if (element == '\n') {
      continue;
    }

    const [node, slicePosition] = extractMarkdownNode(content, index);
    nodeDescs.push(node);

    //-1 because we dont want to assume that the char at the slice position is irrelevant
    index = slicePosition - 1;
  }

  return nodeDescs;
}
/**
 * @returns [MarkdownNode, slicePosition]
 */
function extractMarkdownNode(content: string, curPosition: number): [MarkdownNode, number] {
  const hierarchy: Hierarchy = detectNextHierarchy(content, curPosition);
  const startPos = findSliceStartPosition(content, curPosition, hierarchy);
  const slicePos = findSliceEndPosition(content, curPosition, hierarchy);

  return [
    {
      ...hierarchy,
      //we only trim the end because the beginning might hold meaning
      content: content.slice(startPos, slicePos).trimEnd(),
    },
    slicePos,
  ];
}

/**
 * If we know that a hierarchy ends, here we can detect the next one.
 */
export function detectNextHierarchy(content: string, curPosition: number): Hierarchy {
  let hierachy = detectHeadingHierarchy(content, curPosition);
  if (hierachy) {
    return hierachy;
  } else {
    hierachy = detectBulletHierarchy(content, curPosition);
    if (hierachy) {
      return hierachy;
    }
  }
  return { type: HierarchyType.PARAGRAPH, level: 0 };
}

/**
 * Finds the position where to start slicing the current hierarchy. Might apply trimming.
 */
function findSliceStartPosition(content: string, curPosition: number, hierarchy: Hierarchy): number {
  //the current position is never \n because we skip that
  switch (hierarchy.type) {
    case HierarchyType.HEADING:
      return findHeadingSliceStartPosition(content, curPosition, hierarchy);
    case HierarchyType.BULLET:
      return findBulletSliceStartPosition(content, curPosition, hierarchy);
    case HierarchyType.PARAGRAPH:
      return findParagraphSliceStartPosition(curPosition);
    default:
      throw 'Unsupported HierarchyType detected: ' + hierarchy;
  }
}

/**
 * Finds the position where to end slicing the current hierarchy. Does not apply trimming, so that we can skip the search to this position.
 */
function findSliceEndPosition(content: string, curPosition: number, hierarchy: Hierarchy): number {
  switch (hierarchy.type) {
    case HierarchyType.HEADING:
      return findHeadingSliceEndPosition(content, curPosition, hierarchy);
    case HierarchyType.BULLET:
      return findBulletSliceEndPosition(content, curPosition, hierarchy);
    case HierarchyType.PARAGRAPH:
      return findParagraphSliceEndPosition(content, curPosition);
    default:
      throw 'Unsupported HierarchyType detected: ' + hierarchy;
  }
}

export function isMarkdownNodeChild(potentialParent: MarkdownNode, potentialChild: MarkdownNode) {
  if (potentialParent.type === HierarchyType.ROOT) {
    return true;
  }

  //HEADING is always a parent of non-headings
  if (potentialParent.type === HierarchyType.HEADING && potentialChild.type !== HierarchyType.HEADING) {
    return true;
  }

  //PARAGRAPH can only be child of HEADING and can not be a parent
  if (potentialParent.type === HierarchyType.PARAGRAPH || potentialChild.type === HierarchyType.PARAGRAPH) {
    return false;
  }

  if (potentialParent.type === potentialChild.type) {
    return potentialParent.level < potentialChild.level;
  }

  return false;
}
