import type { ComponentPropsWithRef } from "react";
import styles from "./button.module.css";

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  loading?: boolean;
  loadingText?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  disabled = false,
  loading = false,
  loadingText = "Memproses...",
  className,
  children,
  "aria-busy": ariaBusy,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || ariaBusy}
      className={[styles.button, styles[variant], styles[size], className].filter(Boolean).join(" ")}
    >
      {loading ? loadingText : children}
    </button>
  );
}
