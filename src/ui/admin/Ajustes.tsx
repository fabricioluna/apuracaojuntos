'use client';
import { useState } from 'react';
import { atualizarConfig, baixarExportacao, importarApuracao, zerarApuracao } from '../../client/admin';
import { usarConfigCidade } from '../../client/config';

type Msg = { tipo: 'ok' | 'erro'; texto: string } | null;

const plural = (n: number, singular: string, pluralForma: string) => `${n} ${n === 1 ? singular : pluralForma}`;

export function AjustesTab() {
  const { config } = usarConfigCidade();
  const [turno, setTurno] = useState<'1' | '2'>('1');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const [exportando, setExportando] = useState(false);
  const [msgExport, setMsgExport] = useState<Msg>(null);

  const [arquivoImportar, setArquivoImportar] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [msgImportar, setMsgImportar] = useState<Msg>(null);

  const [confirmacaoZerar, setConfirmacaoZerar] = useState('');
  const [zerando, setZerando] = useState(false);
  const [msgZerar, setMsgZerar] = useState<Msg>(null);

  if (!config) return null;
  const valorAtual = String(config.turno) as '1' | '2';

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    try {
      await atualizarConfig({ turno: Number(turno) as 1 | 2 });
      setMsg({ tipo: 'ok', texto: 'Turno atualizado. O painel público e a tela de digitação já usam o novo turno.' });
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível salvar.' });
    } finally {
      setSalvando(false);
    }
  }

  async function exportar(tipo: 'backup' | 'resumo', formato: 'csv' | 'xlsx' = 'csv') {
    setExportando(true);
    setMsgExport(null);
    try {
      await baixarExportacao(config!.turno, tipo, formato);
      setMsgExport({ tipo: 'ok', texto: 'Arquivo baixado.' });
    } catch (e) {
      setMsgExport({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível exportar.' });
    } finally {
      setExportando(false);
    }
  }

  async function importar() {
    if (!arquivoImportar) return;
    setImportando(true);
    setMsgImportar(null);
    try {
      const texto = await arquivoImportar.text();
      const r = await importarApuracao(texto);
      const partes = [`${r.processados} urna(s) no arquivo`, `${r.novos} nova(s)`, `${r.iguais} já cadastrada(s) (idêntica)`, `${r.divergentes} com divergência (foram pro painel de Divergências)`];
      setMsgImportar({ tipo: r.erros.length ? 'erro' : 'ok', texto: partes.join(', ') + (r.erros.length ? `. ${r.erros.length} com erro: ${r.erros[0]}` : '.') });
      setArquivoImportar(null);
    } catch (e) {
      setMsgImportar({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível importar.' });
    } finally {
      setImportando(false);
    }
  }

  async function zerar() {
    setZerando(true);
    setMsgZerar(null);
    try {
      const r = await zerarApuracao(config!.turno);
      setMsgZerar({
        tipo: 'ok',
        texto: `Apagados ${plural(r.boletinsApagados, 'boletim', 'boletins')} e ${plural(r.divergenciasApagadas, 'divergência', 'divergências')} do ${config!.turno}º turno. Totais e mapa zerados.`,
      });
      setConfirmacaoZerar('');
    } catch (e) {
      setMsgZerar({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível zerar.' });
    } finally {
      setZerando(false);
    }
  }

  const totalSecoes = config.zonas.reduce((a, z) => a + z.secoes.length, 0);

  return (
    <section className="painel pilha">
      <h3>Turno em apuração</h3>
      <p className="lead">Trocar aqui muda o que o painel público mostra e o que a tela de Novo boletim aceita, para todo mundo.</p>
      <div className="campo" style={{ maxWidth: 260 }}>
        <label htmlFor="aj-turno">Turno</label>
        <select id="aj-turno" defaultValue={valorAtual} onChange={e => setTurno(e.target.value as '1' | '2')}>
          <option value="1">1º turno</option>
          <option value="2">2º turno</option>
        </select>
      </div>
      {msg && <p className={`msg ${msg.tipo === 'ok' ? 'ok' : 'erro'}`}>{msg.texto}</p>}
      <div className="linha-botoes">
        <button className="btn" disabled={salvando} onClick={salvar}>
          {salvando ? 'Salvando…' : 'Salvar turno'}
        </button>
      </div>

      <hr />

      <h3>Zonas e seções</h3>
      <p className="lead">
        {config.nomeMunicipio}/{config.uf}: {config.zonas.length} {config.zonas.length === 1 ? 'zona' : 'zonas'}, {totalSecoes} seções.
      </p>
      <div className="fichas">
        {config.zonas.map(z => (
          <span className="ficha" key={z.zona}>
            Zona {z.zona}: {z.secoes.length} seções
          </span>
        ))}
      </div>
      <p className="lead">
        Para adicionar, remover ou corrigir zonas e seções, use <code>node scripts/definir-config.mjs &lt;arquivo-da-cidade.json&gt;</code> no computador de quem
        administra o projeto — isso mantém o número de eleitores aptos e o nome do local de cada seção, que um formulário simples aqui poderia perder.
      </p>

      <hr />

      <h3>Exportar e importar</h3>
      <p className="lead">
        O <strong>resumo da votação</strong> traz o nome de cada candidato e o total de votos já somado, pronto pra ler ou mostrar — em CSV ou em planilha (XLSX),
        com uma aba por cargo. O <strong>backup completo</strong> é um CSV à parte, um boletim por linha (sem nome, só número) — serve pra guardar e, se precisar,
        importar de volta: cada urna passa pela mesma regra de sempre (se já existir com os mesmos números, não duplica; se os números forem diferentes, vira uma
        divergência pro administrador decidir — nunca sobrescreve direto).
      </p>
      <div className="linha-botoes">
        <button className="btn ghost" disabled={exportando} onClick={() => exportar('resumo', 'csv')}>
          {exportando ? 'Exportando…' : `Resumo da votação (CSV)`}
        </button>
        <button className="btn ghost" disabled={exportando} onClick={() => exportar('resumo', 'xlsx')}>
          {exportando ? 'Exportando…' : `Resumo da votação (XLSX)`}
        </button>
        <button className="btn ghost" disabled={exportando} onClick={() => exportar('backup')}>
          {exportando ? 'Exportando…' : `Backup completo (CSV, ${config.turno}º turno)`}
        </button>
      </div>
      {msgExport && <p className={`msg ${msgExport.tipo === 'ok' ? 'ok' : 'erro'}`}>{msgExport.texto}</p>}

      <div className="campo" style={{ maxWidth: 420, marginTop: 12 }}>
        <label htmlFor="aj-importar">Importar CSV</label>
        <input id="aj-importar" type="file" accept=".csv,text/csv" onChange={e => setArquivoImportar(e.target.files?.[0] ?? null)} />
      </div>
      <div className="linha-botoes">
        <button className="btn ghost" disabled={!arquivoImportar || importando} onClick={importar}>
          {importando ? 'Importando…' : 'Importar'}
        </button>
      </div>
      {msgImportar && <p className={`msg ${msgImportar.tipo === 'ok' ? 'ok' : 'erro'}`}>{msgImportar.texto}</p>}

      <hr />

      <h3 style={{ color: 'var(--bad)' }}>Zona de risco</h3>
      <p className="lead">
        Apaga <strong>todos</strong> os boletins, totais, mapa de urnas e divergências do {config.turno}º turno. Não dá pra desfazer. Se quiser guardar os dados
        antes, exporte o CSV acima primeiro.
      </p>
      <div className="campo" style={{ maxWidth: 280 }}>
        <label htmlFor="aj-confirma-zerar">Digite ZERAR para confirmar</label>
        <input id="aj-confirma-zerar" value={confirmacaoZerar} onChange={e => setConfirmacaoZerar(e.target.value)} />
      </div>
      <div className="linha-botoes">
        <button className="btn" style={{ background: 'var(--bad)', color: '#fff' }} disabled={confirmacaoZerar !== 'ZERAR' || zerando} onClick={zerar}>
          {zerando ? 'Zerando…' : `Zerar apuração do ${config.turno}º turno`}
        </button>
      </div>
      {msgZerar && <p className={`msg ${msgZerar.tipo === 'ok' ? 'ok' : 'erro'}`}>{msgZerar.texto}</p>}
    </section>
  );
}
