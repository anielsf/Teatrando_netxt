/**
 * Página: Mi Cuenta
 *
 * Ruta:
 *   /cuenta
 *
 * Esta página es un Server Component.
 *
 * La autenticación se verifica en el servidor mediante
 * getAuthUser(), evitando depender únicamente del estado
 * del navegador.
 */

import { Navbar } from '@/components/Navbar';
import { getAuthUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CuentaPage() {
  // ============================================================
  // 1. OBTENER USUARIO AUTENTICADO
  // ============================================================

  const user = await getAuthUser();

  // ============================================================
  // 2. SI NO HAY SESIÓN
  // ============================================================

  if (!user) {
    redirect('/auth?next=/cuenta');
  }

  // ============================================================
  // 3. INFORMACIÓN DEL USUARIO
  // ============================================================

  return (
    <>
      <Navbar />

      <main className="contenedor cuenta-page">
        {/* =====================================================
            ENCABEZADO
        ===================================================== */}

        <section
          style={{
            paddingTop: '3rem',
            paddingBottom: '2rem',
          }}
        >
          <p
            style={{
              color: 'var(--color-primario)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              fontSize: '0.8rem',
              marginBottom: '0.5rem',
            }}
          >
            Mi espacio en Teatrando
          </p>

          <h1
            style={{
              fontFamily: 'var(--font-familia)',
              color: 'var(--color-texto)',
              fontSize: '2.5rem',
              marginBottom: '0.75rem',
            }}
          >
            Mi Cuenta
          </h1>

          <p
            style={{
              color: 'var(--color-texto-suave)',
            }}
          >
            Administra tu información y consulta los datos de tu
            cuenta.
          </p>
        </section>

        {/* =====================================================
            INFORMACIÓN DEL PERFIL
        ===================================================== */}

        <section
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            paddingBottom: '3rem',
          }}
        >
          {/* Perfil */}

          <div className="card">
            <h2
              style={{
                color: 'var(--color-primario)',
                marginBottom: '1.5rem',
              }}
            >
              👤 Información personal
            </h2>

            <div
              style={{
                display: 'grid',
                gap: '1rem',
              }}
            >
              <div>
                <small className="texto-suave">
                  Nombre
                </small>

                <p
                  style={{
                    marginTop: '0.25rem',
                    fontSize: '1.05rem',
                  }}
                >
                  {user.nombre}
                </p>
              </div>

              <div>
                <small className="texto-suave">
                  Correo electrónico
                </small>

                <p
                  style={{
                    marginTop: '0.25rem',
                    fontSize: '1.05rem',
                  }}
                >
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          {/* Cuenta */}

          <div className="card">
            <h2
              style={{
                color: 'var(--color-primario)',
                marginBottom: '1.5rem',
              }}
            >
              🎟️ Cuenta
            </h2>

            <div
              style={{
                display: 'grid',
                gap: '1rem',
              }}
            >
              <div>
                <small className="texto-suave">
                  Tipo de usuario
                </small>

                <p style={{ marginTop: '0.4rem' }}>
                  <span
                    className={
                      user.rol === 'Admin'
                        ? 'badge badge-admin'
                        : user.rol === 'Crítico'
                        ? 'badge badge-critico'
                        : 'badge badge-usuario'
                    }
                  >
                    {user.rol}
                  </span>
                </p>
              </div>

              <div>
                <small className="texto-suave">
                  Plan
                </small>

                <p
                  style={{
                    marginTop: '0.25rem',
                    fontSize: '1.05rem',
                  }}
                >
                  {user.plan}
                </p>
              </div>
            </div>
          </div>

          {/* Acciones */}

          <div className="card">
            <h2
              style={{
                color: 'var(--color-primario)',
                marginBottom: '1.5rem',
              }}
            >
              ⚙️ Acciones
            </h2>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <a
                href="/cartelera"
                className="btn btn-primario"
              >
                🎭 Ver Cartelera
              </a>

              <a
                href="/"
                className="btn btn-secundario"
              >
                🏠 Volver al Inicio
              </a>
            </div>
          </div>
        </section>

        {/* =====================================================
            IDENTIFICADOR
        ===================================================== */}

        <section
          className="card"
          style={{
            marginBottom: '3rem',
          }}
        >
          <h2
            style={{
              color: 'var(--color-primario)',
              marginBottom: '1rem',
            }}
          >
            Información de cuenta
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem',
            }}
          >
            <div>
              <small className="texto-suave">
                ID de usuario
              </small>

              <p
                style={{
                  marginTop: '0.25rem',
                  wordBreak: 'break-all',
                  fontSize: '0.85rem',
                }}
              >
                {user.id}
              </p>
            </div>

            <div>
              <small className="texto-suave">
                Rol
              </small>

              <p style={{ marginTop: '0.25rem' }}>
                {user.rol}
              </p>
            </div>

            <div>
              <small className="texto-suave">
                Plan
              </small>

              <p style={{ marginTop: '0.25rem' }}>
                {user.plan}
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}