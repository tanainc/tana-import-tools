# Tana Intermediate Format 2

Tana Intermediate Format 2, or TIF2, is JSON for importing structured content into a new Tana Outliner workspace. You can write it yourself, generate it with a script, or export it from Tana Outliner. It supports outlines, references, supertags, and fields.

Every node the file defines becomes a new node. A reference to a node outside the file keeps pointing to that existing node. Importing never updates existing nodes or restores a workspace in place.

## Try an import

1. Download [project.tif.json](../samples/tif2/project.tif.json).
2. In Tana Outliner, open the user menu and choose **Import content**.
3. Choose **Tana Intermediate Format** and select the file.
4. Open the new workspace and review any import warnings.

The example creates a `#project` supertag, a Status field with Planned and Active options, and a launch plan. It uses only file-local references, so it needs no existing schema or node IDs.

To export a workspace, open its home node's ellipsis menu and choose JSON export. Select **Tana Intermediate Format 2** in the export dialog. The workspace must finish loading before this option is available. The resulting `.tif.json` file can be imported the same way.

If the format chooser is absent, TIF2 export is not yet available for your account.

## File structure

```json
{
  "version": "TanaIntermediateFile V2",
  "contents": {
    "workspace": {
      "children": [{ "name": "Hello from TIF2" }]
    }
  }
}
```

Use the exact version string. `contents` is required. Its members are optional:

| Member            | Destination in the new workspace               |
| ----------------- | ---------------------------------------------- |
| `workspace`       | Workspace home                                 |
| `inbox`           | Inbox                                          |
| `library`         | Library                                        |
| `schema`          | Schema, usually supertag and field definitions |
| `additionalRoots` | Array of nodes placed under the workspace root |

Each named container is a regular node with an optional `children` array. Its name is ignored. Its `id` or `uid`, if present, lets other nodes reference the destination container. A container cannot be a reference or have a type other than `node`.

TIF2 has no required summary, timestamps, or top-level `nodes` array.

## Nodes and references

An ordinary node can be as small as `{ "name": "A note" }`. Omitting `type` means `node`. Nodes can also have `description`, `children`, `tags`, `isSection`, and `inlineNodes`.

Set `isDone` to `false` for an unchecked todo, or `true` for a checked todo. Omit it for a node without a checkbox.

### File-local labels

Use `uid` to label a definition. A reference uses `isRef: true` and the same `uid`:

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

The last child references Original source. It does not create another copy. Definitions may appear after their references. Use non-empty, unique labels.

### Existing node IDs and copies

Use an existing Tana node ID when you want to reuse content or schema from another workspace:

```json
{ "isRef": true, "id": "EXISTING_NODE_ID" }
```

`{ "type": "external", "id": "EXISTING_NODE_ID" }` is also a reference. References need exactly one of `id` or `uid`.

| Input                                        | Result                             |
| -------------------------------------------- | ---------------------------------- |
| Definition with `uid`                        | New node; the label resolves to it |
| Definition with `id`                         | New copy with a fresh ID           |
| Reference to an `id` defined in the file     | The imported copy                  |
| Reference to an `id` not defined in the file | The existing node                  |
| Reference to a missing `uid`                 | Import error                       |

A definition may have both `id` and `uid`. References through either resolve to its new copy. Reimporting the file creates another workspace and another set of copies. Links elsewhere in Tana Outliner still point to the original nodes.

If an external node is inaccessible, deleted, or no longer has its expected supertag or field role, the importer keeps the link and reports a warning. The link can appear as unknown. Importing does not grant access to the source workspace or add it to cross-workspace search.

Duplicate definitions and duplicate children are errors. Reference cycles are allowed; defining the same node twice is not. Built-in `SYS_` nodes can only be referenced, and the referenced system node must exist with the expected role.

`id` values must be 1 to 79 characters drawn from letters, digits, `_`, `-`, `@`, and `=`. File-local `uid` labels do not have the node ID character restriction. Prefer explicit `{ "uid": "..." }` references when generating files, so a misspelled label cannot be mistaken for an external ID.

