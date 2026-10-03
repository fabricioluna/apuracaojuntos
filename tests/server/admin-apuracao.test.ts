import { beforeEach, describe, expect, it } from 'vitest';
import { DELETE as DELETE_boletim } from '../../app/api/admin/boletins/[id]/route';
import { GET as GET_exportar } from '../../app/api/admin/exportar/route';
import { POST as POST_importar } from '../../app/api/admin/importar/route';
import { POST as POST_zerar } from '../../app/api/admin/zerar/route';
import { decodificarBU } from '../../src/bu';
import { CARGOS_ORDEM } from '../../src/bu/cargos';
import type { CargoId } from '../../src/bu/types';
import type { BoletimEntrada, CargoEntrada } from '../../src/domain/types';
import { utils as xlsxUtils, read as xlsxRead } from 'xlsx';
import { excluirBoletim, ErroExcluirBoletim } from '../../src/server/admin/excluir-boletim';
import { exportarApuracao, resumoParaCsv, resumoParaXlsx, resumoVotacao } from '../../src/server/admin/exportar-apuracao';
import { importarApuracao } from '../../src/server/admin/importar-apuracao';
import { zerarApuracao } from '../../src/server/admin/zerar-apuracao';
import { db } from '../../src/server/firebase-admin';
import { gravarBoletim } from '../../src/server/gravar-boletim';
import { buComVotoDiferente, dados1Original, dados2Original, fabricarBU } from '../helpers/bu2026';
import { limparEmulador, loginComoFiscal } from '../helpers/emulador';

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

function req(url: string, token?: string, init: RequestInit = {}) {
  return new Request(url, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
}

const fiscal1 = { uid: 'f1', nome: 'Fiscal Um' };

describe('excluirBoletim', () => {
  it('apaga o boletim e desfaz a contribuição nos totais e no mapa', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal1);

    await excluirBoletim('9-16-1');

    expect((await db().collection('boletins').doc('9-16-1').get()).exists).toBe(false);
    const presidente = await db().collection('totais').doc('1_presidente').get();
    expect(presidente.data()).toMatchObject({ urnas: 0, votos: { '92': 0, '93': 0 }, total: 0 });
    const mapa = await db().collection('mapa').doc('1').get();
    expect(mapa.data()?.secoes?.['9-16']).toBeUndefined();
  });

  it('apaga também a divergência pendente ligada à urna', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal1);
    await gravarBoletim(entradaDeQR(buComVotoDiferente()), { uid: 'f2', nome: 'Fiscal Dois' });
    expect((await db().collection('divergencias').where('key', '==', '9-16-1').get()).size).toBe(1);

    await excluirBoletim('9-16-1');

    expect((await db().collection('divergencias').where('key', '==', '9-16-1').get()).size).toBe(0);
  });

  it('recusa boletim inexistente', async () => {
    await expect(excluirBoletim('nada-0-1')).rejects.toThrow(ErroExcluirBoletim);
  });

  it('rota DELETE exige administrador', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal1);
    const { idToken } = await loginComoFiscal('Fiscal Comum');
    const r = await DELETE_boletim(req('http://local/api/admin/boletins/9-16-1', idToken, { method: 'DELETE' }), { params: Promise.resolve({ id: '9-16-1' }) });
    expect(r.status).toBe(403);
  });
});

describe('zerarApuracao', () => {
  it('apaga todos os boletins, divergências, totais e mapa de um turno', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal1);
    await gravarBoletim(entradaDeQR(buComVotoDiferente()), { uid: 'f2', nome: 'Fiscal Dois' });

    const resultado = await zerarApuracao(1);
    expect(resultado.boletinsApagados).toBe(1); // mesma urna (9-16-1): o segundo envio virou divergência, não um 2º boletim
    expect(resultado.divergenciasApagadas).toBe(1);

    expect((await db().collection('boletins').get()).size).toBe(0);
    expect((await db().collection('divergencias').get()).size).toBe(0);
    expect((await db().collection('totais').doc('1_presidente').get()).exists).toBe(false);
    expect((await db().collection('mapa').doc('1').get()).exists).toBe(false);
  });

  it('rota exige confirmar: true e um turno válido', async () => {
    const { idToken } = await loginComoFiscal('Administradora', { admin: true });
    const r1 = await POST_zerar(req('http://local/api/admin/zerar', idToken, { method: 'POST', body: JSON.stringify({ turno: 1 }) }));
    expect(r1.status).toBe(400);
    const r2 = await POST_zerar(req('http://local/api/admin/zerar', idToken, { method: 'POST', body: JSON.stringify({ turno: 3, confirmar: true }) }));
    expect(r2.status).toBe(400);
  });

  it('fiscal comum não consegue zerar', async () => {
    const { idToken } = await loginComoFiscal('Fiscal Comum');
    const r = await POST_zerar(req('http://local/api/admin/zerar', idToken, { method: 'POST', body: JSON.stringify({ turno: 1, confirmar: true }) }));
    expect(r.status).toBe(403);
  });
});

