'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Modal } from '@/components/Modal';

interface Ticket {
  id: number;
  ticket_id: string;
  id_obra: string;
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
}

export function UserTicketsList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ticketSeleccionado, setTicketSeleccionado] = useState<Ticket | null>(null);
  const [qrModalUrl, setQrModalUrl] = useState<string>('');
  const [qrsMap, setQrsMap] = useState<Record<string, string>>({});

  useEffect(() => {
    async function cargarTickets() {
      try {
        const res = await fetch('/api/tickets');
        if (!res.ok) {
          throw new Error('No se pudieron obtener los tickets.');
        }
        const data = await res.json();
        const lista = Array.isArray(data) ? data : [];
        setTickets(lista);

        // Generar QRs para cada boleto
        const qrs: Record<string, string> = {};
        for (const t of lista) {
          try {
            const url = await QRCode.toDataURL(
              JSON.stringify({
                ticket: t.ticket_id,
                obra: t.obra,
                asiento: t.asiento,
                fecha: t.fecha_funcion,
                ref: t.ref_pago,
              }),
              { width: 140, margin: 1, color: { dark: '#0d0507', light: '#f5e6c8' } }
            );
            qrs[t.ticket_id] = url;
          } catch (e) {
            console.error('Error generando QR para ticket', t.ticket_id, e);
          }
        }
        setQrsMap(qrs);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    cargarTickets();
  }, []);

  const verDetalleTicket = async (t: Ticket) => {
    setTicketSeleccionado(t);
    try {
      const url = await QRCode.toDataURL(
        JSON.stringify({
          ticket: t.ticket_id,
          obra: t.obra,
          asiento: t.asiento,
          fecha: t.fecha_funcion,
          ref: t.ref_pago,
          cliente: t.nombre_cliente,
        }),
        { width: 220, margin: 1, color: { dark: '#0d0507', light: '#f5e6c8' } }
      );
      setQrModalUrl(url);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
        <p style={{ color: 'var(--color-texto-suave)', marginTop: '0.75rem', fontSize: '0.9rem' }}>
          Cargando tus boletos teatrales...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: '#ff8099', padding: '1rem', background: 'rgba(139, 26, 46, 0.2)', borderRadius: 'var(--border-radius)' }}>
        ⚠️ {error}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div
        className="card"
        style={{
          textAlign: 'center',
          padding: '3rem 1.5rem',
          background: 'rgba(255,255,255,0.02)',
          border: '1px dashed var(--color-borde)',
        }}
      >
        <span style={{ fontSize: '2.5rem' }}>🎟️</span>
        <h3 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', margin: '0.75rem 0 0.5rem' }}>
          Aún no tienes boletos comprados
        </h3>
        <p style={{ color: 'var(--color-texto-suave)', maxWidth: 450, margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
          Descubre las obras en cartelera, selecciona tu butaca y realiza tu pago en Bolívares con Pago Móvil.
        </p>
        <a href="/cartelera" className="btn btn-primario">
          🎭 Explorar Cartelera Teatral
        </a>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {tickets.map((t) => (
          <div
            key={t.id || t.ticket_id}
            className="card"
            style={{
              padding: '1.5rem',
              border: '1px solid rgba(201, 162, 75, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(135deg, rgba(31, 11, 18, 0.6) 0%, rgba(13, 5, 7, 0.9) 100%)',
            }}
          >
            {/* Header del Ticket */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px dashed var(--color-borde)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <span className="badge badge-usuario" style={{ fontSize: '0.72rem', marginBottom: '0.25rem' }}>
                  BOLETO TEATRAL
                </span>
                <h3 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-texto)', fontSize: '1.2rem', margin: '0.25rem 0' }}>
                  {t.obra}
                </h3>
                <small style={{ color: 'var(--color-texto-suave)' }}>
                  {t.funcion || 'Función Principal'} · {t.sala || 'Sala Teatral'}
                </small>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primario)', fontSize: '0.95rem' }}>
                  {t.ticket_id}
                </span>
              </div>
            </div>

            {/* Contenido del Ticket */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.85rem' }}>
                <div>
                  <span className="texto-suave">📅 Fecha: </span>
                  <strong>{t.fecha_funcion ? String(t.fecha_funcion).split('T')[0] : 'Función'}</strong>
                  {t.hora_funcion && <span> · ⏰ {t.hora_funcion.slice(0, 5)}</span>}
                </div>

                <div>
                  <span className="texto-suave">🪑 Asiento: </span>
                  <strong style={{ color: '#4ade80', fontSize: '1rem' }}>{t.asiento}</strong>
                </div>

                <div>
                  <span className="texto-suave">💵 Pagado: </span>
                  <strong style={{ color: 'var(--color-primario)' }}>${t.precio_usd} USD</strong>
                  {t.precio_ves && (
                    <small style={{ color: 'var(--color-texto-muted)', marginLeft: '0.3rem' }}>
                      (Bs. {Number(t.precio_ves).toLocaleString('es-VE', { minimumFractionDigits: 2 })})
                    </small>
                  )}
                </div>

                <div>
                  <span className="texto-suave">Ref: </span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-texto-suave)' }}>
                    {t.ref_pago}
                  </span>
                </div>
              </div>

              {/* QR Miniatura */}
              {qrsMap[t.ticket_id] && (
                <div
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    padding: '0.4rem',
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                  onClick={() => verDetalleTicket(t)}
                  title="Haz clic para ampliar"
                >
                  <img src={qrsMap[t.ticket_id]} alt="QR" style={{ width: 85, height: 85, display: 'block', borderRadius: 4 }} />
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-acento)' }}>🔍 Ampliar</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', gap: '0.5rem' }}>
              <button
                onClick={() => verDetalleTicket(t)}
                className="btn btn-secundario"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              >
                🎟️ Ver Entrada Completa
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL DE ENTRADA COMPLETA / IMPRESIÓN */}
      <Modal
        isOpen={!!ticketSeleccionado}
        onClose={() => setTicketSeleccionado(null)}
        title="🎟️ Boleto Oficial de Acceso"
        size="md"
      >
        {ticketSeleccionado && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #1f0b12 0%, #0d0507 100%)',
                border: '2px solid var(--color-primario)',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '1.5rem',
              }}
            >
              <h2 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', margin: '0 0 0.5rem' }}>
                {ticketSeleccionado.obra}
              </h2>
              <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.9rem', margin: '0 0 1rem' }}>
                {ticketSeleccionado.funcion} · {ticketSeleccionado.sala}
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
                {qrModalUrl && (
                  <div style={{ background: '#f5e6c8', padding: '0.75rem', borderRadius: 8 }}>
                    <img src={qrModalUrl} alt="QR de acceso" style={{ width: 180, height: 180, display: 'block' }} />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.9rem', textAlign: 'left', background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: 8 }}>
                <div><span className="texto-suave">Titular: </span><strong>{ticketSeleccionado.nombre_cliente}</strong></div>
                <div><span className="texto-suave">Boleto Nº: </span><strong style={{ fontFamily: 'monospace', color: 'var(--color-acento)' }}>{ticketSeleccionado.ticket_id}</strong></div>
                <div><span className="texto-suave">Fecha y Hora: </span><strong>📅 {ticketSeleccionado.fecha_funcion ? String(ticketSeleccionado.fecha_funcion).split('T')[0] : ''} {ticketSeleccionado.hora_funcion ? `· ⏰ ${ticketSeleccionado.hora_funcion.slice(0, 5)}` : ''}</strong></div>
                <div><span className="texto-suave">Asiento Asignado: </span><strong style={{ color: '#4ade80', fontSize: '1.1rem' }}>🪑 {ticketSeleccionado.asiento}</strong></div>
                <div><span className="texto-suave">Referencia de Pago: </span><span style={{ fontFamily: 'monospace' }}>{ticketSeleccionado.ref_pago}</span></div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={() => window.print()} className="btn btn-primario">
                🖨️ Imprimir / Guardar PDF
              </button>
              <button onClick={() => setTicketSeleccionado(null)} className="btn btn-secundario">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
