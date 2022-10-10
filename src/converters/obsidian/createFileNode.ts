import { TanaIntermediateNode } from '../../types/types';
import { FrontmatterData } from './parseFrontmatter';
import { UidRequestType, VaultContext } from './VaultContext';

export function createFileNode(
  displayName: string,
  today: number,
  context: VaultContext,
  frontmatter: FrontmatterData[],
): TanaIntermediateNode {
  const supertags: string[] = [];

  frontmatter.forEach((data) => {
    if (data.key === 'tags') {
      supertags.push(...data.values.map((val) => context.superTagUid(val)));
    }
  });

  return {
    uid: context.uidRequest(displayName, UidRequestType.FILE),
    name: displayName,
    createdAt: today,
    editedAt: today,
    type: 'node',
    supertags: supertags.length > 0 ? supertags : undefined,
  };
}
