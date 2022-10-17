import { NodeType, TanaIntermediateNode } from '../../../types/types';
import { HierarchyType, MarkdownNode } from '../hierarchy/markdownNodes';
import { VaultContext } from '../VaultContext';
import { superTagUidRequests } from '../tanafeatures/supertags';
import { untrackedUidRequest } from '../links/genericLinks';
import { removeTodo } from '../markdown/todo';
import { detectTags } from '../markdown/tags';
import { handleImages } from '../tanafeatures/imageNodes';
import { postProcessCodeBlock } from '../hierarchy/codeblocks';
import { requestUidForContentNode, requestUidsForAllLinks } from '../links/internalLinks';
import { keyValToFieldNode } from '../tanafeatures/fields';
import { isSoloDataViewAttribute } from '../hierarchy/dataviewattributes';

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
  obsidianNode: MarkdownNode,
  tanaNode: TanaIntermediateNode,
  today: number,
  context: VaultContext,
) {
  //we are checking again here, because the other detection only detects free-flowing attributes (so not in bullets)
  if (obsidianNode.type === HierarchyType.DATAVIEWATTRIBUTE || isSoloDataViewAttribute(tanaNode.name)) {
    const splitName = tanaNode.name.split('::');
    return keyValToFieldNode(splitName[0], [splitName[1].trim()], today, context, tanaNode.uid);
  }

  return;
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

  const [uid, content] = requestUidForContentNode(fileName, filePath, obsidianNode.content, context);
  const tanaNode: TanaIntermediateNode = {
    uid,
    name: content,
    createdAt: today,
    editedAt: today,
    type: 'node' as NodeType,
  };

  const [updatedContent, todoState] = removeTodo(content, obsidianNode) ?? [content, undefined];
  tanaNode.name = updatedContent;
  tanaNode.todoState = todoState;

  //LogSeq specific
  tanaNode.name = tanaNode.name.replace('collapsed:: true', '').replace(/^#+ /, '').trim();

  // tags are kept inline but added as separate supertags too
  // in obsidian tags are really tags so should be kept that way, but might be used inline, so should'nt be removed
  const tags = detectTags(tanaNode.name);
  if (tags) {
    //we can remove the last tag without losing meaning because it will show up as a super tag anyways
    const lastTag = tags[tags.length - 1];
    if (tanaNode.name.endsWith(lastTag)) {
      tanaNode.name = tanaNode.name.slice(0, -lastTag.length);
    }

    tanaNode.supertags = superTagUidRequests(tags, context.superTagTracker, context.idGenerator, true);
  }

  const foundUIDs = requestUidsForAllLinks(tanaNode.name, context);

  if (foundUIDs.length > 0) {
    //using Set to filter out links that appear multiple times
    const refSet = new Set<string>();
    if (!tanaNode.refs) {
      tanaNode.refs = [];
    }
    for (const [link, foundUid, result] of foundUIDs) {
      refSet.add(foundUid);
      tanaNode.name = tanaNode.name.replaceAll('[[' + link + ']]', result);
    }
    tanaNode.refs.push(...Array.from(refSet.values()));
  }

  handleImages(tanaNode, today, context);

  const dataviewAttributeNode = convertDataViewAttribute(obsidianNode, tanaNode, today, context);

  return dataviewAttributeNode ?? tanaNode;
}
