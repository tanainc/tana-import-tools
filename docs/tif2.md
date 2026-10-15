# Tana Intermediate Format 2.1

Tana Intermediate Format, or TIF, is JSON for importing structured content into a new Tana Outliner workspace. You can write it yourself, generate it with a script, or export it from Tana Outliner.

A declaration creates a new node. A reference reuses a declared node or links to an existing node outside the file. Importing never updates existing nodes.

## Try an import

1. Download [project.tif.json](../samples/tif2/project.tif.json).
2. Open the user menu in Tana Outliner and choose **Import content**.
3. Choose **Tana Intermediate Format** and select the file.
4. Open the new workspace and review any warnings.

The example creates a project supertag, a Status field with two options, and a launch plan. It needs no existing node IDs.

To export a workspace, open its home node's ellipsis menu and choose **Export workspace as JSON**. Select **Tana Intermediate Format 2.1**. The workspace must finish loading before this option is available. Import the resulting `.tif.json` file to create an editable copy.

## File structure

```json
{
  "version": "TanaIntermediateFile V2.1",
  "contents": {
    "workspace": {
      "children": [{ "name": "Hello from Tana" }]
    }
  }
}
```

Use the exact version string. `contents` is required; its members are optional:

| Member            | Destination in the new workspace               |
| ----------------- | ---------------------------------------------- |
| `workspace`       | Workspace home                                 |
| `inbox`           | Inbox                                          |
| `library`         | Library                                        |
| `schema`          | Schema, usually supertag and field definitions |
| `additionalRoots` | Array of nodes placed under the workspace root |

Each named container is a regular node with an optional `children` array. Its name is ignored. Its `id` or `uid`, if present, lets other nodes reference the destination container. Containers cannot be references.

## Notes and references

An ordinary note needs only `name`. Add `children` to nest content, `description` for a description, or `isSection: true` for a heading. Omitting `type` means `node`.

Set `isDone` to `false` for an unchecked todo or `true` for a checked todo. Omit it for a note without a checkbox.

Use `uid` to give a node a file-local label:

```json
{
  "name": "Research",
  "children": [
    { "uid": "source", "name": "Original source" },
    { "name": "Summary of [[source]]" },
    { "name": "Reading list", "children": [{ "isRef": true, "uid": "source" }] }
  ]
}
```

The last child references Original source. It does not create another copy. References can appear before declarations.

To link to an existing node, use `{ "isRef": true, "id": "EXISTING_NODE_ID" }`. A reference needs exactly one of `id` or `uid`. It never searches for a node by name.

| Input                                   | Imported result                           |
| --------------------------------------- | ----------------------------------------- |
| Declaration with `uid`                  | New node; references to that label use it |
| Declaration with `id`                   | New copy with a fresh ID                  |
| Reference to an ID declared in the file | The imported copy                         |
| Reference to an ID outside the file     | The existing node                         |
| Reference to a missing `uid`            | Import error                              |

A declaration can have both `id` and `uid`. References through either use the new copy. Importing the same file again creates another workspace and another set of copies.

Use unique, non-empty `uid` labels. IDs must be 1 to 79 characters drawn from letters, digits, `_`, `-`, `@`, and `=`. Prefer explicit `{ "uid": "..." }` references for file-local links so misspelled labels cause an error.

An inaccessible external target remains linked and can appear as unknown. The importer reports a warning. Importing grants no access to the source workspace and does not add it to cross-workspace search.

## Supertags and fields

Declare a supertag with `type: "supertag"` and a reusable field definition with `type: "fieldDefinition"`. Place field entries in the same ordered `children` array as ordinary notes:

```json
{
  "version": "TanaIntermediateFile V2.1",
  "contents": {
    "schema": {
      "children": [
        { "type": "supertag", "uid": "project", "name": "project" },
        { "type": "fieldDefinition", "uid": "budget", "name": "Budget", "dataType": "number" }
      ]
    },
    "workspace": {
      "children": [
        {
          "name": "Launch plan",
          "tags": [{ "uid": "project" }],
          "children": [
            { "name": "Scope" },
            { "type": "field", "field": { "uid": "budget" }, "values": [500] },
            { "name": "Next steps" }
          ]
        }
      ]
    }
  }
}
```

This creates a Launch plan tagged `#project`, with Scope, Budget: 500, and Next steps in that order.

A field's `field` property always references a separately declared definition. Declare each definition once under `schema.children` or in an `inlineNodes` map. Definitions need an `id` or `uid`; names do not select or merge definitions.

To reuse existing schema, use `tags: [{ "id": "EXISTING_TAG_ID" }]` or `field: { "id": "EXISTING_FIELD_ID" }`. Find schema IDs through **Show API schema** on a supertag.

Field values can be nodes, strings, numbers, or booleans. Strings and numbers become literal text; booleans become Yes/No references. Use `{ "name": "See [[source]]" }` for a value with formatting or mentions. An empty `values` array creates an empty field.

Supported `dataType` codes are `list`, `number`, `integer`, `boolean`, `date`, `user`, `instance`, `formula`, `url`, `email`, and `options`. Omit the code for a plain field. Data types describe the definition; they do not parse or validate the text in a value.

### Options and inline nodes

An `inlineNodes` map declares nodes outside the visible outline. Each entry has its own `id` or `uid`; the map key does not declare an identity. The containing node owns declarations in the map. Entries marked `isRef: true` reference nodes declared elsewhere.

For an options field, declare owned options in the definition's `inlineNodes`. `fixedOptionIds` lists them in display order:

```json
{
  "type": "fieldDefinition",
  "uid": "status",
  "name": "Status",
  "dataType": "options",
  "fixedOptionIds": [{ "uid": "planned" }, { "uid": "active" }],
  "inlineNodes": {
    "planned": { "uid": "planned", "name": "Planned" },
    "active": { "uid": "active", "name": "Active" }
  }
}
```

