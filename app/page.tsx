'use client';
// Painel público, sem login. Só lê documentos de totais e o mapa de urnas (nunca boletins),
// em tempo real via onSnapshot. Ver CLAUDE.md > Arquitetura do servidor.
import { useMemo, useState } from 'react';
import { CARGOS_ORDEM, NOME_CARGO } from '../src/bu/cargos';
import type { CargoId } from '../src/bu/types';
import { nomeCandidato, nomePartido, type ListaCandidatos } from '../src/domain/candidatos';
import { usarConfigCidade } from '../src/client/config';
import { usarMapa, usarTotaisCargo, type TotaisCargo } from '../src/client/totais';
import { IconeInfo } from '../src/ui/icones';

// Lista oficial de candidatos: ainda não importada (ver CLAUDE.md > Candidatos). Até lá, todo
// mundo aparece só pelo número, como pede a regra do app.
const CANDIDATOS: ListaCandidatos = {};

const fmt = (n: number) => Number(n || 0).toLocaleString('pt-BR');
const pct = (a: number, b: number) => (b ? ((a / b) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '0,0%');
const hora = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

interface Linha {
  chave: string;
  nome: string;
  numero?: string;
  votos: number;
  neutra?: boolean;
}

export default function PaginaApuracao() {
  const { config } = usarConfigCidade();
  const exigidos = config?.cargosPorTurno[config.turno] ?? CARGOS_ORDEM;
  const [cargoSel, setCargoSel] = useState<CargoId>('presidente');
  const cargoAtual = exigidos.includes(cargoSel) ? cargoSel : exigidos[0]!;

  const { totais } = usarTotaisCargo(config?.turno ?? 1, cargoAtual);
  const { mapa } = usarMapa(config?.turno ?? 1);
  const [mostrarBN, setMostrarBN] = useState(true);
  const [linhaAberta, setLinhaAberta] = useState<string | null>(null);

  const M = useMemo(() => config?.zonas.reduce((a, z) => a + z.secoes.length, 0) ?? 0, [config]);

  if (!config) return null;

  const urnasApuradas = totais?.urnas ?? 0;
  const validos = totais ? totais.total - totais.branco - totais.nulo : 0;

  const linhas: Linha[] = totais
    ? Object.entries(totais.votos)
        .map(([numero, votos]) => ({ chave: numero, numero, votos, nome: nomeCandidato(CANDIDATOS, cargoAtual, numero) }))
        .sort((a, b) => b.votos - a.votos)
    : [];
  const legendaTotal = totais ? Object.values(totais.legenda).reduce((a, b) => a + b, 0) : 0;
  const extras: Linha[] = totais
    ? [
        ...(legendaTotal > 0 ? [{ chave: 'legenda', nome: 'Votos de legenda', votos: legendaTotal, neutra: true }] : []),
        ...(mostrarBN
          ? [
              { chave: 'branco', nome: 'Brancos', votos: totais.branco, neutra: true },
              { chave: 'nulo', nome: 'Nulos', votos: totais.nulo, neutra: true },
            ]
          : []),
      ]
    : [];
  const todas = [...linhas, ...extras];
  const maxV = Math.max(1, ...todas.map(l => l.votos));

  const cels = config.zonas.flatMap(z =>
    z.secoes.map(s => {
      const chave = `${z.zona}-${s.secao}`;
      const status = mapa?.secoes[chave];
      const rotulo = `Zona ${z.zona}, seção ${s.secao}: ${status === 'div' ? 'apurada, com divergência em análise' : status === 'ok' ? 'apurada' : 'ainda não enviada'}`;
      return <span key={chave} className={`urna ${status ?? ''}`} title={rotulo} />;
    }),
  );

  return (
    <main>
      <div className="pilha">
        <div className="aviso-oficial">
          <IconeInfo />
          <p>
            <strong>Totalização paralela e não oficial.</strong> Os números vêm dos boletins de urna enviados por fiscais e voluntários. O
            resultado oficial é o divulgado pelo TSE.
          </p>
        </div>
        <div className="cabeca-pagina">
          <h1>Apuração</h1>
          <span className="ao-vivo">
            <i />
            {mapa?.ultimo ? `Última urna: seção ${mapa.ultimo.secao}, às ${hora(mapa.ultimo.em)}` : 'Aguardando a primeira urna'}
          </span>
        </div>
        <div className="abas" role="tablist" aria-label="Cargo">
          {exigidos.map(id => (
            <button
              key={id}
              role="tab"
              className="aba"
              aria-selected={id === cargoAtual}
              onClick={() => {
                setCargoSel(id);
                setLinhaAberta(null);
              }}
            >
              {NOME_CARGO[id]}
            </button>
          ))}
        </div>
        <section className="painel" aria-labelledby="cargo-h">
          <h2 className="cargo-titulo" id="cargo-h">
            {NOME_CARGO[cargoAtual]}
          </h2>
          <div className="cobertura">
            <p>
              <strong>{fmt(urnasApuradas)}</strong> de {fmt(M)} urnas apuradas ({pct(urnasApuradas, M)})
            </p>
            <div className="urnas" role="img" aria-label={`${urnasApuradas} de ${M} urnas apuradas`}>
              {cels}
            </div>
            <ul className="legenda">
              <li>
                <span className="urna ok" />
                Apurada
              </li>
              <li>
                <span className="urna div" />
                Com divergência em análise
              </li>
              <li>
                <span className="urna" />
                Ainda não enviada
              </li>
            </ul>
          </div>

          {!totais || todas.length === 0 ? (
            <div className="vazio">
              <p className="lead">Nenhuma urna apurada ainda. Assim que um fiscal enviar o primeiro boletim, as barras aparecem aqui e se atualizam a cada envio.</p>
            </div>
          ) : (
            <>
              <div className="barras" role="list">
                {todas.map(l => {
                  const p = l.neutra ? pct(l.votos, totais.total) : pct(l.votos, validos);
                  const aberta = linhaAberta === l.chave;
                  return (
                    <div className="item-barra" role="listitem" key={l.chave}>
                      <button className={`linha ${l.neutra ? 'neutra' : ''}`} aria-expanded={aberta} onClick={() => setLinhaAberta(aberta ? null : l.chave)}>
                        <span className="linha-topo">
                          <span>
                            <span className="nome">{l.nome}</span>
                            {!l.neutra && <span className="numero">{l.numero}</span>}
                          </span>
                          <span>
                            <span className="valor">{fmt(l.votos)}</span>
                            <span className="pct">{p}</span>
                          </span>
                        </span>
                        <span className="trilho">
                          <span className="fill" style={{ width: `${(l.votos / maxV) * 100}%` }} />
                        </span>
                      </button>
                      {aberta && <div className="detalhe">{detalheLinha(l, totais, cargoAtual, urnasApuradas, validos)}</div>}
                    </div>
                  );
                })}
              </div>
              <div className="rodape-grafico">
                <label className="chave">
                  <input type="checkbox" checked={mostrarBN} onChange={e => setMostrarBN(e.target.checked)} />
                  Mostrar brancos e nulos
                </label>
                <span>Candidatos em % dos votos válidos. Brancos e nulos em % do total apurado.</span>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function detalheLinha(l: Linha, t: TotaisCargo, cargoId: CargoId, urnasApuradas: number, validos: number): string {
  if (l.chave === 'legenda') {
    const partidos = Object.entries(t.legenda)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([n, v]) => `${nomePartido({}, cargoId, n)} (${n}): ${fmt(v)}`)
      .join('; ');
    return `Votos de legenda: ${fmt(l.votos)}, ${pct(l.votos, t.total)} do total apurado. Por partido: ${partidos || 'nenhum ainda'}.`;
  }
  if (l.neutra) {
    const media = urnasApuradas ? Math.round(l.votos / urnasApuradas) : 0;
    return `${l.nome}: ${fmt(l.votos)} votos, ${pct(l.votos, t.total)} do total apurado. Em média, ${fmt(media)} por urna.`;
  }
  const lidera = t.lidera[l.numero!] ?? 0;
  const melhor = t.melhor[l.numero!];
  const resto = urnasApuradas - lidera;
  return (
    `${l.nome}, número ${l.numero}, tem ${fmt(l.votos)} votos, ${pct(l.votos, validos)} dos válidos. ` +
    `Lidera em ${lidera} de ${urnasApuradas} urnas apuradas${resto ? '' : ', todas'}.` +
    (melhor ? ` Melhor resultado: ${fmt(melhor.votos)} votos na zona ${melhor.zona}, seção ${melhor.secao}.` : '')
  );
}
