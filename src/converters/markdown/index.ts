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
import * as fs from 'fs';
import * as path from 'path';

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

type ParsedFile = { filePath: string; content: string };

export class MarkdownConverter implements IConverter {
  private nodesForImport: Map<string, TanaIntermediateNode> = new Map();
  private originalNodeNames: Map<string, string> = new Map();
  private attrMap: Map<string, TanaIntermediateAttribute> = new Map();
  private topLevelMap: Map<string, TanaIntermediateNode> = new Map();
  private mdPathToPageUid: Map<string, string> = new Map();
  private pageUidToBaseDir: Map<string, string> = new Map();

  private summary: TanaIntermediateSummary = {
    leafNodes: 0,
    topLevelNodes: 0,
    totalNodes: 0,
    calendarNodes: 0,
    fields: 0,
    brokenRefs: 0,
  };

  // IConverter — treat input as a single markdown file content
  convert(fileContent: string): TanaIntermediateFile | undefined {
    const pageNode = this.convertSingleFile({ filePath: 'document.md', content: fileContent });
    if (!pageNode) return undefined;

    const rootLevelNodes: TanaIntermediateNode[] = [pageNode];
    this.postProcessAllNodes(rootLevelNodes);
    return {
      version: 'TanaIntermediateFile V0.1',
      summary: this.summary,
      nodes: rootLevelNodes,
      attributes: [...this.attrMap.values()],
    };
  }

