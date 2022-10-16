import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import { TanaIntermediateSummary } from '../../types/types';
import { basename } from './filesystem/CustomFileSystemAdapter';
import { WebFileSystemAdapter } from './filesystem/WebFileSystemAdapter';
import { ObsidianVaultConverter } from './ObsidianVaultConverter';
import { IdGenerator } from './utils/IdGenerator';
import { createVaultContext, VaultContext } from './VaultContext';

export async function LocalObsidianZipVaultConverter(
  zipPath: string,
  today: number = Date.now(),
  idGenerator?: IdGenerator,
): Promise<[TanaIntermediateSummary, VaultContext]> {
  const zipBlob = readFileSync(zipPath);
  const adapter = new WebFileSystemAdapter(new Blob([zipBlob]));
  //removing ".zip"
  const vaultName = basename(zipPath).slice(0, -4);
  const context = createVaultContext(vaultName, adapter, idGenerator);
  return ObsidianVaultConverter(context, today).then((summary) => {
    const result = adapter.getResult();
    const targetPath = `${zipPath.slice(0, -4)}.tif.json`;

    try {
      unlinkSync(targetPath);
      // eslint-disable-next-line no-empty
    } catch (e) {}
    writeFileSync(targetPath, result);

    return [summary, context];
  });
}
