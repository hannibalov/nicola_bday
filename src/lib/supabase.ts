import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Use service role key to bypass RLS for session state writes (server-side only). */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";

type DbRecord = Record<string, unknown>;
type TableStore = Record<string, DbRecord[]>;

type MockBuilder = {
    select: () => MockBuilder;
    insert: (rows: unknown) => MockBuilder;
    upsert: (rows: unknown) => MockBuilder;
    update: (updates: Record<string, unknown>) => MockBuilder;
    delete: () => MockBuilder;
    eq: (col: string, val: unknown) => MockBuilder;
    neq: (col: string, val: unknown) => MockBuilder;
    in: (col: string, val: unknown[]) => MockBuilder;
    match: (conditions: Record<string, unknown>) => MockBuilder;
    single: () => MockBuilder;
    then: (
        resolve: (value: { data: DbRecord[] | DbRecord | null; error: null }) => unknown,
        reject: (err: unknown) => unknown
    ) => Promise<unknown>;
};

type MockChannel = {
    on: (
        event: string,
        filter: Record<string, unknown>,
        callback: (payload: { eventType: string; new: DbRecord | null; old: DbRecord | null }) => void
    ) => MockChannel;
    subscribe: () => Promise<unknown>;
    unsubscribe: () => Promise<unknown>;
    trigger: (payload: { eventType: string; new: DbRecord | null; old: DbRecord | null }) => void;
};

type MockSupabaseClient = {
    from: (table: string) => MockBuilder;
    channel: (name: string) => MockChannel;
    removeChannel: (channel: unknown) => void;
};

let supabase: SupabaseClient | MockSupabaseClient;
let resetTestTables: () => void = () => { };

