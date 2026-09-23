'use client';

import { useAuth } from '@/hooks/useAuth';
import { Navbar } from '@/components/Navbar';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/');
    }
  }, [isAdmin, loading, router]);

  if (loading) return <p style={{ textAlign: 'center', padding: '4rem' }}>Cargando panel...</p>;
  if (!isAdmin) return null;

  return (
    <>
      <Navbar />
      <main className="contenedor" style={{ padding: '3rem 1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', marginBottom: '1rem' }}>
          Panel de Administración
        </h1>
        <p style={{ color: 'var(--color-texto-suave)' }}>
          Bienvenido, {user?.nombre}. Aquí puedes gestionar las carteleras, teatros y usuarios del sistema.
        </p>
      </main>
    </>
  );
}