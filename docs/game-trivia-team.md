# Game: Team trivia (UK, 70s, Barcelona)

**Audience:** Implementation agent (game logic + UI + server scoring). team-based

**Process:** **TDD**, then **`yarn lint`** — [§11](./ARCHITECTURE.md#tdd), [§12](./ARCHITECTURE.md#lint). **Reuse** shared MCQ UI and team explainer — [§13](./ARCHITECTURE.md#reuse).

---

## Rules (from product)

- **10** multiple-choice questions, **4** options each.
- Topics: **United Kingdom** facts, **1970s** culture/history, **Barcelona**.
- **50 points** per correct answer for the **team** — applied as **the same total to every player on that team** for the round (each member gets the team score for that question; **do not** split team score as an average unless product changes).
- **Team answer resolution:** Each player taps an option on their phone. The option with the **most votes within the team** becomes the team’s official answer for that question. **Explain this prominently** in instructions and lobby (see `screen-lobby.md`).
- **Tie-breaking:** Not specified by product — choose one and document (e.g. no points, random, or “smallest option index wins”).

---

## Content

- Ship as static data: `src/lib/content/triviaQuestions.ts` or `trivia.json` with shape:

```ts
type TriviaQuestion = {
  id: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  // optional: topic tag for UI badges
};
```

- Exactly **10** items mixing the three themes.

---

## Client behavior

- Show one question at a time (or all with submit — product prefers mobile-friendly **one at a time**).
- Store selections in **localStorage** per `questionId` until synced.
- Submit votes to server **per question** (or batch at question close). Server must know **`playerId`** and **team** membership (from store).

---

## Server behavior

- When admin starts a question window or ends it, compute per team:
  1. Count votes per option index.
  2. Winning index = max count.
  3. If winning index === `correctIndex`, each player on team gets **+50** for that question (or team accumulator then flush at end — equivalent if totals match).
- At game end, persist scores under `gameScores['trivia']` keyed by **playerId** (preferred for final totals) even if internal resolution is team-majority.

---

## Current codebase

- `MockGameScreen` placeholder in `PlayView` when `phase === 'game'`.
- `recordMockScores()` assigns random scores — **replace**.
- Teams formed in `formTeams()` once; trivia is **game 1** in target flow — ensure team formation timing matches **lobby for trivia** (before game start).

---

## TDD (required)

- **Unit tests first** for: majority aggregation per team (including ties — match chosen policy), mapping majority to points (+50 per player on team when correct).
- **`store.test.ts`** (or extracted `triviaScoring.ts` + tests): end-to-end scoring for fixture votes and teams.
- **`TriviaGameScreen.test.tsx`**: selecting an option calls submit handler / updates state; accessibility basics.
- **API:** `POST` vote route tests — validation, 401/400 cases, effect on scores (with testable store boundary).
- **`yarn test`** passes.

## Lint (required)

- **`yarn lint`** after tests — [ARCHITECTURE.md §12](./ARCHITECTURE.md#lint).

## Reuse (required)

Do **not** duplicate the four-answer question layout. **Extend** (or add first) shared pieces from [ARCHITECTURE.md §13](./ARCHITECTURE.md#reuse): e.g. `MultipleChoicePanel`, `TeamMajorityExplainer`, `QuestionProgress`, and shared **`resolveMajorityByTeam`** (or equivalent) in `src/lib/` for grading.

## Acceptance criteria

- [ ] **Red-green-refactor** for scoring and majority logic before UI polish.
- [ ] **`yarn lint`** passes.
- [ ] MCQ UI and majority explainer **shared** with identify-quote where applicable (no second copy-paste screen).
- [ ] 20 questions, 4 options, correct answers graded via **majority within team**.
- [ ] **50** points per correct question per player on qualifying teams.
- [ ] Instructions / rules copy matches the trivia product spec and shared lobby patterns.
- [ ] Offline-friendly: localStorage records choices; resync when online.
- [ ] Majority resolver and tie policy covered by tests **written before** implementation stabilizes.

---

## Files likely touched

- New game component, e.g. `src/components/guest/TriviaGameScreen.tsx`
- `src/lib/store.ts` — voting aggregation, score persistence
- New API routes e.g. `POST /api/game/trivia/vote` (or generic vote endpoint)
- `src/components/guest/PlayView.tsx` — render real component for trivia game id

---

## Related docs

- [screen-lobby.md](./screen-lobby.md)
- [screen-leaderboard.md](./screen-leaderboard.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
