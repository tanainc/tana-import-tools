import { NodeType, TanaIntermediateNode } from '../../../types/types';
import { HierarchyType, MarkdownNode } from '../hierarchy/markdownNodes';
import { VaultContext } from '../VaultContext';
import { untrackedUidRequest } from '../links/genericLinks';
import { postProcessCodeBlock } from '../hierarchy/codeblocks';
import { requestUidForContentNode } from '../links/internalLinks';
import { keyValToFieldNode } from '../tanafeatures/fields';
import { isSoloDataViewAttribute } from '../hierarchy/dataviewattributes';
import { postProcessContentNode } from '../tanafeatures/postprocessing';

function convertCodeBlock(obsidianNode: MarkdownNode, today: number, context: VaultContext) {
  const tanaNode: TanaIntermediateNode = {
    uid: untrackedUidRequest(context),
    name: postProcessCodeBlock(obsidianNode),
    createdAt: today,
    editedAt: today,
    codeLanguage: obsidianNode.codeLanguage,
    type: 'codeblock' as NodeType,
  };
  return tanaNode;
}

function convertDataViewAttribute(
  fileName: string,
  filePath: string,
  obsidianNode: MarkdownNode,
  today: number,
  context: VaultContext,
) {
  //we are checking again here, because the other detection only detects free-flowing attributes (so not in bullets)
  if (obsidianNode.type === HierarchyType.DATAVIEWATTRIBUTE || isSoloDataViewAttribute(obsidianNode.content)) {
    const [uid, content] = requestUidForContentNode(fileName, filePath, obsidianNode.content, context);
    const splitName = content.split('::');
    //empty data view nodes
    //TODO: not sure how that happens?
    if (splitName[1] === undefined) {
      console.log(obsidianNode.content, content, splitName);
    }
    return keyValToFieldNode(fileName, filePath, splitName[0], [splitName[1].trim()], today, context, uid);
  }
}

export function convertMarkdownNode(
  fileName: string,
  filePath: string,
  obsidianNode: MarkdownNode,
  today: number,
  context: VaultContext,
): TanaIntermediateNode {
  if (obsidianNode.type === HierarchyType.CODEBLOCK) {
    return convertCodeBlock(obsidianNode, today, context);
  }

  const dataviewNode = convertDataViewAttribute(fileName, filePath, obsidianNode, today, context);
  if (dataviewNode) {
    return dataviewNode;
  }

  return postProcessContentNode(
    fileName,
    filePath,
    today,
    {
      name: obsidianNode.content,
      createdAt: today,
      editedAt: today,
      type: 'node' as NodeType,
    },
    context,
    obsidianNode.type,
  );
}
