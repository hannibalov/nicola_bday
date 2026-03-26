/**
 * Plurality vote among discrete options (option indices).
 * Tie-break: lower index wins (deterministic).
 */

/** Team’s collective choice from member option indices (plurality; tie → lower index). */
export function resolveMajorityByTeam(memberOptionIndices: number[]): number | null {
  return pluralityWinner(memberOptionIndices);
}

export function pluralityWinner(optionIndices: number[]): number | null {
  if (optionIndices.length === 0) return null;
  const counts = new Map<number, number>();
  for (const idx of optionIndices) {
    if (idx < 0 || !Number.isInteger(idx)) continue;
    counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let bestIdx: number | null = null;
  let bestCount = -1;
  for (const [idx, c] of counts) {
    if (c > bestCount || (c === bestCount && bestIdx !== null && idx < bestIdx)) {
      bestCount = c;
      bestIdx = idx;
    }
  }
  return bestIdx;
}

export function teamChoiceMatchesCorrect(
  memberVotes: number[],
  correctIndex: number
): boolean {
  const choice = resolveMajorityByTeam(memberVotes);
  return choice !== null && choice === correctIndex;
}
