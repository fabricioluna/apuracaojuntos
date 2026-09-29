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

/** Inverso de CODIGO_CARGO, para montar um cargo digitado sem QR Code. */
export const CARGO_CODIGO: Record<CargoId, number> = { presidente: 1, governador: 3, senador: 5, federal: 6, estadual: 7 };

export const TIPO_CARGO: Record<CargoId, 'majoritario' | 'proporcional'> = {
  presidente: 'majoritario',
  governador: 'majoritario',
  senador: 'majoritario',
  federal: 'proporcional',
  estadual: 'proporcional',
};
