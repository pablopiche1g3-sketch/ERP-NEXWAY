import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NexWay ERP',
    short_name: 'NexWay ERP',
    description: 'Sistema de Planificación de Recursos Empresariales NexWay - Facturación y Gestión',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#5b5ef4',
    orientation: 'any',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
