import { ArrowDownRight, ArrowUpRight, Pause } from "lucide-react";

import { directionLabel } from "@/lib/format";
import type { Direction } from "@/lib/types";
import { cn } from "@/lib/utils";

const styles: Record<Direction, string> = {
  BUY: "bg-bull text-bull-foreground",
  SELL: "bg-bear text-bear-foreground",
  WAIT: "bg-wait text-wait-foreground",
};

const softStyles: Record<Direction, string> = {
  BUY: "bg-bull-soft text-bull",
  SELL: "bg-bear-soft text-bear",
  WAIT: "bg-wait-soft text-muted-foreground",
};

const icons: Record<Direction, typeof ArrowUpRight> = {
  BUY: ArrowUpRight,
  SELL: ArrowDownRight,
  WAIT: Pause,
};

export function DirectionBadge({
  direction,
  soft,
  size = "sm",
  className,
}: {
  direction: Direction;
  soft?: boolean;
  size?: "sm" | "lg";
  className?: string;
}) {
  const Icon = icons[direction];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold",
        soft ? softStyles[direction] : styles[direction],
        size === "lg" ? "px-4 py-1.5 text-base" : "px-2.5 py-0.5 text-xs",
        className,
      )}
    >
      <Icon className={size === "lg" ? "h-4 w-4" : "h-3 w-3"} aria-hidden />
      {directionLabel[direction]}
    </span>
  );
}

export function directionTextClass(direction: Direction) {
  return direction === "BUY" ? "text-bull" : direction === "SELL" ? "text-bear" : "text-muted-foreground";
}
