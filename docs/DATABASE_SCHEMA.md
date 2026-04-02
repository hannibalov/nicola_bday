# Database Schema & Structure (v2.0)

This redesign moves from a monolithic JSONB store to a fully relational model. It specifically addresses the requirement for **per-game team shuffling** and provides an **explicit state table** for the host (admin) to monitor.

## 1. Tables Overview

| Table | Purpose |
|-------|---------|
| `session` | **Global Game State**: Current step, revision, and game-specific progress (MCQ index, Bingo song). |
| `players` | All registered guests. |
| `teams` | Team definitions **scoped to a specific game** (Trivia vs. Quotes). |
| `team_members` | Joins players to teams for the active game. |
| `game_scores` | History of player scores per game round. |
| `votes` | Player choices for MCQ games (Trivia/Quotes). |
| `bingo_state` | Real-time marks and claims for Music Bingo. |

## 2. Relational Schema (SQL)

### 2.1 Game Control (Admin visible)
This replaces the old `session_store` JSONB. It has explicit columns for robustness and visibility.

```sql
CREATE TABLE IF NOT EXISTS session (
    id INTEGER PRIMARY KEY DEFAULT 1,
    guest_step TEXT NOT NULL DEFAULT 'party_protocol',
    revision INTEGER NOT NULL DEFAULT 0,
    scheduled_start_ms BIGINT,
    mcq_round_index INTEGER DEFAULT 0,
    mcq_round_start_ms BIGINT,
    bingo_song_order JSONB DEFAULT '[]',
    bingo_current_index INTEGER DEFAULT 0,
    bingo_round_end_ms BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (id = 1)
);

-- Initialize
INSERT INTO session (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE session;
```

### 2.2 Players & Teams (Per-game shuffling)
Teams are linked to a `game_id` to allow shuffling between Trivia and Quotes.

```sql
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL, -- 'game-trivia' or 'game-quotes'
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
    team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
    player_id TEXT REFERENCES players(id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, player_id)
);
```

### 2.3 Gameplay & Scoring
```sql
CREATE TABLE IF NOT EXISTS game_scores (
    game_id TEXT NOT NULL,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    PRIMARY KEY (game_id, player_id)
);

CREATE TABLE IF NOT EXISTS votes (
    player_id TEXT REFERENCES players(id) ON DELETE CASCADE,
    game_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    PRIMARY KEY (player_id, game_id, question_id)
);

CREATE TABLE IF NOT EXISTS bingo_marks (
    player_id TEXT REFERENCES players(id) ON DELETE CASCADE,
    cell_index INTEGER NOT NULL,
    PRIMARY KEY (player_id, cell_index)
);

CREATE TABLE IF NOT EXISTS bingo_claims (
    player_id TEXT REFERENCES players(id) ON DELETE CASCADE,
    line_key TEXT NOT NULL,
    PRIMARY KEY (player_id, line_key)
);
```

## 3. Session Reset Procedure

When the Host clicks **Reset Session**, the following operations occur:
1.  **Clear Players & Teams**: Deletes all records from `players`, `teams`, `team_members`.
2.  **Clear Gameplay data**: Deletes all `votes`, `scores`, `bingo_marks`, `bingo_claims`.
3.  **Reset Session State**: Sets `guest_step` back to `'party_protocol'` and resets counters.

```sql
-- TRUNCATE is efficient for clearing a party session
TRUNCATE players, teams, game_scores, votes, bingo_marks, bingo_claims CASCADE;

UPDATE session SET 
    guest_step = 'party_protocol',
    revision = 0,
    scheduled_start_ms = NULL,
    mcq_round_index = 0,
    mcq_round_start_ms = NULL,
    bingo_song_order = '[]',
    bingo_current_index = 0,
    bingo_round_end_ms = NULL,
    updated_at = NOW()
WHERE id = 1;
```

## 4. Robustness: Late Join & Recovey

- **Connectivity**: LocalStorage stores the `playerId`. If the server connection drops, the player remains in their assigned team because membership is persisted in `team_members`.
- **Late Assignment**: If a player registers while `guest_step` is in a team phase, the server assigns them to the existing team with the fewest members for that `game_id`.
- **Points**: Late players start with 0 points but participate in remaining majority-vote checks.
