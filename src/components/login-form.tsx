
"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ShieldCheck, Loader2, Info, AlertCircle, User } from "lucide-react"
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
  username: z.string().min(2, {
    message: "El usuario debe tener al menos 2 caracteres.",
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
      username: "",
      password: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    setAuthError(null)
    
    const email = values.username.includes('@') ? values.username.toLowerCase() : `${values.username.toLowerCase()}@nexway.erp`
    const password = values.password.length === 5 ? values.password + "0" : values.password

    try {
      await signInWithEmailAndPassword(auth, email, password)
      toast({
        title: "Acceso exitoso",
        description: `Bienvenido, ${values.username}.`,
      })
      // Redirigir directamente a la raíz para evitar bucles de historial con /dashboard
      router.push("/")
    } catch (error: any) {
      console.error(error)
      let message = "Usuario o contraseña incorrectos."
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        message = "El usuario no existe o la contraseña es incorrecta."
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

  const handleDemoAccess = () => {
    form.setValue("username", "admin")
    form.setValue("password", "12345")
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
              <div className="mt-2 font-semibold">
                Tip: En Firebase crea el usuario "admin@nexway.erp" con clave "123450".
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-xs text-blue-700">
            <p className="font-bold mb-1">Acceso Rápido:</p>
            <p>Usuario: <strong>admin</strong></p>
            <p>Clave: <strong>12345</strong></p>
            <button 
              type="button"
              onClick={handleDemoAccess}
              className="mt-2 text-blue-800 font-bold hover:underline"
            >
              Completar ahora
            </button>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                    Nombre de Usuario
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input 
                        placeholder="ej. admin" 
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
                    <Input
                      type="password"
                      placeholder="•••••"
                      {...field}
                      className="bg-slate-50 border-slate-100 h-12 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl px-4 text-slate-900 transition-all"
                    />
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
