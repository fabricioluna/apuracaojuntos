// Import nomeado, não default: o build ESM do pacote ("xlsx.mjs") não tem export default — só
// exports nomeados (utils, write, ...). Confirmado rodando de verdade (next dev): o import default
// passa no typecheck (os .d.ts do pacote declaram um default), mas quebra em runtime no bundler da
// Vercel/Next com "Export default doesn't exist in target module".
import { utils as xlsxUtils, write as xlsxWrite } from 'xlsx';
import { CARGOS_ORDEM, NOME_CARGO } from '../../bu/cargos';
import { nomeCandidato, nomePartido, type ListaCandidatos } from '../../domain/candidatos';
import type { BoletimGravado } from '../../domain/types';
import candidatosJson from '../../../data/candidatos.json';
import { db } from '../firebase-admin';

const CANDIDATOS = candidatosJson as ListaCandidatos;

/** Mesmo cabeçalho que importar-apuracao.ts espera — os dois lados precisam concordar. */
export const CABECALHO_CSV = ['zona', 'secao', 'turno', 'cargo', 'tipo', 'numero', 'votos', 'fiscalNome', 'origem'];

function campoCsv(v: unknown): string {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function linhasDoBoletim(b: BoletimGravado): string[][] {
  const linhas: string[][] = [];
  for (const cargoId of CARGOS_ORDEM) {
    const c = b.cargos[cargoId];
    if (!c) continue;
    const base = [String(b.zona), String(b.secao), String(b.turno), cargoId];
    for (const [numero, votos] of Object.entries(c.votos)) linhas.push([...base, 'candidato', numero, String(votos), b.fiscalNome, c.origem]);
    for (const [numero, votos] of Object.entries(c.legenda)) linhas.push([...base, 'legenda', numero, String(votos), b.fiscalNome, c.origem]);
    linhas.push([...base, 'branco', '', String(c.branco), b.fiscalNome, c.origem]);
    linhas.push([...base, 'nulo', '', String(c.nulo), b.fiscalNome, c.origem]);
  }
  return linhas;
}

/**
 * Gera um CSV com todos os boletins de um turno, uma linha por item (candidato, legenda, brancos ou
 * nulos de cada cargo) — formato "longo", mais fácil de reconstruir na importação do que colunas
 * dinâmicas por candidato. O número é a fonte da verdade (mesma regra do resto do app); o nome do
 * candidato não entra aqui — quem quiser o nome, cruza pelo número com data/candidatos.json.
 * Abre normalmente no Excel/LibreOffice/Google Sheets.
 */
export async function exportarApuracao(turno: number): Promise<string> {
  const snap = await db().collection('boletins').where('turno', '==', turno).get();
  const linhas = [CABECALHO_CSV, ...snap.docs.flatMap(d => linhasDoBoletim(d.data() as BoletimGravado))];
  return linhas.map(l => l.map(campoCsv).join(',')).join('\r\n') + '\r\n';
}

interface TotaisDoc {
  votos?: Record<string, number>;
  legenda?: Record<string, number>;
  branco?: number;
  nulo?: number;
  total?: number;
}

interface LinhaResumo {
  cargo: string;
  tipo: 'candidato' | 'legenda' | 'branco' | 'nulo';
  numero: string;
  nome: string;
  votos: number;
  percentual: number;
}

/**
 * Resumo legível da votação de um turno: nome do candidato (ou partido, nos votos de legenda) e o
 * total de votos já somado — lido direto de `totais/{turno}_{cargo}` (o mesmo dado agregado que o
 * painel público mostra, não precisa reabrir cada boletim). Ordenado por votos, do maior pro menor,
 * dentro de cada cargo. Diferente de `exportarApuracao` (que é o formato "longo", pensado pra
 * reimportar um boletim de cada vez): este aqui é só pra leitura humana.
 */
export async function resumoVotacao(turno: number): Promise<LinhaResumo[]> {
  const linhas: LinhaResumo[] = [];
  for (const cargoId of CARGOS_ORDEM) {
    const doc = await db().collection('totais').doc(`${turno}_${cargoId}`).get();
    if (!doc.exists) continue;
    const d = doc.data() as TotaisDoc;
    const total = d.total ?? 0;
    const branco = d.branco ?? 0;
    const nulo = d.nulo ?? 0;
    const validos = total - branco - nulo;

    for (const [numero, votos] of Object.entries(d.votos ?? {}).sort((a, b) => b[1] - a[1])) {
      linhas.push({ cargo: NOME_CARGO[cargoId], tipo: 'candidato', numero, nome: nomeCandidato(CANDIDATOS, cargoId, numero), votos, percentual: validos > 0 ? votos / validos : 0 });
    }
    for (const [numero, votos] of Object.entries(d.legenda ?? {}).sort((a, b) => b[1] - a[1])) {
      linhas.push({ cargo: NOME_CARGO[cargoId], tipo: 'legenda', numero, nome: `Legenda: ${nomePartido(CANDIDATOS, cargoId, numero)}`, votos, percentual: validos > 0 ? votos / validos : 0 });
    }
    linhas.push({ cargo: NOME_CARGO[cargoId], tipo: 'branco', numero: '', nome: 'Brancos', votos: branco, percentual: total > 0 ? branco / total : 0 });
    linhas.push({ cargo: NOME_CARGO[cargoId], tipo: 'nulo', numero: '', nome: 'Nulos', votos: nulo, percentual: total > 0 ? nulo / total : 0 });
  }
  return linhas;
}

const CABECALHO_RESUMO = ['Cargo', 'Tipo', 'Número', 'Nome', 'Votos', '% dos válidos'];

function linhaResumoParaCelulas(l: LinhaResumo): (string | number)[] {
  const pct = l.tipo === 'branco' || l.tipo === 'nulo' ? '' : `${(l.percentual * 100).toFixed(2)}%`;
  return [l.cargo, l.tipo, l.numero, l.nome, l.votos, pct];
}

export function resumoParaCsv(linhas: LinhaResumo[]): string {
  const todas = [CABECALHO_RESUMO, ...linhas.map(linhaResumoParaCelulas)];
  return todas.map(l => l.map(campoCsv).join(',')).join('\r\n') + '\r\n';
}

/** Uma aba por cargo, cada uma já ordenada por votos — mais fácil de olhar do que um CSV só. */
export function resumoParaXlsx(linhas: LinhaResumo[]): Buffer {
  const livro = xlsxUtils.book_new();
  for (const cargoId of CARGOS_ORDEM) {
    const doCargo = linhas.filter(l => l.cargo === NOME_CARGO[cargoId]);
    if (doCargo.length === 0) continue;
    const aba = xlsxUtils.aoa_to_sheet([CABECALHO_RESUMO.filter(c => c !== 'Cargo'), ...doCargo.map(l => linhaResumoParaCelulas(l).filter((_, i) => i !== 0))]);
    xlsxUtils.book_append_sheet(livro, aba, NOME_CARGO[cargoId].slice(0, 31)); // Excel limita o nome da aba a 31 caracteres
  }
  return xlsxWrite(livro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
