import { beforeEach, describe, expect, it } from 'vitest';
import { autenticarFiscal } from '../../src/server/fiscal-auth';
import { limparEmulador } from '../helpers/emulador';
import { seedFiscal } from '../helpers/emulador';

beforeEach(limparEmulador);

describe('autenticarFiscal', () => {
  it('aceita o código correto e devolve nome e admin', async () => {
    const { codigo } = await seedFiscal('Ana Fiscal', { admin: false });
    const r = await autenticarFiscal(codigo, 'ip-1');
    expect(r).toMatchObject({ ok: true, nome: 'Ana Fiscal', admin: false });
  });

  it('recusa código incorreto', async () => {
    await seedFiscal('Ana Fiscal');
    const r = await autenticarFiscal('000000', 'ip-2');
    expect(r).toMatchObject({ ok: false });
  });

  it('recusa fiscal desativado', async () => {
    const { codigo } = await seedFiscal('Bruno Fiscal', { ativo: false });
    const r = await autenticarFiscal(codigo, 'ip-3');
    expect(r.ok).toBe(false);
  });

  it('recusa formato inválido sem consultar o banco', async () => {
    const r = await autenticarFiscal('abc', 'ip-4');
    expect(r).toEqual({ ok: false, mensagem: 'Código inválido.' });
  });

  it('bloqueia depois de muitas tentativas erradas com o mesmo identificador', async () => {
    await seedFiscal('Carla Fiscal');
    let ultimo;
    for (let i = 0; i < 9; i++) ultimo = await autenticarFiscal('999999', 'ip-5');
    expect(ultimo).toMatchObject({ ok: false, mensagem: expect.stringContaining('Muitas tentativas') });
  });

  it('um identificador diferente não é afetado pelo bloqueio de outro', async () => {
    for (let i = 0; i < 9; i++) await autenticarFiscal('999999', 'ip-6');
    const { codigo } = await seedFiscal('Dani Fiscal');
    const r = await autenticarFiscal(codigo, 'ip-7');
    expect(r.ok).toBe(true);
  });
});
