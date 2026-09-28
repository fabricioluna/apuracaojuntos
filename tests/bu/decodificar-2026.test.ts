import { describe, expect, it } from 'vitest';
import { decodificarBU, lerParte } from '../../src/bu';
import { chaves2018, decodificarOk, exemplos2026 } from './ajuda';

const [p1, p2] = exemplos2026['manual-2026-pequeno']!;

describe('exemplo pequeno do manual do TSE de 2026 (VRQR 6.0)', () => {
  const b = decodificarOk([p1!, p2!]);

  it('lê a identificação da urna', () => {
    expect(b).toMatchObject({
      versao: '6.0',
      origem: 'VOTA',
      fase: 'S',
      turno: 1,
      uf: 'AC',
      municipio: 1392,
      zona: 9,
      secao: 16,
      secoesAgregadas: [17, 18, 19],
      idUrna: '2250280',
    });
    expect(b.comparecimento).toEqual({ aptos: 50, comparecimento: 4, faltosos: 46 });
  });

  it('lê os cinco cargos, com legenda nos deputados', () => {
    expect(b.cargos.presidente).toMatchObject({ votos: { '92': 1, '93': 3 }, branco: 0, nulo: 0, total: 4 });
    expect(b.cargos.governador).toMatchObject({ votos: { '92': 2, '95': 1 }, branco: 1, nulo: 0, total: 4 });
    expect(b.cargos.federal).toMatchObject({ votos: { '9501': 1, '9502': 1 }, legenda: { '92': 1 }, legendaTotal: 1, branco: 1, total: 4 });
    expect(b.cargos.estadual).toMatchObject({ votos: { '93002': 1, '93003': 1 }, legenda: { '93': 1 }, nulo: 1, total: 4 });
  });

  it('senador (duas vagas): o total conta votos, não eleitores', () => {
    expect(b.cargos.senador).toMatchObject({ votos: { '921': 1, '931': 1, '941': 1, '951': 2 }, nominais: 5, branco: 1, nulo: 2, total: 8 });
    expect(b.comparecimento?.comparecimento).toBe(4); // 4 eleitores, 8 votos
  });

  it('não verifica a assinatura de 2026, mas registra o motivo e não bloqueia', () => {
    expect(b.assinatura).toBe('nao_verificada');
    expect(b.motivoAssinatura).toContain('6.0');
  });

  it('não usa as chaves de 2018 para o formato 6.0', () => {
    const r = decodificarBU([p1!, p2!], { chaves: chaves2018 });
    expect(r.ok && r.boletim.assinatura).toBe('nao_verificada');
  });
});

describe('recusas no formato 6.0', () => {
  it('faltando o segundo QR Code', () => {
    const r = decodificarBU([p1!]);
    expect(!r.ok && r.erros[0]).toMatchObject({ codigo: 'QR_FALTANDO', partes: [2] });
  });

  it('voto alterado', () => {
    const r = decodificarBU([p1!.replace('APTA:50 APTS:50 APTT:0 NOMI:2 LEGC:1', 'APTA:50 APTS:50 APTT:0 NOMI:3 LEGC:1'), p2!]);
    expect(!r.ok && r.erros[0]?.codigo).toBe('CADEIA_QUEBRADA');
  });

  it('versão 6.1 ainda não é conhecida', () => {
    const r = decodificarBU([p1!.replace('VRQR:6.0', 'VRQR:6.1'), p2!]);
    expect(!r.ok && r.erros[0]?.codigo).toBe('VERSAO_NAO_SUPORTADA');
  });
});

describe('QR Codes do certificado da urna (sequência própria)', () => {
  // Textos sintéticos, montados a partir da tabela do manual (QRCE, IDUE, MDUE, CERT). Não são de urna real.
  const cert = (idue: string) => [`QRCE:1:2 IDUE:${idue} MDUE:2020 CERT:3082AABB`, `QRCE:2:2 IDUE:${idue} MDUE:2020 CERT:CCDD`];

  it('reconhece o QR Code do certificado', () => {
    expect(lerParte(cert('2250280')[0]!)).toMatchObject({ tipo: 'certificado', indice: 1, total: 2, idUrna: '2250280', certHex: '3082AABB' });
  });

  it('aceita o certificado junto com os QR Codes de dados, sem contar na sequência', () => {
    const r = decodificarBU([p1!, ...cert('2250280'), p2!]);
    expect(r.ok && r.boletim.motivoAssinatura).toContain('certificado');
  });

  it('recusa o certificado de outra urna', () => {
    const r = decodificarBU([p1!, p2!, ...cert('9999999')]);
    expect(!r.ok && r.erros[0]?.codigo).toBe('CERTIFICADO_OUTRA_URNA');
  });

  it('só o certificado não basta', () => {
    const r = decodificarBU(cert('2250280'));
    expect(!r.ok && r.erros[0]?.codigo).toBe('QR_FALTANDO');
  });
});
