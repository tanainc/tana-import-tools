import { TanaIntermediateNode } from '../../types/types';
import { FrontmatterData } from './parseFrontmatter';
import { UidRequestType, VaultContext } from './VaultContext';

function frontMatterToFieldNode(data: FrontmatterData, today: number, context: VaultContext): TanaIntermediateNode {
  return { uid: context.randomUid(), name: data.values.join(', '), type: 'field', createdAt: today, editedAt: today };
}

export function createFileNode(
  displayName: string,
  today: number,
  context: VaultContext,
  frontmatter: FrontmatterData[],
): TanaIntermediateNode {
  let supertags: string[] | undefined;
  const fieldNodes: TanaIntermediateNode[] = [];

  frontmatter.forEach((data) => {
    if (data.key === 'tags') {
      supertags = data.values.map((val) => context.superTagUid(val));
    } else {
      fieldNodes.push(frontMatterToFieldNode(data, today, context));
    }
  });

  return {
    uid: context.uidRequest(displayName, UidRequestType.FILE),
    name: displayName,
    createdAt: today,
    editedAt: today,
    type: 'node',
    supertags,
    children: fieldNodes.length > 0 ? fieldNodes : undefined,
  };
}
