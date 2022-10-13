import { TanaIntermediateNode, NodeType } from '../../../types/types';
import { VaultContext } from '../context';
import { extractImageLinks } from '../markdown/imageLinks';
import { untrackedUidRequest } from './uids';

export function handleImages(tanaNode: TanaIntermediateNode, today: number, context: VaultContext) {
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
      const uid = untrackedUidRequest(context);
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
