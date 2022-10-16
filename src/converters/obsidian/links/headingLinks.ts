import { createTree } from '../utils/createTree';
import { traverseTreeDepthFirst } from '../utils/traverseTreeDepthFirst';
import { incrementSummary, VaultContext } from '../VaultContext';
import { FileDescMap } from './FileDescMap';

//children are sorted like in file, important to detect valid heading links
export type HeadingNode = { uid: string; content: string; children?: HeadingNode[] };

export type HeadingData = { uid: string; content: string; level: number };

export interface HeadingUidData {
  uid: string;
  link: string[]; //without the fileName
}

export type HeadingTracker = FileDescMap<HeadingData[]>;
/**
 * <unchangedInlineLink, HeadingUidData[]>
 */
export type HeadingDummyUidTracker = Map<string, HeadingUidData[]>;

/**
 * A heading link is [[fileName#heading...]]
 *
 * File name might be file path.
 */
export function headingLinkUidRequestForUsing(cleanLink: string[], context: VaultContext) {
  const unchangedLink = cleanLink[0];
  const fileHeadingData = context.dummyHeadingLinkTracker.get(unchangedLink) ?? [];
  context.dummyHeadingLinkTracker.set(unchangedLink, fileHeadingData);
  //these "UIDs" are replaced and counted later
  //but for the tests it needs to be understood that the id generator is called more times than are valid ids in the end
  const uid = '!' + context.idGenerator() + '!';
  // const uid = context.idGenerator();
  fileHeadingData.push({ uid, link: cleanLink.slice(1) });
  return uid;
}

/**
 * Matches the dummy heading UIDs to the ones detected after we finished parsing the vault.
 * Returns the mapping and the dummy UIDs that could not be mapped.
 */
export function matchHeadingLinks(
  dummyHeadingLinks: HeadingDummyUidTracker,
  tracker: HeadingTracker,
): [{ old: string; new: string }[], HeadingUidData[]] {
  const missingHeadingLinks = [];
  const validHeadingLinks = [];
  for (const [unchangedInlineLink, dummyHeadingUidData] of dummyHeadingLinks.entries()) {
    const matchingFileDesc = tracker.findMatchingFile(unchangedInlineLink);
    const potentiallyMatchingNodes = matchingFileDesc ? tracker.get(matchingFileDesc) : null;
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

      for (const dummyData of dummyHeadingUidData) {
        const matchingHeadingNode = traverseTreeDepthFirst(headingTree, dummyData.link);
        if (matchingHeadingNode) {
          validHeadingLinks.push({ old: dummyData.uid, new: matchingHeadingNode.uid });
        } else {
          missingHeadingLinks.push(dummyData);
        }
      }
    } else {
      missingHeadingLinks.push(...dummyHeadingUidData);
    }
  }
  return [validHeadingLinks, missingHeadingLinks];
}

/**
 * Post-processes the created TIF File. This is necessary to support heading links, because heading links have a ton of edge cases.
 * E.g. heading#heading2#heading5 is valid.
 *
 * We replace the dummy heading link UIDs with the actual ones from where we found the heading.
 */
export async function postProcessTIFFIle(filePath: string, context: VaultContext) {
  const [validHeadingLinks, missingHeadingLinks] = matchHeadingLinks(
    context.dummyHeadingLinkTracker,
    context.headingTracker,
  );
  missingHeadingLinks.forEach((headingLink) => {
    context.invalidLinks.push({ uid: headingLink.uid, link: headingLink.link.join('#') });
    incrementSummary(context.summary);
  });

  const tempPath = filePath + '_TEMP';
  context.fileSystemAdapter.initPostProcessingResultFile(filePath);
  const regExes = validHeadingLinks.map((link) => ({
    old: new RegExp(link.old, 'g'),
    new: link.new,
  }));
  for await (const line of context.fileSystemAdapter.chunkIter()) {
    let updatedLine = line;
    regExes.forEach((regEx) => {
      updatedLine = updatedLine.replace(regEx.old, regEx.new);
    });
    await context.fileSystemAdapter.appendToPostProcessingFile(tempPath, updatedLine);
  }
  context.fileSystemAdapter.endPostProcessingFile(tempPath);
  context.fileSystemAdapter.removeFile(filePath);
  context.fileSystemAdapter.renameFile(tempPath, filePath);
}
