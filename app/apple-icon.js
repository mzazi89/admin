import { ImageResponse } from 'next/og';
import { BoltMark } from './brand-card';

// iOS home-screen icon, generated at /apple-icon
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#0B0D0F',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BoltMark size={150} />
      </div>
    ),
    { ...size }
  );
}
