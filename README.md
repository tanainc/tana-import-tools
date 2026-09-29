<img alt="Twitter Follow" src="https://img.shields.io/twitter/follow/tana_inc?style=for-the-badge">

<img src='https://img.shields.io/github/license/tanainc/tana-import-tools?style=for-the-badge'>

# 👨‍💻 How to use

This project consists of a [JSON specification](https://github.com/tagrhub/tana-import-tools/blob/main/src/types/types.ts) of our common import format for Tana, as well as a set of converters which turn other formats into this format.

If you need to do some something special with your data before putting it into Tana you can just fork this project and hack the current converters into doing what you need. As long as the resulting file follows the format you will be able to import it into Tana.

If you are making changes that you think will benefit other users, please create a pull request.

#### Installing

1. Install Node.js 22.x https://nodejs.org/en/download/
2. Use npm (comes with Node 22). No Yarn required.
3. Download or git clone this tana-import-tools (or as-of-yet-unmerged branch you want to test, such as logseq)
4. In that folder, in terminal, type `npm install`
5. Export your existing PKM data (roam, logseq) to that folder and name it appropriately, e.g., `logseq.json`
6. Type the appropriate command for your conversion, e.g., `npm run convert:logseq logseq.json` where convert: can have roam, notion, logseq, or other formats
7. In Tana, go to the top right menu and `import`
8. Hopefully everything worked! If not, report back to [#tana-import-tools](https://tanacommunity.slack.com/archives/C044X2ZC335)

# 📤 Supported Formats 

### Roam Research

 - 🟢 graph
 - 🟢 journal pages
 - 🟢 references
 - 🟢 headings
 - 🟢 todos
 - 🟢 images
 - 🟢 dates
 - 🟡 code blocks (no language support)

1. Click the 3 dots in the upper-right

2. Click "Export All"

3. Change the export format to JSON

4. Click "Export All"

5. `npm run convert:roam datasets/my_roam_export.json`

### LogSeq

 - 🟢 graph
 - 🟢 journal pages
 - 🟢 references
 - 🟢 headings
 - 🟢 dates
 - 🟡 todos (TODO/LATER/DONE supported, NOW/DOING are made into TODO prefixed with NOW or DOING, and CANCELED is made into DONE prefixed with CANCELED)
 - 🟡 logbook (imported as text)
 - 🟡 images (only remote images without redirect are working. Local images/assets still not working)
 - 🟡 code blocks (no language support)
 - 🔴 simple queries
 - 🔴 advanced queries
 - 🔴 reference to supertag
 - 🔴 favorites (not exported)
 - 🔴 whiteboards
 - 🔴 flashcards

1. Click the three dots in the upper right

2. Click "Export graph"

3. Click "Export as JSON"

4. `npm run convert:logseq datasets/my_logseq_export.json`

### Markdown

 - 🟢 graph
 - 🟢 tables - first column header will always be "Title" in Tana
 - 🟢 headings
 - 🟢 todos 
 - 🟢 frontmatter 
 - 🟢 code blocks 
 - 🟢 dates
 - 🟢 images 

### Workflowy

 - 🟢 graph
 - 🟢 todos (workflowy incomplete todos are imported as text)
 - 🔴 headings (not distinguished in OPML)
 - 🔴 code blocks (exported as plaintext)
 - 🔴 images (not exported)
 - 🔴 boards (exported as plaintext)
 - 🔴 comments (not exported)
 - 🔴 node notes (exported in OPML)
 - 🔴 favorites (not exported)
 - 🔴 date references (exported in OPML)

1. Click the three dots in the upper right

2. Click "Export all"

3. Select "OPML" and click to download

4. `npm run convert:workflowy datasets/my_workflowy_export.opml`

### Evernote

 - 🟢 graph (links, inline links)
 - 🟢 journal pages (daily notes)
 - 🟢 todos
 - 🟢 headings
 - 🟢 tables - first column header will always be "Title" in Tana
 - 🟢 code blocks
 - 🟢 tags (converted to supertags)
 - 🟢 highlighted text
 - 🟢 author field
 - 🟡 events - dates are not handled
 - 🟡 flags (marking as important) - converted to fields
 - 🟡 reminders - converted to fields
 - 🔴 images
 - 🔴 comments on nodes
 - 🔴 person assignments
 - 🔴 divider (horizontal line)
 - 🔴 recurring dates

1. You must be on the Desktop app for export functionality

2. Click "notebooks" on the left sidebar

3. Click the three dots next to the notebook you want to export

4. Click "Export notebook..."

5. Select all attributes and the "enex" format. Don't include the author attribute (or others) if you don't want them to show as fields in Tana.

# 📥 Importing to Tana

Imports are placed in a new workspace to prevent potential conflicts.

1. Click the user profile icon in the upper right

2. Click "Import Content"

3. Click "Tana Intermediate Format" and navigate to the generated file.

# 🧩 Tana Intermediate Format 2

The converters in this repository write `TanaIntermediateFile V0.1`, which Tana keeps importing. Tana also imports **Tana Intermediate Format 2** (`TanaIntermediateFile V2`), the format Tana's own workspace export writes. It is convenient to write by hand or with an LLM, and it can link to tags, fields and nodes that already exist in your workspaces.

```json
{
  "version": "TanaIntermediateFile V2",
  "contents": {
    "schema": { "children": [{ "type": "template", "uid": "project", "name": "project" }] },
    "workspace": {
      "children": [
        {
          "uid": "launch",
          "name": "Launch plan, see [[notes]]",
          "tags": [{ "uid": "project" }, "EXISTING_TAG_ID"],
          "children": [
            {
              "type": "tuple",
              "attributeDef": { "id": "EXISTING_FIELD_ID" },
              "values": [{ "isRef": true, "id": "EXISTING_OPTION_ID" }]
            },
            { "uid": "notes", "name": "Notes" },
            { "name": "Book venue", "isDone": false }
          ]
        }
      ]
    }
  }
}
```

- `contents` may hold `workspace`, `inbox`, `library`, `schema` and `additionalRoots`. Each container is a node whose children go into the matching place in the new workspace.
- A node has `name` (or structured `nameParts`), optional `type` (`node` by default, or `template`, `attributeDef`, `tuple`, `codeBlock`, `url`, `visual`, …), `children`, `tags` and `description`. Fields are `tuple` nodes with an `attributeDef` and `values`. `isDone: false` makes an open todo.
- `uid` is a label local to the file. `[[uid]]` in a name, `{ "isRef": true, "uid": "…" }` and `{ "uid": "…" }` in `tags` or `attributeDef` point at that node.
- `id` means a node's ID in Tana (see **Show API Schema** on a supertag). A node the file defines with an `id` is imported as a copy, and references to that ID point at the copy. An ID the file only references links to the existing node, which you must be able to read.
- Imports always create a new workspace and never change existing nodes. Existing links to copied nodes still point to the originals.
- Attribute definitions take a `dataType` such as `options`, `date`, `number`, `url` or `user`, plus optional `fixedOptionIds`. Templates take `extends` with parent tag IDs.

# ✍️ Contributing

We are always looking for new importers and as well as improvements to existing ones! Contributions from open-source developers are greatly appreciated.

Please check out our [Contribution Guide](CONTRIBUTING.md) first. Also, make sure you read our [Code of Conduct](CODE_OF_CONDUCT.md)
