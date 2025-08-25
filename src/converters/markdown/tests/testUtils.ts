import { MarkdownConverter } from '..';
import { TanaIntermediateFile, TanaIntermediateNode } from '../../../types/types.js';
import * as fs from 'fs';

export type IdLookupHelper = (_id: string | undefined) => TanaIntermediateNode | undefined;
export type NameLookupHelper = (_name: string | undefined) => TanaIntermediateNode | undefined;

function findNodeById(nodes: TanaIntermediateNode[], id: string): TanaIntermediateNode | undefined {
  for (const n of nodes) {
    if (n.uid === id) {
      return n;
    }
    const c = findNodeById(n.children || [], id);
    if (c) {
      return c;
    }
  }
}

function findNodeByName(nodes: TanaIntermediateNode[], name: string): TanaIntermediateNode | undefined {
  for (const n of nodes) {
    if (n.name === name) {
      return n;
    }
    const c = findNodeByName(n.children || [], name);
    if (c) {
      return c;
    }
  }
}

export function importMarkdownDir(dir: string): [TanaIntermediateFile, IdLookupHelper, NameLookupHelper] {
  const file = new MarkdownConverter(fs).convertDirectory(`./src/converters/markdown/tests/fixtures/${dir}`);
  if (!file) {
    throw new Error('No file produced from markdown dir');
  }
  return [
    file,
    (id: string | undefined) => (id ? findNodeById(file.nodes, id) : undefined),
    (name: string | undefined) => (name ? findNodeByName(file.nodes, name) : undefined),
  ];
}
