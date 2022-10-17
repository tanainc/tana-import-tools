export function nextNewLine(content: string, curPosition: number): number {
  let count = 0;
  while (!isNewLine(content[curPosition + count])) {
    count++;
  }
  return curPosition + count;
}

export function lastPositionIsNewline(content: string, curPosition: number) {
  const lastPosChar = content[curPosition - 1];
  return isNewLine(lastPosChar);
}

export function isNewLine(char: string | undefined) {
  //end of file is also counted as newline for simplicity
  return char === undefined || char === '\n';
}
