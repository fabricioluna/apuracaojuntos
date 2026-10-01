import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodificarBU } from '../../src/bu';

// Confere que o gerador de boletins sintéticos (scripts/gerar-boletins-teste.mjs) produz QR Codes
// que o nosso próprio decodificador aceita, e que os valores decodificados batem com o gabarito
// (dados.json) escrito junto. Só roda quando a pasta existe — ela não vai para o repositório (é
// gerada localmente, sob pedido, pra testar a leitura por câmera/foto/IA).
const pastaBase = path.resolve('docs/boletins-teste');
const temBoletins = fs.existsSync(pastaBase);
const pastas = temBoletins ? fs.readdirSync(pastaBase).filter(p => fs.statSync(path.join(pastaBase, p)).isDirectory()) : [];

describe.skipIf(!temBoletins)('boletins de teste gerados (docs/boletins-teste)', () => {
  it(`decodifica e confere o gabarito de todas as pastas encontradas (${pastas.length})`, () => {
    expect(pastas.length).toBeGreaterThan(0);
    for (const secao of pastas) {
      const gabarito = JSON.parse(fs.readFileSync(path.join(pastaBase, secao, 'dados.json'), 'utf8'));
      const r = decodificarBU(gabarito.textosQR);
      expect(r.ok, `seção ${secao}: ${!r.ok ? r.erros.map((e: { mensagem: string }) => e.mensagem).join(' | ') : ''}`).toBe(true);
      if (!r.ok) continue;

      expect(r.boletim.zona).toBe(gabarito.zona);
      expect(r.boletim.secao).toBe(gabarito.secao);
      expect(r.boletim.turno).toBe(gabarito.turno);
      expect(r.boletim.fase).toBe('S');
      expect(r.boletim.assinatura).toBe('nao_verificada'); // VRQR 6.0: sempre, por enquanto (ver CLAUDE.md)

      for (const [cargoId, esperado] of Object.entries(gabarito.cargos) as [string, any][]) {
        const c = r.boletim.cargos[cargoId as keyof typeof r.boletim.cargos];
        expect(c, `seção ${secao}, cargo ${cargoId} ausente`).toBeTruthy();
        expect({ secao, cargoId, votos: c!.votos, legenda: c!.legenda, branco: c!.branco, nulo: c!.nulo, total: c!.total }).toEqual({
          secao,
          cargoId,
          votos: esperado.votos,
          legenda: esperado.legenda,
          branco: esperado.branco,
          nulo: esperado.nulo,
          total: esperado.total,
        });
      }
    }
  });
});
