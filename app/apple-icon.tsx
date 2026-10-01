// Ícone pra tela inicial do iOS: mesma marca do app/icon.tsx, mas sem transparência (o iOS não
// respeita alpha em apple-touch-icon) e com uma margem um pouco maior, como o padrão da Apple pede.
import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
        <svg width="110" height="110" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" fill="none" stroke="#00ff05" strokeWidth="1.6" />
          <path d="M12 4.5l2.12 4.3 4.74.69-3.43 3.34.81 4.72L12 15.3l-4.24 2.25.81-4.72-3.43-3.34 4.74-.69z" fill="#00ff05" />
        </svg>
      </div>
    ),
    size,
  );
}
