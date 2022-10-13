export function nextNewLine(content: string, curPosition: number, count = 0): number {
  const curChar = content[curPosition + count];
  if (isNewLine(curChar)) {
    return curPosition + count;
  }
  return nextNewLine(content, curPosition, count + 1);
}

export function lastPositionIsNewline(content: string, curPosition: number) {
  const lastPosChar = content[curPosition - 1];
  return isNewLine(lastPosChar);
}

export function isNewLine(char: string | undefined) {
  //end of file is also counted as newline for simplicity
  return char === undefined || char === '\n';
}
