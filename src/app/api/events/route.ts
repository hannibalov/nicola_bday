import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { formatSseData } from "@/lib/sseFormat";
import { getPublicState } from "@/lib/store";
import { resolvePlayerIdFromRequest } from "@/lib/requestPlayer";
import type { SessionState, PublicState } from "@/types";

export const runtime = 'edge';
export const dynamic = "force-dynamic";

declare const WebSocketPair: {
  new(): [
    WebSocket,
    {
      accept(): void;
      send(data: string): void;
      close(code?: number, reason?: string): void;
      addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
    }
  ];
};

type SessionRow = {
  id: number;
  guest_step: SessionState["guestStep"];
  revision: number;
};

type SessionEventPayload = {
  revision: number;
  guestStep: SessionState["guestStep"];
  playerCount: number;
  fullState?: PublicState;
};

/** Supabase Realtime `.on("postgres_changes", …)` is not typed for generic tables in edge builds. */
type PostgresChangesFilter = {
  event: string;
  schema: string;
  table: string;
  filter?: string;
};

type PostgresChangePayload = { new: unknown };

type PostgresRealtimeChannel = {
  on(
    event: "postgres_changes",
    filter: PostgresChangesFilter,
    callback: (payload: PostgresChangePayload) => void | Promise<void>,
  ): PostgresRealtimeChannel;
  subscribe(): Promise<string>;
};

function channelForPostgres(name: string): PostgresRealtimeChannel {
  return supabase.channel(name) as unknown as PostgresRealtimeChannel;
}

/** `channelForPostgres` narrows the type for `.on()`; cleanup must pass the real `RealtimeChannel`. */
function removePostgresChannel(ch: PostgresRealtimeChannel): void {
  supabase.removeChannel(ch as unknown as RealtimeChannel);
}

/** Supabase reuses `channel(name)`; a second SSE/WS connection must not `.on()` after the first subscribed. */
function uniqueRealtimeChannelPair() {
  const id = crypto.randomUUID();
  return {
    session: `session_updates:${id}`,
    players: `player_updates:${id}`,
  };
}

export async function GET(request?: Request) {
  const req = request ?? new Request("http://localhost/api/events");
  const upgrade = req.headers.get("upgrade");
  if (upgrade && upgrade.toLowerCase() === "websocket") {
    return handleWebSocket(req);
  }
  return handleSSE(req);
}

const ensurePayload = async (
  request: Request,
  sessionRow: SessionRow | null,
): Promise<SessionEventPayload> => {
  const playerId = resolvePlayerIdFromRequest(request);
  const publicState = await getPublicState(playerId);
  return {
    revision: sessionRow?.revision ?? publicState.revision,
    guestStep: sessionRow?.guest_step ?? publicState.guestStep,
    playerCount: publicState.playerCount,
    fullState: publicState,
  };
};

async function handleWebSocket(request: Request) {
  const { 0: client, 1: server } = new WebSocketPair();

  server.accept();

  // 1. Initial push
  const { data: initial } = await supabase
    .from("session")
    .select("*")
    .eq("id", 1)
    .single();

  server.send(JSON.stringify(await ensurePayload(request, initial)));

  const channels = uniqueRealtimeChannelPair();
  const sessionChannel = channelForPostgres(channels.session).on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "session", filter: "id=eq.1" },
    async (payload) => {
      const newData = payload.new as SessionRow | null;
      if (!newData) return;
      try {
        server.send(JSON.stringify(await ensurePayload(request, newData)));
      } catch {
        // Handle error
      }
    },
  );

  const sessionStatus = await sessionChannel.subscribe();
  if (sessionStatus !== 'SUBSCRIBED') {
    server.close();
    return new Response(null, { status: 500 });
  }

  const playerChannel = channelForPostgres(channels.players).on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "players" },
    async () => {
      try {
        server.send(JSON.stringify(await ensurePayload(request, null)));
      } catch {
        // Handle error
      }
    },
  );

  const playerStatus = await playerChannel.subscribe();
  if (playerStatus !== 'SUBSCRIBED') {
    server.close();
    return new Response(null, { status: 500 });
  }

  server.addEventListener("close", () => {
    removePostgresChannel(sessionChannel);
    removePostgresChannel(playerChannel);
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  } as ResponseInit & { webSocket: WebSocket });
}

async function handleSSE(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const { data: initial } = await supabase
        .from("session")
        .select("*")
        .eq("id", 1)
        .single();

      controller.enqueue(
        encoder.encode(
          formatSseData(await ensurePayload(request, initial))
        )
      );

      const channels = uniqueRealtimeChannelPair();
      const sessionChannel = channelForPostgres(channels.session).on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "session", filter: "id=eq.1" },
        async (payload) => {
          const newData = payload.new as SessionRow | null;
          if (!newData) return;
          try {
            controller.enqueue(
              encoder.encode(
                formatSseData(await ensurePayload(request, newData))
              )
            );
          } catch {
            // Handle error
          }
        },
      );

      const sessionStatus = await sessionChannel.subscribe();
      if (sessionStatus !== 'SUBSCRIBED') {
        controller.close();
        return;
      }

      const playerChannel = channelForPostgres(channels.players).on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "players" },
        async () => {
          try {
            controller.enqueue(
              encoder.encode(
                formatSseData(await ensurePayload(request, null))
              )
            );
          } catch {
            // Handle error
          }
        },
      );

      const playerStatus = await playerChannel.subscribe();
      if (playerStatus !== 'SUBSCRIBED') {
        controller.close();
        return;
      }

      return () => {
        removePostgresChannel(sessionChannel);
        removePostgresChannel(playerChannel);
      };
    },
    cancel() {
      // Clean up if needed
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
