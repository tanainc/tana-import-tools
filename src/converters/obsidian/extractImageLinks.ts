/**
 *
 * Extracts an image-link alt text and link by checking for the \!\[...\]\(http://...|https://...\) pattern manually.
 *
 * Supports also linked images \[\!\[...\]\(https://...)\]\(https:://...\). But takes the last URL as the final URL.
 *
 * @returns array of [alt text, url, next position, old string to replace]
 */
export function extractImageLinks(content: string) {
  const imageData: [string, string, number, string][] = [];
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

//TODO: improve performance, this halfed the conversion speed of Eleanors vault

function extractImageLink(content: string, startPositon: number): [string, string, number, string] | number | null {
  let lastFoundImageSignifier;
  let altText = '';
  let url = '';

  //I will atone for my sins, but you are not making me try to do this with RegEx
  for (let index = startPositon; index < content.length; index++) {
    const char = content[index];
    if (char === '\n') {
      return index + 1;
    }
    if (
      !lastFoundImageSignifier &&
      char === '[' &&
      //here we skip obvious false positives - e.g. "[[" links, which had tanked the performance earlier
      content[index + 1] !== undefined &&
      content[index + 1] === '!'
    ) {
      const res = tryToExtractLinkedImageLink(content, index);
      if (res !== null) {
        return res;
      }
      continue;
    }

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
      url += char;
      continue;
    }
    if (lastFoundImageSignifier === '(' && char === ')') {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return [
          altText,
          //could add titles to the url, which we dont convert
          url.split(' ')[0],
          index + 1,
          '![' + altText + '](' + url + ')',
        ];
      } else {
        return index + 1;
      }
    }
  }

  return null;
}

/**
 * If we detect the possible start of a linked image "[", we try to extract it.
 *
 */
function tryToExtractLinkedImageLink(
  content: string,
  startPositon: number,
): [string, string, number, string] | number | null {
  //in Markdown this is called a linked image (so an image with a URL that you can click on)
  //a linked image has a normal image link embedded
  const embeddedImage = extractImageLink(content, startPositon + 1);
  if (Array.isArray(embeddedImage)) {
    const endPosition = embeddedImage[2];
    const expectedEndPositon = startPositon + 1 + embeddedImage[3].length;
    if (endPosition !== expectedEndPositon) {
      //in this case we found another image, but not an embedded one
      //dont need to do work twice, so can use this
      //will clean this up when the Muse visits me again
      return embeddedImage;
    }

    let lastFoundImageSignifier;
    let endUrl = ''; //the URL at the end of linked image, so the second one
    for (let index = endPosition; index < content.length; index++) {
      const char = content[index];
      if (char === '\n') {
        //not optimal, because the algo will traverse until this newline again
        //but otherwise would need to extract the image again
        return embeddedImage;
      }
      if (!lastFoundImageSignifier && char === '(') {
        lastFoundImageSignifier = char;
        continue;
      }

      if (lastFoundImageSignifier === '(' && char !== ')') {
        endUrl += char;
        continue;
      }

      if (lastFoundImageSignifier === '(' && char === ')') {
        if (endUrl.startsWith('http://') || endUrl.startsWith('https://')) {
          return [
            embeddedImage[0],
            //could add titles to the url, which we dont convert
            endUrl.split(' ')[0],
            index + 1,
            '[![' + embeddedImage[0] + '](' + embeddedImage[1] + ')](' + endUrl + ')',
          ];
        } else {
          return embeddedImage;
        }
      }
    }
  }
  return embeddedImage;
}
