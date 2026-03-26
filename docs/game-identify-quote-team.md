# Game: Who said it? (team quotes)

**Audience:** Implementation agent (content + team logic + UI). **Team-based** like trivia.

**Process:** **TDD**, then **`yarn lint`** — [§11](./ARCHITECTURE.md#tdd), [§12](./ARCHITECTURE.md#lint). **Reuse** same MCQ + majority stack as trivia — [§13](./ARCHITECTURE.md#reuse).

---

## Rules (from product)

- **15** quotes; each has **4** options and a **correct** option index (fake / humorous quotes are fine).
- **50 points** per correct answer.
- **Same team mechanics as trivia:** each player chooses on their phone; **plurality within the team** becomes the team’s answer for that quote.
- **Teams must be randomized again** and **must differ** from trivia teams — implement a second `formTeamsForQuoteGame()` (or equivalent) when entering this phase, **do not** reuse `state.teams` from game 1 without reshuffling.

---

## Content (JSON)

Deliver as `src/lib/content/quoteQuestions.json` (or `.ts`) with entries:

```ts
type QuoteQuestion = {
  id: string;
  quote: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
};
```

**15** items. Names can be fictional celebrities or absurd attributions — keep playful for a birthday context.

---

## Client behavior

- Similar to trivia: one quote at a time, localStorage backup of answers, submit votes per quote.

---

## Server behavior

- Majority-within-team resolution identical to [game-trivia-team.md](./game-trivia-team.md).
- Persist per-player scores (each member gets **+50** if team majority is correct).

---

## Current codebase

- Store only calls `formTeams()` when a **team** game hits countdown — **second team formation** for quote game is missing.
- Mock scoring only.

---

## TDD (required)

- **Unit tests first** for: forming **new** teams for quote game (independence from trivia teams fixture); same majority scoring as trivia (+50 per player when team majority correct).
- **JSON loader:** validate 15 items, 4 options, `correctIndex` in range — test with small fixture file.
- **`IdentifyQuoteGameScreen.test.tsx`**: selection and submit behavior.
- **`yarn test`** passes.

## Lint (required)

- **`yarn lint`** after tests — [ARCHITECTURE.md §12](./ARCHITECTURE.md#lint).

## Reuse (required)

Use the **same** `MultipleChoicePanel`, `TeamMajorityExplainer`, `QuestionProgress`, and **`resolveMajorityByTeam`** (or shared lib) as **trivia** — only content (quote vs question) and copy differ. See [ARCHITECTURE.md §13](./ARCHITECTURE.md#reuse).

## Acceptance criteria

- [ ] **Tests first** for team reshuffle and quote scoring paths.
- [ ] **`yarn lint`** passes.
- [ ] No duplicated MCQ screen; imports shared game components / lib used by trivia.
- [ ] 15 quotes loaded from JSON; 4 options; grading by team majority.
- [ ] New team assignment independent from trivia teams.
- [ ] 50 points per correct quote per player on successful teams.
- [ ] UI consistent with shared guest chrome and MCQ patterns (e.g. `MultipleChoicePanel`).
- [ ] Reshuffle + majority logic covered by **TDD** (tests precede or accompany implementation, not trailing only).

---

## Files likely touched

- New `src/components/guest/IdentifyQuoteGameScreen.tsx`
- `src/lib/store.ts` — `teamsTrivia` vs `teamsQuotes` or reset teams with phase
- Vote API (can share trivia vote handler with `gameType` param)
- `src/components/guest/PlayView.tsx`

---

## Related docs

- [game-trivia-team.md](./game-trivia-team.md)
- [screen-leaderboard.md](./screen-leaderboard.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
