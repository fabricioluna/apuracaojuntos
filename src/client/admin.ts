'use client';
// Chamadas às rotas de administrador. Tudo passa pelo servidor (o cliente não lê boletins,
// divergências nem fiscais direto do Firestore).
import { chamarApi } from './sessao';
import type { BoletimGravado, Divergencia } from '../domain/types';
import type { BoletimResumo } from '../server/admin/listar-boletins';
import type { FiscalResumo } from '../server/admin/fiscais';
import type { ConfigCidade, ZonaConfig } from '../domain/types';

export interface DivergenciaDetalhada extends Divergencia {
  atual?: BoletimGravado;
}

export const listarBoletins = (turno: number) => chamarApi<{ boletins: BoletimResumo[] }>(`/api/admin/boletins?turno=${turno}`);

export const obterBoletim = (id: string) => chamarApi<{ boletim: BoletimGravado }>(`/api/admin/boletins/${id}`);

export const listarDivergencias = () => chamarApi<{ pendentes: DivergenciaDetalhada[]; resolvidas: DivergenciaDetalhada[] }>('/api/admin/divergencias');

export const resolverDivergencia = (id: string, decisao: 'manter' | 'novo') =>
  chamarApi<{ ok: true }>(`/api/divergencias/${id}`, { method: 'PATCH', body: JSON.stringify({ decisao }) });

export const listarFiscais = () => chamarApi<{ fiscais: FiscalResumo[] }>('/api/admin/fiscais');

export const cadastrarFiscal = (nome: string, admin: boolean) =>
  chamarApi<{ id: string; codigo: string }>('/api/admin/fiscais', { method: 'POST', body: JSON.stringify({ nome, admin }) });

export const definirFiscalAtivo = (id: string, ativo: boolean) =>
  chamarApi<{ ok: true }>(`/api/admin/fiscais/${id}`, { method: 'PATCH', body: JSON.stringify({ ativo }) });

export const atualizarConfig = (mudanca: { zonas?: ZonaConfig[]; turno?: 1 | 2 }) =>
  chamarApi<{ config: ConfigCidade }>('/api/admin/config', { method: 'PATCH', body: JSON.stringify(mudanca) });
