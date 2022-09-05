<img alt="Twitter Follow" src="https://img.shields.io/twitter/follow/tana_inc?style=for-the-badge">

<img src='https://img.shields.io/github/license/tagrhub/tana-import-tools?style=for-the-badge'>

# 👨‍💻 How to use

This project consists of a [JSON specification](https://github.com/tagrhub/tana-import-tools/blob/main/src/types/types.ts) of our common import format for Tana, as well as a set of converters which turn other formats into this format.

Supported formats:

- Workflowy (OPML)
- Roam Research JSON

If you need to do some something special with your data before putting it into Tana you can just fork this project and hack the current converters into doing what you need. As long as the resulting file follows the format you will be able to import it into Tana.

If you are making changes that you think will benefit other users, please create a pull request.

#### Converting ROAM JSON to Tana JSON

`yarn convert:roam datasets/my_roam_export.json`

#### Converting Workflowy OPML to Tana JSON

`yarn convert:workflowy datasets/my_workflowy_export.opml`

# ✍️ Contributing

We are always looking for new importers and as well as improvements to existing ones! Contributions from open-source developers are greatly appreciated.

Please check out our [Contribution Guide](CONTRIBUTING.md) first. Also, make sure you read our [Code of Conduct](CODE_OF_CONDUCT.md)
