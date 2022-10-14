import { TanaIntermediateSummary, TanaIntermediateAttribute } from '../../types/types';
import { idgenerator as randomGenerator } from '../../utils/utils';
import { FileDescMap } from './links/FileDescMap';
import { BlockLinkTracker } from './links/blockLinks';
import { SuperTagTracker } from './tanafeatures/supertags';
import { UidRequestType } from './links/internalLinks';
import { IdGenerator } from './utils/IdGenerator';
import { HeadingTracker, HeadingDummyUidTracker } from './links/headingLinks';
import { CustomFileSystemAdapter, SEPARATOR } from './filesystem/CustomFileSystemAdapter';

export type UidTracker = FileDescMap<UidData>;

interface UidData {
  type: UidRequestType;
  uid: string;
  obsidianLink: string;
}

/**
 * Contains all information that is used across the whole vault, like which UIDs have already been used.
 */
export interface VaultContext {
  summary: TanaIntermediateSummary;
  defaultLinkTracker: UidTracker;
  headingTracker: HeadingTracker;
  dummyHeadingLinkTracker: HeadingDummyUidTracker;
  blockLinkTracker: BlockLinkTracker;
  invalidLinks: { uid: string; link: string }[];
  superTagTracker: SuperTagTracker;
  attributes: TanaIntermediateAttribute[];
  dailyNoteFormat: string;
  vaultPath: string;
  idGenerator: IdGenerator;
  fileSystemAdapter: CustomFileSystemAdapter;
}

export function incrementSummary(summary: TanaIntermediateSummary) {
  summary.totalNodes++;
  summary.leafNodes++;
}

export function shiftFromLeafToTop(summary: TanaIntermediateSummary) {
  summary.leafNodes--;
  summary.topLevelNodes++;
}

export function createVaultContext(
  vaultPath: string,
  fileSystemAdapter: CustomFileSystemAdapter,
  idGenerator: () => string = randomGenerator,
): VaultContext {
  if (vaultPath.endsWith(SEPARATOR)) {
    vaultPath = vaultPath.slice(0, -1);
  }
  vaultPath = fileSystemAdapter.resolve(vaultPath);

  return {
    summary: {
      leafNodes: 0,
      topLevelNodes: 0,
      totalNodes: 0,
      calendarNodes: 0,
      fields: 0,
      brokenRefs: 0,
    },
    fileSystemAdapter,
    idGenerator,
    vaultPath,
    defaultLinkTracker: new FileDescMap(),
    headingTracker: new FileDescMap(),
    dummyHeadingLinkTracker: new Map(),
    blockLinkTracker: new FileDescMap(),
    invalidLinks: [],
    superTagTracker: new Map(),
    attributes: [],
    dailyNoteFormat: 'YYYY-MM-DD', //Default obsidian Daily note format
  };
}
