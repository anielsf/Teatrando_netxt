'use client';

import { useAuth } from '@/hooks/useAuth';
import { Navbar } from '@/components/Navbar';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminPage() {
  const { user, session, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Solo redirigir si ya terminó de cargar la sesión y se confirma que NO es admin
    if (!loading && session && !isAdmin) {
      router.push('/');
    } else if (!loading && !session) {
      router.push('/auth');
    }
  }, [session, isAdmin, loading, router]);

  if (loading || (session && !user)) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--color-texto-suave)' }}>
        Cargando panel de administración...
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Navbar />
      <main className="contenedor" style={{ padding: '3rem 1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', marginBottom: '1rem' }}>
          Panel de Administración
        </h1>
        <p style={{ color: 'var(--color-texto-suave)' }}>
          Bienvenido, {user?.nombre}. Gestión autorizada para carteleras, teatros y configuraciones del sistema.
        </p>
      </main>
    </>
  );
}