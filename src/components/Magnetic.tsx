import type { ReactNode, Ref } from "react";
import { m } from "framer-motion";
import { useMagnetic } from "@/hooks/useMagnetic";

interface MagneticProps {
  children: ReactNode;
  strength?: number;
  className?: string;
  disabled?: boolean;
}

/** Thin wrapper over `useMagnetic` for plain children that just need the pull. */
export function Magnetic({ children, strength = 12, className, disabled = false }: MagneticProps) {
  const { ref, onMouseMove, onMouseLeave, style } = useMagnetic({ strength, disabled });

  return (
    <m.div
      ref={ref as Ref<HTMLDivElement>}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={style}
      className={className ?? "inline-block"}
    >
      {children}
    </m.div>
  );
}
