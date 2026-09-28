import { ed25519 } from '@noble/curves/ed25519.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { hexParaBytes } from './hash';
import type { Fase, ProvedorChave } from './types';

/**
 * Verifica a assinatura Ed25519 de um BU no formato 1.5. A mensagem assinada são os bytes do último hash
 * (manual do TSE 2018, seção "Assinatura digital").
 */
export function verificarEd25519(chave: Uint8Array, hashHex: string, assinaturaHex: string): boolean {
  try {
    return ed25519.verify(hexParaBytes(assinaturaHex), hexParaBytes(hashHex), chave);
  } catch {
    return false;
  }
}

/**
 * Confere se o arquivo da chave pública é o que o TSE publicou, comparando o SHA-512 com a lista oficial
 * (linhas "hash  nome-do-arquivo").
 */
export function chaveConfereComLista(chave: Uint8Array, nomeArquivo: string, listaHashes: string): boolean {
  const hash = bytesToHex(sha512(chave)).toLowerCase();
  return listaHashes
    .split(/\r?\n/)
    .some(linha => {
      const [h, nome] = linha.trim().split(/\s+\*?/);
      return h?.toLowerCase() === hash && nome === nomeArquivo;
    });
}

/** Nome do arquivo de chave no padrão do TSE: [o|s] + UF minúscula + "qrcode.pub". */
export function nomeArquivoChave(fase: Fase, uf: string): string | undefined {
  if (fase === 'T') return undefined; // o manual só define chaves para dados oficiais e simulados
  return `${fase === 'O' ? 'o' : 's'}${uf.toLowerCase()}qrcode.pub`;
}

/**
 * Cria um provedor de chaves a partir de arquivos já carregados e de uma lista de hashes do TSE.
 * Só entrega uma chave cujo SHA-512 esteja na lista.
 */
export function criarProvedorChaves(arquivos: Record<string, Uint8Array>, listaHashes: string): ProvedorChave {
  return ({ fase, uf }) => {
    const nome = nomeArquivoChave(fase, uf);
    const chave = nome ? arquivos[nome] : undefined;
    return chave && nome && chaveConfereComLista(chave, nome, listaHashes) ? chave : undefined;
  };
}
