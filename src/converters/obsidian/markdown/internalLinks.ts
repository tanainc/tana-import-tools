export enum LinkType {
  DEFAULT,
  HEADING,
  BLOCK,
}

export function cleanUpLink(link: string) {
  //Obsidian ignores whitespace in many places, too many other edge cases to handle but this is the least we can do
  return link
    .split('#')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/**
 *
 * @param link the link split by "#" and cleaned.
 */
export function detectLinkType(link: string[]) {
  if (link.length === 2 && link[1].startsWith('^')) {
    return LinkType.BLOCK;
  }

  if (link.length > 1) {
    return LinkType.HEADING;
  }

  return LinkType.DEFAULT;
}
