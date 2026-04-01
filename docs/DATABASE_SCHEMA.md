# Database Schema & Structure

This document describes the **normalized database architecture** for the Nicola Birthday Party application. It moves from a monolithic JSONB session store to a relational model with specific tables for players, teams, and scores to improve performance and robustness.

## 1. Tables Overview

| Table | Purpose | Realtime Enabled |
|-------|---------|------------------|
| `session_store` | Global session state (step, revision, countdowns). | Yes |
| `players` | Registered players, nicknames, and team assignments. | No |
| `teams` | Current team names and IDs. | No |
| `game_scores` | Per-player scores for each game round. | No |
| `player_game_state` | Volatile per-player data (votes, bingo marks). | No |

## 2. Table Schemas

### 2.1 `session_store`
Stores global state that affects all clients simultaneously.

```sql
CREATE TABLE IF NOT EXISTS session_store (
    id INTEGER PRIMARY KEY DEFAULT 1,
    data JSONB NOT NULL,
    last_revision INTEGER DEFAULT 0,
    CHECK (id = 1) -- Ensure only one global session exists
);

-- IMPORTANT: Enable Realtime for this table to trigger SSE updates
ALTER PUBLICATION supabase_realtime ADD TABLE session_store;
```

### 2.2 `players`
Stores player identity and team membership.

```sql
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    team_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2.3 `teams`
Stores team definitions.

```sql
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);
```

### 2.4 `game_scores`
Individual scores per game round.

```sql
CREATE TABLE IF NOT EXISTS game_scores (
    game_id TEXT NOT NULL,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    PRIMARY KEY (game_id, player_id)
);
```

### 2.5 `player_game_state`
Stores temporary game data for each player (votes, bingo marks) to keep the global `session_store` lean.

```sql
CREATE TABLE IF NOT EXISTS player_game_state (
    player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    trivia_votes JSONB DEFAULT '{}',
    quote_votes JSONB DEFAULT '{}',
    bingo_marked JSONB DEFAULT '[]',
    bingo_claimed_keys JSONB DEFAULT '[]'
);
```

## 3. SQL for Setup & Reset

### Initialize / Reset (Admin Action)

When the session is reset, we clear all tables to start fresh:

```sql
DO $$ 
BEGIN
    DELETE FROM players;
    DELETE FROM teams;
    DELETE FROM game_scores;
    DELETE FROM player_game_state;
    UPDATE session_store SET data = '{"guestStep": "party_protocol", "revision": 0, "countdownRemaining": null, "scheduledGameStartsAtEpochMs": null, "teamMcqRoundIndex": 0, "teamMcqRoundStartedAtEpochMs": null, "games": [], "bingoSongOrder": [], "bingoCurrentSongIndex": 0, "bingoRoundEndsAtEpochMs": null}' WHERE id = 1;
END $$;
```

## 4. Late Joins & Robustness

When a player joins late:
1.  A new record is added to the `players` table.
2.  If the game is in a **team-based step** (`lobby_trivia`, `game_trivia`, etc.), the player is assigned to the team with the lowest headcount to balance things out.
3.  The global `revision` is incremented to notify other clients (e.g. for the lobby list).

## 5. SSE & Real-time Integration

To avoid 2s polling on the server side:
- The `/api/events` route uses a Supabase Realtime channel to listen for `INSERT` or `UPDATE` on the `session_store` table.
- When an update occurs, it pushes the new `revision` and `guestStep` through the SSE stream.
- This ensures all browser instances react instantly across multiple Vercel Lambda instances.
