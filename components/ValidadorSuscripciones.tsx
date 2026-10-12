'use client';

/**
 * ValidadorSuscripciones — Panel de validación de suscripciones para administradores.
 * Muestra solicitudes pendientes con referencia de pago, permite aprobar o rechazar,
 * y muestra el historial de suscripciones ya procesadas.
 */
import { useState, useEffect, useCallback } from 'react';

interface SolicitudPendiente {
  id: string;
  plan: string;
  plan_nombre: string | null;
  precio_usd: number;
  precio_ves: number | null;
  tasa_bcv: number | null;
  ref_pago: string;
  created_at: string;
  usuario_nombre: string | null;
  usuario_email: string | null;
  usuario_rol: string | null;
  usuario_plan_actual: string | null;
}

interface SuscripcionHistorial {
  id: string;
  plan: string;
  plan_nombre: string | null;
  precio_usd: number;
  precio_ves: number | null;
  ref_pago: string;
  estado: string;
  created_at: string;
  updated_at: string | null;
  usuario_nombre: string | null;
  usuario_email: string | null;
}

function EtiquetaEstado({ estado }: { estado: string }) {
  const colores: Record<string, { bg: string; color: string; border: string }> = {
    Pendiente: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'rgba(245,158,11,0.4)' },
    Activa:    { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', border: 'rgba(34,197,94,0.4)'  },
    Rechazada: { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', border: 'rgba(239,68,68,0.4)'  },
  };
  const c = colores[estado] ?? colores['Pendiente'];
  return (
    <span style={{
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      padding: '0.2rem 0.6rem', borderRadius: '100px', fontSize: '0.75rem',
      fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {estado}
    </span>
  );
}

function formatFecha(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-VE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export function ValidadorSuscripciones() {
  const [pendientes, setPendientes] = useState<SolicitudPendiente[]>([]);
  const [historial, setHistorial] = useState<SuscripcionHistorial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState<string | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const [confirmar, setConfirmar] = useState<{
    id: string;
    accion: 'aprobar' | 'rechazar';
    nombre: string;
    plan: string;
  } | null>(null);

  // ─── Cargar solicitudes pendientes ────────────────────────────
  const cargarPendientes = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const res = await fetch('/api/suscripciones/pendientes', { cache: 'no-store' });
      if (!res.ok) throw new Error('Error al cargar solicitudes pendientes');
      const data = await res.json();
      setPendientes(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  // ─── Cargar historial de todas las suscripciones ──────────────
  const cargarHistorial = useCallback(async () => {
    setCargandoHistorial(true);
    try {
      const res = await fetch('/api/suscripciones/historial', { cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudo cargar el historial');
      const data = await res.json();
      setHistorial(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargandoHistorial(false);
    }
  }, []);

  useEffect(() => { cargarPendientes(); }, [cargarPendientes]);

  const toggleHistorial = async () => {
    if (!verHistorial && historial.length === 0) await cargarHistorial();
    setVerHistorial((v) => !v);
  };

  // ─── Ejecutar aprobación o rechazo ────────────────────────────
  const ejecutarAccion = async () => {
    if (!confirmar) return;
    setProcesando(confirmar.id);
    setMensaje('');
    setError('');
    try {
      const res = await fetch(`/api/suscripciones/${confirmar.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: confirmar.accion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar la solicitud');

      const verbo = confirmar.accion === 'aprobar' ? 'aprobada' : 'rechazada';
      setMensaje(
        `✅ Suscripción de ${confirmar.nombre} al plan "${confirmar.plan}" ${verbo} correctamente.` +
        (data.rol ? ` Nuevo rol asignado: ${data.rol}.` : '')
      );
      setPendientes((prev) => prev.filter((s) => s.id !== confirmar.id));
      // Refrescar historial si está visible
      if (verHistorial) await cargarHistorial();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcesando(null);
      setConfirmar(null);
    }
  };

  return (
    <div>
      {/* ── Header del panel ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', marginBottom: '0.35rem' }}>
          Validación de Suscripciones
        </h2>
        <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.9rem' }}>
          Revisa los comprobantes de pago y aprueba o rechaza cada solicitud. Al aprobar,
          el rol y plan del usuario se actualizan automáticamente.
        </p>
      </div>

      {/* ── Alertas ── */}
      {mensaje && (
        <div style={{
          background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)',
          color: '#4ade80', padding: '0.75rem 1rem', borderRadius: 'var(--border-radius)',
          marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{mensaje}</span>
          <button onClick={() => setMensaje('')}
            style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>
      )}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
          color: '#f87171', padding: '0.75rem 1rem', borderRadius: 'var(--border-radius)',
          marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')}
            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>
      )}

      {/* ── Contador de pendientes ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{
            background: pendientes.length > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.12)',
            color: pendientes.length > 0 ? '#f59e0b' : '#4ade80',
            border: `1px solid ${pendientes.length > 0 ? 'rgba(245,158,11,0.5)' : 'rgba(34,197,94,0.4)'}`,
            borderRadius: '100px', padding: '0.3rem 0.9rem', fontSize: '0.85rem', fontWeight: 700,
          }}>
            {pendientes.length > 0
              ? `🔔 ${pendientes.length} solicitud${pendientes.length > 1 ? 'es' : ''} pendiente${pendientes.length > 1 ? 's' : ''}`
              : '✅ Sin solicitudes pendientes'}
          </span>
          <button
            onClick={cargarPendientes}
            className="btn btn-secundario"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            disabled={cargando}
          >
            {cargando ? '...' : '↺ Actualizar'}
          </button>
        </div>
        <button
          onClick={toggleHistorial}
          className="btn btn-secundario"
          style={{ fontSize: '0.82rem' }}
        >
          {verHistorial ? '▲ Ocultar historial' : '▼ Ver historial completo'}
        </button>
      </div>

      {/* ── Tabla de solicitudes pendientes ── */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ color: 'var(--color-texto-suave)', marginTop: '1rem' }}>Cargando solicitudes...</p>
        </div>
      ) : pendientes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📭</div>
          <p style={{ color: 'var(--color-texto-suave)' }}>No hay solicitudes de suscripción pendientes por revisar.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {pendientes.map((sol) => (
            <div key={sol.id} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                {/* Info del usuario */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-texto)' }}>
                      {sol.usuario_nombre || 'Usuario desconocido'}
                    </span>
                    {sol.usuario_rol && (
                      <span style={{
                        background: 'rgba(255,255,255,0.08)', color: 'var(--color-texto-suave)',
                        border: '1px solid var(--color-borde)', borderRadius: '100px',
                        padding: '0.1rem 0.5rem', fontSize: '0.72rem', fontWeight: 600,
                      }}>
                        Rol actual: {sol.usuario_rol}
                      </span>
                    )}
                    <EtiquetaEstado estado="Pendiente" />
                  </div>
                  <p style={{ color: 'var(--color-texto-muted)', fontSize: '0.85rem' }}>
                    {sol.usuario_email}
                    {sol.usuario_plan_actual && (
                      <span style={{ marginLeft: '0.5rem', color: 'var(--color-texto-suave)' }}>
                        · Plan actual: <strong>{sol.usuario_plan_actual}</strong>
                      </span>
                    )}
                  </p>
                </div>

                {/* Fecha de solicitud */}
                <span style={{ color: 'var(--color-texto-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  📅 {sol.created_at ? formatFecha(sol.created_at) : 'Sin fecha'}
                </span>
              </div>

              {/* Detalles de la solicitud */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem', background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--color-borde)', borderRadius: 'var(--border-radius)',
                padding: '0.85rem', marginBottom: '1rem',
              }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-texto-muted)', marginBottom: '0.2rem' }}>PLAN SOLICITADO</p>
                  <p style={{ fontWeight: 700, color: 'var(--color-primario)', fontSize: '0.95rem' }}>
                    {sol.plan_nombre || sol.plan}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-texto-muted)' }}>Clave: {sol.plan}</p>
                </div>

                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-texto-muted)', marginBottom: '0.2rem' }}>MONTO A VALIDAR</p>
                  <p style={{ fontWeight: 700, color: '#22c55e', fontSize: '1rem' }}>
                    ${Number(sol.precio_usd).toFixed(2)} USD
                  </p>
                  {sol.precio_ves && sol.precio_ves > 0 && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-texto-muted)' }}>
                      ≈ Bs. {Number(sol.precio_ves).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      {sol.tasa_bcv && ` · Tasa: ${Number(sol.tasa_bcv).toFixed(2)}`}
                    </p>
                  )}
                </div>

                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-texto-muted)', marginBottom: '0.2rem' }}>REFERENCIA DE PAGO</p>
                  <p style={{
                    fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem',
                    color: 'var(--color-acento)',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--color-borde)',
                    borderRadius: '6px', padding: '0.3rem 0.6rem',
                    display: 'inline-block', wordBreak: 'break-all',
                  }}>
                    {sol.ref_pago}
                  </p>
                </div>

                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-texto-muted)', marginBottom: '0.2rem' }}>ID SOLICITUD</p>
                  <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-texto-suave)' }}>#{sol.id}</p>
                </div>
              </div>

              {/* Instrucción de verificación */}
              <div style={{
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 'var(--border-radius)', padding: '0.65rem 0.9rem',
                fontSize: '0.82rem', color: '#f59e0b', marginBottom: '1rem',
              }}>
                ⚠️ Verifica la referencia de pago <strong>{sol.ref_pago}</strong> en tu plataforma bancaria antes de aprobar.
                El monto debe coincidir con <strong>${Number(sol.precio_usd).toFixed(2)} USD</strong>.
              </div>

              {/* Botones de acción */}
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secundario"
                  style={{ fontSize: '0.85rem', borderColor: '#ef4444', color: '#ef4444' }}
                  disabled={procesando === sol.id}
                  onClick={() => setConfirmar({
                    id: sol.id, accion: 'rechazar',
                    nombre: sol.usuario_nombre || 'usuario',
                    plan: sol.plan_nombre || sol.plan,
                  })}
                >
                  ✕ Rechazar
                </button>
                <button
                  className="btn btn-primario"
                  style={{ fontSize: '0.85rem', background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}
                  disabled={procesando === sol.id}
                  onClick={() => setConfirmar({
                    id: sol.id, accion: 'aprobar',
                    nombre: sol.usuario_nombre || 'usuario',
                    plan: sol.plan_nombre || sol.plan,
                  })}
                >
                  {procesando === sol.id ? 'Procesando...' : '✓ Aprobar Suscripción'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Historial de suscripciones ── */}
      {verHistorial && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-texto-suave)', marginBottom: '1rem', fontSize: '1rem' }}>
            Historial de todas las suscripciones
          </h3>
          {cargandoHistorial ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : historial.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--color-texto-suave)' }}>No hay suscripciones registradas aún.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-borde)', color: 'var(--color-primario)', fontSize: '0.82rem' }}>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Usuario</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Plan</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Monto USD</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Referencia</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Estado</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h) => (
                    <tr key={h.id} style={{ borderBottom: '1px solid var(--color-borde)', fontSize: '0.85rem' }}>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <div style={{ fontWeight: 600 }}>{h.usuario_nombre || '—'}</div>
                        <div style={{ color: 'var(--color-texto-muted)', fontSize: '0.78rem' }}>{h.usuario_email}</div>
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--color-texto-suave)' }}>
                        {h.plan_nombre || h.plan}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: '#22c55e', fontWeight: 600 }}>
                        ${Number(h.precio_usd).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <code style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--color-acento)' }}>
                          {h.ref_pago}
                        </code>
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <EtiquetaEstado estado={h.estado} />
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--color-texto-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {h.created_at ? formatFecha(h.created_at) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal de confirmación ── */}
      {confirmar && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 2000, padding: '1rem',
        }}>
          <div className="card" style={{ maxWidth: 480, width: '100%', padding: '2rem' }}>
            <h3 style={{
              fontFamily: 'var(--font-familia)', marginBottom: '0.75rem',
              color: confirmar.accion === 'aprobar' ? '#22c55e' : '#ef4444',
            }}>
              {confirmar.accion === 'aprobar' ? '✓ Aprobar suscripción' : '✕ Rechazar suscripción'}
            </h3>
            <p style={{ color: 'var(--color-texto-suave)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              {confirmar.accion === 'aprobar' ? (
                <>
                  ¿Confirmas que revisaste el comprobante de pago y deseas <strong style={{ color: '#22c55e' }}>
                  activar el plan "{confirmar.plan}"</strong> para <strong>{confirmar.nombre}</strong>?
                  <br /><br />
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-texto-muted)' }}>
                    Al aprobar, el rol y plan del usuario se actualizarán automáticamente en el sistema.
                  </span>
                </>
              ) : (
                <>
                  ¿Confirmas que deseas <strong style={{ color: '#ef4444' }}>rechazar la solicitud</strong> de{' '}
                  <strong>{confirmar.nombre}</strong> al plan "{confirmar.plan}"?
                  <br /><br />
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-texto-muted)' }}>
                    El usuario recibirá estado "Rechazada" y deberá realizar una nueva solicitud si lo desea.
                  </span>
                </>
              )}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secundario"
                onClick={() => setConfirmar(null)}
                disabled={!!procesando}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primario"
                style={{
                  background: confirmar.accion === 'aprobar'
                    ? 'linear-gradient(135deg,#16a34a,#22c55e)'
                    : 'linear-gradient(135deg,#dc2626,#ef4444)',
                }}
                onClick={ejecutarAccion}
                disabled={!!procesando}
              >
                {procesando ? 'Procesando...' : confirmar.accion === 'aprobar' ? 'Sí, aprobar' : 'Sí, rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
