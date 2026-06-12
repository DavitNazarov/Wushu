import { ApiError } from './client';

type ErrorIssue = {
  path?: string;
  message?: string;
};

function normalizeIssue(issue: unknown): string | null {
  if (typeof issue === 'string') return issue;
  if (!issue || typeof issue !== 'object') return null;

  const row = issue as ErrorIssue;
  if (row.path && row.message) return `${row.path}: ${row.message}`;
  if (row.message) return row.message;
  return null;
}

export function getErrorCode(error: unknown): string | null {
  if (error instanceof ApiError) return error.code;
  if (error instanceof Error && error.name) return error.name;
  return null;
}

export function getErrorIssues(error: unknown): string[] {
  if (!(error instanceof ApiError)) return [];

  if (Array.isArray(error.details)) {
    return error.details
      .map((issue) => normalizeIssue(issue))
      .filter((issue): issue is string => Boolean(issue));
  }

  const single = normalizeIssue(error.details);
  return single ? [single] : [];
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.message?.trim()) return error.message;
    return fallback;
  }

  if (error instanceof Error && error.message?.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
}

export function getCompactErrorMessage(error: unknown, fallback: string): string {
  const base = getErrorMessage(error, fallback);
  const issues = getErrorIssues(error);
  if (!issues.length) return base;

  const firstIssue = issues[0];
  if (base.includes(firstIssue)) return base;
  return `${base}: ${firstIssue}`;
}
