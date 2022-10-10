import { HeadingUidData } from './VaultContext';
import { traverseTreeDepthFirst } from './traverseTreeDepthFirst';
import { createTree } from './createTree';

//children are sorted like in file, important to detect valid heading links
export type HeadingNode = { uid: string; content: string; children?: HeadingNode[] };

export type HeadingData = { uid: string; content: string; level: number };

export type HeadingTracker = Map<string, HeadingData[]>;

export type HeadingLinks = Map<string, HeadingUidData[]>;

export function filterHeadingLinks(
  headingLinks: HeadingLinks,
  tracker: HeadingTracker,
): [{ old: string; new: string }[], HeadingUidData[]] {
  const missingHeadingLinks = [];
  const validHeadingLinks = [];
  for (const [fileName, headingUidData] of headingLinks.entries()) {
    const potentiallyMatchingNodes = tracker.get(fileName);
    if (potentiallyMatchingNodes) {
      //we use a dummy because the tree function needs one root node
      const dummySourceRoot: HeadingData = { uid: 'DUMMY', content: '', level: -1 };
      const dummyTargetRoot: HeadingNode = { uid: 'DUMMY', content: '' };
      createTree(
        dummyTargetRoot,
        dummySourceRoot,
        potentiallyMatchingNodes,
        (potentialParent, potentialChild) => potentialParent.level < potentialChild.level,
        (data) => ({ uid: data.uid, content: data.content, children: undefined }),
      );
      const headingTree = dummyTargetRoot.children ?? [];

      for (const data of headingUidData) {
        const matchingHeadingNode = traverseTreeDepthFirst(headingTree, data.link);
        if (matchingHeadingNode) {
          validHeadingLinks.push({ old: data.uid, new: matchingHeadingNode.uid });
        } else {
          missingHeadingLinks.push(data);
        }
      }
    } else {
      missingHeadingLinks.push(...headingUidData);
    }
  }
  return [validHeadingLinks, missingHeadingLinks];
}
