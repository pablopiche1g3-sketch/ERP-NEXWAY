
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building, 
  ArrowLeft, 
  Save, 
  Loader2, 
  Globe, 
  Mail, 
  Phone, 
  MapPin, 
  FileText, 
  ShieldCheck,
  Building2,
  Hash,
  Briefcase,
  Target,
  Rocket
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore, useDoc } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function InstitutionalPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const profileRef = useMemo(() => doc(db, 'system', 'company_profile'), [db]);
  const { data: profile, loading } = useDoc<any>(profileRef);

  const [form, setForm] = useState({
    legalName: '',
    brandName: '',
    nit: '',
    nrc: '',
    giro: '',
    address: '',
    phone: '',
    email: '',
    vision: '',
    mission: ''
  });

  useEffect(() => {
    if (profile) {
      setForm({
        legalName: profile.legalName || '',
        brandName: profile.brandName || '',
        nit: profile.nit || '',
        nrc: profile.nrc || '',
        giro: profile.giro || '',
        address: profile.address || '',
        phone: profile.phone || '',
        email: profile.email || '',
        vision: profile.vision || '',
        mission: profile.mission || ''
      });
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(profileRef, {
        ...form,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast({ title: "Perfil Institucional Guardado", description: "La información corporativa ha sido actualizada exitosamente." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el perfil institucional." });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Perfil Institucional</h1>
            <p className="text-slate-500 text-sm">Información legal y corporativa de la institución</p>
          </div>
        </div>
        <Button 
          form="institutional-form" 
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 px-8"
        >
          {isSaving ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
          Guardar Cambios
        </Button>
      </div>

      <form id="institutional-form" onSubmit={handleSave} className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-6">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="text-blue-400" size={20} />
                Datos Legales y Tributarios
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Razón Social (Nombre Legal)</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    placeholder="Nombre legal de la empresa..." 
                    value={form.legalName}
                    onChange={e => setForm({...form, legalName: e.target.value})}
                    className="h-12 pl-10 bg-slate-50 border-slate-100 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Nombre Comercial</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    placeholder="Marca o nombre público..." 
                    value={form.brandName}
                    onChange={e => setForm({...form, brandName: e.target.value})}
                    className="h-12 pl-10 bg-slate-50 border-slate-100 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">NIT</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <Input 
                      placeholder="0000-000000-000-0" 
                      value={form.nit}
                      onChange={e => setForm({...form, nit: e.target.value})}
                      className="h-12 pl-10 bg-slate-50 border-slate-100 rounded-xl font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">NRC</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <Input 
                      placeholder="Registro contribuyente..." 
                      value={form.nrc}
                      onChange={e => setForm({...form, nrc: e.target.value})}
                      className="h-12 pl-10 bg-slate-50 border-slate-100 rounded-xl font-mono"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Giro Comercial</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    placeholder="Actividad económica principal..." 
                    value={form.giro}
                    onChange={e => setForm({...form, giro: e.target.value})}
                    className="h-12 pl-10 bg-slate-50 border-slate-100 rounded-xl"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-6">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MapPin className="text-blue-600" size={20} />
                Contacto y Ubicación
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Dirección Principal</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-slate-400" size={16} />
                  <Textarea 
                    placeholder="Dirección física exacta para documentos..." 
                    value={form.address}
                    onChange={e => setForm({...form, address: e.target.value})}
                    className="min-h-[100px] pl-10 bg-slate-50 border-slate-100 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Teléfono</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <Input 
                      placeholder="2222-0000" 
                      value={form.phone}
                      onChange={e => setForm({...form, phone: e.target.value})}
                      className="h-12 pl-10 bg-slate-50 border-slate-100 rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Correo Institucional</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <Input 
                      placeholder="info@empresa.com" 
                      value={form.email}
                      onChange={e => setForm({...form, email: e.target.value})}
                      className="h-12 pl-10 bg-slate-50 border-slate-100 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-blue-600 rounded-[2rem] p-8 text-white shadow-xl shadow-blue-500/20">
             <Building size={48} className="mb-4 opacity-40" />
             <h3 className="text-xl font-bold mb-2">Identidad Corporativa</h3>
             <p className="text-blue-100 text-sm leading-relaxed mb-6">
               Defina la proyección de su institución. Esta información puede ser utilizada en portales, presentaciones y reportes ejecutivos.
             </p>
             <div className="space-y-4">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-blue-200 flex items-center gap-2">
                      <Target size={14} /> Misión
                   </Label>
                   <Textarea 
                     placeholder="Nuestra razón de ser..." 
                     value={form.mission}
                     onChange={e => setForm({...form, mission: e.target.value})}
                     className="bg-white/10 border-white/20 text-white placeholder:text-white/40 min-h-[120px] rounded-2xl"
                   />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-blue-200 flex items-center gap-2">
                      <Rocket size={14} /> Visión
                   </Label>
                   <Textarea 
                     placeholder="Hacia dónde vamos..." 
                     value={form.vision}
                     onChange={e => setForm({...form, vision: e.target.value})}
                     className="bg-white/10 border-white/20 text-white placeholder:text-white/40 min-h-[120px] rounded-2xl"
                   />
                </div>
             </div>
          </div>

          <Card className="border-none shadow-sm rounded-3xl bg-slate-900 text-white overflow-hidden">
             <CardContent className="p-8 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center">
                   <FileText size={24} />
                </div>
                <div>
                   <h4 className="font-bold text-lg">Control Documental</h4>
                   <p className="text-slate-400 text-xs leading-relaxed">
                      La información de NIT y NRC es crítica para la generación de la firma electrónica y facturación digital en el futuro. Asegúrese de que coincidan exactamente con su tarjeta de IVA.
                   </p>
                </div>
             </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
