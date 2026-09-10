import type { ComponentPropsWithRef } from "react";
import { Button } from "./button";
import styles from "./empty-state.module.css";

export type EmptyStateProps = Omit<ComponentPropsWithRef<"div">, "title" | "children"> & {
  icon?: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
};

export function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div {...props} className={[styles.emptyState, className].filter(Boolean).join(" ")}>
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      {action && <Button variant="secondary" onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
