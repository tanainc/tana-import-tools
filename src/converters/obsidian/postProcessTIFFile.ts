import { VaultContext } from './VaultContext';
import * as readline from 'node:readline/promises';
import { appendFileSync, createReadStream, renameSync, unlinkSync } from 'node:fs';
import { filterHeadingLinks, HeadingTracker } from './filterHeadingLinks';

/**
 * Post-processes the created TIF File. This is necessary to support heading links, because heading links have a ton of edge cases.
 * E.g. heading#heading2#heading5 is valid.
 *
 * We replace the dummy heading link UIDs with the actual ones from where we found the heading.
 */
export async function postProcessTIFFIle(filePath: string, context: VaultContext, tracker: HeadingTracker) {
  const [validHeadingLinks, missingHeadingLinks] = filterHeadingLinks(context.headingLinkTracker, tracker);
  context.addInvalidLinks(
    missingHeadingLinks.map((headingLink) => ({ uid: headingLink.uid, link: headingLink.link.join('#') })),
  );

  const tempPath = filePath + '_TEMP';
  //the converter is build to append to the file, so we dont want to load the whole file into memory at the end, that would be counter to the whole idea
  const readStream = createReadStream(filePath, 'utf-8');
  const readlineInterface = readline.createInterface(readStream);
  const regexes = validHeadingLinks.map((link) => ({
    old: new RegExp(link.old, 'g'),
    new: link.new,
  }));
  for await (const line of readlineInterface) {
    let updatedLine = line;
    regexes.forEach((regEx) => {
      updatedLine = updatedLine.replace(regEx.old, regEx.new);
    });
    appendFileSync(tempPath, updatedLine);
  }
  unlinkSync(filePath);
  renameSync(tempPath, filePath);
}
