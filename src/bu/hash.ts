import { sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import type { ParteDados } from './part';

/** SHA-512 em hexadecimal maiúsculo. O conteúdo do BU só tem caracteres ASCII (modo alfanumérico do QR Code). */
export function sha512Hex(texto: string): string {
  return bytesToHex(sha512(new TextEncoder().encode(texto))).toUpperCase();
}

export function hexParaBytes(hex: string): Uint8Array {
  return hexToBytes(hex);
}

/**
 * Confere a cadeia de hashes conforme o manual: o hash de cada QR Code cobre todo o conteúdo anterior.
 *   hash1 = SHA-512(dados1)
 *   hashN = SHA-512(dados1 + " HASH:" + hash1 + " " + dados2 + ... + " " + dadosN)
 * Recebe as partes já ordenadas de 1 a x. Devolve o índice (1..x) da primeira parte que não confere.
 */
export function conferirCadeia(partes: ParteDados[]): { ok: true } | { ok: false; indice: number } {
  let acumulado = '';
  for (const p of partes) {
    const entrada = acumulado === '' ? p.dados : `${acumulado} ${p.dados}`;
    if (sha512Hex(entrada) !== p.hash) return { ok: false, indice: p.indice };
    acumulado = `${entrada} HASH:${p.hash}`;
  }
  return { ok: true };
}

/** Remonta o conteúdo do BU: os "dados" de cada QR Code unidos pelo espaço retirado na quebra. */
export function remontarConteudo(partes: ParteDados[]): string {
  return partes.map(p => p.dados).join(' ');
}
