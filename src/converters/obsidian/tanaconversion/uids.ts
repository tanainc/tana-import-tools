import { VaultContext } from '../context';
import { removeBlockId } from '../markdown/blockIds';
import { cleanUpLink, detectLinkType, LinkType } from '../markdown/internalLinks';
import { blockLinkUidRequest, BlockUidRequestType } from './blockLinks';
import { headingLinkUidRequest } from './headingLinks';
import { incrementSummary } from './summary';

export enum UidRequestType {
  FILE,
  CONTENT,
}

interface UidData {
  type: UidRequestType;
  uid: string;
  obsidianLink: string;
}

export interface HeadingUidData {
  uid: string;
  link: string[]; //without the fileName
}

export type IdGenerator = () => string;

//all normal ([[fileName]]), file or folder UIDs: <name, UidData>
export type UidTracker = Map<string, UidData>;

/**
 * We can not just take the obsidian link because we might already have created a node for that link
 * or a folder might have the same link as a file.
 *
 * This function should return the correct Uid.
 *
 * A side-effect is the collection of the summary.
 */
export function uidRequest(obsidianLink: string, requestType: UidRequestType, context: VaultContext) {
  if (requestType === UidRequestType.FILE) {
    //we don't use the same split-link because files could contain #
    return standardLinkUidRequest(obsidianLink.trim(), requestType, context);
  }

  const cleanLink = cleanUpLink(obsidianLink);
  const linkType = detectLinkType(cleanLink);
  switch (linkType) {
    case LinkType.DEFAULT:
      return standardLinkUidRequest(cleanLink[0], requestType, context);
    case LinkType.BLOCK:
      return blockLinkUidRequest(cleanLink, BlockUidRequestType.LINK, context);
    case LinkType.HEADING:
      return headingLinkUidRequest(cleanLink, context);
    default:
      throw 'Invalid link type detected: ' + cleanLink;
  }
}

export function untrackedUidRequest(context: VaultContext) {
  incrementSummary(context.summary);
  //folders / "summary unlinked nodes" / content-nodes get new UIDs always
  //because these UIDs either are not in the source or need to be connected later
  return context.idGenerator();
}

/**
 * Removes Obsidian-generated block-UIDs if they exists, returns the valid uid and the cleaned content.
 * @returns [uid, cleanedContent]
 */
export function contentUidRequest(fileName: string, content: string, context: VaultContext) {
  const [cleanedContent, id] = removeBlockId(content);
  if (id) {
    return [blockLinkUidRequest([fileName, id], BlockUidRequestType.BLOCK, context), cleanedContent];
  } else {
    return [untrackedUidRequest(context), content];
  }
}

function standardLinkUidRequest(obsidianLink: string, requestType: UidRequestType, context: VaultContext) {
  const uidData = context.defaultLinkTracker.get(obsidianLink);
  if (!uidData) {
    incrementSummary(context.summary);
    const uid = context.idGenerator();
    context.defaultLinkTracker.set(obsidianLink, { uid, obsidianLink, type: requestType });
    return uid;
  }

  if (uidData.type === UidRequestType.CONTENT) {
    uidData.type = requestType;
  }

  return uidData.uid;
}

export function filterInvalidContentLinks(tracker: UidTracker) {
  const unlinkedNodes: { uid: string; link: string }[] = [];
  for (const node of tracker.values()) {
    //at the end every uidData that has been only accessed from content (so inside the markdown file)
    //has no matching file node and is therefore unlinked
    //otherwise during the creation of the file node, it would have accessed the same Uid
    if (node.type === UidRequestType.CONTENT) {
      unlinkedNodes.push({ uid: node.uid, link: node.obsidianLink });
    }
  }
  return unlinkedNodes;
}
