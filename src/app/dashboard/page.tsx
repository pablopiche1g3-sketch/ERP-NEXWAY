
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirigir la antigua ruta del dashboard a la raíz de forma limpia
    router.replace('/');
  }, [router]);

  return null;
}
