import { createUnlinkedTanaNodes } from './links/invalidLinks';
import { addFileNode, addParentNodeEnd, addParentNodeStart, handleVault } from './tanaconversion/vaultConversion';
import { shiftFromLeafToTop, VaultContext } from './VaultContext';
import { createSuperTagObjects } from './tanafeatures/supertags';
import { postProcessTIFFIle } from './links/headingLinks';
import { basename, readConfig } from './filesystem/CustomFileSystemAdapter';

/**
 * Converts the vault to the Tana format and incrementally saves it, otherwise it would be to memory intensive on big vaults.
 * Due to the incremental approach the output-file will be valid JSON but not be formatted perfectly.
 */
export async function ObsidianVaultConverter(context: VaultContext, today: number = Date.now()) {
  await context.adapter.initReadingVault();

  await loadDailyNotesConfig(context);

  const targetPath = `${context.vaultPath}.tif.json`;
  try {
    context.adapter.removeFile(targetPath);
    // eslint-disable-next-line no-empty
  } catch (e) {}

  context.adapter.appendToResultFile(targetPath, '{\n  "version": "TanaIntermediateFile V0.1",\n  "nodes": [\n');

  await handleVault(
    context,
    context.vaultPath,
    addParentNodeStart(targetPath, today, context),
    addParentNodeEnd(context, targetPath),
    addFileNode(targetPath, today, context),
  );
  context.adapter.flushResultsFromInitialProcessing(targetPath);

  //the vault-node needs to be counted as a top level node
  shiftFromLeafToTop(context.summary);

  //post processing can be done before unlinked (it will add unlinked headings)
  //because the unlinked summary nodes are just created by the converter and have no connection to the rest
  //20 secs
  await postProcessTIFFIle(targetPath, context);

  const collectedUnlinkedNodes = createUnlinkedTanaNodes(basename(context.vaultPath), today, context);
  if (collectedUnlinkedNodes) {
    //TODO: summary?
    context.adapter.appendToResultFile(targetPath, ', ' + JSON.stringify(collectedUnlinkedNodes, null, 2));
  }

  //close vault-node children
  context.adapter.appendToResultFile(targetPath, '\n  ]');

  const superTags = createSuperTagObjects(context.superTagTracker);
  if (superTags.length > 0) {
    context.adapter.appendToResultFile(targetPath, ',\n  "supertags": \n' + JSON.stringify(superTags, null, 2));
  }

  if (context.attributes.length > 0) {
    context.adapter.appendToResultFile(
      targetPath,
      ',\n  "attributes": \n' + JSON.stringify(context.attributes, null, 2),
    );
  }

  context.adapter.appendToResultFile(targetPath, ',\n  "summary": \n' + JSON.stringify(context.summary, null, 2));

  //close target object
  context.adapter.appendToResultFile(targetPath, '\n}');
  context.adapter.flushResultsFromInitialProcessing(targetPath);
  return context.summary;
}

async function loadDailyNotesConfig(context: VaultContext) {
  const config = await readConfig<{ format: string }>(context, 'daily-notes', (res) => {
    return res ? res : { format: 'YYYY-MM-DD' };
  });
  context.dailyNoteFormat = config.format;
  console.log('Using daily notes format ' + config.format + ' for detecting calendar nodes.');
}
