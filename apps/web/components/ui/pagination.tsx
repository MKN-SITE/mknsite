import { Button } from "./button";
import styles from "./pagination.module.css";

export type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function Pagination({
  page,
  totalPages,
  onPageChange,
  className
}: PaginationProps) {
  if (totalPages <= 0) return null;

  const getPageItems = (): (number | "ellipsis")[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (page <= 3) {
      return [1, 2, 3, 4, "ellipsis", totalPages];
    }

    if (page >= totalPages - 2) {
      return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages];
  };

  const pageItems = getPageItems();

  return (
    <nav
      className={[styles.pagination, className].filter(Boolean).join(" ")}
      aria-label="Navigasi halaman"
    >
      <Button
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        aria-label="Halaman sebelumnya"
      >
        Sebelumnya
      </Button>

      <div className={styles.pageList}>
        {pageItems.map((item, index) => {
          if (item === "ellipsis") {
            return (
              <span key={`ellipsis-${index}`} className={styles.ellipsis} aria-hidden="true">
                …
              </span>
            );
          }

          const isCurrent = item === page;
          return (
            <Button
              key={item}
              variant={isCurrent ? "primary" : "ghost"}
              size="sm"
              onClick={() => onPageChange(item)}
              aria-current={isCurrent ? "page" : undefined}
              aria-label={`Halaman ${item}`}
              className={styles.pageButton}
            >
              {item}
            </Button>
          );
        })}
      </div>

      <Button
        variant="secondary"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        aria-label="Halaman berikutnya"
      >
        Berikutnya
      </Button>
    </nav>
  );
}