describe('exportarApuracao / importarApuracao: ida e volta', () => {
  it('exporta, zera, importa de volta e os totais batem igual a antes', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal1);
    const presidenteAntes = (await db().collection('totais').doc('1_presidente').get()).data();

    const csv = await exportarApuracao(1);
    expect(csv.split('\r\n')[0]).toBe('zona,secao,turno,cargo,tipo,numero,votos,fiscalNome,origem');
    expect(csv).toContain('9,16,1,presidente,candidato,92,1,Fiscal Um,qrcode');

    await zerarApuracao(1);
    expect((await db().collection('boletins').doc('9-16-1').get()).exists).toBe(false);

    const resultado = await importarApuracao(csv, { uid: 'admin1', nome: 'Administradora' });
    expect(resultado).toMatchObject({ processados: 1, novos: 1, iguais: 0, divergentes: 0, erros: [] });

    const boletim = await db().collection('boletins').doc('9-16-1').get();
    expect(boletim.exists).toBe(true);
    expect(boletim.data()!.cargos.presidente.origem).toBe('importado');

    const presidenteDepois = (await db().collection('totais').doc('1_presidente').get()).data();
    expect(presidenteDepois).toMatchObject({ votos: presidenteAntes!.votos, branco: presidenteAntes!.branco, nulo: presidenteAntes!.nulo, total: presidenteAntes!.total });
  });

  it('importar de novo o mesmo CSV não duplica (vira "igual")', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal1);
    const csv = await exportarApuracao(1);

    const resultado = await importarApuracao(csv, { uid: 'admin1', nome: 'Administradora' });
    expect(resultado).toMatchObject({ processados: 1, novos: 0, iguais: 1, divergentes: 0 });
  });

  it('recusa CSV com cabeçalho errado', async () => {
    await expect(importarApuracao('a,b,c\n1,2,3', { uid: 'admin1', nome: 'Administradora' })).rejects.toThrow(/Cabeçalho/);
  });

  it('rota de exportar exige administrador e um turno válido', async () => {
    const { idToken } = await loginComoFiscal('Fiscal Comum');
    const r = await GET_exportar(req('http://local/api/admin/exportar?turno=1', idToken));
    expect(r.status).toBe(403);

    const { idToken: tokenAdmin } = await loginComoFiscal('Administradora', { admin: true });
    const rSemTurno = await GET_exportar(req('http://local/api/admin/exportar', tokenAdmin));
    expect(rSemTurno.status).toBe(400);
  });

  it('rota de importar exige administrador', async () => {
    const { idToken } = await loginComoFiscal('Fiscal Comum');
    const r = await POST_importar(req('http://local/api/admin/importar', idToken, { method: 'POST', body: JSON.stringify({ csv: 'a,b' }) }));
    expect(r.status).toBe(403);
  });
});

describe('resumoVotacao (resumo legível: nome + votos já somados)', () => {
  it('traz os candidatos ordenados por votos (do maior pro menor), lendo de totais/*', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal1);
    const linhas = await resumoVotacao(1);
    const presidente = linhas.filter(l => l.cargo === 'Presidente' && l.tipo === 'candidato');
    expect(presidente.length).toBeGreaterThan(0);
    for (let i = 1; i < presidente.length; i++) expect(presidente[i - 1]!.votos).toBeGreaterThanOrEqual(presidente[i]!.votos);
    expect(linhas.some(l => l.cargo === 'Presidente' && l.tipo === 'branco')).toBe(true);
  });

  it('CSV tem cabeçalho com nome das colunas e mostra o número de votos', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal1);
    const csv = resumoParaCsv(await resumoVotacao(1));
    expect(csv.split('\r\n')[0]).toBe('Cargo,Tipo,Número,Nome,Votos,% dos válidos');
    expect(csv).toMatch(/,candidato,92,[^,]+,1,/); // candidato 92, 1 voto, no exemplo bu2026
  });

  it('XLSX gera uma aba por cargo, cada uma com os votos certos', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal1);
    const buffer = resumoParaXlsx(await resumoVotacao(1));
    const livro = xlsxRead(buffer, { type: 'buffer' });
    expect(livro.SheetNames).toContain('Presidente');
    const linhasPlanilha = xlsxUtils.sheet_to_json(livro.Sheets['Presidente']!, { header: 1 }) as unknown[][];
    expect(linhasPlanilha[0]).toEqual(['Tipo', 'Número', 'Nome', 'Votos', '% dos válidos']);
    expect(linhasPlanilha.length).toBeGreaterThan(1);
  });

  it('rota devolve o resumo em CSV ou XLSX, com o content-type certo', async () => {
    await gravarBoletim(entradaDeQR(fabricarBU(dados1Original, dados2Original)), fiscal1);
    const { idToken } = await loginComoFiscal('Administradora Resumo', { admin: true });

    const rCsv = await GET_exportar(req('http://local/api/admin/exportar?turno=1&tipo=resumo&formato=csv', idToken));
    expect(rCsv.status).toBe(200);
    expect(rCsv.headers.get('content-type')).toContain('text/csv');

    const rXlsx = await GET_exportar(req('http://local/api/admin/exportar?turno=1&tipo=resumo&formato=xlsx', idToken));
    expect(rXlsx.status).toBe(200);
    expect(rXlsx.headers.get('content-type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
});
