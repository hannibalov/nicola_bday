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
        .from("session")
        .select("*")
        .eq("id", 1)
        .single();
      
      if (initial) {
        controller.enqueue(
          encoder.encode(
            formatSseData({
              revision: initial.revision,
              guestStep: initial.guest_step,
              playerCount: 0, // Placeholder; client will refetch full state
            })
          )
        );
      }

      // 2. Subscribe to DB changes
      const channel = supabase
        .channel("session_updates")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "session", filter: "id=eq.1" },
          (payload) => {
            const newData = payload.new as any;
            if (!newData) return;
            try {
              controller.enqueue(
                encoder.encode(
                  formatSseData({
                    revision: newData.revision,
                    guestStep: newData.guest_step,
                    playerCount: 0, // Placeholder
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
