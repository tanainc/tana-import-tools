import {
  NodeType,
  TanaIntermediateAttribute,
  TanaIntermediateFile,
  TanaIntermediateNode,
  TanaIntermediateSummary,
} from '../../types/types.js';
import {
  findGroups,
  getBracketLinks,
  getCodeIfCodeblock,
  idgenerator,
  isIndexWithinBackticks,
  markdownToHTML,
} from '../../utils/utils.js';
import { IConverter } from '../IConverter.js';
import type * as fs from 'fs';

// Simple Markdown converter that supports multiple .md files in a directory.
// Each file becomes a top-level "page" node named after the file (without extension).
// Within a page we support:
// - Headings (#, ##, ###) flagged as sections
// - Bullet lists with nesting (spaces indent)
// - Task checkboxes [-] [ ] [x]
// - Fields in form Foo:: Bar (as children field nodes)
// - Images ![alt](url) or local paths; multiple images create child image nodes
// - Fenced code blocks ```lang ... ``` become type=codeblock (with codeLanguage)
// - Links converted to HTML anchors; bracket-links [[...]] normalized and broken refs created

type ParsedFile = { filePath: string; content: string; depth: number };
export type FileSystem = {
  existsSync: typeof fs.existsSync;
  statSync: (path: string) => fs.Stats;
  readdirSync: (path: string, options: { withFileTypes: true } ) => fs.Dirent[];
  readFileSync: (path: string, options:
    | {
    encoding: BufferEncoding;
    flag?: string | undefined;
  }
    | BufferEncoding) => string;
};

export type PathIsh = {
  dirname: (path: string) => string;
  basename: (path: string) => string;
  resolve: (...paths:string[]) => string;
  join: (path: string, name: string) => string;
};

export class MarkdownConverter implements IConverter {
  private nodesForImport: Map<string, TanaIntermediateNode> = new Map();
  private originalNodeNames: Map<string, string> = new Map();
  private attrMap: Map<string, TanaIntermediateAttribute> = new Map();
  private topLevelMap: Map<string, TanaIntermediateNode> = new Map();
  private mdPathToPageUid: Map<string, string> = new Map();
  private normalizedPathToUid: Map<string, string> = new Map();
  private dirToBasenameToUid: Map<string, Map<string, string>> = new Map();
  private pageUidToBaseDir: Map<string, string> = new Map();
  private pageUidToMarkdownLinkNodeUids: Map<string, Set<string>> = new Map();
  private csvTablesByParentAndPath: Map<string, TanaIntermediateNode> = new Map();
  private pendingCsvCellResolutions: {
    nodeUid: string;
    rawValue: string;
    sourceDir: string;
  }[] = [];

  private summary: TanaIntermediateSummary = {
    leafNodes: 0,
    topLevelNodes: 0,
    totalNodes: 0,
    calendarNodes: 0,
    fields: 0,
    brokenRefs: 0,
  };

  private fileSystem: FileSystem;
  private path: PathIsh;
  private fileToUrlMap?: Map<string, string>;

  constructor (fileSystem: FileSystem, pathIsh: PathIsh, fileToUrlMap?: Map<string, string>) {
    this.fileSystem = fileSystem;
    this.path = pathIsh;
    this.fileToUrlMap = fileToUrlMap;
  }

  // IConverter — treat input as a single markdown file content
  convert(fileContent: string): TanaIntermediateFile | undefined {
    this.pageUidToMarkdownLinkNodeUids.clear();
    const pageNode = this.convertSingleFile({ filePath: 'document.md', content: fileContent, depth: 0 });
    if (!pageNode) {
      return undefined;
    }

    const rootLevelNodes: TanaIntermediateNode[] = [pageNode];
    this.resolvePendingCsvCellReferences();
    this.postProcessAllNodes(rootLevelNodes);
    const home = Array.from(new Set(rootLevelNodes.map((node) => node.uid)));

    return {
      version: 'TanaIntermediateFile V0.1',
      summary: this.summary,
      nodes: rootLevelNodes,
      homeNodeIds: home,
      attributes: [...this.attrMap.values()],
    };
  }

  // Directory mode — build a single TIF from all .md files under dir
  convertDirectory(dirPath: string): TanaIntermediateFile | undefined {
    this.pageUidToMarkdownLinkNodeUids.clear();
    if (!this.fileSystem.existsSync(dirPath) || !this.fileSystem.statSync(dirPath).isDirectory()) {
      return undefined;
    }
    const files: ParsedFile[] = [];
    const walk = (p: string, depth: number) => {
      const entries = this.fileSystem.readdirSync(p, { withFileTypes: true });
      for (const e of entries) {
        const fp = this.path.join(p, e.name);
        if (e.isDirectory()) {
          walk(fp, depth + 1);
        } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
          files.push({ filePath: fp, content: this.fileSystem.readFileSync(fp, 'utf8'), depth });
        }
      }
    };
    walk(dirPath, 0);

    const rootLevelNodes: TanaIntermediateNode[] = [];
    const pageNodesByDepth: Map<number, TanaIntermediateNode[]> = new Map();
    for (const f of files) {
      const page = this.convertSingleFile(f);
      if (page) {
        const abs = this.path.resolve(f.filePath);
        this.mdPathToPageUid.set(abs, page.uid);
        this.registerPagePath(abs, page.uid);
        this.pageUidToBaseDir.set(page.uid, this.path.dirname(abs));
        rootLevelNodes.push(page);
        const depthForFile = f.depth ?? 0;
        const existing = pageNodesByDepth.get(depthForFile);
        if (existing) {
          existing.push(page);
        } else {
          pageNodesByDepth.set(depthForFile, [page]);
        }
      }
    }

    this.resolvePendingCsvCellReferences();
    this.postProcessAllNodes(rootLevelNodes);
    this.inlineSinglyLinkedMarkdownPages(rootLevelNodes, pageNodesByDepth);

