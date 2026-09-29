import { describe, expect, it } from 'vitest';
import { chaveUrna, compararBoletins, impressaoDigital } from '../../src/domain/comparar';
import type { BoletimGravado } from '../../src/domain/types';

function boletim(votosPresidente: Record<string, number>): BoletimGravado {
  return {
    id: chaveUrna(9, 16, 1),
    zona: 9,
    secao: 16,
    turno: 1,
    fiscalId: 'f1',
    fiscalNome: 'Fiscal Um',
    enviadoEm: 1000,
    cargos: {
      presidente: { codigo: 1, id: 'presidente', tipo: 'majoritario', votos: votosPresidente, legenda: {}, branco: 1, nulo: 0, total: Object.values(votosPresidente).reduce((a, b) => a + b, 0) + 1, nominais: Object.values(votosPresidente).reduce((a, b) => a + b, 0), legendaTotal: 0, aptos: 10, origem: 'qrcode' },
    },
  };
}

describe('chaveUrna', () => {
  it('monta zona-secao-turno', () => expect(chaveUrna(9, 16, 1)).toBe('9-16-1'));
});

describe('compararBoletins', () => {
  it('nenhuma diferença quando os votos são iguais, mesmo com fiscal/hora diferentes', () => {
    const a = boletim({ '10': 3 }), b = { ...boletim({ '10': 3 }), fiscalNome: 'Outro', enviadoEm: 9999 };
    expect(compararBoletins(a, b)).toEqual([]);
  });

  it('aponta a diferença de um candidato (e do total, que muda junto)', () => {
    const diffs = compararBoletins(boletim({ '10': 3 }), boletim({ '10': 5 }));
    expect(diffs).toEqual([
      { cargo: 'presidente', campo: 'Candidato 10', atual: 3, novo: 5 },
      { cargo: 'presidente', campo: 'Total apurado', atual: 4, novo: 6 },
    ]);
  });

  it('cargo ausente em um dos boletins', () => {
    const a = boletim({ '10': 3 }), b: BoletimGravado = { ...a, cargos: {} };
    const diffs = compararBoletins(a, b);
    expect(diffs).toEqual([{ cargo: 'presidente', campo: 'Cargo', atual: 'lido', novo: 'ausente' }]);
  });
});

describe('impressaoDigital', () => {
  it('é igual para boletins com os mesmos votos', () => {
    expect(impressaoDigital(boletim({ '10': 3 }))).toBe(impressaoDigital({ ...boletim({ '10': 3 }), fiscalNome: 'Outro' }));
  });

  it('muda quando um voto muda', () => {
    expect(impressaoDigital(boletim({ '10': 3 }))).not.toBe(impressaoDigital(boletim({ '10': 4 })));
  });
});
