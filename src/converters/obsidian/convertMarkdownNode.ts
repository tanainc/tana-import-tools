import { NodeType, TanaIntermediateNode } from '../../types/types';
import { getBracketLinks } from '../../utils/utils';
import { extractImageLinks } from './extractImageLinks';
import { MarkdownNode } from './extractMarkdownNodes';
import { UidRequestType, VaultContext } from './VaultContext';

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

  tanaNode.name = tanaNode.name.replace('collapsed:: true', '').replace(/^#+ /, '').trim();

  // links with alias
  tanaNode.name = tanaNode.name.replace(/\[\[([^|]+)\|([^\]]+)\]\]/g, '[$1]([[$2]])');
  // tags, convert to links for now
  tanaNode.name = tanaNode.name.replace(/(?:\s|^)(#([^[]]+?))(?:(?=\s)|$)/g, ' #[[$2]]');

  const foundUids = getBracketLinks(tanaNode.name, true).map((link) => [
    link,
    vaultContext.uidRequest(link, UidRequestType.CONTENT),
  ]);

  if (foundUids.length > 0 && !tanaNode.refs) {
    tanaNode.refs = [];
  }

  for (const [link, linkUid] of foundUids) {
    tanaNode.refs?.push(linkUid);
    tanaNode.name = tanaNode.name.replaceAll('[[' + link + ']]', '[[' + linkUid + ']]');
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
