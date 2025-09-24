import { LogseqConverter } from '..';
import { importFileAndGetHelpers } from '../../../testUtils/testUtils.js';
export function importLogseqFile(fileToLoad) {
    return importFileAndGetHelpers(new LogseqConverter(), `./src/converters/logseq/tests/fixtures/${fileToLoad}`);
}
export function getField(parentId, title, f) {
    var _a;
    const parent = f(parentId);
    if (!parent) {
        throw new Error(`Node ${parentId} not found`);
    }
    const field = (_a = parent.children) === null || _a === void 0 ? void 0 : _a.find((child) => (child.name = title));
    if (!field) {
        throw new Error(`Field with title ${title} not found`);
    }
    return field;
}
export function hasHeadingField(node) {
    if (!node || !node.children) {
        return false;
    }
    for (const child of node.children) {
        if (child.type === 'field' && child.name === 'heading') {
            return true;
        }
        if (hasHeadingField(child)) {
            return true;
        }
    }
    return false;
}
