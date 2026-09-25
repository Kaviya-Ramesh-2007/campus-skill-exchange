import type { UserMatchData } from './matching.types';

export function eligibleCandidates(
  requesterId: string,
  candidates: UserMatchData[],
): UserMatchData[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (candidate.userId === requesterId || seen.has(candidate.userId)) return false;
    seen.add(candidate.userId);
    return true;
  });
}

export function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
