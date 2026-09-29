'use client';
import { useEffect, useState } from 'react';
import type { DivergenciaDetalhada } from '../../client/admin';
import { listarDivergencias, resolverDivergencia } from '../../client/admin';

const fmt = (n: number | string) => (typeof n === 'number' ? n.toLocaleString('pt-BR') : n);
const hora = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function DivergenciasTab() {
  const [pendentes, setPendentes] = useState<DivergenciaDetalhada[] | null>(null);
  const [resolvidas, setResolvidas] = useState<DivergenciaDetalhada[]>([]);
  const [erro, setErro] = useState('');
  const [resolvendo, setResolvendo] = useState<string | null>(null);

  function carregar() {
    listarDivergencias()
      .then(r => {
        setPendentes(r.pendentes);
        setResolvidas(r.resolvidas);
      })
      .catch(e => setErro(e.message));
  }
  useEffect(carregar, []);

  async function decidir(id: string, decisao: 'manter' | 'novo') {
    setResolvendo(id);
    try {
      await resolverDivergencia(id, decisao);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível resolver.');
    } finally {
      setResolvendo(null);
    }
  }

  if (erro) return <p className="msg erro">{erro}</p>;
  if (!pendentes) return <p className="lead">Carregando…</p>;

  return (
    <section>
      {pendentes.length ? (
        pendentes.map(d => (
          <article className="div-item" key={d.id}>
            <header>
              <h3>
                Zona {d.atual?.zona ?? d.novo.zona}, seção {d.atual?.secao ?? d.novo.secao}
              </h3>
              <p>
                Cadastro atual: {d.atual?.fiscalNome ?? '—'}, {d.atual ? hora(d.atual.enviadoEm) : ''}. Novo envio: {d.novo.fiscalNome}, {hora(d.novo.enviadoEm)}.
              </p>
            </header>
            <div className="rolagem">
              <table>
                <thead>
                  <tr>
                    <th>Onde</th>
                    <th className="n">Cadastro atual</th>
                    <th className="n">Novo envio</th>
                  </tr>
                </thead>
                <tbody>
                  {d.diffs.map((x, i) => (
                    <tr key={i}>
                      <td>{x.campo}</td>
                      <td className="n atual">{fmt(x.atual)}</td>
                      <td className="n novo">{fmt(x.novo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="linha-botoes">
              <button className="btn" disabled={resolvendo === d.id} onClick={() => decidir(d.id, 'manter')}>
                Manter o cadastro atual
              </button>
              <button className="btn ghost" disabled={resolvendo === d.id} onClick={() => decidir(d.id, 'novo')}>
                Usar o novo envio
              </button>
            </div>
          </article>
        ))
      ) : (
        <div className="painel vazio">
          <h3>Nenhuma divergência pendente</h3>
          <p className="lead">Quando dois boletins da mesma urna trouxerem números diferentes, o aviso aparece aqui com as diferenças lado a lado.</p>
        </div>
      )}

      {resolvidas.length > 0 && (
        <details className="painel" style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 650 }}>Resolvidas ({resolvidas.length})</summary>
          <div className="rolagem">
            <table style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>Urna</th>
                  <th>Decisão</th>
                  <th>Por</th>
                  <th className="n">Hora</th>
                </tr>
              </thead>
              <tbody>
                {resolvidas.map(d => {
                  const [z, s] = d.key.split('-');
                  return (
                    <tr key={d.id}>
                      <td>
                        Zona {z}, seção {s}
                      </td>
                      <td>{d.decisao === 'novo' ? 'Usou o novo envio' : 'Manteve o cadastro atual'}</td>
                      <td>{d.resolvidaPor}</td>
                      <td className="n">{d.resolvidaEm ? hora(d.resolvidaEm) : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
