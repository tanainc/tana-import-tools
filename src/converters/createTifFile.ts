import { parse, HTMLElement, NodeType as HtmlNodeType, type Node as HtmlNode } from 'node-html-parser';
import type {
  TanaIntermediateFile,
  TanaIntermediateNode,
  TanaIntermediateNamePart,
  TanaIntermediateFieldDefinition,
  TanaIntermediateSupertag,
  TanaIntermediateDataType,
} from '../types/types.js';
import type { SourceGraph, SourceNode } from './sourceGraph.js';
import { idgenerator, markdownToHTML } from '../utils/utils.js';

type TextFormat = Extract<TanaIntermediateNamePart, { type: 'text' }>['formats'];
const htmlFormats: Record<string, NonNullable<TextFormat>[number]> = {
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
export function createTifFile(graph: SourceGraph): TanaIntermediateFile {
  const sourceNodes = new Map<string, SourceNode>();
  const childIds = new Set<string>();
  const collect = (node: SourceNode) => {
    if (sourceNodes.has(node.uid)) {
      return;
    }
    sourceNodes.set(node.uid, node);
    for (const child of node.children ?? []) {
      childIds.add(child.uid);
      collect(child);
    }
  };
  graph.roots.forEach(collect);
  const ids = new Map([...sourceNodes.keys()].map((uid) => [uid, idgenerator()]));
  const pureReference = (node: SourceNode) => {
    if (
      node.type !== 'node' ||
      node.children?.length ||
      node.todoState !== undefined ||
      node.description ||
      node.flags?.length ||
      node.supertags?.length
    ) {
      return undefined;
    }
    const match = node.name.match(/^\[\[([^\]]+)\]\]$/) ?? node.name.match(/^\[([^\]]+)\]\(\[\[([^\]]+)\]\]\)$/);
    const target = match?.[2] ?? match?.[1];
    return target && target !== node.uid && sourceNodes.has(target)
      ? { uid: target, alias: match?.[2] ? match[1] : undefined }
      : undefined;
  };
  const aliases = new Map(
    [...sourceNodes.values()].flatMap((node) => {
      const target = pureReference(node);
      return target ? [[node.uid, target] as const] : [];
    }),
  );
  const targetId = (uid: string): string => {
    const seen = new Set<string>();
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

  const textParts = (
    text: string,
    formats: TextFormat,
    aliasesForName: Map<string, string | undefined>,
  ): TanaIntermediateNamePart[] => {
    if (formats?.includes('code')) {
      return [{ type: 'text', text, formats }];
    }
    const parts: TanaIntermediateNamePart[] = [];
    const pattern = /(```[\s\S]*?```|`[^`]*`)|\[([^\]]+)\]\(\[\[([^\]]+)\]\]\)|\[\[([^\]]+)\]\]/gu;
    let offset = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index > offset) {
        parts.push({ type: 'text', text: text.slice(offset, match.index), formats });
      }
      if (match[1]) {
        parts.push({ type: 'text', text: match[1].replace(/^`+|`+$/gu, ''), formats: [...(formats ?? []), 'code'] });
        offset = match.index + match[0].length;
        continue;
      }
      const token = match[3] ?? match[4];
      if (token.startsWith('date:')) {
        parts.push({ type: 'date', date: token.slice(5).trim() });
      } else if (sourceNodes.has(token)) {
        const nodeId = targetId(token);
        if (aliasesForName.has(nodeId) && aliasesForName.get(nodeId) !== match[2]) {
          parts.push({ type: 'text', text: match[0], formats });
        } else {
          parts.push({ type: 'node', nodeId });
          aliasesForName.set(nodeId, match[2]);
        }
      } else {
        parts.push({ type: 'text', text: match[0], formats });
      }
      offset = match.index + match[0].length;
    }
    if (offset < text.length) {
      parts.push({ type: 'text', text: text.slice(offset), formats });
    }
    return parts;
  };
  const convertName = (html: string) => {
    const aliasesForName = new Map<string, string | undefined>();
    const walk = (node: HtmlNode, formats: TextFormat = []): TanaIntermediateNamePart[] => {
      if (node.nodeType === HtmlNodeType.TEXT_NODE) {
        if (!formats?.includes('code')) {
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
    return {
      nameParts: parse(html).childNodes.flatMap((node) => walk(node)),
      ...(aliasesForName.size
        ? {
            inlineNodes: Object.fromEntries(
              [...aliasesForName].flatMap(([id, alias]) =>
                alias === undefined ? [] : [[id, { isRef: true as const, id, alias }]],
              ),
            ),
          }
        : {}),
    };
  };

  const definitions: TanaIntermediateFieldDefinition[] = [];
  const fields = new Map<string, TanaIntermediateFieldDefinition & { uid: string }>();
  const fieldUid = (name: string): string => {
    let definition = fields.get(name);
    if (!definition) {
      const source = graph.fields?.find((field) => field.name === name);
      let dataType: TanaIntermediateDataType | undefined;
      if (source?.dataType === 'checkbox') {
        dataType = 'boolean';
      } else if (source?.dataType && source.dataType !== 'any') {
        dataType = source.dataType;
      }
      definition = { type: 'fieldDefinition', uid: idgenerator(), ...convertName(name), dataType };
      fields.set(name, definition);
      definitions.push(definition);
    }
    return definition.uid;
  };
  const tags = new Map<string, TanaIntermediateSupertag & { uid: string }>();
  const tagUid = (nameOrUid: string): string => {
    const source = graph.tags?.find((tag) => tag.uid === nameOrUid);
    const name = source?.name ?? nameOrUid;
    let tag = tags.get(name);
    if (!tag) {
      tag = { type: 'supertag', uid: idgenerator(), ...convertName(name) };
      tags.set(name, tag);
    }
    return tag.uid;
  };
  const declared = new Set<string>();
  const convertChildren = (sources: SourceNode[]): TanaIntermediateNode[] => {
    const siblings = new Set<string>();
    const declarations = new Set(
      sources.filter((source) => !aliases.has(source.uid)).map((source) => ids.get(source.uid)),
    );
    return sources.map((source) => {
      const id = targetId(source.uid);
      const converted = convert(source, siblings.has(id) || (aliases.has(source.uid) && declarations.has(id)));
      if (converted.id) {
        siblings.add(converted.id);
      }
      return converted;
    });
  };
  const convert = (source: SourceNode, preserveWrapper = false): TanaIntermediateNode => {
    const target = aliases.get(source.uid);
    if (target && !preserveWrapper) {
      return { isRef: true, id: targetId(target.uid), ...(target.alias ? { alias: target.alias } : {}) };
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
      isSection: source.flags?.includes('section') || undefined,
      isDone: source.todoState === undefined ? undefined : source.todoState === 'done',
      tags: source.supertags?.map((tag) => ({ uid: tagUid(tag) })),
    };
    if (source.type === 'field') {
      return {
        type: 'field',
        id,
        field: { uid: fieldUid(source.name) },
        values: convertChildren(source.children ?? []),
      };
    }
    const children = source.children ? convertChildren(source.children) : undefined;
    if (source.type === 'codeblock') {
      return {
        ...metadata,
        type: 'codeBlock',
        content: source.name,
        plainText: true,
        language: source.codeLanguage,
        children,
      };
    }
    if (source.type === 'image' && source.mediaUrl) {
      return {
        ...metadata,
        type: 'visual',
        visualType: 'image',
        url: source.mediaUrl,
        ...convertName(source.name),
        children,
      };
    }
    return {
      ...metadata,
      type: 'node',
      children,
      ...(source.type === 'date'
        ? { nameParts: [{ type: 'date' as const, date: source.name }] }
        : convertName(source.name)),
    };
  };
  const homeIds = new Set(graph.homeIds ?? []);
  const workspace: SourceNode[] = [];
  const library: SourceNode[] = [];
  for (const root of graph.roots) {
    if (childIds.has(root.uid)) {
      continue;
    }
    (homeIds.has(root.uid) ? workspace : library).push(root);
  }
  return {
    version: 'TanaIntermediateFile V2.1',
    contents: {
      workspace: { children: convertChildren(workspace) },
      ...(library.length ? { library: { children: convertChildren(library) } } : {}),
      ...(definitions.length || tags.size ? { schema: { children: [...definitions, ...tags.values()] } } : {}),
    },
  };
}
