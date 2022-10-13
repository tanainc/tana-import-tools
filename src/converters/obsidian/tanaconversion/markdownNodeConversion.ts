import { NodeType, TanaIntermediateNode } from '../../../types/types';
import { getBracketLinks } from '../../../utils/utils';
import { MarkdownNode } from '../markdown/markdownNodes';
import { VaultContext } from '../context';
import { superTagUidRequests } from './supertags';
import { contentUidRequest, uidRequest, UidRequestType } from './uids';
import { removeTodo } from '../markdown/todo';
import { detectTags } from '../markdown/tags';
import { handleImages } from './imageNodes';

export function convertMarkdownNode(
  fileName: string,
  obsidianNode: MarkdownNode,
  today: number,
  context: VaultContext,
): TanaIntermediateNode {
  const [uid, content] = contentUidRequest(fileName, obsidianNode.content, context);
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

  const foundUIDs = getBracketLinks(tanaNode.name, true)
    .filter((bracketLink) => bracketLink.trim() !== '')
    .map((bracketLink) => {
      //handling aliases
      const aliasArr = bracketLink.split('|');
      const link = aliasArr[0];
      const alias = aliasArr[1];
      const foundUid = uidRequest(link, UidRequestType.CONTENT, context);
      const result =
        alias !== undefined && alias.trim() !== ''
          ? '[' + alias.trim() + ']([[' + foundUid + ']])'
          : '[[' + foundUid + ']]';

      return [bracketLink, foundUid, result];
    });

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

  return tanaNode;
}
