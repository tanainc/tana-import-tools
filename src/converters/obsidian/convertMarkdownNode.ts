import { NodeType, TanaIntermediateNode } from '../../types/types';
import { getBracketLinks } from '../../utils/utils';
import { extractImageLinks } from './extractImageLinks';
import { MarkdownNode } from './extractMarkdownNodes';
import { UidRequestType, VaultContext } from './VaultContext';

// eslint is just wrong here
// eslint-disable-next-line no-useless-escape
const tagRegex = /(?:\s|^)(#([^\[\]]+?))(?:(?=\s)|$)/g;

export function convertMarkdownNode(
  fileName: string,
  obsidianNode: MarkdownNode,
  today: number,
  vaultContext: VaultContext,
): TanaIntermediateNode {
  const [uid, content] = vaultContext.contentUid(fileName, obsidianNode.content);
  const tanaNode: TanaIntermediateNode = {
    uid,
    name: content,
    createdAt: today,
    editedAt: today,
    type: 'node' as NodeType,
  };

  //LogSeq specific
  tanaNode.name = tanaNode.name.replace('collapsed:: true', '').replace(/^#+ /, '').trim();

  // tags are kept inline but added as separate supertags too
  // in obsidian tags are really tags so should be kept that way, but might be used inline, so shouldnt be remove
  const tags = tanaNode.name.match(tagRegex);
  if (tags) {
    const supertags = new Set(tags.map((tag) => vaultContext.superTagUid(tag.trim().slice(1))));

    //we can remove the last tag without losing meaning because it will show up as a super tag anyways
    const lastTag = tags[tags.length - 1];
    if (tanaNode.name.endsWith(lastTag)) {
      tanaNode.name = tanaNode.name.slice(0, -lastTag.length);
    }

    tanaNode.supertags = Array.from(supertags);
  }

  const foundUids = getBracketLinks(tanaNode.name, true).map((bracketLink) => {
    //handling aliases
    const aliasArr = bracketLink.split('|');
    const link = aliasArr[0];
    const alias = aliasArr[1];
    const foundUid = vaultContext.uidRequest(link, UidRequestType.CONTENT);
    const result =
      alias !== undefined && alias.trim() !== ''
        ? '[' + alias.trim() + ']([[' + foundUid + ']])'
        : '[[' + foundUid + ']]';

    return [bracketLink, foundUid, result];
  });

  if (foundUids.length > 0) {
    //using Set to filter out links that appear multiple times
    const refSet = new Set<string>();
    if (!tanaNode.refs) {
      tanaNode.refs = [];
    }
    for (const [link, foundUid, result] of foundUids) {
      refSet.add(foundUid);
      tanaNode.name = tanaNode.name.replaceAll('[[' + link + ']]', result);
    }
    tanaNode.refs.push(...Array.from(refSet.values()));
  }

  handleImages(tanaNode, today, vaultContext);

  return tanaNode;
}

function handleImages(tanaNode: TanaIntermediateNode, today: number, vaultContext: VaultContext) {
  const imageData = extractImageLinks(tanaNode.name);
  if (imageData.length === 0) {
    return;
  }
  if (imageData.length === 1) {
    const image = imageData[0];
    tanaNode.type = 'image';
    tanaNode.mediaUrl = image[1].trim();
    tanaNode.name = tanaNode.name.replace(image[3], image[0].trim());
    return;
  }

  //more than one image means we add them as child nodes
  const childImageNodes: TanaIntermediateNode[] = [];

  imageData.forEach((image) => {
    const altText = image[0];
    const url = image[1];
    //filter out duplicate image uses
    if (childImageNodes.every((node) => altText.trim() !== node.name || url.trim() !== node.mediaUrl)) {
      const oldLink = image[3];
      const uid = vaultContext.randomUid();
      tanaNode.name = tanaNode.name.replaceAll(oldLink, '[[' + uid + ']]');
      childImageNodes.push({
        uid,
        name: altText.trim(),
        createdAt: today,
        editedAt: today,
        type: 'image' as NodeType,
        mediaUrl: url.trim(),
      });
    }
  });

  tanaNode.children = [...(tanaNode.children ?? []), ...childImageNodes];
}
