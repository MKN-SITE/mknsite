import type { ComponentPropsWithRef } from "react";
import styles from "./badge.module.css";

export type BadgeProps = ComponentPropsWithRef<"span"> & {
  variant?: "success" | "warning" | "danger" | "neutral" | "accent";
};

export function Badge({ variant = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span {...props} className={[styles.badge, styles[variant], className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}
