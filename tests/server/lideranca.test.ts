import { beforeEach, describe, expect, it } from 'vitest';
import { decodificarBU } from '../../src/bu';
import { CARGOS_ORDEM } from '../../src/bu/cargos';
import type { CargoId } from '../../src/bu/types';
import type { BoletimEntrada, CargoEntrada } from '../../src/domain/types';
import { db } from '../../src/server/firebase-admin';
import { gravarBoletim } from '../../src/server/gravar-boletim';
import { resolverDivergencia } from '../../src/server/resolver-divergencia';
import { dados1Original, dados2Original, fabricarBU } from '../helpers/bu2026';
import { limparEmulador } from '../helpers/emulador';

beforeEach(limparEmulador);

function entradaDeQR(partes: string[]): BoletimEntrada {
  const r = decodificarBU(partes);
  if (!r.ok) throw new Error('esperava decodificar: ' + r.erros.map(e => e.mensagem).join(' | '));
  const cargos: Partial<Record<CargoId, CargoEntrada>> = {};
  for (const id of CARGOS_ORDEM) {
    const c = r.boletim.cargos[id];
    if (c) cargos[id] = { ...c, origem: 'qrcode' };
  }
  return { zona: r.boletim.zona, secao: r.boletim.secao, turno: r.boletim.turno, cargos };
}

const f1 = { uid: 'f1', nome: 'Fiscal Um' };
const f2 = { uid: 'f2', nome: 'Fiscal Dois' };
const admin = { uid: 'a1', nome: 'Administradora' };

// A urna original do manual (zona 9, seção 16): presidente 93 vence com 3 votos contra 92 com 1
// (o resultado do presidente está em dados2Original, ver docs/manual 2026).
const dados1Secao17 = dados1Original.replace('SECA:16', 'SECA:17').replace('AGRE:17.18.19', 'AGRE:18.19');

describe('lidera e melhor urna', () => {
  it('a primeira urna define o vencedor e a melhor urna', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), f1);
    const t = (await db().collection('totais').doc('1_presidente').get()).data()!;
    expect(t.lidera).toEqual({ '93': 1 }); // 93 tem 3 votos, 92 tem 1
    expect(t.melhor).toEqual({ '92': { votos: 1, zona: 9, secao: 16 }, '93': { votos: 3, zona: 9, secao: 16 } });
  });

  it('uma segunda urna onde outro candidato vence soma o lidera de cada um', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), f1);
    // urna nova (seção 17), com presidente invertido: 92 vence com 3, 93 fica com 1
    const invertido = dados2Original.replace('92:1 93:3', '92:3 93:1');
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Secao17, invertido)), f2);

    const t = (await db().collection('totais').doc('1_presidente').get()).data()!;
    expect(t.lidera).toEqual({ '93': 1, '92': 1 });
    expect(t.melhor).toEqual({ '92': { votos: 3, zona: 9, secao: 17 }, '93': { votos: 3, zona: 9, secao: 16 } });
  });

  it('ao corrigir uma divergência, o lidera muda de candidato se o vencedor mudou', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), f1); // 93 vence (3x1)
    // A soma tem que continuar batendo com NOMI:4 do boletim original (3+1=4).
    const invertido = dados2Original.replace('92:1 93:3', '92:3 93:1'); // agora 92 vence (3x1)
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, invertido)), f2); // mesma urna: divergência

    const div = (await db().collection('divergencias').where('key', '==', '9-16-1').get()).docs[0]!;
    await resolverDivergencia(div.id, 'novo', admin);

    const t = (await db().collection('totais').doc('1_presidente').get()).data()!;
    // 93 perdeu a liderança desta urna (fica em 0, o campo não some) e 92 ganhou.
    expect(t.lidera).toEqual({ '92': 1, '93': 0 });
    expect(t.melhor['92']).toEqual({ votos: 3, zona: 9, secao: 16 }); // melhor urna evoluiu com a correção
  });

  it('manter o cadastro atual não mexe em lidera nem em melhor', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), f1);
    const invertido = dados2Original.replace('92:1 93:3', '92:3 93:1');
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, invertido)), f2);
    const div = (await db().collection('divergencias').where('key', '==', '9-16-1').get()).docs[0]!;
    await resolverDivergencia(div.id, 'manter', admin);

    const t = (await db().collection('totais').doc('1_presidente').get()).data()!;
    expect(t.lidera).toEqual({ '93': 1 });
    expect(t.melhor['93']).toEqual({ votos: 3, zona: 9, secao: 16 });
  });
});
