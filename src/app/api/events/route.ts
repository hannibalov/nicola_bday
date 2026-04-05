import { supabase } from "@/lib/supabase";
import { formatSseData } from "@/lib/sseFormat";
import { getPublicState, getSessionState } from "@/lib/store";
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

  const sessionChannel = supabase.channel("session_updates")
    .on(
      "postgres_changes" as any,
      { event: "UPDATE", schema: "public", table: "session", filter: "id=eq.1" } as any,
      (async (payload: { new: SessionRow | null }) => {
        const newData = payload.new;
        if (!newData) return;
        try {
          server.send(JSON.stringify(await ensurePayload(request, newData)));
        } catch {
          // Handle error
        }
      }) as any
    ) as any;

  const sessionStatus = await sessionChannel.subscribe();
  if (sessionStatus !== 'SUBSCRIBED') {
    server.close();
    return new Response(null, { status: 500 });
  }

  const playerChannel = supabase.channel("player_updates")
    .on(
      "postgres_changes" as any,
      { event: "INSERT", schema: "public", table: "players" } as any,
      (async () => {
        try {
          server.send(JSON.stringify(await ensurePayload(request, null)));
        } catch {
          // Handle error
        }
      }) as any
    ) as any;

  const playerStatus = await playerChannel.subscribe();
  if (playerStatus !== 'SUBSCRIBED') {
    server.close();
    return new Response(null, { status: 500 });
  }

  server.addEventListener("close", () => {
    supabase.removeChannel(sessionChannel);
    supabase.removeChannel(playerChannel);
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

      const sessionChannel = supabase.channel("session_updates")
        .on(
          "postgres_changes" as any,
          { event: "UPDATE", schema: "public", table: "session", filter: "id=eq.1" } as any,
          (async (payload: { new: SessionRow | null }) => {
            const newData = payload.new;
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
          }) as any
        ) as any;

      const sessionStatus = await sessionChannel.subscribe();
      if (sessionStatus !== 'SUBSCRIBED') {
        controller.close();
        return;
      }

      const playerChannel = supabase.channel("player_updates")
        .on(
          "postgres_changes" as any,
          { event: "INSERT", schema: "public", table: "players" } as any,
          (async () => {
            try {
              controller.enqueue(
                encoder.encode(
                  formatSseData(await ensurePayload(request, null))
                )
              );
            } catch {
              // Handle error
            }
          }) as any
        ) as any;

      const playerStatus = await playerChannel.subscribe();
      if (playerStatus !== 'SUBSCRIBED') {
        controller.close();
        return;
      }

      return () => {
        supabase.removeChannel(sessionChannel);
        supabase.removeChannel(playerChannel);
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
