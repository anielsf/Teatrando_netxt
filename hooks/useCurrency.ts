/**
 * Hook: useCurrency
 * Obtiene la tasa BCV y convierte precios USD → VES
 * Migrado de currencyService.js
 */
'use client';

import { useCallback, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';


export function useCurrency() {
  const { tasaBCV, setTasaBCV } = useAppStore();

  const fetchTasa = useCallback(async () => {
    try {
      const res = await fetch('/api/tasa-bcv');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.tasa > 0) {
          setTasaBCV(data.tasa);
        }
      }
    } catch {
      // Conserva la última tasa verificada en el store. No sustituimos
      // la tasa oficial por un número fijo que pueda quedar desactualizado.
    }
  }, [setTasaBCV]);

  useEffect(() => {
    fetchTasa();
  }, [fetchTasa]);

  const formatUSD = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatVES = (amount: number): string => {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'VES',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const convertToVES = (usd: number): number => {
    return Math.round(usd * tasaBCV * 100) / 100;
  };

  return {
    tasaBCV,
    formatUSD,
    formatVES,
    convertToVES,
    refreshTasa: fetchTasa,
  };
}
