import { describe, expect, it } from 'vitest';
import { enviosPorFaixa, enviosPorFiscal } from '../../src/domain/estatisticas';

describe('enviosPorFaixa', () => {
  it('vazio sem boletins', () => {
    expect(enviosPorFaixa([])).toEqual([]);
  });

  it('agrupa em faixas de 30 minutos', () => {
    const passo = 30 * 60_000;
    const base = 1_700_000_000_000;
    const boletins = [
      { fiscalNome: 'a', enviadoEm: base },
      { fiscalNome: 'b', enviadoEm: base + 5 * 60_000 }, // mesma faixa
      { fiscalNome: 'c', enviadoEm: base + passo }, // faixa seguinte
    ];
    const r = enviosPorFaixa(boletins, passo);
    expect(r.length).toBe(2);
    expect(r[0]!.quantidade).toBe(2);
    expect(r[1]!.quantidade).toBe(1);
  });

  it('nunca mostra mais que 10 faixas', () => {
    const passo = 30 * 60_000;
    const boletins = Array.from({ length: 20 }, (_, i) => ({ fiscalNome: 'a', enviadoEm: i * passo }));
    expect(enviosPorFaixa(boletins, passo).length).toBeLessThanOrEqual(10);
  });
});

describe('enviosPorFiscal', () => {
  it('conta por fiscal e guarda o envio mais recente', () => {
    const r = enviosPorFiscal([
      { fiscalNome: 'Ana', enviadoEm: 100 },
      { fiscalNome: 'Ana', enviadoEm: 300 },
      { fiscalNome: 'Bruno', enviadoEm: 200 },
    ]);
    expect(r).toEqual([
      { fiscal: 'Ana', quantidade: 2, ultimoEnvio: 300 },
      { fiscal: 'Bruno', quantidade: 1, ultimoEnvio: 200 },
    ]);
  });
});
