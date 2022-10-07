import { TanaIntermediateSummary } from '../..';
import { idgenerator as randomGenerator } from '../../utils/utils';

export enum UidRequestType {
  FILE,
  CONTENT,
}

interface UidData {
  type: UidRequestType;
  uid: string;
  obsidianLink: string;
}

interface HeadingUidData {
  uid: string;
  link: string[];
}

enum BlockUidRequestType {
  LINK, //the request came from using the block ref
  BLOCK, //the request came from finding the block ref
}

interface BlockUidData {
  uid: string;
  obsidianLink: string;
  type: BlockUidRequestType;
}

enum LinkType {
  DEFAULT,
  HEADING,
  BLOCK,
}

/**
 *
 * @param link the link split by "#" and cleaned.
 */
function detectLinkType(link: string[]) {
  if (link.length === 2 && link[1].startsWith('^')) {
    return LinkType.BLOCK;
  }

  if (link.length > 1) {
    return LinkType.HEADING;
  }

  return LinkType.DEFAULT;
}

//this is used for easier replacing the Heading Link UIDs in the post processing
//whoever uses this string in his text will be disregarded
export const HEADING_LINK_PREFIX = '$$!HEADING_LINK!$$';

export function extractBlockId(content: string): [string, string | undefined] {
  let id;

  const cleanedContent = content
    .split('\n')
    .map((line) => {
      const splitLine = line.split(' ');
      const lastEle = splitLine[splitLine.length - 1];
      if (lastEle.startsWith('^')) {
        //we take the last id, rest will be detected as invalid
        id = lastEle;
        return splitLine.slice(0, -1).join(' ');
      }
    })
    .join('\n');

  return [cleanedContent, id];
}

/**
 * Contains all information that is used across the whole vault, like which Uids have already been used.
 */
export class VaultContext {
  summary: TanaIntermediateSummary = {
    leafNodes: 0,
    topLevelNodes: 0,
    totalNodes: 0,
    calendarNodes: 0,
    fields: 0,
    brokenRefs: 0,
  };
  //we will need to expand this to be able to support relative paths
  //all normal ([[fileName]]), file or folder uids: <name, UidData>
  defaultLinkTracker = new Map<string, UidData>();
  //all heading temp-uids: <fileName, HeadingUidData[]>
  headingLinkTracker = new Map<string, HeadingUidData[]>();
  //all block uids: <fileName, <blockObsidianUid, TanaUid>>
  blockLinkTrack = new Map<string, Map<string, BlockUidData>>();

  constructor(public idGenerator: () => string = randomGenerator) {}

  /**
   * Removes Obsidian-generated block-UIDs if they exists, returns the valid uid and the cleaned content.
   * @returns [uid, cleanedContent]
   */
  contentUid(fileName: string, content: string) {
    const [cleanedContent, id] = extractBlockId(content);
    if (id) {
      return [this.handleBlockLink([fileName, id], BlockUidRequestType.BLOCK), cleanedContent];
    } else {
      return [this.randomUid(), content];
    }
  }

  randomUid() {
    this.incrementSummary();
    //folders / "summary unlinked nodes" / content-nodes get new uids always
    //because these UIDs either are not in the source or need to be connected later
    return this.idGenerator();
  }

  /**
   * We can not just take the obsidian link because we might already have created a node for that link
   * or a folder might have the same link as a file.
   *
   * This function should return the correct Uid.
   *
   * A side-effect is the collection of the summary.
   */
  uidRequest(obsidianLink: string, requestType: UidRequestType) {
    if (requestType === UidRequestType.FILE) {
      //we dont use the same split-link because files could contain #
      return this.handleDefaultLink(obsidianLink.trim(), requestType);
    }

    //Obsidian ignores whitespace in many places, too many other edge cases to handle but this is the least we can do
    const cleanLink = obsidianLink
      .split('#')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    const linkType = detectLinkType(cleanLink);
    switch (linkType) {
      case LinkType.DEFAULT:
        return this.handleDefaultLink(cleanLink[0], requestType);
      case LinkType.BLOCK:
        return this.handleBlockLink(cleanLink, BlockUidRequestType.LINK);
      case LinkType.HEADING:
        return this.handleHeadingLink(cleanLink);
      default:
        throw 'Invalid link type detected: ' + cleanLink;
    }
  }

  private handleDefaultLink(obsidianLink: string, requestType: UidRequestType) {
    const uidData = this.defaultLinkTracker.get(obsidianLink);
    if (!uidData) {
      this.incrementSummary();
      const uid = this.idGenerator();
      this.defaultLinkTracker.set(obsidianLink, { uid, obsidianLink, type: requestType });
      return uid;
    }

    //at the end every uidData that has been only accessed from content (so inside the markdown file)
    //has no matching file node and is therefore unlinked
    //otherwise during the creation of the file node, it would have accessed the same Uid
    if (uidData.type === UidRequestType.CONTENT) {
      uidData.type = requestType;
    }

    return uidData.uid;
  }

  private handleHeadingLink(link: string[]) {
    const fileName = link[0];
    const fileHeadingData = this.headingLinkTracker.get(fileName) ?? [];
    this.headingLinkTracker.set(fileName, fileHeadingData);
    //TODO:
    //these "uids" are replaced and counted later
    const uid = HEADING_LINK_PREFIX + fileHeadingData.length;
    fileHeadingData.push({ uid, link: link.slice(1) });
    return uid;
  }

  private handleBlockLink(link: string[], requestType: BlockUidRequestType) {
    const fileName = link[0];
    const blockUidMap = this.blockLinkTrack.get(fileName) ?? new Map<string, BlockUidData>();
    this.blockLinkTrack.set(fileName, blockUidMap);
    const blockObsidianUid = link[1];
    let blockUidData = blockUidMap.get(blockObsidianUid);
    if (!blockUidData) {
      blockUidData = {
        uid: this.randomUid(),
        obsidianLink: link.join('#'),
        type: requestType,
      };
    }
    blockUidMap.set(blockObsidianUid, blockUidData);

    //if it has only been accessed via a link (e.g. [[file#^UID]]), it is not valid
    //because that means we didnt find it in "file"
    if (blockUidData.type === BlockUidRequestType.LINK) {
      blockUidData.type = requestType;
    }

    return blockUidData.uid;
  }

  private incrementSummary() {
    this.summary.totalNodes++;
    this.summary.leafNodes++;
  }

  getAllInvalidContentLinks() {
    const unlinkedNodes: { uid: string; link: string }[] = [];
    for (const node of this.defaultLinkTracker.values()) {
      if (node.type === UidRequestType.CONTENT) {
        unlinkedNodes.push({ uid: node.uid, link: node.obsidianLink });
      }
    }
    for (const fileBlockLinks of this.blockLinkTrack.values()) {
      for (const blockLink of fileBlockLinks.values()) {
        if (blockLink.type === BlockUidRequestType.LINK) {
          unlinkedNodes.push({ uid: blockLink.uid, link: blockLink.obsidianLink });
        }
      }
    }

    return unlinkedNodes;
  }
}
