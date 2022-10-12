export function isEmptySpace(char: string) {
  return char === ' ' || char === '\t';
}

export function countEmptySpace(content: string, curPosition: number, count = 0): number {
  //we count tab as one empty space
  if (!isEmptySpace(content[curPosition])) {
    return count;
  }
  return countEmptySpace(content, curPosition + 1, count + 1);
}
