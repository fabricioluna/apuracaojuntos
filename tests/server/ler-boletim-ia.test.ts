import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../app/api/ler-boletim/route';
import { ErroLeituraIA, interpretarResposta, lerBoletimComIA } from '../../src/server/ler-boletim-ia';
import { limparEmulador, loginComoFiscal } from '../helpers/emulador';

beforeEach(limparEmulador);

function req(url: string, token?: string, init: RequestInit = {}) {
  return new Request(url, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
}

describe('interpretarResposta (parsing da saída da IA, sem chamar a API de verdade)', () => {
  it('lê candidatos, legenda, brancos e nulos de uma resposta bem formada', () => {
    const r = interpretarResposta(
      JSON.stringify({
        cargos: {
          presidente: { votos: { '13': 120 }, branco: 5, nulo: 2 },
          federal: { votos: { '1000': 8 }, legenda: { '13': 3 }, branco: 1, nulo: 0 },
        },
      }),
    );
    expect(r.cargos.presidente).toEqual({ votos: { '13': 120 }, branco: 5, nulo: 2 });
    expect(r.cargos.federal).toEqual({ votos: { '1000': 8 }, legenda: { '13': 3 }, branco: 1, nulo: 0 });
    expect(r.avisos).toEqual([]);
  });

  it('aceita a resposta vindo dentro de um bloco ```json (markdown)', () => {
    const r = interpretarResposta('```json\n' + JSON.stringify({ cargos: { presidente: { votos: { '13': 1 }, branco: 0, nulo: 0 } } }) + '\n```');
    expect(r.cargos.presidente?.votos).toEqual({ '13': 1 });
  });

  it('branco/nulo ausentes (IA sem confiança) ficam de fora e geram aviso', () => {
    const r = interpretarResposta(JSON.stringify({ cargos: { governador: { votos: { '16': 4 } } } }));
    expect(r.cargos.governador).toEqual({ votos: { '16': 4 } });
    expect(r.avisos[0]).toContain('Governador');
  });

  it('ignora legenda em cargo majoritário (não existe no boletim de verdade)', () => {
    const r = interpretarResposta(JSON.stringify({ cargos: { senador: { votos: { '111': 2 }, legenda: { '13': 9 }, branco: 0, nulo: 0 } } }));
    expect(r.cargos.senador).toEqual({ votos: { '111': 2 }, branco: 0, nulo: 0 });
  });

  it('ignora chaves de cargo desconhecidas e valores inválidos (negativo, fracionado, não-numérico)', () => {
    const r = interpretarResposta(
      JSON.stringify({
        cargos: {
          vereador: { votos: { '1': 1 }, branco: 0, nulo: 0 },
          presidente: { votos: { '13': -1, '22': 2.5, abc: 3, '14': 7 }, branco: 0, nulo: 0 },
        },
      }),
    );
    expect(Object.keys(r.cargos)).not.toContain('vereador');
    expect(r.cargos.presidente!.votos).toEqual({ '14': 7 });
  });

  it('recusa JSON inválido', () => {
    expect(() => interpretarResposta('isto não é json')).toThrow(ErroLeituraIA);
  });

  it('recusa quando não sobra nenhum cargo com dado confiável', () => {
    expect(() => interpretarResposta(JSON.stringify({ cargos: {} }))).toThrow(ErroLeituraIA);
  });
});

describe('lerBoletimComIA', () => {
  it('recusa com uma mensagem clara quando GEMINI_API_KEY não está configurada', async () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      await expect(lerBoletimComIA([{ base64: 'AAAA', mimeType: 'image/jpeg' }])).rejects.toThrow(/GEMINI_API_KEY/);
    } finally {
      if (original !== undefined) process.env.GEMINI_API_KEY = original;
    }
  });
});

describe('POST /api/ler-boletim', () => {
  it('exige login', async () => {
    const r = await POST(req('http://local/api/ler-boletim', undefined, { method: 'POST', body: JSON.stringify({ imagens: [{ imagemBase64: 'AA', mimeType: 'image/jpeg' }] }) }));
    expect(r.status).toBe(401);
  });

  it('recusa corpo sem nenhuma imagem', async () => {
    const { idToken } = await loginComoFiscal('Fiscal Teste IA');
    const r = await POST(req('http://local/api/ler-boletim', idToken, { method: 'POST', body: JSON.stringify({ imagens: [] }) }));
    expect(r.status).toBe(400);
  });

  it('recusa imagem sem base64 ou mimeType', async () => {
    const { idToken } = await loginComoFiscal('Fiscal Teste IA 1b');
    const r = await POST(req('http://local/api/ler-boletim', idToken, { method: 'POST', body: JSON.stringify({ imagens: [{ mimeType: 'image/jpeg' }] }) }));
    expect(r.status).toBe(400);
  });

  it('recusa tipo que não é imagem', async () => {
    const { idToken } = await loginComoFiscal('Fiscal Teste IA 2');
    const r = await POST(req('http://local/api/ler-boletim', idToken, { method: 'POST', body: JSON.stringify({ imagens: [{ imagemBase64: 'AA', mimeType: 'application/pdf' }] }) }));
    expect(r.status).toBe(400);
  });

  it('recusa mais fotos do que o limite por boletim', async () => {
    const { idToken } = await loginComoFiscal('Fiscal Teste IA 2b');
    const imagens = Array.from({ length: 7 }, () => ({ imagemBase64: 'AA', mimeType: 'image/jpeg' }));
    const r = await POST(req('http://local/api/ler-boletim', idToken, { method: 'POST', body: JSON.stringify({ imagens }) }));
    expect(r.status).toBe(400);
  });

  it('sem GEMINI_API_KEY configurada, devolve 422 com mensagem clara (não 500)', async () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const { idToken } = await loginComoFiscal('Fiscal Teste IA 3');
      const r = await POST(
        req('http://local/api/ler-boletim', idToken, { method: 'POST', body: JSON.stringify({ imagens: [{ imagemBase64: 'AA', mimeType: 'image/jpeg' }] }) }),
      );
      expect(r.status).toBe(422);
      const dados = await r.json();
      expect(dados.erro).toMatch(/GEMINI_API_KEY/);
    } finally {
      if (original !== undefined) process.env.GEMINI_API_KEY = original;
    }
  });
});
