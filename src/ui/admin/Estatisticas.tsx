'use client';
import { useEffect, useState } from 'react';
import { CARGOS_ORDEM, NOME_CARGO } from '../../bu/cargos';
import type { CargoId } from '../../bu/types';
import { listarBoletins, listarDivergencias } from '../../client/admin';
import { usarConfigCidade } from '../../client/config';
import { usarTotaisCargo } from '../../client/totais';
import { enviosPorFaixa, enviosPorFiscal } from '../../domain/estatisticas';
import { locaisFaltando, locaisPorSituacao } from '../../domain/locais';
import type { BoletimResumo } from '../../server/admin/listar-boletins';

const fmt = (n: number) => Number(n || 0).toLocaleString('pt-BR');
const pct = (a: number, b: number) => (b ? ((a / b) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '0,0%');
const hora = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function EstatisticasTab() {
  const { config } = usarConfigCidade();
  const [boletins, setBoletins] = useState<BoletimResumo[] | null>(null);
  const [pendentes, setPendentes] = useState<number | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!config) return;
    listarBoletins(config.turno)
      .then(r => setBoletins(r.boletins))
      .catch(e => setErro(e.message));
    listarDivergencias()
      .then(r => setPendentes(r.pendentes.length))
      .catch(e => setErro(e.message));
  }, [config]);

  if (!config) return null;
  if (erro) return <p className="msg erro">{erro}</p>;
  if (!boletins) return <p className="lead">Carregando…</p>;

  const M = config.zonas.reduce((a, z) => a + z.secoes.length, 0);
  const faixas = enviosPorFaixa(boletins);
  const maxFaixa = Math.max(1, ...faixas.map(f => f.quantidade));
  const porFiscal = enviosPorFiscal(boletins);
  const secoesComBoletim = new Set(boletins.map(b => `${b.zona}-${b.secao}`));
  const faltam = locaisFaltando(locaisPorSituacao(config, secoesComBoletim));

  return (
    <div className="pilha">
      <dl className="faixa-numeros">
        <div>
          <dt>Urnas apuradas</dt>
          <dd>
            {fmt(boletins.length)} de {fmt(M)}
            <small>{pct(boletins.length, M)} da cidade</small>
          </dd>
        </div>
        <div>
          <dt>Divergências pendentes</dt>
          <dd>
            {pendentes ?? '—'}
            <small>{pendentes ? 'aguardando validação' : 'nada a validar'}</small>
          </dd>
        </div>
        <div>
          <dt>Fiscais com envio</dt>
          <dd>
            {fmt(porFiscal.length)}
            <small>{boletins.length ? `${(boletins.length / Math.max(1, porFiscal.length)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} urnas por fiscal` : 'sem envios'}</small>
          </dd>
        </div>
        <div>
          <dt>Locais que faltam</dt>
          <dd>{fmt(faltam.length)}</dd>
        </div>
      </dl>

      <div className="duas-colunas">
        <section className="painel">
          <h3>Envios a cada 30 minutos</h3>
          {faixas.length ? (
            <div className="colunas-tempo">
              {faixas.map(f => (
                <div className="col-tempo" key={f.inicio} title={`${f.quantidade} boletins a partir das ${hora(f.inicio)}`}>
                  <b>{f.quantidade}</b>
                  <span className="haste" style={{ height: `${Math.round((f.quantidade / maxFaixa) * 96)}px` }} />
                  <span>{hora(f.inicio)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="lead" style={{ marginTop: 10 }}>
              Ainda não há envios.
            </p>
          )}
        </section>
        <section className="painel">
          <h3>Por fiscal</h3>
          {porFiscal.length ? (
            <div className="rolagem">
              <table>
                <thead>
                  <tr>
                    <th>Fiscal</th>
                    <th className="n">Urnas</th>
                    <th className="n">Último envio</th>
                  </tr>
                </thead>
                <tbody>
                  {porFiscal.map(f => (
                    <tr key={f.fiscal}>
                      <td>{f.fiscal}</td>
                      <td className="n">{f.quantidade}</td>
                      <td className="n">{hora(f.ultimoEnvio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="lead" style={{ marginTop: 10 }}>
              Ainda não há envios.
            </p>
          )}
        </section>
      </div>

      <div className="duas-colunas">
        <section className="painel">
          <h3>Brancos e nulos por cargo</h3>
          {(config.cargosPorTurno[config.turno] ?? CARGOS_ORDEM).map(id => (
            <BrancosNulosCargo key={id} cargoId={id} turno={config.turno} />
          ))}
          <p className="bn-texto" style={{ marginTop: 12 }}>
            Tom claro: brancos. Tom escuro: nulos.
          </p>
        </section>
        <section className="painel">
          <h3>Locais que faltam ({faltam.length})</h3>
          <div className="fichas">
            {faltam.length ? (
              faltam.map(l => (
                <span className="ficha" key={l.nome}>
                  {l.nome}
                  {l.total > 1 ? ` (${l.apuradas}/${l.total})` : ''}
                </span>
              ))
            ) : (
              <span className="etiqueta certo">Todos os locais foram apurados</span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function BrancosNulosCargo({ cargoId, turno }: { cargoId: CargoId; turno: number }) {
  const { totais } = usarTotaisCargo(turno, cargoId);
  const t = totais ?? { branco: 0, nulo: 0, total: 0 };
  return (
    <div className="bn-linha">
      <strong>{NOME_CARGO[cargoId]}</strong>
      <div className="bn-barra" role="img" aria-label={`Brancos ${pct(t.branco, t.total)}, nulos ${pct(t.nulo, t.total)}`}>
        <i style={{ width: `${t.total ? (t.branco / t.total) * 100 : 0}%` }} />
        <i style={{ width: `${t.total ? (t.nulo / t.total) * 100 : 0}%` }} />
      </div>
      <span className="bn-texto">
        {pct(t.branco, t.total)} brancos, {pct(t.nulo, t.total)} nulos
      </span>
    </div>
  );
}
