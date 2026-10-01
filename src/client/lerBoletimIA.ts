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

/** Aceita uma ou mais fotos do mesmo boletim — usado quando o papel é longo demais pra caber numa
 * foto só; todas vão juntas numa chamada só, pra a IA juntar os dados sem contar nada em dobro. */
export async function lerBoletimComIA(fotos: Blob[]): Promise<ResultadoLeituraIA> {
  const imagens = await Promise.all(fotos.map(async foto => ({ imagemBase64: await blobParaBase64(foto), mimeType: foto.type || 'image/jpeg' })));
  return chamarApi<ResultadoLeituraIA>('/api/ler-boletim', { method: 'POST', body: JSON.stringify({ imagens }) });
}
