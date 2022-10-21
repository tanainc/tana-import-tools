# Tana -> Notion Importer

## How to use

1. run yarn in project root
2. export a Notion table ([example link](https://www.notion.so/8c117d7be79843798bf56c0b8fd522ae?v=f2861e5ff2ce4c76a560d1cf7fa600a3))
3. unzip and move the folder to the root of the project
4. run convert command, passing in the `csv` that was generated

```bash
yarn convert:notion ./pokemon.csv
```

## Features

- parse Notion table export
  - create root node for each row
  - add `field` node for each column in row
  - add node refs for any notion page link

## Unsupported Feature

- parsing an exported `.md` file. 
- create single node for each repeated value in Notion table export