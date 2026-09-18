import ListaParcelas from '../_componentes/ListaParcelas';
export const dynamic = 'force-dynamic';
export default function Receber({ searchParams }: { searchParams: Promise<any> }) {
  return <ListaParcelas tipo="receber" searchParams={searchParams} />;
}
