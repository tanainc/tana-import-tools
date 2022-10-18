import { incrementSummary, VaultContext } from '../VaultContext';
import { removeBlockId } from '../markdown/blockIds';
import { blockLinkUidRequestForUsing, blockLinkUidRequestForDefining } from './blockLinks';
import { untrackedUidRequest } from './genericLinks';
import { headingLinkUidRequestForUsing } from './headingLinks';
import { getBracketLinks } from '../../../utils/utils';
import { TanaIntermediateNode } from '../../../types/types';

export enum UidRequestType {
  FILE,
  CONTENT,
}

export enum LinkType {
  DEFAULT,
  HEADING,
  BLOCK,
}

export function setUidsInNodeContent(tanaNode: TanaIntermediateNode, context: VaultContext) {
  const foundUIDs = requestUidsForAllLinks(tanaNode.name, context);

  if (foundUIDs.length > 0) {
    //using Set to filter out links that appear multiple times
    const refSet = new Set<string>();
    if (!tanaNode.refs) {
      tanaNode.refs = [];
    }
    for (const [link, foundUid, result] of foundUIDs) {
      refSet.add(foundUid);
      tanaNode.name = tanaNode.name.replaceAll('[[' + link + ']]', result);
    }
    tanaNode.refs.push(...Array.from(refSet.values()));
  }
}

export function requestUidsForAllLinks(content: string, context: VaultContext): [string, string, string][] {
  return getBracketLinks(content, true)
    .map((bracketLink): [string, string[]] => {
      return [bracketLink, bracketLink.split('|').map((s) => s.trim())];
    })
    .filter((arr) => arr[1][0] !== '')
    .map((arr) => {
      const aliasArr = arr[1];
      //handling aliases
      const link = aliasArr[0];
      const alias = aliasArr[1];
      const foundUid = requestUidForLink(link, context);
      const result =
        alias !== undefined && alias.trim() !== ''
          ? '[' + alias.trim() + ']([[' + foundUid + ']])'
          : '[[' + foundUid + ']]';

      return [arr[0], foundUid, result];
    });
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
  const uidData = context.defaultLinkTracker.accessAsLink(
    obsidianLink,
    (dateUID) => {
      incrementSummary(context.summary);
      const uid = dateUID ?? context.idGenerator();
      return { uid, obsidianLink, type: UidRequestType.CONTENT };
    },
    context.dailyNoteFormat,
  );
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
  const uidData = context.defaultLinkTracker.accessAsFile(
    obsidianLink,
    filePath,
    (dateUID) => {
      incrementSummary(context.summary);
      //if this is a daily note, we need to use its new name as the UID
      //TODO: we only need the UID here?
      const uid = dateUID ?? context.idGenerator();
      return { uid, obsidianLink, type: UidRequestType.FILE };
    },
    context.dailyNoteFormat,
  );
  uidData.type = UidRequestType.FILE;

  return uidData.uid;
}
