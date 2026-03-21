import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LegacyRulesetsPage({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/admin/category-templates`);
}