    const depthEntries = Array.from(pageNodesByDepth.entries())
      .filter(([, nodes]) => nodes.length > 0)
      .sort((a, b) => a[0] - b[0]);
    const homeSourceNodes = depthEntries.length > 0 ? depthEntries[0][1] : rootLevelNodes;
    const home = Array.from(new Set(homeSourceNodes.map((node) => node.uid)));
    return {
      version: 'TanaIntermediateFile V0.1',
      summary: this.summary,
      nodes: rootLevelNodes,
      homeNodeIds: home,
      attributes: [...this.attrMap.values()],
    };
  }

  private postProcessAllNodes(rootLevelNodes: TanaIntermediateNode[]) {
    const rootLevelNameToUid = new Map<string, string>();
    const rootLevelUids = new Set(rootLevelNodes.map((n) => n.uid));
    for (const rootNode of rootLevelNodes) {
      const originalRootName = this.originalNodeNames.get(rootNode.uid) || rootNode.name;
      if (typeof originalRootName === 'string' && originalRootName) {
        if (!rootLevelNameToUid.has(originalRootName)) {
          rootLevelNameToUid.set(originalRootName, rootNode.uid);
        }
      }
      if (typeof rootNode.name === 'string' && rootNode.name) {
        if (!rootLevelNameToUid.has(rootNode.name)) {
          rootLevelNameToUid.set(rootNode.name, rootNode.uid);
        }
      }
    }

    // First, convert relative markdown page/file links into internal refs or file:// anchors
    for (const top of rootLevelNodes) {
      const baseDir = this.pageUidToBaseDir.get(top.uid);
      if (!baseDir) {
        continue;
      }
      this.convertRelativeLinksRecursively(top, baseDir);
    }

    // Then split multi-ref field values, fix links + normalize + HTML for non-codeblock nodes
    for (const [, node] of this.nodesForImport) {
      if (node.type === 'codeblock') {
        continue;
      }
      const originalNodeName = this.originalNodeNames.get(node.uid) || node.name;
      if (
        node.type === 'node' &&
        typeof originalNodeName === 'string' &&
        rootLevelNameToUid.has(originalNodeName) &&
        !rootLevelUids.has(node.uid)
      ) {
        const rootUid = rootLevelNameToUid.get(originalNodeName);
        if (rootUid) {
          if (!node.refs) {
            node.refs = [];
          }
          if (!node.refs.includes(rootUid)) {
            node.refs.push(rootUid);
          }
          node.name = `[[${rootUid}]]`;
        }
      }
      // Strip leading whitespace from content lines to avoid indented artifacts
      if (typeof node.name === 'string') {
        node.name = node.name.replace(/^\s+/, '');
      }
      const newNodes = this.fixBrokenLinks(node);
      if (newNodes?.length) {
        rootLevelNodes.push(...newNodes);
      }
      this.normalizeLinksAndSetAliases(node);
      // After link normalization, split top-of-page KV fields that contain only [[uid]] refs into multiple value nodes
      if (node.type === 'field' && Array.isArray(node.children) && node.children.length === 1) {
        const child = node.children[0];
        if (typeof child.name === 'string') {
          const links = getBracketLinks(child.name, false);
          if (links.length > 0) {
            let remaining = child.name;
            for (const l of links) {
              remaining = remaining.replace(`[[${l}]]`, '').trim();
            }
            const onlySeparatorsLeft = remaining.replace(/[\s,]+/g, '') === '';
            if (onlySeparatorsLeft) {
              // Replace single value with one per ref
              const newChildren: TanaIntermediateNode[] = links.map((l) =>
                this.createNodeForImport({
                  uid: idgenerator(),
                  name: `[[${l}]]`,
                  createdAt: child.createdAt,
                  editedAt: child.editedAt,
                  parentNode: node.uid,
                  refs: [l],
                }),
              );
              node.children = newChildren;
            }
          }
        }
      }
      node.name = markdownToHTML(node.name);
    }
  }

  private recordMarkdownLinkOccurrence(pageUid: string, nodeUid: string) {
    let nodeSet = this.pageUidToMarkdownLinkNodeUids.get(pageUid);
    if (!nodeSet) {
      nodeSet = new Set();
      this.pageUidToMarkdownLinkNodeUids.set(pageUid, nodeSet);
    }
    nodeSet.add(nodeUid);
  }

  // Manual parser to replace catastrophic backtracking regex for markdown links
  // Handles [alias](link) with balanced parentheses in the link part
  private parseMarkdownLinks(text: string, callback: (alias: string, link: string) => string): string {
    let result = '';
    let i = 0;

    while (i < text.length) {
      // Find opening bracket
      if (text[i] === '[') {
        const aliasStart = i + 1;
        let aliasEnd = -1;

        // Find closing bracket for alias, respecting escaped brackets
        for (let j = aliasStart; j < text.length; j++) {
          if (text[j] === '\\' && j + 1 < text.length) {
            j++; // skip escaped character
            continue;
          }
          if (text[j] === ']') {
            aliasEnd = j;
            break;
          }
        }

        if (aliasEnd === -1) {
          result += text[i];
          i++;
          continue;
        }

        // Check if followed by (
        if (aliasEnd + 1 < text.length && text[aliasEnd + 1] === '(') {
          const linkStart = aliasEnd + 2;
          let linkEnd = -1;
          let depth = 1;
          let j = linkStart;

          // Match balanced parentheses with a safety limit
          const maxIterations = Math.min(text.length - j, 10000);
          let iterations = 0;

          while (j < text.length && depth > 0 && iterations < maxIterations) {
            if (text[j] === '\\' && j + 1 < text.length) {
              j += 2; // skip escaped character
              iterations++;
              continue;
            }
            if (text[j] === '(') {
              depth++;
            } else if (text[j] === ')') {
              depth--;
              if (depth === 0) {
                linkEnd = j;
                break;
              }
            }
            j++;
            iterations++;
          }

          if (linkEnd !== -1 && iterations < maxIterations) {
            const alias = text.substring(aliasStart, aliasEnd);
            const link = text.substring(linkStart, linkEnd);
            const replacement = callback(alias, link);
            result += replacement;
            i = linkEnd + 1;
            continue;
          }
        }
      }

      result += text[i];
      i++;
    }

    return result;
  }

  // Helper to parse a single markdown link at the start of text
  // Returns {alias, link} if found, undefined otherwise
  private parseMarkdownLinkAtStart(text: string): { alias: string; link: string } | undefined {
    if (!text.startsWith('[')) {
      return undefined;
    }

    const aliasStart = 1;
    let aliasEnd = -1;

    // Find closing bracket for alias
    for (let j = aliasStart; j < text.length; j++) {
      if (text[j] === '\\' && j + 1 < text.length) {
        j++;
        continue;
      }
      if (text[j] === ']') {
        aliasEnd = j;
        break;
      }
    }

    if (aliasEnd === -1 || aliasEnd + 1 >= text.length || text[aliasEnd + 1] !== '(') {
      return undefined;
    }

    const linkStart = aliasEnd + 2;
    let linkEnd = -1;
    let depth = 1;
    let j = linkStart;
    const maxIterations = Math.min(text.length - j, 10000);
    let iterations = 0;

    while (j < text.length && depth > 0 && iterations < maxIterations) {
      if (text[j] === '\\' && j + 1 < text.length) {
        j += 2;
        iterations++;
        continue;
      }
      if (text[j] === '(') {
        depth++;
      } else if (text[j] === ')') {
        depth--;
        if (depth === 0) {
          linkEnd = j;
          break;
        }
      }
      j++;
      iterations++;
    }

    // Only match if the entire text is the link (standalone check)
    if (linkEnd !== -1 && linkEnd === text.length - 1 && iterations < maxIterations) {
      return {
        alias: text.substring(aliasStart, aliasEnd),
        link: text.substring(linkStart, linkEnd),
      };
    }

    return undefined;
  }

  private convertRelativeLinksRecursively(node: TanaIntermediateNode, baseDir: string, depth = 0) {
    if (node.type !== 'codeblock' && typeof node.name === 'string') {
      // 1) Convert standard markdown links [alias](relative)
      if (node.name.includes('](')) {
        node.name = this.parseMarkdownLinks(node.name, (alias: string, link: string) => {
          // external links left as-is; handled by markdownToHTML later
          if (/^[a-z]+:\/\//i.test(link) || link.startsWith('mailto:')) {
            return `[${alias}](${link})`;
          }
          const decoded = this.safeDecode(link);
          const abs = this.path.resolve(baseDir, decoded);
          if (abs.toLowerCase().endsWith('.md')) {
            const uid = this.mdPathToPageUid.get(abs);
            if (uid) {
              if (!node.refs) {
                node.refs = [];
              }
              if (!node.refs.includes(uid)) {
                node.refs.push(uid);
              }
              if (node.uid) {
                this.recordMarkdownLinkOccurrence(uid, node.uid);
              }
              return `[${alias}]([[${uid}]])`;
            }
            // If not found, fall back to filename as link text
            return `[${alias}](${this.asFileUrl(abs)})`;
          }
          const mappedUrl = this.fileToUrlMap?.get(abs);
          // other files => make file:// link if not pre-mapped
          const url = mappedUrl || this.asFileUrl(abs);
          return `<a href="${url}">${alias}</a>`;
        });
      }

      // 2) Convert Notion-style inline references: "Text (relative/path.md)"
      //    May occur multiple times in a single value, separated by commas, etc.
      //    We only convert .md references that resolve to a known page in this import.
      if (node.name.includes('(') && node.name.includes('.md')) {
        // Simplified regex without nested optionals to avoid backtracking
        // Matches: non-whitespace text followed by optional more text, then (link.md)
        console.debug('[REGEX] Notion-style reference regex matching (line ~447):', JSON.stringify(node.name.substring(0, 2000)));
        const re = /([^\s()[\]][^()[\]]{0,200}?)\s*\(([^)]{1,500}?\.md)\)/g;
        node.name = node.name.replace(re, (full: string, aliasText: string, link: string) => {
          // Skip if link looks external
          if (/^[a-z]+:\/\//i.test(link) || link.startsWith('mailto:')) {
            return full;
          }
          const uid = this.resolveUidForLinkedPath(link, baseDir);
          if (uid) {
            if (!node.refs) {
              node.refs = [];
            }
            if (!node.refs.includes(uid)) {
              node.refs.push(uid);
            }
            if (node.uid) {
              this.recordMarkdownLinkOccurrence(uid, node.uid);
            }
            return `[[${uid}]]`;
          }
          // If we cannot resolve, keep original text
          return full;
        });
      }
      if (node.name.includes('(') && (node.name.includes('.csv') || node.name.includes('.md'))) {
        const normalized = this.normalizeCsvCellValue(node.name, baseDir);
        if (normalized.text !== node.name) {
          node.name = normalized.text;
        }
        if (normalized.refs.length) {
          if (!node.refs) {
            node.refs = [];
          }
          for (const ref of normalized.refs) {
            if (!node.refs.includes(ref)) {
              node.refs.push(ref);
            }
          }
        }
      }
    }
    if (node.children) {
      for (const c of node.children) {
        this.convertRelativeLinksRecursively(c, baseDir, depth + 1);
      }
    }
  }

  private inlineSinglyLinkedMarkdownPages(
    rootLevelNodes: TanaIntermediateNode[],
    pageNodesByDepth: Map<number, TanaIntermediateNode[]>,
  ) {
    if (!this.pageUidToMarkdownLinkNodeUids.size || !rootLevelNodes.length) {
      return;
    }

    type RefLocation = {
      parent?: TanaIntermediateNode;
      node: TanaIntermediateNode;
      index?: number;
    };

    const pageUids = new Set(this.pageUidToBaseDir.keys());
    if (!pageUids.size) {
      return;
    }

    const refLocations = new Map<string, RefLocation[]>();
    const collectRefLocations = (
      current: TanaIntermediateNode,
      parent: TanaIntermediateNode | undefined,
    ) => {
      if (Array.isArray(current.refs)) {
        for (const ref of current.refs) {
          if (!pageUids.has(ref) || ref === current.uid) {
            continue;
          }
          let entries = refLocations.get(ref);
          if (!entries) {
            entries = [];
            refLocations.set(ref, entries);
          }
          const index = parent && parent.children ? parent.children.indexOf(current) : undefined;
          entries.push({ parent, node: current, index });
        }
      }
      if (Array.isArray(current.children)) {
        for (const child of current.children) {
          collectRefLocations(child, current);
        }
      }
    };

    for (const node of rootLevelNodes) {
      collectRefLocations(node, undefined);
    }

    const inlinedUids: string[] = [];

    for (const [pageUid, nodeUids] of this.pageUidToMarkdownLinkNodeUids.entries()) {
      if (!pageUids.has(pageUid)) {
        continue;
      }
      if (nodeUids.size !== 1) {
        continue;
      }
      const refEntries = refLocations.get(pageUid);
      if (!refEntries || refEntries.length !== 1) {
        continue;
      }
      const refEntry = refEntries[0];
      if (!refEntry.parent || refEntry.index === undefined || refEntry.index < 0) {
        continue;
      }
      if (refEntry.parent.type === 'field') {
        continue;
      }
      if (refEntry.node.uid && !nodeUids.has(refEntry.node.uid)) {
        continue;
      }
      if ((refEntry.node.refs?.length || 0) > 1) {
        continue;
      }
      if (Array.isArray(refEntry.node.children) && refEntry.node.children.length > 0) {
        continue;
      }

      const rootIndex = rootLevelNodes.findIndex((candidate) => candidate.uid === pageUid);
      if (rootIndex === -1) {
        continue;
      }
      const [pageNode] = rootLevelNodes.splice(rootIndex, 1);
      if (!pageNode) {
        continue;
      }

      refEntry.parent.children?.splice(refEntry.index, 1, pageNode);
      if (Array.isArray(refEntry.parent.refs)) {
        const idx = refEntry.parent.refs.indexOf(pageUid);
        if (idx > -1) {
          refEntry.parent.refs.splice(idx, 1);
        }
      }

      for (const [depth, nodesAtDepth] of pageNodesByDepth) {
        const depthIndex = nodesAtDepth.findIndex((n) => n.uid === pageUid);
        if (depthIndex > -1) {
          nodesAtDepth.splice(depthIndex, 1);
          if (nodesAtDepth.length === 0) {
            pageNodesByDepth.delete(depth);
          }
          break;
        }
      }

      inlinedUids.push(pageUid);
    }

    if (inlinedUids.length) {
      this.summary.topLevelNodes = Math.max(0, this.summary.topLevelNodes - inlinedUids.length);
    }
  }

  private safeDecode(u: string) {
    try {
      return decodeURIComponent(u);
    } catch {
      return u;
    }
  }

  private asFileUrl(abs: string) {
    return `file://${abs}`;
  }

  private ensureCsvTableForLink(
    parent: TanaIntermediateNode,
    fileDir: string,
    link: string,
    alias?: string,
  ): TanaIntermediateNode | undefined {
    try {
      const decoded = this.safeDecode(link);
      let abs = this.path.resolve(fileDir, decoded);
      if (!this.fileSystem.existsSync(abs)) {
        const alt = this.findFileByBasename(fileDir, this.path.basename(decoded));
        if (alt) {
          abs = alt;
        }
      }
      if (!this.fileSystem.existsSync(abs)) {
        return undefined;
      }
      abs = this.path.resolve(abs);
      const cacheKey = `${parent.uid}::${abs}`;
      const existing = this.csvTablesByParentAndPath.get(cacheKey);
      if (existing) {
        return existing;
      }

      const csvContent = this.fileSystem.readFileSync(abs, 'utf8');
      const { headers, rows } = this.parseCsv(csvContent);
      const csvDir = this.path.dirname(abs);
      if (!parent.children) {
        parent.children = [];
      }
      const aliasDisplayName = alias?.trim();
      const tableWrapper = this.createNodeForImport({
        uid: idgenerator(),
        name: aliasDisplayName && aliasDisplayName.length > 0 ? aliasDisplayName : 'Table',
        createdAt: Date.now(),
        editedAt: Date.now(),
        type: 'node',
      });
      tableWrapper.viewType = 'table';
      tableWrapper.children = [];
      parent.children.push(tableWrapper);
      this.summary.totalNodes += 1;
      this.summary.leafNodes += 1;

      const csvBaseName = this.path.basename(abs).replace(/\.csv$/i, '');
      const mdSiblingDir = this.path.join(this.path.dirname(abs), csvBaseName);

      for (const r of rows) {
        const rowDisplayName = r[0] || alias || 'Row';
        const rowNode = this.createNodeForImport({
          uid: idgenerator(),
          name: rowDisplayName,
          createdAt: Date.now(),
          editedAt: Date.now(),
          type: 'node',
        });
        rowNode.children = [];
        tableWrapper.children.push(rowNode);
        this.summary.totalNodes += 1;
        this.summary.leafNodes += 1;

        const targetUid = this.findExistingPageUidForCsvRow(rowDisplayName, mdSiblingDir);
        if (targetUid) {
          rowNode.name = `[[${targetUid}]]`;
          if (!rowNode.refs) {
            rowNode.refs = [];
          }
          if (!rowNode.refs.includes(targetUid)) {
            rowNode.refs.push(targetUid);
          }
          continue;
        }

        headers.forEach((h, idx) => {
          if (idx === 0) {
            return;
          }
          const fieldNode = this.createNodeForImport({
            uid: idgenerator(),
            name: h,
            createdAt: Date.now(),
            editedAt: Date.now(),
          });
          fieldNode.type = 'field';
          const rawValue = r[idx] || '';
          const normalizedCell = this.normalizeCsvCellValue(rawValue, csvDir);
          const valueNode = this.createNodeForImport({
            uid: idgenerator(),
            name: normalizedCell.text,
            createdAt: Date.now(),
            editedAt: Date.now(),
            parentNode: fieldNode.uid,
            refs: normalizedCell.refs.length ? normalizedCell.refs : undefined,
          });
          if (normalizedCell.unresolvedTargets.length) {
            this.pendingCsvCellResolutions.push({
              nodeUid: valueNode.uid,
              rawValue,
              sourceDir: csvDir,
            });
          }
          fieldNode.children = [valueNode];
          rowNode.children!.push(fieldNode);
          this.summary.fields += 1;
          this.summary.totalNodes += 1;
          this.ensureAttrMapIsUpdated(fieldNode);
        });
      }

      this.csvTablesByParentAndPath.set(cacheKey, tableWrapper);
      return tableWrapper;
    } catch {
      return undefined;
    }
  }

  private convertSingleFile(file: ParsedFile): TanaIntermediateNode | undefined {
    const baseName = this.path.basename(file.filePath);
    const pageNode = this.createNodeForImport({
      uid: idgenerator(),
      name: baseName,
      createdAt: Date.now(),
      editedAt: Date.now(),
      type: 'node',
    });
    this.topLevelMap.set(pageNode.name, pageNode);
    this.summary.topLevelNodes += 1;
    this.summary.totalNodes += 1;

    pageNode.children = [];

    const lines = file.content.split(/\r?\n/);
    const firstLineIsTopLevelHeading = /^#\s+.+$/.test(lines[0] || '');
    let i = 0;
    // heading stack for proper nesting
    const headingStack: { level: number; node: TanaIntermediateNode }[] = [];
    // list stack tracks indentation based on leading spaces count
    let listStack: { indent: number; node: TanaIntermediateNode }[] = [];

    const fileDir = this.path.dirname(file.filePath);

    const getCurrentParent = () => {
      if (listStack.length) {
        return listStack[listStack.length - 1].node;
      }
      if (headingStack.length) {
        return headingStack[headingStack.length - 1].node;
      }
      return pageNode;
    };

    // Front matter (YAML-like) at file start
    if (lines[i]?.trim() === '---') {
      i++;
      // front matter starts at current index
      const fm: Record<string, string | string[]> = {};
      let currentKey: string | null = null;
      while (i < lines.length && lines[i].trim() !== '---') {
        const l = lines[i];
        const kv = l.match(/^([A-Za-z0-9_ -]+):\s*(.*)$/);
        if (kv) {
          currentKey = kv[1].trim();
          const val = kv[2].trim();
          if (val === '') {
            fm[currentKey] = [];
          } else {
            fm[currentKey] = val;
          }
        } else if (/^\s*-\s+/.test(l) && currentKey && Array.isArray(fm[currentKey])) {
          (fm[currentKey] as string[]).push(l.replace(/^\s*-\s+/, '').trim());
        }
        i++;
      }
      // consume closing ---
      if (i < lines.length && lines[i].trim() === '---') {
        i++;
      }
      // Create fields from fm
      for (const [key, val] of Object.entries(fm)) {
        const fieldNode = this.createNodeForImport({
          uid: idgenerator(),
          name: key,
          createdAt: pageNode.createdAt,
          editedAt: pageNode.editedAt,
        });
        fieldNode.type = 'field';
        if (!pageNode.children) {
          pageNode.children = [];
        }
        pageNode.children.push(fieldNode);
        const children: TanaIntermediateNode[] = [];
        if (Array.isArray(val)) {
          for (const v of val) {
            children.push(
              this.createNodeForImport({
                uid: idgenerator(),
                name: v,
                createdAt: fieldNode.createdAt,
                editedAt: fieldNode.editedAt,
                parentNode: fieldNode.uid,
              }),
            );
          }
        } else {
          children.push(
            this.createNodeForImport({
              uid: idgenerator(),
              name: val,
              createdAt: fieldNode.createdAt,
              editedAt: fieldNode.editedAt,
              parentNode: fieldNode.uid,
            }),
          );
        }
        fieldNode.children = children;
        this.summary.fields += 1;
        this.summary.totalNodes += 1; // field node itself
        this.ensureAttrMapIsUpdated(fieldNode);
      }
    }

    let firstHeadingUsedAsTitle = false;

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        i++;
        continue;
      }

      // fenced code block
      const fenceMatch = line.match(/^\s*```(\w+)?\s*$/);
      if (fenceMatch) {
        const lang = fenceMatch[1];
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
          codeLines.push(lines[i]);
          i++;
        }
        // consume closing fence if present
        if (i < lines.length && /^\s*```\s*$/.test(lines[i])) {
          i++;
        }
        const content = `\n${codeLines.join('\n')}\n`;
        const cb = this.createNodeForImport({
          uid: idgenerator(),
          name: content,
          createdAt: Date.now(),
          editedAt: Date.now(),
          type: 'codeblock',
        });
        if (lang) {
          cb.codeLanguage = lang;
        }
        const parent = getCurrentParent();
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(cb);
        this.summary.totalNodes += 1;
        this.summary.leafNodes += 1;
        continue;
      }

      // heading
      const headingMatch = line.match(/^(#+)\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();
        // If this is the first heading in the file, use it as page title
        if (!firstHeadingUsedAsTitle && pageNode.name === baseName) {
          pageNode.name = title;
          const shouldSkipMarkingAsHeading = firstLineIsTopLevelHeading && i === 0 && level === 1;
          if (!shouldSkipMarkingAsHeading) {
            pageNode.flags = ['section'];
            // Treat page node as the heading node at this level
            while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
              headingStack.pop();
            }
            headingStack.push({ level, node: pageNode });
          }
          firstHeadingUsedAsTitle = true;

          // Consume optional blank lines then any consecutive "Key: Value" metadata lines as fields
          let j = i + 1;
          // allow one or more blank lines after the title
          while (j < lines.length && lines[j].trim() === '') {
            j++;
          }
          const kvRegex = /^([A-Za-z0-9 _/#&+'-]+):\s+(.+)$/;
          let consumedAny = false;
          while (j < lines.length) {
            const m = lines[j].match(kvRegex);
            if (!m) {
              break;
            }
            const key = m[1].trim();
            const val = m[2].trim();
            const fieldNode = this.createNodeForImport({
              uid: idgenerator(),
              name: key,
              createdAt: pageNode.createdAt,
              editedAt: pageNode.editedAt,
            });
            fieldNode.type = 'field';
            const valueNode = this.createNodeForImport({
              uid: idgenerator(),
              name: val,
              createdAt: fieldNode.createdAt,
              editedAt: fieldNode.editedAt,
              parentNode: fieldNode.uid,
            });
            if (this.isStandaloneDate(val) || this.isInlineDateValue(val)) {
              valueNode.type = 'date';
            }
            fieldNode.children = [valueNode];
            if (!pageNode.children) {
              pageNode.children = [];
            }
            pageNode.children.push(fieldNode);
            this.summary.fields += 1;
            this.summary.totalNodes += 1; // field node itself
            this.ensureAttrMapIsUpdated(fieldNode);
            consumedAny = true;
            j++;
          }
          if (consumedAny) {
            i = j;
            listStack = [];
            continue;
          }
        } else {
          const hnode = this.createNodeForImport({
            uid: idgenerator(),
            name: title,
            createdAt: Date.now(),
            editedAt: Date.now(),
            type: 'node',
          });
          hnode.flags = ['section'];
          let parent: TanaIntermediateNode = pageNode;
          if (headingStack.length) {
            for (let idx = headingStack.length - 1; idx >= 0; idx--) {
              if (headingStack[idx].level < level) {
                parent = headingStack[idx].node;
                break;
              }
            }
          }
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(hnode);
          // adjust stack
          while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
            headingStack.pop();
          }
          headingStack.push({ level, node: hnode });
          this.summary.totalNodes += 1;
          this.summary.leafNodes += 1; // heading as leaf until it gets children
        }
        // reset list stack under new heading
        listStack = [];
        i++;
        continue;
      }

      // markdown table
      // Detect a table when current line looks like header with pipes and next line is a separator (---|:---: etc.)
      if (line.includes('|') && i + 1 < lines.length) {
        const headerLine = line.trim();
        const sepLine = lines[i + 1].trim();
        const isSeparatorLine = (ln: string) => {
          const raw = ln.trim();
          if (!raw.includes('-')) {
            return false;
          }
          // Strip one leading/trailing pipe if present
          const inner = raw.replace(/^\|/, '').replace(/\|$/, '');
          const segments = inner.split('|');
          // Each segment must be dashes with optional leading/trailing colon and spaces
          return segments.every((seg) => /^\s*:?-{3,}:?\s*$/.test(seg));
        };
        const isSep = isSeparatorLine(sepLine);
        if (isSep) {
          // parse header cells
          const splitCells = (ln: string) => {
            const raw = ln.trim();
            const inner = raw.startsWith('|') && raw.endsWith('|') ? raw.slice(1, -1) : raw.replace(/^\|/, '').replace(/\|$/, '');
            return inner.split('|').map((c) => c.trim());
          };
          const headers = splitCells(headerLine);
          // consume separator line
          i += 2;
          const rows: string[][] = [];
          while (i < lines.length) {
            const l = lines[i].trim();
            if (!l || !l.includes('|')) {
              break;
            }
            // stop if it looks like another separator (end of this table)
            const isAnotherSep = isSeparatorLine(l);
            if (isAnotherSep) {
              break;
            }
            const cells = splitCells(l);
            // If row has fewer cells, pad with empty strings; if more, slice
            const normalized = headers.map((_, idx) => (idx < cells.length ? cells[idx] : ''));
            rows.push(normalized);
            i++;
          }

          // Build table node structure: create a wrapper node named after the current parent (previous node)
                              const parent = getCurrentParent();
          if (!parent.children) {
            parent.children = [];
          }
          const tableWrapper = this.createNodeForImport({
            uid: idgenerator(),
            name: parent.name, // keep the name from the previous node
            createdAt: Date.now(),
            editedAt: Date.now(),
            type: 'node',
          });
          tableWrapper.viewType = 'table';
          tableWrapper.children = [];
          parent.children.push(tableWrapper);
          this.summary.totalNodes += 1;
          this.summary.leafNodes += 1;

          for (const r of rows) {
            const rowNode = this.createNodeForImport({
              uid: idgenerator(),
              name: r[0] || 'Row',
              createdAt: Date.now(),
              editedAt: Date.now(),
              type: 'node',
            });
            rowNode.children = [];
            tableWrapper.children.push(rowNode);
            this.summary.totalNodes += 1;
            this.summary.leafNodes += 1;

            headers.forEach((h, idx) => {
              if (idx === 0) {
                // First column is used as the row node name; skip creating a field for it
                return;
              }
              const fieldNode = this.createNodeForImport({
                uid: idgenerator(),
                name: h,
                createdAt: Date.now(),
                editedAt: Date.now(),
              });
              fieldNode.type = 'field';
              const valueNode = this.createNodeForImport({
                uid: idgenerator(),
                name: r[idx] || '',
                createdAt: Date.now(),
                editedAt: Date.now(),
                parentNode: fieldNode.uid,
              });
              fieldNode.children = [valueNode];
              rowNode.children!.push(fieldNode);
              this.summary.fields += 1;
              this.summary.totalNodes += 1; // field node itself
              this.ensureAttrMapIsUpdated(fieldNode);
            });
          }

          // After consuming table, continue the loop without advancing i here (we already moved i)
          continue;
        }
      }

      // list item
      const listMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
      if (listMatch) {
        const indent = listMatch[1].length; // number of spaces
        let content = listMatch[2];

        // checkbox
        let todoState: 'todo' | 'done' | undefined = undefined;
        const unchecked = content.match(/^\[ \]\s+(.*)$/);
        const checked = content.match(/^\[[xX]\]\s+(.*)$/);
        if (checked) {
          content = checked[1];
          todoState = 'done';
        } else if (unchecked) {
          content = unchecked[1];
          todoState = 'todo';
        }

        const createdChildren: TanaIntermediateNode[] = [];
        let nodeType: NodeType = 'node';
        let mediaUrl: string | undefined;

        // images: match all ![alt](...)
        // Use length limits to prevent catastrophic backtracking
        console.debug('[REGEX] Image regex matching in list item content (line ~1122):', JSON.stringify(content.substring(0, 2000)));
        const imageRegex = /!\[([^\]\n]{0,500})\]\(([^)\n]{1,1000})\)/g;
        const images: { full: string; url: string }[] = [];
        let m: RegExpExecArray | null;
        while ((m = imageRegex.exec(content)) !== null) {
          images.push({ full: m[0], url: m[2] });
        }
        if (images.length === 1 && content.trim() === images[0].full) {
          nodeType = 'image';
          mediaUrl = this.normalizeImageUrl(images[0].url, fileDir);
          content = 'image';
        } else if (images.length > 0) {
          for (const img of images) {
            const url = this.normalizeImageUrl(img.url, fileDir);
            const imgNode = this.createNodeForImport({
              uid: idgenerator(),
              name: 'image',
              createdAt: Date.now(),
              editedAt: Date.now(),
              type: 'image',
              url,
            });
            createdChildren.push(imgNode);
            content = content.replace(new RegExp(this.escapeRegExp(img.full), 'g'), `[[${imgNode.uid}]]`);
          }
        }

        // If content is a standalone date string, mark as date node
        if (this.isStandaloneDate(content.trim())) {
          nodeType = 'date';
        }

        // field lines (Foo:: Bar)
        const node = this.createNodeForImport({
          uid: idgenerator(),
          name: content,
          createdAt: Date.now(),
          editedAt: Date.now(),
          type: nodeType,
          url: mediaUrl,
        });
        if (todoState) {
          node.todoState = todoState;
        }
        if (createdChildren.length) {
          node.children = createdChildren;
          // also add refs to inline images
          node.refs = createdChildren.map((c) => c.uid);
        }

        // place into correct parent based on indent
        while (listStack.length && listStack[listStack.length - 1].indent >= indent) {
          listStack.pop();
        }
        const parent = listStack.length ? listStack[listStack.length - 1].node : getCurrentParent();
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
        listStack.push({ indent, node });

        this.summary.totalNodes += 1;
        this.summary.leafNodes += 1;

        // Convert Foo:: Bar into field structure
        if (node.type !== 'codeblock' && content.includes('::')) {
          this.summary.fields += 1;
          this.convertFieldLine(node, parent);
        }

        i++;
        continue;
      }

      // paragraph line: create a child node under current parent
      // If we were inside a list and this line is not indented, the list has ended
      // (Notion/Markdown often put a blank line before a top-level paragraph after a list.)
      if (listStack.length && /^\S/.test(line)) {
        listStack = [];
      }
      let paragraph = line;
      // inline code as text preserved; code detection using getCodeIfCodeblock if wrapped fully
      const code = getCodeIfCodeblock(paragraph);
      let type: NodeType = 'node';
      if (code) {
        paragraph = code;
        type = 'codeblock';
      }

      const csvWrappersForParagraph: TanaIntermediateNode[] = [];
      if (type !== 'codeblock') {
        const trimmed = paragraph.trim();
        // Use manual parser for standalone CSV match to avoid catastrophic backtracking
        const standaloneCsvMatch = this.parseMarkdownLinkAtStart(trimmed);
        if (standaloneCsvMatch && /\.csv(?:[?#]|$)/i.test(standaloneCsvMatch.link.trim())) {
          const parentForCsv = getCurrentParent();
          const tableWrapper = this.ensureCsvTableForLink(parentForCsv, fileDir, standaloneCsvMatch.link, standaloneCsvMatch.alias);
          if (tableWrapper) {
            i++;
            continue;
          }
        }
      }

      const parentForParagraph = getCurrentParent();
      if (type !== 'codeblock' && paragraph.includes('](')) {
        // Use manual parser instead of catastrophic regex
        paragraph = this.parseMarkdownLinks(paragraph, (alias: string, link: string) => {
          if (!/\.csv(?:[?#]|$)/i.test(link.trim())) {
            return `[${alias}](${link})`;
          }
          const wrapper = this.ensureCsvTableForLink(parentForParagraph, fileDir, link, alias);
          if (!wrapper) {
            return `[${alias}](${link})`;
          }
          csvWrappersForParagraph.push(wrapper);
          return `[[${wrapper.uid}]]`;
        });
      }

      // handle images in paragraph
      // Use length limits to prevent catastrophic backtracking
      console.debug('[REGEX] Image regex matching in paragraph (line ~1243):', JSON.stringify(paragraph.substring(0, 2000)));
      const imageRegex = /!\[([^\]\n]{0,500})\]\(([^)\n]{1,1000})\)/g;
      const imgs: { full: string; url: string }[] = [];
      let rm: RegExpExecArray | null;
      while ((rm = imageRegex.exec(paragraph)) !== null) {
        imgs.push({ full: rm[0], url: rm[2] });
      }
      const childNodes: TanaIntermediateNode[] = [];
      if (type !== 'codeblock' && imgs.length) {
        // If the entire paragraph is exactly one image, convert paragraph into an image node directly
        if (imgs.length === 1 && paragraph.trim() === imgs[0].full) {
          const url = this.normalizeImageUrl(imgs[0].url, fileDir);
          const parent = getCurrentParent();
          if (!parent.children) {
            parent.children = [];
          }
          const imgNode = this.createNodeForImport({
            uid: idgenerator(),
            name: 'image',
            createdAt: Date.now(),
            editedAt: Date.now(),
            type: 'image',
            url,
          });
          parent.children.push(imgNode);
          this.summary.totalNodes += 1;
          this.summary.leafNodes += 1;
          i++;
          continue; // skip normal paragraph creation
        }
        // Otherwise, treat inline images as children and replace with refs
        for (const img of imgs) {
          const url = this.normalizeImageUrl(img.url, fileDir);
          const imgNode = this.createNodeForImport({
            uid: idgenerator(),
            name: 'image',
            createdAt: Date.now(),
            editedAt: Date.now(),
            type: 'image',
            url,
          });
          paragraph = paragraph.replace(new RegExp(this.escapeRegExp(img.full), 'g'), `[[${imgNode.uid}]]`);
          childNodes.push(imgNode);
        }
      }

      // Standalone dates become date-type nodes
      if (type !== 'codeblock' && this.isStandaloneDate(paragraph.trim())) {
        type = 'date';
      }

      const pnode = this.createNodeForImport({
        uid: idgenerator(),
        name: paragraph,
        createdAt: Date.now(),
        editedAt: Date.now(),
        type,
      });
      if (childNodes.length) {
        pnode.children = childNodes;
        pnode.refs = childNodes.map((c) => c.uid);
      }
      const parent = parentForParagraph;
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(pnode);
      this.summary.totalNodes += 1;
      this.summary.leafNodes += 1;

      if (csvWrappersForParagraph.length) {
        const uniqueWrappers: TanaIntermediateNode[] = [];
        for (const w of csvWrappersForParagraph) {
          if (!uniqueWrappers.some((existing) => existing.uid === w.uid)) {
            uniqueWrappers.push(w);
          }
        }
        for (let idx = uniqueWrappers.length - 1; idx >= 0; idx--) {
          const wrapper = uniqueWrappers[idx];
          const children = parent.children || [];
          const nodeIndex = children.indexOf(pnode);
          const wrapperIndex = children.indexOf(wrapper);
          if (wrapperIndex !== -1 && nodeIndex !== -1 && wrapperIndex < nodeIndex) {
            const [removed] = children.splice(wrapperIndex, 1);
            const updatedNodeIndex = children.indexOf(pnode);
            if (removed) {
              children.splice(updatedNodeIndex + 1, 0, removed);
            }
          }
        }
      }

      // Convert fields outside lists too
      if (type !== 'codeblock' && paragraph.includes('::')) {
        this.summary.fields += 1;
        this.convertFieldLine(pnode, parent);
      }
      i++;
    }

    return pageNode;
  }

  private normalizeImageUrl(link: string, baseDir: string): string {
    if (/^https?:\/\//i.test(link)) {
      return link;
    }
    const decoded = this.safeDecode(link);
    const absDecoded = this.path.resolve(baseDir, decoded);
    const abs = this.path.resolve(baseDir, link);
    const mappedUrl = this.fileToUrlMap?.get(absDecoded);
    const url = mappedUrl ? mappedUrl : this.asFileUrl(abs);

    return url;
  }

  // Minimal CSV parser supporting quoted fields and commas
  private parseCsv(csv: string): { headers: string[]; rows: string[][] } {
    const lines: string[] = csv.split(/\r?\n/).filter((l) => l.length > 0);
    const parseLine = (line: string): string[] => {
      const out: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"') {
            if (i + 1 < line.length && line[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              inQuotes = false;
            }
          } else {
            cur += ch;
          }
        } else {
          if (ch === '"') {
            inQuotes = true;
          } else if (ch === ',') {
            out.push(cur);
            cur = '';
          } else {
            cur += ch;
          }
        }
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };
    if (!lines.length) {
      return { headers: [], rows: [] };
    }
    const headers = parseLine(lines[0]);
    const rows: string[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = parseLine(lines[i]);
      const normalized = headers.map((_, idx) => (idx < row.length ? row[idx] : ''));
      rows.push(normalized);
    }
    return { headers, rows };
  }

  private normalizeCsvCellValue(
    value: string,
    sourceDir: string,
  ): { text: string; refs: string[]; unresolvedTargets: string[] } {
    if (!value || !value.includes('(') || (!value.includes('.csv') && !value.includes('.md'))) {
      return { text: value, refs: [], unresolvedTargets: [] };
    }

    const refs: string[] = [];
    const unresolvedTargets: string[] = [];
    // Add length limits to prevent catastrophic backtracking on malformed input
    // Matches: text followed by (link.csv or link.md with optional query/fragment)
    // Allows one level of nested parentheses in the link part with strict limits
    console.debug('[REGEX] CSV cell value regex matching (line ~1421):', JSON.stringify(value.substring(0, 2000)));
    const csvLinkLikeRegex = /([^()\n]{1,200}?)\s*\(((?:[^()\n]|\([^()\n]{0,200}\)){1,500}?\.(?:csv|md)(?:[?#][^)\n]{0,100})?)\)/g;

    const text = value.replace(csvLinkLikeRegex, (full: string, _alias: string, target: string) => {
      const uid = this.resolveUidForLinkedPath(target, sourceDir);
      if (!uid) {
        unresolvedTargets.push(target);
        return full;
      }
      if (!refs.includes(uid)) {
        refs.push(uid);
      }
      return `[[${uid}]]`;
    });

    return { text, refs, unresolvedTargets };
  }

  private resolveUidForLinkedPath(linkTarget: string, sourceDir: string): string | undefined {
    const decodedTarget = this.safeDecode(linkTarget.trim());
    if (!decodedTarget) {
      return undefined;
    }
    const sanitizedTarget = this.stripQueryAndFragment(decodedTarget);
    if (!sanitizedTarget) {
      return undefined;
    }

    const absoluteTarget = this.ensureMarkdownExtension(this.path.resolve(sourceDir, sanitizedTarget));
    const normalizedAbsolute = this.normalizePathForComparison(absoluteTarget);
    const directUid = this.normalizedPathToUid.get(normalizedAbsolute);
    if (directUid) {
      return directUid;
    }

    const targetDir = this.path.dirname(absoluteTarget);
    const dirKey = this.normalizePathForComparison(targetDir);
    const dirEntries = this.dirToBasenameToUid.get(dirKey);
    if (dirEntries) {
      const base = this.path.basename(absoluteTarget);
      const baseWithoutExt = base.endsWith('.md') ? base.slice(0, -3) : base;
      const normalizedBase = this.normalizePathForComparison(baseWithoutExt);
      for (const [storedBase, uid] of dirEntries) {
        if (storedBase === normalizedBase || storedBase.startsWith(`${normalizedBase} `)) {
          return uid;
        }
      }
    }

    // Fallback: attempt a suffix match across known paths (rare)
    const normalizedSuffix = this.normalizePathForComparison(absoluteTarget);
    if (normalizedSuffix) {
      for (const [normalizedPath, uid] of this.normalizedPathToUid.entries()) {
        if (normalizedPath !== normalizedAbsolute && normalizedPath.endsWith(normalizedSuffix)) {
          return uid;
        }
      }
    }

    return undefined;
  }

  private findExistingPageUidForCsvRow(rowDisplayName: string, mdSiblingDir: string): string | undefined {
    const dirKey = this.normalizePathForComparison(mdSiblingDir);
    const dirEntries = this.dirToBasenameToUid.get(dirKey);
    if (!dirEntries) {
      return undefined;
    }
    const normalizedRow = this.normalizePathForComparison(rowDisplayName);
    for (const [storedBase, uid] of dirEntries) {
      if (storedBase === normalizedRow || storedBase.startsWith(`${normalizedRow} `)) {
        return uid;
      }
    }
    return undefined;
  }

  private stripQueryAndFragment(pathLike: string): string {
    return pathLike.replace(/[?#].*$/, '');
  }

  private ensureMarkdownExtension(pathLike: string): string {
    const stripped = this.stripQueryAndFragment(pathLike);
    if (/\.md$/i.test(stripped)) {
      return stripped;
    }
    if (/\.csv$/i.test(stripped)) {
      return stripped.replace(/\.csv$/i, '.md');
    }
    return stripped;
  }

  private normalizePathForComparison(pathLike: string): string {
    const withoutQuery = this.stripQueryAndFragment(pathLike)
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/');
    const stripDotSegments = withoutQuery
      .replace(/^(?:\.\/)+/, '')
      .replace(/^(?:\.\.\/)+/, '');
    return stripDotSegments.toLowerCase();
  }

  private resolvePendingCsvCellReferences() {
    if (!this.pendingCsvCellResolutions.length) {
      return;
    }

    for (const pending of this.pendingCsvCellResolutions) {
      const node = this.nodesForImport.get(pending.nodeUid);
      if (!node) {
        continue;
      }
      const normalizedCell = this.normalizeCsvCellValue(pending.rawValue, pending.sourceDir);
      node.name = normalizedCell.text;
      node.refs = normalizedCell.refs;
      this.originalNodeNames.set(node.uid, node.name);
      if (normalizedCell.unresolvedTargets.length) {
        this.summary.brokenRefs += normalizedCell.unresolvedTargets.length;
      }
    }

    this.pendingCsvCellResolutions = [];
  }

  private registerPagePath(absPath: string, uid: string) {
    const normalizedPath = this.normalizePathForComparison(absPath);
    this.normalizedPathToUid.set(normalizedPath, uid);

    const dir = this.path.dirname(absPath);
    const dirKey = this.normalizePathForComparison(dir);
    let mapForDir = this.dirToBasenameToUid.get(dirKey);
    if (!mapForDir) {
      mapForDir = new Map();
      this.dirToBasenameToUid.set(dirKey, mapForDir);
    }

    const baseName = this.path.basename(absPath);
    const baseWithoutExt = baseName.endsWith('.md') ? baseName.slice(0, -3) : baseName;
    mapForDir.set(this.normalizePathForComparison(baseName), uid);
    mapForDir.set(this.normalizePathForComparison(baseWithoutExt), uid);
  }

  private escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Recursively search for a file by basename under a directory
  private findFileByBasename(dir: string, base: string, visited?: Set<string>): string | undefined {
    const normalizedDir = this.normalizePathForComparison(dir);
    if (!visited) {
      visited = new Set();
    } else if (visited.has(normalizedDir)) {
      return undefined;
    }
    visited.add(normalizedDir);
    try {
      const entries = this.fileSystem.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = this.path.join(dir, e.name);
        if (e.isFile() && e.name === base) {
          return this.path.resolve(p);
        } else if (e.isDirectory()) {
          const found = this.findFileByBasename(p, base, visited);
          if (found) {
            return found;
          }
        }
      }
    } catch {
      // ignore
    }
    return undefined;
  }

  private isStandaloneDate(text: string): boolean {
    // ISO date YYYY-MM-DD
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    // US date MM-DD-YYYY
    const mdy = /^(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])-\d{4}$/;
    return iso.test(text) || mdy.test(text);
  }

  // Detect inline date values like "January 7, 2020 10:11 PM" or "Jan 7, 2020"
  private isInlineDateValue(text: string): boolean {
    const t = text.trim();

    // Don't treat URLs, HTML tags, or paths as dates
    if (t.includes('://') || t.includes('href=') || t.startsWith('<') || t.includes('/>')) {
      return false;
    }

    // Full month names
    const fullMonth =
      /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)?$/i;
    // Abbreviated month names
    const shortMonth =
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2},\s*\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)?$/i;
    if (fullMonth.test(t) || shortMonth.test(t)) {
      return true;
    }

    // Only use Date.parse for text that looks like it could be a date
    // (contains month name but not URL-like patterns)
    const monthPattern = /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)/i;
    if (!monthPattern.test(t)) {
      return false;
    }

    // Additional safety: exclude strings with slashes (likely paths/URLs) or excessive length
    if (t.includes('/') || t.length > 50) {
      return false;
    }

    const parsed = Date.parse(t);
    return !Number.isNaN(parsed);
  }

  private createNodeForImport(n: {
    parentNode?: string;
    uid: string;
    name: string;
    createdAt: number;
    editedAt: number;
    type?: NodeType;
    url?: string;
    refs?: string[];
  }): TanaIntermediateNode {
    const nodeForImport: TanaIntermediateNode = {
      uid: n.uid,
      name: n.name,
      createdAt: n.createdAt,
      editedAt: n.editedAt,
      type: n.type || 'node',
      mediaUrl: n.url,
    };

    nodeForImport.refs = n.refs || [];

    // collect refs from ((id)) and (((id))) patterns
    findGroups(nodeForImport.name, '(((', ')))').forEach((g) => {
      if (!nodeForImport.refs || !nodeForImport.refs.includes(g.content)) {
        if (!nodeForImport.refs) {
          nodeForImport.refs = [];
        }
        nodeForImport.refs.push(g.content);
      }
    });
    findGroups(nodeForImport.name, '((', '))').forEach((g) => {
      if (!g.content.includes('(')) {
        if (!nodeForImport.refs || !nodeForImport.refs.includes(g.content)) {
          if (!nodeForImport.refs) {
            nodeForImport.refs = [];
          }
          nodeForImport.refs.push(g.content);
        }
      }
    });

    if (!n.parentNode) {
      // For pages/sections, track top-level by name
      this.topLevelMap.set(n.name, nodeForImport);
    }
    this.nodesForImport.set(n.uid, nodeForImport);
    this.originalNodeNames.set(n.uid, nodeForImport.name);
    return nodeForImport;
  }

  private convertFieldLine(nodeWithField: TanaIntermediateNode, parentNode: TanaIntermediateNode) {
    const full = nodeWithField.name;
    // Split into multiple possible fields on separate lines in same bullet
    const fieldDefs: string[] = [];
    for (const line of full.split('\n')) {
      const m = line.match(/^(.+?)::/);
      if (m) {
        fieldDefs.push(m[1].replace('[[', '').replace(']]', ''));
      }
    }
    if (!fieldDefs.length) {
      return;
    }

    let currentFieldNode: TanaIntermediateNode | undefined = nodeWithField;
    for (const field of fieldDefs) {
      const value = this.getValueForAttribute(field, full) || '';
      if (!currentFieldNode) {
        currentFieldNode = this.createNodeForImport({
          uid: idgenerator(),
          name: field,
          createdAt: nodeWithField.createdAt,
          editedAt: nodeWithField.editedAt,
        });
        if (parentNode.children) {
          parentNode.children.push(currentFieldNode);
        }
      } else {
        currentFieldNode.name = field;
      }
      currentFieldNode.type = 'field';

      const links = getBracketLinks(value, false);
      let remaining = value;
      for (const l of links) {
        remaining = remaining.replace(`[[${l}]]`, '').trim();
      }
      const values: TanaIntermediateNode[] = [];
      // If value consists solely of bracket refs (possibly separated by commas/spaces),
      // create one value node per link
      const onlySeparatorsLeft = remaining.replace(/[\s,]+/g, '') === '';
      if (links.length > 0 && onlySeparatorsLeft) {
        for (const l of links) {
          values.push(
            this.createNodeForImport({
              uid: idgenerator(),
              name: `[[${l}]]`,
              createdAt: currentFieldNode.createdAt,
              editedAt: currentFieldNode.editedAt,
              parentNode: currentFieldNode.uid,
            }),
          );
        }
      } else {
        values.push(
          this.createNodeForImport({
            uid: idgenerator(),
            name: value,
            createdAt: currentFieldNode.createdAt,
            editedAt: currentFieldNode.editedAt,
            parentNode: currentFieldNode.uid,
          }),
        );
      }
      // Tag value nodes that look like dates
      for (const v of values) {
        if (this.isStandaloneDate(v.name) || this.isInlineDateValue(v.name)) {
          v.type = 'date';
        }
      }
      if (!currentFieldNode.children) {
        currentFieldNode.children = [];
      }
      for (const v of values) {
        currentFieldNode.children.push(v);
      }
      this.ensureAttrMapIsUpdated(currentFieldNode);
      currentFieldNode = undefined;
    }
  }

  private getValueForAttribute(fieldName: string, node: string): string | undefined {
    if (!node.includes('::')) {
      return undefined;
    }
    for (const line of node.split('\n')) {
      if (line.startsWith(`${fieldName}::`)) {
        return line.split(`${fieldName}::`)[1].trim();
      } else if (line.startsWith(`[[${fieldName}]]::`)) {
        return line.split(`[[${fieldName}]]::`)[1].trim();
      }
    }
  }

  private ensureAttrMapIsUpdated(node: TanaIntermediateNode): void {
    if (!node.name || node.type !== 'field') {
      return;
    }
    let intermediateAttr: TanaIntermediateAttribute | undefined = this.attrMap.get(node.name);
    if (!intermediateAttr) {
      intermediateAttr = { name: node.name, values: [], count: 0 };
    }
    if (node.children) {
      const newValues: string[] = node.children
        .map((c) => this.nodesForImport.get(c.uid)?.name)
        .filter((c) => c !== undefined) as string[];
      intermediateAttr.values.push(...newValues);
      intermediateAttr.count++;
    }
    this.attrMap.set(node.name, intermediateAttr);
  }

  private normalizeLinksAndSetAliases(nodeForImport: TanaIntermediateNode) {
    // block refs
    findGroups(nodeForImport.name, '(((', ')))').forEach((g: { content: string }) => {
      if (!nodeForImport.refs || !nodeForImport.refs.includes(g.content)) {
        if (!nodeForImport.refs) {
          nodeForImport.refs = [];
        }
        nodeForImport.refs.push(g.content);
      }
    });
    findGroups(nodeForImport.name, '((', '))').forEach((g: { content: string }) => {
      if (!g.content.includes('(')) {
        if (!nodeForImport.refs || !nodeForImport.refs.includes(g.content)) {
          if (!nodeForImport.refs) {
            nodeForImport.refs = [];
          }
          nodeForImport.refs.push(g.content);
        }
      }
    });

    if (!nodeForImport.refs) {
      return;
    }

    const refsToParse = [...nodeForImport.refs]
      .map((uid) => {
        const n = this.nodesForImport.get(uid);
        if (!n) {
          this.summary.brokenRefs += 1;
        }
        return n;
      })
      .filter((r) => !!r) as TanaIntermediateNode[];

    refsToParse.sort((a, b) => {
      const aLinkCount = (a.name.match(/\[/g) || []).length;
      const bLinkCount = (b.name.match(/\[/g) || []).length;
      return bLinkCount - aLinkCount;
    });

    for (const refNode of refsToParse) {
      let startIndex: number | undefined = undefined;
      let newNodeName: string | undefined = undefined;
      const refUID = refNode.uid;
      const originalRefName = this.originalNodeNames.get(refUID);

      if (nodeForImport.name.includes(`(((${refUID})))`)) {
        const refString = `(((${refUID})))`;
        startIndex = nodeForImport.name.indexOf(refString);
        newNodeName = nodeForImport.name.split(refString).join(`([[${refUID}]])`);
      } else if (nodeForImport.name.includes(`((${refUID}))`)) {
        const refString = `((${refUID}))`;
        startIndex = nodeForImport.name.indexOf(refString);
        newNodeName = nodeForImport.name.split(refString).join(`[[${refUID}]]`);
      } else if (nodeForImport.name.includes(`[[${refNode.name}]]`)) {
        const refString = `[[${refNode.name}]]`;
        startIndex = nodeForImport.name.indexOf(refString);
        newNodeName = nodeForImport.name.split(refString).join(`[[${refUID}]]`);
      } else if (originalRefName && nodeForImport.name.includes(`[[${originalRefName}]]`)) {
        const refString = `[[${originalRefName}]]`;
        startIndex = nodeForImport.name.indexOf(refString);
        newNodeName = nodeForImport.name.split(refString).join(`[[${refUID}]]`);
      }
      if (startIndex !== undefined && startIndex !== -1) {
        if (!isIndexWithinBackticks(startIndex, newNodeName)) {
          if (newNodeName !== undefined) {
            nodeForImport.name = newNodeName;
          }
        }
      }
    }
  }

  private fixBrokenLinks(nodeForImport: TanaIntermediateNode): TanaIntermediateNode[] {
    const createdNodes: TanaIntermediateNode[] = [];
    const outerLinks = getBracketLinks(nodeForImport.name, true);
    const allLinks = getBracketLinks(nodeForImport.name, false);
    const linksInsideOtherLinks = outerLinks.length ? allLinks.filter((l) => !outerLinks.includes(l)) : [];

    for (const link of linksInsideOtherLinks) {
      const refNode = this.findRefByName(link, nodeForImport);
      if (!refNode) {
        continue;
      }
      const index = nodeForImport.refs?.indexOf(refNode.uid) || -1;
      if (nodeForImport.refs && index > -1) {
        nodeForImport.refs.splice(index, 1);
      }
    }

    for (const link of outerLinks) {
      // Treat [[date:...]] as inline TIF date links — do not create nodes
      if (/^date:/i.test(link)) {
        continue;
      }
      // If link is already a known UID, just ensure it's in refs and skip creating anything
      if (this.nodesForImport.has(link)) {
        if (!nodeForImport.refs) {
          nodeForImport.refs = [];
        }
        if (!nodeForImport.refs.includes(link)) {
          nodeForImport.refs.push(link);
        }
        continue;
      }
      if (nodeForImport.children?.some((c) => c.name === link || c.uid === link)) {
        continue;
      }
      let refNode = this.findRefByName(link, nodeForImport);
      if (refNode) {
        continue;
      }

      // check existing top-level nodes by name
      refNode = this.topLevelMap.get(link);
      if (refNode) {
        if (!nodeForImport.refs) {
          nodeForImport.refs = [];
        }
        nodeForImport.refs.push(refNode.uid);
        continue;
      }

      // create a new node representing the link target
      refNode = this.createNodeForImport({
        uid: idgenerator(),
        name: link,
        createdAt: nodeForImport.createdAt,
        editedAt: nodeForImport.editedAt,
        parentNode: undefined,
        refs: nodeForImport.refs,
      });
      if (!nodeForImport.refs) {
        nodeForImport.refs = [];
      }
      nodeForImport.refs.push(refNode.uid);
      createdNodes.push(refNode);
    }

    // hashtags
    if (nodeForImport.name.includes('#')) {
      const re = /#\S+/g;
      const allTags = [...nodeForImport.name.matchAll(re)].filter((t) => {
        if (t.index === undefined) {
          return false;
        }
        if (isIndexWithinBackticks(t.index, nodeForImport.name)) {
          return false;
        }
        const signBeforeHash = nodeForImport.name.substring(t.index - 1, t.index);
        return !signBeforeHash || signBeforeHash === ' ';
      });
      for (const tag of allTags) {
        const onlyTagName = tag[0].substring(1).replace('?', '');
        if (tag[0].startsWith('#[[') || onlyTagName === '#' || onlyTagName === '>') {
          continue;
        }
        let refNode = this.topLevelMap.get(onlyTagName);
        if (!refNode) {
          refNode = this.createNodeForImport({
            uid: idgenerator(),
            name: onlyTagName,
            createdAt: nodeForImport.createdAt,
            editedAt: nodeForImport.editedAt,
          });
          createdNodes.push(refNode);
        }
        if (!nodeForImport.refs?.includes(refNode.uid)) {
          if (!nodeForImport.refs) {
            nodeForImport.refs = [];
          }
          nodeForImport.refs.push(refNode.uid);
        }
        nodeForImport.name = nodeForImport.name.replace('#' + onlyTagName, `[#${onlyTagName}]([[${refNode.uid}]])`);
      }
    }
    return createdNodes;
  }

  private findRefByName(refName: string, node: TanaIntermediateNode): TanaIntermediateNode | undefined {
    if (!node.refs) {
      return;
    }
    for (const uid of node.refs) {
      const refNode = this.nodesForImport.get(uid);
      if (!refNode) {
        continue;
      }
      if (refNode.name === refName) {
        return refNode;
      }
      const originalName = this.originalNodeNames.get(refNode.uid);
      if (originalName === refName) {
        return refNode;
      }
    }
    return undefined;
  }
}
