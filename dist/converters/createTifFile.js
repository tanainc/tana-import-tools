import { parse, HTMLElement, NodeType as HtmlNodeType } from 'node-html-parser';
import { idgenerator, markdownToHTML } from '../utils/utils.js';
const htmlFormats = {
    B: 'bold',
    STRONG: 'bold',
    I: 'italic',
    EM: 'italic',
    U: 'underline',
    S: 'strikethrough',
    DEL: 'strikethrough',
    MARK: 'highlight',
    CODE: 'code',
};
/** Writes resolved source content as declarations and explicit references. */
export function createTifFile(graph) {
    var _a;
    const sourceNodes = new Map();
    const childIds = new Set();
    const collect = (node) => {
        var _a;
        if (sourceNodes.has(node.uid)) {
            return;
        }
        sourceNodes.set(node.uid, node);
        for (const child of (_a = node.children) !== null && _a !== void 0 ? _a : []) {
            childIds.add(child.uid);
            collect(child);
        }
    };
    graph.roots.forEach(collect);
    const ids = new Map([...sourceNodes.keys()].map((uid) => [uid, idgenerator()]));
    const pureReference = (node) => {
        var _a, _b, _c, _d, _e;
        if (node.type !== 'node' ||
            ((_a = node.children) === null || _a === void 0 ? void 0 : _a.length) ||
            node.todoState !== undefined ||
            node.description ||
            ((_b = node.flags) === null || _b === void 0 ? void 0 : _b.length) ||
            ((_c = node.supertags) === null || _c === void 0 ? void 0 : _c.length)) {
            return undefined;
        }
        const match = (_d = node.name.match(/^\[\[([^\]]+)\]\]$/)) !== null && _d !== void 0 ? _d : node.name.match(/^\[([^\]]+)\]\(\[\[([^\]]+)\]\]\)$/);
        const target = (_e = match === null || match === void 0 ? void 0 : match[2]) !== null && _e !== void 0 ? _e : match === null || match === void 0 ? void 0 : match[1];
        return target && target !== node.uid && sourceNodes.has(target)
            ? { uid: target, alias: (match === null || match === void 0 ? void 0 : match[2]) ? match[1] : undefined }
            : undefined;
    };
    const aliases = new Map([...sourceNodes.values()].flatMap((node) => {
        const target = pureReference(node);
        return target ? [[node.uid, target]] : [];
    }));
    const targetId = (uid) => {
        const seen = new Set();
        let target = uid;
        while (aliases.has(target) && !seen.has(target)) {
            seen.add(target);
            const next = aliases.get(target);
            if (!next) {
                break;
            }
            target = next.uid;
        }
        if (seen.has(target)) {
            target = uid;
        }
        const id = ids.get(target);
        if (!id) {
            throw new Error(`Unresolved source reference: ${uid}`);
        }
        return id;
    };
    for (const uid of aliases.keys()) {
        if (targetId(uid) === ids.get(uid)) {
            aliases.delete(uid);
        }
    }
    const textParts = (text, formats, aliasesForName) => {
        var _a;
        if (formats === null || formats === void 0 ? void 0 : formats.includes('code')) {
            return [{ type: 'text', text, formats }];
        }
        const parts = [];
        const pattern = /(```[\s\S]*?```|`[^`]*`)|\[([^\]]+)\]\(\[\[([^\]]+)\]\]\)|\[\[([^\]]+)\]\]/gu;
        let offset = 0;
        for (const match of text.matchAll(pattern)) {
            if (match.index > offset) {
                parts.push({ type: 'text', text: text.slice(offset, match.index), formats });
            }
            if (match[1]) {
                parts.push({ type: 'text', text: match[1].replace(/^`+|`+$/gu, ''), formats: [...(formats !== null && formats !== void 0 ? formats : []), 'code'] });
                offset = match.index + match[0].length;
                continue;
            }
            const token = (_a = match[3]) !== null && _a !== void 0 ? _a : match[4];
            if (token.startsWith('date:')) {
                parts.push({ type: 'date', date: token.slice(5).trim() });
            }
            else if (sourceNodes.has(token)) {
                const nodeId = targetId(token);
                if (aliasesForName.has(nodeId) && aliasesForName.get(nodeId) !== match[2]) {
                    parts.push({ type: 'text', text: match[0], formats });
                }
                else {
                    parts.push({ type: 'node', nodeId });
                    aliasesForName.set(nodeId, match[2]);
                }
            }
            else {
                parts.push({ type: 'text', text: match[0], formats });
            }
            offset = match.index + match[0].length;
        }
        if (offset < text.length) {
            parts.push({ type: 'text', text: text.slice(offset), formats });
        }
        return parts;
    };
    const convertName = (html) => {
        const aliasesForName = new Map();
        const walk = (node, formats = []) => {
            if (node.nodeType === HtmlNodeType.TEXT_NODE) {
                if (!(formats === null || formats === void 0 ? void 0 : formats.includes('code'))) {
                    return node.rawText.split(/(```[\s\S]*?```|`[^`]*`)/gu).flatMap((text) => {
                        const enriched = text.startsWith('`') ? text : markdownToHTML(text);
                        return enriched === text
                            ? textParts(text, formats, aliasesForName)
                            : parse(enriched).childNodes.flatMap((child) => walk(child, formats));
                    });
                }
                return textParts(node.rawText, formats, aliasesForName);
            }
            if (!(node instanceof HTMLElement)) {
                return [];
            }
            if (node.tagName === 'BR') {
                return [{ type: 'text', text: '\n', formats }];
            }
            if (node.tagName === 'A') {
                const url = node.getAttribute('href');
                if (url && /^(https?:\/\/|mailto:)/iu.test(url)) {
                    return [{ type: 'link', url, text: node.textContent }];
                }
            }
            const format = htmlFormats[node.tagName];
            const next = format ? [...new Set([...formats, format])] : formats;
            return node.childNodes.flatMap((child) => walk(child, next));
        };
        return Object.assign({ nameParts: parse(html).childNodes.flatMap((node) => walk(node)) }, (aliasesForName.size
            ? {
                inlineNodes: Object.fromEntries([...aliasesForName].flatMap(([id, alias]) => alias === undefined ? [] : [[id, { isRef: true, id, alias }]])),
            }
            : {}));
    };
    const definitions = [];
    const fields = new Map();
    const fieldUid = (name) => {
        var _a;
        let definition = fields.get(name);
        if (!definition) {
            const source = (_a = graph.fields) === null || _a === void 0 ? void 0 : _a.find((field) => field.name === name);
            let dataType;
            if ((source === null || source === void 0 ? void 0 : source.dataType) === 'checkbox') {
                dataType = 'boolean';
            }
            else if ((source === null || source === void 0 ? void 0 : source.dataType) && source.dataType !== 'any') {
                dataType = source.dataType;
            }
            definition = Object.assign(Object.assign({ type: 'fieldDefinition', uid: idgenerator() }, convertName(name)), { dataType });
            fields.set(name, definition);
            definitions.push(definition);
        }
        return definition.uid;
    };
    const tags = new Map();
    const tagUid = (nameOrUid) => {
        var _a, _b;
        const source = (_a = graph.tags) === null || _a === void 0 ? void 0 : _a.find((tag) => tag.uid === nameOrUid);
        const name = (_b = source === null || source === void 0 ? void 0 : source.name) !== null && _b !== void 0 ? _b : nameOrUid;
        let tag = tags.get(name);
        if (!tag) {
            tag = Object.assign({ type: 'supertag', uid: idgenerator() }, convertName(name));
            tags.set(name, tag);
        }
        return tag.uid;
    };
    const declared = new Set();
    const convertChildren = (sources) => {
        const siblings = new Set();
        const declarations = new Set(sources.filter((source) => !aliases.has(source.uid)).map((source) => ids.get(source.uid)));
        return sources.map((source) => {
            const id = targetId(source.uid);
            const converted = convert(source, siblings.has(id) || (aliases.has(source.uid) && declarations.has(id)));
            if (converted.id) {
                siblings.add(converted.id);
            }
            return converted;
        });
    };
    const convert = (source, preserveWrapper = false) => {
        var _a, _b, _c;
        const target = aliases.get(source.uid);
        if (target && !preserveWrapper) {
            return Object.assign({ isRef: true, id: targetId(target.uid) }, (target.alias ? { alias: target.alias } : {}));
        }
        const id = ids.get(source.uid);
        if (!id) {
            throw new Error(`Source node is not registered: ${source.uid}`);
        }
        if (declared.has(source.uid)) {
            return { isRef: true, id };
        }
        declared.add(source.uid);
        const metadata = {
            id,
            description: source.description,
            isSection: ((_a = source.flags) === null || _a === void 0 ? void 0 : _a.includes('section')) || undefined,
            isDone: source.todoState === undefined ? undefined : source.todoState === 'done',
            tags: (_b = source.supertags) === null || _b === void 0 ? void 0 : _b.map((tag) => ({ uid: tagUid(tag) })),
        };
        if (source.type === 'field') {
            return {
                type: 'field',
                id,
                field: { uid: fieldUid(source.name) },
                values: convertChildren((_c = source.children) !== null && _c !== void 0 ? _c : []),
            };
        }
        const children = source.children ? convertChildren(source.children) : undefined;
        if (source.type === 'codeblock') {
            return Object.assign(Object.assign({}, metadata), { type: 'codeBlock', content: source.name, plainText: true, language: source.codeLanguage, children });
        }
        if (source.type === 'image' && source.mediaUrl) {
            return Object.assign(Object.assign(Object.assign(Object.assign({}, metadata), { type: 'visual', visualType: 'image', url: source.mediaUrl }), convertName(source.name)), { children });
        }
        return Object.assign(Object.assign(Object.assign({}, metadata), { type: 'node', children }), (source.type === 'date'
            ? { nameParts: [{ type: 'date', date: source.name }] }
            : convertName(source.name)));
    };
    const homeIds = new Set((_a = graph.homeIds) !== null && _a !== void 0 ? _a : []);
    const workspace = [];
    const library = [];
    for (const root of graph.roots) {
        if (childIds.has(root.uid)) {
            continue;
        }
        (homeIds.has(root.uid) ? workspace : library).push(root);
    }
    return {
        version: 'TanaIntermediateFile V2.1',
        contents: Object.assign(Object.assign({ workspace: { children: convertChildren(workspace) } }, (library.length ? { library: { children: convertChildren(library) } } : {})), (definitions.length || tags.size ? { schema: { children: [...definitions, ...tags.values()] } } : {})),
    };
}
