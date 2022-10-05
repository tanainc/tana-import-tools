import { TanaIntermediateSummary } from '../..';

export class VaultContext {
  summary: TanaIntermediateSummary = {
    leafNodes: 0,
    topLevelNodes: 0,
    totalNodes: 0,
    calendarNodes: 0,
    fields: 0,
    brokenRefs: 0,
  };

  constructor() {}

  /**
   * We can not just take the obsidian link because we might already have created a node for that link.
   * This function should return the correct Uid.
   */
  getUid(obsidianLink: string) {
    return obsidianLink;
  }
}
