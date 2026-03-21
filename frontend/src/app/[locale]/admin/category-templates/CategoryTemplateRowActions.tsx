'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { CategoryTemplateRow } from '@/types/api';

type Props = {
  template: CategoryTemplateRow;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onActivate: () => void;
};

export function CategoryTemplateRowActions({
  template,
  onView,
  onEdit,
  onDelete,
  onActivate,
}: Props) {
  const t = useTranslations('admin.categoryTemplates');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (ref.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  function handle(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-input)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
        onClick={() => setOpen((value) => !value)}
        aria-label={tCommon('actions')}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-20 min-w-[180px] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-xl">
          <ActionButton icon={<Eye className="h-4 w-4" />} label={tCommon('view')} onClick={() => handle(onView)} />
          <ActionButton
            icon={<Pencil className="h-4 w-4" />}
            label={tCommon('edit')}
            disabled={!template.canEdit}
            onClick={() => handle(onEdit)}
          />
          {template.status === 'DRAFT' && template.canEdit && (
            <ActionButton
              icon={<CheckCircle2 className="h-4 w-4" />}
              label={t('actions.activate')}
              onClick={() => handle(onActivate)}
            />
          )}
          <ActionButton
            icon={<Trash2 className="h-4 w-4" />}
            label={tCommon('delete')}
            danger
            disabled={!template.canDelete}
            onClick={() => handle(onDelete)}
          />
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  disabled = false,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] transition ${
        danger
          ? 'text-red-300 hover:bg-red-500/10'
          : 'text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
