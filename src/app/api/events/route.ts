import { getSessionState } from "@/lib/store";
import { formatSseData } from "@/lib/sseFormat";
import { subscribeSessionChanged } from "@/lib/sessionNotify";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = async () => {
        try {
          const s = await getSessionState();
          controller.enqueue(
            encoder.encode(
              formatSseData({
                revision: s.revision,
                guestStep: s.guestStep,
                playerCount: s.players.length,
              })
            )
          );
        } catch {
          /* closed */
        }
      };
      unsubscribe = subscribeSessionChanged(send);
      send();
    },
    cancel() {
      unsubscribe?.();
      unsubscribe = null;
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
