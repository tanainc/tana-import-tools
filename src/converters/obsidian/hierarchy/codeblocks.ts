import { countEmptySpace } from '../markdown/emptySpace';
import { lastPositionIsNewline, nextNewLine } from '../markdown/newline';
import { Hierarchy, HierarchyType, MarkdownNode } from './markdownNodes';

export function findCodeBlockSliceStartPosition(curPosition: number) {
  return curPosition;
}

export function findCodeBlockSliceEndPosition(curPosition: number, hierarchy: Hierarchy) {
  return curPosition + hierarchy.level;
}

/**
 * Codeblocks are a special case because they are fenced. So we need a special post processing approach.
 */
export function postProcessCodeBlock(obsidianNode: MarkdownNode) {
  //cutting off ``` + codeLanguage
  //might have empty space after codeLanguage
  const startingPos = 3 + (obsidianNode.codeLanguage ?? '').length;
  const emptySpace = countEmptySpace(obsidianNode.content, startingPos);
  //cutting newline at the start, cutting ``` + possibly newline at the end
  return obsidianNode.content
    .trimEnd()
    .slice(startingPos + emptySpace + 1, -3)
    .trimEnd();
}

export function detectCodeBlockHierarchy(content: string, curPosition: number): Hierarchy | null {
  if (!lastPositionIsNewline(content, curPosition)) {
    return null;
  }
  if ([content[curPosition], content[curPosition + 1], content[curPosition + 2]].every((val) => val === '`')) {
    const newLinePos = nextNewLine(content, curPosition + 3);
    const codeLanguage = content.slice(curPosition + 3, newLinePos).trimEnd();
    //check that only one word after the `s
    if (codeLanguage.includes(' ')) {
      return null;
    }

    let pos = newLinePos + 1;
    let char1 = content[pos];
    let char2 = content[pos + 1];
    let char3 = content[pos + 2];
    while ([char1, char2, char3].every((val) => val !== undefined) && [char1, char2, char3].join('') !== '```') {
      pos++;
      char1 = content[pos];
      char2 = content[pos + 1];
      char3 = content[pos + 2];
    }
    if ([char1, char2, char3].some((val) => val === undefined)) {
      return null;
    }
    const secondNewLinePos = nextNewLine(content, pos + 3);
    const secondLine = content.slice(pos + 3, secondNewLinePos).trim();
    //no text after the closing code block fence allowed
    if (secondLine !== '') {
      return null;
    }
    return {
      type: HierarchyType.CODEBLOCK,
      //might end at the end of file or at a newline
      level: secondNewLinePos - curPosition + (content[secondNewLinePos] === '\n' ? 1 : 0),
      codeLanguage: codeLanguage !== '' ? codeLanguage : undefined,
    };
  }
  return null;
}
