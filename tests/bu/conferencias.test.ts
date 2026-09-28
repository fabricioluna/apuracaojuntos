import { describe, expect, it } from 'vitest';
import { decodificarBU } from '../../src/bu';
import { sha512Hex } from '../../src/bu/hash';
import { exemplos2026 } from './ajuda';

// O formato 6.0 não tem assinatura verificada, então dá para refazer a cadeia de hashes de um conteúdo
// adulterado e testar as recusas por conferência de soma, sem que o hash quebre antes.
const [q1, q2] = exemplos2026['manual-2026-pequeno']!;
const dados = (q: string) => /^QRBU:\d+:\d+ VRQR:6\.0 (.*) HASH:/.exec(q)![1]!;
const [d1, d2] = [dados(q1!), dados(q2!)];

function fabricar(a: string, b: string): string[] {
  const h1 = sha512Hex(a), h2 = sha512Hex(`${a} HASH:${h1} ${b}`);
  return [`QRBU:1:2 VRQR:6.0 ${a} HASH:${h1}`, `QRBU:2:2 VRQR:6.0 ${b} HASH:${h2} ASSI:${'AB'.repeat(132)}`];
}

const recusa = (a: string, b: string) => {
  const r = decodificarBU(fabricar(a, b));
  if (r.ok) throw new Error('Esperava recusa');
  return r.erros;
};

describe('conferências que o próprio BU permite', () => {
  it('sem alterações, o BU refeito é aceito (o auxiliar está correto)', () => {
    expect(decodificarBU(fabricar(d1, d2)).ok).toBe(true);
  });

  it('total apurado que não bate com candidatos + legenda + brancos + nulos', () => {
    const e = recusa(d1.replace('LEGC:1 BRAN:1 NULO:0 TOTC:4', 'LEGC:1 BRAN:1 NULO:0 TOTC:5'), d2);
    expect(e[0]).toMatchObject({ codigo: 'TOTAIS_NAO_BATEM' });
    expect(e[0]!.mensagem).toContain('Deputado federal');
    expect(e[0]!.mensagem).toContain('(4)');
    expect(e[0]!.mensagem).toContain('(5)');
  });

  it('voto de legenda esquecido na soma: o total só bate se a legenda entrar', () => {
    // Deputado federal: 2 nominais + 1 legenda + 1 branco = 4. Sem a legenda daria 3.
    const e = recusa(d1.replace('LEGC:1', 'LEGC:0').replace('PART:92 LEGP:1 TOTP:1', 'PART:92 LEGP:0 TOTP:0'), d2);
    expect(e.some(x => x.mensagem.includes('Deputado federal'))).toBe(true);
  });

  it('votos nominais que não batem com a soma dos candidatos', () => {
    const e = recusa(d1.replace('9501:1 9502:1', '9501:1 9502:2'), d2);
    expect(e[0]!.mensagem).toMatch(/Deputado federal.*candidatos \(3\).*nominais.*\(2\)/);
  });

  it('total do partido que não bate', () => {
    const e = recusa(d1.replace('LEGP:0 TOTP:2', 'LEGP:0 TOTP:3'), d2);
    expect(e[0]!.mensagem).toMatch(/partido 95/);
  });

  it('senador: o total é conferido em votos (dois por eleitor), não em eleitores', () => {
    // 4 eleitores compareceram, mas o total do senador é 8 e mesmo assim é aceito
    const r = decodificarBU(fabricar(d1, d2));
    expect(r.ok && r.boletim.comparecimento?.comparecimento).toBe(4);
    expect(r.ok && r.boletim.cargos.senador!.total).toBe(8);
    // com brancos e nulos somando 4 em vez de 3, a soma deixa de bater
    const e = recusa(d1.replace('NOMI:5 BRAN:1 NULO:2 TOTC:8', 'NOMI:5 BRAN:1 NULO:3 TOTC:8'), d2);
    expect(e[0]!.mensagem).toContain('Senador');
  });

  it('campo desconhecido no meio do cargo', () => {
    const e = recusa(d1.replace('NOMI:2 LEGC:1', 'XXXX:9 NOMI:2 LEGC:1'), d2);
    expect(e[0]).toMatchObject({ codigo: 'FORMATO' });
    expect(e[0]!.mensagem).toContain('XXXX');
  });

  it('candidato repetido', () => {
    const e = recusa(d1.replace('9501:1 9502:1', '9501:1 9501:1'), d2);
    expect(e[0]!.mensagem).toContain('9501');
  });

  it('resumo do cargo incompleto (faltam QR Codes ou a leitura falhou)', () => {
    const e = recusa(d1, d2.replace(' BRAN:0 NULO:0 TOTC:4', ''));
    expect(e[0]).toMatchObject({ codigo: 'FORMATO' });
    expect(e[0]!.mensagem).toMatch(/Presidente.*incompleto/);
  });

  it('cargo repetido', () => {
    const e = recusa(d1, `${d2} CARG:1 TIPO:0 VERC:1 92:1 APTA:50 NOMI:1 BRAN:0 NULO:0 TOTC:1`);
    expect(e[0]!.mensagem).toContain('duas vezes');
  });

  it('turno inválido', () => {
    const e = recusa(d1.replace('TURN:1', 'TURN:3'), d2);
    expect(e[0]).toMatchObject({ codigo: 'FORMATO' });
  });

  it('cargos que o app não apura são ignorados, sem falhar', () => {
    const r = decodificarBU(fabricar(d1, `${d2} CARG:11 TIPO:0 VERC:1 12:1 APTA:50 NOMI:1 BRAN:0 NULO:0 TOTC:1`));
    expect(r.ok && r.boletim.cargosIgnorados).toEqual([11]);
  });
});
