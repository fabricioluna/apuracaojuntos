'use client';
import { useEffect, useState } from 'react';
import { getIdTokenResult } from 'firebase/auth';
import { aoMudarSessao } from './sessao';

export interface SessaoFiscal {
  uid: string;
  nome: string;
  admin: boolean;
}

/**
 * Sessão do fiscal logado, lida das claims do token (nome/admin). A autorização que vale de
 * verdade é sempre conferida ao vivo no servidor (exigirFiscal); isto é só para a interface.
 */
export function usarSessao(): { sessao: SessaoFiscal | null; carregando: boolean } {
  const [sessao, setSessao] = useState<SessaoFiscal | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(
    () =>
      aoMudarSessao(async usuario => {
        if (!usuario) {
          setSessao(null);
          setCarregando(false);
          return;
        }
        const r = await getIdTokenResult(usuario);
        setSessao({ uid: usuario.uid, nome: typeof r.claims.nome === 'string' ? r.claims.nome : '', admin: r.claims.admin === true });
        setCarregando(false);
      }),
    [],
  );

  return { sessao, carregando };
}
