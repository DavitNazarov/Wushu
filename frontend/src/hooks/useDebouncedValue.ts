'use client';

import { useEffect, useState } from 'react';

// PF-3: returns `value` only after it has stopped changing for `delayMs`. Use to
// avoid firing a request (search refetch, preview POST) on every keystroke.
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
