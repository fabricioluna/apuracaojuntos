import { beforeEach, describe, expect, it } from 'vitest';
import { GET as GET_boletim } from '../../app/api/admin/boletins/[id]/route';
import { GET as GET_boletins } from '../../app/api/admin/boletins/route';
import { PATCH as PATCH_config } from '../../app/api/admin/config/route';
import { GET as GET_divergencias } from '../../app/api/admin/divergencias/route';
import { DELETE as DELETE_fiscal, PATCH as PATCH_fiscal } from '../../app/api/admin/fiscais/[id]/route';
import { GET as GET_fiscais, POST as POST_fiscal } from '../../app/api/admin/fiscais/route';
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

function req(url: string, token?: string, init: RequestInit = {}) {
  return new Request(url, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
}

describe('rotas /api/admin/*: recusam quem não é administrador', () => {
  it('boletins', async () => {
    const { idToken } = await loginComoFiscal('Fiscal Comum');
    expect((await GET_boletins(req('http://local/api/admin/boletins?turno=1', idToken))).status).toBe(403);
  });
  it('divergencias', async () => {
    const { idToken } = await loginComoFiscal('Fiscal Comum');
    expect((await GET_divergencias(req('http://local/api/admin/divergencias', idToken))).status).toBe(403);
  });
  it('fiscais', async () => {
    const { idToken } = await loginComoFiscal('Fiscal Comum');
    expect((await GET_fiscais(req('http://local/api/admin/fiscais', idToken))).status).toBe(403);
  });
  it('sem login nenhuma rota funciona', async () => {
    expect((await GET_boletins(req('http://local/api/admin/boletins?turno=1'))).status).toBe(401);
  });
});

describe('GET /api/admin/boletins e /api/admin/boletins/[id]', () => {
  it('lista e detalha um boletim gravado', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), { uid: 'f1', nome: 'Fiscal Um' });
    const { idToken } = await loginComoFiscal('Administradora', { admin: true });

    const rLista = await GET_boletins(req('http://local/api/admin/boletins?turno=1', idToken));
    expect(rLista.status).toBe(200);
    const { boletins } = await rLista.json();
    expect(boletins).toHaveLength(1);
    expect(boletins[0]).toMatchObject({ zona: 9, secao: 16, fiscalNome: 'Fiscal Um', origem: 'QR Code', divergenciaPendente: false });

    const rDetalhe = await GET_boletim(req(`http://local/api/admin/boletins/${boletins[0].id}`, idToken), { params: Promise.resolve({ id: boletins[0].id }) });
    expect(rDetalhe.status).toBe(200);
    const { boletim } = await rDetalhe.json();
    expect(boletim.cargos.presidente.votos).toEqual({ '92': 1, '93': 3 });
  });

  it('404 para boletim inexistente', async () => {
    const { idToken } = await loginComoFiscal('Administradora', { admin: true });
    const r = await GET_boletim(req('http://local/api/admin/boletins/nada', idToken), { params: Promise.resolve({ id: 'nada' }) });
    expect(r.status).toBe(404);
  });

  it('sinaliza divergenciaPendente e some quando resolvida', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), { uid: 'f1', nome: 'Fiscal Um' });
    await gravarBoletim(entradaDeQR(buComVotoDiferente()), { uid: 'f2', nome: 'Fiscal Dois' });
    const { idToken } = await loginComoFiscal('Administradora', { admin: true });

    const antes = await (await GET_boletins(req('http://local/api/admin/boletins?turno=1', idToken))).json();
    expect(antes.boletins[0]).toMatchObject({ id: '9-16-1', divergenciaPendente: true });

    const divId = (await db().collection('divergencias').where('key', '==', '9-16-1').get()).docs[0]!.id;
    const { resolverDivergencia } = await import('../../src/server/resolver-divergencia');
    await resolverDivergencia(divId, 'manter', { uid: 'a', nome: 'Admin' });

    const depois = await (await GET_boletins(req('http://local/api/admin/boletins?turno=1', idToken))).json();
    expect(depois.boletins[0]).toMatchObject({ id: '9-16-1', divergenciaPendente: false });
  });
});

describe('GET /api/admin/divergencias', () => {
  it('lista pendentes com o cadastro atual', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), { uid: 'f1', nome: 'Fiscal Um' });
    await gravarBoletim(entradaDeQR(buComVotoDiferente()), { uid: 'f2', nome: 'Fiscal Dois' });
    const { idToken } = await loginComoFiscal('Administradora', { admin: true });

    const r = await GET_divergencias(req('http://local/api/admin/divergencias', idToken));
    expect(r.status).toBe(200);
    const { pendentes, resolvidas } = await r.json();
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].atual.cargos.presidente.votos).toEqual({ '92': 1, '93': 3 });
    expect(resolvidas).toEqual([]);
  });
});

