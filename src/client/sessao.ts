'use client';
import { onAuthStateChanged, signInWithCustomToken, signOut, type User } from 'firebase/auth';
import { clientAuth } from './firebase';

export async function entrarComCodigo(codigo: string): Promise<{ nome: string; admin: boolean }> {
  const resp = await fetch('/api/auth/entrar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo }),
  });
  const dados = await resp.json();
  if (!resp.ok) throw new Error(dados.erro ?? 'Não foi possível entrar.');
  await signInWithCustomToken(clientAuth, dados.token);
  return { nome: dados.nome, admin: dados.admin };
}

export function obterIdToken(): Promise<string | null> {
  return clientAuth.currentUser ? clientAuth.currentUser.getIdToken() : Promise.resolve(null);
}

export function sair(): Promise<void> {
  return signOut(clientAuth);
}

export function aoMudarSessao(fn: (usuario: User | null) => void): () => void {
  return onAuthStateChanged(clientAuth, fn);
}

/** Chamada padrão para as rotas de API que exigem login: anexa o token e devolve o JSON já tratado. */
export async function chamarApi<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const token = await obterIdToken();
  if (!token) throw new Error('Faça login para continuar.');
  const resp = await fetch(caminho, {
    ...opcoes,
    headers: { ...opcoes.headers, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  const dados = await resp.json();
  if (!resp.ok) throw new Error(dados.erro ?? 'Não foi possível concluir a ação.');
  return dados as T;
}
