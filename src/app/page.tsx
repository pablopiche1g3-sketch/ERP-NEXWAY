import LoginForm from '@/components/login-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ERP Login - Access Portal',
  description: 'Secure access to your enterprise resource planning dashboard.',
};

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-2 shadow-lg shadow-primary/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white"
            >
              <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
              <path d="m3 9 2.45-4.91A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.79 1.09L21 9" />
              <path d="M12 3v6" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
            ERP Portal
          </h1>
          <p className="text-muted-foreground text-sm max-w-[280px]">
            Please enter your credentials to access the management system.
          </p>
        </div>

        <LoginForm />

        <div className="text-center text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} ERP Solutions Inc. All rights reserved.</p>
        </div>
      </div>
    </main>
  );
}
