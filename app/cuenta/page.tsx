/**
 * Página: Mi Cuenta
 * Ruta: /cuenta
 * Server Component con consulta de perfil y boletos adquiridos
 */

import { Navbar } from '@/components/Navbar';
import { getAuthUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { redirect } from 'next/navigation';
import { UserTicketsList } from '@/components/UserTicketsList';

export const dynamic = 'force-dynamic';

export default async function CuentaPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect('/auth?next=/cuenta');
  }

  // Consultar suscripción más reciente del usuario
  const subs = await query<any>(
    `SELECT id, plan, estado, fecha_inicio, fecha_fin, entradas_disponibles, entradas_totales, ref_pago
     FROM public.suscripciones
     WHERE usuario_uuid = $1
     ORDER BY id DESC
     LIMIT 1`,
    [user.id]
  ).catch(() => []);

  const subActiva = subs[0] || null;
  const hoy = new Date();
  const fechaVence = subActiva?.fecha_fin ? new Date(subActiva.fecha_fin) : null;
  const estaExpirada = subActiva?.estado === 'Expirada' || (fechaVence ? hoy > fechaVence : false);
  const diasRestantes = fechaVence && !estaExpirada
    ? Math.max(0, Math.ceil((fechaVence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <>
      <Navbar />

      <main className="contenedor cuenta-page" style={{ paddingBottom: '5rem' }}>
        {/* ENCABEZADO */}
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

          <p style={{ color: 'var(--color-texto-suave)' }}>
            Administra tu información personal, consulta tus boletos adquiridos y verifica tu membresía teatral.
          </p>
        </section>

        {/* INFORMACIÓN DEL PERFIL */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            paddingBottom: '2.5rem',
          }}
        >
          {/* Perfil */}
          <div className="card">
            <h2 style={{ color: 'var(--color-primario)', marginBottom: '1.25rem' }}>
              👤 Información personal
            </h2>
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              <div>
                <small className="texto-suave">Nombre</small>
                <p style={{ marginTop: '0.25rem', fontSize: '1.05rem', fontWeight: 600 }}>{user.nombre}</p>
              </div>
              <div>
                <small className="texto-suave">Correo electrónico</small>
                <p style={{ marginTop: '0.25rem', fontSize: '1.05rem' }}>{user.email}</p>
              </div>
            </div>
          </div>

          {/* Cuenta y Membresía */}
          <div className="card">
            <h2 style={{ color: 'var(--color-primario)', marginBottom: '1.25rem' }}>
              Estado de Membresía
            </h2>
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              <div>
                <small className="texto-suave">Tipo de usuario</small>
                <p style={{ marginTop: '0.4rem' }}>
                  <span
                    className={
                      user.rol === 'Admin'
                        ? 'badge badge-admin'
                        : user.rol === 'Crítico'
                        ? 'badge badge-critico'
                        : user.rol === 'Grupo th'
                        ? 'badge badge-admin'
                        : 'badge badge-usuario'
                    }
                  >
                    {user.rol}
                  </span>
                </p>
              </div>

              <div>
                <small className="texto-suave">Plan de suscripción</small>
                <p style={{ marginTop: '0.25rem', fontSize: '1.05rem', color: '#d4af37', fontWeight: 600 }}>
                  {user.plan}
                </p>
              </div>

              {subActiva && subActiva.estado === 'Activa' && (
                <>
                  <div>
                    <small className="texto-suave">Vigencia y Vencimiento</small>
                    <p style={{ marginTop: '0.25rem', fontSize: '0.9rem', color: estaExpirada ? '#ef4444' : '#4ade80', fontWeight: 600 }}>
                      {estaExpirada ? (
                        <>⚠️ Expirada el {fechaVence?.toLocaleDateString('es-VE')}</>
                      ) : fechaVence ? (
                        <>✓ Válida hasta {fechaVence.toLocaleDateString('es-VE')} ({diasRestantes} días restantes)</>
                      ) : (
                        <>✓ Plan Activo</>
                      )}
                    </p>
                  </div>

                  {subActiva.entradas_disponibles !== null && subActiva.entradas_disponibles !== undefined && (
                    <div>
                      <small className="texto-suave">Entradas de cortesía (canje)</small>
                      <p style={{ marginTop: '0.25rem', fontSize: '0.95rem', color: 'var(--color-texto)', fontWeight: 600 }}>
                        🎟️ {subActiva.entradas_disponibles} de {subActiva.entradas_totales || 2} disponibles este mes
                      </p>
                    </div>
                  )}

                  <div>
                    <small className="texto-suave">Código de Carnet VIP (Taquilla)</small>
                    <p style={{ marginTop: '0.25rem', fontFamily: 'monospace', color: 'var(--color-acento)', fontWeight: 700 }}>
                      SUB-{subActiva.id}
                    </p>
                  </div>
                </>
              )}

              {subActiva && subActiva.estado === 'Pendiente' && (
                <div style={{
                  background: 'rgba(245,158,11,0.12)',
                  border: '1px solid rgba(245,158,11,0.4)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  color: '#f59e0b',
                }}>
                  ⏳ Tu solicitud al <strong>{subActiva.plan}</strong> está en revisión por administración.
                </div>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="card">
            <h2 style={{ color: 'var(--color-primario)', marginBottom: '1.25rem' }}>
              Acciones Rápidas
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <a href="/cartelera" className="btn btn-primario">
                Ver Cartelera
              </a>
              {(user.rol === 'Admin' || user.rol === 'Grupo th') && (
                <a href="/admin" className="btn btn-secundario">
                  {user.rol === 'Admin' ? 'Panel de Administración' : 'Gestión Grupo TH'}
                </a>
              )}
              <a href="/" className="btn btn-secundario">
                Volver al Inicio
              </a>
            </div>
          </div>
        </section>

        {/* MIS BOLETOS Y ENTRADAS COMPRADAS */}
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-familia)',
                  color: 'var(--color-primario)',
                  fontSize: '1.8rem',
                  margin: 0,
                }}
              >
                Mis Boletos y Entradas
              </h2>
              <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Consulta tus accesos teatrales activos, asientos asignados y códigos QR para la entrada a sala.
              </p>
            </div>
          </div>

          <UserTicketsList />
        </section>

        {/* IDENTIFICADOR */}
        <section className="card">
          <h2 style={{ color: 'var(--color-primario)', marginBottom: '1rem', fontSize: '1.2rem' }}>
            Detalles técnicos de la cuenta
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            <div>
              <small className="texto-suave">ID de usuario</small>
              <p style={{ marginTop: '0.25rem', wordBreak: 'break-all', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                {user.id}
              </p>
            </div>
            <div>
              <small className="texto-suave">Rol activo</small>
              <p style={{ marginTop: '0.25rem' }}>{user.rol}</p>
            </div>
            <div>
              <small className="texto-suave">Plan suscrito</small>
              <p style={{ marginTop: '0.25rem' }}>{user.plan}</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}