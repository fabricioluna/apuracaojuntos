import { describe, expect, it } from 'vitest';
import { validarCargosDigitados, type CargoDigitado } from '../../src/domain/validar-digitado';
import { CARGOS_ORDEM } from '../../src/bu/cargos';
import type { CargoId } from '../../src/bu/types';

const completo = (): Record<CargoId, CargoDigitado> => ({
  presidente: { votos: { '10': 3 }, branco: 1, nulo: 0 },
  governador: { votos: { '10': 2 }, branco: 0, nulo: 1 },
  senador: { votos: { '10': 2, '20': 1 }, branco: 0, nulo: 0 },
  federal: { votos: { '1001': 2 }, legenda: { '10': 1 }, branco: 0, nulo: 0 },
  estadual: { votos: { '2001': 1 }, legenda: { '20': 2 }, branco: 1, nulo: 0 },
});

describe('validarCargosDigitados', () => {
  it('aceita os cinco cargos e calcula o total sozinho (candidatos + legenda + brancos + nulos)', () => {
    const r = validarCargosDigitados(completo(), CARGOS_ORDEM);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cargos.federal).toMatchObject({ legendaTotal: 1, nominais: 2, total: 3, origem: 'digitado', tipo: 'proporcional' });
      expect(r.cargos.presidente).toMatchObject({ tipo: 'majoritario', codigo: 1, total: 4 });
    }
  });

  it('campo em branco (0) não bloqueia — o total é só a soma do que foi preenchido', () => {
    const d = completo();
    d.presidente = { votos: {}, branco: 0, nulo: 0 }; // cargo inteiro em branco: conta como zero
    const r = validarCargosDigitados(d, CARGOS_ORDEM);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cargos.presidente).toMatchObject({ total: 0, nominais: 0 });
  });

  it('recusa cargo faltando', () => {
    const d = completo();
    delete (d as any).senador;
    const r = validarCargosDigitados(d, CARGOS_ORDEM);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagens[0]).toContain('Senador');
  });

  it('recusa valor negativo ou fracionado', () => {
    const d = completo();
    d.governador.votos['10'] = -1;
    const r = validarCargosDigitados(d, CARGOS_ORDEM);
    expect(r.ok).toBe(false);
  });

  it('recusa legenda em cargo majoritário', () => {
    const d = completo() as any;
    d.senador.legenda = { '10': 1 };
    const r = validarCargosDigitados(d, CARGOS_ORDEM);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagens[0]).toContain('Senador');
  });

  it('recusa cargo que não é deste turno', () => {
    const r = validarCargosDigitados(completo(), ['presidente']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagens.some(m => m.includes('não é apurado'))).toBe(true);
  });
});
