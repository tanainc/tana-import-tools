<img alt="Twitter Follow" src="https://img.shields.io/twitter/follow/tana_inc?style=for-the-badge">

<img src='https://img.shields.io/github/license/tanainc/tana-import-tools?style=for-the-badge'>

# 👨‍💻 How to use

This project consists of a [JSON specification](https://github.com/tagrhub/tana-import-tools/blob/main/src/types/types.ts) of our common import format for Tana, as well as a set of converters which turn other formats into this format.

If you need to do some something special with your data before putting it into Tana you can just fork this project and hack the current converters into doing what you need. As long as the resulting file follows the format you will be able to import it into Tana.

If you are making changes that you think will benefit other users, please create a pull request.

#### Installing
1. Install Node.js https://nodejs.org/en/download/
2. Install Yarn and follow all instructions here https://yarnpkg.com/getting-started/install
3. Download or git clone this tana-import-tools (or as-of-yet-unmerged branch you want to test, such as logseq)
4. In that folder, in terminal, type `yarn install`
5. Export your existing PKM data (roam, logseq) to that folder and name it appropriately, e.g., `logseq.json`
6. Type the appropriate command for your conversion, e.g., `yarn convert:logseq logseq.json` where convert: can have roam, notion, logseq, or other formats
7. In Tana, go to the top right menu and `import`
8. Hopefully everything worked! If not, report back to [#tana-import-tools](https://tanacommunity.slack.com/archives/C044X2ZC335)

# 📤 Supported Formats 

### Roam Research

 - [x] journal pages
 - [x] references
 - [x] code blocks
 - [x] tasks

1. Click the 3 dots in the upper-right

2. Click "Export All"

3. Change the export format to JSON

4. Click "Export All"

5. `yarn convert:roam datasets/my_roam_export.json`

### LogSeq

 - [x] journal pages
 - [x] references
 - [x] code blocks
 - [ ] tasks
 - [ ] code blocks with type
 - [ ] headings
 - [ ] remote images
 - [ ] local images/assets
 - [ ] simple queries
 - [ ] advanced queries
 - [ ] reference to supertag
 - [ ] favorites
 - [ ] whiteboards
 - [ ] flashcards

1. Click the three dots in the upper right

2. Click "Export graph"

3. Click "Export as JSON"

4. `yarn convert:logseq datasets/my_logseq_export.json`

### Workflowy

1. Click the three dots in the upper right

2. Click "Export all"

3. Select "OPML" and click to download

4. `yarn convert:workflowy datasets/my_workflowy_export.opml`

# 📥 Importing to Tana

Imports are placed in a new workspace to prevent potential conflicts.

1. Click the user profile icon in the upper right

2. Click "Import Content"

3. Click "Tana Intermediate Format" and navigate to the generated file.

# ✍️ Contributing

We are always looking for new importers and as well as improvements to existing ones! Contributions from open-source developers are greatly appreciated.

Please check out our [Contribution Guide](CONTRIBUTING.md) first. Also, make sure you read our [Code of Conduct](CODE_OF_CONDUCT.md)
