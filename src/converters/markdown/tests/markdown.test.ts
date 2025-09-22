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
  expect(file.homeRefIds).toEqual([page.uid]);
  expect(page.name).toBe('Header 1');
  // first heading stays as page title without section flag, subsequent headings flagged as sections
  const h1 = fn('Header 1');
  expect((h1?.flags ?? []).includes('section')).toBe(false);
  const h2 = fn('Header 2');
  expect(h2?.flags).toEqual(['section']);
  // bullet items under headings
  const child = h1?.children?.find((c) => c.name === 'First bullet');
  expect(child).toBeDefined();
});

test('Todos and fields', () => {
  const [file, , fn] = importMarkdownDir('todos_fields');
  const page = fn('Tasks');
  expect(page).toBeDefined();
  expect(file.homeRefIds).toContain(page!.uid);
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

test('Directory conversion sets home nodes from shallowest markdown files', () => {
  const [file, , findByName] = importMarkdownDir('csv_pages_links');
  const rootNode = findByName('indyRIOT');
  const projectNode = findByName('Notion import tool');
  const memberNode = findByName('Eirik Hoem');

  expect(rootNode).toBeDefined();
  expect(projectNode).toBeDefined();
  expect(memberNode).toBeDefined();

  const homeIds = new Set(file.homeRefIds);
  expect(homeIds.has(rootNode!.uid)).toBe(true);
  expect(homeIds.has(projectNode!.uid)).toBe(false);
  expect(homeIds.has(memberNode!.uid)).toBe(false);
  expect(homeIds.size).toBe(1);
});

test('Images and links', () => {
  const [file, f, fn] = importMarkdownDir('images_links');
  const mediaPage = file.nodes.find((n) => n.name === 'Media');
  expect(mediaPage).toBeDefined();
  expect(file.homeRefIds).toContain(mediaPage!.uid);
  // single image line
  const img = fn('image');
  expect(img?.type).toBe('image');
  expect(img?.mediaUrl?.startsWith('https://')).toBe(true);
  // multiple inline images: find a node with two image children
  const page = mediaPage!;
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

test('Image conversion: standalone image tokens become image nodes (list and paragraph), inline remains child', () => {
  const [file] = importMarkdownDir('images_links');
  const page = file.nodes.find((n) => n.name === 'Media')!;
  expect(file.homeRefIds).toContain(page.uid);

  // Collect all image nodes and map by URL
  const images: Record<string, any[]> = {};
  const hosts: any[] = [];
  const walk = (n: any) => {
    if (n.type === 'image' && typeof n.mediaUrl === 'string') {
      images[n.mediaUrl] = images[n.mediaUrl] || [];
      images[n.mediaUrl].push(n);
    }
    if (Array.isArray(n.children) && n.children.some((c: any) => c.type === 'image')) {
      hosts.push(n);
    }
    for (const c of n.children || []) {
      walk(c);
    }
  };
  walk(page);

  // 1) List item that is exactly one image with alt should be an image node itself
  const listImage = (images['https://tana.inc/photo/3'] || [])[0];
  expect(listImage, 'Expected a direct image node for list item with alt').toBeDefined();
  expect(listImage.type).toBe('image');

  // 2) Paragraph that is exactly one image should produce an image node directly (no wrapping text node)
  const paraImage = (images['https://tana.inc/photo/4'] || [])[0];
  expect(paraImage, 'Expected a direct image node for standalone paragraph image').toBeDefined();
  expect(paraImage.type).toBe('image');

  // 3) Inline image with surrounding text should remain a child image, not convert the host to image
  // Find a host node that references https://tana.inc/photo/5
  const hostWithInline = hosts.find((h) => (h.children || []).some((c: any) => c.type === 'image' && c.mediaUrl === 'https://tana.inc/photo/5'));
  expect(hostWithInline, 'Expected a text node hosting an inline image child').toBeDefined();
  expect(hostWithInline.type).not.toBe('image');
  const inlineChild = (hostWithInline.children || []).find((c: any) => c.type === 'image' && c.mediaUrl === 'https://tana.inc/photo/5');
  expect(inlineChild).toBeDefined();
  // And the host should keep the textual content (contains the phrase "Inline with text before")
  expect(typeof hostWithInline.name).toBe('string');
  expect(String(hostWithInline.name)).toContain('Inline with text before');
});

test('Codeblocks', () => {
  const [, , fn] = importMarkdownDir('codeblocks');
  const block = fn('\nconst tana = "cool";\n');
  expect(block?.type).toBe('codeblock');
  expect(block?.codeLanguage).toBe('javascript');
});

test('Local images get file://', () => {
  const [file] = importMarkdownDir('local_images');
  const page = file.nodes.find((n) => n.name === 'Local');
  expect(page).toBeDefined();
  expect(file.homeRefIds).toContain(page!.uid);
  expect(file.homeRefIds?.length).toBe(1);
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
  const page = file.nodes.find((n) => n.name === 'Local');
  expect(page).toBeDefined();
  expect(file.homeRefIds).toContain(page!.uid);
  expect(file.homeRefIds?.length).toBe(1);
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
  expect(file.homeRefIds).toContain(file.nodes[0].uid);
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
  expect(file.homeRefIds).toContain(pageA!.uid);
  expect(file.homeRefIds).not.toContain(pageB!.uid);
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
  const csvWrapper = pageA?.children?.find((n: any) =>
    (n.children || []).some((row: any) => (row.children || []).some((field: any) => field.type === 'field')),
  );
  expect(csvWrapper, 'Expected CSV table wrapper under page A').toBeDefined();
  const csvUid = csvWrapper!.uid;
  expect(csvWrapper!.name).toBe('CSV');

  const findChildByPrefix = (prefix: string) =>
    (pageA?.children || []).find((child: any) => typeof child.name === 'string' && child.name.startsWith(prefix));

  const inlineCsv = findChildByPrefix('Also a file');
  expect(inlineCsv, 'Expected inline CSV reference node').toBeDefined();
  expect(typeof inlineCsv!.name).toBe('string');
  expect(inlineCsv!.name).toMatch(/^Also a file: \[\[[a-z0-9]+\]\]$/);
  expect(inlineCsv!.refs).toContain(csvUid);

  const inlineCsvWithAlias = findChildByPrefix('Another file link to file');
  expect(inlineCsvWithAlias, 'Expected inline CSV reference node with alias').toBeDefined();
  expect(inlineCsvWithAlias!.name).toContain(`[[${csvUid}]]`);
  expect(inlineCsvWithAlias!.refs).toContain(csvUid);

  const tableRows = csvWrapper!.children || [];
  expect(tableRows.length).toBeGreaterThan(0);
  const firstRow = tableRows[0];
  expect(firstRow.name).toBe('1');
  const nameField = (firstRow.children || []).find((c: any) => c.type === 'field' && c.name === 'name');
  expect(nameField, 'Expected name field from CSV header').toBeDefined();
  expect(nameField!.children?.[0].name).toBe('alpha');
});

test('Links to other pages and external files', () => {
  const abs = path.resolve(__dirname, 'fixtures/links/pages/assets/data.csv');
  const [file] = importMarkdownDir('links/pages', new Map([[abs, "http://localhost/assets/data.csv"]]));
  const pageA = file.nodes.find((n) => n.name === 'A');
  const pageB = file.nodes.find((n) => n.name === 'B');
  expect(pageA).toBeDefined();
  expect(pageB).toBeDefined();
  expect(file.homeRefIds).toContain(pageA!.uid);
  expect(file.homeRefIds).not.toContain(pageB!.uid);
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
  const csvWrapper = pageA?.children?.find((n: any) =>
    (n.children || []).some((row: any) => (row.children || []).some((field: any) => field.type === 'field')),
  );
  expect(csvWrapper).toBeDefined();
  const csvUid = csvWrapper!.uid;
  expect(csvWrapper!.name).toBe('CSV');

  const findChildByPrefix = (prefix: string) =>
    (pageA?.children || []).find((child: any) => typeof child.name === 'string' && child.name.startsWith(prefix));

  const inlineCsv = findChildByPrefix('Also a file');
  expect(inlineCsv).toBeDefined();
  expect(inlineCsv!.name).toMatch(/^Also a file: \[\[[a-z0-9]+\]\]$/);
  expect(inlineCsv!.refs).toContain(csvUid);

  const inlineCsvWithAlias = findChildByPrefix('Another file link to file');
  expect(inlineCsvWithAlias).toBeDefined();
  expect(inlineCsvWithAlias!.name).toContain(`[[${csvUid}]]`);
  expect(inlineCsvWithAlias!.refs).toContain(csvUid);

  const tableRows = csvWrapper!.children || [];
  expect(tableRows.length).toBeGreaterThan(0);
  const firstRow = tableRows[0];
  expect(firstRow.name).toBe('1');
  const nameField = (firstRow.children || []).find((c: any) => c.type === 'field' && c.name === 'name');
  expect(nameField).toBeDefined();
  expect(nameField!.children?.[0].name).toBe('alpha');
});

test('CSV links without alias use Table fallback name', () => {
  const [file] = importMarkdownDir('links/pages');
  const noAliasPage = file.nodes.find((n) => n.name === 'No alias');
  expect(noAliasPage).toBeDefined();
  const tableWrapper = noAliasPage?.children?.find((child: any) =>
    (child.children || []).some((row: any) => (row.children || []).some((field: any) => field.type === 'field')),
  );
  expect(tableWrapper, 'Expected CSV table wrapper created from unnamed link').toBeDefined();
  expect(tableWrapper!.name).toBe('Table');
});

test('Duplicate names under root become references to root nodes', () => {
  const [file] = importMarkdownDir('csv_pages_links');
  const asgeirNode = file.nodes.find((n) => n.name === 'Asgeir Hoem');
  const experimentalUiNode = file.nodes.find((n) => n.name === 'ExperimentalUI');
  expect(asgeirNode).toBeDefined();
  expect(experimentalUiNode).toBeDefined();

  const assignedToNode = experimentalUiNode?.children?.find((n) => n.name === 'Assigned To');
  expect(assignedToNode?.children?.length).toBe(1);

  const assigneeNode = assignedToNode?.children?.at(0);
  expect(assigneeNode?.name).toBe(`[[${asgeirNode!.uid}]]`);
  expect(assigneeNode?.refs).toContain(asgeirNode!.uid);
});

test('CSV cell references resolve to markdown pages', () => {
  const [file, , findByName] = importMarkdownDir('csv_pages_links');
  const indy = file.nodes.find((n) => n.name === 'indyRIOT');
  expect(indy).toBeDefined();

  const csvWrappers = (indy!.children || []).filter((child) =>
    Array.isArray(child.children) && child.children.length > 0,
  );
  expect(csvWrappers.length).toBeGreaterThanOrEqual(2);

  const notionNode = findByName('Notion import tool');
  const experimentalUiNode = findByName('ExperimentalUI');
  expect(notionNode).toBeDefined();
  expect(experimentalUiNode).toBeDefined();

  const eirikNode = file.nodes.find((n) => n.name === 'Eirik Hoem');
  const asgeirNode = file.nodes.find((n) => n.name === 'Asgeir Hoem');
  expect(eirikNode).toBeDefined();
  expect(asgeirNode).toBeDefined();

  const teamMembersWrapper = csvWrappers.find((wrapper) =>
    (wrapper.children || []).some((row) => (row.refs || []).includes(eirikNode!.uid)),
  );
  expect(teamMembersWrapper).toBeDefined();

  const eirikRow = (teamMembersWrapper!.children || []).find((row) => (row.refs || []).includes(eirikNode!.uid));
  expect(eirikRow).toBeDefined();
  expect((eirikRow!.children || []).length).toBe(0);

  const roadMapWrapper = csvWrappers.find((wrapper) =>
    (wrapper.children || []).some((row) => (row.refs || []).includes(notionNode!.uid)),
  );
  expect(roadMapWrapper).toBeDefined();

  const notionRow = (roadMapWrapper!.children || []).find((row) => (row.refs || []).includes(notionNode!.uid));
  expect(notionRow).toBeDefined();
  expect((notionRow!.children || []).length).toBe(0);

  const notionPageTeamField = (notionNode!.children || []).find(
    (child) => child.type === 'field' && child.name.trim() === 'Team members',
  );
  expect(notionPageTeamField).toBeDefined();
  const notionPageValues = notionPageTeamField!.children || [];
  expect(notionPageValues.length).toBeGreaterThan(0);
  expect(notionPageValues.some((child) => child.refs?.includes(eirikNode!.uid))).toBe(true);
  expect(notionPageValues.some((child) => child.refs?.includes(asgeirNode!.uid))).toBe(true);

  const workingOnFieldOnMember = (eirikNode!.children || []).find(
    (child) => child.type === 'field' && child.name.trim() === 'Working on',
  );
  expect(workingOnFieldOnMember).toBeDefined();
  const memberWorkingRefs = (workingOnFieldOnMember!.children || []).flatMap((val) => val.refs || []);
  expect(memberWorkingRefs).toEqual(expect.arrayContaining([notionNode!.uid]));
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

test('CSV pages first-line headings are treated as titles without section flags', () => {
  const [file, , findByName] = importMarkdownDir('csv_pages');
  const routinesPage = findByName('Routines');
  expect(routinesPage).toBeDefined();
  expect((routinesPage?.flags ?? []).includes('section')).toBe(false);
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

  // The converter creates a table wrapper node under the current parent referencing the parent page
  const wrapper = (containerNode?.children || []).find((c) => (c.refs || []).includes(containerNode!.uid));
  expect(wrapper).toBeDefined();
  expect(wrapper?.name).toBe(`[[${containerNode!.uid}]]`);

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

    // Rows that resolve to markdown pages should no longer duplicate the CSV fields
    expect((rowNode!.children || []).length).toBe(0);

    // Check that Created field exists and is populated (from CSV second column)
    const rowRefTarget = findById(rowRefUid);
    expect(rowRefTarget?.name, `Row ${rowName} ref should resolve to a page named ${rowName}`).toBe(rowName);

    const created = findField(rowRefTarget, 'Created');
    expect(created?.children?.[0].name).toContain('August 8, 2025 9:13 AM');

    // Tags header exists in CSV but values are empty in fixture
    const tags = findField(rowRefTarget, 'Tags');
    expect(tags?.children?.[0].name || '').toBe('');
  }
});


test('CSV and markdown inline references are resolved to inline refs and multi-refs create separate nodes', () => {
  const [file, findById, findByName] = importMarkdownDir('csv_pages_links');

  const root = findByName('indyRIOT');
  expect(root).toBeDefined();

  const findField = (n: TanaIntermediateNode | undefined, fieldName: string): TanaIntermediateNode | undefined => {
    return (n?.children || []).find((c) => c.type === 'field' && c.name.trim() === fieldName);
  };

  const projectPage = findByName('Notion import tool');
  expect(projectPage).toBeDefined();
  const teamField = findField(projectPage, 'Team members');
  expect(teamField).toBeDefined();
  const expectedMembers = new Map([
    ['Eirik Hoem', false],
    ['Asgeir Hoem', false],
  ]);
  for (const value of teamField!.children || []) {
    const valueName = String(value.name);
    expect(valueName).toMatch(/^\[\[[a-z0-9]+\]\]$/);
    const valueUid = (valueName.match(/\[\[([a-z0-9]+)\]\]/) || [])[1];
    const target = findById(valueUid);
    expect(target, 'Team member reference should resolve').toBeDefined();
    if (target?.name && expectedMembers.has(String(target.name))) {
      expectedMembers.set(String(target.name), true);
    }
  }
  expectedMembers.forEach((seen, member) => {
    expect(seen, `Expected Team members to include reference to ${member}`).toBe(true);
  });

  const memberPage = file.nodes.find((n) => n.name === 'Asgeir Hoem');
  expect(memberPage).toBeDefined();
  const workingOnField = findField(memberPage, 'Working on');
  expect(workingOnField).toBeDefined();
  const expectedProjects = new Map([
    ['Notion import tool', false],
    ['ExperimentalUI', false],
  ]);
  for (const value of workingOnField!.children || []) {
    const valueName = String(value.name);
    expect(valueName).toMatch(/^\[\[[a-z0-9]+\]\]$/);
    const valueUid = (valueName.match(/\[\[([a-z0-9]+)\]\]/) || [])[1];
    const target = findById(valueUid);
    expect(target, 'Working on reference should resolve').toBeDefined();
    if (target?.name && expectedProjects.has(String(target.name))) {
      expectedProjects.set(String(target.name), true);
    }
    expect((value.children || []).length, 'Inline reference nodes should not duplicate CSV fields').toBe(0);
  }
  expectedProjects.forEach((seen, project) => {
    expect(seen, `Expected Working on to include reference to ${project}`).toBe(true);
  });

  const csvWrappers = (root!.children || []).filter(
    (child) =>
      Array.isArray(child.children) &&
      child.children.some((row) => Array.isArray(row.refs) && row.refs.length > 0),
  );
  expect(csvWrappers.length).toBeGreaterThan(0);
  for (const wrapper of csvWrappers) {
    for (const row of wrapper.children || []) {
      if (!Array.isArray(row.refs) || row.refs.length === 0) {
        continue;
      }
      const rowName = String(row.name);
      expect(rowName).toMatch(/^\[\[[a-z0-9]+\]\]$/);
      const rowUid = (rowName.match(/\[\[([a-z0-9]+)\]\]/) || [])[1];
      const target = findById(rowUid);
      expect(target, 'Row reference should resolve to markdown page').toBeDefined();
      expect((row.children || []).length, 'Row that resolves to a markdown page should not duplicate CSV fields').toBe(0);
    }
  }
});

test('Markdown links with parentheses in URL are handled without breaking text', () => {
  const [file] = importMarkdownDir('links/parentheses');
  const page = file.nodes.find((n) => n.name === 'Parentheses Links');
  expect(page).toBeDefined();

  const findByContent = (n: TanaIntermediateNode, needle: string): TanaIntermediateNode | undefined => {
    if (typeof n.name === 'string' && n.name.includes(needle)) {
      return n;
    }
    for (const c of n.children || []) {
      const r = findByContent(c, needle);
      if (r) { return r; }
    }
  };

  const para = findByContent(page!, 'Vision, Mission, Values');
  expect(para).toBeDefined();
  const name = String(para!.name);
  // Should be a single proper anchor covering the full markdown link with parentheses in URL
  expect(name).toMatch(/<a href="file:\/\/.+Whereby \(1\) \/Vision, Mission, Values\.md">Vision, Mission, Values<\/a>/);
  // And it should end with the anchor (no trailing plaintext like ")" or leftover URL-encoded bits)
  expect(name.trim().endsWith('</a>')).toBe(true);
  expect(name).not.toContain('md)');
});

test('Markdown link alias ending with comma converts without hanging', () => {
  const [file] = importMarkdownDir('link_text_comma');
  const page = file.nodes.find((n) => n.name === 'Meeting Rituals');
  expect(page).toBeDefined();

  const bullet = (page?.children || []).find((child) =>
    typeof child.name === 'string' && child.name.includes('From the team at Lattice'),
  );
  expect(bullet, 'Expected bullet with trailing-comma link alias').toBeDefined();

  const rendered = String(bullet!.name);
  expect(rendered).toContain(
    '<a href="https://engineering-lattice.webflow.io/article/designing-team-rituals">From the team at Lattice,</a>',
  );
  // Ensure the remainder of the sentence is preserved (including emphasis markers)
  expect(rendered).toContain('they *"call this ritual our Monday');
  // Guard against duplicate anchor insertion (would indicate looping behaviour)
  expect(rendered.split('<a ').length - 1).toBe(1);
});
