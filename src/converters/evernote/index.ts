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

import crypto from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { parse as parseHtml, HTMLElement, Node as HtmlNode, TextNode } from 'node-html-parser';
import { parse as parseDate, isValid as isValidDate } from 'date-fns';

import {
  NodeType,
  TanaIntermediateAttribute,
  TanaIntermediateFile,
  TanaIntermediateNode,
  TanaIntermediateSummary,
  ViewType,
} from '../../types/types.js';
import { idgenerator } from '../../utils/utils.js';
import { convertDateToTanaDateStr } from '../common.js';
import { IConverter } from '../IConverter.js';

const DAILY_NOTE_TITLE_WITH_DATE = /\s+[-–—]\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

type EvernoteResource = {
  hash: string;
  mime: string;
  dataUri: string;
  fileName?: string;
  width?: number;
  height?: number;
};

type EvernoteTask = {
  title: string;
  status: string;
  flagged: boolean;
  dueDate?: number;
  timezone?: string;
  groupId?: string;
};

type EvernoteNote = {
  uid: string;
  guid?: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  source?: string;
  author?: string;
  reminderTime?: number;
  content: string;
  resources: Map<string, EvernoteResource>;
  tasks: EvernoteTask[];
};

type InlineSerialization = {
  text: string;
  refs: string[];
};

type StackEntry = {
  indent: number;
  node: TanaIntermediateNode;
};

const XML_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '#text',
  cdataTagName: '__cdata',
  trimValues: false,
};

const INLINE_DATE_FORMATS = ['MMMM d, yyyy', 'MMMM dd, yyyy'];

export class EvernoteConverter implements IConverter {
  private parser = new XMLParser(XML_OPTIONS);

  private summary: TanaIntermediateSummary = {
    leafNodes: 0,
    topLevelNodes: 0,
    totalNodes: 0,
    calendarNodes: 0,
    fields: 0,
    brokenRefs: 0,
  };

  private guidToUid: Map<string, string> = new Map();
  private titleToUid: Map<string, string> = new Map();
  private attrMap: Map<string, TanaIntermediateAttribute> = new Map();

