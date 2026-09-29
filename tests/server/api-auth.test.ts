import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../app/api/auth/entrar/route';
import { limparEmulador, seedFiscal } from '../helpers/emulador';

beforeEach(limparEmulador);

function req(body: unknown) {
  return new Request('http://local/api/auth/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

describe('POST /api/auth/entrar', () => {
  it('devolve um token para o código correto', async () => {
    const { codigo } = await seedFiscal('Ana Fiscal');
    const r = await POST(req({ codigo }));
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo).toMatchObject({ nome: 'Ana Fiscal', admin: false });
    expect(typeof corpo.token).toBe('string');
  });

  it('recusa código errado', async () => {
    await seedFiscal('Ana Fiscal');
    const r = await POST(req({ codigo: '000000' }));
    expect(r.status).toBe(401);
  });

  it('recusa corpo sem código', async () => {
    const r = await POST(req({}));
    expect(r.status).toBe(400);
  });
});
