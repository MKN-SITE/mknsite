import type { ReactNode } from "react";
import styles from "./data-table.module.css";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
  getRowKey?: (row: T, index: number) => string | number;
};

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyState,
  onRowClick,
  className,
  getRowKey = (_, index) => index
}: DataTableProps<T>) {
  return (
    <div className={[styles.container, className].filter(Boolean).join(" ")}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={styles.th}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={styles.tbody}>
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <tr key={`skeleton-${index}`} className={styles.skeletonRow}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={styles.td}
                    data-label={col.header}
                  >
                    <div className={styles.skeletonBar} data-skeleton="true" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.emptyCell}>
                {emptyState ?? (
                  <div className={styles.defaultEmpty}>Tidak ada data yang ditemukan.</div>
                )}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => {
              const isClickable = Boolean(onRowClick);
              return (
                <tr
                  key={getRowKey(row, rowIndex)}
                  className={[styles.tr, isClickable ? styles.clickable : ""].filter(Boolean).join(" ")}
                  onClick={isClickable ? () => onRowClick?.(row) : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={
                    isClickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick?.(row);
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={styles.td}
                      data-label={col.header}
                    >
                      <span className={styles.cellContent}>{col.render(row)}</span>
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
