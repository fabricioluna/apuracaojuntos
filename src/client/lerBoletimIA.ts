'use client';
// Pede ao servidor pra tentar ler os números do boletim numa foto, via IA (ver
// src/server/ler-boletim-ia.ts). O resultado é só uma sugestão pra pré-preencher a tela de
// digitação — nunca grava nada sozinho.
import { chamarApi } from './sessao';
import type { ResultadoLeituraIA } from '../server/ler-boletim-ia';

export type { ResultadoLeituraIA, SugestaoCargo } from '../server/ler-boletim-ia';

function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      // leitor.result é "data:image/jpeg;base64,AAAA..." — só a parte depois da vírgula interessa.
      const resultado = String(leitor.result);
      resolve(resultado.slice(resultado.indexOf(',') + 1));
    };
    leitor.onerror = () => reject(leitor.error ?? new Error('Não consegui ler o arquivo da foto.'));
    leitor.readAsDataURL(blob);
  });
}

export async function lerBoletimComIA(foto: Blob, mimeType: string): Promise<ResultadoLeituraIA> {
  const imagemBase64 = await blobParaBase64(foto);
  return chamarApi<ResultadoLeituraIA>('/api/ler-boletim', { method: 'POST', body: JSON.stringify({ imagemBase64, mimeType }) });
}
