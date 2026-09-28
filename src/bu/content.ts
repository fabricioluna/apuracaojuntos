import { CODIGO_CARGO, NOME_CARGO } from './cargos';
import type { BoletimDecodificado, CargoApurado, CargoId, ErroBU, Fase } from './types';

/** Campos do cabeçalho e do conteúdo lidos do BU, antes de serem organizados. */
type Cabecalho = Partial<Record<string, string>>;

interface CargoBruto {
  codigo: number;
  tipo: number; // 0 majoritário, 1 proporcional, 2 consulta
  votos: Record<string, number>;
  partidos: Record<string, { legenda: number; total?: number; nominais: number }>;
  aptos: number;
  nominais: number;
  legc?: number;
  branco: number;
  nulo: number;
  total: number;
}

class ErroFormato extends Error {}

const inteiro = (v: string | undefined, nome: string): number => {
  if (v === undefined || !/^\d+$/.test(v)) throw new ErroFormato(`O campo ${nome} do boletim está inválido (${v ?? 'ausente'}).`);
  return Number(v);
};

const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export type ConteudoInterpretado = Omit<
  BoletimDecodificado,
  'versao' | 'assinatura' | 'motivoAssinatura' | 'hashFinal' | 'conteudo'
>;

/** Interpreta o conteúdo remontado do BU. Devolve os dados ou a lista de erros em português. */
export function interpretarConteudo(conteudo: string): { ok: true; dados: ConteudoInterpretado } | { ok: false; erros: ErroBU[] } {
  try {
    return interpretar(conteudo);
  } catch (e) {
    if (e instanceof ErroFormato) return { ok: false, erros: [{ codigo: 'FORMATO', mensagem: e.message }] };
    throw e;
  }
}

function interpretar(conteudo: string): { ok: true; dados: ConteudoInterpretado } | { ok: false; erros: ErroBU[] } {
  const tokens = conteudo.trim().split(/ +/).map(t => {
    const i = t.indexOf(':');
    return i < 0 ? ([t, ''] as const) : ([t.slice(0, i), t.slice(i + 1)] as const);
  });

  // Cabeçalho do boletim: tudo até a primeira eleição (IDEL).
  const cab: Cabecalho = {};
  let i = 0;
  for (; i < tokens.length && tokens[i]![0] !== 'IDEL'; i++) {
    const [k, v] = tokens[i]!;
    if (!(k in cab)) cab[k] = v;
  }

  // Eleições e cargos
  const brutos: CargoBruto[] = [];
  while (i < tokens.length) {
    const [k] = tokens[i]!;
    if (k === 'IDEL' || k === 'MAJO' || k === 'PROP') { i++; continue; }
    if (k !== 'CARG') throw new ErroFormato(`Campo inesperado no boletim: ${tokens[i]!.join(':')}.`);
    i = lerCargo(tokens, i, brutos);
  }

  const erros: ErroBU[] = [];
  const cargos: Partial<Record<CargoId, CargoApurado>> = {};
  const ignorados: number[] = [];
  for (const b of brutos) {
    const id = CODIGO_CARGO[b.codigo];
    if (!id) { ignorados.push(b.codigo); continue; }
    if (cargos[id]) throw new ErroFormato(`O cargo ${NOME_CARGO[id]} aparece duas vezes no boletim.`);
    for (const m of conferirCargo(id, b)) erros.push({ codigo: 'TOTAIS_NAO_BATEM', mensagem: m });
    const legenda: Record<string, number> = {};
    for (const [p, d] of Object.entries(b.partidos)) if (d.legenda > 0) legenda[p] = d.legenda;
    cargos[id] = {
      codigo: b.codigo,
      id,
      tipo: b.tipo === 1 ? 'proporcional' : 'majoritario',
      votos: b.votos,
      legenda,
      branco: b.branco,
      nulo: b.nulo,
      total: b.total,
      nominais: b.nominais,
      legendaTotal: b.legc ?? soma(Object.values(legenda)),
      aptos: b.aptos,
    };
  }
  if (erros.length) return { ok: false, erros };

  const turno = inteiro(cab.TURN, 'TURN');
  if (turno !== 1 && turno !== 2) throw new ErroFormato(`Turno inválido no boletim (${turno}).`);
  const fase = cab.FASE as Fase;
  if (!['O', 'S', 'T'].includes(fase)) throw new ErroFormato(`Fase dos dados inválida no boletim (${cab.FASE ?? 'ausente'}).`);
  if (!cab.UNFE || !/^[A-Z]{2}$/.test(cab.UNFE)) throw new ErroFormato('A UF do boletim está inválida.');
  if (!cab.IDUE) throw new ErroFormato('O boletim não traz o número de série da urna.');

  const dados: ConteudoInterpretado = {
    origem: cab.ORIG ?? '',
    fase,
    processo: inteiro(cab.PROC, 'PROC'),
    pleito: inteiro(cab.PLEI, 'PLEI'),
    dataPleito: cab.DTPL ?? '',
    turno,
    uf: cab.UNFE,
    municipio: inteiro(cab.MUNI, 'MUNI'),
    zona: inteiro(cab.ZONA, 'ZONA'),
    secao: inteiro(cab.SECA, 'SECA'),
    secoesAgregadas: cab.AGRE ? cab.AGRE.split('.').map(s => inteiro(s, 'AGRE')) : [],
    idUrna: cab.IDUE,
    cargos,
    cargosIgnorados: ignorados,
  };
  // Boletins do Sistema de Apuração (SA) não trazem comparecimento.
  if (cab.APTO !== undefined && cab.COMP !== undefined && cab.FALT !== undefined) {
    dados.comparecimento = { aptos: inteiro(cab.APTO, 'APTO'), comparecimento: inteiro(cab.COMP, 'COMP'), faltosos: inteiro(cab.FALT, 'FALT') };
  }
  return { ok: true, dados };
}

