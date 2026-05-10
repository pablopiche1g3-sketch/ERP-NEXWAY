
import { redirect } from 'next/navigation';

export default function DashboardPage() {
  // Redirigir la antigua ruta del dashboard a la raíz
  redirect('/');
}
