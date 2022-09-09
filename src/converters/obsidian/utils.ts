export function countEmptySpace(content: string, curPosition: number, count = 0): number {
  //we count tab as one empty space
  if (content[curPosition] !== ' ' && content[curPosition] !== '\t') return count;
  return countEmptySpace(content, curPosition + 1, count + 1);
}

export function nextNewLine(content: string, curPosition: number, count = 0): number {
  //end of file is also counted as newline for simplicity
  if (content[curPosition + count] === undefined || content[curPosition + count] === '\n') return curPosition + count;
  return nextNewLine(content, curPosition, count + 1);
}
