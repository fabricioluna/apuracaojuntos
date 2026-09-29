import { db } from './firebase-admin';
import type { ConfigCidade } from '../domain/types';

let cache: { valor: ConfigCidade; ate: number } | undefined;

/** Lê config/publico do Firestore, com um cache curto por instância (evita 1 leitura por requisição). */
export async function lerConfigCidade(): Promise<ConfigCidade> {
  if (cache && cache.ate > Date.now()) return cache.valor;
  const doc = await db().collection('config').doc('publico').get();
  if (!doc.exists) {
    throw new Error('A configuração da cidade (config/publico) ainda não foi definida. Rode scripts/definir-config.mjs.');
  }
  const valor = doc.data() as ConfigCidade;
  cache = { valor, ate: Date.now() + 30_000 };
  return valor;
}
