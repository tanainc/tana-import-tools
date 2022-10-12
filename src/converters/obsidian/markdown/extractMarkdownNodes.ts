import { findBulletSlicePosition, isBulletNodeStart, postProcessBullet } from './bullet';
import { countEmptySpace } from './emptySpace';
import { findHeadingSlicePosition, countHeadingSymbols, postProcessHeading } from './heading';
import { Hierarchy, newTypeOfHierachyStarts } from './hierarchy';
import { findParagraphSlicePosition, postProcessParagraph } from './paragraph';

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
  let hierarchy: Hierarchy;

  const headingSymbols = countHeadingSymbols(content, curPosition);
  if (headingSymbols > 0 && content[curPosition + headingSymbols] === ' ') {
    hierarchy = { type: HierarchyType.HEADING, level: headingSymbols };
  } else {
    //for nodes we need a precise level === empty space, so we can detect multi line node content
    const emptySpaces = countEmptySpace(content, curPosition);
    if (isBulletNodeStart(content, curPosition + emptySpaces)) {
      hierarchy = { type: HierarchyType.BULLET, level: emptySpaces };
    } else {
      hierarchy = { type: HierarchyType.PARAGRAPH, level: 0 };
    }
  }

  const slicePos = findSlicePosition(content, curPosition, hierarchy);

  return [
    {
      ...hierarchy,
      content: postProcessMarkdownNodes(content.slice(curPosition, slicePos), hierarchy),
    },
    slicePos,
  ];
}

function findSlicePosition(content: string, curPosition: number, hierarchy: Hierarchy): number {
  if (hierarchy.type === HierarchyType.HEADING) {
    return findHeadingSlicePosition(content, curPosition, hierarchy);
  } else if (hierarchy.type === HierarchyType.BULLET) {
    return findBulletSlicePosition(content, curPosition, hierarchy);
  } else if (hierarchy.type === HierarchyType.PARAGRAPH) {
    return findParagraphSlicePosition(content, curPosition);
  }
  throw 'Unsupported HierarchyType detected: ' + hierarchy;
}

export function postProcessMarkdownNodes(content: string, hierarchy: Hierarchy): string {
  if (hierarchy.type === HierarchyType.BULLET) {
    return postProcessBullet(content);
  }

  if (hierarchy.type === HierarchyType.HEADING) {
    return postProcessHeading(content, hierarchy);
  }

  if (hierarchy.type === HierarchyType.PARAGRAPH) {
    return postProcessParagraph(content);
  }

  throw 'Unsupported HierarchyType detected: ' + hierarchy;
}
