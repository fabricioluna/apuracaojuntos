'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
      const { admin } = await entrarComCodigo(codigo);
      router.push(admin ? '/admin' : '/novo');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main>
      <section className="painel" style={{ maxWidth: 420, margin: '0 auto' }}>
        <Image className="logo-dlg" src="/logo-roxo.png" alt="Construindo Juntos" width={216} height={54} priority style={{ marginBottom: 14 }} />
        <h1>Entrar</h1>
        <p className="lead" style={{ margin: '8px 0 16px' }}>
          Digite o código que você recebeu de quem organiza a fiscalização.
        </p>
        <form onSubmit={aoEnviar} className="pilha">
          <div className="campo">
            <label htmlFor="codigo">Seu código</label>
            <input
              id="codigo"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
            />
          </div>
          {erro && (
            <p className="msg erro" role="alert">
              {erro}
            </p>
          )}
          <button className="btn" type="submit" disabled={enviando || !codigo}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
