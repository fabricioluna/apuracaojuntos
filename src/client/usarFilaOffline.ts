'use client';
import { useCallback, useEffect, useState } from 'react';
import { listarFila, processarFila, type ItemFila } from './fila-offline';

/** Mostra os boletins guardados no aparelho e tenta enviá-los sozinho quando a conexão volta. */
export function usarFilaOffline() {
  const [itens, setItens] = useState<ItemFila[]>([]);

  const atualizarLista = useCallback(async () => setItens(await listarFila()), []);

  const processar = useCallback(async () => {
    await processarFila();
    await atualizarLista();
  }, [atualizarLista]);

  useEffect(() => {
    atualizarLista();
    processar();
    window.addEventListener('online', processar);
    const intervalo = setInterval(processar, 30_000);
    return () => {
      window.removeEventListener('online', processar);
      clearInterval(intervalo);
    };
  }, [atualizarLista, processar]);

  return { itens, processar, atualizarLista };
}
