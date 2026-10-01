'use client';
// Digitação da urna inteira, olhando o papel. Sem lista FECHADA de candidatos: o seletor por nome
// (SeletorCandidato) é só uma ajuda pra digitar mais rápido e sem erro de número, usando
// data/candidatos.json; continua dando pra digitar um número que não está lá (candidato trocado
// depois da planilha, por exemplo — vira "Candidato NNNN" na conferência). Ver nota em
// src/domain/validar-digitado.ts sobre por que não existe digitação de um cargo isolado.
//
// O total não é digitado: é sempre a soma de candidatos + legenda + brancos + nulos, calculada
// sozinha (decisão da responsável pelo projeto). Campo deixado em branco conta como zero, mas fica
// sinalizado (borda tracejada + aviso) pra não passar despercebido — ver `camposEmBranco` abaixo.
import { useMemo, useState } from 'react';
import { CARGOS_ORDEM, NOME_CARGO, TIPO_CARGO } from '../bu/cargos';
import type { CargoId } from '../bu/types';
import { candidatosDoCargo, partidosDoCargo, type ListaCandidatos } from '../domain/candidatos';
import type { CargoDigitado } from '../domain/validar-digitado';
import { validarCargosDigitados } from '../domain/validar-digitado';
import type { CargoEntrada } from '../domain/types';
import { SeletorCandidato } from './SeletorCandidato';
import candidatosJson from '../../data/candidatos.json';

const CANDIDATOS = candidatosJson as ListaCandidatos;

interface LinhaNumero {
  chave: string;
  numero: string;
  votos: string;
}

interface EstadoCargo {
  candidatos: LinhaNumero[];
  legenda: LinhaNumero[];
  branco: string;
  nulo: string;
}

const linhaVazia = (): LinhaNumero => ({ chave: crypto.randomUUID(), numero: '', votos: '' });
const cargoVazio = (): EstadoCargo => ({ candidatos: [linhaVazia()], legenda: [], branco: '', nulo: '' });

/** Texto em branco conta como zero (sinalizado na interface, não bloqueia). */
function paraNumero(txt: string): number {
  return txt.trim() === '' ? 0 : Number(txt);
}

/** Converte o estado do formulário para o formato que validarCargosDigitados espera. */
function paraCargoDigitado(e: EstadoCargo): CargoDigitado {
  const votos: Record<string, number> = {};
  for (const l of e.candidatos) if (l.numero.trim()) votos[l.numero.trim()] = paraNumero(l.votos);
  const legenda: Record<string, number> = {};
  for (const l of e.legenda) if (l.numero.trim()) legenda[l.numero.trim()] = paraNumero(l.votos);
  return { votos, legenda, branco: paraNumero(e.branco), nulo: paraNumero(e.nulo) };
}

export function DigitarBoletim({
  exigidos,
  onPronto,
}: {
  exigidos: CargoId[];
  onPronto: (cargos: Partial<Record<CargoId, CargoEntrada>>) => void;
}) {
  const [estado, setEstado] = useState<Record<CargoId, EstadoCargo>>(() => {
    const s = {} as Record<CargoId, EstadoCargo>;
    for (const id of exigidos) s[id] = cargoVazio();
    return s;
  });
  // Só o primeiro cargo começa aberto — evita uma rolagem gigante com tudo expandido de uma vez.
  const [aberto, setAberto] = useState<CargoId | null>(exigidos[0] ?? null);

  const resultado = useMemo(() => {
    const digitado: Partial<Record<CargoId, CargoDigitado>> = {};
    for (const id of exigidos) digitado[id] = paraCargoDigitado(estado[id]!);
    return validarCargosDigitados(digitado, exigidos);
  }, [estado, exigidos]);

  function atualizarCargo(id: CargoId, mudanca: Partial<EstadoCargo>) {
    setEstado(s => ({ ...s, [id]: { ...s[id]!, ...mudanca } }));
  }

  function aoContinuar() {
    if (resultado.ok) onPronto(resultado.cargos);
  }

  return (
    <div className="pilha">
      {exigidos.map(id => (
        <CargoDigitavel
          key={id}
          cargoId={id}
          estado={estado[id]!}
          aberto={aberto === id}
          onAlternar={() => setAberto(a => (a === id ? null : id))}
          onMudar={m => atualizarCargo(id, m)}
        />
      ))}
      <p className="msg" role="status" style={resultado.ok ? undefined : { display: 'none' }}>
        Os {exigidos.length} cargos estão certos. Pode continuar.
      </p>
      {!resultado.ok && resultado.mensagens.length > 0 && (
        <p className="msg aviso" role="status">
          {resultado.mensagens[0]}
        </p>
      )}
      <div className="linha-botoes">
        <button className="btn" type="button" disabled={!resultado.ok} onClick={aoContinuar}>
          Conferir e continuar
        </button>
      </div>
    </div>
  );
}

