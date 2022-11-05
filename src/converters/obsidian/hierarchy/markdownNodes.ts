import { detectBulletHierarchy, findBulletSliceEndPosition, findBulletSliceStartPosition } from './bullets';
import { detectCodeBlockHierarchy, findCodeBlockSliceEndPosition, findCodeBlockSliceStartPosition } from './codeblocks';
import {
  detectDataViewAttributeHierarchy,
  findDataViewAttributeSliceStartPosition,
  findDataViewSliceEndPosition,
} from './dataviewattributes';
import { detectHeadingHierarchy, findHeadingSliceEndPosition, findHeadingSliceStartPosition } from './headings';
import { findParagraphSliceEndPosition, findParagraphSliceStartPosition } from './paragraphs';

//these types are just needed for splitting and for creating the correct hierarchy
export enum HierarchyType {
  ROOT = 'Root',
  HEADING = 'Heading',
  BULLET = 'Bullet Node',
  PARAGRAPH = 'Paragraph',
  CODEBLOCK = 'Code Block',
  //we add them as extra hierarchy type to distinguish them from the PARAGRAPH, however, they might also show up in the bullet
  DATAVIEWATTRIBUTE = 'Data View Attribute', //TODO: add some proper tests
}

export interface MarkdownNode {
  content: string;
  type: HierarchyType;
  //lower = higher in the hierarchy
  //for bullet nodes also used as a measure of empty space
  //for heading nodes this is the number of #'s
  //for code blocks this is the length of the block in chars
  level: number;
  codeLanguage?: string;
}

export type Hierarchy = Omit<MarkdownNode, 'content'>;

export function extractMarkdownNodes(content: string, startPosition = 0): MarkdownNode[] {
  const nodeDescs: MarkdownNode[] = [];

  for (let index = startPosition; index < content.length; index++) {
    const element = content[index];
    if (element == '\n') {
      continue;
    }

    let [node, slicePosition, nextHierarchy] = extractMarkdownNode(content, index);
    if (node.content.trim() !== '') {
      nodeDescs.push(node);
    }
    //sometimes a nextHierarchy is already detected, so we need to take that into account for speeds sake
    while (nextHierarchy) {
      while (content[slicePosition] === '\n') {
        slicePosition++;
      }
      [node, slicePosition, nextHierarchy] = extractMarkdownNode(content, slicePosition);
      if (node.content.trim() !== '') {
        nodeDescs.push(node);
      }
    }

    //-1 because we dont want to assume that the char at the slice position is irrelevant
    index = slicePosition - 1;
  }

  return nodeDescs;
}
/**
 * @returns [MarkdownNode, slicePosition, possibly nextHierarchy]
 */
function extractMarkdownNode(
  content: string,
  curPosition: number,
): [MarkdownNode, number, undefined] | [MarkdownNode, number, Hierarchy] {
  const hierarchy: Hierarchy = detectNextHierarchy(content, curPosition);
  const startPos = findSliceStartPosition(content, curPosition, hierarchy);
  const [slicePos, nextHierarchy] = findSliceEndPosition(content, curPosition, hierarchy);

  return [
    {
      ...hierarchy,
      //we only trim the end because the beginning might hold meaning
      content: content.slice(startPos, slicePos).trimEnd(),
    },
    slicePos,
    nextHierarchy,
  ];
}

/**
 * If we know that a hierarchy ends, here we can detect the next one.
 */
export function detectNextHierarchy(content: string, curPosition: number): Hierarchy {
  let hierarchy = detectHeadingHierarchy(content, curPosition);
  if (hierarchy) {
    return hierarchy;
  } else {
    hierarchy = detectBulletHierarchy(content, curPosition);
    if (hierarchy) {
      return hierarchy;
    }
    hierarchy = detectCodeBlockHierarchy(content, curPosition);
    if (hierarchy) {
      return hierarchy;
    }
    //TODO: I need to paste this code to many times
    hierarchy = detectDataViewAttributeHierarchy(content, curPosition);
    if (hierarchy) {
      return hierarchy;
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
    case HierarchyType.CODEBLOCK:
      return findCodeBlockSliceStartPosition(curPosition);
    case HierarchyType.DATAVIEWATTRIBUTE:
      return findDataViewAttributeSliceStartPosition(curPosition);
    default:
      throw 'Unsupported HierarchyType detected: ' + hierarchy;
  }
}

/**
 * Finds the position where to end slicing the current hierarchy. Does not apply trimming, so that we can skip the search to this position.
 */
function findSliceEndPosition(
  content: string,
  curPosition: number,
  hierarchy: Hierarchy,
): [number] | [number, Hierarchy] {
  switch (hierarchy.type) {
    case HierarchyType.HEADING:
      return [findHeadingSliceEndPosition(content, curPosition, hierarchy)];
    case HierarchyType.BULLET:
      return [findBulletSliceEndPosition(content, curPosition, hierarchy)];
    case HierarchyType.PARAGRAPH:
      return findParagraphSliceEndPosition(content, curPosition);
    case HierarchyType.CODEBLOCK:
      return [findCodeBlockSliceEndPosition(curPosition, hierarchy)];
    case HierarchyType.DATAVIEWATTRIBUTE:
      return [findDataViewSliceEndPosition(content, curPosition)];
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

  //CODEBLOCK can only be child of HEADING and can not be a parent
  if (potentialParent.type === HierarchyType.CODEBLOCK || potentialChild.type === HierarchyType.CODEBLOCK) {
    return false;
  }

  //DATAVIEWATTRIBUTE can only be child of DATAVIEWATTRIBUTE and can not be a parent
  if (
    potentialParent.type === HierarchyType.DATAVIEWATTRIBUTE ||
    potentialChild.type === HierarchyType.DATAVIEWATTRIBUTE
  ) {
    return false;
  }

  if (potentialParent.type === potentialChild.type) {
    return potentialParent.level < potentialChild.level;
  }

  return false;
}
