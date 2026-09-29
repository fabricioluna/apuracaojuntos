'use client';
// Envolve o html5-qrcode para a câmera (leitura contínua) e para decodificar uma foto (arquivo).
// Usado tanto para escanear ao vivo quanto para tentar ler o QR Code de uma foto do boletim.
import { Html5Qrcode } from 'html5-qrcode';

let camera: Html5Qrcode | null = null;

export async function iniciarCamera(elementoId: string, aoLer: (texto: string) => void): Promise<void> {
  if (camera) return;
  const instancia = new Html5Qrcode(elementoId);
  camera = instancia;
  try {
    await instancia.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 260 } }, aoLer, () => {});
  } catch (e) {
    camera = null;
    throw e;
  }
}

export async function pararCamera(): Promise<void> {
  const instancia = camera;
  camera = null;
  if (!instancia) return;
  try {
    await instancia.stop();
    instancia.clear();
  } catch {
    /* já parada */
  }
}

/** Tenta ler um QR Code de uma imagem (foto do boletim). Devolve o texto ou null se não achar nenhum. */
export async function lerArquivo(elementoId: string, arquivo: File): Promise<string | null> {
  const leitor = new Html5Qrcode(elementoId);
  try {
    return await leitor.scanFile(arquivo, false);
  } catch {
    return null;
  } finally {
    try {
      leitor.clear();
    } catch {
      /* nada a limpar */
    }
  }
}
