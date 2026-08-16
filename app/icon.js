import { ImageResponse } from 'next/og';
import { BoltMark } from './brand-card';

// PWA / favicon icon — brand bolt on charcoal, generated at /icon
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: '#0B0D0F',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BoltMark size={424} />
      </div>
    ),
    { ...size }
  );
}
