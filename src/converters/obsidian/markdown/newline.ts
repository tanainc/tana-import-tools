export function nextNewLine(content: string, curPosition: number, count = 0): number {
  //end of file is also counted as newline for simplicity
  if (content[curPosition + count] === undefined || content[curPosition + count] === '\n') {
    return curPosition + count;
  }
  return nextNewLine(content, curPosition, count + 1);
}
