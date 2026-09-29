import { Navbar } from '@/components/Navbar';
import { requireAdminOrGrupoTH } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdminDashboard } from '@/components/AdminDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const result = await requireAdminOrGrupoTH();

  if (result instanceof Response) {
    if (result.status === 401) {
      redirect('/auth?next=/admin');
    }
    redirect('/');
  }

  const { user } = result;
  const isGrupoTH = user.rol === 'Grupo th';

  return (
    <>
      <Navbar />

      <main
        className="contenedor"
        style={{
          padding: '2.5rem 1.5rem 4rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p
              style={{
                color: 'var(--color-primario)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontSize: '0.8rem',
                marginBottom: '0.25rem',
              }}
            >
              {isGrupoTH ? 'Panel de Gestión Teatral' : 'Control Central Teatrando'}
            </p>
            <h1
              style={{
                fontFamily: 'var(--font-familia)',
                color: 'var(--color-primario)',
                fontSize: '2.2rem',
                marginBottom: '0.5rem',
              }}
            >
              {isGrupoTH ? `Gestión Teatral: ${user.nombre}` : 'Panel de Administración'}
            </h1>
            <p
              style={{
                color: 'var(--color-texto-suave)',
                fontSize: '0.95rem',
              }}
            >
              Bienvenido, <strong>{user.nombre}</strong> ({user.rol}). Creación y control de carteleras, gestión de butacas y visualización de estadísticas.
            </p>
          </div>
        </div>

        <AdminDashboard user={user} />
      </main>
    </>
  );
}