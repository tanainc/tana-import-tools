import { TanaIntermediateSummary } from '../../../types/types';

export function incrementSummary(summary: TanaIntermediateSummary) {
  summary.totalNodes++;
  summary.leafNodes++;
}

export function shiftFromLeafToTop(summary: TanaIntermediateSummary) {
  summary.leafNodes--;
  summary.topLevelNodes++;
}
