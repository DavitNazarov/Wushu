import { ImageResponse } from 'next/og';
import { SITE_NAME } from './site';

// Standard OpenGraph / Twitter summary_large_image dimensions.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

// Renders a branded social-share card as a PNG via next/og. Runs in the Node
// runtime (the combined server) — no edge runtime, no external font fetch, so
// it's dependency-free and reliable on the single VPS.
//
// Text is kept Latin (event.name is the English field): next/og's built-in font
// doesn't carry Georgian glyphs, and loading Noto at render time would add a
// network/file dependency. The page's OG *title* text is still localised; only
// the baked-in image stays English. Localised image text is a follow-up.
export function renderOgImage(input: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}): ImageResponse {
  const title =
    input.title.length > 90 ? `${input.title.slice(0, 88)}…` : input.title;

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0b0b0f 0%, #17121a 55%, #2a0f14 100%)',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {input.eyebrow ? (
            <div
              style={{
                display: 'flex',
                fontSize: 26,
                letterSpacing: 4,
                textTransform: 'uppercase',
                color: '#e8505b',
                fontWeight: 700,
                marginBottom: 28,
              }}
            >
              {input.eyebrow}
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              fontSize: 68,
              lineHeight: 1.08,
              fontWeight: 800,
              color: '#ffffff',
              maxWidth: 1040,
            }}
          >
            {title}
          </div>
          {input.subtitle ? (
            <div
              style={{
                display: 'flex',
                marginTop: 28,
                fontSize: 32,
                color: '#c8c2cc',
                fontWeight: 500,
              }}
            >
              {input.subtitle}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              background: '#e8505b',
              marginRight: 18,
            }}
          />
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: 1,
            }}
          >
            {SITE_NAME}
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
