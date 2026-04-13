import { type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { motion } from 'framer-motion';

type Variant = 'error' | 'warning' | 'success' | 'info';

const config: Record<Variant, { bg: string; text: string; icon: typeof AlertCircle }> = {
  error: { bg: 'var(--color-danger-subtle)', text: 'var(--color-danger)', icon: AlertCircle },
  warning: { bg: 'var(--color-warning-subtle)', text: 'var(--color-warning)', icon: AlertTriangle },
  success: { bg: 'var(--color-success-subtle)', text: 'var(--color-success)', icon: CheckCircle2 },
  info: { bg: 'var(--color-info-subtle)', text: 'var(--color-info)', icon: Info },
};

type InlineAlertProps = {
  variant: Variant;
  children: ReactNode;
  actions?: ReactNode;
};

export function InlineAlert({ variant, children, actions }: InlineAlertProps) {
  const { bg, text, icon: Icon } = config[variant];
  return (
    <motion.div
      className="flex items-start gap-3 rounded-[var(--radius-card)] p-4"
      style={{ background: bg }}
      initial={{ opacity: 0, filter: 'blur(4px)', y: -6 }}
      animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
      exit={{ opacity: 0, filter: 'blur(4px)', y: -6 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: text }} strokeWidth={2} />
      <div className="min-w-0 flex-1 text-[13px]" style={{ color: text }}>
        {children}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </motion.div>
  );
}
