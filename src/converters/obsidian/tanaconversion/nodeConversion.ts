import { NodeType, TanaIntermediateNode } from '../../../types/types';
import { getBracketLinks } from '../../../utils/utils';
import { HierarchyType, MarkdownNode } from '../hierarchy/markdownNodes';
import { VaultContext } from '../context';
import { superTagUidRequests } from './supertags';
import { UidRequestType } from './uids';
import { untrackedUidRequest } from './untrackedUidRequest';
import { removeTodo } from '../markdown/todo';
import { detectTags } from '../markdown/tags';
import { handleImages } from './imageNodes';
import { postProcessCodeBlock } from '../hierarchy/codeblocks';
import { removeBlockId } from '../markdown/blockIds';
import { blockLinkUidRequestForDefining, blockLinkUidRequestForUsing } from './blockLinks';
import { headingLinkUidRequest } from './headingLinks';
import { incrementSummary } from './summary';

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

export function convertMarkdownNode(
  fileName: string,
  obsidianNode: MarkdownNode,
  today: number,
  context: VaultContext,
): TanaIntermediateNode {
  if (obsidianNode.type === HierarchyType.CODEBLOCK) {
    return convertCodeBlock(obsidianNode, today, context);
  }

  const [uid, content] = requestUidForContentNode(fileName, obsidianNode.content, context);
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
      const foundUid = requestUidForLink(link, context);
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

export enum LinkType {
  DEFAULT,
  HEADING,
  BLOCK,
}

export function cleanUpLink(link: string) {
  //Obsidian ignores whitespace in many places, too many other edge cases to handle but this is the least we can do
  return link
    .split('#')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/**
 *
 * @param link the link split by "#" and cleaned.
 */
export function detectLinkType(link: string[]) {
  if (link.length === 2 && link[1].startsWith('^')) {
    return LinkType.BLOCK;
  }

  if (link.length > 1) {
    return LinkType.HEADING;
  }

  return LinkType.DEFAULT;
}

/**
 * We can not just take the obsidian link because we might already have created a node for that link
 * or a folder might have the same link as a file.
 *
 * This function should return the correct Uid.
 *
 * A side-effect is the collection of the summary.
 */
export function requestUidForLink(obsidianLink: string, context: VaultContext) {
  const cleanLink = cleanUpLink(obsidianLink);
  const linkType = detectLinkType(cleanLink);
  switch (linkType) {
    case LinkType.DEFAULT:
      return standardLinkUidRequest(cleanLink[0], context);
    case LinkType.BLOCK:
      return blockLinkUidRequestForUsing(cleanLink, context);
    case LinkType.HEADING:
      return headingLinkUidRequest(cleanLink, context);
    default:
      throw 'Invalid link type detected: ' + cleanLink;
  }
}

function standardLinkUidRequest(obsidianLink: string, context: VaultContext) {
  const uidData = context.defaultLinkTracker.get(obsidianLink);
  if (!uidData) {
    incrementSummary(context.summary);
    const uid = context.idGenerator();
    context.defaultLinkTracker.set(obsidianLink, { uid, obsidianLink, type: UidRequestType.CONTENT });
    return uid;
  }

  return uidData.uid;
}

/**
 * Removes Obsidian-generated block-UIDs if they exists, returns the valid uid and the cleaned content.
 * @returns [uid, cleanedContent]
 */
export function requestUidForContentNode(fileName: string, content: string, context: VaultContext) {
  const [cleanedContent, id] = removeBlockId(content);
  if (id) {
    //found the id, now define the UID
    return [blockLinkUidRequestForDefining([fileName, id], context), cleanedContent];
  } else {
    return [untrackedUidRequest(context), content];
  }
}
