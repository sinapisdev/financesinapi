import ListaParcelas from '../_componentes/ListaParcelas';
export const dynamic = 'force-dynamic';
export default function Pagar({ searchParams }: { searchParams: Promise<any> }) {
  return <ListaParcelas tipo="pagar" searchParams={searchParams} />;
}
