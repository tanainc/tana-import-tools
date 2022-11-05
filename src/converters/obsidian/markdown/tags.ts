// eslint is just wrong here
// eslint-disable-next-line no-useless-escape
const tagRegex = /(?:\s|^)(#([^\[\]]+?))(?:(?=\s)|$)/g;

const nonDigit = new RegExp('\\D');

// https://help.obsidian.md/How+to/Working+with+tags
// only - _ and / are allowed
// this is a brute force approach, because its not trivial to detect invalid tags in other languages
// (can not use \w for example because e.g. korean characters are excluded)
const disallowedSymbols = new Set([
  '#',
  '!',
  '{',
  '}',
  '(',
  ')',
  '?',
  '$',
  '%',
  '&',
  '"',
  "'",
  '<',
  '>',
  '\\',
  '*',
  '`',
  '[',
  ']',
  ':',
  ',',
  ';',
  '~',
  '=',
  '§',
  '.',
  '°',
  '^',
]);

export function validTag(tag: string) {
  //currently whitespace is also detected as part of the tag
  tag = tag.trim();
  let char = tag[0];
  //sanity check
  if (char !== '#') {
    return false;
  }

  let foundNonDigit = false;

  for (let index = 1; index < tag.length; index++) {
    char = tag[index];
    if (char.match(nonDigit)) {
      foundNonDigit = true;
    }

    if (disallowedSymbols.has(char)) {
      return false;
    }
  }

  return foundNonDigit;
}

export function detectTags(content: string) {
  return content.match(tagRegex)?.filter((tag) => validTag(tag));
}

export function removeTagsFromEnd(content: string, tags: string[]) {
  let curContent = content;
  let globalRemovedTag = false;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let removedTag = false;
    for (const tag of tags) {
      if (curContent.endsWith(tag)) {
        curContent = curContent.slice(0, -tag.length);
        removedTag = true;
        globalRemovedTag = true;
      }
    }

    if (!removedTag) {
      break;
    }
  }

  //removing empty space at the end, because the tag detection only detects leading empty space
  if (globalRemovedTag) {
    curContent = curContent.trimEnd();
  }

  return curContent;
}

export function cleanUpTag(tag: string) {
  return tag.trim().slice(1); //remove the #
}
