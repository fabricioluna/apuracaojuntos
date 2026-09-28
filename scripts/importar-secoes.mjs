// Gera data/cidade/<municipio>.json a partir do CSV "locais de votação" baixado do portal do TSE.
// Uso: node scripts/importar-secoes.mjs docs/locais.csv data/cidade/pesqueira.json
import fs from 'node:fs';

const [entrada, saida] = process.argv.slice(2);
if (!entrada || !saida) { console.error('Uso: node scripts/importar-secoes.mjs <locais.csv> <saida.json>'); process.exit(1); }

const texto = fs.readFileSync(entrada, 'utf8').replace(/^﻿/, '');

// Leitor de CSV simples, com suporte a campos entre aspas
function lerCsv(t) {
  const linhas = []; let linha = [], campo = '', aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.length > 1) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

const [cab, ...linhas] = lerCsv(texto);
const col = nome => cab.findIndex(c => c.trim() === nome);
const iZona = col('Zona'), iLocal = col('Código do Local'), iNome = col('Nome do Local'), iMuni = col('Município'), iSecAptos = col('Seção-Aptos');
if ([iZona, iLocal, iNome, iMuni, iSecAptos].includes(-1)) { console.error('Colunas esperadas não encontradas no CSV.'); process.exit(1); }

const zonas = new Map(); const municipios = new Set();
for (const r of linhas) {
  municipios.add(r[iMuni]);
  const zona = Number(r[iZona]);
  const z = zonas.get(zona) ?? { zona, secoes: [] };
  for (const par of r[iSecAptos].split(',')) {
    const [secao, aptos] = par.trim().split('-').map(Number);
    if (!Number.isInteger(secao) || !Number.isInteger(aptos)) throw new Error(`Seção inválida: "${par}"`);
    if (z.secoes.some(s => s.secao === secao)) throw new Error(`Seção repetida: zona ${zona}, seção ${secao}`);
    z.secoes.push({ secao, aptos, local: Number(r[iLocal]), nomeLocal: r[iNome] });
  }
  zonas.set(zona, z);
}
const lista = [...zonas.values()].sort((a, b) => a.zona - b.zona);
lista.forEach(z => z.secoes.sort((a, b) => a.secao - b.secao));
fs.writeFileSync(saida, JSON.stringify({ municipio: [...municipios].join(', '), fonte: 'Portal de dados abertos do TSE (locais de votação)', zonas: lista }, null, 1) + '\n');
console.log(`${lista.map(z => `zona ${z.zona}: ${z.secoes.length} seções`).join('; ')}`);
