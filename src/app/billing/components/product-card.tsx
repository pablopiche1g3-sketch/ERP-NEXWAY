'use client';

import { Plus } from 'lucide-react';

interface ProductCardProps {
  name: string;
  sku: string;
  stock: number;
  price: number;
  onClick: () => void;
}

export function ProductCard({ name, sku, stock, price, onClick }: ProductCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white/80 dark:bg-zinc-900/40 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-200/60 dark:border-zinc-800/60 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 hover:shadow-md cursor-pointer transition-all duration-300 flex flex-col justify-between aspect-square group relative"
    >
      <div className="space-y-1">
        <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded-full border border-indigo-500/10 font-mono">{sku}</span>
        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight line-clamp-2 mt-1.5">{name}</h4>
        <p className="text-[9px] text-slate-400 dark:text-muted-foreground font-bold">Stock: {stock}</p>
      </div>
      <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 flex justify-between items-center">
        <span className="text-xs font-black text-slate-900 dark:text-white font-headline">${price.toFixed(2)}</span>
        <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 active:scale-90 transition-all shadow-md shadow-indigo-600/20">
          <Plus className="text-white" size={12} />
        </div>
      </div>
    </div>
  );
}
