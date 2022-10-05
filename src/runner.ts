import { exit } from 'process';
import * as fs from 'fs';

import { RoamConverter } from './converters/roam/index';
import { TanaIntermediateFile } from './types/types';
import { WorkflowyConverter } from './converters/workflowy';
import { lstatSync } from 'fs';
import path from 'path';
import { ObsidianSingleFileConverter, ObsidianVaultConverter } from './converters/obsidian';

const fileType = process.argv[2];
const file = process.argv[3];

if (!fileType) {
  console.log('No file type provided');
  exit(0);
}

if (!file) {
  console.log('No file or folder provided');
  exit(0);
}

const supportedTypes = ['roam', 'workflowy', 'obsidian'];
if (!supportedTypes.includes(fileType)) {
  console.log(`File type: ${fileType} is not supported`);
  exit(0);
}

function handleSingleFileConversion() {
  console.log(`\n\nReading file: ${file} for import as: ${fileType}`);

  const contents = fs.readFileSync(file, 'utf8');
  console.log('File length:', contents.length);

  function saveFile(fileName: string, tanaIntermediteNodes: TanaIntermediateFile) {
    const targetFileName = `${fileName}.tif.json`;
    fs.writeFileSync(targetFileName, JSON.stringify(tanaIntermediteNodes, null, 2));
    console.log(`Tana Intermediate Nodes written to : ${targetFileName}`);
  }

  let tanaIntermediteFile = undefined;
  switch (fileType) {
    case 'roam':
      tanaIntermediteFile = new RoamConverter().convert(contents);
      break;
    case 'workflowy':
      tanaIntermediteFile = new WorkflowyConverter().convert(contents);
      break;
    case 'obsidian':
      tanaIntermediteFile = ObsidianSingleFileConverter(path.basename(file).replace('.md', ''), contents);
      break;
    default:
      console.log(`File type ${fileType} is not supported for single files`);
      exit(0);
  }

  if (!tanaIntermediteFile) {
    console.log('No nodes found');
    exit(0);
  }

  console.dir(tanaIntermediteFile.summary);

  saveFile(file, tanaIntermediteFile);
}

function handleFolderConversion() {
  console.log(`\n\nReading folder: ${file} for import as: ${fileType}`);
  let summary;
  switch (fileType) {
    case 'obsidian':
      summary = ObsidianVaultConverter(file);
      break;
    default:
      console.log(`File type ${fileType} is not supported for folders`);
      exit(0);
  }
  console.dir(summary);
}

if (lstatSync(file).isDirectory()) {
  handleFolderConversion();
} else {
  handleSingleFileConversion();
}
