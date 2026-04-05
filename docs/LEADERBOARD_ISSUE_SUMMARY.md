# Investigation Summary: Leaderboard Showing 0 Points After First Game

## Issue Description
The leaderboard displays 0 points for all teams after the first game (trivia), and the database also shows 0 points. This suggests that scores are not being calculated or stored correctly.

## Architecture Overview
- **Games**: Trivia (team-based, 50 points per correct team majority answer per question), Bingo (individual), Quotes (team-based).
- **Scoring Flow**:
  1. Players vote on questions during the game.
  2. Votes are sent to `/api/game/trivia/vote` and stored in `state.triviaVotesByPlayer`.
  3. When advancing to `leaderboard_post_trivia`, `recordRoundScoresForCompletedGame` computes scores using `computeTriviaScoresFromVotes`.
  4. Scores are stored in `state.gameScores[TRIVIA_GAME_ID]` and persisted to DB via `commitScoresAndVotes`.
  5. Leaderboard displays from `getLeaderboardForGameSlot` → `buildTeamLeaderboardEntries` (sums player scores per team).

## Key Findings
- **Scoring Logic**: `computeTriviaScoresFromVotes` and `majorityVote` functions appear correct. Unit tests pass.
- **Vote Submission**: Votes are sent via `TriviaGameScreen` → `useTeamMcqBackgroundVotes` → `postVote` to API.
- **Persistence**: State is persisted in Supabase, votes and scores are stored in DB tables.
- **Potential Issues**:
  - Votes may not be submitted successfully (API errors, network issues).
  - Votes stored locally but not sent to server.
  - State not persisting correctly.
  - Edge case in scoring where no majority is reached (but tests cover this).
- **E2E Tests**: Attempted to run e2e tests to verify full flow, but encountered multiple build errors (TypeScript implicit any types, inconsistent WebSocket/SSE usage). Fixed several, but final run output was truncated, so test results unknown.

## Next Steps
- Verify if votes are being sent and received by checking API logs or adding debug logging.
- Check if `state.triviaVotesByPlayer` is populated when computing scores.
- Run e2e tests successfully to see if they reproduce the issue.
- Inspect DB directly to confirm if scores are inserted as 0 or not at all.
- Check client-side vote storage and submission in `TriviaGameScreen`.

## Code Locations
- Scoring: `src/lib/triviaScoring.ts`, `src/lib/majorityVote.ts`
- Store: `src/lib/store.ts` (recordRoundScoresForCompletedGame, getLeaderboardForGameSlot)
- API: `src/app/api/game/trivia/vote/route.ts`
- UI: `src/components/guest/TriviaGameScreen.tsx`, `src/components/guest/GameLeaderboard.tsx`</content>
<parameter name="filePath">/Users/rodrigopizarro/Documents/projects/personal/nicola_bday/LEADERBOARD_ISSUE_SUMMARY.md