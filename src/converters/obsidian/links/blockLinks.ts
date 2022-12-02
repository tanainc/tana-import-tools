import { VaultContext } from '../VaultContext';
import { FileDescMap } from './FileDescMap';
import { untrackedUidRequest } from './genericLinks';

export type BlockLinkTracker = FileDescMap<Map<string, BlockUidData>>;

export enum BlockUidRequestType {
  LINK, //the request came from using the block ref
  BLOCK, //the request came from finding the block ref
}

export interface BlockUidData {
  uid: string;
  obsidianLink: string;
  type: BlockUidRequestType;
}

export function blockLinkUidRequestForUsing(link: string[], context: VaultContext) {
  const fileName = link[0];
  const blockObsidianUid = link[1];
  if (fileName == undefined) {
    console.log('Parsed undefined file name in block link.');
  }
  const blockUidMap = context.blockLinkTracker.accessAsLink(
    fileName,
    () => {
      return new Map<string, BlockUidData>();
    },
    context.dailyNoteFormat,
  );
  let blockUidData = blockUidMap.get(blockObsidianUid);
  if (!blockUidData) {
    blockUidData = {
      uid: untrackedUidRequest(context),
      obsidianLink: link.join('#'),
      type: BlockUidRequestType.LINK,
    };
  }
  blockUidMap.set(blockObsidianUid, blockUidData);

  return blockUidData.uid;
}

export function blockLinkUidRequestForDefining(link: string[], filePath: string, context: VaultContext) {
  const fileName = link[0];
  const blockObsidianUid = link[1];
  const blockUidMap = context.blockLinkTracker.accessAsFile(
    fileName,
    filePath,
    () => {
      return new Map<string, BlockUidData>();
    },
    context.dailyNoteFormat,
  );
  let blockUidData = blockUidMap.get(blockObsidianUid);
  if (!blockUidData) {
    blockUidData = {
      uid: untrackedUidRequest(context),
      obsidianLink: link.join('#'),
      type: BlockUidRequestType.BLOCK,
    };
  }
  blockUidData.type = BlockUidRequestType.BLOCK;
  blockUidMap.set(blockObsidianUid, blockUidData);

  return blockUidData.uid;
}

export function filterInvalidBlockLinks(tracker: BlockLinkTracker) {
  const unlinkedNodes: { uid: string; link: string }[] = [];

  for (const fileBlockLinks of tracker.getData()) {
    for (const blockLink of fileBlockLinks.values()) {
      //if it has only been accessed via a link (e.g. [[file#^UID]]), it is not valid
      //because that means we didn't find it in "file"
      if (blockLink.type === BlockUidRequestType.LINK) {
        unlinkedNodes.push({ uid: blockLink.uid, link: blockLink.obsidianLink });
      }
    }
  }

  return unlinkedNodes;
}
