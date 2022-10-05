import { TanaIntermediateSummary } from '../..';
import { idgenerator as randomGenerator } from '../../utils/utils';

export enum UidRequestType {
  FILE,
  FOLDER,
  CONTENT,
}

type UidData = {
  type: UidRequestType;
  uid: string;
  obsidianLink: string;
};

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
  uidMap = new Map<string, UidData>();

  constructor(public idGenerator: () => string = randomGenerator) {}

  /**
   * We can not just take the obsidian link because we might already have created a node for that link
   * or a folder might have the same link as a file.
   *
   * This function should return the correct Uid.
   *
   * A side-effect is the collection of the summary.
   */
  uidRequest(obsidianLink: string, requestType: UidRequestType) {
    //TODO: need to collect unlinked nodes + their obsidian name to create them later

    if (requestType === UidRequestType.FOLDER) {
      return this.handleFolder();
    }

    const uidData = this.uidMap.get(obsidianLink);
    if (!uidData) {
      return this.setInitialUid(obsidianLink, requestType);
    }

    //at the end every uiData that has been only accessed from content (so inside the markdown file)
    //has no matching file node and is therefore unlinked
    if (uidData.type === UidRequestType.CONTENT) {
      uidData.type = requestType;
    }

    return uidData.uid;
  }

  private handleFolder() {
    this.incrementSummary();
    //folders get new uids always because they cant be linked
    return this.idGenerator();
  }

  private setInitialUid(obsidianLink: string, requestType: UidRequestType) {
    this.incrementSummary();
    const uid = this.idGenerator();
    this.uidMap.set(obsidianLink, { uid, obsidianLink, type: requestType });
    return uid;
  }

  private incrementSummary() {
    this.summary.totalNodes++;
    this.summary.leafNodes++;
  }

  getUnlinkedNodes() {
    const unlinkedNodes = [];
    for (const node of this.uidMap.values()) {
      if (node.type === UidRequestType.CONTENT) {
        unlinkedNodes.push(node);
      }
    }

    return unlinkedNodes;
  }
}
