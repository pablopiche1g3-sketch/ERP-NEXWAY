
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
      {/* Dynamic ambient background orbs */}
      <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-tint-glow2/20 to-tint-glow1/0 dark:from-tint-glow2/10 dark:to-transparent blur-[120px] transform-gpu animate-pulse duration-5000" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tl from-tint-glow1/20 to-tint-glow2/0 dark:from-tint-glow1/10 dark:to-transparent blur-[120px] transform-gpu animate-pulse duration-7000" />
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a08_1px,transparent_1px),linear-gradient(to_bottom,#0f172a08_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      {/* Main card container */}
      <div className="w-full max-w-[440px] relative z-10 animate-fade-in">
        <LoginForm />
      </div>
    </div>
  );
}