/** Lê um cargo a partir do token CARG e devolve a posição do próximo token. */
function lerCargo(tokens: ReadonlyArray<readonly [string, string]>, inicio: number, saida: CargoBruto[]): number {
  const codigo = inteiro(tokens[inicio]![1], 'CARG');
  const nome = CODIGO_CARGO[codigo] ? NOME_CARGO[CODIGO_CARGO[codigo]!] : `cargo ${codigo}`;
  let i = inicio + 1;
  if (tokens[i]?.[0] !== 'TIPO') throw new ErroFormato(`${nome}: faltou o tipo do cargo.`);
  const tipo = inteiro(tokens[i]![1], 'TIPO');
  i++;
  if (tokens[i]?.[0] === 'VERC') i++;

  const cargo: CargoBruto = { codigo, tipo, votos: {}, partidos: {}, aptos: 0, nominais: 0, branco: 0, nulo: 0, total: 0 };
  let partido: string | undefined;
  const resumo: Record<string, number> = {};

  for (; i < tokens.length; i++) {
    const [k, v] = tokens[i]!;
    if (/^\d+$/.test(k)) { // votação de um candidato
      if (tipo === 1 && partido === undefined) throw new ErroFormato(`${nome}: candidato ${k} fora de um partido.`);
      if (k in cargo.votos) throw new ErroFormato(`${nome}: o candidato ${k} aparece duas vezes.`);
      const votos = inteiro(v, k);
      cargo.votos[k] = votos;
      if (partido !== undefined) cargo.partidos[partido]!.nominais += votos;
    } else if (k === 'PART') {
      if (tipo !== 1) throw new ErroFormato(`${nome}: partido em cargo majoritário.`);
      partido = String(inteiro(v, 'PART'));
      if (partido in cargo.partidos) throw new ErroFormato(`${nome}: o partido ${partido} aparece duas vezes.`);
      cargo.partidos[partido] = { legenda: 0, nominais: 0 };
    } else if (k === 'LEGP' || k === 'TOTP') {
      if (partido === undefined) throw new ErroFormato(`${nome}: ${k} fora de um partido.`);
      if (k === 'LEGP') cargo.partidos[partido]!.legenda = inteiro(v, k);
      else cargo.partidos[partido]!.total = inteiro(v, k);
    } else if (['APTA', 'APTS', 'APTT', 'CSEC', 'NOMI', 'LEGC', 'BRAN', 'NULO', 'TOTC'].includes(k)) {
      resumo[k] = inteiro(v, k);
      if (k === 'TOTC') { i++; break; } // TOTC fecha o cargo
    } else {
      throw new ErroFormato(`${nome}: campo inesperado ${k}:${v}.`);
    }
  }
  for (const campo of ['APTA', 'NOMI', 'BRAN', 'NULO', 'TOTC']) {
    if (resumo[campo] === undefined) throw new ErroFormato(`${nome}: o resumo do cargo está incompleto (falta ${campo}). Faltam QR Codes ou a leitura falhou.`);
  }
  cargo.aptos = resumo.APTA!;
  cargo.nominais = resumo.NOMI!;
  cargo.legc = resumo.LEGC;
  cargo.branco = resumo.BRAN!;
  cargo.nulo = resumo.NULO!;
  cargo.total = resumo.TOTC!;
  saida.push(cargo);
  return i;
}

/**
 * Conferências aritméticas que o próprio BU permite (campos do manual):
 * candidatos = NOMI; legendas dos partidos = LEGC; candidatos + legenda = TOTP de cada partido;
 * NOMI + LEGC + brancos + nulos = TOTC. Devolve mensagens em português, vazio se tudo bate.
 */
function conferirCargo(id: CargoId, c: CargoBruto): string[] {
  const nome = NOME_CARGO[id], msgs: string[] = [];
  const somaCandidatos = soma(Object.values(c.votos));
  if (somaCandidatos !== c.nominais) msgs.push(`${nome}: a soma dos votos dos candidatos (${somaCandidatos}) não bate com os votos nominais do boletim (${c.nominais}).`);
  const somaLegenda = soma(Object.values(c.partidos).map(p => p.legenda));
  if (c.legc !== undefined && somaLegenda !== c.legc) msgs.push(`${nome}: a soma dos votos de legenda (${somaLegenda}) não bate com o total de legenda do boletim (${c.legc}).`);
  for (const [p, d] of Object.entries(c.partidos)) {
    if (d.total !== undefined && d.nominais + d.legenda !== d.total) msgs.push(`${nome}: partido ${p}, os votos (${d.nominais + d.legenda}) não batem com o total do partido (${d.total}).`);
  }
  const esperado = c.nominais + (c.legc ?? somaLegenda) + c.branco + c.nulo;
  if (esperado !== c.total) msgs.push(`${nome}: a soma de candidatos, legenda, brancos e nulos (${esperado}) não bate com o total apurado do boletim (${c.total}).`);
  return msgs;
}
