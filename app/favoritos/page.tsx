'use client';
// Painel público, mesmo princípio do painel geral (app/page.tsx): só lê totais agregados, em tempo
// real. Mostra só os candidatos da lista curada (src/domain/acompanhados.ts), separados por cargo,
// com os marcados como "destaque" primeiro e com mais ênfase visual — pedido da responsável pelo
// projeto, pra acompanhar de perto um grupo pequeno de candidatos sem precisar abrir cada cargo e
// procurar entre todo mundo no painel geral.
import { CARGOS_ORDEM, NOME_CARGO } from '../../src/bu/cargos';
import type { CargoId } from '../../src/bu/types';
import { nomeCandidato, type ListaCandidatos } from '../../src/domain/candidatos';
import { ACOMPANHADOS, type CandidatoAcompanhado } from '../../src/domain/acompanhados';
import { usarConfigCidade } from '../../src/client/config';
import { usarTotaisCargo } from '../../src/client/totais';
import { IconeEstrela, IconeInfo } from '../../src/ui/icones';
import candidatosJson from '../../data/candidatos.json';

const CANDIDATOS = candidatosJson as ListaCandidatos;

const fmt = (n: number) => Number(n || 0).toLocaleString('pt-BR');
const pct = (a: number, b: number) => (b ? ((a / b) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '0,0%');

export default function PaginaFavoritos() {
  const { config } = usarConfigCidade();
  const turno = (config?.turno ?? 1) as 1 | 2;
  const grupos = CARGOS_ORDEM.filter(id => (ACOMPANHADOS[id]?.length ?? 0) > 0);

  return (
    <main>
      <div className="pilha">
        <div className="aviso-oficial">
          <IconeInfo />
          <p>
            <strong>Totalização paralela e não oficial.</strong> Lista curada de candidatos pra acompanhar de perto. O resultado oficial é o
            divulgado pelo TSE.
          </p>
        </div>
        <div className="cabeca-pagina">
          <h1>Favoritos</h1>
        </div>
        {grupos.map(id => (
          <GrupoCargo key={id} cargoId={id} turno={turno} lista={ACOMPANHADOS[id]!} />
        ))}
      </div>
    </main>
  );
}

function GrupoCargo({ cargoId, turno, lista }: { cargoId: CargoId; turno: 1 | 2; lista: CandidatoAcompanhado[] }) {
  const { totais } = usarTotaisCargo(turno, cargoId);
  const validos = totais ? totais.total - totais.branco - totais.nulo : 0;

  const ordenada = [...lista].sort((a, b) => {
    if (a.destaque !== b.destaque) return a.destaque ? -1 : 1;
    return (totais?.votos[b.numero] ?? 0) - (totais?.votos[a.numero] ?? 0);
  });

  return (
    <section className="painel" aria-labelledby={`fav-${cargoId}`}>
      <h2 className="cargo-titulo" id={`fav-${cargoId}`}>
        {NOME_CARGO[cargoId]}
      </h2>
      <div className="favoritos-grade">
        {ordenada.map(c => {
          const votos = totais?.votos[c.numero] ?? 0;
          return (
            <div className={`favorito ${c.destaque ? 'destaque' : ''}`} key={c.numero}>
              {c.destaque && (
                <span className="favorito-selo">
                  <IconeEstrela /> Destaque
                </span>
              )}
              <div className="favorito-topo">
                <span className="nome">{nomeCandidato(CANDIDATOS, cargoId, c.numero)}</span>
                <span className="numero">{c.numero}</span>
              </div>
              <span className="favorito-partido">{c.partido}</span>
              <div className="favorito-numeros">
                <span className="valor">{fmt(votos)}</span>
                <span className="pct">{pct(votos, validos)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
