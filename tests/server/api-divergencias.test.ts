import { beforeEach, describe, expect, it } from 'vitest';
import { PATCH } from '../../app/api/divergencias/[id]/route';
import { decodificarBU } from '../../src/bu';
import { CARGOS_ORDEM } from '../../src/bu/cargos';
import type { CargoId } from '../../src/bu/types';
import type { BoletimEntrada, CargoEntrada } from '../../src/domain/types';
import { db } from '../../src/server/firebase-admin';
import { gravarBoletim } from '../../src/server/gravar-boletim';
import { buComVotoDiferente, dados1Original, dados2Original, fabricarBU } from '../helpers/bu2026';
import { seedConfig } from '../helpers/config';
import { limparEmulador, loginComoFiscal } from '../helpers/emulador';

beforeEach(async () => {
  await limparEmulador();
  await seedConfig();
});

function entradaDeQR(partes: string[]): BoletimEntrada {
  const r = decodificarBU(partes);
  if (!r.ok) throw new Error('esperava decodificar');
  const cargos: Partial<Record<CargoId, CargoEntrada>> = {};
  for (const id of CARGOS_ORDEM) {
    const c = r.boletim.cargos[id];
    if (c) cargos[id] = { ...c, origem: 'qrcode' };
  }
  return { zona: r.boletim.zona, secao: r.boletim.secao, turno: r.boletim.turno, cargos };
}

async function criarUrnaComDivergencia() {
  await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), { uid: 'f1', nome: 'Fiscal Um' });
  await gravarBoletim(entradaDeQR(buComVotoDiferente()), { uid: 'f2', nome: 'Fiscal Dois' });
  return (await db().collection('divergencias').where('key', '==', '9-16-1').get()).docs[0]!.id;
}

function patch(id: string, decisao: unknown, token?: string) {
  const req = new Request(`http://local/api/divergencias/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ decisao }),
  });
  return PATCH(req, { params: Promise.resolve({ id }) });
}

describe('PATCH /api/divergencias/[id]', () => {
  it('recusa sem login', async () => {
    const id = await criarUrnaComDivergencia();
    expect((await patch(id, 'manter')).status).toBe(401);
  });

  it('recusa fiscal que não é administrador', async () => {
    const id = await criarUrnaComDivergencia();
    const { idToken } = await loginComoFiscal('Fiscal Comum', { admin: false });
    expect((await patch(id, 'manter', idToken)).status).toBe(403);
  });

  it('administrador resolve mantendo o cadastro atual', async () => {
    const id = await criarUrnaComDivergencia();
    const { idToken } = await loginComoFiscal('Administradora', { admin: true });
    const r = await patch(id, 'manter', idToken);
    expect(r.status).toBe(200);
    expect((await db().collection('divergencias').doc(id).get()).data()!.status).toBe('resolvida');
  });

  it('administrador resolve usando o novo envio', async () => {
    const id = await criarUrnaComDivergencia();
    const { idToken } = await loginComoFiscal('Administradora', { admin: true });
    const r = await patch(id, 'novo', idToken);
    expect(r.status).toBe(200);
    const boletim = await db().collection('boletins').doc('9-16-1').get();
    expect(boletim.data()!.cargos.presidente.votos).toEqual({ '92': 2, '93': 2 });
  });

  it('recusa decisão inválida', async () => {
    const id = await criarUrnaComDivergencia();
    const { idToken } = await loginComoFiscal('Administradora', { admin: true });
    expect((await patch(id, 'apagar', idToken)).status).toBe(400);
  });
});
