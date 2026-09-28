import { describe, expect, it } from 'vitest';
import { decodificarBU } from '../../src/bu';
import { chaves2018, decodificarOk, exemplos2018 } from './ajuda';

const MAIOR = 's03113-0103100030072'; // 7 QR Codes
const DOIS = 's03113-0139200010477'; // 2 QR Codes
const SA = 's03113-0157000060093'; // Sistema de Apuração
const RED = 's03113-0139200010807'; // Recuperador de Dados

describe('exemplos do TSE de 2018 (VRQR 1.5)', () => {
  it.each(Object.keys(exemplos2018))('decodifica %s com assinatura verificada', nome => {
    const b = decodificarOk(exemplos2018[nome]!);
    expect(b.versao).toBe('1.5');
    expect(b.fase).toBe('S');
    expect(b.uf).toBe('AC');
    expect(b.assinatura).toBe('verificada');
    expect(Object.keys(b.cargos).sort()).toEqual(['estadual', 'federal', 'governador', 'presidente', 'senador']);
  });

  it('lê o boletim de 2 QR Codes e bate com o relatório impresso', () => {
    const b = decodificarOk(exemplos2018[DOIS]!);
    expect(b).toMatchObject({ origem: 'VOTA', turno: 1, municipio: 1392, zona: 1, secao: 477 });
    expect(b.comparecimento).toEqual({ aptos: 325, comparecimento: 6, faltosos: 319 });

    expect(b.cargos.presidente).toMatchObject({ votos: { '10': 1, '13': 1, '14': 1 }, branco: 1, nulo: 2, total: 6, legenda: {} });
    expect(b.cargos.governador).toMatchObject({ votos: { '10': 1, '13': 1 }, branco: 1, nulo: 3, total: 6 });

    // Senador: duas vagas, então o total conta votos (6 eleitores, 12 votos)
    expect(b.cargos.senador).toMatchObject({ votos: { '130': 1, '140': 2 }, branco: 2, nulo: 7, total: 12, nominais: 3 });

    // Deputados: votos de legenda entram no total
    expect(b.cargos.federal).toMatchObject({
      tipo: 'proporcional',
      votos: { '1001': 2 },
      legenda: { '10': 1, '20': 1 },
      legendaTotal: 2,
      branco: 1,
      nulo: 1,
      total: 6,
    });
    expect(b.cargos.estadual).toMatchObject({
      votos: { '10001': 2, '13001': 1 },
      legenda: { '17': 1, '20': 1 },
      legendaTotal: 2,
      branco: 1,
      nulo: 0,
      total: 6,
    });
  });

  it('lê o boletim do Sistema de Apuração, que não traz comparecimento', () => {
    const b = decodificarOk(exemplos2018[SA]!);
    expect(b).toMatchObject({ origem: 'SA', zona: 6, secao: 93, municipio: 1570 });
    expect(b.comparecimento).toBeUndefined();
    expect(b.cargos.federal).toMatchObject({ votos: {}, legenda: { '17': 1 }, branco: 1, total: 2 });
    expect(b.cargos.senador).toMatchObject({ votos: { '100': 1 }, branco: 2, nulo: 1, total: 4 });
  });

  it('lê o boletim do Recuperador de Dados', () => {
    expect(decodificarOk(exemplos2018[RED]!).origem).toBe('RED');
  });

  it('em todos os exemplos, a soma de candidatos, legenda, brancos e nulos é igual ao total', () => {
    for (const partes of Object.values(exemplos2018)) {
      for (const c of Object.values(decodificarOk(partes).cargos)) {
        const votos = Object.values(c!.votos).reduce((a, b) => a + b, 0);
        expect(votos + c!.legendaTotal + c!.branco + c!.nulo).toBe(c!.total);
      }
    }
  });

  it('junta um boletim de 7 QR Codes', () => {
    const b = decodificarOk(exemplos2018[MAIOR]!);
    expect(exemplos2018[MAIOR]).toHaveLength(7);
    expect(b.comparecimento?.aptos).toBeGreaterThan(0);
    expect(Object.keys(b.cargos.federal!.votos).length).toBeGreaterThan(10);
  });

  it('aceita os QR Codes em qualquer ordem e com repetições', () => {
    const partes = exemplos2018[MAIOR]!;
    const embaralhado = [partes[3]!, partes[0]!, partes[6]!, partes[3]!, partes[1]!, partes[5]!, partes[2]!, partes[4]!];
    expect(decodificarOk(embaralhado)).toEqual(decodificarOk(partes));
  });
});

