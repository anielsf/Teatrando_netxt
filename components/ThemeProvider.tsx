/**
 * ThemeProvider — Inyecta las variables CSS del tema estacional activo
 * Se ejecuta en el cliente y actualiza las CSS Variables en :root
 */
'use client';

import { useEffect } from 'react';
import { useAppStore, type SeasonalTheme } from '@/store/appStore';

function applyThemeToCSSVars(tema: SeasonalTheme) {
  const root = document.documentElement;
  root.style.setProperty('--color-primario',    tema.color_primario);
  root.style.setProperty('--color-secundario',  tema.color_secundario);
  root.style.setProperty('--color-acento',      tema.color_acento);
  root.style.setProperty('--color-fondo',       tema.color_fondo);
  root.style.setProperty('--color-texto',       tema.color_texto);
  root.style.setProperty('--color-texto-suave', tema.color_texto_suave);
  root.style.setProperty('--border-radius',     tema.border_radius);
  root.style.setProperty('--font-familia',      `'${tema.font_familia}', Georgia, serif`);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { tema, setTema } = useAppStore();

  useEffect(() => {
    // Aplicar tema guardado inmediatamente
    applyThemeToCSSVars(tema);

    // Cargar el tema activo desde la API
    fetch('/api/temas')
      .then((res) => res.json())
      .then((temaActivo) => {
        if (temaActivo?.color_primario) {
          setTema(temaActivo);
          applyThemeToCSSVars(temaActivo);
        }
      })
      .catch(() => {
        // Mantener el tema por defecto si la API falla
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-aplicar cuando el tema cambia (por ejemplo, desde el panel de admin)
  useEffect(() => {
    applyThemeToCSSVars(tema);
  }, [tema]);

  return <>{children}</>;
}