Use `{ "type": "field", "field": { "uid": "status" }, "values": [{ "isRef": true, "uid": "planned" }] }` to select Planned. Field definitions cannot have outline children.

A supertag can keep a local definition and use it for an empty default field:

```json
{
  "type": "supertag",
  "uid": "task",
  "name": "task",
  "inlineNodes": {
    "estimate": { "type": "fieldDefinition", "uid": "estimate", "name": "Estimate", "dataType": "number" }
  },
  "children": [{ "type": "field", "field": { "uid": "estimate" }, "values": [] }]
}
```

Other nodes can reference Estimate by the same `uid`. A field occurrence can also own a definition through its own `inlineNodes`. Its `field` property still references that declaration.

### Expanded schema references

Exports include readable metadata in schema references:

```json
{
  "type": "field",
  "field": {
    "type": "fieldDefinition",
    "id": "EXISTING_FIELD_ID",
    "isRef": true,
    "nameParts": [{ "type": "text", "text": "Budget" }],
    "dataType": "number"
  },
  "values": [500]
}
```

The expanded `fieldDefinition` requires `isRef: true`. Its metadata describes the target without declaring or owning it. `field`, `tags`, `extends`, and `fixedOptionIds` are always references. Repeated reference metadata does not create duplicate declarations.

Supertags use `extends` to reference parent supertags. Exported `baseTypes` labels describe built-in base types such as `meeting`, `person`, or `task`; import uses `extends` to establish inheritance.

## Names and formatting

Choose `name` or `nameParts` on a node. Using both is an error.

String names support `**bold**`, `__italic__`, `~~strikethrough~~`, `^^highlight^^`, and backtick code spans. Mentions inside code spans stay literal. Use `[label](https://example.com)` for web links, `[label]([[source]])` for mention aliases, and `[[date:2026-10-15]]` for inline dates.

Mentions resolve a file-local `uid` first, then an ID declared in the file, then an existing ID. HTML in names and mention aliases is escaped. Only `http:`, `https:`, and `mailto:` links become clickable. A node stores one mention alias per target; later mentions with a different alias stay literal text.

Exports use structured `nameParts`. Text parts store HTML-escaped text, so use `&lt;` for a literal `<` and `&amp;` for a literal `&`. The importer decodes it once. Use string `name` for plain text when authoring files.

For example:

```json
{
  "nameParts": [
    { "type": "text", "text": "Read ", "formats": ["bold"] },
    { "type": "node", "nodeId": "EXISTING_NODE_ID" },
    { "type": "text", "text": " before " },
    { "type": "date", "date": "2026-10-15" }
  ]
}
```

| Part type | Properties                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------- |
| `text`    | `text`; optional `formats`: `bold`, `italic`, `underline`, `strikethrough`, `highlight`, `code` |
| `node`    | `nodeId`, referencing an owned source ID or an existing ID                                      |
| `date`    | `date`                                                                                          |
| `user`    | `user`                                                                                          |
| `link`    | `url`, `text`                                                                                   |

## Code and media

Set `plainText: true` for literal code source:

```json
{ "type": "codeBlock", "language": "html", "plainText": true, "content": "<p>&amp;</p>" }
```

Without that flag, the importer decodes HTML entities in `content`. An exported `alias` is stored text markup and is sanitized on import.

Use `type: "url"` with `url` for a URL node, or `type: "visual"` with `url` for media. Media stays linked to its URL. TIF does not embed or copy attachment bytes.

## Export and import limits

Importing an export creates an editable copy. Its declared supertags, fields, options and content receive fresh IDs, and references within the file use those copies. References outside the workspace keep pointing at their original targets.

Exports declare owned definitions and options in `inlineNodes` when they live outside the outline. Unreadable schema can appear as `{ "type": "external", "id": "EXISTING_FIELD_ID" }`; the field keeps its values and the reference remains linked on import.

| Input                                | Imported result                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Computed values                      | Plain text, without a computation runtime                                                         |
| Search, chat, journal parts          | Static outlines, without live queries, chat runtime, or calendar placement                        |
| Chat replies                         | Linear messages become siblings; branches stay nested                                             |
| Transcripts                          | Speaker text; timing is dropped                                                                   |
| `childrenOmitted`                    | Omitted content cannot be recovered; warning                                                      |
| Unknown field data type              | Plain field; warning                                                                              |
| Inaccessible external node or schema | Link remains; target may appear unknown                                                           |
| Appearance and context metadata      | Not restored, including `color`, `avatar`, `backgroundImageUrl`, `workspaceId`, and chat `author` |

Workspace membership, settings, views and automations are not restored. **Tana JSON**, the other JSON export option, contains Tana's full stored representation for technical use. It is a separate format and cannot be imported through the TIF importer.

Invalid JSON, malformed references, duplicate declarations or children, missing local references, invalid schema roles, copying built-in `SYS_` nodes, and nesting deeper than 1000 levels stop the import. Reference cycles are allowed; ownership remains a tree. A rejected file does not create a workspace.

## TypeScript

The [public types](../src/types/types.ts) are exported from the package entry point. Build the checkout with `npm run build` before using them:

```typescript
import type { TanaIntermediateFile } from 'tana-import-tools';

const file = {
  version: 'TanaIntermediateFile V2.1',
  contents: {
    workspace: { children: [{ uid: 'hello', name: 'Hello from TypeScript' }] },
  },
} satisfies TanaIntermediateFile;

const json = JSON.stringify(file, null, 2);
```

Types help you author files. Tana Outliner validates the JSON on import, including constraints TypeScript cannot check, such as unique identities and matching reference roles.
