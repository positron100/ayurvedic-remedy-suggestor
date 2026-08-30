import type { ReactNode } from "react";
import { Reveal } from "@/components/Reveal";
import { cn } from "@/lib/cn";

interface SectionTitleProps {
  /** Small label above the heading. */
  kicker?: string;
  heading: string;
  subtitle?: string;
  children?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

/**
 * One heading per section. Serif display face, calm entrance. No oversized
 * scroll-scaling gimmick (the portfolio's `SectionBigTitle` does that; here it
 * would read as showy).
 */
export function SectionTitle({
  kicker,
  heading,
  subtitle,
  children,
  align = "left",
  className,
}: SectionTitleProps) {
  return (
    <Reveal className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {kicker && (
        <p className="mb-3 text-xs font-medium tracking-[0.18em] text-accent uppercase">{kicker}</p>
      )}
      <h2 className="font-display text-3xl leading-tight font-medium tracking-tight text-balance text-fg sm:text-4xl">
        {heading}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base leading-relaxed text-pretty text-fg-muted sm:text-lg">{subtitle}</p>
      )}
      {children}
    </Reveal>
  );
}
