type Props = {
  current: number;
  total: number;
  /** e.g. "Quote" or "Question" */
  label?: string;
  /** Compact mono line (quotes) vs. trivia-style with progress bar. */
  variant?: "inline" | "bar";
};

export default function QuestionProgress({
  current,
  total,
  label = "Quote",
  variant = "inline",
}: Props) {
  if (variant === "bar") {
    const pct = total > 0 ? (current / total) * 100 : 0;
    return (
      <div data-test-id="question-progress" role="status" aria-live="polite">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0e666a]">
          {label} {current} / {total}
        </p>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#e5dcc9]"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-[#a33700] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <p
      className="text-center font-mono text-xs font-bold uppercase tracking-[0.25em] text-[#605b50]"
      data-test-id="question-progress"
    >
      {label} {current} / {total}
    </p>
  );
}
