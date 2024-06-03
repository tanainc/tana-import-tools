import * as fs from 'fs';
import { expect } from 'vitest';
import { fail } from 'assert';
import { TanaIntermediateNode, TanaIntermediateFile } from '../types/types.js';
import { IConverter } from '../converters/IConverter.js';

export type IdLookupHelper = (id: string | undefined) => TanaIntermediateNode | undefined;

export type NameLookupHelper = (name: string | undefined) => TanaIntermediateNode | undefined;

export function importFileAndGetHelpers(
  importer: IConverter,
  fileToLoad: string,
): [TanaIntermediateFile, IdLookupHelper, NameLookupHelper] {
  const content = fs.readFileSync(`${fileToLoad}`, 'utf8');

  const file = importer.convert(content);
  if (!file) {
    throw new Error('File is empty');
  }

  return [
    file,
    (id: string | undefined) => {
      if (!id) {
        return undefined;
      }
      const match = findNodeById(file.nodes, id);

      return match;
    },
    (name: string | undefined) => {
      if (!name) {
        return undefined;
      }
      return findNodeByName(file.nodes, name);
    },
  ];
}

export function expectField(
  id: string | undefined,
  title: string,
  values: (string | TanaIntermediateNode)[],
  f: IdLookupHelper,
) {
  const field = f(id);
  if (!field) {
    throw new Error(`Field ${id} not found`);
  }
  expect(field?.type).toBe('field');
  expect(field?.name).toBe(title);

  if (!field?.children) {
    fail('No children found');
  }

  for (let i = 0; i < values.length; i++) {
    if (typeof values[i] === 'string') {
      expect(field?.children[i].name).toBe(values[i]);
    } else {
      expect(field?.children[i].name).toBe(`[[${(values[i] as TanaIntermediateNode).uid}]]`);
    }
  }
}

export function expectImage(id: string | undefined, url: string, f: IdLookupHelper) {
  const field = f(id);
  if (!field) {
    throw new Error(`Field ${id} not found`);
  }

  expect(field?.name).toBe('image');
  expect(field?.type).toBe('image');
  expect(field?.mediaUrl).toBe(url);
}

function findNodeById(nodes: TanaIntermediateNode[], id: string): TanaIntermediateNode | undefined {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.uid === id) {
      return node;
    }

    const childNodeMatch = findNodeById(node.children || [], id);
    if (childNodeMatch) {
      return childNodeMatch;
    }
  }
}

function findNodeByName(nodes: TanaIntermediateNode[], name: string): TanaIntermediateNode | undefined {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.name === name) {
      return node;
    }

    const childNodeMatch = findNodeByName(node.children || [], name);
    if (childNodeMatch) {
      return childNodeMatch;
    }
  }
}
