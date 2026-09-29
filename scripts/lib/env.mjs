// Lê .env.local (se existir) e preenche process.env, sem sobrescrever variáveis já definidas.
// Evita depender do pacote "dotenv" só para os scripts de linha de comando.
import fs from 'node:fs';

export function carregarEnvLocal(caminho = '.env.local') {
  if (!fs.existsSync(caminho)) return;
  for (const linha of fs.readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(linha);
    if (!m) continue;
    const [, chave, valorBruto] = m;
    if (process.env[chave] !== undefined) continue;
    const valor = valorBruto.startsWith('"') && valorBruto.endsWith('"') ? valorBruto.slice(1, -1) : valorBruto;
    process.env[chave] = valor;
  }
}
