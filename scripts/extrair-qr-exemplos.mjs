// Extrai o texto dos QR Codes dos boletins de exemplo do TSE (PDFs) e grava em tests/fixtures/bu-2018.json.
// Requer o Poppler (comando pdfimages) instalado. Os .imgbu guardam o QR Code num formato binário da
// impressora; nos PDFs o QR Code é uma imagem, que lemos com jsQR.
// Uso: node scripts/extrair-qr-exemplos.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

const pasta = 'docs/tse-exemplos-boletim-urna-eleicoes-2018';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-'));
const saida = {};

for (const pdf of fs.readdirSync(pasta).filter(n => n.endsWith('.pdf')).sort()) {
  const base = path.basename(pdf, '.pdf');
  execFileSync('pdfimages', ['-png', path.join(pasta, pdf), path.join(tmp, base)]);
  const partes = [];
  for (const img of fs.readdirSync(tmp).filter(n => n.startsWith(base + '-')).sort()) {
    const p = PNG.sync.read(fs.readFileSync(path.join(tmp, img)));
    const M = 16, W = p.width + 2 * M, H = p.height + 2 * M, d = new Uint8ClampedArray(W * H * 4).fill(255);
    for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
      const s = (y * p.width + x) * 4, t = ((y + M) * W + x + M) * 4;
      d[t] = p.data[s]; d[t + 1] = p.data[s + 1]; d[t + 2] = p.data[s + 2];
    }
    const r = jsQR(d, W, H);
    if (!r) throw new Error(`Não consegui ler o QR Code ${img}`);
    partes.push(r.data);
  }
  saida[base] = partes;
}
fs.rmSync(tmp, { recursive: true, force: true });
fs.writeFileSync('tests/fixtures/bu-2018.json', JSON.stringify(saida, null, 1) + '\n');
console.log(Object.entries(saida).map(([k, v]) => `${k}: ${v.length} QR Codes`).join('\n'));
