import { TanaIntermediateNode } from '../../../types/types';
import { HierarchyType } from '../hierarchy/markdownNodes';
import { VaultContext } from '../VaultContext';
import { superTagUidRequests } from './supertags';
import { removeTodo } from '../markdown/todo';
import { detectTags, removeTagsFromEnd } from '../markdown/tags';
import { handleImages } from './imageNodes';
import { requestUidForContentNode, setUidsInNodeContent } from '../links/internalLinks';

export function postProcessContentNode(
  fileName: string,
  filePath: string,
  today: number,
  tanaNode: Omit<TanaIntermediateNode, 'uid'> & { uid?: string },
  context: VaultContext,
  hierarchyType?: HierarchyType,
) {
  const [updatedContent, todoState] = removeTodo(tanaNode.name, hierarchyType) ?? [tanaNode.name, undefined];
  tanaNode.name = updatedContent;
  tanaNode.todoState = todoState;

  const [uid, content] = requestUidForContentNode(fileName, filePath, tanaNode.name, context);
  tanaNode.uid = uid;
  tanaNode.name = content;

  //LogSeq specific
  tanaNode.name = tanaNode.name.replace('collapsed:: true', '').replace(/^#+ /, '').trim();

  // tags are kept inline but added as separate supertags too
  // in obsidian tags are really tags so should be kept that way, but might be used inline, so should'nt be removed
  const tags = detectTags(tanaNode.name);
  if (tags) {
    //we can remove the last tags without losing meaning because they will show up as super tags anyways
    tanaNode.name = removeTagsFromEnd(tanaNode.name, tags);
    tanaNode.supertags = superTagUidRequests(tags, context.superTagTracker, context.idGenerator, true);
  }

  setUidsInNodeContent(tanaNode as TanaIntermediateNode, context);

  handleImages(tanaNode as TanaIntermediateNode, today, context);

  return tanaNode as TanaIntermediateNode;
}
