// eslint is just wrong here
// eslint-disable-next-line no-useless-escape
const tagRegex = /(?:\s|^)(#([^\[\]]+?))(?:(?=\s)|$)/g;

//TODO: tags are too naive! ()
export function detectTags(content: string) {
  return content.match(tagRegex);
}

export function cleanUpTag(tag: string) {
  return tag.trim().slice(1); //remove the #
}
