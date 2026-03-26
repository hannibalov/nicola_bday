export default function TeamMajorityExplainer() {
  return (
    <div
      className="rounded-2xl border border-[#a33700]/20 bg-[#ff7943]/10 px-4 py-3 text-sm leading-snug text-[#322e25]"
      data-test-id="team-majority-explainer"
    >
      <p className="font-semibold text-[#a33700]">How your team scores</p>
      <p className="mt-1 text-[#605b50]">
        Tap the answer on your phone. Your team’s official pick is whatever{" "}
        <strong>most of you</strong> choose (ties pick the lower-number option).
        If that pick is right, <strong>everyone on the team</strong> earns{" "}
        <strong>50 points</strong> for this round.
      </p>
    </div>
  );
}
