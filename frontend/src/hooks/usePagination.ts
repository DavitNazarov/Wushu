import { useState, useMemo } from 'react';

interface PaginationConfig {
  itemsPerPage?: number;
  initialPage?: number;
}

interface PaginationResult<T> {
  currentPage: number;
  totalPages: number;
  paginatedItems: T[];
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  canPrevious: boolean;
  canNext: boolean;
}

/**
 * Hook to manage pagination state and logic
 * @param items - Array of items to paginate
 * @param config - Configuration (itemsPerPage, initialPage)
 * @returns Pagination state and methods
 */
export function usePagination<T>(
  items: T[],
  config: PaginationConfig = {}
): PaginationResult<T> {
  const { itemsPerPage = 10, initialPage = 1 } = config;
  const [currentPage, setCurrentPage] = useState(initialPage);

  const totalPages = Math.ceil(items.length / itemsPerPage);

  // Clamp current page if items change
  const validPage = Math.min(currentPage, Math.max(1, totalPages));
  if (validPage !== currentPage) {
    setCurrentPage(validPage);
  }

  const paginatedItems = useMemo(() => {
    const startIndex = (validPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, validPage, itemsPerPage]);

  const goToPage = (page: number) => {
    const pageNum = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(pageNum);
  };

  const nextPage = () => {
    goToPage(validPage + 1);
  };

  const prevPage = () => {
    goToPage(validPage - 1);
  };

  return {
    currentPage: validPage,
    totalPages: Math.max(1, totalPages),
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    canPrevious: validPage > 1,
    canNext: validPage < totalPages,
  };
}
