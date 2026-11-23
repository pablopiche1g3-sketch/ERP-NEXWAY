'use client';

import React, { useState, useMemo } from 'react';
import { Search, Check, ChevronDown, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CAT_019_ACTIVIDADES } from '@/lib/hacienda-sv-catalogs';

interface HaciendaGiroSelectorProps {
  codActividad?: string;
  descActividad?: string;
  onSelect: (codActividad: string, descActividad: string) => void;
  placeholder?: string;
  compact?: boolean;
}

export function HaciendaGiroSelector({
  codActividad,
  descActividad,
  onSelect,
  placeholder = 'Buscar giro por código CAT-019 o palabra...',
  compact = false
}: HaciendaGiroSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CAT_019_ACTIVIDADES.slice(0, 60);
    return CAT_019_ACTIVIDADES.filter(
      (a) =>
        a.codigo.toLowerCase().includes(q) ||
        a.descripcion.toLowerCase().includes(q)
    ).slice(0, 60);
  }, [query]);

  const displayLabel = descActividad
    ? `${codActividad ? `[${codActividad}] ` : ''}${descActividad}`
    : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between font-normal text-left ${
            compact ? 'h-8 text-xs px-2.5' : 'h-9 text-xs px-3'
          } rounded-lg bg-background border-input`}
        >
          <span className="truncate flex items-center gap-1.5">
            <Briefcase size={12} className="text-indigo-500 shrink-0" />
            {displayLabel ? (
              <span className="font-semibold text-foreground truncate">{displayLabel}</span>
            ) : (
              <span className="text-muted-foreground truncate">{placeholder}</span>
            )}
          </span>
          <ChevronDown size={13} className="text-muted-foreground shrink-0 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] max-w-[92vw] p-0 bg-popover border-border shadow-xl rounded-xl" align="start">
        <div className="p-2.5 border-b border-border space-y-1.5">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej: 47522, ferretería, pintura, taller, restaurante..."
              className="h-8 pl-8 text-xs rounded-lg bg-background"
            />
          </div>
          <div className="text-[10px] text-muted-foreground flex justify-between">
            <span>Catálogo Oficial MH El Salvador (CAT-019)</span>
            <span>{filtered.length} resultados</span>
          </div>
        </div>
        <ScrollArea className="h-64">
          <div className="p-1 space-y-0.5">
            {filtered.length === 0 ? (
              <div className="p-4 text-center space-y-2">
                <p className="text-xs text-muted-foreground">No encontrado en el catálogo rápido.</p>
                {query.trim() && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] font-bold rounded-lg"
                    onClick={() => {
                      onSelect('96092', query.trim());
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    Usar giro personalizado: &quot;{query.trim()}&quot;
                  </Button>
                )}
              </div>
            ) : (
              filtered.map((item) => {
                const isSelected = codActividad === item.codigo || descActividad === item.descripcion;
                return (
                  <button
                    key={item.codigo}
                    type="button"
                    onClick={() => {
                      onSelect(item.codigo, item.descripcion);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-start gap-2 transition-colors ${
                      isSelected
                        ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'hover:bg-accent text-foreground'
                    }`}
                  >
                    <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0 mt-0.5">
                      {item.codigo}
                    </span>
                    <span className="flex-1 leading-snug">{item.descripcion}</span>
                    {isSelected && <Check size={13} className="text-indigo-500 shrink-0 mt-0.5" />}
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
