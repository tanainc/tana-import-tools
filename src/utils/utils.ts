export function idgenerator() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function getCodeIfCodeblock(name: string): string | undefined {
  if (name?.trim().startsWith('```') && name.endsWith('```')) {
    return name.substring(3, name.length - 3).substring(0, 100);
  }

  // Starts and ends with backticks, and no more backticks present. ie `hello world`
  if (name?.trim().startsWith('`') && name.endsWith('`') && name.trim().split('`').length === 3) {
    return name.substring(1, name.length - 1).substring(0, 100);
  }

  if (name.startsWith('<%J:```') && name.endsWith('```%>')) {
    return name.substring('<%J:```'.length, name.length - '```%>'.length).substring(0, 100);
  }
  return undefined;
}

// Checks if the supplied index is within a pair of single or triple backticks, like ```foo``` and `bar`
export function isIndexWithinBackticks(index: number, string?: string) {
  if (string && index !== undefined && index !== -1) {
    if ((string?.substring(0, index).split('```').length - 1) % 2 === 1) {
      return true;
    } else if ((string?.substring(0, index).split('`').length - 1) % 2 === 1) {
      return true;
    }
  }
  return false;
}

// Finds content between start and end tokens, like ((xxxxx))
export function findGroups(
  stringToLookIn: string,
  startToken: string,
  endToken: string,
): { start: number; end: number; content: string }[] {
  const matches: { start: number; end: number; content: string }[] = [];

  for (let i = 0; i < stringToLookIn.length; i++) {
    if (stringToLookIn.substring(i, i + startToken.length) === startToken) {
      const start = i;
      i += startToken.length;

      while (stringToLookIn.substring(i, i + endToken.length) !== endToken && i < stringToLookIn.length) {
        i += 1;
      }

      const end = i;
      const content = stringToLookIn.substring(start + startToken.length, end);
      matches.push({
        start,
        end,
        content,
      });
    }
  }
  return matches;
}

/**
 *
 * //Finds links in a string '[[hello world]] [[Let's say [[hello world]]]].
 * @param text
 * @param skipIfNotDirect Skip links that are only included since they are inside other links
 */
export function getBracketLinks(text: string, skipIfNotDirect: boolean): string[] {
  const links: string[] = [];
  let state: 'normal' | 'seenOne' | 'seenOneOut' = 'normal';
  let counter = 0;
  const currentLinks: string[] = [];
  text.split('').forEach((char) => {
    currentLinks.forEach((x, i) => (currentLinks[i] += char));
    if (state === 'seenOne' && char !== '[') {
      state = 'normal';
    }
    if (state === 'seenOneOut' && char !== ']') {
      state = 'normal';
    }
    if (char === '[') {
      counter += 1;
      if (state === 'seenOne') {
        currentLinks.push('');
        state = 'normal';
      } else if (state === 'normal') {
        state = 'seenOne';
      }
    }
    if (char === ']' && counter > 0) {
      counter -= 1;
      if (state === 'seenOneOut') {
        const l = currentLinks.pop();
        if (l) {
          if (!skipIfNotDirect || currentLinks.length === 0) {
            links.push(l.slice(0, -2));
          }
        }
        state = 'normal';
      } else if (state === 'normal') {
        state = 'seenOneOut';
      }

      if (counter === 0) {
        state = 'normal';
      }
    }
  });

  return links;
}

// Note: This is a very rudimentary enrichment. We should move to markdown at some point
export function enrichRoam(nodeContent: string) {
  if (!nodeContent) {
    return nodeContent;
  }

  while (nodeContent.endsWith('\n') || nodeContent.endsWith('\r') || nodeContent.endsWith('\t')) {
    nodeContent = nodeContent.substring(0, nodeContent.length - 1);
  }

  if (nodeContent.includes('://')) {
    let parsedUpToIndex = 0;
    let restOfString = nodeContent;

    while (parsedUpToIndex !== -1 && parsedUpToIndex < nodeContent.length) {
      // look for link further down the string
      restOfString = nodeContent.substring(parsedUpToIndex);

      const nextLinkSplitPoint = restOfString.indexOf('://');
      if (nextLinkSplitPoint === -1) {
        break;
      }

      const tmp = restOfString.split('://');
      const protocol = tmp[0].split(' ').pop() || '';
      const restOfLink = tmp[1].split(' ').shift();
      const url = `${protocol}://${restOfLink}`;
      const anchor = `<a href="${url}">${url}</a>`;

      const wasMarkLink = nodeContent[parsedUpToIndex + nextLinkSplitPoint - protocol.length] === '[';

      if (!protocol?.includes('href') && !protocol.includes(']') && !wasMarkLink) {
        try {
          nodeContent = nodeContent.replace(url, anchor);
        } catch (error) {
          console.error(error, nodeContent, url);
        }
      }

      parsedUpToIndex = parsedUpToIndex + nextLinkSplitPoint - (protocol?.length || 0) + anchor.length;
    }
  }

  nodeContent = replaceTokenWithHtml(nodeContent, '**', 'b');
  nodeContent = replaceTokenWithHtml(nodeContent, '__', 'i');
  nodeContent = replaceTokenWithHtml(nodeContent, '^^', 'mark');
  nodeContent = replaceTokenWithHtml(nodeContent, '~~', 'del');

  // quicker than regex
  if (nodeContent.includes('](')) {
    return nodeContent.replace(
      /\[([^[\]]*)\]\((.*?)\)/g,
      (fullMatch: string | undefined, alias: string | undefined, link: string) => {
        if (link?.includes('://')) {
          return `<a href="${link}">${alias}</a>`;
        }
        return fullMatch || '';
      },
    );
  }
  return nodeContent;
}

// Replaces a token like **foo** with <b>foo</b>
export function replaceTokenWithHtml(nodecontent: string, token: string, tagName: string): string {
  for (let i = 0; i < nodecontent.length; i++) {
    if (nodecontent.substring(i, i + token.length) === token) {
      const start = i;
      i += token.length;

      while (nodecontent.substring(i, i + token.length) !== token && i < nodecontent.length) {
        i += 1;
      }

      const end = i;
      const content = nodecontent.substring(start + 2, end);
      nodecontent = nodecontent.replace(`${token}${content}${token}`, `<${tagName}>${content}</${tagName}>`);
    }
  }
  return nodecontent;
}
