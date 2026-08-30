import { m, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { ease } from "@/utils/motion";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "section";
}

const variants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

/** Fade-and-rise a block into view once, when it scrolls into range. */
export function Reveal({ children, className, delay = 0, as = "div" }: RevealProps) {
  const reduceMotion = useReducedMotion();
  const Component = m[as];

  return (
    <Component
      className={className}
      initial={reduceMotion ? undefined : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once: true, amount: 0.3 }}
      variants={variants}
      transition={{ duration: 0.55, delay, ease: ease.standard }}
    >
      {children}
    </Component>
  );
}
