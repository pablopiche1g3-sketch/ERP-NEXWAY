-- Habilitar inserción de perfiles por parte del usuario autenticado
CREATE POLICY "Permitir a usuarios crear su propio perfil" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
