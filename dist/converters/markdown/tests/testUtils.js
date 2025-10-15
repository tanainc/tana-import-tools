import { MarkdownConverter } from '..';
import * as fs from 'fs';
import * as path from 'node:path';
function findNodeById(nodes, id) {
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
function findNodeByName(nodes, name) {
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
export function importMarkdownDir(dir, fileToImageMap) {
    const file = new MarkdownConverter(fs, path, fileToImageMap).convertDirectory(`./src/converters/markdown/tests/fixtures/${dir}`);
    if (!file) {
        throw new Error('No file produced from markdown dir');
    }
    return [
        file,
        (id) => (id ? findNodeById(file.nodes, id) : undefined),
        (name) => (name ? findNodeByName(file.nodes, name) : undefined),
    ];
}
