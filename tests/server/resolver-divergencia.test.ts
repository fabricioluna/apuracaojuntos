import { beforeEach, describe, expect, it } from 'vitest';
import { decodificarBU } from '../../src/bu';
import { CARGOS_ORDEM } from '../../src/bu/cargos';
import type { CargoId } from '../../src/bu/types';
import type { BoletimEntrada, CargoEntrada } from '../../src/domain/types';
import { db } from '../../src/server/firebase-admin';
import { gravarBoletim } from '../../src/server/gravar-boletim';
import { ErroDivergencia, resolverDivergencia } from '../../src/server/resolver-divergencia';
import { buComVotoDiferente, dados1Original, dados2Original, fabricarBU } from '../helpers/bu2026';
import { limparEmulador } from '../helpers/emulador';

beforeEach(limparEmulador);

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

const fiscal1 = { uid: 'f1', nome: 'Fiscal Um' };
const fiscal2 = { uid: 'f2', nome: 'Fiscal Dois' };
const admin = { uid: 'a1', nome: 'Administradora' };

async function criarUrnaComDivergencia() {
  await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal1);
  await gravarBoletim(entradaDeQR(buComVotoDiferente()), fiscal2);
  const div = (await db().collection('divergencias').where('key', '==', '9-16-1').get()).docs[0]!;
  return div.id;
}

describe('resolverDivergencia: manter', () => {
  it('fecha a divergência sem alterar o boletim nem os totais', async () => {
    const divId = await criarUrnaComDivergencia();
    await resolverDivergencia(divId, 'manter', admin);

    const div = await db().collection('divergencias').doc(divId).get();
    expect(div.data()).toMatchObject({ status: 'resolvida', decisao: 'manter', resolvidaPor: 'Administradora' });

    const boletim = await db().collection('boletins').doc('9-16-1').get();
    expect(boletim.data()!.cargos.presidente.votos).toEqual({ '92': 1, '93': 3 });

    const totais = await db().collection('totais').doc('1_presidente').get();
    expect(totais.data()!.votos).toEqual({ '92': 1, '93': 3 });

    const mapa = await db().collection('mapa').doc('1').get();
    expect(mapa.data()!.secoes).toMatchObject({ '9-16': 'ok' });
  });
});

describe('resolverDivergencia: usar o novo', () => {
  it('substitui o boletim, recalcula os totais e guarda o cadastro anterior', async () => {
    const divId = await criarUrnaComDivergencia();
    await resolverDivergencia(divId, 'novo', admin);

    const boletim = await db().collection('boletins').doc('9-16-1').get();
    expect(boletim.data()).toMatchObject({ cargos: { presidente: { votos: { '92': 2, '93': 2 } } }, corrigidoPor: 'Administradora', fiscalAnteriorId: 'f1' });

    const totais = await db().collection('totais').doc('1_presidente').get();
    expect(totais.data()).toMatchObject({ votos: { '92': 2, '93': 2 }, urnas: 1 }); // subtraiu o antigo, somou o novo

    const versoes = await db().collection('boletins').doc('9-16-1').collection('versoes').get();
    expect(versoes.size).toBe(1);
    expect(versoes.docs[0]!.data().cargos.presidente.votos).toEqual({ '92': 1, '93': 3 });

    const div = await db().collection('divergencias').doc(divId).get();
    expect(div.data()!.status).toBe('resolvida');
  });

  it('recusa resolver a mesma divergência duas vezes', async () => {
    const divId = await criarUrnaComDivergencia();
    await resolverDivergencia(divId, 'novo', admin);
    await expect(resolverDivergencia(divId, 'manter', admin)).rejects.toThrow(ErroDivergencia);
  });

  it('encerra sozinha outra divergência pendente que já confere com o cadastro validado', async () => {
    // Situação testada diretamente no Firestore: duas divergências pendentes da mesma urna, uma delas
    // (B) já com o mesmo conteúdo que será adotado ao resolver a outra (A). O envio normal nunca chega
    // a criar duas pendências idênticas (a segunda seria deduplicada), mas o encerramento automático
    // deve fechá-la se isso acontecer.
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal1);
    const boletimAtual = (await db().collection('boletins').doc('9-16-1').get()).data()!;
    const novoValidado = { ...boletimAtual, cargos: { ...boletimAtual.cargos, presidente: { ...boletimAtual.cargos.presidente, votos: { '92': 2, '93': 2 } } }, fiscalNome: 'Fiscal Dois' };

    await db().collection('divergencias').doc('A').set({ id: 'A', key: '9-16-1', novo: novoValidado, status: 'pendente', criadoEm: Date.now() });
    await db().collection('divergencias').doc('B').set({ id: 'B', key: '9-16-1', novo: novoValidado, status: 'pendente', criadoEm: Date.now() });

    await resolverDivergencia('A', 'novo', admin);

    const b = await db().collection('divergencias').doc('B').get();
    expect(b.data()).toMatchObject({ status: 'resolvida', decisao: 'novo', observacao: 'Confere com o cadastro validado.' });

    const mapa = await db().collection('mapa').doc('1').get();
    expect(mapa.data()!.secoes).toMatchObject({ '9-16': 'ok' }); // nenhuma pendência restante
  });
});
