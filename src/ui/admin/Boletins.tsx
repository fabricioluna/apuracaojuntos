'use client';
import { useEffect, useState } from 'react';
import { CARGOS_ORDEM, NOME_CARGO } from '../../bu/cargos';
import { excluirBoletim, listarBoletins, obterBoletim } from '../../client/admin';
import { usarConfigCidade } from '../../client/config';
import { nomeCandidato, nomePartido, type ListaCandidatos } from '../../domain/candidatos';
import type { BoletimGravado } from '../../domain/types';
import type { BoletimResumo } from '../../server/admin/listar-boletins';
import candidatosJson from '../../../data/candidatos.json';

const CANDIDATOS = candidatosJson as ListaCandidatos;

const fmt = (n: number) => Number(n || 0).toLocaleString('pt-BR');
const hora = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function BoletinsTab() {
  const { config } = usarConfigCidade();
  const [boletins, setBoletins] = useState<BoletimResumo[] | null>(null);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;
    listarBoletins(config.turno)
      .then(r => setBoletins(r.boletins))
      .catch(e => setErro(e.message));
  }, [config]);

  if (erro) return <p className="msg erro">{erro}</p>;
  if (!boletins) return <p className="lead">Carregando…</p>;

  const filtrados = boletins.filter(b => !filtro || String(b.secao).includes(filtro) || String(b.zona).includes(filtro));

  function aoExcluir(id: string) {
    setBoletins(atual => atual && atual.filter(b => b.id !== id));
    if (aberto === id) setAberto(null);
  }

  return (
    <section className="painel">
      <div className="campo busca">
        <label htmlFor="f-bol">Buscar por zona ou seção</label>
        <input id="f-bol" type="search" inputMode="numeric" value={filtro} onChange={e => setFiltro(e.target.value)} />
      </div>
      <div className="rolagem">
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Zona</th>
              <th>Seção</th>
              <th>Origem</th>
              <th>Enviado por</th>
              <th className="n">Hora</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtrados.length ? (
              filtrados.map(b => (
                <FragmentoBoletim key={b.id} b={b} aberto={aberto === b.id} onAlternar={() => setAberto(aberto === b.id ? null : b.id)} onExcluido={() => aoExcluir(b.id)} />
              ))
            ) : (
              <tr>
                <td colSpan={7}>Nenhum boletim encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FragmentoBoletim({ b, aberto, onAlternar, onExcluido }: { b: BoletimResumo; aberto: boolean; onAlternar: () => void; onExcluido: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState('');

  async function confirmar() {
    setExcluindo(true);
    setErro('');
    try {
      await excluirBoletim(b.id);
      onExcluido();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir.');
      setExcluindo(false);
    }
  }

  return (
    <>
      <tr>
        <td>{b.zona}</td>
        <td>{b.secao}</td>
        <td>{b.origem}</td>
        <td>{b.fiscalNome}</td>
        <td className="n">{hora(b.enviadoEm)}</td>
        <td>
          {b.divergenciaPendente ? (
            <span className="etiqueta alerta">Divergência pendente</span>
          ) : b.corrigidoPor ? (
            <span className="etiqueta">Validado pelo administrador</span>
          ) : (
            <span className="etiqueta certo">Confere</span>
          )}
        </td>
        <td>
          <div className="linha-botoes" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
            {!confirmando ? (
              <>
                <button className="btn ghost pequeno" onClick={onAlternar}>
                  {aberto ? 'Fechar' : 'Ver'}
                </button>
                <button className="btn ghost pequeno" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={() => setConfirmando(true)}>
                  Excluir
                </button>
              </>
            ) : (
              <>
                <button className="btn ghost pequeno" disabled={excluindo} onClick={confirmar} style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }}>
                  {excluindo ? 'Excluindo…' : 'Confirmar exclusão'}
                </button>
                <button className="btn ghost pequeno" disabled={excluindo} onClick={() => setConfirmando(false)}>
                  Cancelar
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {erro && (
        <tr>
          <td colSpan={7}>
            <p className="msg erro">{erro}</p>
          </td>
        </tr>
      )}
      {aberto && (
        <tr>
          <td colSpan={7}>
            <DetalheBoletim id={b.id} />
          </td>
        </tr>
      )}
    </>
  );
}

function DetalheBoletim({ id }: { id: string }) {
  const [boletim, setBoletim] = useState<BoletimGravado | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    obterBoletim(id)
      .then(r => setBoletim(r.boletim))
      .catch(e => setErro(e.message));
  }, [id]);

  if (erro) return <p className="msg erro">{erro}</p>;
  if (!boletim) return <p className="lead">Carregando…</p>;

  return (
    <div className="pilha" style={{ padding: '8px 0' }}>
      <p>
        Enviado por {boletim.fiscalNome} às {hora(boletim.enviadoEm)}.
        {boletim.corrigidoPor ? ` Validado por ${boletim.corrigidoPor}.` : ''}
        {boletim.assinatura ? ` Assinatura: ${boletim.assinatura === 'verificada' ? 'verificada' : 'não verificada'}.` : ''}
      </p>
      {CARGOS_ORDEM.filter(cid => boletim.cargos[cid]).map(cid => {
        const c = boletim.cargos[cid]!;
        return (
          <details className="cargo-conf" key={cid}>
            <summary>
              {NOME_CARGO[cid]}
              <span>{fmt(c.total)} votos</span>
            </summary>
            <table>
              <tbody>
                {Object.entries(c.votos).map(([n, v]) => (
                  <tr key={n}>
                    <td>
                      {nomeCandidato(CANDIDATOS, cid, n)} <span style={{ color: 'var(--muted)' }}>{n}</span>
                    </td>
                    <td className="n">{fmt(v)}</td>
                  </tr>
                ))}
                {Object.entries(c.legenda).map(([n, v]) => (
                  <tr key={`l${n}`}>
                    <td>
                      Legenda: {nomePartido(CANDIDATOS, cid, n)} <span style={{ color: 'var(--muted)' }}>{n}</span>
                    </td>
                    <td className="n">{fmt(v)}</td>
                  </tr>
                ))}
                <tr>
                  <td>Brancos</td>
                  <td className="n">{fmt(c.branco)}</td>
                </tr>
                <tr>
                  <td>Nulos</td>
                  <td className="n">{fmt(c.nulo)}</td>
                </tr>
              </tbody>
            </table>
          </details>
        );
      })}
    </div>
  );
}
