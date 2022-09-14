import { appendFile, appendFileSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import path, { resolve } from 'path';
import { TanaIntermediateNode, TanaIntermediateSummary, TanaIntermediateFile } from '../../types/types';
import { idgenerator } from '../../utils/utils';
import { convertObsidianFile, IdGenerator, createRootNode } from './fileConverter';

//bobbyhadz.com/blog/javascript-get-difference-between-two-sets#:~:text=To%20get%20the%20difference%20between,array%20back%20to%20a%20Set%20.
const getDifference = (setA: any[], setB: any[]) => new Set([...setA].filter((element) => !setB.includes(element)));

//source: https://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
function* getFiles(dir: string): Generator<string> {
  const dirents = readdirSync(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    const res = resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      yield* getFiles(res);
    } else {
      yield res;
    }
  }
}

const maybeDecode = (x: string) => {
  try {
    return decodeURIComponent(x);
  } catch (e) {
    return x;
  }
};

/**
 * Converts the vault to the Tana format and incrementally saves it, otherwise it would be to memory intensive on big vaults.
 * Due to the incremental approach the output-file will be valid JSON but not be formatted perfectly.
 */
export function convertVault(vaultPath: string, today: number = Date.now(), idGenerator: IdGenerator = idgenerator) {
  const iter = getFiles(vaultPath);

  if (vaultPath.endsWith('/')) {
    vaultPath = vaultPath.slice(0, -1);
  }

  const targetFileName = `${vaultPath}.tif.json`;
  try {
    unlinkSync(targetFileName);
  } catch (e) {}
  appendFileSync(targetFileName, '{\n  "version": "TanaIntermediateFile V0.1",\n  "nodes": [\n');

  let summary;
  let newLinks: string[] = [];
  let pagesCreated: string[] = [];
  let addComma = false;
  for (const filePath of iter) {
    if (!filePath.endsWith('.md')) continue;
    if (addComma) {
      appendFileSync(targetFileName, ',\n');
    }

    const [fileNode, updatedSummary, links] = convertObsidianFile(
      path.basename(filePath).replace('.md', ''),
      readFileSync(filePath, 'utf-8'),
      summary,
      today,
      idGenerator,
    ) as [TanaIntermediateNode, TanaIntermediateSummary, string[]];
    newLinks.push(...links);
    pagesCreated.push(fileNode.uid);
    summary = updatedSummary;
    appendFileSync(targetFileName, JSON.stringify(fileNode, null, 2));
    addComma = true;
  }

  const pagesToCreate = getDifference(newLinks, pagesCreated);
  const pagesInTana = [...pagesToCreate]
    .map((x) => JSON.stringify(createRootNode(x, maybeDecode(x), today), null, 2))
    .join(',');
  if (summary) {
    summary.topLevelNodes = (summary?.topLevelNodes || 0) + pagesInTana.length;
  }

  appendFileSync(targetFileName, ',' + pagesInTana);
  appendFileSync(targetFileName, '\n  ],\n  "summary": \n' + JSON.stringify(summary, null, 2) + '\n}');

  return summary;
}
