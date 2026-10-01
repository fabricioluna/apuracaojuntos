'use client';
// Fila de boletins pendentes de envio, guardada no próprio aparelho (IndexedDB). Usada quando o
// fiscal confirma um boletim sem conexão: o cadastro fica salvo e é enviado sozinho quando a
// conexão voltar, sem que o fiscal precise refazer nada.
import { ref, uploadBytes } from 'firebase/storage';
import { chamarApi } from './sessao';
import { clientStorage } from './firebase';

const NOME_BANCO = 'cj-fila';
const LOJA = 'pendentes';

export interface ItemFila {
  id: string;
  criadoEm: number;
  /** Corpo a enviar para POST /api/boletins (sem fotoPaths ainda, se as fotos estiverem em fotoBlobs). */
  payload: Record<string, unknown>;
  /** Fotos ainda não enviadas ao Storage (enviadas só na hora de processar a fila, com conexão). */
  fotoBlobs?: Blob[];
  status: 'pendente' | 'enviado' | 'erro';
  mensagem?: string;
  fiscalUid: string;
}

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOME_BANCO, 1);
    pedido.onupgradeneeded = () => {
      pedido.result.createObjectStore(LOJA, { keyPath: 'id' });
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function comLoja<T>(modo: IDBTransactionMode, fn: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const banco = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = banco.transaction(LOJA, modo);
    const pedido = fn(tx.objectStore(LOJA));
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

export async function salvarPendente(payload: Record<string, unknown>, fiscalUid: string, fotoBlobs?: Blob[]): Promise<string> {
  const item: ItemFila = { id: crypto.randomUUID(), criadoEm: Date.now(), payload, fotoBlobs, status: 'pendente', fiscalUid };
  await comLoja('readwrite', loja => loja.add(item));
  return item.id;
}

export async function listarFila(): Promise<ItemFila[]> {
  const itens = await comLoja<ItemFila[]>('readonly', loja => loja.getAll());
  return itens.sort((a, b) => b.criadoEm - a.criadoEm);
}

async function atualizar(id: string, mudanca: Partial<ItemFila>): Promise<void> {
  const banco = await abrirBanco();
  await new Promise<void>((resolve, reject) => {
    const tx = banco.transaction(LOJA, 'readwrite');
    const loja = tx.objectStore(LOJA);
    const pedido = loja.get(id);
    pedido.onsuccess = () => {
      const atual = pedido.result as ItemFila | undefined;
      if (!atual) return resolve();
      loja.put({ ...atual, ...mudanca });
      resolve();
    };
    pedido.onerror = () => reject(pedido.error);
  });
}

/** Erro de rede (sem conexão), diferente de uma resposta do servidor recusando o boletim. */
function ehFalhaDeRede(e: unknown): boolean {
  return e instanceof TypeError; // fetch lança TypeError quando não consegue nem completar a requisição
}

/**
 * Tenta enviar cada item pendente, na ordem em que foram criados. Para no primeiro erro de rede
 * (provavelmente ainda offline); erros do servidor (boletim recusado) marcam o item e seguem para o
 * próximo, para não travar a fila por causa de um único boletim com problema.
 */
export async function processarFila(): Promise<void> {
  const pendentes = (await listarFila()).filter(i => i.status === 'pendente').sort((a, b) => a.criadoEm - b.criadoEm);
  for (const item of pendentes) {
    try {
      let payload = item.payload;
      if (item.fotoBlobs?.length) {
        const caminhos = await Promise.all(
          item.fotoBlobs.map(async (blob, i) => {
            const caminho = `boletins/${item.fiscalUid}/${item.id}-${i}.jpg`;
            await uploadBytes(ref(clientStorage, caminho), blob, { contentType: 'image/jpeg' });
            return caminho;
          }),
        );
        payload = { ...payload, fotoPaths: caminhos };
      }
      await chamarApi('/api/boletins', { method: 'POST', body: JSON.stringify(payload) });
      await atualizar(item.id, { status: 'enviado', mensagem: undefined });
    } catch (e) {
      if (ehFalhaDeRede(e)) return; // ainda offline: tenta o resto depois
      await atualizar(item.id, { status: 'erro', mensagem: e instanceof Error ? e.message : 'Falha ao enviar.' });
    }
  }
}
