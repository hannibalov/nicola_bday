type Props = {
  /** When set, shown above the option buttons (trivia / quote games). */
  prompt?: string;
  topicLabel?: string;
  options: readonly string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  disabled?: boolean;
  /** When set (reveal phase), this option is styled as the correct answer. */
  revealCorrectIndex?: number | null;
};

export default function MultipleChoicePanel({
  prompt,
  topicLabel,
  options,
  selectedIndex,
  onSelect,
  disabled = false,
  revealCorrectIndex = null,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      {topicLabel ? (
        <span className="inline-flex self-start rounded-full bg-[#a6eff3]/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#005b5f]">
          {topicLabel}
        </span>
      ) : null}
      {prompt ? (
        <h2 className="text-xl font-bold leading-snug text-[#322e25] sm:text-2xl">
          {prompt}
        </h2>
      ) : null}
      <div className="grid gap-3">
        {options.map((label, i) => {
          const selected = selectedIndex === i;
          const isRevealCorrect = revealCorrectIndex === i;
          const greyUnused =
            disabled && revealCorrectIndex == null && !isRevealCorrect;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              data-test-id={`mcq-option-${i}`}
              onClick={() => onSelect(i)}
              className={[
                "min-h-[3.25rem] w-full rounded-full border-2 px-5 py-3 text-left text-base font-medium transition-colors",
                isRevealCorrect
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                  : selected
                    ? "border-[#a33700] bg-[#a33700] text-[#ffefeb] shadow-lg shadow-[#a33700]/25"
                    : "border-[#e5dcc9] bg-[#f8f0e0] text-[#322e25] hover:border-[#a33700]/50",
                revealCorrectIndex != null && !isRevealCorrect
                  ? "opacity-55"
                  : "",
                greyUnused ? "opacity-50" : "",
              ].join(" ")}
            >
              <span className="mr-2 font-black text-[#ff7943]">
                {String.fromCharCode(65 + i)}.
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
