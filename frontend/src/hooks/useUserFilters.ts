import { useState, useMemo } from 'react';

export type UserRole = 'admin' | 'coach' | 'athlete';
export type UserStatus = 'active' | 'inactive' | 'dq' | 'archived';

interface UserFilterState {
  search: string;
  role?: UserRole;
  status?: UserStatus;
}

interface FilterConfig {
  searchFields?: string[];
}

interface User {
  [key: string]: any;
}

interface FilterResult<T> {
  filters: UserFilterState;
  filteredItems: T[];
  setSearch: (search: string) => void;
  setRole: (role?: UserRole) => void;
  setStatus: (status?: UserStatus) => void;
  clearFilters: () => void;
}

/**
 * Hook to manage user filtering and search
 * @param items - Array of user items to filter
 * @param config - Configuration for search fields
 * @returns Filter state and methods
 */
export function useUserFilters<T extends User>(
  items: T[],
  config: FilterConfig = {}
): FilterResult<T> {
  const { searchFields = ['displayName', 'email'] } = config;
  const [filters, setFilters] = useState<UserFilterState>({
    search: '',
    role: undefined,
    status: undefined,
  });

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search filter
      if (filters.search.trim()) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = searchFields.some((field) => {
          const value = item[field];
          return value && String(value).toLowerCase().includes(searchLower);
        });
        if (!matchesSearch) return false;
      }

      // Role filter
      if (filters.role && item.role !== filters.role) {
        return false;
      }

      // Status filter
      if (filters.status && item.status !== filters.status) {
        return false;
      }

      return true;
    });
  }, [items, filters, searchFields]);

  const setSearch = (search: string) => {
    setFilters((prev) => ({ ...prev, search }));
  };

  const setRole = (role?: UserRole) => {
    setFilters((prev) => ({ ...prev, role }));
  };

  const setStatus = (status?: UserStatus) => {
    setFilters((prev) => ({ ...prev, status }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      role: undefined,
      status: undefined,
    });
  };

  return {
    filters,
    filteredItems,
    setSearch,
    setRole,
    setStatus,
    clearFilters,
  };
}
