"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ShieldCheck, Loader2, AlertCircle, Mail, Lock } from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/supabase/client"
import { isAdminEmail } from "@/lib/admin-emails"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const formSchema = z.object({
  email: z.string().email({
    message: "Por favor, ingresa un correo electrónico válido.",
  }),
  password: z.string().min(5, {
    message: "La contraseña debe tener al menos 5 caracteres.",
  }),
})

export default function LoginForm() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [authError, setAuthError] = React.useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    setAuthError(null)
    
    const email = values.email.toLowerCase().trim()
    const password = values.password

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error;
      }

      toast({
        title: "Acceso exitoso",
        description: `Bienvenido al sistema.`,
      })
      router.push("/")
    } catch (error: any) {
      console.error(error)
      let message = "Correo o contraseña incorrectos."
      
      const userIsAdmin = isAdminEmail(email);

      if (userIsAdmin && (error.message.includes('Invalid login credentials') || error.message.includes('not found'))) {
        try {
          // Intentar auto-registro para administradores si no existe el usuario en Auth
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
          })
          
          if (signUpError) throw signUpError;
          
          toast({
            title: "Acceso Exitoso (Auto-Registro)",
            description: "Su usuario administrativo ha sido creado e ingresado con éxito.",
          })
          router.push("/")
          return;
        } catch (regErr: any) {
          if (regErr.message?.includes('already registered')) {
            message = "La contraseña ingresada es incorrecta para este correo."
          } else {
            message = `Error de registro: ${regErr.message}`
          }
        }
      } else {
        message = "El correo electrónico no está registrado o la contraseña es incorrecta."
      }
      
      setAuthError(message)
      toast({
        variant: "destructive",
        title: "Error de acceso",
        description: message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border border-border shadow-md bg-card rounded-[2.5rem] py-4 relative overflow-hidden transition-all duration-300">
      
      <CardHeader className="flex flex-col items-center space-y-4 pt-8">
        <div className="relative group">
          <div className="relative w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-105">
            <ShieldCheck className="w-9 h-9 text-primary-foreground" />
          </div>
        </div>
        
        <div className="text-center space-y-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground font-headline">
            NexWay ERP
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            Acceso al Sistema
          </p>
        </div>
      </CardHeader>

      <CardContent className="px-8 sm:px-10 pb-8">
        {authError && (
          <Alert variant="destructive" className="mb-6 rounded-2xl bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900/40 text-red-900 dark:text-red-300">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-bold">Error de acceso</AlertTitle>
            <AlertDescription className="text-xs">
              {authError}
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
                    Usuario o Correo
                  </FormLabel>
                  <FormControl>
                    <div className="relative group">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400/80 w-4 h-4 transition-colors group-focus-within:text-blue-500" />
                      <Input 
                        type="text"
                        placeholder="Ingresa tu usuario o correo" 
                        {...field} 
                        className="pl-11 pr-4 bg-background border-input h-12 rounded-xl text-foreground placeholder:text-muted-foreground transition-all font-medium"
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs text-red-500" />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <div className="flex justify-between items-center">
                    <FormLabel className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
                      Contraseña
                    </FormLabel>
                  </div>
                  <FormControl>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400/80 w-4 h-4 transition-colors group-focus-within:text-blue-500" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        className="pl-11 pr-4 bg-background border-input h-12 rounded-xl text-foreground placeholder:text-muted-foreground transition-all font-medium"
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs text-red-500" />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando credenciales...
                </>
              ) : (
                "Entrar al Sistema"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
