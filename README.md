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
 - 🟢 images
 - 🟢 tables
 - 🟢 headings
 - 🟢 todos 
 - 🟢 frontmatter 
 - 🟢 code blocks 

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

# 📥 Importing to Tana

Imports are placed in a new workspace to prevent potential conflicts.

1. Click the user profile icon in the upper right

2. Click "Import Content"

3. Click "Tana Intermediate Format" and navigate to the generated file.

# ✍️ Contributing

We are always looking for new importers and as well as improvements to existing ones! Contributions from open-source developers are greatly appreciated.

Please check out our [Contribution Guide](CONTRIBUTING.md) first. Also, make sure you read our [Code of Conduct](CODE_OF_CONDUCT.md)
