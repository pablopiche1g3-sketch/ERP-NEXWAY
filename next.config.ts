import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      { source: '/quotations', destination: '/billing?tab=cotizaciones', permanent: false },
      { source: '/orders', destination: '/compras?tab=ordenes', permanent: false },
      { source: '/customers', destination: '/directorio?tab=clientes', permanent: false },
      { source: '/suppliers', destination: '/directorio?tab=proveedores', permanent: false },
      { source: '/inventory', destination: '/logistica?tab=inventario', permanent: false },
      { source: '/transfers', destination: '/logistica?tab=traslados', permanent: false },
      { source: '/documents', destination: '/management?tab=documental', permanent: false },
      { source: '/quedan', destination: '/finanzas?tab=quedan', permanent: false }
    ];
  },
};

export default nextConfig;
