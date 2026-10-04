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

  // ── Detección de tema claro vs oscuro ──────────────────────────
  // Calcula la luminancia del color de fondo para saber si es claro u oscuro
  const hexToRgb = (hex: string) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return { r, g, b };
  };
  const { r, g, b } = hexToRgb(tema.color_fondo.slice(0, 7));
  const luminancia = 0.299 * r + 0.587 * g + 0.114 * b;
  const esTemaClaro = luminancia > 0.5;

  root.setAttribute('data-tema', esTemaClaro ? 'claro' : 'oscuro');

  // ── Tokens de superficie y borde ──────────────────────────────
  const cfg = tema.configuracion || {};

  let superficie: string;
  let borde: string;
  let textoMuted: string;
  let panelAlt: string;
  let panelSunken: string;
  let sombraCard: string;

  if (cfg.panel) {
    // Configuración explícita desde JSONB (ej. Microteatral Neón)
    superficie   = cfg.panel;
    panelAlt     = cfg.panel_alt    || superficie;
    panelSunken  = cfg.panel_sunken || superficie;
    borde        = cfg.line         || 'rgba(255,255,255,0.08)';
    textoMuted   = cfg.text_muted   || tema.color_texto_suave;
    sombraCard   = '0 4px 24px rgba(0,0,0,0.5)';
  } else if (esTemaClaro) {
    // Tema claro — superficies con mezcla blanca
    superficie  = '#ffffff';
    panelAlt    = '#f0f0f0';
    panelSunken = '#e8e8e8';
    borde       = 'rgba(0,0,0,0.12)';
    textoMuted  = '#888888';
    sombraCard  = '0 2px 16px rgba(0,0,0,0.10)';
  } else {
    // Tema oscuro estándar — superficies ligeramente más claras que el fondo
    superficie  = tema.color_secundario;
    panelAlt    = '#2a322e';
    panelSunken = '#1a201d';
    borde       = 'rgba(255,255,255,0.10)';
    textoMuted  = tema.color_texto_suave;
    sombraCard  = '0 4px 24px rgba(0,0,0,0.5)';
  }

  root.style.setProperty('--color-superficie', superficie);
  root.style.setProperty('--color-borde',       borde);
  root.style.setProperty('--color-texto-muted', textoMuted);
  root.style.setProperty('--panel-alt',         panelAlt);
  root.style.setProperty('--panel-sunken',      panelSunken);
  root.style.setProperty('--sombra-card',       sombraCard);

  // Resplandor dinámico basado en el color primario
  root.style.setProperty(
    '--sombra-glow',
    `0 0 24px color-mix(in srgb, ${tema.color_primario} ${esTemaClaro ? '25%' : '30%'}, transparent)`
  );

  // Tokens de acento adicionales (Microteatral Neón)
  if (cfg.pink)   root.style.setProperty('--color-pink',   cfg.pink);
  if (cfg.cyan)   root.style.setProperty('--color-cyan',   cfg.cyan);
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
