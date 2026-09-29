'use client';
// Tela de login provisória: só o código do fiscal, sem estilo do protótipo ainda (chega na etapa 4).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { entrarComCodigo } from '../../src/client/sessao';

export default function PaginaEntrar() {
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();

  async function aoEnviar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const { nome, admin } = await entrarComCodigo(codigo);
      router.push(admin ? '/admin' : '/novo');
      void nome;
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 360 }}>
      <h1>Entrar</h1>
      <form onSubmit={aoEnviar}>
        <label htmlFor="codigo">Seu código de fiscal</label>
        <input
          id="codigo"
          inputMode="numeric"
          autoComplete="off"
          value={codigo}
          onChange={e => setCodigo(e.target.value)}
          style={{ display: 'block', width: '100%', margin: '8px 0' }}
        />
        {erro && <p role="alert" style={{ color: 'crimson' }}>{erro}</p>}
        <button type="submit" disabled={enviando || !codigo}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  );
}
