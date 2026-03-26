import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
  children: ReactNode;
  variant?: "solid" | "gradient";
};

const baseClass =
  "flex w-full items-center justify-center gap-3 rounded-full py-5 px-8 text-xl font-black tracking-wide text-[#ffefeb] shadow-xl transition-all active:scale-[0.98] disabled:opacity-50";

const variants = {
  solid: "bg-[#a33700] shadow-[#a33700]/20",
  gradient:
    "bg-gradient-to-r from-[#a33700] to-[#ff7943] shadow-[#a33700]/25",
} as const;

/** Shared primary CTA styling — guest check-in, party protocol, lobbies (docs/ARCHITECTURE.md §13). */
export default function PrimaryActionButton({
  className = "",
  children,
  type = "button",
  variant = "solid",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`${baseClass} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
