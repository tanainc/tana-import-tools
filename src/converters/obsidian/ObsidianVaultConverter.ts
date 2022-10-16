import { createUnlinkedTanaNodes } from './links/invalidLinks';
import { addFileNode, addParentNodeEnd, addParentNodeStart, handleVault } from './tanaconversion/vaultConversion';
import { shiftFromLeafToTop, VaultContext } from './VaultContext';
import { createSuperTagObjects } from './tanafeatures/supertags';
import { postProcessTIFFIle } from './links/headingLinks';
import { basename } from './filesystem/CustomFileSystemAdapter';

/**
 * Converts the vault to the Tana format and incrementally saves it, otherwise it would be to memory intensive on big vaults.
 * Due to the incremental approach the output-file will be valid JSON but not be formatted perfectly.
 */
export async function ObsidianVaultConverter(context: VaultContext, today: number = Date.now()) {
  await context.fileSystemAdapter.initReadingVault();

  await loadDailyNotesConfig(context);

  const targetPath = `${context.vaultPath}.tif.json`;
  try {
    context.fileSystemAdapter.removeFile(targetPath);
    // eslint-disable-next-line no-empty
  } catch (e) {}

  context.fileSystemAdapter.appendToResultFile(
    targetPath,
    '{\n  "version": "TanaIntermediateFile V0.1",\n  "nodes": [\n',
  );

  await handleVault(
    context,
    context.vaultPath,
    addParentNodeStart(targetPath, today, context),
    addParentNodeEnd(context, targetPath),
    addFileNode(targetPath, today, context),
  );
  context.fileSystemAdapter.flushResultsFromInitialProcessing(targetPath);

  //the vault-node needs to be counted as a top level node
  shiftFromLeafToTop(context.summary);

  //post processing can be done before unlinked (it will add unlinked headings)
  //because the unlinked summary nodes are just created by the converter and have no connection to the rest
  //20 secs
  await postProcessTIFFIle(targetPath, context);

  const collectedUnlinkedNodes = createUnlinkedTanaNodes(basename(context.vaultPath), today, context);
  if (collectedUnlinkedNodes) {
    //TODO: summary?
    context.fileSystemAdapter.appendToResultFile(targetPath, ', ' + JSON.stringify(collectedUnlinkedNodes, null, 2));
  }

  //close vault-node children
  context.fileSystemAdapter.appendToResultFile(targetPath, '\n  ]');

  const superTags = createSuperTagObjects(context.superTagTracker);
  if (superTags.length > 0) {
    context.fileSystemAdapter.appendToResultFile(
      targetPath,
      ',\n  "supertags": \n' + JSON.stringify(superTags, null, 2),
    );
  }

  if (context.attributes.length > 0) {
    context.fileSystemAdapter.appendToResultFile(
      targetPath,
      ',\n  "attributes": \n' + JSON.stringify(context.attributes, null, 2),
    );
  }

  context.fileSystemAdapter.appendToResultFile(
    targetPath,
    ',\n  "summary": \n' + JSON.stringify(context.summary, null, 2),
  );

  //close target object
  context.fileSystemAdapter.appendToResultFile(targetPath, '\n}');
  context.fileSystemAdapter.flushResultsFromInitialProcessing(targetPath);
  return context.summary;
}

async function loadDailyNotesConfig(context: VaultContext) {
  const dailyNotesConfigFile = context.vaultPath + '/.obsidian/daily-notes.json';

  if (context.fileSystemAdapter.exists(dailyNotesConfigFile)) {
    //if file does not exists, daily note config was kept default
    const rawjson = await context.fileSystemAdapter.readFile(dailyNotesConfigFile);
    const dailyNoteConfig = JSON.parse(rawjson.toString());
    if (dailyNoteConfig.format) {
      context.dailyNoteFormat = dailyNoteConfig.format;
    }
  }
}