  // Directory mode — build a single TIF from all .md files under dir
  convertDirectory(dirPath: string): TanaIntermediateFile | undefined {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      return undefined;
    }
    const files: ParsedFile[] = [];
    const walk = (p: string) => {
      const entries = fs.readdirSync(p, { withFileTypes: true });
      for (const e of entries) {
        const fp = path.join(p, e.name);
        if (e.isDirectory()) {
          walk(fp);
        } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
          files.push({ filePath: fp, content: fs.readFileSync(fp, 'utf8') });
        }
      }
    };
    walk(dirPath);

    const rootLevelNodes: TanaIntermediateNode[] = [];
    for (const f of files) {
      const page = this.convertSingleFile(f);
      if (page) {
        const abs = path.resolve(f.filePath);
        this.mdPathToPageUid.set(abs, page.uid);
        this.pageUidToBaseDir.set(page.uid, path.dirname(abs));
        rootLevelNodes.push(page);
      }
    }
    this.postProcessAllNodes(rootLevelNodes);
    return {
      version: 'TanaIntermediateFile V0.1',
      summary: this.summary,
      nodes: rootLevelNodes,
      attributes: [...this.attrMap.values()],
    };
  }

  private postProcessAllNodes(rootLevelNodes: TanaIntermediateNode[]) {
    // First, convert relative markdown page/file links into internal refs or file:// anchors
    for (const top of rootLevelNodes) {
      const baseDir = this.pageUidToBaseDir.get(top.uid);
      if (!baseDir) continue;
      this.convertRelativeLinksRecursively(top, baseDir);
    }

    // Then fix links + normalize + HTML for non-codeblock nodes
    for (const [, node] of this.nodesForImport) {
      if (node.type === 'codeblock') continue;
      const newNodes = this.fixBrokenLinks(node);
      if (newNodes?.length) {
        rootLevelNodes.push(...newNodes);
      }
      this.normalizeLinksAndSetAliases(node);
      node.name = markdownToHTML(node.name);
    }
  }

  private convertRelativeLinksRecursively(node: TanaIntermediateNode, baseDir: string) {
    if (node.type !== 'codeblock' && node.name?.includes('](')) {
      node.name = node.name.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_full, alias: string, link: string) => {
        // external links left as-is; handled by markdownToHTML later
        if (/^[a-z]+:\/\//i.test(link) || link.startsWith('mailto:')) return _full;
        const decoded = this.safeDecode(link);
        const abs = path.resolve(baseDir, decoded);
        if (abs.toLowerCase().endsWith('.md')) {
          const uid = this.mdPathToPageUid.get(abs);
          if (uid) {
            if (!node.refs) node.refs = [];
            if (!node.refs.includes(uid)) node.refs.push(uid);
            return `[${alias}]([[${uid}]])`;
          }
          // If not found, fall back to filename as link text
          return `[${alias}](${this.asFileUrl(abs)})`;
        }
        // other files => make file:// link
        return `<a href="${this.asFileUrl(abs)}">${alias}</a>`;
      });
    }
    if (node.children) {
      for (const c of node.children) this.convertRelativeLinksRecursively(c, baseDir);
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

  private convertSingleFile(file: ParsedFile): TanaIntermediateNode | undefined {
    const baseName = path.basename(file.filePath, path.extname(file.filePath));
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
    let i = 0;
    // heading stack for proper nesting
    const headingStack: { level: number; node: TanaIntermediateNode }[] = [];
    // list stack tracks indentation based on leading spaces count
    let listStack: { indent: number; node: TanaIntermediateNode }[] = [];

    const fileDir = path.dirname(file.filePath);

    const getCurrentParent = () => {
      if (listStack.length) return listStack[listStack.length - 1].node;
      if (headingStack.length) return headingStack[headingStack.length - 1].node;
      return pageNode;
    };

    // Front matter (YAML-like) at file start
    if (lines[i]?.trim() === '---') {
      i++;
      const fmStart = i;
      const fm: Record<string, string | string[]> = {};
      let currentKey: string | null = null;
      while (i < lines.length && lines[i].trim() !== '---') {
        const l = lines[i];
        const kv = l.match(/^([A-Za-z0-9_ \-]+):\s*(.*)$/);
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
      if (i < lines.length && lines[i].trim() === '---') i++;
      // Create fields from fm
      for (const [key, val] of Object.entries(fm)) {
        const fieldNode = this.createNodeForImport({
          uid: idgenerator(),
          name: key,
          createdAt: pageNode.createdAt,
          editedAt: pageNode.editedAt,
        });
        fieldNode.type = 'field';
        if (!pageNode.children) pageNode.children = [];
        pageNode.children.push(fieldNode);
        let children: TanaIntermediateNode[] = [];
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
        if (i < lines.length && /^\s*```\s*$/.test(lines[i])) i++;
        const content = `\n${codeLines.join('\n')}\n`;
        const cb = this.createNodeForImport({
          uid: idgenerator(),
          name: content,
          createdAt: Date.now(),
          editedAt: Date.now(),
          type: 'codeblock',
        });
        if (lang) cb.codeLanguage = lang;
        const parent = getCurrentParent();
        if (!parent.children) parent.children = [];
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
          pageNode.flags = ['section'];
          // Treat page node as the heading node at this level
          while (headingStack.length && headingStack[headingStack.length - 1].level >= level) headingStack.pop();
          headingStack.push({ level, node: pageNode });
          firstHeadingUsedAsTitle = true;

          // Consume optional blank lines then any consecutive "Key: Value" metadata lines as fields
          let j = i + 1;
          // allow one or more blank lines after the title
          while (j < lines.length && lines[j].trim() === '') j++;
          const kvRegex = /^([A-Za-z0-9 _\-\/#&+']+):\s+(.+)$/;
          let consumedAny = false;
          while (j < lines.length) {
            const m = lines[j].match(kvRegex);
            if (!m) break;
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
            fieldNode.children = [valueNode];
            if (!pageNode.children) pageNode.children = [];
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
          if (!parent.children) parent.children = [];
          parent.children.push(hnode);
          // adjust stack
          while (headingStack.length && headingStack[headingStack.length - 1].level >= level) headingStack.pop();
          headingStack.push({ level, node: hnode });
          this.summary.totalNodes += 1;
          this.summary.leafNodes += 1; // heading as leaf until it gets children
        }
        // reset list stack under new heading
        listStack = [];
        i++;
        continue;
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
        const imageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
        const images: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = imageRegex.exec(content)) !== null) {
          images.push(m[1]);
        }
        if (images.length === 1 && content.trim() === `![](${images[0]})`) {
          nodeType = 'image';
          mediaUrl = this.normalizeImageUrl(images[0], fileDir);
          content = 'image';
        } else if (images.length > 0) {
          for (const img of images) {
            const url = this.normalizeImageUrl(img, fileDir);
            const imgNode = this.createNodeForImport({
              uid: idgenerator(),
              name: 'image',
              createdAt: Date.now(),
              editedAt: Date.now(),
              type: 'image',
              url,
            });
            createdChildren.push(imgNode);
            content = content.replace(new RegExp(this.escapeRegExp(`![](${img})`), 'g'), `[[${imgNode.uid}]]`);
          }
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
        if (todoState) node.todoState = todoState;
        if (createdChildren.length) {
          node.children = createdChildren;
          // also add refs to inline images
          node.refs = createdChildren.map((c) => c.uid);
        }

        // place into correct parent based on indent
        while (listStack.length && listStack[listStack.length - 1].indent >= indent) listStack.pop();
        const parent = listStack.length ? listStack[listStack.length - 1].node : getCurrentParent();
        if (!parent.children) parent.children = [];
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
      let paragraph = line;
      // inline code as text preserved; code detection using getCodeIfCodeblock if wrapped fully
      const code = getCodeIfCodeblock(paragraph);
      let type: NodeType = 'node';
      if (code) {
        paragraph = code;
        type = 'codeblock';
      }

      // handle images in paragraph
      const imageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
      const imgs: string[] = [];
      let rm: RegExpExecArray | null;
      while ((rm = imageRegex.exec(paragraph)) !== null) imgs.push(rm[1]);
      const childNodes: TanaIntermediateNode[] = [];
      if (type !== 'codeblock' && imgs.length) {
        for (const img of imgs) {
          const url = this.normalizeImageUrl(img, fileDir);
          const imgNode = this.createNodeForImport({
            uid: idgenerator(),
            name: 'image',
            createdAt: Date.now(),
            editedAt: Date.now(),
            type: 'image',
            url,
          });
          paragraph = paragraph.replace(new RegExp(this.escapeRegExp(`![](${img})`), 'g'), `[[${imgNode.uid}]]`);
          childNodes.push(imgNode);
        }
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
      const parent = getCurrentParent();
      if (!parent.children) parent.children = [];
      parent.children.push(pnode);
      this.summary.totalNodes += 1;
      this.summary.leafNodes += 1;

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
    if (/^https?:\/\//i.test(link)) return link;
    // Assume local file path; resolve and prefix with file://
    const abs = path.resolve(baseDir, link);
    return `file://${abs}`;
  }

  private escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
        if (!nodeForImport.refs) nodeForImport.refs = [];
        nodeForImport.refs.push(g.content);
      }
    });
    findGroups(nodeForImport.name, '((', '))').forEach((g) => {
      if (!g.content.includes('(')) {
        if (!nodeForImport.refs || !nodeForImport.refs.includes(g.content)) {
          if (!nodeForImport.refs) nodeForImport.refs = [];
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
      if (m) fieldDefs.push(m[1].replace('[[', '').replace(']]', ''));
    }
    if (!fieldDefs.length) return;

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
        if (parentNode.children) parentNode.children.push(currentFieldNode);
      } else {
        currentFieldNode.name = field;
      }
      currentFieldNode.type = 'field';

      const links = getBracketLinks(value, false);
      let remaining = value;
      for (const l of links) remaining = remaining.replace(`[[${l}]]`, '').trim();
      const values: TanaIntermediateNode[] = [];
      if (remaining.length === 0) {
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
      if (!currentFieldNode.children) currentFieldNode.children = [];
      for (const v of values) currentFieldNode.children.push(v);
      this.ensureAttrMapIsUpdated(currentFieldNode);
      currentFieldNode = undefined;
    }
  }

  private getValueForAttribute(fieldName: string, node: string): string | undefined {
    if (!node.includes('::')) return undefined;
    for (const line of node.split('\n')) {
      if (line.startsWith(`${fieldName}::`)) {
        return line.split(`${fieldName}::`)[1].trim();
      } else if (line.startsWith(`[[${fieldName}]]::`)) {
        return line.split(`[[${fieldName}]]::`)[1].trim();
      }
    }
  }

  private ensureAttrMapIsUpdated(node: TanaIntermediateNode): void {
    if (!node.name || node.type !== 'field') return;
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
        if (!nodeForImport.refs) nodeForImport.refs = [];
        nodeForImport.refs.push(g.content);
      }
    });
    findGroups(nodeForImport.name, '((', '))').forEach((g: { content: string }) => {
      if (!g.content.includes('(')) {
        if (!nodeForImport.refs || !nodeForImport.refs.includes(g.content)) {
          if (!nodeForImport.refs) nodeForImport.refs = [];
          nodeForImport.refs.push(g.content);
        }
      }
    });

    if (!nodeForImport.refs) return;

    const refsToParse = [...nodeForImport.refs]
      .map((uid) => {
        const n = this.nodesForImport.get(uid);
        if (!n) this.summary.brokenRefs += 1;
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
          if (newNodeName !== undefined) nodeForImport.name = newNodeName;
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
      if (!refNode) continue;
      const index = nodeForImport.refs?.indexOf(refNode.uid) || -1;
      if (nodeForImport.refs && index > -1) nodeForImport.refs.splice(index, 1);
    }

    for (const link of outerLinks) {
      if (nodeForImport.children?.some((c) => c.name === link || c.uid === link)) {
        continue;
      }
      let refNode = this.findRefByName(link, nodeForImport);
      if (refNode) continue;

      // check existing top-level nodes by name
      refNode = this.topLevelMap.get(link);
      if (refNode) {
        if (!nodeForImport.refs) nodeForImport.refs = [];
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
      if (!nodeForImport.refs) nodeForImport.refs = [];
      nodeForImport.refs.push(refNode.uid);
      createdNodes.push(refNode);
    }

    // hashtags
    if (nodeForImport.name.includes('#')) {
      const re = /#\S+/g;
      const allTags = [...nodeForImport.name.matchAll(re)].filter((t) => {
        if (t.index === undefined) return false;
        if (isIndexWithinBackticks(t.index, nodeForImport.name)) return false;
        const signBeforeHash = nodeForImport.name.substring(t.index - 1, t.index);
        return !signBeforeHash || signBeforeHash === ' ';
      });
      for (const tag of allTags) {
        const onlyTagName = tag[0].substring(1).replace('?', '');
        if (tag[0].startsWith('#[[') || onlyTagName === '#' || onlyTagName === '>') continue;
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
          if (!nodeForImport.refs) nodeForImport.refs = [];
          nodeForImport.refs.push(refNode.uid);
        }
        nodeForImport.name = nodeForImport.name.replace('#' + onlyTagName, `[#${onlyTagName}]([[${refNode.uid}]])`);
      }
    }
    return createdNodes;
  }

  private findRefByName(refName: string, node: TanaIntermediateNode): TanaIntermediateNode | undefined {
    if (!node.refs) return;
    for (const uid of node.refs) {
      const refNode = this.nodesForImport.get(uid);
      if (!refNode) continue;
      if (refNode.name === refName) return refNode;
      const originalName = this.originalNodeNames.get(refNode.uid);
      if (originalName === refName) return refNode;
    }
    return undefined;
  }
}
