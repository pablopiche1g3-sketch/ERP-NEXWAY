
"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ShieldCheck, Loader2, Info } from "lucide-react"
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

const formSchema = z.object({
  email: z.string().email({
    message: "Ingrese un correo válido.",
  }),
  password: z.string().min(6, {
    message: "La contraseña debe tener al menos 6 caracteres.",
  }),
})

export default function LoginForm() {
  const [isLoading, setIsLoading] = React.useState(false)
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
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password)
      toast({
        title: "Bienvenido",
        description: "Acceso concedido a NexWay ERP.",
      })
      router.push("/dashboard")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error de autenticación",
        description: "Usuario o contraseña incorrectos. Asegúrese de haber creado el usuario en la consola de Firebase.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoAccess = () => {
    form.setValue("email", "admin@nexway.erp")
    form.setValue("password", "password123")
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
            Sistema de Gestión Empresarial
          </p>
        </div>
      </CardHeader>
      <CardContent className="px-10 pb-8">
        <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-xs text-blue-700">
            <p className="font-bold mb-1">Credenciales sugeridas:</p>
            <p>Email: admin@nexway.erp</p>
            <p>Pass: password123</p>
            <button 
              onClick={handleDemoAccess}
              className="mt-2 text-blue-800 font-bold hover:underline"
            >
              Autocompletar ahora
            </button>
          </div>
        </div>

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
                    <Input 
                      placeholder="usuario@nexway.com" 
                      {...field} 
                      className="bg-slate-50 border-slate-100 h-12 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl px-4 text-slate-900 transition-all"
                    />
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
                      placeholder="••••••••"
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
                  Verificando...
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
