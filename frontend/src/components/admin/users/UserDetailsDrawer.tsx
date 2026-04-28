'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, XCircle, Clock, Activity, Shield, User, Pencil, Ban, UserX, Undo2, ArrowLeft } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import { useAdminUser } from '@/hooks/useAdminUser';
import { useAdminUserActivity, useAdminUserCapabilities } from '@/hooks/useAdminUserActivity';
import {
  useArchiveAdminUser,
  useRemoveAdminUserSuspension,
  useSuspendAdminUser,
  useUpdateAdminUser,
} from '@/hooks/useAdminUserMutations';
import { useToast } from '@/components/ui/Toast';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { adminVariants } from '@/lib/animations/variants';
import { UserStatusBadge } from './UserStatusBadge';
import { UserEditForm } from './UserEditForm';
import { UserSuspendDialog } from './UserSuspendDialog';
import { UserActionDialog } from './UserActionDialog';

type Props = {
  userId: string | null;
  currentUserId: string | null;
  open: boolean;
  onClose: () => void;
};

const CAPABILITY_LABELS: Record<string, string> = {
  EVENTS_MANAGE: 'Events',
  RULESETS_MANAGE: 'Rulesets',
  ATHLETES_MANAGE: 'Athletes',
  WEIGHIN_RUN: 'Weigh-in',
  DRAW_RUN: 'Draw',
  SCHEDULE_MANAGE: 'Schedule',
  LIVE_RUN: 'Live',
  RESULTS_MANAGE: 'Results',
  EXPORTS_MANAGE: 'Exports',
  CONTENT_MANAGE: 'Content',
};

const ACTION_LABELS: Record<string, string> = {
  SIGN_IN_SUCCESS: 'Signed in',
  SIGN_IN_FAILURE: 'Failed login',
  USER_UPDATED: 'Profile updated',
  USER_SUSPENDED: 'Suspended',
  USER_SUSPENSION_REMOVED: 'Suspension removed',
  USER_ARCHIVED: 'Archived',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type ActionIconButtonProps = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  tone?: 'neutral' | 'warn' | 'danger';
  children: React.ReactNode;
};

