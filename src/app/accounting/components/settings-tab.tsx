'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface SettingsData {
  accountingLevel: string;
  taxProfile: string;
  ivaRate: number;
  pagoCuentaRate: number;
}

interface SettingsTabProps {
  settings: SettingsData;
  onSave: (s: SettingsData) => void;
  onChange: (s: SettingsData) => void;
}

export function SettingsTab({ settings, onSave, onChange }: SettingsTabProps) {
  return (
    <Card className="border shadow-sm rounded-2xl bg-white dark:bg-card border-slate-100 dark:border-border">
      <CardHeader className="bg-slate-900 dark:bg-zinc-950 text-white p-6">
        <CardTitle className="text-sm font-black flex items-center gap-2">
          Configuración Contable
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-muted/40 border dark:border-border rounded-2xl">
            <div className="space-y-1 max-w-[75%]">
              <Label className="font-bold text-xs text-slate-900 dark:text-foreground block">Nivel de Contabilidad (Doble Entrada)</Label>
              <span className="text-[10px] text-slate-500 dark:text-muted-foreground block leading-normal">
                Activa el Libro Diario profesional con registros de partidas con Debe y Haber balanceados.
              </span>
            </div>
            <Switch
              id="accountingLevel"
              checked={settings.accountingLevel === 'Avanzado'}
              onCheckedChange={(checked) => onChange({
                ...settings,
                accountingLevel: checked ? 'Avanzado' : 'Simplificado'
              })}
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-muted/40 border dark:border-border rounded-2xl">
            <div className="space-y-1 max-w-[75%]">
              <Label className="font-bold text-xs text-slate-900 dark:text-foreground block">Clasificación: Gran Contribuyente</Label>
              <span className="text-[10px] text-slate-500 dark:text-muted-foreground block leading-normal">
                Habilita la aplicación automática de la retención del 1% de IVA.
              </span>
            </div>
            <Switch
              id="taxProfile"
              checked={settings.taxProfile === 'Gran Contribuyente'}
              onCheckedChange={(checked) => onChange({
                ...settings,
                taxProfile: checked ? 'Gran Contribuyente' : 'Normal'
              })}
            />
          </div>
        </div>
        <div className="space-y-4 bg-slate-50/50 dark:bg-muted/30 p-6 rounded-2xl border border-slate-100 dark:border-border">
          <h4 className="font-black text-slate-800 dark:text-foreground text-xs uppercase tracking-wider mb-2">Tasas Tributarias Configurables</h4>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase text-slate-400 dark:text-muted-foreground">Porcentaje del IVA Local (%)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={settings.ivaRate}
                onChange={(e) => onChange({ ...settings, ivaRate: parseFloat(e.target.value) || 0 })}
                className="h-10 text-xs rounded-xl bg-white dark:bg-card border-slate-200 dark:border-border w-24 font-black text-foreground"
              />
              <Button variant="secondary" size="sm" onClick={() => onSave(settings)} className="rounded-xl text-[10px] font-bold h-10 px-4 dark:bg-muted dark:text-foreground dark:hover:bg-muted/80">
                Actualizar
              </Button>
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <Label className="text-[10px] font-bold uppercase text-slate-400 dark:text-muted-foreground">Tasa Mensual de Pago a Cuenta (%)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                value={settings.pagoCuentaRate}
                onChange={(e) => onChange({ ...settings, pagoCuentaRate: parseFloat(e.target.value) || 0 })}
                className="h-10 text-xs rounded-xl bg-white dark:bg-card border-slate-200 dark:border-border w-24 font-black text-foreground"
              />
              <Button variant="secondary" size="sm" onClick={() => onSave(settings)} className="rounded-xl text-[10px] font-bold h-10 px-4 dark:bg-muted dark:text-foreground dark:hover:bg-muted/80">
                Actualizar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
