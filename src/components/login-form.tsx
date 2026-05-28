"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ShieldCheck, Loader2, AlertCircle, Mail, Lock } from "lucide-react"
import { useRouter } from "next/navigation"
import { signInWithEmailAndPassword } from "firebase/auth"

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
import { useAuth } from "@/firebase"
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
  const auth = useAuth()

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
    
    const email = values.email.toLowerCase()
    const password = values.password

    try {
      await signInWithEmailAndPassword(auth, email, password)
      toast({
        title: "Acceso exitoso",
        description: `Bienvenido al sistema.`,
      })
      router.push("/")
    } catch (error: any) {
      console.error(error)
      let message = "Correo o contraseña incorrectos."
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
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
    <Card className="border-none shadow-2xl bg-white rounded-[2rem] py-4">
      <CardHeader className="flex flex-col items-center space-y-4 pt-8">
        <div className="w-16 h-16 bg-[#2563eb] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
          <ShieldCheck className="w-10 h-10 text-white" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-headline">
            NexWay ERP
          </h1>
          <p className="text-slate-400 text-sm">
            Acceso al Sistema
          </p>
        </div>
      </CardHeader>
      <CardContent className="px-10 pb-8">
        {authError && (
          <Alert variant="destructive" className="mb-6 rounded-xl bg-red-50 border-red-100 text-red-900">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-bold">Error</AlertTitle>
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
                <FormItem>
                  <FormLabel className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                    Correo Electrónico
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input 
                        type="email"
                        placeholder="ejemplo@correo.com" 
                        {...field} 
                        className="pl-10 bg-slate-50 border-slate-100 h-12 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl px-4 text-slate-900 transition-all"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                    Contraseña
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        type="password"
                        placeholder="•••••"
                        {...field}
                        className="pl-10 bg-slate-50 border-slate-100 h-12 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl px-4 text-slate-900 transition-all"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full bg-[#2563eb] text-white hover:bg-blue-700 transition-all duration-300 font-bold h-12 rounded-xl shadow-lg shadow-blue-500/30"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
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
