import { Navbar } from '@/components/Navbar';
import { TheaterStatistics } from '@/components/TheaterStatistics';

export const metadata = {
  title: 'Microteatral & Semanas Pasadas — Teatrando',
  description: 'Estadísticas institucionales y datos históricos del teatro.',
};

/**
 * Panel institucional público.
 *
 * Cualquier visitante puede consultar las semanas que el administrador
 * haya publicado. La edición de datos continúa restringida al Admin dentro
 * del panel de administración.
 */
export default function EstadisticasPage() {
  return (
    <>
      <Navbar />
      <main
        style={{
          minHeight: 'calc(100vh - 70px)',
          padding: '2rem 1rem 4rem',
          background: 'var(--color-fondo)',
        }}
      >
        <div className="contenedor" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <p
              style={{
                color: 'var(--color-primario)',
                fontStyle: 'italic',
                marginBottom: '0.35rem',
              }}
            >
              Información institucional
            </p>
            <h1
              style={{
                fontFamily: 'var(--font-familia)',
                color: 'var(--color-primario)',
                margin: 0,
              }}
            >
              🏛️ Microteatral & Semanas Pasadas
            </h1>
            <p
              style={{
                color: 'var(--color-texto-suave)',
                maxWidth: 760,
                lineHeight: 1.6,
                marginTop: '0.65rem',
              }}
            >
              Consulta las estadísticas históricas publicadas por la administración.
              Los datos se muestran de forma general y la carga o edición permanece
              disponible únicamente para el administrador.
            </p>
          </div>

          <TheaterStatistics isAdmin={false} />
        </div>
      </main>
    </>
  );
}
