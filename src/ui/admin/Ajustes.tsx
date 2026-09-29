'use client';
import { useState } from 'react';
import { atualizarConfig } from '../../client/admin';
import { usarConfigCidade } from '../../client/config';

export function AjustesTab() {
  const { config } = usarConfigCidade();
  const [turno, setTurno] = useState<'1' | '2'>('1');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

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
    </section>
  );
}
