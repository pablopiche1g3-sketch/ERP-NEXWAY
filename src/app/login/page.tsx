
'use client';

import LoginForm from "@/components/login-form";
import {  useUser  } from '@/supabase/compat';
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={40} />
          <p className="text-slate-400/80 text-sm font-medium animate-pulse">
            Iniciando sesión segura...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 sm:p-6 overflow-hidden relative transition-colors duration-300">
      {/* Main card container */}
      <div className="w-full max-w-[440px] relative z-10 animate-fade-in">
        <LoginForm />
      </div>
    </div>
  );
}
