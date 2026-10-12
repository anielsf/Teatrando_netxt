'use client';

/**
 * ValidadorSuscripciones — Centro de Validación de Pagos para Administradores.
 * Permite validar pagos de:
 * 1) Suscripciones y Membresías VIP
 * 2) Boletos y Entradas de Obras Teatrales
 * Cada pago debe ser confirmado antes de que el plan se active o que el boleto pueda usarse en taquilla.
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

interface TicketPendiente {
  id: number | string;
  ticket_id: string;
  obra: string;
  funcion?: string;
  sala?: string;
  asiento: string;
  fecha_funcion: string;
  hora_funcion?: string;
  precio_usd: number;
  precio_ves?: number;
  tasa_bcv?: number;
  ref_pago: string;
  nombre_cliente: string;
  email_cliente: string;
  fecha_emision?: string;
  created_at?: string;
  estado?: string;
  utilizado?: boolean;
}

function EtiquetaEstado({ estado }: { estado: string }) {
  const colores: Record<string, { bg: string; color: string; border: string }> = {
    Pendiente: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'rgba(245,158,11,0.4)' },
    pendiente: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'rgba(245,158,11,0.4)' },
    Activa:    { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', border: 'rgba(34,197,94,0.4)'  },
    valido:    { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', border: 'rgba(34,197,94,0.4)'  },
    Rechazada: { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', border: 'rgba(239,68,68,0.4)'  },
    rechazado: { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', border: 'rgba(239,68,68,0.4)'  },
    canjeado:  { bg: 'rgba(234,179,8,0.15)',   color: '#facc15', border: 'rgba(234,179,8,0.4)'   },
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
  const [seccion, setSeccion] = useState<'suscripciones' | 'tickets'>('suscripciones');

  // Estados de Suscripciones
  const [pendientesSubs, setPendientesSubs] = useState<SolicitudPendiente[]>([]);
  const [historialSubs, setHistorialSubs] = useState<SuscripcionHistorial[]>([]);
  const [cargandoSubs, setCargandoSubs] = useState(true);

  // Estados de Tickets
  const [tickets, setTickets] = useState<TicketPendiente[]>([]);
  const [cargandoTickets, setCargandoTickets] = useState(true);

  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState<string | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);

  // Modal de confirmación
  const [confirmarSub, setConfirmarSub] = useState<{
    id: string;
    accion: 'aprobar' | 'rechazar';
    nombre: string;
    plan: string;
  } | null>(null);

  const [confirmarTicket, setConfirmarTicket] = useState<{
    id: string;
    ticketId: string;
    accion: 'aprobar' | 'rechazar';
    cliente: string;
    obra: string;
    asiento: string;
  } | null>(null);

  // ─── Cargar datos de suscripciones ────────────────────────────
  const cargarSuscripciones = useCallback(async () => {
    setCargandoSubs(true);
    setError('');
    try {
      const res = await fetch('/api/suscripciones/pendientes', { cache: 'no-store' });
      if (!res.ok) throw new Error('Error al cargar suscripciones pendientes');
      const data = await res.json();
      setPendientesSubs(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargandoSubs(false);
    }
  }, []);

  const cargarHistorialSubs = useCallback(async () => {
    try {
      const res = await fetch('/api/suscripciones/historial', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setHistorialSubs(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  // ─── Cargar datos de tickets ──────────────────────────────────
  const cargarTickets = useCallback(async () => {
    setCargandoTickets(true);
    try {
      const res = await fetch('/api/tickets', { cache: 'no-store' });
      if (!res.ok) throw new Error('Error al cargar boletos');
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargandoTickets(false);
    }
  }, []);

  useEffect(() => {
    cargarSuscripciones();
    cargarTickets();
  }, [cargarSuscripciones, cargarTickets]);

  const toggleHistorial = async () => {
    if (!verHistorial && historialSubs.length === 0) {
      await cargarHistorialSubs();
    }
    setVerHistorial((v) => !v);
  };

  // ─── Validar Suscripción ──────────────────────────────────────
  const ejecutarAccionSub = async () => {
    if (!confirmarSub) return;
    setProcesando(confirmarSub.id);
    setMensaje('');
    setError('');
    try {
      const res = await fetch(`/api/suscripciones/${confirmarSub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: confirmarSub.accion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar la solicitud');

      const verbo = confirmarSub.accion === 'aprobar' ? 'aprobada' : 'rechazada';
      setMensaje(
        `✅ Suscripción de ${confirmarSub.nombre} al plan "${confirmarSub.plan}" ${verbo} correctamente.` +
        (data.rol ? ` Rol activado: ${data.rol}.` : '')
      );
      setPendientesSubs((prev) => prev.filter((s) => s.id !== confirmarSub.id));
      if (verHistorial) await cargarHistorialSubs();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcesando(null);
      setConfirmarSub(null);
    }
  };

  // ─── Validar Pago de Boleto ───────────────────────────────────
  const ejecutarAccionTicket = async () => {
    if (!confirmarTicket) return;
    setProcesando(confirmarTicket.ticketId);
    setMensaje('');
    setError('');
    try {
      const res = await fetch(`/api/tickets/${confirmarTicket.ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: confirmarTicket.accion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar el boleto');

      const verbo = confirmarTicket.accion === 'aprobar' ? 'confirmado y activado' : 'rechazado';
      setMensaje(`🎟️ Pago del boleto [${confirmarTicket.ticketId}] (${confirmarTicket.obra}) ${verbo} exitosamente.`);
      setTickets((prev) =>
        prev.map((t) => (t.ticket_id === confirmarTicket.ticketId ? { ...t, estado: data.estado } : t))
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcesando(null);
      setConfirmarTicket(null);
    }
  };

  // Filtros de tickets
  const ticketsPendientes = tickets.filter((t) => !t.utilizado && (t.estado === 'pendiente' || !t.estado));
  const ticketsProcesados = tickets.filter((t) => t.utilizado || t.estado === 'valido' || t.estado === 'rechazado' || t.estado === 'canjeado');

  return (
    <div>
      {/* ── Header del panel ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', marginBottom: '0.35rem' }}>
          Centro de Validación de Pagos
        </h2>
        <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.9rem' }}>
          Verifica las referencias bancarias antes de habilitar el servicio. Las suscripciones activan el rol del usuario y los boletos se habilitan para canje en taquilla.
        </p>
      </div>

      {/* ── Pestañas de Tipo de Pago ── */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => { setSeccion('suscripciones'); setVerHistorial(false); }}
          className={`btn ${seccion === 'suscripciones' ? 'btn-primario' : 'btn-secundario'}`}
          style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <span>💳 Suscripciones & Membresías</span>
          {pendientesSubs.length > 0 && (
            <span style={{
              background: '#f59e0b', color: '#000', borderRadius: '100px',
              padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 700,
            }}>
              {pendientesSubs.length}
            </span>
          )}
        </button>

        <button
          onClick={() => { setSeccion('tickets'); setVerHistorial(false); }}
          className={`btn ${seccion === 'tickets' ? 'btn-primario' : 'btn-secundario'}`}
          style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <span>🎟️ Boletos de Obras</span>
          {ticketsPendientes.length > 0 && (
            <span style={{
              background: '#f59e0b', color: '#000', borderRadius: '100px',
              padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 700,
            }}>
              {ticketsPendientes.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Alertas Globales ── */}
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

      {/* =========================================================================
          SECCIÓN 1: VALIDACIÓN DE SUSCRIPCIONES
      ========================================================================= */}
      {seccion === 'suscripciones' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{
                background: pendientesSubs.length > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.12)',
                color: pendientesSubs.length > 0 ? '#f59e0b' : '#4ade80',
                border: `1px solid ${pendientesSubs.length > 0 ? 'rgba(245,158,11,0.5)' : 'rgba(34,197,94,0.4)'}`,
                borderRadius: '100px', padding: '0.3rem 0.9rem', fontSize: '0.85rem', fontWeight: 700,
              }}>
                {pendientesSubs.length > 0
                  ? `🔔 ${pendientesSubs.length} solicitud${pendientesSubs.length > 1 ? 'es' : ''} de suscripción pendiente${pendientesSubs.length > 1 ? 's' : ''}`
                  : '✅ Sin suscripciones pendientes'}
              </span>
              <button
                onClick={cargarSuscripciones}
                className="btn btn-secundario"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                disabled={cargandoSubs}
              >
                {cargandoSubs ? '...' : '↺ Actualizar'}
              </button>
            </div>
            <button
              onClick={toggleHistorial}
              className="btn btn-secundario"
              style={{ fontSize: '0.82rem' }}
            >
              {verHistorial ? '▲ Ocultar historial' : '▼ Ver historial de suscripciones'}
            </button>
          </div>

          {cargandoSubs ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
              <p style={{ color: 'var(--color-texto-suave)', marginTop: '1rem' }}>Cargando solicitudes...</p>
            </div>
          ) : pendientesSubs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📭</div>
              <p style={{ color: 'var(--color-texto-suave)' }}>No hay solicitudes de suscripción pendientes por revisar.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {pendientesSubs.map((sol) => (
                <div key={sol.id} className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
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

                    <span style={{ color: 'var(--color-texto-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      📅 {sol.created_at ? formatFecha(sol.created_at) : 'Sin fecha'}
                    </span>
                  </div>

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
                    </div>

                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-texto-muted)', marginBottom: '0.2rem' }}>MONTO A VALIDAR</p>
                      <p style={{ fontWeight: 700, color: '#22c55e', fontSize: '1rem' }}>
                        ${Number(sol.precio_usd).toFixed(2)} USD
                      </p>
                      {sol.precio_ves && sol.precio_ves > 0 && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--color-texto-muted)' }}>
                          ≈ Bs. {Number(sol.precio_ves).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>

                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-texto-muted)', marginBottom: '0.2rem' }}>REFERENCIA DE PAGO</p>
                      <p style={{
                        fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem',
                        color: 'var(--color-acento)', background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--color-borde)', borderRadius: '6px',
                        padding: '0.3rem 0.6rem', display: 'inline-block', wordBreak: 'break-all',
                      }}>
                        {sol.ref_pago}
                      </p>
                    </div>

                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-texto-muted)', marginBottom: '0.2rem' }}>ID SOLICITUD</p>
                      <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-texto-suave)' }}>#{sol.id}</p>
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: 'var(--border-radius)', padding: '0.65rem 0.9rem',
                    fontSize: '0.82rem', color: '#f59e0b', marginBottom: '1rem',
                  }}>
                    ⚠️ Verifica la referencia <strong>{sol.ref_pago}</strong> en tu cuenta receptora antes de aprobar.
                  </div>

                  <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-secundario"
                      style={{ fontSize: '0.85rem', borderColor: '#ef4444', color: '#ef4444' }}
                      disabled={procesando === sol.id}
                      onClick={() => setConfirmarSub({
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
                      onClick={() => setConfirmarSub({
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

          {/* Historial de suscripciones */}
          {verHistorial && (
            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-texto-suave)', marginBottom: '1rem', fontSize: '1rem' }}>
                Historial de suscripciones procesadas
              </h3>
              {historialSubs.length === 0 ? (
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
                      {historialSubs.map((h) => (
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
        </div>
      )}

      {/* =========================================================================
          SECCIÓN 2: VALIDACIÓN DE BOLETOS DE OBRAS
      ========================================================================= */}
      {seccion === 'tickets' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{
                background: ticketsPendientes.length > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.12)',
                color: ticketsPendientes.length > 0 ? '#f59e0b' : '#4ade80',
                border: `1px solid ${ticketsPendientes.length > 0 ? 'rgba(245,158,11,0.5)' : 'rgba(34,197,94,0.4)'}`,
                borderRadius: '100px', padding: '0.3rem 0.9rem', fontSize: '0.85rem', fontWeight: 700,
              }}>
                {ticketsPendientes.length > 0
                  ? `🔔 ${ticketsPendientes.length} boleto${ticketsPendientes.length > 1 ? 's' : ''} pendiente${ticketsPendientes.length > 1 ? 's' : ''} de validación`
                  : '✅ Sin pagos de boletos pendientes'}
              </span>
              <button
                onClick={cargarTickets}
                className="btn btn-secundario"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                disabled={cargandoTickets}
              >
                {cargandoTickets ? '...' : '↺ Actualizar'}
              </button>
            </div>
            <button
              onClick={() => setVerHistorial(!verHistorial)}
              className="btn btn-secundario"
              style={{ fontSize: '0.82rem' }}
            >
              {verHistorial ? '▲ Ocultar boletos procesados' : '▼ Ver boletos procesados'}
            </button>
          </div>

          {cargandoTickets ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
              <p style={{ color: 'var(--color-texto-suave)', marginTop: '1rem' }}>Cargando boletos...</p>
            </div>
          ) : ticketsPendientes.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎟️</div>
              <p style={{ color: 'var(--color-texto-suave)' }}>No hay pagos de boletos pendientes por confirmar.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {ticketsPendientes.map((t) => (
                <div key={t.ticket_id} className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-texto)' }}>
                          {t.obra}
                        </span>
                        <EtiquetaEstado estado="Pendiente" />
                      </div>
                      <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem' }}>
                        {t.funcion || 'Función Principal'} · {t.sala || 'Sala Teatral'} · Asiento: <strong style={{ color: '#4ade80' }}>{t.asiento}</strong>
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-acento)', fontSize: '1rem' }}>
                        {t.ticket_id}
                      </span>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-texto-muted)' }}>
                        📅 {t.fecha_funcion ? String(t.fecha_funcion).split('T')[0] : ''} {t.hora_funcion && `· ${t.hora_funcion.slice(0, 5)}`}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '0.75rem', background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--color-borde)', borderRadius: 'var(--border-radius)',
                    padding: '0.85rem', marginBottom: '1rem',
                  }}>
                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-texto-muted)', marginBottom: '0.2rem' }}>COMPRADOR</p>
                      <p style={{ fontWeight: 600 }}>{t.nombre_cliente}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-texto-muted)' }}>{t.email_cliente}</p>
                    </div>

                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-texto-muted)', marginBottom: '0.2rem' }}>MONTO PAGADO</p>
                      <p style={{ fontWeight: 700, color: '#22c55e', fontSize: '1rem' }}>
                        ${Number(t.precio_usd).toFixed(2)} USD
                      </p>
                      {t.precio_ves && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--color-texto-muted)' }}>
                          ≈ Bs. {Number(t.precio_ves).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>

                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-texto-muted)', marginBottom: '0.2rem' }}>REFERENCIA DE PAGO</p>
                      <p style={{
                        fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem',
                        color: 'var(--color-acento)', background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--color-borde)', borderRadius: '6px',
                        padding: '0.3rem 0.6rem', display: 'inline-block', wordBreak: 'break-all',
                      }}>
                        {t.ref_pago}
                      </p>
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: 'var(--border-radius)', padding: '0.65rem 0.9rem',
                    fontSize: '0.82rem', color: '#f59e0b', marginBottom: '1rem',
                  }}>
                    ⚠️ Confirma el pago de <strong>${Number(t.precio_usd).toFixed(2)} USD</strong> con la referencia <strong>{t.ref_pago}</strong>. Al confirmar, el boleto quedará autorizado para acceso en taquilla.
                  </div>

                  <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-secundario"
                      style={{ fontSize: '0.85rem', borderColor: '#ef4444', color: '#ef4444' }}
                      disabled={procesando === t.ticket_id}
                      onClick={() => setConfirmarTicket({
                        id: String(t.id), ticketId: t.ticket_id, accion: 'rechazar',
                        cliente: t.nombre_cliente, obra: t.obra, asiento: t.asiento,
                      })}
                    >
                      ✕ Rechazar Pago
                    </button>
                    <button
                      className="btn btn-primario"
                      style={{ fontSize: '0.85rem', background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}
                      disabled={procesando === t.ticket_id}
                      onClick={() => setConfirmarTicket({
                        id: String(t.id), ticketId: t.ticket_id, accion: 'aprobar',
                        cliente: t.nombre_cliente, obra: t.obra, asiento: t.asiento,
                      })}
                    >
                      {procesando === t.ticket_id ? 'Procesando...' : '✓ Confirmar Pago'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Historial de boletos procesados */}
          {verHistorial && (
            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-texto-suave)', marginBottom: '1rem', fontSize: '1rem' }}>
                Historial de boletos procesados
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 750 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-borde)', color: 'var(--color-primario)', fontSize: '0.82rem' }}>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Boleto</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Obra / Asiento</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Cliente</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Monto</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Referencia</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticketsProcesados.map((t) => (
                      <tr key={t.ticket_id} style={{ borderBottom: '1px solid var(--color-borde)', fontSize: '0.85rem' }}>
                        <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', color: 'var(--color-acento)' }}>
                          {t.ticket_id}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <strong>{t.obra}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-texto-muted)' }}>Asiento {t.asiento}</div>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <div>{t.nombre_cliente}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-texto-muted)' }}>{t.email_cliente}</div>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', color: '#22c55e', fontWeight: 600 }}>
                          ${Number(t.precio_usd).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {t.ref_pago}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <EtiquetaEstado estado={t.utilizado || t.estado === 'canjeado' ? 'canjeado' : t.estado || 'valido'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal Confirmación Suscripción ── */}
      {confirmarSub && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 2000, padding: '1rem',
        }}>
          <div className="card" style={{ maxWidth: 480, width: '100%', padding: '2rem' }}>
            <h3 style={{
              fontFamily: 'var(--font-familia)', marginBottom: '0.75rem',
              color: confirmarSub.accion === 'aprobar' ? '#22c55e' : '#ef4444',
            }}>
              {confirmarSub.accion === 'aprobar' ? '✓ Aprobar suscripción' : '✕ Rechazar suscripción'}
            </h3>
            <p style={{ color: 'var(--color-texto-suave)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              {confirmarSub.accion === 'aprobar' ? (
                <>¿Confirmas que revisaste el comprobante y deseas activar el plan <strong>"{confirmarSub.plan}"</strong> para <strong>{confirmarSub.nombre}</strong>?</>
              ) : (
                <>¿Confirmas que deseas rechazar la solicitud de <strong>{confirmarSub.nombre}</strong>?</>
              )}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secundario" onClick={() => setConfirmarSub(null)} disabled={!!procesando}>
                Cancelar
              </button>
              <button
                className="btn btn-primario"
                style={{
                  background: confirmarSub.accion === 'aprobar'
                    ? 'linear-gradient(135deg,#16a34a,#22c55e)'
                    : 'linear-gradient(135deg,#dc2626,#ef4444)',
                }}
                onClick={ejecutarAccionSub}
                disabled={!!procesando}
              >
                {procesando ? 'Procesando...' : confirmarSub.accion === 'aprobar' ? 'Sí, aprobar' : 'Sí, rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmación Boleto ── */}
      {confirmarTicket && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 2000, padding: '1rem',
        }}>
          <div className="card" style={{ maxWidth: 480, width: '100%', padding: '2rem' }}>
            <h3 style={{
              fontFamily: 'var(--font-familia)', marginBottom: '0.75rem',
              color: confirmarTicket.accion === 'aprobar' ? '#22c55e' : '#ef4444',
            }}>
              {confirmarTicket.accion === 'aprobar' ? '✓ Confirmar pago de boleto' : '✕ Rechazar pago de boleto'}
            </h3>
            <p style={{ color: 'var(--color-texto-suave)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              {confirmarTicket.accion === 'aprobar' ? (
                <>
                  ¿Confirmas que verificaste el pago bancario y deseas habilitar el boleto{' '}
                  <strong style={{ color: 'var(--color-acento)' }}>[{confirmarTicket.ticketId}]</strong> para la obra{' '}
                  <strong>"{confirmarTicket.obra}"</strong> (Asiento: {confirmarTicket.asiento}) de <strong>{confirmarTicket.cliente}</strong>?
                  <br /><br />
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-texto-muted)' }}>
                    Al confirmar, el boleto quedará válido para ser canjeado en taquilla/puerta.
                  </span>
                </>
              ) : (
                <>
                  ¿Confirmas que deseas rechazar el pago del boleto{' '}
                  <strong style={{ color: '#ef4444' }}>[{confirmarTicket.ticketId}]</strong> de{' '}
                  <strong>{confirmarTicket.cliente}</strong>?
                </>
              )}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secundario" onClick={() => setConfirmarTicket(null)} disabled={!!procesando}>
                Cancelar
              </button>
              <button
                className="btn btn-primario"
                style={{
                  background: confirmarTicket.accion === 'aprobar'
                    ? 'linear-gradient(135deg,#16a34a,#22c55e)'
                    : 'linear-gradient(135deg,#dc2626,#ef4444)',
                }}
                onClick={ejecutarAccionTicket}
                disabled={!!procesando}
              >
                {procesando ? 'Procesando...' : confirmarTicket.accion === 'aprobar' ? 'Sí, confirmar pago' : 'Sí, rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
