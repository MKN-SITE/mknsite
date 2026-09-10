"use client";

import { useEffect, useId, useState } from "react";
import styles from "./search-bar.module.css";

export type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

export function SearchBar({
  value,
  onChange,
  placeholder = "Cari data...",
  debounceMs = 300,
  className,
  id,
  disabled = false,
  "aria-label": ariaLabel = "Pencarian"
}: SearchBarProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [internalValue, setInternalValue] = useState(value);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (internalValue !== value) {
        onChange(internalValue);
      }
    }, debounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [internalValue, onChange, value, debounceMs]);

  const handleClear = () => {
    setInternalValue("");
    onChange("");
  };

  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(" ")}>
      <span className={styles.searchIcon} aria-hidden="true">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        id={inputId}
        type="text"
        className={styles.input}
        value={internalValue}
        onChange={(e) => setInternalValue(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      {internalValue && !disabled && (
        <button
          type="button"
          className={styles.clearButton}
          onClick={handleClear}
          aria-label="Hapus pencarian"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
