import { db } from '../firebase-admin';
import type { BoletimGravado } from '../../domain/types';

export interface BoletimResumo {
  id: string;
  zona: number;
  secao: number;
  turno: number;
  fiscalNome: string;
  enviadoEm: number;
  corrigidoPor?: string;
  corrigidoEm?: number;
  origem: string; // 'QR Code' | 'Digitado' | 'QR Code e digitação'
  fotoPath?: string;
  assinatura?: string;
  divergenciaPendente: boolean;
}

function origemDe(b: BoletimGravado): string {
  const origens = new Set(Object.values(b.cargos).map(c => c!.origem));
  if (origens.size === 1) return origens.has('qrcode') ? 'QR Code' : 'Digitado';
  return 'QR Code e digitação';
}

/** Lista os boletins do turno, mais recentes primeiro. Só o servidor lê boletins/*. */
export async function listarBoletins(turno: number): Promise<BoletimResumo[]> {
  const [snap, divergentesSnap] = await Promise.all([
    db().collection('boletins').where('turno', '==', turno).get(),
    db().collection('divergencias').where('status', '==', 'pendente').get(),
  ]);
  const chavesComDivergencia = new Set(divergentesSnap.docs.map(d => (d.data() as { key: string }).key));

  return snap.docs
    .map(doc => {
      const b = doc.data() as BoletimGravado;
      return {
        id: b.id,
        zona: b.zona,
        secao: b.secao,
        turno: b.turno,
        fiscalNome: b.fiscalNome,
        enviadoEm: b.enviadoEm,
        corrigidoPor: b.corrigidoPor,
        corrigidoEm: b.corrigidoEm,
        origem: origemDe(b),
        fotoPath: b.fotoPath,
        assinatura: b.assinatura,
        divergenciaPendente: chavesComDivergencia.has(b.id),
      };
    })
    .sort((a, b) => b.enviadoEm - a.enviadoEm);
}

/** Detalhe completo de um boletim (todos os cargos), para a tela de conferência do administrador. */
export async function obterBoletim(id: string): Promise<BoletimGravado | undefined> {
  const doc = await db().collection('boletins').doc(id).get();
  return doc.exists ? (doc.data() as BoletimGravado) : undefined;
}
