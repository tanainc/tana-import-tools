/**
 * - Each <note> is converted to a Tana node.
 * - The <content> of the <note> has items that are converted to Tana nodes.
 * - A <note> with a <title> that ends with a date like so " - MM/DD/YYYY" and <note-attribute>.<source>=daily.note is converted to a corresponding Tana calendar node.
 * - Images are base64 encoded in enex
 *
 * More details on <content> handling:
 * - Indented nodes (check padding-left styling) are converted to child nodes
 * - Bulleted lists (<ul>) are converted to Tana nodes with children
 * - Unsupported tana features like <hr>, comments etc. are ignored
 * - <table> are converted to tana nodes with viewType=table and the first row should have each column made into fields
 * - links to evernote://... are converted to Tana references if the target note exists
 * - code blocks have style --en-codeblock:true; and language is specified with --en-syntaxLanguage:[language];
 */
import { XMLParser } from 'fast-xml-parser';
import { parse as parseHtml, HTMLElement } from 'node-html-parser';
import { parse as parseDate, isValid as isValidDate } from 'date-fns';
import md5 from 'md5';
import { idgenerator } from '../../utils/utils.js';
import { convertDateToTanaDateStr } from '../common.js';
const DAILY_NOTE_TITLE_WITH_DATE = /\s+[-–—]\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const XML_OPTIONS = {
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: '#text',
    cdataTagName: '__cdata',
    trimValues: false,
};
const INLINE_DATE_FORMATS = ['MMMM d, yyyy', 'MMMM dd, yyyy'];
function base64ToBytes(str) {
    if (typeof Buffer === 'function') {
        return Uint8Array.from(Buffer.from(str, 'base64'));
    }
    if (typeof atob === 'function') {
        const binary = atob(str);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    throw new Error('No base64 decoder available in this environment.');
}
export class EvernoteConverter {
    constructor() {
        this.parser = new XMLParser(XML_OPTIONS);
        this.summary = {
            leafNodes: 0,
            topLevelNodes: 0,
            totalNodes: 0,
            calendarNodes: 0,
            fields: 0,
            brokenRefs: 0,
        };
        this.guidToUid = new Map();
        this.titleToUid = new Map();
        this.attrMap = new Map();
    }
    convert(fileContent) {
        const parsed = this.parser.parse(fileContent);
        if (!parsed || !parsed['en-export']) {
            return undefined;
        }
        const rawNotes = this.ensureArray(parsed['en-export'].note);
        if (!rawNotes.length) {
            return undefined;
        }
        const notes = rawNotes.map((raw) => this.normalizeNote(raw));
        const guidCandidates = this.collectEvernoteLinkGuids(rawNotes);
        for (const note of notes) {
            const existingUid = this.titleToUid.get(note.title);
            if (!existingUid) {
                this.titleToUid.set(note.title, note.uid);
            }
        }
        for (const [guid, anchors] of guidCandidates.entries()) {
            for (const note of notes) {
                if (!note.guid && anchors.has(note.title)) {
                    note.guid = guid;
                    note.uid = guid;
                    this.guidToUid.set(guid, note.uid);
                    this.titleToUid.set(note.title, note.uid);
                    break;
                }
            }
        }
        const rootNodes = [];
        for (const note of notes) {
            const node = this.convertNote(note);
            rootNodes.push(node);
        }
        this.computeSummary(rootNodes);
        const home = rootNodes.filter((node) => node.type !== 'date').map((node) => node.uid);
        const attributes = Array.from(this.attrMap.values());
        return {
            version: 'TanaIntermediateFile V0.1',
            summary: this.summary,
            nodes: rootNodes,
            homeNodeIds: home,
            attributes: attributes.length ? attributes : undefined,
        };
    }
    normalizeNote(raw) {
        var _a, _b, _c, _d, _e, _f;
        const title = ((_a = raw === null || raw === void 0 ? void 0 : raw.title) !== null && _a !== void 0 ? _a : '').toString();
        const createdAt = this.parseEvernoteTimestamp(raw === null || raw === void 0 ? void 0 : raw.created);
        const updatedAt = this.parseEvernoteTimestamp(raw === null || raw === void 0 ? void 0 : raw.updated);
        const tags = this.ensureArray(raw === null || raw === void 0 ? void 0 : raw.tag)
            .map((t) => { var _a; return (_a = t === null || t === void 0 ? void 0 : t.toString()) !== null && _a !== void 0 ? _a : ''; })
            .filter(Boolean);
        const source = (_c = (_b = raw === null || raw === void 0 ? void 0 : raw['note-attributes']) === null || _b === void 0 ? void 0 : _b.source) === null || _c === void 0 ? void 0 : _c.toString();
        const author = (_e = (_d = raw === null || raw === void 0 ? void 0 : raw['note-attributes']) === null || _d === void 0 ? void 0 : _d.author) === null || _e === void 0 ? void 0 : _e.toString();
        const reminderTime = this.parseEvernoteTimestamp((_f = raw === null || raw === void 0 ? void 0 : raw['note-attributes']) === null || _f === void 0 ? void 0 : _f['reminder-time']);
        const content = this.extractContent(raw === null || raw === void 0 ? void 0 : raw.content);
        const resources = this.extractResources(this.ensureArray(raw === null || raw === void 0 ? void 0 : raw.resource));
        const tasks = this.extractTasks(this.ensureArray(raw === null || raw === void 0 ? void 0 : raw.task));
        return {
            uid: idgenerator(),
            title,
            createdAt,
            updatedAt,
            tags,
            source,
            author,
            reminderTime: Number.isNaN(reminderTime) ? undefined : reminderTime,
            content,
            resources,
            tasks,
        };
    }
    convertNote(note) {
        var _a, _b, _c;
        const node = {
            uid: note.uid,
            name: note.title,
            createdAt: note.createdAt,
            editedAt: note.updatedAt,
            type: 'node',
            children: [],
        };
        if (note.tags.length) {
            node.supertags = [...note.tags];
        }
        const calendarDate = this.tryParseDailyNoteDate(note.title, note.source);
        if (calendarDate) {
            const tanaDate = convertDateToTanaDateStr(calendarDate);
            node.name = tanaDate;
            node.type = 'date';
            this.summary.calendarNodes += 1;
        }
        if (note.author) {
            this.addField(node, 'Author', note.author, note.createdAt, note.updatedAt);
        }
        if (note.reminderTime) {
            const reminderDateStr = this.formatUtcTimestamp(note.reminderTime);
            if (reminderDateStr) {
                this.addField(node, 'Reminder', `[[${reminderDateStr}]]`, note.createdAt, note.updatedAt);
            }
        }
        const taskGroupTargets = new Map();
        const noteLevelTargets = new Map();
        this.convertContent(note, node, taskGroupTargets, noteLevelTargets);
        if (note.tasks.length) {
            const ungroupedTaskNodes = [];
            for (const task of note.tasks) {
                const taskNode = this.createNode(task.title, 'node', note.createdAt, note.updatedAt);
                taskNode.todoState = task.status === 'completed' || task.status === 'done' ? 'done' : 'todo';
                if (task.dueDate) {
                    const due = this.formatUtcTimestamp(task.dueDate);
                    if (due) {
                        this.addField(taskNode, 'Due date', `[[${due}]]`, note.createdAt, note.updatedAt);
                    }
                }
                if (task.flagged) {
                    this.addField(taskNode, 'Flagged', 'true', note.createdAt, note.updatedAt);
                }
                const targetContainer = task.groupId ? taskGroupTargets.get(task.groupId) : undefined;
                if (targetContainer) {
                    targetContainer.children = (_a = targetContainer.children) !== null && _a !== void 0 ? _a : [];
                    targetContainer.children.push(taskNode);
                }
                else {
                    ungroupedTaskNodes.push(taskNode);
                }
            }
            if (ungroupedTaskNodes.length) {
                const tasksParent = this.createNode('Tasks', 'node', note.createdAt, note.updatedAt);
                for (const taskNode of ungroupedTaskNodes) {
                    tasksParent.children = (_b = tasksParent.children) !== null && _b !== void 0 ? _b : [];
                    tasksParent.children.push(taskNode);
                }
                node.children = (_c = node.children) !== null && _c !== void 0 ? _c : [];
                node.children.push(tasksParent);
            }
        }
        return node;
    }
    convertContent(note, parent, taskGroupTargets, noteLevelTargets) {
        const document = parseHtml(note.content, {
            comment: false,
        });
        const enNote = document.querySelector('en-note');
        if (!enNote) {
            return;
        }
        const stack = [{ indent: -1, node: parent }];
        let lastSectionNode = undefined;
        const registerNoteLevelId = (element, target) => {
            var _a;
            const style = (_a = element.getAttribute('style')) !== null && _a !== void 0 ? _a : '';
            const nodeLevelId = this.extractNodeLevelId(style);
            if (nodeLevelId) {
                noteLevelTargets.set(nodeLevelId, target);
            }
            const attributeCandidates = [
                element.getAttribute('id'),
                element.getAttribute('data-note-level-id'),
                element.getAttribute('note-level-id'),
                element.getAttribute('data-evernote-note-level-id'),
            ];
            for (const candidate of attributeCandidates) {
                if (candidate) {
                    noteLevelTargets.set(candidate, target);
                }
            }
        };
        const processChild = (child) => {
            var _a, _b, _c;
            if (child.nodeType === 3) {
                // Text nodes (nodeType 3) are handled via serializeInline; other nodeTypes include 1 for elements and 8 for comments.
                return;
            }
            if (!(child instanceof HTMLElement)) {
                return;
            }
            const tag = child.tagName.toLowerCase();
            if (tag === 'hr') {
                return;
            }
            if (tag === 'en-media') {
                const imageNode = this.convertImageElement(child, note);
                if (imageNode) {
                    const parentNode = stack[stack.length - 1].node;
                    parentNode.children = (_a = parentNode.children) !== null && _a !== void 0 ? _a : [];
                    parentNode.children.push(imageNode);
                }
                return;
            }
            if (tag === 'ul' || tag === 'ol') {
                const baseIndent = stack[stack.length - 1].indent + 1;
                const parentNode = stack[stack.length - 1].node;
                this.processList(child, parentNode, note, baseIndent);
                return;
            }
            const style = (_b = child.getAttribute('style')) !== null && _b !== void 0 ? _b : '';
            if (style.includes('--en-threads') || style.includes('--en-task-group') || style.includes('display:none')) {
                if (style.includes('--en-task-group')) {
                    const taskGroupId = this.extractTaskGroupId(style);
                    if (taskGroupId) {
                        const explicitTarget = noteLevelTargets.get(taskGroupId);
                        const fallbackTarget = lastSectionNode !== null && lastSectionNode !== void 0 ? lastSectionNode : stack[stack.length - 1].node;
                        if (explicitTarget) {
                            taskGroupTargets.set(taskGroupId, explicitTarget);
                        }
                        else if (fallbackTarget) {
                            taskGroupTargets.set(taskGroupId, fallbackTarget);
                        }
                    }
                }
                return;
            }
            const indentLevel = this.getIndentLevel(child);
            this.reconcileStackForIndent(stack, indentLevel);
            const parentNode = stack[stack.length - 1].node;
            const blockNode = this.convertBlockElement(child, note, parentNode);
            if (!blockNode) {
                return;
            }
            parentNode.children = (_c = parentNode.children) !== null && _c !== void 0 ? _c : [];
            parentNode.children.push(blockNode);
            registerNoteLevelId(child, blockNode);
            if (blockNode.flags && blockNode.flags.includes('section')) {
                lastSectionNode = blockNode;
            }
            if (!['codeblock', 'image', 'date'].includes(blockNode.type) && blockNode.viewType !== 'table') {
                stack.push({ indent: indentLevel, node: blockNode });
            }
        };
        enNote.childNodes.forEach(processChild);
    }
    convertBlockElement(element, note, parent) {
        var _a;
        const tag = element.tagName.toLowerCase();
        if (tag === 'table') {
            return this.convertTable(element, note, parent);
        }
        if (tag === 'br') {
            return undefined;
        }
        const { text, refs } = this.serializeInline(element, note);
        const content = text.trim();
        if (!content) {
            return undefined;
        }
        let nodeType = 'node';
        const style = (_a = element.getAttribute('style')) !== null && _a !== void 0 ? _a : '';
        const codeBlockFlag = /--en-codeblock\s*:\s*true/i.test(style);
        if (codeBlockFlag) {
            nodeType = 'codeblock';
        }
        // Check if the content is a standalone date
        const inlineDate = this.tryConvertInlineDate(content);
        let nodeName = content;
        if (inlineDate && refs.length === 0) {
            // If it's a date and has no other references, make it a date node with "[[date:YYYY-MM-DD]]" format
            nodeName = `[[date:${inlineDate}]]`;
        }
        const node = this.createNode(nodeName, nodeType, note.createdAt, note.updatedAt);
        if (nodeType === 'codeblock') {
            const langMatch = style.match(/--en-syntaxLanguage\s*:\s*([^;]+)/i);
            if (langMatch) {
                node.codeLanguage = langMatch[1];
            }
        }
        if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
            node.flags = ['section'];
        }
        if (refs.length) {
            node.refs = [...new Set(refs)];
        }
        return node;
    }
    convertTable(element, note, parent) {
        const rows = element.querySelectorAll('tr');
        if (!rows.length) {
            return undefined;
        }
        const firstRow = rows[0];
        const firstRowCells = this.collectCells(firstRow);
        const headers = firstRowCells.map((cell, idx) => cell || `Column ${idx + 1}`);
        const ensureHeaderLength = (length) => {
            for (let idx = headers.length; idx < length; idx++) {
                headers.push(`Column ${idx + 1}`);
            }
        };
        const tableName = Array.isArray(parent.flags) && parent.flags.includes('section') && typeof parent.name === 'string'
            ? parent.name
            : 'Table';
        const tableNode = this.createNode(tableName, 'node', note.createdAt, note.updatedAt);
        tableNode.viewType = 'table';
        tableNode.children = [];
        const dataStartIndex = 1;
        for (let i = dataStartIndex; i < rows.length; i++) {
            const row = rows[i];
            const cellValues = this.collectCells(row);
            if (!cellValues.length) {
                continue;
            }
            ensureHeaderLength(cellValues.length);
            const rowName = cellValues[0] || 'Row';
            const rowNode = this.createNode(rowName, 'node', note.createdAt, note.updatedAt);
            rowNode.children = [];
            headers.forEach((header, index) => {
                var _a;
                if (index === 0) {
                    return;
                }
                const value = (_a = cellValues[index]) !== null && _a !== void 0 ? _a : '';
                this.addField(rowNode, header, value, note.createdAt, note.updatedAt);
            });
            tableNode.children.push(rowNode);
        }
        return tableNode.children.length ? tableNode : undefined;
    }
    collectCells(row) {
        const cells = row.querySelectorAll('td,th');
        return cells.map((cell) => this.serializeInline(cell, undefined).text.trim());
    }
    processList(listElement, parent, note, indentLevel) {
        var _a;
        const items = listElement.querySelectorAll(':scope > li');
        for (const li of items) {
            const nestedLists = li.querySelectorAll(':scope > ul, :scope > ol');
            nestedLists.forEach((nested) => nested.remove());
            const { text, refs } = this.serializeInline(li, note);
            const content = text.trim();
            if (!content) {
                continue;
            }
            const listNode = this.createNode(content, 'node', note.createdAt, note.updatedAt);
            if (refs.length) {
                listNode.refs = [...new Set(refs)];
            }
            parent.children = (_a = parent.children) !== null && _a !== void 0 ? _a : [];
            parent.children.push(listNode);
            nestedLists.forEach((nested) => {
                this.processList(nested, listNode, note, indentLevel + 1);
            });
        }
    }
    convertImageElement(element, note) {
        const hash = element.getAttribute('hash');
        if (!hash) {
            return undefined;
        }
        const resource = note.resources.get(hash.toLowerCase());
        if (!resource) {
            this.summary.brokenRefs += 1;
            return undefined;
        }
        const imageNode = this.createNode(resource.fileName || 'image', 'image', note.createdAt, note.updatedAt);
        imageNode.mediaUrl = resource.dataUri;
        return imageNode;
    }
    serializeInline(node, note) {
        var _a, _b, _c;
        if (node.nodeType === 3) {
            const raw = (_a = node.rawText) === null || _a === void 0 ? void 0 : _a.replace(/\u00A0/g, ' ');
            return { text: raw !== null && raw !== void 0 ? raw : '', refs: [] };
        }
        if (!(node instanceof HTMLElement)) {
            return { text: '', refs: [] };
        }
        const tag = node.tagName.toLowerCase();
        if (tag === 'br') {
            return { text: '\n', refs: [] };
        }
        if (tag === 'en-media') {
            return { text: '', refs: [] };
        }
        if (tag === 'a') {
            const href = (_b = node.getAttribute('href')) !== null && _b !== void 0 ? _b : '';
            const inner = this.serializeChildren(node.childNodes, note);
            const title = inner.text.trim() || href;
            if (href.startsWith('evernote:///')) {
                const targetUid = this.resolveEvernoteLink(href, title);
                if (targetUid) {
                    return { text: `[${title}]([[${targetUid}]])`, refs: [targetUid] };
                }
                this.summary.brokenRefs += 1;
                return { text: title, refs: [] };
            }
            return { text: `<a href="${href}">${title}</a>`, refs: [] };
        }
        if (tag === 'strong' || tag === 'b') {
            const inner = this.serializeChildren(node.childNodes, note);
            return { text: `**${inner.text}**`, refs: inner.refs };
        }
        if (tag === 'em' || tag === 'i') {
            const inner = this.serializeChildren(node.childNodes, note);
            return { text: `__${inner.text}__`, refs: inner.refs };
        }
        if (tag === 'span') {
            const style = (_c = node.getAttribute('style')) !== null && _c !== void 0 ? _c : '';
            const inner = this.serializeChildren(node.childNodes, note);
            if (/--en-highlight/i.test(style)) {
                return { text: `^^${inner.text}^^`, refs: inner.refs };
            }
            return inner;
        }
        if (tag === 'code') {
            const inner = this.serializeChildren(node.childNodes, note);
            return { text: `\`${inner.text}\``, refs: inner.refs };
        }
        const result = this.serializeChildren(node.childNodes, note);
        // Don't convert dates in div/p tags here - let convertBlockElement handle them
        // so they can be created as proper date nodes
        return result;
    }
    serializeChildren(children, note) {
        let text = '';
        const refs = [];
        for (const child of children) {
            const chunk = this.serializeInline(child, note);
            text += chunk.text;
            refs.push(...chunk.refs);
        }
        return { text, refs };
    }
    resolveEvernoteLink(href, anchorText) {
        var _a;
        const guidMatch = href.match(/\/([0-9a-f-]+)\/?$/i);
        const guid = (_a = guidMatch === null || guidMatch === void 0 ? void 0 : guidMatch[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        if (guid) {
            const mapped = this.guidToUid.get(guid);
            if (mapped) {
                return mapped;
            }
        }
        const trimmedAnchor = anchorText.trim();
        if (trimmedAnchor) {
            return this.titleToUid.get(trimmedAnchor);
        }
        return undefined;
    }
    getIndentLevel(element) {
        var _a;
        const style = (_a = element.getAttribute('style')) !== null && _a !== void 0 ? _a : '';
        const match = style.match(/padding-left\s*:\s*(\d+)px/i);
        if (!match) {
            return 0;
        }
        const padding = parseInt(match[1], 10);
        return Number.isFinite(padding) ? Math.max(0, Math.round(padding / 40)) : 0;
    }
    reconcileStackForIndent(stack, indentLevel) {
        while (stack.length > 1 && stack[stack.length - 1].indent >= indentLevel) {
            stack.pop();
        }
    }
    addField(parent, fieldName, value, createdAt, editedAt) {
        var _a, _b;
        const fieldNode = this.createNode(fieldName, 'field', createdAt, editedAt);
        fieldNode.children = (_a = fieldNode.children) !== null && _a !== void 0 ? _a : [];
        // Check if value is a date reference like [[2025-10-02]]
        const dateRefMatch = value.match(/^\[\[(\d{4}-\d{2}-\d{2})\]\]$/);
        if (dateRefMatch) {
            const dateValue = dateRefMatch[1];
            const dateNode = this.createNode(dateValue, 'date', createdAt, editedAt);
            fieldNode.children.push(dateNode);
            // Record date values in attributes with [[date:YYYY-MM-DD]] format
            this.recordAttribute(fieldName, `[[date:${dateValue}]]`);
        }
        else {
            fieldNode.children.push(this.createNode(value, 'node', createdAt, editedAt));
            this.recordAttribute(fieldName, value);
        }
        parent.children = (_b = parent.children) !== null && _b !== void 0 ? _b : [];
        parent.children.push(fieldNode);
        this.summary.fields += 1;
    }
    recordAttribute(fieldName, rawValue) {
        var _a;
        const attribute = (_a = this.attrMap.get(fieldName)) !== null && _a !== void 0 ? _a : { name: fieldName, values: [], count: 0 };
        const trimmedValue = rawValue.trim();
        // Only add the value if it's not already in the array (deduplicate)
        if (!attribute.values.includes(trimmedValue)) {
            attribute.values.push(trimmedValue);
        }
        attribute.count += 1;
        this.attrMap.set(fieldName, attribute);
    }
    createNode(name, type, createdAt, editedAt) {
        return {
            uid: idgenerator(),
            name,
            createdAt,
            editedAt,
            type,
        };
    }
    extractResources(resources) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        const map = new Map();
        for (const resource of resources) {
            if (!(resource === null || resource === void 0 ? void 0 : resource.data)) {
                continue;
            }
            const dataRaw = (_f = (_d = (_b = (_a = resource.data) === null || _a === void 0 ? void 0 : _a['__cdata']) !== null && _b !== void 0 ? _b : (_c = resource.data) === null || _c === void 0 ? void 0 : _c['#text']) !== null && _d !== void 0 ? _d : (_e = resource.data) === null || _e === void 0 ? void 0 : _e.toString()) !== null && _f !== void 0 ? _f : '';
            const base64 = dataRaw.replace(/\s+/g, '');
            if (!base64) {
                continue;
            }
            const bytes = base64ToBytes(base64);
            let hash;
            if (typeof Buffer === 'function') {
                hash = md5(Buffer.from(bytes));
            }
            else {
                hash = md5(Array.from(bytes));
            }
            const mime = (_h = (_g = resource.mime) === null || _g === void 0 ? void 0 : _g.toString()) !== null && _h !== void 0 ? _h : 'application/octet-stream';
            const dataUri = `data:${mime};base64,${base64}`;
            const fileName = (_k = (_j = resource['resource-attributes']) === null || _j === void 0 ? void 0 : _j['file-name']) === null || _k === void 0 ? void 0 : _k.toString();
            const width = parseInt((_m = (_l = resource.width) === null || _l === void 0 ? void 0 : _l.toString()) !== null && _m !== void 0 ? _m : '', 10);
            const height = parseInt((_p = (_o = resource.height) === null || _o === void 0 ? void 0 : _o.toString()) !== null && _p !== void 0 ? _p : '', 10);
            map.set(hash.toLowerCase(), {
                hash,
                mime,
                dataUri,
                fileName,
                width: Number.isFinite(width) ? width : undefined,
                height: Number.isFinite(height) ? height : undefined,
            });
        }
        return map;
    }
    extractTasks(tasks) {
        var _a, _b, _c, _d;
        const result = [];
        for (const task of tasks) {
            if (!(task === null || task === void 0 ? void 0 : task.title)) {
                continue;
            }
            result.push({
                title: task.title.toString(),
                status: (_b = (_a = task.taskStatus) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : 'open',
                flagged: task.taskFlag === true || task.taskFlag === 'true',
                dueDate: this.parseEvernoteTimestamp(task.dueDate),
                timezone: (_c = task.timeZone) === null || _c === void 0 ? void 0 : _c.toString(),
                groupId: (_d = task.taskGroupNoteLevelID) === null || _d === void 0 ? void 0 : _d.toString(),
            });
        }
        return result;
    }
    collectEvernoteLinkGuids(rawNotes) {
        const guidToAnchors = new Map();
        for (const raw of rawNotes) {
            const content = this.extractContent(raw === null || raw === void 0 ? void 0 : raw.content);
            const document = parseHtml(content, { comment: false });
            const enNote = document.querySelector('en-note');
            if (!enNote) {
                continue;
            }
            const anchors = enNote.querySelectorAll('a');
            anchors.forEach((anchor) => {
                var _a, _b, _c, _d;
                const href = (_a = anchor.getAttribute('href')) !== null && _a !== void 0 ? _a : '';
                if (!href.startsWith('evernote:///')) {
                    return;
                }
                const guidMatch = href.match(/\/([0-9a-f-]+)\/?$/i);
                if (!guidMatch) {
                    return;
                }
                const guid = guidMatch[1].toLowerCase();
                const text = (_c = (_b = anchor.innerText) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : '';
                const set = (_d = guidToAnchors.get(guid)) !== null && _d !== void 0 ? _d : new Set();
                if (text) {
                    set.add(text);
                }
                guidToAnchors.set(guid, set);
            });
        }
        return guidToAnchors;
    }
    extractContent(content) {
        var _a, _b;
        if (!content) {
            return '<en-note />';
        }
        if (typeof content === 'string') {
            return content;
        }
        if (typeof content === 'object') {
            return (_b = (_a = content['__cdata']) !== null && _a !== void 0 ? _a : content['#text']) !== null && _b !== void 0 ? _b : '<en-note />';
        }
        return '<en-note />';
    }
    parseEvernoteTimestamp(value) {
        if (typeof value !== 'string') {
            return Number.NaN;
        }
        // Parse Evernote format: YYYYMMDDTHHmmssZ -> ISO: YYYY-MM-DDTHH:mm:ssZ
        const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
        if (!match) {
            return Number.NaN;
        }
        const [, year, month, day, hour, minute, second] = match;
        const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
        return Date.parse(isoString);
    }
    tryParseDailyNoteDate(title, source) {
        if (!source || source.toLowerCase() !== 'daily.note') {
            return undefined;
        }
        const match = title.trim().match(DAILY_NOTE_TITLE_WITH_DATE);
        if (!match) {
            return undefined;
        }
        const [, month, day, year] = match;
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        // Validate the date by checking if values round-trip correctly
        return date.getFullYear() === Number(year) &&
            date.getMonth() === Number(month) - 1 &&
            date.getDate() === Number(day)
            ? date
            : undefined;
    }
    tryConvertInlineDate(value) {
        for (const format of INLINE_DATE_FORMATS) {
            const parsed = parseDate(value, format, new Date());
            if (isValidDate(parsed)) {
                return convertDateToTanaDateStr(parsed);
            }
        }
        return undefined;
    }
    formatUtcTimestamp(timestamp) {
        if (!Number.isFinite(timestamp)) {
            return undefined;
        }
        const date = new Date(timestamp);
        return convertDateToTanaDateStr(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    }
    computeSummary(rootNodes) {
        let total = 0;
        let leaf = 0;
        const walk = (node) => {
            total += 1;
            if (!node.children || node.children.length === 0) {
                leaf += 1;
                return;
            }
            node.children.forEach(walk);
        };
        rootNodes.forEach(walk);
        this.summary.totalNodes = total;
        this.summary.leafNodes = leaf;
        this.summary.topLevelNodes = rootNodes.length;
    }
    ensureArray(value) {
        if (!value) {
            return [];
        }
        return Array.isArray(value) ? value : [value];
    }
    extractTaskGroupId(style) {
        return this.getStyleProperty(style, '--en-id');
    }
    extractNodeLevelId(style) {
        return this.getStyleProperty(style, '--en-nodeId');
    }
    getStyleProperty(style, property) {
        if (!style) {
            return undefined;
        }
        const segments = style.split(';');
        for (const segment of segments) {
            const [key, ...rest] = segment.split(':');
            if (!key || rest.length === 0) {
                continue;
            }
            if (key.trim().toLowerCase() === property.trim().toLowerCase()) {
                return rest.join(':').trim();
            }
        }
        return undefined;
    }
}
