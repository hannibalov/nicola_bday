import { jest } from "@jest/globals";

type TableStore = Record<string, any[]>;

let stores: TableStore = {
  session: [{ id: 1, guest_step: "party_protocol", revision: 0 }],
  players: [],
  teams: [],
  team_membership: [],
  game_scores: [],
  votes: [],
  bingo_marks: [],
  bingo_claims: [],
};

// Global operation queue to prevent race conditions during concurrent Promise.all()
const tableQueues: Record<string, Promise<void>> = {};

// Store subscription callbacks for real-time notifications
const subscriptions: Array<{
  table: string;
  event: string;
  filter: string;
  callback: (payload: any) => void;
}> = [];

export { subscriptions };

const createMockBuilder = (table: string) => {
  let filterGroups: Array<{ col: string, val: any, type: 'eq' | 'neq' | 'in' | 'match' }> = [];
  let operation: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  let payload: any = null;
  let single = false;

  const builder: any = {
    select: jest.fn(() => { operation = 'select'; return builder; }),
    insert: jest.fn((p) => { operation = 'insert'; payload = p; return builder; }),
    upsert: jest.fn((p) => { operation = 'upsert'; payload = p; return builder; }),
    update: jest.fn((v) => { operation = 'update'; payload = v; return builder; }),
    delete: jest.fn(() => { operation = 'delete'; return builder; }),

    eq: jest.fn((col: string, val: any) => { filterGroups.push({ col, val, type: 'eq' }); return builder; }),
    neq: jest.fn((col: string, val: any) => { filterGroups.push({ col, val, type: 'neq' }); return builder; }),
    in: jest.fn((col: string, val: any) => { filterGroups.push({ col, val, type: 'in' }); return builder; }),
    match: jest.fn((val: any) => { filterGroups.push({ col: '', val, type: 'match' }); return builder; }),
    single: jest.fn(() => { single = true; return builder; }),

    async then(resolve: any, reject: any) {
      if (!tableQueues[table]) tableQueues[table] = Promise.resolve();

      const execute = async () => {
        try {
          let result: any = { data: null, error: null };
          const tableStore = stores[table] || [];

          let matchedRows = [...tableStore];
          for (const f of filterGroups) {
            if (f.type === 'eq') matchedRows = matchedRows.filter(r => r[f.col] === f.val);
            else if (f.type === 'neq') matchedRows = matchedRows.filter(r => r[f.col] !== f.val);
            else if (f.type === 'in') matchedRows = matchedRows.filter(r => f.val.includes(r[f.col]));
            else if (f.type === 'match') matchedRows = matchedRows.filter(r => Object.entries(f.val).every(([k, v]) => r[k] === v));
          }

          if (operation === 'select') {
            result.data = [...matchedRows];
          } else if (operation === 'insert') {
            const rows = Array.isArray(payload) ? payload : [payload];
            stores[table] = [...tableStore, ...rows];
            result.data = rows;

            subscriptions.forEach(sub => {
              if (sub.table === table && (sub.event === '*' || sub.event === 'INSERT' || sub.event === 'postgres_changes')) {
                rows.forEach(row => {
                  sub.callback({ eventType: 'INSERT', new: row, old: null });
                });
              }
            });
          } else if (operation === 'upsert') {
            const rows = Array.isArray(payload) ? payload : [payload];
            const newStore = [...stores[table]];
            rows.forEach(row => {
              const idx = newStore.findIndex(r => {
                if (table === 'session' && r.id === row.id) return true;
                if (table === 'players' && r.id === row.id) return true;
                if (table === 'teams' && r.id === row.id) return true;
                if (table === 'game_scores' && r.game_id === row.game_id && r.player_id === row.player_id) return true;
                if (table === 'votes' && r.player_id === row.player_id && r.game_id === row.game_id && r.question_id === row.question_id) return true;
                if (table === 'bingo_marks' && r.player_id === row.player_id && r.cell_index === row.cell_index) return true;
                if (table === 'bingo_claims' && r.player_id === row.player_id && r.line_key === row.line_key) return true;
                return false;
              });
              if (idx >= 0) newStore[idx] = { ...newStore[idx], ...row };
              else newStore.push(row);
            });
            stores[table] = newStore;
            result.data = rows;

            // Trigger real-time subscriptions for updates
            if (table === 'session') {
              subscriptions.forEach(sub => {
                if (sub.table === table && (sub.event === '*' || sub.event === 'UPDATE' || sub.event === 'postgres_changes')) {
                  rows.forEach(row => {
                    sub.callback({ eventType: 'UPDATE', new: row, old: null });
                  });
                }
              });
            }
          } else if (operation === 'update') {
            const matchedFingerprints = new Set(matchedRows.map(m => JSON.stringify(m)));
            stores[table] = tableStore.map(r => {
              if (matchedFingerprints.has(JSON.stringify(r))) return { ...r, ...payload };
              return r;
            });
            result.data = payload;
          } else if (operation === 'delete') {
            const matchedFingerprints = new Set(matchedRows.map(m => JSON.stringify(m)));
            stores[table] = tableStore.filter(r => !matchedFingerprints.has(JSON.stringify(r)));
          }

          if (single) {
            result.data = result.data?.[0] || null;
          }

          return result;
        } catch (err) {
          throw err;
        }
      };

      tableQueues[table] = tableQueues[table].then(execute).then(
        res => resolve(res),
        err => reject(err)
      );
      return tableQueues[table];
    },
  };

  return builder;
};

const createMockChannel = (channelName: string) => {
  let onCallback: ((payload: any) => void) | null = null;

  return {
    on: jest.fn().mockImplementation((event: string, filter: any, callback: (payload: any) => void) => {
      // Extract table from filter if available, otherwise from channel name
      const tableName = filter?.table || channelName.split(':')[0];
      subscriptions.push({
        table: tableName,
        event,
        filter,
        callback
      });
      onCallback = callback;
      return createMockChannel(channelName);
    }),
    subscribe: jest.fn(() => {
      // Simulate immediate subscription success
      return Promise.resolve('SUBSCRIBED');
    }),
    unsubscribe: jest.fn(() => {
      // Remove subscriptions for this channel
      const table = channelName.split(':')[0];
      const idx = subscriptions.findIndex(s => s.table === table);
      if (idx >= 0) subscriptions.splice(idx, 1);
    }),
    // Helper method to manually trigger callbacks for testing
    trigger: (payload: any) => {
      if (onCallback) onCallback(payload);
    }
  };
};

export const supabase = {
  from: jest.fn((table: string) => createMockBuilder(table)),
  channel: jest.fn((name: string) => createMockChannel(name)),
  removeChannel: jest.fn(),
};

export function resetMockSupabase() {
  stores = {
    session: [{ id: 1, guest_step: "party_protocol", revision: 0 }],
    players: [],
    teams: [],
    team_membership: [],
    game_scores: [],
    votes: [],
    bingo_marks: [],
    bingo_claims: [],
  };
  subscriptions.length = 0;
  Object.keys(tableQueues).forEach(k => delete tableQueues[k]);
}

export function setMockState(data: any) {
  stores.session = [{ id: 1, ...data }];
}
