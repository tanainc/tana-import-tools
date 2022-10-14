import { TanaIntermediateAttribute, TanaIntermediateNode } from '../../../types/types';
import { VaultContext } from '../VaultContext';
import { FrontmatterData } from '../markdown/frontmatter';
import { untrackedUidRequest } from '../links/genericLinks';

export function frontMatterToFieldNode(
  data: FrontmatterData,
  today: number,
  context: VaultContext,
): TanaIntermediateNode {
  let children: TanaIntermediateNode[] | undefined;

  if (data.values && data.values.length > 0) {
    children = data.values.map((value) => ({
      uid: untrackedUidRequest(context),
      name: value,
      type: 'node',
      createdAt: today,
      editedAt: today,
    }));
  }
  addAttribute(data.key, context.attributes);
  context.summary.fields++;

  return {
    uid: untrackedUidRequest(context),
    name: data.key,
    type: 'field',
    createdAt: today,
    editedAt: today,
    children,
  };
}

function addAttribute(name: string, attributes: TanaIntermediateAttribute[]) {
  const foundAttr = attributes.filter((attr) => attr.name === name)[0];
  if (foundAttr) {
    foundAttr.count++;
  } else {
    attributes.push({ name, values: [], count: 1 });
  }
}
