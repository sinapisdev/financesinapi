import { redirect } from 'next/navigation';
import { empresaAtiva } from '@/lib/empresa';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const ctx = await empresaAtiva();
  redirect(ctx ? '/painel' : '/empresa');
}
