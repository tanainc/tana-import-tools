import { NodeType, TanaIntermediateAttribute, TanaIntermediateNode } from '../../../types/types';
import { VaultContext } from '../VaultContext';
import { FrontmatterData } from '../markdown/frontmatter';
import { untrackedUidRequest } from '../links/genericLinks';

export function keyValToFieldNode(
  key: string,
  values: string[],
  today: number,
  context: VaultContext,
  uid?: string,
  children?: TanaIntermediateNode[],
): TanaIntermediateNode {
  let childNodes = children;

  if (values && values.length > 0) {
    childNodes = children ?? [];
    childNodes?.push(
      ...values.map((value) => ({
        uid: untrackedUidRequest(context),
        name: value,
        type: 'node' as NodeType,
        createdAt: today,
        editedAt: today,
      })),
    );
  }
  addAttribute(key, context.attributes);
  context.summary.fields++;

  return {
    uid: uid ?? untrackedUidRequest(context),
    name: key,
    type: 'field',
    createdAt: today,
    editedAt: today,
    children: childNodes,
  };
}

export function frontMatterToFieldNode(
  data: FrontmatterData,
  today: number,
  context: VaultContext,
): TanaIntermediateNode {
  return keyValToFieldNode(data.key, data.values, today, context);
}

function addAttribute(name: string, attributes: TanaIntermediateAttribute[]) {
  const foundAttr = attributes.filter((attr) => attr.name === name)[0];
  if (foundAttr) {
    foundAttr.count++;
  } else {
    attributes.push({ name, values: [], count: 1 });
  }
}
