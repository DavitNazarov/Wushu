/**
 * Generate page numbers to display in pagination
 * Shows: [1] [2] [3] ... [n-1] [n]
 * With ellipsis for large page ranges
 */
export function generatePageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisiblePages: number = 5
): (number | string)[] {
  if (totalPages <= maxVisiblePages) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [];
  const half = Math.floor(maxVisiblePages / 2);

  // Always show first page
  pages.push(1);

  // Calculate range around current page
  let startPage = Math.max(2, currentPage - half);
  let endPage = Math.min(totalPages - 1, currentPage + half);

  // Adjust if we're near the start
  if (currentPage <= half + 1) {
    endPage = Math.min(totalPages - 1, maxVisiblePages - 1);
  }

  // Adjust if we're near the end
  if (currentPage >= totalPages - half) {
    startPage = Math.max(2, totalPages - maxVisiblePages + 2);
  }

  // Add ellipsis before range if needed
  if (startPage > 2) {
    pages.push('...');
  }

  // Add pages in range
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  // Add ellipsis after range if needed
  if (endPage < totalPages - 1) {
    pages.push('...');
  }

  // Always show last page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}

/**
 * Check if a value is a valid page number
 */
export function isPageNumber(value: number | string): value is number {
  return typeof value === 'number';
}
