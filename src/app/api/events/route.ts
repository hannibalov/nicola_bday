import { supabase } from "@/lib/supabase";
import { formatSseData } from "@/lib/sseFormat";
import { getSessionState } from "@/lib/store";
import type { SessionState } from "@/types";

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

export async function GET(request?: Request) {
  const req = request ?? new Request("http://localhost/api/events");
  const upgrade = req.headers.get("upgrade");
  if (upgrade && upgrade.toLowerCase() === "websocket") {
    return handleWebSocket();
  }
  return handleSSE();
}

const ensurePayload = async (sessionRow: SessionRow | null) => {
  const state = await getSessionState();
  return {
    revision: sessionRow?.revision ?? state.revision,
    guestStep: sessionRow?.guest_step ?? state.guestStep,
    playerCount: state.players.length,
  };
};

async function handleWebSocket() {
  const { 0: client, 1: server } = new WebSocketPair();

  server.accept();

  // 1. Initial push
  const { data: initial } = await supabase
    .from("session")
    .select("*")
    .eq("id", 1)
    .single();

  server.send(JSON.stringify(await ensurePayload(initial)));

  const sessionChannel = supabase.channel("session_updates")
    .on(
      "postgres_changes" as any,
      { event: "UPDATE", schema: "public", table: "session", filter: "id=eq.1" } as any,
      (async (payload: { new: SessionRow | null }) => {
        const newData = payload.new;
        if (!newData) return;
        try {
          server.send(JSON.stringify(await ensurePayload(newData)));
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
          const state = await getSessionState();
          server.send(JSON.stringify({
            revision: state.revision,
            guestStep: state.guestStep,
            playerCount: state.players.length,
          }));
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

async function handleSSE() {
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
          formatSseData(await ensurePayload(initial))
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
                  formatSseData(await ensurePayload(newData))
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
              const state = await getSessionState();
              controller.enqueue(
                encoder.encode(
                  formatSseData({
                    revision: state.revision,
                    guestStep: state.guestStep,
                    playerCount: state.players.length,
                  })
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
