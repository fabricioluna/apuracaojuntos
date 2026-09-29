'use client';
import { useEffect, useState } from 'react';
import { cadastrarFiscal, definirFiscalAtivo, listarFiscais } from '../../client/admin';
import type { FiscalResumo } from '../../server/admin/fiscais';

export function FiscaisTab() {
  const [fiscais, setFiscais] = useState<FiscalResumo[] | null>(null);
  const [erro, setErro] = useState('');
  const [nome, setNome] = useState('');
  const [ehAdmin, setEhAdmin] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [novoCodigo, setNovoCodigo] = useState<{ nome: string; codigo: string } | null>(null);

  function carregar() {
    listarFiscais()
      .then(r => setFiscais(r.fiscais))
      .catch(e => setErro(e.message));
  }
  useEffect(carregar, []);

  async function aoCadastrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro('');
    try {
      const r = await cadastrarFiscal(nome.trim(), ehAdmin);
      setNovoCodigo({ nome: nome.trim(), codigo: r.codigo });
      setNome('');
      setEhAdmin(false);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível cadastrar.');
    } finally {
      setEnviando(false);
    }
  }

  async function alternarAtivo(f: FiscalResumo) {
    try {
      await definirFiscalAtivo(f.id, !f.ativo);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível atualizar.');
    }
  }

  return (
    <div className="pilha">
      <section className="painel">
        <h3>Cadastrar fiscal</h3>
        <form onSubmit={aoCadastrar} className="pilha" style={{ marginTop: 12 }}>
          <div className="campo">
            <label htmlFor="f-nome">Nome</label>
            <input id="f-nome" value={nome} onChange={e => setNome(e.target.value)} required minLength={3} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={ehAdmin} onChange={e => setEhAdmin(e.target.checked)} style={{ width: 20, height: 20 }} />
            Esta pessoa também é administradora
          </label>
          <div className="linha-botoes">
            <button className="btn" disabled={enviando || nome.trim().length < 3}>
              {enviando ? 'Cadastrando…' : 'Cadastrar'}
            </button>
          </div>
        </form>
        {novoCodigo && (
          <p className="msg ok" role="status" style={{ marginTop: 12 }}>
            <strong>{novoCodigo.nome}</strong> cadastrado(a). Código: <strong>{novoCodigo.codigo}</strong> — repasse por um canal seguro. Ele não aparece de novo.
          </p>
        )}
        {erro && (
          <p className="msg erro" role="alert" style={{ marginTop: 12 }}>
            {erro}
          </p>
        )}
      </section>

      <section className="painel">
        <h3>Fiscais cadastrados</h3>
        {!fiscais ? (
          <p className="lead">Carregando…</p>
        ) : (
          <div className="rolagem">
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Papel</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {fiscais.map(f => (
                  <tr key={f.id}>
                    <td>{f.nome}</td>
                    <td>{f.admin ? 'Administrador' : 'Fiscal'}</td>
                    <td>{f.ativo ? <span className="etiqueta certo">Ativo</span> : <span className="etiqueta alerta">Desativado</span>}</td>
                    <td>
                      <button className="btn ghost pequeno" onClick={() => alternarAtivo(f)}>
                        {f.ativo ? 'Desativar' : 'Reativar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
