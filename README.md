<img alt="Twitter Follow" src="https://img.shields.io/twitter/follow/tana_inc?style=for-the-badge">

<img src='https://img.shields.io/github/license/tanainc/tana-import-tools?style=for-the-badge'>

# 👨‍💻 How to use

This project consists of a [JSON specification](https://github.com/tagrhub/tana-import-tools/blob/main/src/types/types.ts) of our common import format for Tana, as well as a set of converters which turn other formats into this format.

Supported formats:

- Workflowy (OPML)
- Roam Research JSON

If you need to do some something special with your data before putting it into Tana you can just fork this project and hack the current converters into doing what you need. As long as the resulting file follows the format you will be able to import it into Tana.

If you are making changes that you think will benefit other users, please create a pull request.

#### Installing
##### Tested only on Mac OS X 12.4
1. Install Node.js https://nodejs.org/en/download/
2. Install Yarn and follow all instructions here https://yarnpkg.com/getting-started/install
3. download or git clone this tana-import-tools (or as-of-yet-unmerged branch you want to test, such as logseq)
4. in that folder, in terminal, type `yarn install`
5. export your existing PKM data (roam, logseq) to that folder and name it appropriately, e.g., `logseq.json`
6. type the appropriate command for your conversion, e.g., `yarn convert:logseq logseq.json` where convert: can have roam, notion, logseq, or other formats
7. In Tana, go to the top right menu and `import`
8. Hopefully everything worked! If not, report back to [#tana-import-tools](https://tanacommunity.slack.com/archives/C044X2ZC335)

#### Converting ROAM JSON to Tana JSON

`yarn convert:roam datasets/my_roam_export.json`

#### Converting Workflowy OPML to Tana JSON

`yarn convert:workflowy datasets/my_workflowy_export.opml`

# ✍️ Contributing

We are always looking for new importers and as well as improvements to existing ones! Contributions from open-source developers are greatly appreciated.

Please check out our [Contribution Guide](CONTRIBUTING.md) first. Also, make sure you read our [Code of Conduct](CODE_OF_CONDUCT.md)
