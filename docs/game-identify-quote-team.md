# Game: Who said it? (team quotes)

**Audience:** Implementation agent (content + team logic + UI). **Team-based** like trivia.

**Process:** **TDD**, then **`yarn lint`** — [§11](./ARCHITECTURE.md#tdd), [§12](./ARCHITECTURE.md#lint). **Reuse** same MCQ + majority stack as trivia — [§13](./ARCHITECTURE.md#reuse).

---

## Rules (from product)

- **All** quotes ship from [`quoteQuestions.json`](../src/lib/content/quoteQuestions.json) (currently **21** items); each has **4** options and a **correct** option index (fake / humorous quotes are fine).
- **Same synchronized MCQ timing as trivia:** **15 s** answer + **3 s** reveal per quote (`TEAM_MCQ_ANSWER_MS` / `TEAM_MCQ_REVEAL_MS` in [`teamMcqTiming.ts`](../src/lib/teamMcqTiming.ts)).
- **50 points** per correct answer.
- **Same team mechanics as trivia:** each player chooses on their phone; **plurality within the team** becomes the team’s answer for that quote.
- **Teams must be rebuilt** when entering the quote flow — [`rebuildTeams()`](../src/lib/store.ts) runs when entering **`lobby_quotes`** (independent from trivia teams).

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

Add or edit entries in the JSON as needed. Names can be fictional celebrities or absurd attributions — keep playful for a birthday context.

---

## Client behavior

- Similar to trivia: one quote at a time, localStorage backup of answers, submit votes per quote.

---

## Server behavior

- Majority-within-team resolution identical to [game-trivia-team.md](./game-trivia-team.md).
- Persist per-player scores (each member gets **+50** if team majority is correct).

---

## Current codebase

- **`IdentifyQuoteGameScreen`** with `teamMcqSync`, `POST /api/game/quotes/vote`, and shared MCQ components (see [game-trivia-team.md](./game-trivia-team.md)).
- **`rebuildTeams()`** on **`lobby_quotes`**; scoring reuses trivia majority helpers.

---

## TDD (required)

- **Unit tests first** for: forming **new** teams for quote game (independence from trivia teams fixture); same majority scoring as trivia (+50 per player when team majority correct).
- **JSON loader:** [`parseQuoteQuestions`](../src/lib/quoteContent.ts) validates the bundled array (≥1 item, 4 options, `correctIndex` in range) — test with fixtures.
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
- [ ] All quotes loaded from JSON; 4 options; grading by team majority.
- [ ] New team assignment independent from trivia teams.
- [ ] 50 points per correct quote per player on successful teams.
- [ ] UI consistent with shared guest chrome and MCQ patterns (e.g. `MultipleChoicePanel`).
- [ ] Reshuffle + majority logic covered by **TDD** (tests precede or accompany implementation, not trailing only).

---

## Files (reference)

- `src/components/guest/IdentifyQuoteGameScreen.tsx`, `src/components/guest/PlayView.tsx`
- `src/lib/store.ts`, `src/lib/quoteContent.ts`, `src/lib/content/quoteQuestions.json`, `src/lib/teamMcqTiming.ts`
- `src/app/api/game/quotes/vote/route.ts`

---

## Related docs

- [game-trivia-team.md](./game-trivia-team.md)
- [screen-leaderboard.md](./screen-leaderboard.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
