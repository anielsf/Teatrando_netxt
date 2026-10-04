/**
 * ThemeProvider — Inyecta las variables CSS del tema estacional activo
 * Se ejecuta en el cliente y actualiza las CSS Variables en :root
 */
'use client';

import { useEffect } from 'react';
import { useAppStore, type SeasonalTheme } from '@/store/appStore';

function applyThemeToCSSVars(tema: SeasonalTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Colores Base
  root.style.setProperty('--color-primario',    tema.color_primario);
  root.style.setProperty('--color-secundario',  tema.color_secundario);
  root.style.setProperty('--color-acento',      tema.color_acento);
  root.style.setProperty('--color-fondo',       tema.color_fondo);
  root.style.setProperty('--color-texto',       tema.color_texto);
  root.style.setProperty('--color-texto-suave', tema.color_texto_suave);
  root.style.setProperty('--border-radius',     tema.border_radius);

  // Border-radius derivados para componentes grandes (cards, modales, etc.)
  const brNum = parseInt(tema.border_radius, 10);
  if (!isNaN(brNum)) {
    root.style.setProperty('--border-radius-lg', `${Math.round(brNum * 1.5)}px`);
    root.style.setProperty('--border-radius-xl', `${Math.round(brNum * 2)}px`);
  }

  // Tipografía con selector de fallback inteligente (sans vs serif)
  const isSans = ['Inter', 'Sora', 'system-ui', 'sans-serif'].some((f) =>
    tema.font_familia?.toLowerCase().includes(f.toLowerCase())
  );
  root.style.setProperty(
    '--font-familia',
    `'${tema.font_familia}', ${isSans ? 'Inter, system-ui, sans-serif' : 'Georgia, serif'}`
  );

  // Tokens de superficie y borde (soporta configuracion jsonb o deducción contextual)
  const cfg = tema.configuracion || {};
  const superficie =
    cfg.panel ||
    (tema.color_fondo === '#161a18' ? '#232a27' : tema.color_secundario);
  const panelAlt = cfg.panel_alt || '#2a322e';
  const panelSunken = cfg.panel_sunken || '#1a201d';
  const borde =
    cfg.line ||
    (tema.color_fondo === '#161a18' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.12)');
  const textoMuted =
    cfg.text_muted ||
    (tema.color_fondo === '#161a18' ? '#6b756d' : tema.color_texto_suave);

  root.style.setProperty('--color-superficie', superficie);
  root.style.setProperty('--color-borde', borde);
  root.style.setProperty('--color-texto-muted', textoMuted);
  root.style.setProperty('--panel-alt', panelAlt);
  root.style.setProperty('--panel-sunken', panelSunken);

  // Sombras y resplandores dinámicos basados en el color primario
  root.style.setProperty(
    '--sombra-glow',
    `0 0 24px color-mix(in srgb, ${tema.color_primario} 30%, transparent)`
  );

  // Tokens adicionales de acento (Microteatral Neón)
  if (cfg.pink) root.style.setProperty('--color-pink', cfg.pink);
  if (cfg.cyan) root.style.setProperty('--color-cyan', cfg.cyan);
  if (cfg.violet) root.style.setProperty('--color-violet', cfg.violet);
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
