import { TanaIntermediateSummary, TanaIntermediateAttribute } from '../../types/types';
import { idgenerator as randomGenerator } from '../../utils/utils';
import { BlockLinkTracker } from './tanaconversion/blocks';
import { HeadingDummyUidTracker, HeadingTracker } from './tanaconversion/headingLinks';
import { SuperTagTracker } from './tanaconversion/supertags';
import { IdGenerator, UidTracker } from './tanaconversion/uids';

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
