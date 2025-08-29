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


test('Converts tables', () => {
  const [file] = importMarkdownDir('tables');
  const page = file.nodes.find((n) => n.name === 'Tables')!;

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

  // Page title
  expect(page.name).toBe('Tables');

  // Find the container node (previous heading before the table)
  const containerNode = findByName(page, 'People');
  expect(containerNode).toBeDefined();

  // Should have rows named by the first column
  const aliceRow = findByName(containerNode!, 'Alice');
  const bobRow = findByName(containerNode!, 'Bob');
  expect(aliceRow).toBeDefined();
  expect(bobRow).toBeDefined();

  // Each row should have Age as a field with proper values
  const findField = (n: TanaIntermediateNode | undefined, fieldName: string): TanaIntermediateNode | undefined => {
    return (n?.children || []).find((c) => c.type === 'field' && c.name === fieldName);
  };

  const aliceAge = findField(aliceRow, 'Age');
  const bobAge = findField(bobRow, 'Age');
  expect(aliceAge?.children?.[0].name).toBe('30');
  expect(bobAge?.children?.[0].name).toBe('25');
});

test('Empty tables produce a single wrapper with empty rows, not repeated tables', () => {
  const [file] = importMarkdownDir('tables');
  const page = file.nodes.find((n) => n.name === 'Empty Table');
  expect(page).toBeDefined();

  // Find the container node (section)
  const findByName = (n: TanaIntermediateNode, name: string): TanaIntermediateNode | undefined => {
    if (n.name === name) {
      return n;
    }
    for (const c of n.children || []) {
      const f = findByName(c, name);
      if (f) { return f; }
    }
  };
  const container = findByName(page!, 'Schedule');
  expect(container).toBeDefined();

  // There should be exactly one table wrapper under the container having same name
  const wrappers = (container?.children || []).filter((c) => c.name === container!.name);
  expect(wrappers.length).toBe(1);

  const wrapper = wrappers[0];
  // It should have exactly 5 row nodes (one per empty row)
  const rows = wrapper.children || [];
  expect(rows.length).toBe(5);
  // Each row should have two columns: first column forms the row name (empty => 'Row'),
  // and second column is a field named 'To-do' with empty value
  for (const r of rows) {
    expect(typeof r.name).toBe('string');
    expect(r.children?.some((c) => c.type === 'field' && c.name === 'To-do')).toBe(true);
  }
});


test('Standalone CSV link is converted into a table', () => {
  const [file, findById] = importMarkdownDir('csv_pages');
  // The page title should be set to the first heading
  const page = file.nodes.find((n) => n.name === 'Routines');
  expect(page).toBeDefined();

  // Find the container node (section) named Routines
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

  const containerNode = findByName(page!, 'Routines');
  expect(containerNode).toBeDefined();

  // The converter creates a table wrapper node under the current parent with the same name as the parent
  const wrapper = (containerNode?.children || []).find((c) => c.name === containerNode!.name && (c.children || []).length);
  expect(wrapper).toBeDefined();

  // Helper to find a field by name
  const findField = (n: TanaIntermediateNode | undefined, fieldName: string): TanaIntermediateNode | undefined => {
    return (n?.children || []).find((c) => c.type === 'field' && c.name === fieldName);
  };

  // Rows expected from the CSV (first column "Name")
  const expectedRows = ['Skincare', 'Morning routine', 'Night time routine', 'Workout', 'Sunday routine'];
  for (const rowName of expectedRows) {
    // Find each row by resolving its refs to the target page named rowName
    const rowNode = (wrapper!.children || []).find((c) => (c.refs || []).some((uid) => findById(uid)?.name === rowName));
    expect(rowNode, `Row ${rowName} should exist`).toBeDefined();

    // The title should now be only the UID reference: [[<uid>]]
    expect((rowNode?.refs || []).length, `Row ${rowName} should have at least one ref`).toBeGreaterThan(0);
    const rowRefUid = rowNode!.refs![0];
    expect(rowNode!.name).toBe(`[[${rowRefUid}]]`);

    // Check that Created field exists and is populated (from CSV second column)
    const created = findField(rowNode, 'Created');
    expect(created?.children?.[0].name).toContain('August 8, 2025 9:13 AM');

    // Tags header exists in CSV but values are empty in fixture
    const tags = findField(rowNode, 'Tags');
    expect(tags?.children?.[0].name).toBe('');

    // The row node itself should reference the corresponding page
    const rowRefTarget = findById(rowRefUid);
    expect(rowRefTarget?.name, `Row ${rowName} ref should resolve to a page named ${rowName}`).toBe(rowName);
  }
});
