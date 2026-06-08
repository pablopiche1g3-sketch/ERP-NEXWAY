"use client"

import * as React from "react"
import { Moon, Sun, Palette } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ModeToggle() {
  const { setTheme } = useTheme()
  const [colorTheme, setColorTheme] = React.useState('default')

  React.useEffect(() => {
    document.documentElement.setAttribute('data-color-theme', colorTheme)
  }, [colorTheme])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full shadow-sm bg-background border-border hover:bg-accent transition-all relative overflow-hidden group">
<Palette className="h-[1.2rem] w-[1.2rem] text-tint-text transition-all" />
          <span className="sr-only">Cambiar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-2xl mt-2 w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Luminosidad</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme("light")} className="rounded-xl cursor-pointer">
          <Sun size={14} className="mr-2" /> Modo Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className="rounded-xl cursor-pointer">
          <Moon size={14} className="mr-2" /> Modo Noche
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")} className="rounded-xl cursor-pointer">
          <div className="w-3.5 mr-2 flex justify-center text-[10px] font-bold">💻</div> Sistema
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-border/50" />
        
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Tinte Leve</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setColorTheme('default')} className="rounded-xl cursor-pointer flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500" />
            Índigo (Predeterminado)
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setColorTheme('esmeralda')} className="rounded-xl cursor-pointer flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            Esmeralda
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setColorTheme('rosa')} className="rounded-xl cursor-pointer flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500" />
            Rosa
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setColorTheme('ambar')} className="rounded-xl cursor-pointer flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            Ámbar
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}