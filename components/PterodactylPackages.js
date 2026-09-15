// This component is now replaced by the full products page at /products
// Kept for backwards compatibility
import Link from 'next/link';

export default function PterodactylPackages() {
  return (
    <div className="py-8 text-center">
      <Link href="/products" className="px-6 py-3 rounded-xl font-bold text-white inline-block"
        style={{ background: 'linear-gradient(135deg, var(--blue), var(--blue-deep))' }}>
        View All Plans →
      </Link>
    </div>
  );
}
