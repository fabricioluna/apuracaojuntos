// Ícone do app: reproduz a marca da logo (estrela verde dentro de um círculo, sobre roxo), já que
// as logos em public/ são só a wordmark larga ("CONSTRUINDO JUNTOS"), sem recorte quadrado.
// generateImageMetadata gera os tamanhos usados tanto pela aba do navegador quanto pelo manifest
// (instalação no celular) — ver app/manifest.ts.
import { ImageResponse } from 'next/og';

export function generateImageMetadata() {
  return [
    { id: '32', size: { width: 32, height: 32 }, contentType: 'image/png' },
    { id: '192', size: { width: 192, height: 192 }, contentType: 'image/png' },
    { id: '512', size: { width: 512, height: 512 }, contentType: 'image/png' },
  ];
}

const TAMANHOS: Record<string, number> = { '32': 32, '192': 192, '512': 512 };

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const tamanho = TAMANHOS[String(await id)] ?? 32;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#7602bd',
        }}
      >
        <svg width={tamanho * 0.72} height={tamanho * 0.72} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" fill="none" stroke="#00ff05" strokeWidth="1.6" />
          <path d="M12 4.5l2.12 4.3 4.74.69-3.43 3.34.81 4.72L12 15.3l-4.24 2.25.81-4.72-3.43-3.34 4.74-.69z" fill="#00ff05" />
        </svg>
      </div>
    ),
    { width: tamanho, height: tamanho },
  );
}
