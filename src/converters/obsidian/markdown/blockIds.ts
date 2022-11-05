export function removeBlockId(content: string): [string, string | undefined] {
  let id;

  const cleanedContent = content
    .split('\n')
    .map((line) => {
      const splitLine = line.split(' ');
      const lastEle = splitLine[splitLine.length - 1];
      if (lastEle.startsWith('^')) {
        //we take the last id, rest will be detected as invalid if they are used
        id = lastEle;
        return splitLine.slice(0, -1).join(' ');
      } else {
        return line;
      }
    })
    .join('\n');

  return [cleanedContent, id];
}
