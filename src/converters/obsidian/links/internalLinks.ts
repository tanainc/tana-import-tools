import { incrementSummary, VaultContext } from '../VaultContext';
import { removeBlockId } from '../markdown/blockIds';
import { blockLinkUidRequestForUsing, blockLinkUidRequestForDefining } from './blockLinks';
import { untrackedUidRequest } from './genericLinks';
import { headingLinkUidRequestForUsing } from './headingLinks';

export enum UidRequestType {
  FILE,
  CONTENT,
}

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

export function requestUidForLink(obsidianLink: string, context: VaultContext) {
  const cleanLink = cleanUpLink(obsidianLink);
  const linkType = detectLinkType(cleanLink);
  switch (linkType) {
    case LinkType.DEFAULT:
      return standardLinkUidRequest(cleanLink[0], context);
    case LinkType.BLOCK:
      return blockLinkUidRequestForUsing(cleanLink, context);
    case LinkType.HEADING:
      return headingLinkUidRequestForUsing(cleanLink, context);
    default:
      throw 'Invalid link type detected: ' + cleanLink;
  }
}

function standardLinkUidRequest(obsidianLink: string, context: VaultContext) {
  const uidData = context.defaultLinkTracker.partialRetrieveAndUpdate(obsidianLink, () => {
    incrementSummary(context.summary);
    const uid = context.idGenerator();
    return { uid, obsidianLink, type: UidRequestType.CONTENT };
  });
  return uidData.uid;
}

/**
 * Removes Obsidian-generated block-UIDs if they exists, returns the valid uid and the cleaned content.
 * @returns [uid, cleanedContent]
 */
export function requestUidForContentNode(fileName: string, filePath: string, content: string, context: VaultContext) {
  const [cleanedContent, id] = removeBlockId(content);
  if (id) {
    //found the id, now define the UID
    return [blockLinkUidRequestForDefining([fileName, id], filePath, context), cleanedContent];
  } else {
    return [untrackedUidRequest(context), content];
  }
}

export function requestUidForFile(fileName: string, filePath: string, context: VaultContext) {
  const obsidianLink = fileName.trim();
  const uidData = context.defaultLinkTracker.fullRetrieveAndUpdate(obsidianLink, filePath, () => {
    incrementSummary(context.summary);
    const uid = context.idGenerator();
    return { uid, obsidianLink, type: UidRequestType.FILE };
  });
  uidData.type = UidRequestType.FILE;

  return uidData.uid;
}
