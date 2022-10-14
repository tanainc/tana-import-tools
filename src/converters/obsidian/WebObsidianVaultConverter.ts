import { TanaIntermediateSummary } from '../../types/types';
import { WebFileSystemAdapter } from './filesystem/WebFileSystemAdapter';
import { ObsidianVaultConverter } from './ObsidianVaultConverter';
import { IdGenerator } from './utils/IdGenerator';
import { createVaultContext, VaultContext } from './VaultContext';

export async function WebObsidianVaultConverter(
  zipBlob: Blob,
  vaultName: string,
  today: number,
  idGenerator?: IdGenerator,
): Promise<[TanaIntermediateSummary, VaultContext, WebFileSystemAdapter]> {
  const adapter = new WebFileSystemAdapter(zipBlob);
  const context = createVaultContext(vaultName, adapter, idGenerator);
  return ObsidianVaultConverter(context, today).then((summary) => {
    return [summary, context, adapter];
  });
}
