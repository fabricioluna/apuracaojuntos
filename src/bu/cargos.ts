import type { CargoId } from './types';

/** Códigos de cargo do manual do TSE. */
export const CODIGO_CARGO: Record<number, CargoId> = {
  1: 'presidente',
  3: 'governador',
  5: 'senador',
  6: 'federal',
  7: 'estadual',
};

export const NOME_CARGO: Record<CargoId, string> = {
  presidente: 'Presidente',
  governador: 'Governador',
  senador: 'Senador',
  federal: 'Deputado federal',
  estadual: 'Deputado estadual',
};

export const CARGOS_ORDEM: CargoId[] = ['presidente', 'governador', 'senador', 'federal', 'estadual'];
