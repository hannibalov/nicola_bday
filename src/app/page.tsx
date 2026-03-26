import { Suspense } from "react";
import MobileLayout from "@/components/MobileLayout";
import GuestEntryFlow from "@/components/GuestEntryFlow";

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
