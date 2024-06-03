import { exit } from 'process';
import * as fs from 'fs';

import { TanaIntermediateFile } from './types/types.js';
import { RoamConverter } from './converters/roam/index.js';
import { WorkflowyConverter } from './converters/workflowy/index.js';
import { LogseqConverter } from './converters/logseq/index.js';

const fileType = process.argv[2];
const file = process.argv[3];

if (!fileType) {
  console.log('No file type provided');
  exit(0);
}

if (!file) {
  console.log('No file provided');
  exit(0);
}

const supportedTypes = ['roam', 'workflowy', 'logseq'];
if (!supportedTypes.includes(fileType)) {
  console.log(`File type: ${fileType} is not supported`);
  exit(0);
}

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
  case 'logseq':
    tanaIntermediteFile = new LogseqConverter().convert(contents);
    break;
  default:
    console.log(`File type ${fileType} is not supported`);
    exit(0);
}

if (!tanaIntermediteFile) {
  console.log('No nodes found');
  exit(0);
}

console.dir(tanaIntermediteFile.summary);

saveFile(file, tanaIntermediteFile);
