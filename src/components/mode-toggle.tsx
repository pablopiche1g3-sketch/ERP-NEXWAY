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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ModeToggle() {
  const { setTheme } = useTheme()

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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}