export type FrontmatterData = {
  key: string;
  values: string[];
};

/**
 *
 * @param frontmatter without the starting "---" or ending "---"
 */
export function parseFrontmatter(frontmatter: string) {
  const lines = frontmatter
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s !== '');

  const data: FrontmatterData[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];

    const splitLine = line
      .split(':')
      .map((s) => s.trim())
      .filter((s) => s !== '');

    //skipping obsidian specific frontmatter
    if (splitLine[0] === 'publish' || splitLine[0] === 'cssclass' || splitLine[0] === 'aliases') {
      continue;
    }

    //one of
    //key2: value2
    //key3: [one, two, three]
    if (splitLine.length === 2) {
      if (splitLine[1].startsWith('[') && splitLine[1].endsWith(']')) {
        const arr: string[] = splitLine[1]
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s !== '');
        data.push({ key: splitLine[0], values: arr });
      } else {
        data.push({ key: splitLine[0], values: [splitLine[1]] });
      }
    } else {
      //one of
      //key4:
      //key5:
      // - value1
      // - value2
      const curData: FrontmatterData = { key: splitLine[0], values: [] };
      let counter = 1;
      let nextLine = lines[index + counter];
      while (nextLine !== undefined && nextLine.startsWith('- ')) {
        curData.values.push(nextLine.slice('- '.length));
        counter++;
        nextLine = lines[index + counter];
      }
      index += counter - 1;
      data.push(curData);
    }
  }
  return data;
}
