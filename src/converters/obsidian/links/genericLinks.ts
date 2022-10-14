import { incrementSummary, VaultContext } from '../VaultContext';

export function untrackedUidRequest(context: VaultContext) {
  incrementSummary(context.summary);
  //folders / "summary unlinked nodes" / content-nodes get new UIDs always
  //because these UIDs either are not in the source or need to be connected later
  return context.idGenerator();
}
