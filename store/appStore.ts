/**
 * Zustand Store — Estado global de Teatrando
 * Reemplaza el store.js reactivo manual del proyecto vanilla
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserRole = 'Visitante' | 'Usuario' | 'Crítico' | 'Admin' | 'Grupo th';

export interface TeatrandoUser {
  id: string;
  email: string;
  nombre: string;
  rol: UserRole;
  plan: string;
  avatar_url?: string;
}

export interface Cartelera {
  id: string;
  obra: string;
  funcion: string;
  fecha: string;
  hora: string;
  imagen?: string;
  precio_usd: number;
  genero?: string;
  sala?: string;
  director?: string;
  duracion_min?: number;
  edad_minima?: string;
  sinopsis?: string;
  reparto?: string;
  visible: boolean;
  grupo_teatral?: string;
  id_usuario_grupo?: string;
  butacas_disponibles?: number;
  aforo_total?: number;
  teatroNombre?: string;
  teatroAforo?: number;
  criticas?: unknown[];
  comentarios?: unknown[];
  likes?: number;
}

export interface SeasonalTheme {
  id?: number;
  nombre?: string;
  color_primario: string;
  color_secundario: string;
  color_acento: string;
  color_fondo: string;
  color_texto: string;
  color_texto_suave: string;
  border_radius: string;
  font_familia: string;
  hero_image_url?: string;
}

// ─── Store ───────────────────────────────────────────────────────
interface AppState {
  // Usuario
  user: TeatrandoUser | null;
  setUser: (user: TeatrandoUser | null) => void;

  // Carteleras
  carteleras: Cartelera[];
  setCarteleras: (carteleras: Cartelera[]) => void;
  carteleraSeleccionada: Cartelera | null;
  setCarteleraSeleccionada: (cartelera: Cartelera | null) => void;

  // Tasa BCV
  tasaBCV: number;
  setTasaBCV: (tasa: number) => void;

  // Tema estacional
  tema: SeasonalTheme;
  setTema: (tema: SeasonalTheme) => void;

  // Asientos seleccionados en el checkout
  asientosSeleccionados: string[];
  setAsientosSeleccionados: (asientos: string[]) => void;

  // Vista activa (para transiciones suaves)
  activeView: string;
  setActiveView: (view: string) => void;
}

const temaDefault: SeasonalTheme = {
  color_primario:    '#c9a24b',
  color_secundario:  '#8b1a2e',
  color_acento:      '#d4af37',
  color_fondo:       '#0d0507',
  color_texto:       '#f5e6c8',
  color_texto_suave: '#d8c9b3',
  border_radius:     '6px',
  font_familia:      'Playfair Display',
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),

      carteleras: [],
      setCarteleras: (carteleras) => set({ carteleras }),
      carteleraSeleccionada: null,
      setCarteleraSeleccionada: (cartelera) => set({ carteleraSeleccionada: cartelera }),

      tasaBCV: 0,
      setTasaBCV: (tasa) => set({ tasaBCV: tasa }),

      tema: temaDefault,
      setTema: (tema) => set({ tema }),

      asientosSeleccionados: [],
      setAsientosSeleccionados: (asientos) => set({ asientosSeleccionados: asientos }),

      activeView: 'home',
      setActiveView: (view) => set({ activeView: view }),
    }),
    {
      name: 'teatrando-store-v2',
      storage: createJSONStorage(() => sessionStorage),
      // Solo persistir lo necesario (no las carteleras completas)
      partialize: (state) => ({
        tasaBCV: state.tasaBCV,
        tema: state.tema,
      }),
    }
  )
);