## Names and formatting

Choose `name` or `nameParts` on each node. Using both is an error.

### String names

`name` is text with the following formatting:

| Syntax                              | Result                                          |
| ----------------------------------- | ----------------------------------------------- |
| `**bold**`                          | Bold                                            |
| `__italic__`                        | Italic                                          |
| `~~deleted~~`                       | Strikethrough                                   |
| `^^highlight^^`                     | Highlight                                       |
| `` `code` ``                        | Literal code span; mentions inside stay literal |
| `[Tana](https://outliner.tana.inc)` | Web link                                        |
| `[[source]]`                        | Node mention                                    |
| `[short label]([[source]])`         | Node mention with an alias                      |
| `[[date:2026-10-15]]`               | Inline date                                     |

For `[[source]]`, the importer looks for a `uid` first, then an `id` defined in the file, then an existing node ID. It never matches node names. HTML in `name` and mention labels is escaped. Only `http:`, `https:`, and `mailto:` links become clickable.

A node stores one mention alias per target. If a later mention of the same target uses a different alias, that later mention stays literal text.

### Structured names

Exports use `nameParts`. These avoid parsing formatting syntax:

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

| Part type | Properties                                     |
| --------- | ---------------------------------------------- |
| `text`    | `text`; optional `formats` array               |
| `node`    | `nodeId`, an owned or external ID, not a `uid` |
| `date`    | `date` string                                  |
| `user`    | `user` string                                  |
| `link`    | `text` and `url`                               |

Text formats are `bold`, `underline`, `strikethrough`, `italic`, `highlight`, and `code`. Text parts stay literal, including `[[...]]` and Markdown syntax inside them.

## Supertags and fields

Define reusable schema under `contents.schema.children`. Use `type: "template"` for a supertag and `type: "attributeDef"` for a field definition. Apply a field using a `tuple` with an `attributeDef` reference and a `values` array.

```json
{
  "version": "TanaIntermediateFile V2",
  "contents": {
    "schema": {
      "children": [
        { "type": "template", "uid": "project", "name": "project" },
        { "type": "attributeDef", "uid": "budget", "name": "Budget", "dataType": "number" }
      ]
    },
    "workspace": {
      "children": [
        {
          "name": "Launch plan",
          "tags": [{ "uid": "project" }],
          "children": [{ "type": "tuple", "attributeDef": { "uid": "budget" }, "values": [{ "name": "500" }] }]
        }
      ]
    }
  }
}
```

`tags`, template `extends`, and field `fixedOptionIds` accept ID strings or `{ "id": "..." }` or `{ "uid": "..." }` references. To reuse an existing supertag, use `"tags": ["EXISTING_TAG_ID"]`. To reuse an existing field, use `"attributeDef": { "id": "EXISTING_FIELD_ID" }`. You can find schema IDs with **Show API schema** on a supertag.

These schema links always reference definitions. An expanded template in `tags` does not create a supertag. Put a definition under `schema` when you want a new copy.

Templates can have `children` containing field tuples, such as a tuple with empty `values` to add an empty field. `extends` references parent supertags.

Field `dataType` accepts `list`, `number`, `integer`, `boolean`, `date`, `user`, `instance`, `formula`, `url`, `email`, or `options`. Omit it for a plain field. An unknown string imports as a plain field with a warning. Values are nodes, so a numeric value is still `{ "name": "500" }`.

### Options and inline nodes

`fixedOptionIds` lists the fixed options in display order. Define options owned by a new field in its `inlineNodes` map, as in [the complete example](../samples/tif2/project.tif.json). Reference them by `id` or `uid` from both `fixedOptionIds` and tuple `values`.

Field definitions cannot own outline `children`. Use `inlineNodes` for their owned options. The map keys are not identifiers: every referenced inline node needs its own `id` or `uid`. Other nodes can also use `inlineNodes` for nodes they own outside the outline, such as an owned mention target. Define each owned node only once.

### Expanded field definitions in exports

