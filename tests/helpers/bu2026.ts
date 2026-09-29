import { sha512Hex } from '../../src/bu/hash';
import { exemplos2026 } from '../bu/ajuda';

const [q1, q2] = exemplos2026['manual-2026-pequeno']!;
const dadosDe = (q: string) => /^QRBU:\d+:\d+ VRQR:6\.0 (.*) HASH:/.exec(q)![1]!;
export const [dados1Original, dados2Original] = [dadosDe(q1!), dadosDe(q2!)];

/** Refaz a cadeia de hashes para um conteúdo alterado, gerando um BU 6.0 válido (mesma urna ou outra). */
export function fabricarBU(dados1: string, dados2: string): string[] {
  const h1 = sha512Hex(dados1);
  const h2 = sha512Hex(`${dados1} HASH:${h1} ${dados2}`);
  return [`QRBU:1:2 VRQR:6.0 ${dados1} HASH:${h1}`, `QRBU:2:2 VRQR:6.0 ${dados2} HASH:${h2} ASSI:${'AB'.repeat(132)}`];
}

/** O mesmo boletim do manual (zona 9, seção 16), mas com um voto de presidente diferente (presidente
 * está no segundo QR Code: "IDEL:2101 CARG:1 ... 92:1 93:3 ..."). */
export function buComVotoDiferente(): string[] {
  return fabricarBU(dados1Original, dados2Original.replace('92:1 93:3', '92:2 93:2'));
}
