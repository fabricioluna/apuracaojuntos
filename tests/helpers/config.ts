import { db } from '../../src/server/firebase-admin';
import type { ConfigCidade } from '../../src/domain/types';

/** Configuração compatível com o exemplo do manual 2026 (UF AC, município 1392, zona 9, seção 16). */
export const configTeste: ConfigCidade = {
  uf: 'AC',
  municipio: 1392,
  nomeMunicipio: 'Rio Branco (config de teste)',
  turno: 1,
  zonas: [{ zona: 9, secoes: [{ secao: 16, aptos: 50 }, { secao: 17, aptos: 40 }] }],
  cargosPorTurno: {
    1: ['presidente', 'governador', 'senador', 'federal', 'estadual'],
    2: ['presidente'],
  },
};

export async function seedConfig(config: ConfigCidade = configTeste): Promise<void> {
  await db().collection('config').doc('publico').set(config);
}
