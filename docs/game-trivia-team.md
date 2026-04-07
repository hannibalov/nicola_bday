# Game: Team trivia (UK, 70s, Barcelona)

**Audience:** Implementation agent (game logic + UI + server scoring). team-based

**Process:** **TDD**, then **`yarn lint`** — [§11](./ARCHITECTURE.md#tdd), [§12](./ARCHITECTURE.md#lint). **Reuse** shared MCQ UI and team explainer — [§13](./ARCHITECTURE.md#reuse).

---

## Rules (from product)

- **20** multiple-choice questions, **4** options each.
- Topics: **United Kingdom** facts, **1970s** culture/history, **Barcelona**.
- **Synchronized rounds:** **15 s** to answer per question, then **3 s** reveal of the correct option for everyone. Constants: `TEAM_MCQ_ANSWER_MS` and `TEAM_MCQ_REVEAL_MS` in [`src/lib/teamMcqTiming.ts`](../src/lib/teamMcqTiming.ts). With `NICOLA_E2E_FAST_LOBBY=1` (Playwright), intervals shorten like lobby timing.
- **50 points** per correct answer for the **team** — applied as **the same total to every player on that team** for the round (each member gets the team score for that question; **do not** split team score as an average unless product changes).
- **Team answer resolution:** Each player taps an option on their phone. The option with the **most votes within the team** becomes the team’s official answer for that question. **Explain this prominently** in instructions and lobby (see `screen-lobby.md`).
- **Tie-breaking:** Plurality ties use **lower option index** as the team choice (`pluralityWinner` in [`src/lib/majorityVote.ts`](../src/lib/majorityVote.ts)); document in UI if you surface tie behavior.

---

## Content

- Ship as static data: [`src/content/trivia.ts`](../src/content/trivia.ts) exports `TRIVIA_QUESTIONS` (currently **20** items) with shape:

```ts
type TriviaQuestion = {
  id: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  // optional: topic tag for UI badges
};
```

---

## Client behavior

- Show one question at a time (or all with submit — product prefers mobile-friendly **one at a time**).
- Store selections in **localStorage** per `questionId` until synced.
- Submit votes to server **per question** (or batch at question close). Server must know **`playerId`** and **team** membership (from store).

---

## Server behavior

- Votes arrive via `POST /api/game/trivia/vote` during `game_trivia`. After the round, scoring uses `computeTriviaScoresFromVotes` / team majority (same shape as quotes).
- Per team: count votes per option index → plurality winner (tie → lower index) → if winner === `correctIndex`, each player on that team gets **+50** for that question.
- At game end, persist scores under the trivia game id in `gameScores` keyed by **playerId** (see [`src/lib/store.ts`](../src/lib/store.ts) and [`src/lib/gameConfig.ts`](../src/lib/gameConfig.ts)).

---

## Current codebase

- **`TriviaGameScreen`** (`src/components/guest/TriviaGameScreen.tsx`) — MCQ flow with `useTeamMcqRoundPhase`, `MultipleChoicePanel`, `TeamMajorityExplainer`; sync fields from `PublicState.teamMcqSync`.
- **`rebuildTeams()`** when entering **`lobby_trivia`** (see [`store.ts`](../src/lib/store.ts)).
- Legacy **`MockGameScreen`** exists but is **not** wired in `PlayView`.

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

## Files (reference)

- `src/components/guest/TriviaGameScreen.tsx`, `src/components/guest/PlayView.tsx`
- `src/lib/store.ts`, `src/lib/triviaScoring.ts`, `src/lib/majorityVote.ts`, `src/lib/teamMcqTiming.ts`
- `src/content/trivia.ts`, `src/app/api/game/trivia/vote/route.ts`

---

## Related docs

- [screen-lobby.md](./screen-lobby.md)
- [screen-leaderboard.md](./screen-leaderboard.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
