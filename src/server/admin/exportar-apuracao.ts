import { CARGOS_ORDEM } from '../../bu/cargos';
import type { BoletimGravado } from '../../domain/types';
import { db } from '../firebase-admin';

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
