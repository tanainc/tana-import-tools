import * as fs from 'fs';
import { expect } from 'vitest';
import { fail } from 'assert';
export function importFileAndGetHelpers(importer, fileToLoad) {
    const content = fs.readFileSync(`${fileToLoad}`, 'utf8');
    const file = importer.convert(content);
    if (!file) {
        throw new Error('File is empty');
    }
    return [
        file,
        (id) => {
            if (!id) {
                return undefined;
            }
            const match = findNodeById(file.nodes, id);
            return match;
        },
        (name) => {
            if (!name) {
                return undefined;
            }
            return findNodeByName(file.nodes, name);
        },
    ];
}
export function expectField(id, title, values, f) {
    const field = f(id);
    if (!field) {
        throw new Error(`Field ${id} not found`);
    }
    expect(field === null || field === void 0 ? void 0 : field.type).toBe('field');
    expect(field === null || field === void 0 ? void 0 : field.name).toBe(title);
    if (!(field === null || field === void 0 ? void 0 : field.children)) {
        fail('No children found');
    }
    for (let i = 0; i < values.length; i++) {
        if (typeof values[i] === 'string') {
            expect(field === null || field === void 0 ? void 0 : field.children[i].name).toBe(values[i]);
        }
        else {
            expect(field === null || field === void 0 ? void 0 : field.children[i].name).toBe(`[[${values[i].uid}]]`);
        }
    }
}
export function expectImage(id, url, f) {
    const field = f(id);
    if (!field) {
        throw new Error(`Field ${id} not found`);
    }
    expect(field === null || field === void 0 ? void 0 : field.name).toBe('image');
    expect(field === null || field === void 0 ? void 0 : field.type).toBe('image');
    expect(field === null || field === void 0 ? void 0 : field.mediaUrl).toBe(url);
}
function findNodeById(nodes, id) {
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
function findNodeByName(nodes, name) {
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
