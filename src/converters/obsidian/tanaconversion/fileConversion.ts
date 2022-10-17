import { convertMarkdownNode } from './nodeConversion';
import { createTree } from '../utils/createTree';
import { HierarchyType, MarkdownNode, extractMarkdownNodes, isMarkdownNodeChild } from '../hierarchy/markdownNodes';
import { extractFrontmatter, FrontmatterData } from '../markdown/frontmatter';
import { VaultContext } from '../VaultContext';
import moment from 'moment';
import { TanaIntermediateNode, NodeType } from '../../../types/types';
import { superTagUidRequests } from '../tanafeatures/supertags';
import { requestUidForFile } from '../links/internalLinks';
import { HeadingData } from '../links/headingLinks';
import { frontMatterToFieldNode } from '../tanafeatures/fields';

export function convertObsidianFile(
  fileName: string, //without ending
  filePath: string,
  fileContent: string,
  context: VaultContext,
  today: number = Date.now(),
) {
  const [frontmatterData, startIndex] = extractFrontmatter(fileContent) ?? [[], 0];

  let obsidianNodes = extractMarkdownNodes(fileContent, startIndex);
  let displayName = fileName;

  //LogSeq specific
  const name = obsidianNodes[0] && obsidianNodes[0].content.match(/^title::(.+)$/);
  if (name) {
    displayName = name[1];
    obsidianNodes = obsidianNodes.slice(1);
  }

  // common in Obsidian to repeat the filename in the first line, remove first line if so
  if (obsidianNodes[0] && obsidianNodes[0].content.replace(/^#+/, '').trim() === displayName.trim()) {
    obsidianNodes = obsidianNodes.slice(1);
  }

  const headingData: HeadingData[] = [];

  const fileNode = createFileNode(displayName, filePath, today, context, frontmatterData);

  createTree(
    fileNode,
    { type: HierarchyType.ROOT, level: -1 } as MarkdownNode,
    obsidianNodes,
    isMarkdownNodeChild,
    (markdownNode) => {
      return convertMarkdownNode(fileName, filePath, markdownNode, today, context);
    },
    (tanaNode, markdownNode) => {
      if (markdownNode.type === HierarchyType.HEADING) {
        headingData.push({ ...markdownNode, uid: tanaNode.uid });
      }
    },
  );

  //making GC a little easier
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obsidianNodes = null as any;

  context.headingTracker.pathMap.set(filePath, headingData);
  if (!context.headingTracker.nameMap.get(fileName)) {
    context.headingTracker.nameMap.set(fileName, headingData);
  }

  return fileNode;
}

function createFileNode(
  displayName: string,
  filePath: string,
  today: number,
  context: VaultContext,
  frontmatter: FrontmatterData[],
): TanaIntermediateNode {
  let supertags: string[] | undefined;
  const fieldNodes: TanaIntermediateNode[] = [];

  frontmatter.forEach((data) => {
    if (data.key === 'tags') {
      supertags = superTagUidRequests(data.values, context.superTagTracker, context.idGenerator);
    } else {
      fieldNodes.push(frontMatterToFieldNode(data, today, context));
    }
  });

  //we need this uid request even if its a date node, only this way will other links to it work
  //TODO: evaluate if it might not need to set dateDisplayName as uid?
  let nodeUid = requestUidForFile(displayName, filePath, context);
  let nodeType: NodeType = 'node';
  const dateDisplayName = dateStringToDateUID(displayName, context.dailyNoteFormat);

  if (dateDisplayName) {
    nodeUid = dateDisplayName;
    nodeType = 'date';
    displayName = dateDisplayName;
    context.summary.calendarNodes++;
  }

  return {
    uid: nodeUid,
    name: displayName,
    createdAt: today,
    editedAt: today,
    type: nodeType,
    supertags,
    children: fieldNodes.length > 0 ? fieldNodes : undefined,
  };
}

function dateStringToDateUID(displayName: string, dateFormat: string) {
  const date = moment(displayName, dateFormat, true);
  if (date.isValid()) {
    return date.format('MM-DD-YYYY');
  }
  return null;
}
