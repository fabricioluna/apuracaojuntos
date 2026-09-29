import { db } from '../firebase-admin';
import type { ConfigCidade, ZonaConfig } from '../../domain/types';

/** Atualiza zonas e/ou turno da configuração pública. Mantém os campos não enviados como estão. */
export async function atualizarConfig(mudanca: { zonas?: ZonaConfig[]; turno?: 1 | 2 }): Promise<ConfigCidade> {
  const ref = db().collection('config').doc('publico');
  await ref.set(mudanca, { merge: true });
  const doc = await ref.get();
  return doc.data() as ConfigCidade;
}