if (process.env.NODE_ENV === 'test') {
    const tables: TableStore = {
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

    resetTables();
    resetTestTables = resetTables;

    const createMockBuilder = (table: string): MockBuilder => {
        const filterGroups: Array<{ col: string; val: unknown; type: 'eq' | 'neq' | 'in' | 'match' }> = [];
        let operation: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
        let payload: unknown = null;
        let single = false;

        const builder: MockBuilder = {
            select() {
                operation = 'select';
                return builder;
            },
            insert(rows: unknown) {
                operation = 'insert';
                payload = rows;
                return builder;
            },
            upsert(rows: unknown) {
                operation = 'upsert';
                payload = rows;
                return builder;
            },
            update(updates: Record<string, unknown>) {
                operation = 'update';
                payload = updates;
                return builder;
            },
            delete() {
                operation = 'delete';
                return builder;
            },
            eq(col: string, val: unknown) {
                filterGroups.push({ col, val, type: 'eq' });
                return builder;
            },
            neq(col: string, val: unknown) {
                filterGroups.push({ col, val, type: 'neq' });
                return builder;
            },
            in(col: string, val: unknown[]) {
                filterGroups.push({ col, val, type: 'in' });
                return builder;
            },
            match(conditions: Record<string, unknown>) {
                filterGroups.push({ col: '', val: conditions, type: 'match' });
                return builder;
            },
            single() {
                single = true;
                return builder;
            },
            then(resolve, reject) {
                const execute = async () => {
                    const result: { data: DbRecord[] | DbRecord | null; error: null } = { data: null, error: null };
                    const tableStore = tables[table] ?? [];

                    let matchedRows = [...tableStore];
                    for (const f of filterGroups) {
                        if (f.type === 'eq') {
                            matchedRows = matchedRows.filter((r) => r[f.col] === f.val);
                        } else if (f.type === 'neq') {
                            matchedRows = matchedRows.filter((r) => r[f.col] !== f.val);
                        } else if (f.type === 'in') {
                            matchedRows = matchedRows.filter((r) => Array.isArray(f.val) && f.val.includes(r[f.col]));
                        } else if (f.type === 'match' && typeof f.val === 'object' && f.val !== null) {
                            matchedRows = matchedRows.filter((row) =>
                                Object.entries(f.val as Record<string, unknown>).every(([k, v]) => row[k] === v)
                            );
                        }
                    }

                    if (operation === 'select') {
                        result.data = [...matchedRows];
                    } else if (operation === 'insert') {
                        const rows = Array.isArray(payload) ? payload : [payload];
                        tables[table] = [...tableStore, ...(rows as DbRecord[])];
                        result.data = rows as DbRecord[];
                    } else if (operation === 'upsert') {
                        const rows = Array.isArray(payload) ? payload : [payload];
                        const newStore = [...tableStore];
                        (rows as DbRecord[]).forEach((row) => {
                            let idx = -1;
                            if (table === 'session') {
                                idx = 0;
                            } else if (table === 'teams') {
                                idx = newStore.findIndex((r) => r.id === (row as Record<string, unknown>).id);
                            } else if (table === 'game_scores') {
                                idx = newStore.findIndex((r) => r.game_id === (row as Record<string, unknown>).game_id && r.player_id === (row as Record<string, unknown>).player_id);
                            } else if (table === 'votes') {
                                idx = newStore.findIndex((r) => r.player_id === (row as Record<string, unknown>).player_id && r.game_id === (row as Record<string, unknown>).game_id && r.question_id === (row as Record<string, unknown>).question_id);
                            } else if (table === 'bingo_marks') {
                                idx = newStore.findIndex((r) => r.player_id === (row as Record<string, unknown>).player_id && r.cell_index === (row as Record<string, unknown>).cell_index);
                            } else if (table === 'bingo_claims') {
                                idx = newStore.findIndex((r) => r.player_id === (row as Record<string, unknown>).player_id && r.line_key === (row as Record<string, unknown>).line_key);
                            } else if (table === 'players') {
                                idx = newStore.findIndex((r) => r.id === (row as Record<string, unknown>).id);
                            } else if (table === 'team_membership') {
                                idx = newStore.findIndex((r) => r.team_id === (row as Record<string, unknown>).team_id && r.player_id === (row as Record<string, unknown>).player_id);
                            }
                            if (idx >= 0) {
                                newStore[idx] = { ...newStore[idx], ...(row as DbRecord) };
                            } else {
                                newStore.push(row as DbRecord);
                            }
                        });
                        tables[table] = newStore;
                        result.data = rows as DbRecord[];
                    } else if (operation === 'update') {
                        const matchedFingerprints = new Set(matchedRows.map((m) => JSON.stringify(m)));
                        tables[table] = tableStore.map((r) =>
                            matchedFingerprints.has(JSON.stringify(r)) ? { ...r, ...(payload as Record<string, unknown>) } : r
                        );
                        result.data = payload as DbRecord[];
                    } else if (operation === 'delete') {
                        const matchedFingerprints = new Set(matchedRows.map((m) => JSON.stringify(m)));
                        tables[table] = tableStore.filter((r) => !matchedFingerprints.has(JSON.stringify(r)));
                    }

                    if (single) {
                        result.data = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
                    }

                    return result;
                };

                return Promise.resolve().then(execute).then(resolve, reject);
            },
        };

        return builder;
    };

    const createMockChannel = (channelName: string): MockChannel => {
        let onCallback: ((payload: { eventType: string; new: DbRecord | null; old: DbRecord | null }) => void) | null = null;

        return {
            on(event: string, filter: Record<string, unknown>, callback: (payload: { eventType: string; new: DbRecord | null; old: DbRecord | null }) => void) {
                const tableName = (filter?.table as string) || channelName.split(':')[0];
                subscriptions.push({
                    table: tableName,
                    event,
                    filter,
                    callback,
                });
                onCallback = callback;
                return createMockChannel(channelName);
            },
            subscribe() {
                return Promise.resolve();
            },
            unsubscribe() {
                const table = channelName.split(':')[0];
                const idx = subscriptions.findIndex((s) => s.table === table);
                if (idx >= 0) subscriptions.splice(idx, 1);
                return Promise.resolve();
            },
            trigger(payload) {
                if (onCallback) onCallback(payload);
            },
        };
    };

    const subscriptions: Array<{
        table: string;
        event: string;
        filter: Record<string, unknown>;
        callback: (payload: { eventType: string; new: DbRecord | null; old: DbRecord | null }) => void;
    }> = [];

    const mockClient: MockSupabaseClient = {
        from: (table: string) => createMockBuilder(table),
        channel: (name: string) => createMockChannel(name),
        removeChannel: () => { },
    };

    supabase = mockClient;
} else {
    supabase = createClient(SUPABASE_URL || "http://localhost:54321", SUPABASE_SECRET_KEY || "dummy");
}

export { supabase, resetTestTables };
