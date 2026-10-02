'use client';
// Envolve o html5-qrcode para a câmera (leitura contínua) e para decodificar uma foto (arquivo).
// Usado tanto para escanear ao vivo quanto para tentar ler o QR Code de uma foto do boletim.
import { Html5Qrcode } from 'html5-qrcode';
import jsQR from 'jsqr';

let camera: Html5Qrcode | null = null;

export async function iniciarCamera(elementoId: string, aoLer: (texto: string) => void): Promise<void> {
  if (camera) return;
  const instancia = new Html5Qrcode(elementoId);
  camera = instancia;
  try {
    await instancia.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 260, height: 260 },
        // Limita a resolução pedida da câmera (só "ideal", nunca trava se o aparelho não tiver
        // essa resolução exata). Sem isso, em navegadores sem leitor nativo de código (Safari do
        // iPhone, por exemplo — só o Chrome Android tem essa API), cada quadro é decodificado em
        // JavaScript puro na resolução cheia da câmera, o que fica perceptivelmente lento; o QR
        // Code não precisa de resolução alta pra ser lido, só de nitidez.
        videoConstraints: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        // Sem leitor nativo (ver acima), cada quadro sem QR Code visível — o caso comum enquanto
        // reposiciona o celular entre um QR Code e outro — é decodificado DUAS vezes por padrão: a
        // imagem normal e, se falhar, a imagem espelhada (pro caso de a câmera devolver o quadro
        // invertido). Como só usamos a câmera traseira ('environment'), que nunca espelha, essa
        // segunda tentativa é trabalho desperdiçado em todo quadro sem leitura — desligado aqui.
        disableFlip: true,
      },
      aoLer,
      () => {},
    );
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

/** jsQR direto nos pixels (mesma biblioteca usada nos scripts Node — ver CLAUDE.md > "Gerador de
 * boletins de teste"): achou QR Code em imagens onde o html5-qrcode não achou, mesmo numa foto
 * legível e do tamanho nativo. Tentado primeiro, porque se provou mais confiável nos testes reais. */
async function lerComJsQR(arquivo: File): Promise<string | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo);
  } catch {
    return null;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const resultado = jsQR(imagem.data, imagem.width, imagem.height);
    return resultado?.data ?? null;
  } finally {
    bitmap.close();
  }
}

/** Tenta ler um QR Code de uma imagem (foto do boletim). Devolve o texto ou null se não achar nenhum.
 * Tenta jsQR primeiro; se não achar, tenta o html5-qrcode (scanFile) — algoritmos diferentes acham
 * coisas diferentes, então vale tentar os dois antes de desistir. */
export async function lerArquivo(elementoId: string, arquivo: File): Promise<string | null> {
  const porJsQR = await lerComJsQR(arquivo);
  if (porJsQR) return porJsQR;

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
