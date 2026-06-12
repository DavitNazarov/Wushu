const ROLES = {
  admin: 'admin',
  coach: 'coach',
  athlete: 'athlete',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