function CargoDigitavel({
  cargoId,
  estado,
  aberto,
  onAlternar,
  onMudar,
}: {
  cargoId: CargoId;
  estado: EstadoCargo;
  aberto: boolean;
  onAlternar: () => void;
  onMudar: (m: Partial<EstadoCargo>) => void;
}) {
  const proporcional = TIPO_CARGO[cargoId] === 'proporcional';
  const listaCandidatos = useMemo(() => candidatosDoCargo(CANDIDATOS, cargoId), [cargoId]);
  const listaPartidos = useMemo(() => partidosDoCargo(CANDIDATOS, cargoId), [cargoId]);
  const somaCandidatos = estado.candidatos.reduce((a, l) => a + paraNumero(l.votos), 0);
  const somaLegenda = estado.legenda.reduce((a, l) => a + paraNumero(l.votos), 0);
  const somaTudo = somaCandidatos + somaLegenda + paraNumero(estado.branco) + paraNumero(estado.nulo);

  // Campo com número escolhido mas votos em branco (ou brancos/nulos em branco): conta como zero,
  // mas sinalizamos pra não passar despercebido — ver aviso logo abaixo das entradas.
  const emBranco = [
    ...estado.candidatos.filter(l => l.numero.trim() && l.votos.trim() === ''),
    ...estado.legenda.filter(l => l.numero.trim() && l.votos.trim() === ''),
  ].length + (estado.branco.trim() === '' ? 1 : 0) + (estado.nulo.trim() === '' ? 1 : 0);

  function mudarNumero(lista: 'candidatos' | 'legenda', chave: string, numero: string) {
    onMudar({ [lista]: estado[lista].map(l => (l.chave === chave ? { ...l, numero } : l)) });
  }
  function mudarVotos(lista: 'candidatos' | 'legenda', chave: string, votos: string) {
    onMudar({ [lista]: estado[lista].map(l => (l.chave === chave ? { ...l, votos } : l)) });
  }
  function addLinha(lista: 'candidatos' | 'legenda') {
    onMudar({ [lista]: [...estado[lista], linhaVazia()] });
  }
  function removerLinha(lista: 'candidatos' | 'legenda', chave: string) {
    onMudar({ [lista]: estado[lista].filter(l => l.chave !== chave) });
  }

  return (
    <details className="cargo-conf cargo-digitavel" open={aberto} onToggle={e => e.currentTarget.open !== aberto && onAlternar()}>
      <summary>
        {NOME_CARGO[cargoId]}
        <span>{somaTudo} votos</span>
      </summary>
      <div className="pilha" style={{ marginTop: 12 }}>
        <strong>Candidatos com voto</strong>
        {estado.candidatos.map(l => (
          <div className="linha-candidato" key={l.chave}>
            <SeletorCandidato rotulo="Candidato" lista={listaCandidatos} numero={l.numero} onEscolher={n => mudarNumero('candidatos', l.chave, n)} />
            <div className="votos-remover">
              <div className="campo">
                <label htmlFor={`vot-${l.chave}`}>Votos</label>
                <input
                  id={`vot-${l.chave}`}
                  className="campo-numero"
                  inputMode="numeric"
                  placeholder="0"
                  value={l.votos}
                  onChange={e => mudarVotos('candidatos', l.chave, e.target.value)}
                />
              </div>
              <button type="button" className="btn ghost pequeno" onClick={() => removerLinha('candidatos', l.chave)} aria-label="Remover candidato">
                Remover
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="btn ghost pequeno" onClick={() => addLinha('candidatos')}>
          Adicionar candidato
        </button>

        {proporcional && (
          <>
            <hr />
            <strong>Votos de legenda, por partido</strong>
            {estado.legenda.map(l => (
              <div className="linha-candidato" key={l.chave}>
                <SeletorCandidato rotulo="Partido" lista={listaPartidos} numero={l.numero} onEscolher={n => mudarNumero('legenda', l.chave, n)} />
                <div className="votos-remover">
                  <div className="campo">
                    <label htmlFor={`vleg-${l.chave}`}>Votos de legenda</label>
                    <input
                      id={`vleg-${l.chave}`}
                      className="campo-numero"
                      inputMode="numeric"
                      placeholder="0"
                      value={l.votos}
                      onChange={e => mudarVotos('legenda', l.chave, e.target.value)}
                    />
                  </div>
                  <button type="button" className="btn ghost pequeno" onClick={() => removerLinha('legenda', l.chave)} aria-label="Remover partido">
                    Remover
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="btn ghost pequeno" onClick={() => addLinha('legenda')}>
              Adicionar partido
            </button>
          </>
        )}

        <hr />
        <div className="entradas">
          <div className="campo">
            <label htmlFor={`branco-${cargoId}`}>Brancos</label>
            <input id={`branco-${cargoId}`} className="campo-numero" inputMode="numeric" placeholder="0" value={estado.branco} onChange={e => onMudar({ branco: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor={`nulo-${cargoId}`}>Nulos</label>
            <input id={`nulo-${cargoId}`} className="campo-numero" inputMode="numeric" placeholder="0" value={estado.nulo} onChange={e => onMudar({ nulo: e.target.value })} />
          </div>
        </div>
        <p className="msg soma-info ok" role="status">
          Total: {somaTudo} votos (candidatos + legenda + brancos + nulos, somado sozinho).
        </p>
        {emBranco > 0 && (
          <p className="msg aviso" role="status">
            {emBranco} campo{emBranco > 1 ? 's' : ''} em branco, contado{emBranco > 1 ? 's' : ''} como zero — confira se não esqueceu de preencher algum (marcados com borda tracejada).
          </p>
        )}
      </div>
    </details>
  );
}
