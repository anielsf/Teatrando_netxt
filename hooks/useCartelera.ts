/**
 * Hook: useCartelera
 * Gestiona la carga y filtrado de carteleras desde la API
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppStore, type Cartelera } from '@/store/appStore';

interface FiltrosCartelera {
  texto?: string;
  genero?: string;
  sala?: string;
  precioMin?: number;
  precioMax?: number;
}

export function useCartelera(adminView = false) {
  const { carteleras, setCarteleras } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosCartelera>({});

  const fetchCarteleras = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = adminView ? '/api/carteleras?admin=true' : '/api/carteleras';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Error al cargar carteleras');
      const data: Cartelera[] = await res.json();
      setCarteleras(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adminView, setCarteleras]);

  useEffect(() => {
    fetchCarteleras();
  }, [fetchCarteleras]);

  // Filtrado local en el cliente
  const cartelerasFiltradas = carteleras.filter((obra) => {
    if (filtros.texto) {
      const q = filtros.texto.toLowerCase();
      if (!obra.obra.toLowerCase().includes(q) && !obra.sinopsis?.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filtros.genero && obra.genero !== filtros.genero) return false;
    if (filtros.sala && obra.sala !== filtros.sala) return false;
    if (filtros.precioMin && obra.precio_usd < filtros.precioMin) return false;
    if (filtros.precioMax && obra.precio_usd > filtros.precioMax) return false;
    return true;
  });

  return {
    carteleras: cartelerasFiltradas,
    cartelerasRaw: carteleras,
    loading,
    error,
    filtros,
    setFiltros,
    refetch: fetchCarteleras,
  };
}
