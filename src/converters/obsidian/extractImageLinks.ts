export function extractImageLinks(content: string) {
  const imageData: [string, string, number][] = [];
  let foundData = extractImageLink(content, 0);
  while (foundData !== null) {
    let nextIndex;
    if (Array.isArray(foundData)) {
      imageData.push(foundData);
      nextIndex = foundData[2];
    } else {
      nextIndex = foundData;
    }
    foundData = extractImageLink(content, nextIndex);
  }

  return imageData;
}

/**
 *
 * Extracts an image-link alt text and link by checking for the ![...](http://...|https://...) pattern manually.
 */
function extractImageLink(content: string, startPositon: number): [string, string, number] | number | null {
  let lastFoundImageSignifier;
  let altText = '';
  let link = '';

  for (let index = startPositon; index < content.length; index++) {
    const char = content[index];
    if (char === '\n') {
      return index + 1;
    }
    //I will atone for my sins, but you are not making me try to do this with RegEx
    if (!lastFoundImageSignifier && char === '!') {
      lastFoundImageSignifier = char;
      continue;
    }
    if (lastFoundImageSignifier === '!' && char === '[') {
      lastFoundImageSignifier = char;
      continue;
    }
    if (lastFoundImageSignifier === '[' && char !== ']') {
      altText += char;
      continue;
    }
    if (lastFoundImageSignifier === '[' && char === ']') {
      lastFoundImageSignifier = char;
      continue;
    }
    if (lastFoundImageSignifier === ']' && char !== '(') {
      return index + 1;
    }
    if (lastFoundImageSignifier === ']' && char === '(') {
      lastFoundImageSignifier = char;
      continue;
    }
    if (lastFoundImageSignifier === '(' && char !== ')') {
      link += char;
      continue;
    }
    if (lastFoundImageSignifier === '(' && char === ')') {
      if (link.startsWith('http://') || link.startsWith('https://')) {
        return [altText, link, index + 1];
      } else {
        return index + 1;
      }
    }
  }

  return null;
}