describe('recusas', () => {
  const erros = (partes: string[]) => {
    const r = decodificarBU(partes, { chaves: chaves2018 });
    if (r.ok) throw new Error('Esperava recusa');
    return r.erros;
  };

  it('nenhum QR Code', () => {
    expect(erros([])[0]?.codigo).toBe('NENHUM_QR');
  });

  it('QR Code que não é de boletim', () => {
    expect(erros(['https://exemplo.com'])[0]?.codigo).toBe('QR_ILEGIVEL');
  });

  it('QR Code faltando, dizendo qual', () => {
    const e = erros(exemplos2018[MAIOR]!.filter((_, i) => i !== 2 && i !== 4));
    expect(e[0]).toMatchObject({ codigo: 'QR_FALTANDO', partes: [3, 5] });
    expect(e[0]!.mensagem).toContain('3 e 5 de 7');
  });

  it('só o primeiro de dois QR Codes', () => {
    const e = erros([exemplos2018[DOIS]![0]!]);
    expect(e[0]).toMatchObject({ codigo: 'QR_FALTANDO', partes: [2] });
  });

  // QR Code do primeiro QR Code de outro boletim, renumerado como se fosse o 2 de 7 do boletim MAIOR
  const intruso = () => exemplos2018[DOIS]![0]!.replace('QRBU:1:2', 'QRBU:2:7');

  it('QR Code de outra urna no lugar de um da sequência (a cadeia de hashes não fecha)', () => {
    const a = exemplos2018[MAIOR]!;
    const e = erros([a[0]!, intruso(), ...a.slice(2)]);
    expect(e[0]).toMatchObject({ codigo: 'CADEIA_QUEBRADA', partes: [2] });
    expect(e[0]!.mensagem).toContain('outra urna');
  });

  it('QR Code de outra urna com o mesmo número de um já lido', () => {
    const e = erros([...exemplos2018[MAIOR]!, intruso()]);
    expect(e[0]).toMatchObject({ codigo: 'QR_REPETIDO_DIFERENTE', partes: [2] });
  });

  it('voto alterado num QR Code (hash não confere)', () => {
    const [p1, p2] = exemplos2018[DOIS]!;
    const e = erros([p1!.replace('NULO:1 TOTC:6', 'NULO:2 TOTC:7'), p2!]);
    expect(e[0]).toMatchObject({ codigo: 'CADEIA_QUEBRADA', partes: [1] });
  });

  it('assinatura alterada', () => {
    const [p1, p2] = exemplos2018[DOIS]!;
    const trocada = p2!.replace(/ASSI:([0-9A-F])/, (_, c: string) => `ASSI:${c === '0' ? '1' : '0'}`);
    expect(erros([p1!, trocada])[0]?.codigo).toBe('ASSINATURA_INVALIDA');
  });

  it('último QR Code sem assinatura', () => {
    const [p1, p2] = exemplos2018[DOIS]!;
    expect(erros([p1!, p2!.replace(/ ASSI:[0-9A-F]+$/, '')])[0]?.codigo).toBe('ASSINATURA_AUSENTE');
  });

  it('versão de formato desconhecida', () => {
    const e = erros([exemplos2018[SA]![0]!.replace('VRQR:1.5', 'VRQR:9.9')]);
    expect(e[0]?.codigo).toBe('VERSAO_NAO_SUPORTADA');
    expect(e[0]!.mensagem).toContain('9.9');
  });

  it('formatos misturados', () => {
    const e = erros([exemplos2018[DOIS]![0]!, exemplos2018[DOIS]![1]!.replace('VRQR:1.5', 'VRQR:6.0')]);
    expect(e[0]?.codigo).toBe('VERSOES_DIFERENTES');
  });
});

describe('assinatura', () => {
  it('sem provedor de chaves, registra como não verificada e não bloqueia', () => {
    const r = decodificarBU(exemplos2018[DOIS]!);
    expect(r.ok && r.boletim.assinatura).toBe('nao_verificada');
  });

  it('chave que não confere com a lista de hashes não é usada', () => {
    const r = decodificarBU(exemplos2018[DOIS]!, { chaves: () => undefined });
    expect(r.ok && r.boletim.assinatura).toBe('nao_verificada');
    expect(r.ok && r.boletim.motivoAssinatura).toContain('não disponível');
  });
});
