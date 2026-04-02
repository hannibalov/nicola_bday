import { createClient } from "@supabase/supabase-js";

/** Use service role key to bypass RLS for session state writes (server-side only). */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";

let supabase: any;
let resetTestTables: () => void = () => { };

if (process.env.NODE_ENV === 'test') {
    // In-memory database for tests
    const tables: Record<string, any[]> = {
        session: [{
            id: 1,
            guest_step: "party_protocol",
            revision: 0,
            scheduled_start_ms: null,
            mcq_round_index: 0,
            mcq_round_start_ms: null,
            bingo_song_order: [],
            bingo_current_index: 0,
            bingo_round_end_ms: null,
            updated_at: new Date().toISOString(),
        }],
        players: [],
        teams: [],
        team_membership: [],
        game_scores: [],
        votes: [],
        bingo_marks: [],
        bingo_claims: [],
    };

    const resetTables = () => {
        tables.session = [{
            id: 1,
            guest_step: "party_protocol",
            revision: 0,
            scheduled_start_ms: null,
            mcq_round_index: 0,
            mcq_round_start_ms: null,
            bingo_song_order: [],
            bingo_current_index: 0,
            bingo_round_end_ms: null,
            updated_at: new Date().toISOString(),
        }];
        tables.players = [];
        tables.teams = [];
        tables.team_membership = [];
        tables.game_scores = [];
        tables.votes = [];
        tables.bingo_marks = [];
        tables.bingo_claims = [];
    };

    resetTables(); // initial reset

    resetTestTables = resetTables;

    const mockClient = {
        from: (table: string) => {
            const data = tables[table] || [];
            return {
                select: (columns?: string) => {
                    const result = {
                        eq: (col: string, val: any) => {
                            if (table === 'session') {
                                return { single: () => ({ data: tables.session[0], error: null }) };
                            }
                            return { data: data.filter((row: any) => row[col] === val), error: null };
                        },
                        neq: (col: string, val: any) => {
                            // for delete
                            return { data: null, error: null };
                        },
                        data: [...data],
                        error: null,
                    };
                    return result;
                },
                update: (updates: any) => {
                    return {
                        eq: (col: string, val: any) => {
                            if (table === 'session' && col === 'id' && val === 1) {
                                const mapped: any = {};
                                mapped.guest_step = updates.guest_step ?? updates.guestStep ?? tables.session[0].guest_step;
                                mapped.revision = updates.revision ?? tables.session[0].revision;
                                mapped.scheduled_start_ms = updates.scheduled_start_ms ?? updates.scheduledGameStartsAtEpochMs ?? tables.session[0].scheduled_start_ms;
                                mapped.mcq_round_index = updates.mcq_round_index ?? updates.teamMcqRoundIndex ?? tables.session[0].mcq_round_index;
                                mapped.mcq_round_start_ms = updates.mcq_round_start_ms ?? updates.teamMcqRoundStartedAtEpochMs ?? tables.session[0].mcq_round_start_ms;
                                mapped.bingo_song_order = updates.bingo_song_order ?? updates.bingoSongOrder ?? tables.session[0].bingo_song_order;
                                mapped.bingo_current_index = updates.bingo_current_index ?? updates.bingoCurrentSongIndex ?? tables.session[0].bingo_current_index;
                                mapped.bingo_round_end_ms = updates.bingo_round_end_ms ?? updates.bingoRoundEndsAtEpochMs ?? tables.session[0].bingo_round_end_ms;
                                mapped.updated_at = new Date().toISOString();
                                tables.session[0] = { ...tables.session[0], ...mapped };
                            }
                            return { data: null, error: null };
                        }
                    };
                },
                delete: () => {
                    return {
                        eq: (col: string, val: any) => {
                            tables[table] = tables[table].filter((r) => r[col] !== val);
                            return { data: null, error: null };
                        },
                        neq: (col: string, val: any) => {
                            tables[table] = [];
                            return { data: null, error: null };
                        },
                        match: (conditions: any) => {
                            tables[table] = tables[table].filter((row) => !Object.entries(conditions).every(([k, v]) => row[k] === v));
                            return { data: null, error: null };
                        }
                    };
                },
                insert: (rows: any) => {
                    const arr = Array.isArray(rows) ? rows : [rows];
                    tables[table].push(...arr);
                    return { data: null, error: null };
                },
                upsert: (rows: any) => {
                    const arr = Array.isArray(rows) ? rows : [rows];
                    arr.forEach((row) => {
                        let existingIndex = -1;
                        if (table === 'session') {
                            existingIndex = 0;
                        } else if (table === 'teams') {
                            existingIndex = tables[table].findIndex((r) => r.id === row.id);
                        } else if (table === 'game_scores') {
                            existingIndex = tables[table].findIndex((r) => r.game_id === row.game_id && r.player_id === row.player_id);
                        } else if (table === 'votes') {
                            existingIndex = tables[table].findIndex((r) => r.player_id === row.player_id && r.game_id === row.game_id && r.question_id === row.question_id);
                        } else if (table === 'bingo_marks') {
                            existingIndex = tables[table].findIndex((r) => r.player_id === row.player_id && r.cell_index === row.cell_index);
                        } else if (table === 'bingo_claims') {
                            existingIndex = tables[table].findIndex((r) => r.player_id === row.player_id && r.line_key === row.line_key);
                        } else if (table === 'players') {
                            existingIndex = tables[table].findIndex((r) => r.id === row.id);
                        } else if (table === 'team_membership') {
                            existingIndex = tables[table].findIndex((r) => r.team_id === row.team_id && r.player_id === row.player_id);
                        }
                        if (existingIndex >= 0) {
                            tables[table][existingIndex] = { ...tables[table][existingIndex], ...row };
                        } else {
                            tables[table].push(row);
                        }
                    });
                    return { data: null, error: null };
                },
            };
        },
    };

    supabase = mockClient;
} else {
    supabase = createClient(SUPABASE_URL || "http://localhost:54321", SUPABASE_SECRET_KEY || "dummy");
}

export { supabase, resetTestTables };
