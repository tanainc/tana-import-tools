import { TanaIntermediateNode } from '../../../types/types';
import { VaultContext } from '../context';
import { FrontmatterData } from '../markdown/frontmatter';
import { addAttribute } from './attributes';
import { untrackedUidRequest } from './uids';

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
