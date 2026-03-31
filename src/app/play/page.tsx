import { Suspense } from "react";
import MobileLayout from "@/components/layout/MobileLayout";
import PlayPageContent from "@/components/guest/PlayPageContent";

export default function PlayPage() {
  return (
    <MobileLayout>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
            Loading…
          </div>
        }
      >
        <PlayPageContent />
      </Suspense>
    </MobileLayout>
  );
}
