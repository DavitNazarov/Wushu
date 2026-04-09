'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { TextInput } from '@/components/form/TextInput';
import { Select } from '@/components/form/Select';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import type { UserRole, UserStatus } from '@/hooks/useUserFilters';
import { adminVariants } from '@/lib/animations/variants';

interface UserFiltersProps {
  search: string;
  role?: UserRole;
  status?: UserStatus;
  onSearchChange: (search: string) => void;
  onRoleChange: (role?: UserRole) => void;
  onStatusChange: (status?: UserStatus) => void;
  onClear: () => void;
  animated?: boolean;
}

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'coach', label: 'Coach' },
  { value: 'athlete', label: 'Athlete' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'dq', label: 'DQ' },
  { value: 'archived', label: 'Archived' },
];

/**
 * User filter and search controls
 * Provides search by name/email and filters by role/status
 */
export function UserFilters({
  search,
  role,
  status,
  onSearchChange,
  onRoleChange,
  onStatusChange,
  onClear,
  animated = true,
}: UserFiltersProps) {
  const hasActiveFilters = search.trim() !== '' || role || status;

  const filterContent = (
    <div className="space-y-4">
      {/* Search field */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <TextInput
          id="user-filters-search"
          type="search"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filter row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2">
        <Select
          id="user-filters-role"
          value={role || ''}
          onChange={(v) => onRoleChange(v === '' ? undefined : (v as UserRole))}
          options={ROLE_OPTIONS}
        />
        <Select
          id="user-filters-status"
          value={status || ''}
          onChange={(v) => onStatusChange(v === '' ? undefined : (v as UserStatus))}
          options={STATUS_OPTIONS}
        />
        {hasActiveFilters && (
          <SecondaryButton
            onClick={onClear}
            className="flex items-center justify-center gap-2"
          >
            <X className="h-4 w-4" />
            Clear filters
          </SecondaryButton>
        )}
      </div>
    </div>
  );

  if (!animated) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        {filterContent}
      </div>
    );
  }

  return (
    <motion.div
      className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
      initial="initial"
      animate="animate"
      variants={adminVariants.slideDown}
    >
      {filterContent}
    </motion.div>
  );
}
