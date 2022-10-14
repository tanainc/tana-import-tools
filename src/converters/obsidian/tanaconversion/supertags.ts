import { TanaIntermediateSupertag } from '../../../types/types';
import { cleanUpTag } from '../markdown/tags';
import { IdGenerator } from './uids';

export type SuperTagTracker = Map<string, string>;

/**
 * Returns distinct matching super tag UIDs.
 */
export function superTagUidRequests(
  tags: string[],
  tracker: SuperTagTracker,
  idGenerator: IdGenerator,
  clean?: boolean,
) {
  return Array.from(new Set(tags.map((tag) => superTagUidRequest(tag, tracker, idGenerator, clean))));
}

function superTagUidRequest(tag: string, tracker: SuperTagTracker, idGenerator: IdGenerator, clean?: boolean) {
  let cleanTag = tag;
  if (clean) {
    cleanTag = cleanUpTag(tag);
  }

  let uid = tracker.get(cleanTag);
  if (uid === undefined) {
    uid = idGenerator();
    tracker.set(cleanTag, uid);
  }
  return uid;
}

export function createSuperTagObjects(tracker: SuperTagTracker): TanaIntermediateSupertag[] {
  return Array.from(tracker.entries()).map((entry) => ({ name: entry[0], uid: entry[1] }));
}
