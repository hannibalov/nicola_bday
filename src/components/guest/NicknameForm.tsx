"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PrimaryActionButton from "@/components/game/PrimaryActionButton";
import { persistGuestProfile } from "@/lib/clientStorage";
import {
  isProtocolTestSearchMode,
  PROTOCOL_TEST_QP,
  withProtocolTestQuery,
} from "@/lib/protocolTestMode";

export default function NicknameForm() {
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const value = nickname.trim();
    if (!value) {
      setError("Please enter a nickname");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      if (data.playerId) {
        persistGuestProfile(
          {
            playerId: data.playerId,
            nickname: value,
          },
          isProtocolTestSearchMode(searchParams.get(PROTOCOL_TEST_QP)),
        );
        router.push(withProtocolTestQuery("/play", searchParams));
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative z-10 flex flex-col gap-8"
      noValidate
    >
      <div>
        <label
          htmlFor="nickname"
          className="mb-4 block text-left text-xs font-bold uppercase tracking-[0.2em] text-[#605b50]"
        >
          Choose your quirky party alias
        </label>
        <p className="mb-4 text-left text-sm font-medium text-[#322e25]/80">
          Pick something fun or weird — not your real name. You’ll show up as
          this on the leaderboard.
        </p>
        <div className="group relative">
          <input
            id="nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. DISCO_DAVE or GlitterEmergency"
            className="w-full rounded-sm border-0 bg-[#eae2d0] px-6 py-5 text-xl font-bold text-[#322e25] outline-none transition-all placeholder:text-[#b3ac9f] focus:ring-2 focus:ring-[#a33700]/20 disabled:opacity-60"
            maxLength={30}
            disabled={loading}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-test-id="guest-nickname-input"
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-sm border-2 border-[#a33700] opacity-0 transition-opacity group-focus-within:opacity-[0.12]"
            aria-hidden
          />
        </div>
      </div>
      {error && (
        <p className="text-center text-sm font-medium text-[#b02500]" role="alert">
          {error}
        </p>
      )}
      <PrimaryActionButton type="submit" disabled={loading} data-test-id="guest-join-submit">
        {loading ? "Joining…" : "Join the party"}
        {!loading && (
          <span className="text-2xl leading-none" aria-hidden>
            →
          </span>
        )}
      </PrimaryActionButton>
    </form>
  );
}
