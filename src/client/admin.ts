'use client';
// Chamadas às rotas de administrador. Tudo passa pelo servidor (o cliente não lê boletins,
// divergências nem fiscais direto do Firestore).
import { chamarApi, obterIdToken } from './sessao';
import type { BoletimGravado, Divergencia } from '../domain/types';
import type { BoletimResumo } from '../server/admin/listar-boletins';
import type { FiscalResumo } from '../server/admin/fiscais';
import type { ResultadoImportacao } from '../server/admin/importar-apuracao';
import type { ConfigCidade, ZonaConfig } from '../domain/types';

export interface DivergenciaDetalhada extends Divergencia {
  atual?: BoletimGravado;
}

export const listarBoletins = (turno: number) => chamarApi<{ boletins: BoletimResumo[] }>(`/api/admin/boletins?turno=${turno}`);

export const obterBoletim = (id: string) => chamarApi<{ boletim: BoletimGravado }>(`/api/admin/boletins/${id}`);

export const excluirBoletim = (id: string) => chamarApi<{ ok: true }>(`/api/admin/boletins/${id}`, { method: 'DELETE' });

export const listarDivergencias = () => chamarApi<{ pendentes: DivergenciaDetalhada[]; resolvidas: DivergenciaDetalhada[] }>('/api/admin/divergencias');

export const resolverDivergencia = (id: string, decisao: 'manter' | 'novo') =>
  chamarApi<{ ok: true }>(`/api/divergencias/${id}`, { method: 'PATCH', body: JSON.stringify({ decisao }) });

export const listarFiscais = () => chamarApi<{ fiscais: FiscalResumo[] }>('/api/admin/fiscais');

export const cadastrarFiscal = (nome: string, admin: boolean) =>
  chamarApi<{ id: string; codigo: string }>('/api/admin/fiscais', { method: 'POST', body: JSON.stringify({ nome, admin }) });

export const definirFiscalAtivo = (id: string, ativo: boolean) =>
  chamarApi<{ ok: true }>(`/api/admin/fiscais/${id}`, { method: 'PATCH', body: JSON.stringify({ ativo }) });

export const excluirFiscal = (id: string) => chamarApi<{ ok: true }>(`/api/admin/fiscais/${id}`, { method: 'DELETE' });

export const atualizarConfig = (mudanca: { zonas?: ZonaConfig[]; turno?: 1 | 2 }) =>
  chamarApi<{ config: ConfigCidade }>('/api/admin/config', { method: 'PATCH', body: JSON.stringify(mudanca) });

export const zerarApuracao = (turno: 1 | 2) =>
  chamarApi<{ boletinsApagados: number; divergenciasApagadas: number }>('/api/admin/zerar', { method: 'POST', body: JSON.stringify({ turno, confirmar: true }) });

/** Baixa a exportação de um turno e dispara o download no navegador (a rota exige o token no
 * cabeçalho, por isso não dá pra só abrir o link direto — precisa passar pelo fetch autenticado).
 * `tipo: 'backup'` é o CSV longo pra reimportar depois; `'resumo'` é a lista legível de votos (nome
 * + total, já somado), em CSV ou XLSX. */
export async function baixarExportacao(turno: 1 | 2, tipo: 'backup' | 'resumo' = 'backup', formato: 'csv' | 'xlsx' = 'csv'): Promise<void> {
  const token = await obterIdToken();
  if (!token) throw new Error('Faça login para continuar.');
  const query = tipo === 'resumo' ? `turno=${turno}&tipo=resumo&formato=${formato}` : `turno=${turno}`;
  const resp = await fetch(`/api/admin/exportar?${query}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    const dados = await resp.json().catch(() => null);
    throw new Error(dados?.erro ?? 'Não foi possível exportar.');
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const nome = tipo === 'resumo' ? `resumo-votacao-turno-${turno}.${formato}` : `apuracao-turno-${turno}.csv`;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export const importarApuracao = (csv: string) => chamarApi<ResultadoImportacao>('/api/admin/importar', { method: 'POST', body: JSON.stringify({ csv }) });