describe('fiscais: GET/POST/PATCH', () => {
  it('cadastra, lista e desativa', async () => {
    const { idToken } = await loginComoFiscal('Administradora', { admin: true });

    const rPost = await POST_fiscal(req('http://local/api/admin/fiscais', idToken, { method: 'POST', body: JSON.stringify({ nome: 'Novo Fiscal' }) }));
    expect(rPost.status).toBe(200);
    const { id, codigo } = await rPost.json();
    expect(codigo).toMatch(/^\d{6}$/);

    const rLista = await GET_fiscais(req('http://local/api/admin/fiscais', idToken));
    const { fiscais } = await rLista.json();
    expect(fiscais.some((f: { nome: string; ativo: boolean }) => f.nome === 'Novo Fiscal' && f.ativo)).toBe(true);

    const rPatch = await PATCH_fiscal(req(`http://local/api/admin/fiscais/${id}`, idToken, { method: 'PATCH', body: JSON.stringify({ ativo: false }) }), {
      params: Promise.resolve({ id }),
    });
    expect(rPatch.status).toBe(200);
    const doc = await db().collection('fiscais').doc(id).get();
    expect(doc.data()!.ativo).toBe(false);
  });

  it('recusa nome curto demais', async () => {
    const { idToken } = await loginComoFiscal('Administradora', { admin: true });
    const r = await POST_fiscal(req('http://local/api/admin/fiscais', idToken, { method: 'POST', body: JSON.stringify({ nome: 'Zé' }) }));
    expect(r.status).toBe(400);
  });

  it('admin exclui um fiscal de vez', async () => {
    const { idToken } = await loginComoFiscal('Administradora', { admin: true });
    const { uid } = await loginComoFiscal('Fiscal Pra Excluir');

    const r = await DELETE_fiscal(req(`http://local/api/admin/fiscais/${uid}`, idToken, { method: 'DELETE' }), { params: Promise.resolve({ id: uid }) });
    expect(r.status).toBe(200);
    const doc = await db().collection('fiscais').doc(uid).get();
    expect(doc.exists).toBe(false);
  });

  it('admin não consegue excluir o próprio cadastro', async () => {
    const { idToken, uid } = await loginComoFiscal('Administradora', { admin: true });
    const r = await DELETE_fiscal(req(`http://local/api/admin/fiscais/${uid}`, idToken, { method: 'DELETE' }), { params: Promise.resolve({ id: uid }) });
    expect(r.status).toBe(400);
    const doc = await db().collection('fiscais').doc(uid).get();
    expect(doc.exists).toBe(true);
  });

  it('fiscal comum não consegue excluir ninguém', async () => {
    const { idToken } = await loginComoFiscal('Fiscal Comum');
    const { uid } = await loginComoFiscal('Outro Fiscal');
    const r = await DELETE_fiscal(req(`http://local/api/admin/fiscais/${uid}`, idToken, { method: 'DELETE' }), { params: Promise.resolve({ id: uid }) });
    expect(r.status).toBe(403);
  });
});

describe('PATCH /api/admin/config', () => {
  it('atualiza o turno', async () => {
    const { idToken } = await loginComoFiscal('Administradora', { admin: true });
    const r = await PATCH_config(req('http://local/api/admin/config', idToken, { method: 'PATCH', body: JSON.stringify({ turno: 2 }) }));
    expect(r.status).toBe(200);
    const doc = await db().collection('config').doc('publico').get();
    expect(doc.data()!.turno).toBe(2);
  });

  it('recusa zonas mal formadas', async () => {
    const { idToken } = await loginComoFiscal('Administradora', { admin: true });
    const r = await PATCH_config(req('http://local/api/admin/config', idToken, { method: 'PATCH', body: JSON.stringify({ zonas: [{ zona: 1, secoes: [] }] }) }));
    expect(r.status).toBe(422);
  });

  it('fiscal comum não consegue alterar', async () => {
    const { idToken } = await loginComoFiscal('Fiscal Comum');
    const r = await PATCH_config(req('http://local/api/admin/config', idToken, { method: 'PATCH', body: JSON.stringify({ turno: 2 }) }));
    expect(r.status).toBe(403);
  });
});