A tuple's `attributeDef` may contain a full, named `attributeDef` with an `id` or `uid`. If the file already defines that field elsewhere, the tuple references the copy. Otherwise the importer copies the definition into Schema. Reference-shaped and system definitions remain references.

Exports may repeat a field definition inside several tuples. The importer copies it once. Prefer a single definition under `schema` with explicit references when writing files yourself.

## Other node types

| Type          | Properties                                  | Import result                          |
| ------------- | ------------------------------------------- | -------------------------------------- |
| `codeBlock`   | `content`, optional `language`, `plainText` | Code node                              |
| `url`         | `url`, optional name                        | URL node                               |
| `visual`      | `url`, optional name                        | Media node linking to the URL          |
| `search`      | Name and optional `children`                | Static outline, with a warning         |
| `journalPart` | Name and optional `children`                | Ordinary outline node, with a warning  |
| `chat`        | `content` array, optional `replies`         | Static message outline, with a warning |

For hand-written code, set `plainText: true` to preserve literal source, including HTML entities:

```json
{ "type": "codeBlock", "language": "html", "plainText": true, "content": "<p>&amp;</p>" }
```

Without `plainText: true`, code `content` uses the stored node-name encoding of older exports: the importer decodes HTML entities and escapes the result. An `alias` property on an outline reference also uses stored node-name HTML and is sanitized. Prefer `[label]([[target]])` for hand-written mention aliases.

Media URLs remain links. The file does not embed or copy image, video, or attachment bytes.

Within tuple `values`, `{ "type": "checkbox", "checked": true }` becomes a system Yes reference; `false` becomes No. `{ "type": "computedValue", "value": "..." }` becomes literal text, with a warning. These are export value shapes, not ordinary standalone nodes.

## Export fidelity and warnings

TIF2 creates an editable copy of exported content, including owned supertags, fields, fixed options, and references. References outside the exported workspace stay external. Importing is not a complete workspace restore.

| Exported content                | Imported result                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| Computed values                 | Plain text; no formula or computation runtime                                              |
| Search, chat, journal parts     | Static outlines; no live queries, chat runtime, or calendar placement                      |
| Chat replies                    | Linear messages become siblings; branches stay nested                                      |
| Transcripts                     | Outlines of speaker text; timing is dropped                                                |
| `childrenOmitted`               | Omitted content is unavailable; warning                                                    |
| Unsupported field data type     | Plain field; warning                                                                       |
| Appearance and context metadata | `color`, `avatar`, `backgroundImageUrl`, `workspaceId`, and chat `author` are not restored |

The importer also does not restore workspace membership, settings, views, or automations. Use **Tana JSON** in the export dialog when you need Tana's full stored representation for technical use. Tana JSON is a separate format and cannot be imported through the TIF importer.

Malformed structure, invalid reference identity, unknown local labels, and nesting deeper than 1000 levels stop the import. A rejected TIF2 file does not create a workspace. Warnings describe conversions or unresolved external links after a successful import.

## TypeScript

The public types live in [src/types/tif2.ts](../src/types/tif2.ts) and are exported from the package entry point. Build this checkout with `npm run build` before using its types:

```typescript
import type { TanaIntermediateFileV2 } from 'tana-import-tools';

const file = {
  version: 'TanaIntermediateFile V2',
  contents: {
    workspace: { children: [{ uid: 'hello', name: 'Hello from TypeScript' }] },
  },
} satisfies TanaIntermediateFileV2;

const json = JSON.stringify(file, null, 2);
```

These types help you author valid files. Tana Outliner validates the JSON at import time, including constraints TypeScript cannot check, such as unique definitions and matching reference roles.

## V0.1 compatibility

The converters in this repository still write `TanaIntermediateFile V0.1`, and Tana Outliner still imports it. Its types remain in [src/types/types.ts](../src/types/types.ts), with the existing `TanaIntermediateFile` name. TIF2 uses the separate `TanaIntermediateFileV2` type.

V0.1 and V2 have different structures. Changing only the version string does not convert a file. Older `tana.simple-json` exports are also incompatible; export the workspace again as TIF2.