function ActionIconButton({ label, disabled, onClick, tone = 'neutral', children }: ActionIconButtonProps) {
  const toneClass =
    tone === 'warn'
      ? 'hover:bg-amber-500/10 hover:text-amber-400'
      : tone === 'danger'
        ? 'hover:bg-red-500/10 hover:text-red-400'
        : 'hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]';
  return (
    <div className="group relative">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-input)] text-[var(--color-text-muted)] transition disabled:cursor-not-allowed disabled:opacity-30 ${toneClass}`}
      >
        {children}
      </button>
      {!disabled && (
        <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-[#1a1a1a] px-2 py-0.5 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
          {label}
        </div>
      )}
    </div>
  );
}

export function UserDetailsDrawer({ userId, currentUserId, open, onClose }: Props) {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { toast } = useToast();

  const userQuery = useAdminUser(userId);
  const activityQuery = useAdminUserActivity(userId);
  const capabilitiesQuery = useAdminUserCapabilities(userId);

  const updateMutation = useUpdateAdminUser();
  const suspendMutation = useSuspendAdminUser();
  const removeSuspendMutation = useRemoveAdminUserSuspension();
  const archiveMutation = useArchiveAdminUser();

  const [editing, setEditing] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [removeSuspendOpen, setRemoveSuspendOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open || !userId) return null;

  const user = userQuery.data ?? null;
  const isSelf = Boolean(user && currentUserId && user.id === currentUserId);
  const isArchived = user?.status === 'ARCHIVED';
  const canRemoveSuspension = Boolean(
    user?.disciplinary.reason || user?.disciplinary.startAt || user?.disciplinary.endAt,
  );

  function formatDate(value: string | null) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '—'
      : date.toLocaleString(locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
  }

  const roleLabel = (role: string) => (role === 'admin' ? t('roleAdmin') : t('roleCoach'));
  const statusLabel = (status: 'ACTIVE' | 'DQ' | 'ARCHIVED' | 'INACTIVE') =>
    status === 'DQ'
      ? t('details.statusDq')
      : status === 'ARCHIVED'
        ? t('details.statusArchived')
        : status === 'INACTIVE'
          ? t('details.statusInactive')
          : t('details.statusActive');

  async function handleUpdate(payload: {
    displayName: string;
    email: string;
    role: 'admin' | 'coach';
    clubId: string | null;
    nationality: string | null;
    isActive: boolean;
  }) {
    if (!user) return;
    try {
      await updateMutation.mutateAsync({ userId: user.id, ...payload });
      setEditing(false);
      setEditError(null);
      toast(t('details.updateSuccess'));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_ALREADY_IN_USE') {
        setEditError(t('errorEmailInUse'));
        return;
      }
      setEditError(getCompactErrorMessage(error, tCommon('saveFailed')));
    }
  }

  async function handleSuspend(payload: {
    reason: string;
    startAt: string;
    endAt: string;
    note: string | null;
  }) {
    if (!user) return;
    try {
      await suspendMutation.mutateAsync({ userId: user.id, ...payload });
      setSuspendOpen(false);
      toast(t('details.suspendSuccess'));
    } catch (error) {
      toast(getCompactErrorMessage(error, t('details.suspendFailed')), 'error');
    }
  }

  async function handleRemoveSuspension() {
    if (!user) return;
    try {
      await removeSuspendMutation.mutateAsync(user.id);
      setRemoveSuspendOpen(false);
      toast(t('details.removeSuspendSuccess'));
    } catch (error) {
      toast(getCompactErrorMessage(error, t('details.removeSuspendFailed')), 'error');
    }
  }

  async function handleArchive() {
    if (!user) return;
    try {
      await archiveMutation.mutateAsync(user.id);
      setArchiveOpen(false);
      toast(t('details.archiveSuccess'));
    } catch (error) {
      toast(getCompactErrorMessage(error, t('details.archiveFailed')), 'error');
    }
  }

  const avatarColors: Record<string, string> = {
    ACTIVE: 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]',
    DQ: 'bg-amber-500/15 text-amber-400',
    ARCHIVED: 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]',
    INACTIVE: 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]',
  };
  const avatarClass = user ? (avatarColors[user.status] ?? avatarColors.INACTIVE) : avatarColors.INACTIVE;

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="fixed inset-0 z-[60] md:left-auto md:w-[min(500px,100vw)]"
        initial={{ x: 500, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 500, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        <div className="flex h-full flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <AnimatePresence mode="wait" initial={false}>
                {editing ? (
                  <motion.button
                    key="back"
                    type="button"
                    onClick={() => { setEditing(false); setEditError(null); }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-input)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </motion.button>
                ) : (
                  <motion.div
                    key="icon"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-alt)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <User className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="min-w-0">
                <AnimatePresence mode="wait" initial={false}>
                  {editing ? (
                    <motion.h2
                      key="edit-title"
                      className="text-[14px] font-semibold text-[var(--color-text)]"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                    >
                      {t('details.editTitle')}
                    </motion.h2>
                  ) : (
                    <motion.div
                      key="view-title"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                    >
                      <h2 className="text-[14px] font-semibold text-[var(--color-text)]">
                        {t('details.title')}
                      </h2>
                      <p className="text-[12px] text-[var(--color-text-muted)] truncate">
                        {user?.displayName ?? tCommon('loading')}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {/* Action icon buttons — hidden while editing */}
              <AnimatePresence initial={false}>
                {!editing && user && (
                  <motion.div
                    className="flex items-center gap-1"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ActionIconButton
                      label={tCommon('edit')}
                      disabled={isArchived}
                      onClick={() => setEditing(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </ActionIconButton>
                    <ActionIconButton
                      label={t('details.suspendAction')}
                      disabled={isArchived || isSelf}
                      onClick={() => setSuspendOpen(true)}
                      tone="warn"
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </ActionIconButton>
                    {canRemoveSuspension && (
                      <ActionIconButton
                        label={t('details.removeSuspendAction')}
                        disabled={isArchived}
                        onClick={() => setRemoveSuspendOpen(true)}
                        tone="neutral"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </ActionIconButton>
                    )}
                    <ActionIconButton
                      label={t('details.archiveAction')}
                      disabled={isArchived || isSelf}
                      onClick={() => setArchiveOpen(true)}
                      tone="danger"
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </ActionIconButton>
                    <div className="mx-1 h-4 w-px bg-[var(--color-border)]" />
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-input)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Scrollable content — animates between detail view and edit view */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <AnimatePresence initial={false} mode="wait">
              {editing && user ? (
                <motion.div
                  key="edit"
                  className="absolute inset-0 overflow-y-auto px-5 py-5"
                  initial={{ x: '100%', opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: '100%', opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 34 }}
                >
                  <UserEditForm
                    key={`${user.id}:${user.updatedAt}`}
                    user={user}
                    pending={updateMutation.isPending}
                    errorMessage={editError}
                    onCancel={() => {
                      setEditing(false);
                      setEditError(null);
                    }}
                    onSubmit={handleUpdate}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="detail"
                  className="absolute inset-0 overflow-y-auto"
                  initial={{ x: '-30%', opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: '-30%', opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 34 }}
                >
                  {userQuery.isLoading && (
                    <div className="space-y-3 px-5 py-5">
                      <div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
                      <div className="h-20 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
                      <div className="h-32 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
                    </div>
                  )}

                  {userQuery.error && !user && (
                    <div className="px-5 py-5">
                      <InlineAlert variant="error">{tCommon('loadError')}</InlineAlert>
                    </div>
                  )}

                  {user && (
                    <motion.div
                      className="divide-y divide-[var(--color-border)]"
                      variants={adminVariants.staggerContainer}
                      initial="initial"
                      animate="animate"
                    >
                      {/* Identity section */}
                      <motion.div variants={adminVariants.staggerChild} className="px-5 py-5">
                        <div className="flex items-start gap-4">
                          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[18px] font-bold ${avatarClass}`}>
                            {getInitials(user.displayName)}
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-[15px] font-semibold text-[var(--color-text)]">
                                  {user.displayName}
                                </p>
                                <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">{user.email}</p>
                              </div>
                              <UserStatusBadge status={user.status} label={statusLabel(user.status)} />
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                              <div>
                                <span className="block text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">{t('fieldRole')}</span>
                                <span className="mt-0.5 block text-[var(--color-text)]">{roleLabel(user.role)}</span>
                              </div>
                              <div>
                                <span className="block text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">{t('fieldClub')}</span>
                                <span className="mt-0.5 block text-[var(--color-text)]">{user.club?.name ?? '—'}</span>
                              </div>
                              <div>
                                <span className="block text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">{t('columns.createdAt')}</span>
                                <span className="mt-0.5 block text-[var(--color-text)]">{formatDate(user.createdAt)}</span>
                              </div>
                              <div>
                                <span className="block text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">{t('details.updatedAt')}</span>
                                <span className="mt-0.5 block text-[var(--color-text)]">{formatDate(user.updatedAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {isSelf && (
                          <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">
                            {t('details.selfGuardHint')}
                          </p>
                        )}
                      </motion.div>

                      {/* Account state section */}
                      {(user.disciplinary.reason || user.disciplinary.startAt || !user.isActive || isArchived) && (
                        <motion.div variants={adminVariants.staggerChild} className="px-5 py-4">
                          <div className="mb-3 flex items-center gap-2">
                            <Shield className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                              {t('details.accountState')}
                            </h3>
                          </div>
                          <div className="space-y-2 text-[13px]">
                            <div className="flex items-center justify-between">
                              <span className="text-[var(--color-text-muted)]">{t('details.activeToggle')}</span>
                              <span className={user.isActive ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}>
                                {user.isActive ? t('details.yes') : t('details.no')}
                              </span>
                            </div>
                            {user.disciplinary.reason && (
                              <div className="rounded-[var(--radius-card)] border border-amber-500/30 bg-amber-500/5 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Suspension</p>
                                <p className="mt-1 text-[13px] text-[var(--color-text)]">{user.disciplinary.reason}</p>
                                {(user.disciplinary.startAt || user.disciplinary.endAt) && (
                                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                                    {formatDate(user.disciplinary.startAt)} — {formatDate(user.disciplinary.endAt)}
                                  </p>
                                )}
                                {user.disciplinary.note && (
                                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{user.disciplinary.note}</p>
                                )}
                              </div>
                            )}
                            {user.deletedAt && (
                              <div className="flex items-center justify-between">
                                <span className="text-[var(--color-text-muted)]">{t('details.deletedAt')}</span>
                                <span className="text-red-400">{formatDate(user.deletedAt)}</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* Capabilities section */}
                      <motion.div variants={adminVariants.staggerChild} className="px-5 py-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                            Capabilities
                          </h3>
                        </div>
                        {capabilitiesQuery.isLoading ? (
                          <div className="grid grid-cols-2 gap-1.5">
                            {[...Array(10)].map((_, i) => (
                              <div key={i} className="h-8 animate-pulse rounded bg-[var(--color-surface-alt)]" />
                            ))}
                          </div>
                        ) : capabilitiesQuery.data ? (
                          <div className="grid grid-cols-2 gap-1.5">
                            {capabilitiesQuery.data.map((cap) => (
                              <div
                                key={cap.code}
                                className={`flex items-center gap-2 rounded-[var(--radius-pill)] px-3 py-1.5 text-[12px] ${
                                  cap.granted
                                    ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                                    : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
                                }`}
                              >
                                {cap.granted ? (
                                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                                ) : (
                                  <XCircle className="h-3 w-3 shrink-0 opacity-40" />
                                )}
                                <span className={cap.granted ? 'font-medium' : 'opacity-60'}>
                                  {CAPABILITY_LABELS[cap.code] ?? cap.code}
                                </span>
                                {cap.isCustom && (
                                  <span className="ml-auto rounded bg-[var(--color-primary)]/20 px-1 text-[10px] font-semibold text-[var(--color-primary)]">
                                    +
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </motion.div>

                      {/* Activity timeline */}
                      <motion.div variants={adminVariants.staggerChild} className="px-5 py-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Activity className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                            Recent Activity
                          </h3>
                        </div>
                        {activityQuery.isLoading ? (
                          <div className="space-y-2">
                            {[...Array(4)].map((_, i) => (
                              <div key={i} className="flex gap-3">
                                <div className="h-6 w-6 animate-pulse rounded-full bg-[var(--color-surface-alt)]" />
                                <div className="flex-1 space-y-1">
                                  <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--color-surface-alt)]" />
                                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-[var(--color-surface-alt)]" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : activityQuery.data && activityQuery.data.length > 0 ? (
                          <div className="relative space-y-0">
                            <div className="absolute left-[11px] top-3 bottom-3 w-px bg-[var(--color-border)]" />
                            {activityQuery.data.map((entry) => {
                              const isLogin = entry.action === 'SIGN_IN_SUCCESS' || entry.action === 'SIGN_IN_FAILURE';
                              const isFailed = entry.action === 'SIGN_IN_FAILURE';
                              return (
                                <div key={entry.id} className="relative flex gap-3 pb-3">
                                  <div className={`relative z-10 mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] ${
                                    isFailed
                                      ? 'bg-red-500/15 text-red-400'
                                      : isLogin
                                        ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                                        : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
                                  }`}>
                                    {isLogin ? (
                                      <Clock className="h-3 w-3" />
                                    ) : (
                                      <Activity className="h-3 w-3" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1 pt-0.5">
                                    <p className="text-[13px] text-[var(--color-text)]">
                                      {ACTION_LABELS[entry.action] ?? entry.action}
                                    </p>
                                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                                      <span>{relativeTime(entry.createdAt)}</span>
                                      {entry.ipAddress && (
                                        <>
                                          <span>·</span>
                                          <span className="font-mono">{entry.ipAddress}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[13px] text-[var(--color-text-muted)]">No recent activity.</p>
                        )}
                      </motion.div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <UserSuspendDialog
        open={suspendOpen}
        pending={suspendMutation.isPending}
        errorMessage={null}
        onClose={() => setSuspendOpen(false)}
        onConfirm={handleSuspend}
      />

      <UserActionDialog
        open={removeSuspendOpen}
        title={t('details.removeSuspendTitle')}
        description={t('details.removeSuspendDescription')}
        confirmLabel={t('details.removeSuspendAction')}
        pending={removeSuspendMutation.isPending}
        errorMessage={null}
        onClose={() => setRemoveSuspendOpen(false)}
        onConfirm={handleRemoveSuspension}
      />

      <UserActionDialog
        open={archiveOpen}
        title={t('details.archiveTitle')}
        description={t('details.archiveDescription')}
        confirmLabel={tCommon('delete')}
        pending={archiveMutation.isPending}
        errorMessage={null}
        tone="danger"
        onClose={() => setArchiveOpen(false)}
        onConfirm={handleArchive}
      />
    </>
  );
}
