import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../app/api/boletins/route';
import { db } from '../../src/server/firebase-admin';
import { seedConfig } from '../helpers/config';
import { limparEmulador, loginComoFiscal } from '../helpers/emulador';
import { dados1Original, dados2Original, fabricarBU } from '../helpers/bu2026';

beforeEach(async () => {
  await limparEmulador();
  await seedConfig();
  process.env.PERMITIR_BU_TESTE = 'true'; // o exemplo do manual é FASE:S (simulado)
});

function req(body: unknown, token?: string) {
  return new Request('http://local/api/boletins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

describe('POST /api/boletins', () => {
  it('recusa sem login', async () => {
    const r = await POST(req({ partes: fabricarBU(dados1Original, dados2Original) }));
    expect(r.status).toBe(401);
  });

  it('recusa fiscal desativado depois do login (checagem ao vivo, não só a claim do token)', async () => {
    const { idToken, uid } = await loginComoFiscal('Fiscal Depois Desativado');
    await db().collection('fiscais').doc(uid).update({ ativo: false });
    const r = await POST(req({ partes: fabricarBU(dados1Original, dados2Original) }, idToken));
    expect(r.status).toBe(403);
  });

  it('grava um boletim por QR Code e devolve status novo', async () => {
    const { idToken } = await loginComoFiscal('Fiscal Um');
    const r = await POST(req({ partes: fabricarBU(dados1Original, dados2Original) }, idToken));
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo).toEqual({ resultado: { status: 'novo' } });

    const boletim = await db().collection('boletins').doc('9-16-1').get();
    expect(boletim.exists).toBe(true);
  });

  it('recusa zona/seção que não existe na cidade, com erro 422', async () => {
    const { idToken } = await loginComoFiscal('Fiscal Um');
    const foraDaCidade = fabricarBU(dados1Original.replace('ZONA:9 SECA:16', 'ZONA:40 SECA:1'), dados2Original);
    const r = await POST(req({ partes: foraDaCidade }, idToken));
    expect(r.status).toBe(422);
    const corpo = await r.json();
    expect(corpo.erro).toContain('40');
  });

  it('recusa boletim oficial de fase simulada quando o teste não é permitido', async () => {
    process.env.PERMITIR_BU_TESTE = 'false';
    const { idToken } = await loginComoFiscal('Fiscal Um');
    const r = await POST(req({ partes: fabricarBU(dados1Original, dados2Original) }, idToken));
    expect(r.status).toBe(422);
    process.env.PERMITIR_BU_TESTE = 'true';
  });

  it('grava um boletim digitado (todos os cinco cargos)', async () => {
    const { idToken } = await loginComoFiscal('Fiscal Digitador');
    const digitado = {
      presidente: { votos: { '10': 3 }, branco: 1, nulo: 0, total: 4 },
      governador: { votos: { '10': 2 }, branco: 0, nulo: 1, total: 3 },
      senador: { votos: { '10': 2, '20': 1 }, branco: 0, nulo: 0, total: 3 },
      federal: { votos: { '1001': 2 }, legenda: { '10': 1 }, branco: 0, nulo: 0, total: 3 },
      estadual: { votos: { '2001': 1 }, legenda: { '20': 2 }, branco: 1, nulo: 0, total: 4 },
    };
    const r = await POST(req({ zona: 9, secao: 17, turno: 1, digitado }, idToken));
    expect(r.status).toBe(200);
    const boletim = await db().collection('boletins').doc('9-17-1').get();
    expect(boletim.data()!.cargos.presidente.origem).toBe('digitado');
  });

  it('recusa boletim digitado incompleto', async () => {
    const { idToken } = await loginComoFiscal('Fiscal Digitador');
    const r = await POST(req({ zona: 9, secao: 17, turno: 1, digitado: { presidente: { votos: { '10': 1 }, branco: 0, nulo: 0, total: 1 } } }, idToken));
    expect(r.status).toBe(422);
  });

  it('grava a referência das fotos quando pertencem ao próprio fiscal', async () => {
    const { idToken, uid } = await loginComoFiscal('Fiscal Com Foto');
    const fotoPaths = [`boletins/${uid}/1234-prova.jpg`, `boletins/${uid}/1234-prova-2.jpg`];
    const r = await POST(req({ partes: fabricarBU(dados1Original, dados2Original), fotoPaths }, idToken));
    expect(r.status).toBe(200);
    const boletim = await db().collection('boletins').doc('9-16-1').get();
    expect(boletim.data()!.fotoPaths).toEqual(fotoPaths);
  });

  it('recusa foto que não pertence ao fiscal autenticado', async () => {
    const { idToken } = await loginComoFiscal('Fiscal Malicioso');
    const r = await POST(req({ partes: fabricarBU(dados1Original, dados2Original), fotoPaths: ['boletins/outra-pessoa/foto.jpg'] }, idToken));
    expect(r.status).toBe(400);
  });
});
