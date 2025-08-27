import { expect, test } from 'vitest';
import { expectImage } from '../../../testUtils/testUtils.js';
import { importMarkdownDir } from './testUtils.js';
import { TanaIntermediateNode } from '../../../types/types.js';
import * as path from 'node:path';

test('Headings and bullets', () => {
  const [file, , fn] = importMarkdownDir('headings');
  // one page per file; page title should come from first heading
  expect(file.summary.topLevelNodes).toBe(1);
  const page = file.nodes[0];
  expect(page.name).toBe('Header 1');
  // headings flagged as sections
  const h1 = fn('Header 1');
  expect(h1?.flags).toEqual(['section']);
  const h2 = fn('Header 2');
  expect(h2?.flags).toEqual(['section']);
  // bullet items under headings
  const child = h1?.children?.find((c) => c.name === 'First bullet');
  expect(child).toBeDefined();
});

test('Todos and fields', () => {
  const [file, , fn] = importMarkdownDir('todos_fields');
  const todo = fn('a todo item');
  expect(todo?.todoState).toBe('todo');
  const done = fn('done item');
  expect(done?.todoState).toBe('done');
  // field created
  const field = fn('Owner');
  expect(field?.type).toBe('field');
  expect(field?.children?.[0].name).toMatch(/^\[\[/); // value is a link
  expect(file.attributes?.find((a) => a.name === 'Owner')?.count).toBeGreaterThan(0);
  // paragraph field
  const pf = fn('Status');
  expect(pf?.type).toBe('field');
  expect(pf?.children?.[0].name).toBe('Open');
});

test('Images and links', () => {
  const [file, f, fn] = importMarkdownDir('images_links');
  // single image line
  const img = fn('image');
  expect(img?.type).toBe('image');
  expect(img?.mediaUrl?.startsWith('https://')).toBe(true);
  // multiple inline images: find a node with two image children
  const page = file.nodes.find((n) => n.name === 'Media')!;
  const findHost = (n: any): any | undefined => {
    if (n.children && n.children.filter((c: any) => c.type === 'image').length === 2) {
      return n;
    }
    for (const c of n.children || []) {
      const h = findHost(c);
      if (h) {
        return h;
      }
    }
  };
  const host: any = findHost(page);
  expect(host).toBeDefined();
  expect(host.children.length).toBe(2);
  expectImage(host.children[0].uid, 'https://tana.inc/photo/1', f);
  // external link anchor
  const linkLine = fn('Plain link: <a href="https://www.vg.no">alias</a>');
  expect(linkLine).toBeDefined();
});

test('Codeblocks', () => {
  const [, , fn] = importMarkdownDir('codeblocks');
  const block = fn('\nconst tana = "cool";\n');
  expect(block?.type).toBe('codeblock');
  expect(block?.codeLanguage).toBe('javascript');
});

test('Local images get file://', () => {
  const [file] = importMarkdownDir('local_images');
  const collect: any[] = [];
  const walk = (n: any) => {
    if (n.type === 'image' && typeof n.mediaUrl === 'string' && n.mediaUrl.startsWith('file://')) {
      collect.push(n);
    }
    for (const c of n.children || []) {
      walk(c);
    }
  };
  for (const top of file.nodes) {
    walk(top);
  }
  expect(collect.length).toBeGreaterThan(0);
});

test('Mapped images get replaced URL', () => {
  const image = path.resolve(__dirname, 'fixtures/local_images/img.png');
  const [file] = importMarkdownDir('local_images', new Map<string, string>([[image, "http://localhost/img.png"]]));
  const collect: any[] = [];
  const walk = (n: any) => {
    if (n.type === 'image' && typeof n.mediaUrl === 'string' && n.mediaUrl.startsWith('http://localhost')) {
      collect.push(n);
    }
    for (const c of n.children || []) {
      walk(c);
    }
  };
  for (const top of file.nodes) {
    walk(top);
  }
  expect(collect.length).toBeGreaterThan(0);
});

test('Front matter is converted to fields and first heading used as title', () => {
  const [file, , fn] = importMarkdownDir('frontmatter');
  const page = file.nodes[0];
  expect(page.name).toBe('Frontmatter Title');
  const author = fn('Author');
  expect(author?.type).toBe('field');
  expect(author?.children?.[0].name).toBe('Jane Doe');
  const tags = fn('Tags');
  expect(tags?.type).toBe('field');
  expect(tags?.children?.map((c) => c.name)).toEqual(['project', 'work']);
});

test('Links to other pages and files', () => {
  const [file] = importMarkdownDir('links/pages');
  const pageA = file.nodes.find((n) => n.name === 'A');
  const pageB = file.nodes.find((n) => n.name === 'B');
  expect(pageA).toBeDefined();
  expect(pageB).toBeDefined();
  const uidB = pageB!.uid;
  const findNode = (n: any): any | undefined => {
    if (Array.isArray(n.refs) && n.refs.includes(uidB)) {
      return n;
    }
    for (const c of n.children || []) {
      const res = findNode(c);
      if (res) {
        return res;
      }
    }
  };
  const linkNode: any = findNode(pageA!);
  expect(linkNode).toBeDefined();
  expect(linkNode.refs).toContain(uidB);
  const findCsv = (n: any): any | undefined => {
    if (typeof n.name === 'string' && /<a href="file:\/\/.+\/assets\/data\.csv">CSV<\/a>/.test(n.name)) {
      return n;
    }
    for (const c of n.children || []) {
      const res = findCsv(c);
      if (res) {
        return res;
      }
    }
  };
  const csvNode: any = findCsv(pageA!);
  expect(csvNode).toBeDefined();
});

test('Links to other pages and external files', () => {
  const abs = path.resolve(__dirname, 'fixtures/links/pages/assets/data.csv');
  const [file] = importMarkdownDir('links/pages', new Map([[abs, "http://localhost/assets/data.csv"]]));
  const pageA = file.nodes.find((n) => n.name === 'A');
  const pageB = file.nodes.find((n) => n.name === 'B');
  expect(pageA).toBeDefined();
  expect(pageB).toBeDefined();
  const uidB = pageB!.uid;
  const findNode = (n: any): any | undefined => {
    if (Array.isArray(n.refs) && n.refs.includes(uidB)) {
      return n;
    }
    for (const c of n.children || []) {
      const res = findNode(c);
      if (res) {
        return res;
      }
    }
  };
  const linkNode: any = findNode(pageA!);
  expect(linkNode).toBeDefined();
  expect(linkNode.refs).toContain(uidB);
  const findCsv = (n: any): any | undefined => {
    if (typeof n.name === 'string' && /<a href="http:\/\/localhost\/assets\/data\.csv">CSV<\/a>/.test(n.name)) {
      return n;
    }
    for (const c of n.children || []) {
      const res = findCsv(c);
      if (res) {
        return res;
      }
    }
  };
  const csvNode: any = findCsv(pageA!);
  expect(csvNode).toBeDefined();
});

test('Top-of-page Key: Value lines become fields', () => {
  const [file, , fn] = importMarkdownDir('csv_pages');
  const page = file.nodes.find((n) => n.name === 'Call mom');
  expect(page).toBeDefined();
  const dateField = fn('Date Created');
  expect(dateField?.type).toBe('field');
  expect(dateField?.children?.[0].name).toContain('January');
  expect(dateField?.children?.[0].type).toBe('date');
  const statusField = fn('Status');
  expect(statusField?.type).toBe('field');
  expect(statusField?.children?.[0].name).toBe('Doing');
});

test('Inline date fields and standalone date nodes', () => {
  const [, , fn] = importMarkdownDir('inline_dates');

  const dateField = fn('Date Created');
  expect(dateField?.type).toBe('field');
  expect(dateField?.children?.[0].type).toBe('date');

  const isoDate = fn('2022-02-10');
  expect(isoDate?.type).toBe('date');

  const mdyDate = fn('02-09-2022');
  expect(mdyDate?.type).toBe('date');
});

test('Top-level paragraph after list is not nested', () => {
  const [file] = importMarkdownDir('notion_gs');
  const page = file.nodes[0];

  const findByName = (n: TanaIntermediateNode, name: string): TanaIntermediateNode | undefined => {
    if (n.name === name) {
      return n;
    }
    for (const c of n.children || []) {
      const f = findByName(c, name);
      if (f) {
        return f;
      }
    }
  };
  const bullet = findByName(page, 'Create subpages in byside a page');
  expect(bullet).toBeDefined();

  const hasQuestionAsChild = (bullet?.children || []).some((c) => c.name.includes('Have a question?'));
  expect(hasQuestionAsChild).toBe(false);
});
