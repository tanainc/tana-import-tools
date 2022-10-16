import { parse } from 'csv-parse/sync';
import { TanaIntermediateNode } from '../../types/types';
import { idgenerator } from '../../utils/utils';
import { fixPageLinks, normalizeNodes } from './nodeUtils';

const parseFileContents = (fileContent: string): Record<string, string>[] => {
  // Looks like notion exporter inserts a Zero Width No-Break Space character at the start of the file.
  return parse(fileContent.replace(/[\u200B-\u200D\uFEFF]/g, ''), {
    columns: true,
    skip_empty_lines: true,
    encoding: 'utf8',
  });
};

const createChildrenForRoot = (parsedContent: Record<string, string>): TanaIntermediateNode[] | undefined => {
  const keys = Object.keys(parsedContent);
  const fields = keys.map((key) => {
    const newField = {
      uid: idgenerator(),
      name: key,
      createdAt: new Date().getTime(),
      editedAt: new Date().getTime(),
      type: 'field',
      todoState: undefined,
    };

    const fieldChildren = [
      {
        uid: idgenerator(),
        name: parsedContent[key],
        createdAt: new Date().getTime(),
        editedAt: new Date().getTime(),
        type: 'node',
        todoState: undefined,
      },
    ];

    return { ...newField, children: fieldChildren };
  }) as TanaIntermediateNode[];

  return fields;
};

const createRootNode = (parsedContent: Record<string, string>): TanaIntermediateNode => {
  const newNode = {
    uid: idgenerator(),
    name: parsedContent['Name'],
    createdAt: new Date().getTime(),
    editedAt: new Date().getTime(),
    type: 'node',
    todoState: undefined,
  } as const;

  const children = createChildrenForRoot(parsedContent);
  return { ...newNode, children };
};

const createRootLevelNodes = (parsedContent: Record<string, string>[]) => {
  return parsedContent.map(createRootNode);
};

export const csvToTana = (fileContent: string) => {
  const content = parseFileContents(fileContent);
  const nodesWithBrokenLinks = createRootLevelNodes(content);
  return fixPageLinks(normalizeNodes(nodesWithBrokenLinks), nodesWithBrokenLinks);
};
