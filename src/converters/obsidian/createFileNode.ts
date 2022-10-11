import { NodeType, TanaIntermediateNode } from '../../types/types';
import { FrontmatterData } from './parseFrontmatter';
import { UidRequestType, VaultContext } from './VaultContext';
import moment from 'moment';

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

  let nodeUid = context.uidRequest(displayName, UidRequestType.FILE);
  let nodeType: NodeType = 'node';
  const dateDisplayName = dateStringToDateUID(displayName, context.dailyNoteFormat);

  if (dateDisplayName.length > 0) {
    nodeUid = dateDisplayName;
    nodeType = 'date';
    displayName = dateDisplayName;
  }

  return {
    uid: nodeUid,
    name: displayName,
    createdAt: today,
    editedAt: today,
    type: nodeType,
    supertags,
    children: fieldNodes.length > 0 ? fieldNodes : undefined,
  };
}

function dateStringToDateUID(displayName: string, dateFormat: string): string {
  let date = moment(displayName, dateFormat, true);
  if (date.isValid()) {
    return date.format('MM-DD-YYYY');
  }
  return '';
}
