import { resolve } from 'path';
import { TanaIntermediateSummary, TanaIntermediateAttribute } from '../../types/types';
import { idgenerator as randomGenerator } from '../../utils/utils';
import { FileDesc } from './markdown/file';
import { BlockLinkTracker } from './tanaconversion/blockLinks';
import { HeadingDummyUidTracker, HeadingTracker } from './tanaconversion/headingLinks';
import { SuperTagTracker } from './tanaconversion/supertags';
import { IdGenerator, UidRequestType } from './tanaconversion/uids';

//all normal ([[fileName]]), file or folder UIDs: <name, UidData>
export type UidTracker = Map<FileDesc, UidData>;

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
}

export function createVaultContext(vaultPath: string, idGenerator: () => string = randomGenerator): VaultContext {
  if (vaultPath.endsWith('/')) {
    vaultPath = vaultPath.slice(0, -1);
  }
  vaultPath = resolve(vaultPath);

  return {
    summary: {
      leafNodes: 0,
      topLevelNodes: 0,
      totalNodes: 0,
      calendarNodes: 0,
      fields: 0,
      brokenRefs: 0,
    },
    idGenerator,
    vaultPath,
    defaultLinkTracker: new Map(),
    headingTracker: new Map(),
    dummyHeadingLinkTracker: new Map(),
    blockLinkTracker: new Map(),
    invalidLinks: [],
    superTagTracker: new Map(),
    attributes: [],
    dailyNoteFormat: 'YYYY-MM-DD', //Default obsidian Daily note format
  };
}
