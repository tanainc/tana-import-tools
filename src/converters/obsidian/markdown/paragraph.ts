import { newTypeOfHierachyStarts } from './hierarchy';
import { nextNewLine } from './newline';

export function findParagraphSlicePosition(content: string, curPosition: number) {
  let endPosition = nextNewLine(content, curPosition);
  let char = content[endPosition];
  let lastChar = char;
  endPosition++;
  char = content[endPosition];
  //paragraphs end with double newlines or a new hierarchy
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (char === undefined) {
      return endPosition;
    } else if ((char === '\n' && lastChar === '\n') || newTypeOfHierachyStarts(content, endPosition) !== null) {
      endPosition = endPosition - 1;
      return endPosition;
    }
    lastChar = char;
    endPosition++;
    char = content[endPosition];
  }
}

export function postProcessParagraph(content: string) {
  //I dont think we should trim the front, because people might want have empty space there that is semantically meaningfull
  return content.trimEnd();
}
