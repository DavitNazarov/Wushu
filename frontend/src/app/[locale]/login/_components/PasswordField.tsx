'use client';

import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/primitives/button';
import { Input } from '@/components/ui/primitives/input';
import { Label } from '@/components/ui/primitives/label';

type Props = {
  id?: string;
  label: string;
  showPassword: boolean;
  value: string;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
  showPasswordLabel: string;
  hidePasswordLabel: string;
};

export function PasswordField({
  id = 'password',
  label,
  showPassword,
  value,
  onChange,
  onToggleVisibility,
  showPasswordLabel,
  hidePasswordLabel,
}: Props) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          required
          className="pr-10"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          tabIndex={-1}
          aria-label={showPassword ? hidePasswordLabel : showPasswordLabel}
          onClick={onToggleVisibility}
          className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 rounded-lg"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </div>
    </div>
  );
}
