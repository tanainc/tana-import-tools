import { exit } from 'process';
import * as fs from 'fs';

import { TanaIntermediateFile } from './types/types.js';
import { RoamConverter } from './converters/roam/index.js';
import { WorkflowyConverter } from './converters/workflowy/index.js';
import { LogseqConverter } from './converters/logseq/index.js';
import { MarkdownConverter } from './converters/markdown/index.js';
import { EvernoteConverter } from './converters/evernote/index.js';
import * as path from 'node:path';

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

const supportedTypes = ['roam', 'workflowy', 'logseq', 'markdown', 'evernote'];
if (!supportedTypes.includes(fileType)) {
  console.log(`File type: ${fileType} is not supported`);
  exit(0);
}

console.log(`\n\nReading file: ${file} for import as: ${fileType}`);

let contents: string | undefined = undefined;
// Only pre-read contents for non-directory based types or when not a directory
try {
  const stat = fs.statSync(file);
  const isDir = stat.isDirectory();
  if (!isDir || fileType !== 'markdown') {
    contents = fs.readFileSync(file, 'utf8');
    console.log('File length:', contents.length);
  }
} catch {
  // fallback: attempt reading; may throw later in converters if invalid
  try {
    contents = fs.readFileSync(file, 'utf8');
    console.log('File length:', contents.length);
  } catch {
    void 0;
  }
}

function saveFile(fileName: string, tanaIntermediteNodes: TanaIntermediateFile) {
  const targetFileName = `${fileName}.tif.json`;
  fs.writeFileSync(targetFileName, JSON.stringify(tanaIntermediteNodes, null, 2));
  console.log(`Tana Intermediate Nodes written to : ${targetFileName}`);
}

let tanaIntermediteFile = undefined;
switch (fileType) {
  case 'roam':
    if (!contents) {
      throw new Error('No content to process');
    }
    tanaIntermediteFile = new RoamConverter().convert(contents);
    break;
  case 'workflowy':
    if (!contents) {
      throw new Error('No content to process');
    }
    tanaIntermediteFile = new WorkflowyConverter().convert(contents);
    break;
  case 'logseq':
    if (!contents) {
      throw new Error('No content to process');
    }
    tanaIntermediteFile = new LogseqConverter().convert(contents);
    break;
  case 'markdown': {
    const md = new MarkdownConverter(fs, path);
    try {
      const stat = fs.statSync(file);
      if (stat.isDirectory()) {
        tanaIntermediteFile = md.convertDirectory(file);
      } else {
        if (!contents) {
          throw new Error('No content to process');
        }
        tanaIntermediteFile = md.convert(contents);
      }
    } catch (e) {
      console.error('Unable to process markdown path', e);
      if (!contents) {
        throw e;
      }
      tanaIntermediteFile = md.convert(contents);
    }
    break;
  }
  case 'evernote':
    if (!contents) {
      throw new Error('No content to process');
    }
    tanaIntermediteFile = new EvernoteConverter().convert(contents);
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
