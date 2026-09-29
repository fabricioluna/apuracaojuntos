import { describe, expect, it } from 'vitest';
import { validarBoletim } from '../../src/domain/validar-boletim';
import { configTeste } from '../helpers/config';
import type { BoletimEntrada } from '../../src/domain/types';

function boletimBase(): BoletimEntrada {
  const cargo = (nominais: Record<string, number>) => ({
    codigo: 1, id: 'presidente' as const, tipo: 'majoritario' as const, votos: nominais, legenda: {},
    branco: 0, nulo: 0, total: Object.values(nominais).reduce((a, b) => a + b, 0), nominais: Object.values(nominais).reduce((a, b) => a + b, 0), legendaTotal: 0, aptos: 10, origem: 'qrcode' as const,
  });
  return {
    zona: 9,
    secao: 16,
    turno: 1,
    cargos: {
      presidente: cargo({ '10': 1 }),
      governador: { ...cargo({ '10': 1 }), id: 'governador', codigo: 3 },
      senador: { ...cargo({ '10': 1 }), id: 'senador', codigo: 5 },
      federal: { ...cargo({ '10': 1 }), id: 'federal', codigo: 6, tipo: 'proporcional' },
      estadual: { ...cargo({ '10': 1 }), id: 'estadual', codigo: 7, tipo: 'proporcional' },
    },
  };
}

describe('validarBoletim', () => {
  it('aceita um boletim completo e válido', () => {
    expect(validarBoletim(boletimBase(), configTeste, false)).toEqual([]);
  });

  it('recusa zona que não existe', () => {
    const e = validarBoletim({ ...boletimBase(), zona: 99 }, configTeste, false);
    expect(e[0]).toMatchObject({ codigo: 'ZONA_INEXISTENTE' });
  });

  it('recusa seção que não existe na zona', () => {
    const e = validarBoletim({ ...boletimBase(), secao: 999 }, configTeste, false);
    expect(e[0]).toMatchObject({ codigo: 'SECAO_INEXISTENTE' });
  });

  it('recusa boletim faltando cargo', () => {
    const b = boletimBase();
    delete b.cargos.senador;
    const e = validarBoletim(b, configTeste, false);
    expect(e[0]).toMatchObject({ codigo: 'CARGO_FALTANDO' });
    expect(e[0]!.mensagem).toContain('Senador');
  });

  it('recusa cargo que não é deste turno', () => {
    const b = boletimBase(); // turno 1 exige os 5; usar turno 2 só exige presidente
    const e = validarBoletim({ ...b, turno: 2 }, configTeste, false);
    expect(e.some(x => x.codigo === 'CARGO_INESPERADO')).toBe(true);
  });

  it('recusa fase simulada fora do ambiente de teste', () => {
    const b = { ...boletimBase(), origemBU: { origem: 'VOTA', fase: 'S' as const, uf: 'AC', municipio: 1392, assinatura: 'nao_verificada' as const, motivoAssinatura: '' } };
    expect(validarBoletim(b, configTeste, false)[0]).toMatchObject({ codigo: 'FASE_NAO_PERMITIDA' });
    expect(validarBoletim(b, configTeste, true)).toEqual([]);
  });

  it('recusa BU de outro município', () => {
    const b = { ...boletimBase(), origemBU: { origem: 'VOTA', fase: 'O' as const, uf: 'SP', municipio: 1, assinatura: 'nao_verificada' as const, motivoAssinatura: '' } };
    expect(validarBoletim(b, configTeste, true)[0]).toMatchObject({ codigo: 'MUNICIPIO_DIFERENTE' });
  });
});
