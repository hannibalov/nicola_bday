import { redirect } from "next/navigation";

/** Dev / QA shortcut: same as `/?protocolTest=1` (unlocks protocol CTA for testing). */
export default function JoinTestRoutePage() {
  redirect("/?protocolTest=1");
}
