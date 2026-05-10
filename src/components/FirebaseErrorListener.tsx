
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: any) => {
      // En desarrollo, esto permitirá que el overlay de Next.js muestre el error contextual
      if (process.env.NODE_ENV === 'development') {
        throw error;
      } else {
        toast({
          variant: "destructive",
          title: "Error de Permisos",
          description: "No tienes autorización para realizar esta operación.",
        });
      }
    };

    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  return null;
}
