import LoginForm from '@/components/login-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NexWay ERP - Acceso',
  description: 'Portal de acceso seguro al sistema de gestión NexWay ERP.',
};

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-[#0a1120]">
      <div className="w-full max-w-md">
        <LoginForm />
        <div className="text-center mt-8 text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} NexWay ERP. Todos los derechos reservados.</p>
        </div>
      </div>
    </main>
  );
}