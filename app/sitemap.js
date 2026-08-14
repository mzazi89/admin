// sitemap.xml — SEO
export default function sitemap() {
  const base = 'https://www.mzazi.shop';
  const now = new Date().toISOString().split('T')[0];
  const routes = [
    '', '/products', '/whatsapp-bot', '/temp-number', '/api', '/api/docs',
    '/api/explorer', '/api/status', '/testimonials', '/about', '/contact',
    '/signup', '/login', '/terms', '/privacy',
  ];
  return routes.map(r => ({
    url: `${base}${r}`,
    lastModified: now,
    changeFrequency: r === '' ? 'weekly' : 'monthly',
    priority: r === '' ? 1 : r.startsWith('/api') ? 0.8 : 0.6,
  }));
}
