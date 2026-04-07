# Database schema (Supabase)

This document matches the **relational layout** used by `src/lib/store.ts` and the in-memory Supabase mock in `src/lib/supabase.ts`. Scores and bingo progress are normalized into tables; there is **no** monolithic JSONB session blob for gameplay.

## 1. Tables overview

| Table | Purpose |
|-------|---------|
| `session` | Single row (`id = 1`): `guest_step`, `revision`, MCQ round fields, bingo playlist index and round end time. |
| `players` | Registered guests (`id`, `nickname`). |
| `teams` | Team definitions per game (`game_id` ties trivia vs quotes). |
| `team_membership` | Many-to-many: `team_id`, `player_id`. |
| `game_scores` | One row per `(game_id, player_id)` with cumulative **integer** `score` (can be **negative** during music bingo wrong-tap penalties). |
| `votes` | MCQ answers for trivia and quotes (`player_id`, `game_id`, `question_id`, `option_index`). |
| `bingo_marks` | Marked cells for music bingo (`player_id`, `cell_index`). |
| `bingo_claims` | Claimed line keys / full card (`player_id`, `line_key`). |

There is **no** `bingo_state` or `team_members` table in the codebase — use `bingo_marks`, `bingo_claims`, and `team_membership` respectively.

## 2. SQL (reference)

### 2.1 Session row

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

INSERT INTO session (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Realtime: enable for your publication if you use Supabase Realtime on this row
-- ALTER PUBLICATION supabase_realtime ADD TABLE session;
```

### 2.2 Players and teams

```sql
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    game_id TEXT, -- e.g. game-trivia, game-quotes; null when unused
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_membership (
    team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
    player_id TEXT REFERENCES players(id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, player_id)
);
```

### 2.3 Scores, votes, bingo

```sql
CREATE TABLE IF NOT EXISTS game_scores (
    game_id TEXT NOT NULL,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    score INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (game_id, player_id)
);
```

`score` is **not** clamped at zero: music bingo applies a **−5** server-side penalty when a player marks a tile that is not the host’s current track (`BINGO_WRONG_TAP_PENALTY` in `src/lib/bingoRound.ts`). Line/full-card awards are applied on `POST /api/game/bingo/claim` and stored in the same table under `game_id = 'game-bingo'`.

```sql
CREATE TABLE IF NOT EXISTS votes (
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    game_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    PRIMARY KEY (player_id, game_id, question_id)
);

CREATE TABLE IF NOT EXISTS bingo_marks (
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    cell_index INTEGER NOT NULL,
    PRIMARY KEY (player_id, cell_index)
);

CREATE TABLE IF NOT EXISTS bingo_claims (
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    line_key TEXT NOT NULL,
    PRIMARY KEY (player_id, line_key)
);
```

## 3. Session reset (host)

Align table names with migrations. Clear party data and reset the singleton session row:

```sql
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

`TRUNCATE ... CASCADE` removes teams and dependent `team_membership` rows.

## 4. Behaviour notes

- **Music bingo scoring:** Correct taps only persist marks; **points** come from claiming completed rows/columns/full card. Wrong taps do **not** set a mark; they decrement `game_scores` for `game-bingo` by 5.
- **Late join:** `playerId` in localStorage; team assignment for team phases is handled in `registerPlayer` when `guest_step` is in a team context.
- **Recovery:** If the app shows a stale score after a mark, the client refetches `/api/state` after mutations and ignores out-of-order fetch responses (`PlayView` fetch epoch).

## 5. Typos / doc drift (fixed here)

- Prefer **`team_membership`** over `team_members`.
- Prefer **`game_scores`** over a generic `scores` table in reset scripts.
- **`bingo_state`** was documentation-only; runtime uses **`bingo_marks`** + **`bingo_claims`**.
