import { beforeEach, describe, expect, it } from 'vitest';
import { decodificarBU } from '../../src/bu';
import { CARGOS_ORDEM } from '../../src/bu/cargos';
import type { CargoId } from '../../src/bu/types';
import type { BoletimEntrada, CargoEntrada } from '../../src/domain/types';
import { db } from '../../src/server/firebase-admin';
import { gravarBoletim } from '../../src/server/gravar-boletim';
import { buComVotoDiferente, dados1Original, dados2Original, fabricarBU } from '../helpers/bu2026';
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

const fiscal1 = { uid: 'f1', nome: 'Fiscal Um' };
const fiscal2 = { uid: 'f2', nome: 'Fiscal Dois' };

describe('gravarBoletim: regra central (urna só entra uma vez)', () => {
  it('urna nova: grava o boletim e soma os totais dos cinco cargos', async () => {
    const res = await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal1);
    expect(res).toEqual({ status: 'novo' });

    const boletim = await db().collection('boletins').doc('9-16-1').get();
    expect(boletim.exists).toBe(true);
    expect(boletim.data()!.fiscalNome).toBe('Fiscal Um');

    const presidente = await db().collection('totais').doc('1_presidente').get();
    expect(presidente.data()).toMatchObject({ urnas: 1, votos: { '92': 1, '93': 3 }, branco: 0, nulo: 0, total: 4 });

    const senador = await db().collection('totais').doc('1_senador').get();
    expect(senador.data()!.total).toBe(8); // duas vagas: 4 eleitores, 8 votos

    const mapa = await db().collection('mapa').doc('1').get();
    expect(mapa.data()!.secoes).toMatchObject({ '9-16': 'ok' });
  });

  it('envio idêntico de outro fiscal: não grava de novo nem soma outra vez', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal1);
    const res = await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal2);
    expect(res).toMatchObject({ status: 'igual', fiscalNome: 'Fiscal Um' });

    const presidente = await db().collection('totais').doc('1_presidente').get();
    expect(presidente.data()!.urnas).toBe(1); // não dobrou
  });

  it('envio divergente: não sobrescreve, cria uma divergência e marca o mapa', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal1);
    const res = await gravarBoletim(entradaDeQR(buComVotoDiferente()), fiscal2);
    expect(res.status).toBe('divergente');
    if (res.status === 'divergente') {
      expect(res.jaAvisado).toBe(false);
      expect(res.diffs.some(d => d.campo === 'Candidato 92')).toBe(true);
    }

    const divs = await db().collection('divergencias').where('key', '==', '9-16-1').get();
    expect(divs.size).toBe(1);
    expect(divs.docs[0]!.data().status).toBe('pendente');

    const boletim = await db().collection('boletins').doc('9-16-1').get();
    expect(boletim.data()!.cargos.presidente.votos).toEqual({ '92': 1, '93': 3 }); // cadastro original mantido

    const mapa = await db().collection('mapa').doc('1').get();
    expect(mapa.data()!.secoes).toMatchObject({ '9-16': 'div' });

    const totaisAntes = await db().collection('totais').doc('1_presidente').get();
    expect(totaisAntes.data()!.votos).toEqual({ '92': 1, '93': 3 }); // totais não mudaram
  });

  it('mesmo envio divergente de novo: avisa que já sabia, sem duplicar a divergência', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal1);
    await gravarBoletim(entradaDeQR(buComVotoDiferente()), fiscal2);
    const res2 = await gravarBoletim(entradaDeQR(buComVotoDiferente()), fiscal2);
    expect(res2).toMatchObject({ status: 'divergente', jaAvisado: true });

    const divs = await db().collection('divergencias').where('key', '==', '9-16-1').get();
    expect(divs.size).toBe(1);
  });

  it('duas urnas diferentes somam nos mesmos documentos de totais', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal1);
    const outraUrna = fabricarBU(dados1Original.replace('SECA:16', 'SECA:17').replace('AGRE:17.18.19', 'AGRE:18.19'), dados2Original);
    await gravarBoletim(entradaDeQR(outraUrna), fiscal2);

    const presidente = await db().collection('totais').doc('1_presidente').get();
    expect(presidente.data()).toMatchObject({ urnas: 2, votos: { '92': 2, '93': 6 } });
  });
});
