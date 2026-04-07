import { redirect } from "next/navigation";

/** Shortcut to home (guest check-in). */
export default function JoinRedirectPage() {
  redirect("/");
}
