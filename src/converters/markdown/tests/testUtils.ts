import { MarkdownConverter } from '..';
import { SourceGraph, SourceNode } from '../../sourceGraph.js';
import * as fs from 'fs';
import * as path from 'node:path';

export type IdLookupHelper = (_id: string | undefined) => SourceNode | undefined;
export type NameLookupHelper = (_name: string | undefined) => SourceNode | undefined;

function findNodeById(nodes: SourceNode[], id: string): SourceNode | undefined {
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

function findNodeByName(nodes: SourceNode[], name: string): SourceNode | undefined {
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

export function importMarkdownDir(
  dir: string,
  fileToImageMap?: Map<string, string>,
): [SourceGraph, IdLookupHelper, NameLookupHelper] {
  const file = new MarkdownConverter(fs, path, fileToImageMap).parseDirectory(
    `./src/converters/markdown/tests/fixtures/${dir}`,
  );
  if (!file) {
    throw new Error('No file produced from markdown dir');
  }
  return [
    file,
    (id: string | undefined) => (id ? findNodeById(file.roots, id) : undefined),
    (name: string | undefined) => (name ? findNodeByName(file.roots, name) : undefined),
  ];
}
