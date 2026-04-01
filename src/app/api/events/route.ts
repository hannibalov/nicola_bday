import { supabase } from "@/lib/supabase";
import { formatSseData } from "@/lib/sseFormat";
import type { SessionState } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // 1. Initial push
      const { data: initial } = await supabase
        .from("session_store")
        .select("data")
        .eq("id", 1)
        .single();
      
      const sInitial = initial?.data as SessionState;
      if (sInitial) {
        controller.enqueue(
          encoder.encode(
            formatSseData({
              revision: sInitial.revision,
              guestStep: sInitial.guestStep,
              playerCount: sInitial.players?.length ?? 0,
            })
          )
        );
      }

      // 2. Subscribe to DB changes
      const channel = supabase
        .channel("session_updates")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "session_store", filter: "id=eq.1" },
          (payload) => {
            const newData = payload.new as any;
            if (!newData?.data) return;
            const s = newData.data as SessionState;
            try {
              controller.enqueue(
                encoder.encode(
                  formatSseData({
                    revision: s.revision,
                    guestStep: s.guestStep,
                    playerCount: s.players?.length ?? 0,
                  })
                )
              );
            } catch {
              // stream closed
            }
          }
        )
        .subscribe();

      // Return a function to clean up when the stream is cancelled
      return () => {
        supabase.removeChannel(channel);
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
