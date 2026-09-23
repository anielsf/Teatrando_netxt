import { Navbar } from '@/components/Navbar';
import { requireAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  /**
   * La autorización se realiza en el servidor.
   *
   * requireAdmin():
   *  1. Obtiene el usuario autenticado mediante Supabase.
   *  2. Consulta public.profiles.
   *  3. Obtiene profiles.rol.
   *  4. Comprueba que rol === "Admin".
   *
   * Esto evita depender de:
   *   session.user.user_metadata.rol
   *
   * que era el problema del middleware anterior.
   */
  const result = await requireAdmin();

  /**
   * Si requireAdmin() devuelve una Response,
   * significa que:
   *
   * 401 -> no está autenticado
   * 403 -> está autenticado pero no es Admin
   */
  if (result instanceof Response) {
    if (result.status === 401) {
      redirect('/auth?next=/admin');
    }

    redirect('/');
  }

  /**
   * En este punto el usuario ya está autorizado.
   */
  const { user } = result;

  return (
    <>
      <Navbar />

      <main
        className="contenedor"
        style={{
          padding: '3rem 1.5rem',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-familia)',
            color: 'var(--color-primario)',
            marginBottom: '1rem',
          }}
        >
          Panel de Administración
        </h1>

        <p
          style={{
            color: 'var(--color-texto-suave)',
          }}
        >
          Bienvenido, {user.nombre}. Gestión autorizada para
          carteleras, teatros y configuraciones del sistema.
        </p>
      </main>
    </>
  );
}