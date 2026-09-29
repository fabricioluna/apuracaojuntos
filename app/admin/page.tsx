'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usarSessao } from '../../src/client/usarSessao';
import { AjustesTab } from '../../src/ui/admin/Ajustes';
import { BoletinsTab } from '../../src/ui/admin/Boletins';
import { DivergenciasTab } from '../../src/ui/admin/Divergencias';
import { EstatisticasTab } from '../../src/ui/admin/Estatisticas';
import { FiscaisTab } from '../../src/ui/admin/Fiscais';

type Aba = 'estatisticas' | 'divergencias' | 'boletins' | 'fiscais' | 'ajustes';
const ABAS: Array<[Aba, string]> = [
  ['estatisticas', 'Estatísticas'],
  ['divergencias', 'Divergências'],
  ['boletins', 'Boletins'],
  ['fiscais', 'Fiscais'],
  ['ajustes', 'Ajustes'],
];

export default function PaginaAdmin() {
  const { sessao, carregando } = usarSessao();
  const router = useRouter();
  const [aba, setAba] = useState<Aba>('estatisticas');

  useEffect(() => {
    if (carregando) return;
    if (!sessao) router.replace('/entrar');
    else if (!sessao.admin) router.replace('/');
  }, [carregando, sessao, router]);

  if (carregando || !sessao?.admin) return null;

  return (
    <main>
      <div className="pilha">
        <h1>Administração</h1>
        <div className="abas-admin" role="tablist">
          {ABAS.map(([id, rotulo]) => (
            <button key={id} className="aba" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}>
              {rotulo}
            </button>
          ))}
        </div>
        {aba === 'estatisticas' && <EstatisticasTab />}
        {aba === 'divergencias' && <DivergenciasTab />}
        {aba === 'boletins' && <BoletinsTab />}
        {aba === 'fiscais' && <FiscaisTab />}
        {aba === 'ajustes' && <AjustesTab />}
      </div>
    </main>
  );
}
