import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableHead,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/Table';

export const dynamic = 'force-dynamic';

export default function RulesetsPage() {
  const tAdmin = useTranslations('admin');
  const locale = useLocale();

  const hasData = true;

  return (
    <AppShell title={tAdmin('rulesets.title')}>
      <div className="space-y-6">
        <SectionHeader
          title={tAdmin('rulesets.title')}
          action={
            <Link href={`/${locale}/admin/rulesets`}>
              <PrimaryButton>{tAdmin('rulesets.new')}</PrimaryButton>
            </Link>
          }
        />
        <p className="text-[13px] text-[var(--color-text-muted)]">
          {tAdmin('dashboard.linkRulesetsDescription')}
        </p>

        {hasData ? (
          <Table>
            <TableHead>
              <TableHeader>{tAdmin('rulesets.columns.name')}</TableHeader>
              <TableHeader>{tAdmin('rulesets.columns.version')}</TableHeader>
              <TableHeader>{tAdmin('rulesets.columns.status')}</TableHeader>
              <TableHeader>{tAdmin('rulesets.columns.updated')}</TableHeader>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>{tAdmin('rulesets.sampleName')}</TableCell>
                <TableCell>v1</TableCell>
                <TableCell>
                  <Badge variant="default">{tAdmin('rulesets.status.draft')}</Badge>
                </TableCell>
                <TableCell muted>—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 py-16 px-8 text-center">
            <p className="text-sm font-medium text-[var(--color-text)]">
              {tAdmin('rulesets.emptyTitle')}
            </p>
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
              {tAdmin('rulesets.emptyDescription')}
            </p>
            <div className="mt-6">
              <Link href={`/${locale}/admin/rulesets`}>
                <PrimaryButton>{tAdmin('rulesets.new')}</PrimaryButton>
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
