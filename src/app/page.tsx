import { Suspense } from "react";
import MobileLayout from "@/components/layout/MobileLayout";
import GuestEntryFlow from "@/components/guest/GuestEntryFlow";

export default function Home() {
  return (
    <MobileLayout>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-[#605b50]">
            Loading…
          </div>
        }
      >
        <GuestEntryFlow />
      </Suspense>
    </MobileLayout>
  );
}