  convert(fileContent: string): TanaIntermediateFile | undefined {
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

    const rootNodes: TanaIntermediateNode[] = [];
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

  private normalizeNote(raw: any): EvernoteNote {
    const title = (raw?.title ?? '').toString();
    const createdAt = this.parseEvernoteTimestamp(raw?.created);
    const updatedAt = this.parseEvernoteTimestamp(raw?.updated);
    const tags = this.ensureArray(raw?.tag)
      .map((t) => t?.toString() ?? '')
      .filter(Boolean);
    const source = raw?.['note-attributes']?.source?.toString();
    const author = raw?.['note-attributes']?.author?.toString();
    const reminderTime = this.parseEvernoteTimestamp(raw?.['note-attributes']?.['reminder-time']);
    const content = this.extractContent(raw?.content);
    const resources = this.extractResources(this.ensureArray(raw?.resource));
    const tasks = this.extractTasks(this.ensureArray(raw?.task));

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

  private convertNote(note: EvernoteNote): TanaIntermediateNode {
    const node: TanaIntermediateNode = {
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

    const taskGroupTargets: Map<string, TanaIntermediateNode> = new Map();
    const noteLevelTargets: Map<string, TanaIntermediateNode> = new Map();
    this.convertContent(note, node, taskGroupTargets, noteLevelTargets);

    if (note.tasks.length) {
      const ungroupedTaskNodes: TanaIntermediateNode[] = [];
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
          targetContainer.children = targetContainer.children ?? [];
          targetContainer.children.push(taskNode);
        } else {
          ungroupedTaskNodes.push(taskNode);
        }
      }

      if (ungroupedTaskNodes.length) {
        const tasksParent = this.createNode('Tasks', 'node', note.createdAt, note.updatedAt);
        for (const taskNode of ungroupedTaskNodes) {
          tasksParent.children = tasksParent.children ?? [];
          tasksParent.children.push(taskNode);
        }
        node.children = node.children ?? [];
        node.children.push(tasksParent);
      }
    }

    return node;
  }

  private convertContent(
    note: EvernoteNote,
    parent: TanaIntermediateNode,
    taskGroupTargets: Map<string, TanaIntermediateNode>,
    noteLevelTargets: Map<string, TanaIntermediateNode>,
  ) {
    const document = parseHtml(note.content, {
      comment: false,
    });
    const enNote = document.querySelector('en-note');
    if (!enNote) {
      return;
    }

    const stack: StackEntry[] = [{ indent: -1, node: parent }];
    let lastSectionNode: TanaIntermediateNode | undefined = undefined;

    const registerNoteLevelId = (element: HTMLElement, target: TanaIntermediateNode) => {
      const style = element.getAttribute('style') ?? '';
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

    const processChild = (child: HtmlNode) => {
      if (child.nodeType === 3) {
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
          parentNode.children = parentNode.children ?? [];
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

      const style = child.getAttribute('style') ?? '';
      if (style.includes('--en-threads') || style.includes('--en-task-group') || style.includes('display:none')) {
        if (style.includes('--en-task-group')) {
          const taskGroupId = this.extractTaskGroupId(style);
          if (taskGroupId) {
            const explicitTarget = noteLevelTargets.get(taskGroupId);
            const fallbackTarget = lastSectionNode ?? stack[stack.length - 1].node;
            if (explicitTarget) {
              taskGroupTargets.set(taskGroupId, explicitTarget);
            } else if (fallbackTarget) {
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
      parentNode.children = parentNode.children ?? [];
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

  private convertBlockElement(
    element: HTMLElement,
    note: EvernoteNote,
    parent: TanaIntermediateNode,
  ): TanaIntermediateNode | undefined {
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

    let nodeType: NodeType = 'node';
    const style = element.getAttribute('style') ?? '';
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

  private convertTable(
    element: HTMLElement,
    note: EvernoteNote,
    parent: TanaIntermediateNode,
  ): TanaIntermediateNode | undefined {
    const rows = element.querySelectorAll('tr');
    if (!rows.length) {
      return undefined;
    }

    const firstRow = rows[0];
    const firstRowCells = this.collectCells(firstRow);
    const headers: string[] = firstRowCells.map((cell, idx) => cell || `Column ${idx + 1}`);

    const ensureHeaderLength = (length: number) => {
      for (let idx = headers.length; idx < length; idx++) {
        headers.push(`Column ${idx + 1}`);
      }
    };

    const tableName =
      Array.isArray(parent.flags) && parent.flags.includes('section') && typeof parent.name === 'string'
        ? parent.name
        : 'Table';

    const tableNode = this.createNode(tableName, 'node', note.createdAt, note.updatedAt);
    tableNode.viewType = 'table' as ViewType;
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
        if (index === 0) {
          return;
        }
        const value = cellValues[index] ?? '';
        this.addField(rowNode, header, value, note.createdAt, note.updatedAt);
      });

      tableNode.children.push(rowNode);
    }

    return tableNode.children.length ? tableNode : undefined;
  }

  private collectCells(row: HTMLElement): string[] {
    const cells = row.querySelectorAll('td,th');
    return cells.map((cell: HTMLElement) => this.serializeInline(cell, undefined).text.trim());
  }

  private processList(listElement: HTMLElement, parent: TanaIntermediateNode, note: EvernoteNote, indentLevel: number) {
    const items = listElement.querySelectorAll(':scope > li');
    for (const li of items) {
      const nestedLists = li.querySelectorAll(':scope > ul, :scope > ol');
      nestedLists.forEach((nested: HTMLElement) => nested.remove());

      const { text, refs } = this.serializeInline(li, note);
      const content = text.trim();
      if (!content) {
        continue;
      }

      const listNode = this.createNode(content, 'node', note.createdAt, note.updatedAt);
      if (refs.length) {
        listNode.refs = [...new Set(refs)];
      }

      parent.children = parent.children ?? [];
      parent.children.push(listNode);

      nestedLists.forEach((nested: HTMLElement) => {
        this.processList(nested, listNode, note, indentLevel + 1);
      });
    }
  }

  private convertImageElement(element: HTMLElement, note: EvernoteNote): TanaIntermediateNode | undefined {
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

  private serializeInline(node: HtmlNode, note: EvernoteNote | undefined): InlineSerialization {
    if (node.nodeType === 3) {
      const raw = (node as TextNode).rawText?.replace(/\u00A0/g, ' ');
      return { text: raw ?? '', refs: [] };
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
      const href = node.getAttribute('href') ?? '';
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
      const style = node.getAttribute('style') ?? '';
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

  private serializeChildren(children: HtmlNode[], note: EvernoteNote | undefined): InlineSerialization {
    let text = '';
    const refs: string[] = [];
    for (const child of children) {
      const chunk = this.serializeInline(child, note);
      text += chunk.text;
      refs.push(...chunk.refs);
    }
    return { text, refs };
  }

  private resolveEvernoteLink(href: string, anchorText: string): string | undefined {
    const guidMatch = href.match(/\/([0-9a-f-]+)\/?$/i);
    const guid = guidMatch?.[1]?.toLowerCase();
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

  private getIndentLevel(element: HTMLElement): number {
    const style = element.getAttribute('style') ?? '';
    const match = style.match(/padding-left\s*:\s*(\d+)px/i);
    if (!match) {
      return 0;
    }
    const padding = parseInt(match[1], 10);
    return Number.isFinite(padding) ? Math.max(0, Math.round(padding / 40)) : 0;
  }

  private reconcileStackForIndent(stack: StackEntry[], indentLevel: number) {
    while (stack.length > 1 && stack[stack.length - 1].indent >= indentLevel) {
      stack.pop();
    }
  }

  private addField(
    parent: TanaIntermediateNode,
    fieldName: string,
    value: string,
    createdAt: number,
    editedAt: number,
  ) {
    const fieldNode = this.createNode(fieldName, 'field', createdAt, editedAt);
    fieldNode.children = fieldNode.children ?? [];

    // Check if value is a date reference like [[2025-10-02]]
    const dateRefMatch = value.match(/^\[\[(\d{4}-\d{2}-\d{2})\]\]$/);
    if (dateRefMatch) {
      const dateValue = dateRefMatch[1];
      const dateNode = this.createNode(dateValue, 'date', createdAt, editedAt);
      fieldNode.children.push(dateNode);
      // Record date values in attributes with [[date:YYYY-MM-DD]] format
      this.recordAttribute(fieldName, `[[date:${dateValue}]]`);
    } else {
      fieldNode.children.push(this.createNode(value, 'node', createdAt, editedAt));
      this.recordAttribute(fieldName, value);
    }

    parent.children = parent.children ?? [];
    parent.children.push(fieldNode);
    this.summary.fields += 1;
  }

  private recordAttribute(fieldName: string, rawValue: string) {
    const attribute = this.attrMap.get(fieldName) ?? { name: fieldName, values: [], count: 0 };
    const trimmedValue = rawValue.trim();
    // Only add the value if it's not already in the array (deduplicate)
    if (!attribute.values.includes(trimmedValue)) {
      attribute.values.push(trimmedValue);
    }
    attribute.count += 1;
    this.attrMap.set(fieldName, attribute);
  }

  private createNode(name: string, type: NodeType, createdAt: number, editedAt: number): TanaIntermediateNode {
    return {
      uid: idgenerator(),
      name,
      createdAt,
      editedAt,
      type,
    };
  }

  private extractResources(resources: any[]): Map<string, EvernoteResource> {
    const map = new Map<string, EvernoteResource>();
    for (const resource of resources) {
      if (!resource?.data) {
        continue;
      }
      const dataRaw = resource.data?.['__cdata'] ?? resource.data?.['#text'] ?? resource.data?.toString() ?? '';
      const base64 = dataRaw.replace(/\s+/g, '');
      if (!base64) {
        continue;
      }
      const buffer = Buffer.from(base64, 'base64');
      const hash = crypto.createHash('md5').update(buffer).digest('hex');
      const mime = resource.mime?.toString() ?? 'application/octet-stream';
      const dataUri = `data:${mime};base64,${base64}`;
      const fileName = resource['resource-attributes']?.['file-name']?.toString();
      const width = parseInt(resource.width?.toString() ?? '', 10);
      const height = parseInt(resource.height?.toString() ?? '', 10);
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

  private extractTasks(tasks: any[]): EvernoteTask[] {
    const result: EvernoteTask[] = [];
    for (const task of tasks) {
      if (!task?.title) {
        continue;
      }
      result.push({
        title: task.title.toString(),
        status: task.taskStatus?.toString() ?? 'open',
        flagged: task.taskFlag === true || task.taskFlag === 'true',
        dueDate: this.parseEvernoteTimestamp(task.dueDate),
        timezone: task.timeZone?.toString(),
        groupId: task.taskGroupNoteLevelID?.toString(),
      });
    }
    return result;
  }

  private collectEvernoteLinkGuids(rawNotes: any[]): Map<string, Set<string>> {
    const guidToAnchors = new Map<string, Set<string>>();
    for (const raw of rawNotes) {
      const content = this.extractContent(raw?.content);
      const document = parseHtml(content, { comment: false });
      const enNote = document.querySelector('en-note');
      if (!enNote) {
        continue;
      }
      const anchors = enNote.querySelectorAll('a');
      anchors.forEach((anchor: HTMLElement) => {
        const href = anchor.getAttribute('href') ?? '';
        if (!href.startsWith('evernote:///')) {
          return;
        }
        const guidMatch = href.match(/\/([0-9a-f-]+)\/?$/i);
        if (!guidMatch) {
          return;
        }
        const guid = guidMatch[1].toLowerCase();
        const text = anchor.innerText?.trim() ?? '';
        const set = guidToAnchors.get(guid) ?? new Set<string>();
        if (text) {
          set.add(text);
        }
        guidToAnchors.set(guid, set);
      });
    }
    return guidToAnchors;
  }

  private extractContent(content: any): string {
    if (!content) {
      return '<en-note />';
    }
    if (typeof content === 'string') {
      return content;
    }
    if (typeof content === 'object') {
      return content['__cdata'] ?? content['#text'] ?? '<en-note />';
    }
    return '<en-note />';
  }

  private parseEvernoteTimestamp(value: unknown): number {
    if (typeof value !== 'string') {
      return Number.NaN;
    }
    const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    if (!match) {
      return Number.NaN;
    }
    const [, year, month, day, hour, minute, second] = match;
    return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  }

  private tryParseDailyNoteDate(title: string, source?: string): Date | undefined {
    if (!source || source.toLowerCase() !== 'daily.note') {
      return undefined;
    }
    const trimmedTitle = title.trim();
    const match = trimmedTitle.match(DAILY_NOTE_TITLE_WITH_DATE);
    if (!match) {
      return undefined;
    }
    const [, month, day, year] = match;
    const parsedYear = Number(year);
    const parsedMonth = Number(month);
    const parsedDay = Number(day);
    if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth) || !Number.isFinite(parsedDay)) {
      return undefined;
    }
    const candidate = new Date(parsedYear, parsedMonth - 1, parsedDay);
    if (!Number.isFinite(candidate.getTime())) {
      return undefined;
    }
    if (
      candidate.getFullYear() !== parsedYear ||
      candidate.getMonth() !== parsedMonth - 1 ||
      candidate.getDate() !== parsedDay
    ) {
      return undefined;
    }
    return candidate;
  }

  private tryConvertInlineDate(value: string): string | undefined {
    for (const format of INLINE_DATE_FORMATS) {
      const parsed = parseDate(value, format, new Date());
      if (isValidDate(parsed)) {
        return this.formatDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
      }
    }
    return undefined;
  }

  private formatUtcTimestamp(timestamp: number): string | undefined {
    if (!Number.isFinite(timestamp)) {
      return undefined;
    }
    const date = new Date(timestamp);
    return this.formatDateParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  private formatDateParts(year: number, month: number, day: number): string {
    const candidate = new Date(year, month - 1, day);
    if (!Number.isFinite(candidate.getTime())) {
      const mm = month.toString().padStart(2, '0');
      const dd = day.toString().padStart(2, '0');
      return `${year}-${mm}-${dd}`;
    }
    return convertDateToTanaDateStr(candidate);
  }

  private computeSummary(rootNodes: TanaIntermediateNode[]) {
    let total = 0;
    let leaf = 0;
    const walk = (node: TanaIntermediateNode) => {
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

  private ensureArray<T>(value: T | T[] | undefined): T[] {
    if (!value) {
      return [];
    }
    return Array.isArray(value) ? value : [value];
  }
  private extractTaskGroupId(style: string): string | undefined {
    return this.getStyleProperty(style, '--en-id');
  }

  private extractNodeLevelId(style: string): string | undefined {
    return this.getStyleProperty(style, '--en-nodeId');
  }

  private getStyleProperty(style: string, property: string): string | undefined {
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
