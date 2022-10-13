import { appendFileSync, unlinkSync } from 'fs';
import path from 'path';
import fs from 'fs';
import { createUnlinkedTanaNodes } from './tanaconversion/invalidLinks';
import { addFileNode, addParentNodeEnd, addParentNodeStart, handleVault } from './tanaconversion/vaultConversion';
import { VaultContext } from './context';
import { createSuperTagObjects } from './tanaconversion/supertags';
import { shiftFromLeafToTop } from './tanaconversion/summary';
import { postProcessTIFFIle } from './tanaconversion/headingLinks';

/**
 * Converts the vault to the Tana format and incrementally saves it, otherwise it would be to memory intensive on big vaults.
 * Due to the incremental approach the output-file will be valid JSON but not be formatted perfectly.
 */
export async function ObsidianVaultConverter(context: VaultContext, today: number = Date.now()) {
  loadDailyNotesConfig(context);

  const targetPath = `${context.vaultPath}.tif.json`;
  try {
    unlinkSync(targetPath);
    // eslint-disable-next-line no-empty
  } catch (e) {}
  appendFileSync(targetPath, '{\n  "version": "TanaIntermediateFile V0.1",\n  "nodes": [\n');

  handleVault(
    context.vaultPath,
    addParentNodeStart(targetPath, today, context),
    addParentNodeEnd(targetPath),
    addFileNode(targetPath, today, context),
  );

  //the vault-node needs to be counted as a top level node
  shiftFromLeafToTop(context.summary);

  //post processing can be done before unlinked (it will add unlinked headings)
  //because the unlinked summary nodes are just created by the converter and have no connection to the rest
  await postProcessTIFFIle(targetPath, context);

  const collectedUnlinkedNodes = createUnlinkedTanaNodes(path.basename(context.vaultPath), today, context);
  if (collectedUnlinkedNodes) {
    //TODO: summary?
    appendFileSync(targetPath, ', ' + JSON.stringify(collectedUnlinkedNodes, null, 2));
  }

  //close vault-node children
  appendFileSync(targetPath, '\n  ]');

  const superTags = createSuperTagObjects(context.superTagTracker);
  if (superTags.length > 0) {
    appendFileSync(targetPath, ',\n  "supertags": \n' + JSON.stringify(superTags, null, 2));
  }

  if (context.attributes.length > 0) {
    appendFileSync(targetPath, ',\n  "attributes": \n' + JSON.stringify(context.attributes, null, 2));
  }

  appendFileSync(targetPath, ',\n  "summary": \n' + JSON.stringify(context.summary, null, 2));

  //close target object
  appendFileSync(targetPath, '\n}');

  return context.summary;
}

function loadDailyNotesConfig(context: VaultContext) {
  const dailyNotesConfigFile = path.join(context.vaultPath, '/.obsidian/daily-notes.json');

  if (fs.existsSync(dailyNotesConfigFile)) {
    //if file does not exists, daily note config was kept default
    const rawjson = fs.readFileSync(dailyNotesConfigFile);
    const dailyNoteConfig = JSON.parse(rawjson.toString());
    if (dailyNoteConfig.format) {
      context.dailyNoteFormat = dailyNoteConfig.format;
    }
  }
}
