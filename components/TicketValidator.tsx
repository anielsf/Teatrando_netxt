'use client';

import { useState } from 'react';

interface TicketValidatorProps {
  userRole?: string;
  userName?: string;
  onTicketValidado?: () => void;
}

export function TicketValidator({ userRole, userName, onTicketValidado }: TicketValidatorProps) {
  const [codigoInput, setCodigoInput] = useState('');
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historialValidaciones, setHistorialValidaciones] = useState<any[]>([]);

  const procesarValidacion = async (codigo: string) => {
    const limpio = codigo.trim();
    if (!limpio) return;

    setValidando(true);
    setError(null);
    setResultado(null);

    try {
      // Si el código proviene de un payload JSON escaneado
      let ticketId = limpio;
      if (limpio.startsWith('{') && limpio.endsWith('}')) {
        try {
          const parsed = JSON.parse(limpio);
          ticketId = parsed.ticket || parsed.ticket_id || parsed.ticketId || limpio;
        } catch {
          // continuar con texto plano
        }
      }

      const res = await fetch('/api/tickets/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.yaUtilizado) {
          setResultado({ yaUtilizado: true, ...data });
        } else {
          setError(data.error || 'No se pudo validar el boleto.');
        }
      } else {
        setResultado({ success: true, ...data });
        setHistorialValidaciones((prev) => [data.ticket, ...prev.slice(0, 9)]);
        setCodigoInput('');
        if (onTicketValidado) onTicketValidado();
      }
    } catch (err: any) {
      setError('Error al conectar con el servidor: ' + err.message);
    } finally {
      setValidando(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    procesarValidacion(codigoInput);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
      {/* Panel Principal de Validación */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.4rem' }}>🎟️</span>
          <h2 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', margin: 0 }}>
            Validación y Canje en Taquilla
          </h2>
        </div>
        <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
          Ingresa el código alfanumérico del boleto (e.g. <code>TCK-M1A2B3C</code>) o pega el texto escaneado por el lector de código QR en la puerta del teatro.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-texto-muted)', display: 'block', marginBottom: '0.35rem' }}>
              CÓDIGO DE BOLETO O LECTURA QR
            </label>
            <input
              type="text"
              className="input"
              placeholder="Ej: TCK-M1N2O3P o payload JSON"
              value={codigoInput}
              onChange={(e) => setCodigoInput(e.target.value)}
              autoFocus
              style={{
                fontFamily: 'monospace',
                fontSize: '1.05rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primario"
            disabled={validando || !codigoInput.trim()}
            style={{ justifyContent: 'center', padding: '0.75rem', fontSize: '0.95rem' }}
          >
            {validando ? 'Verificando en Base de Datos...' : 'Validar Entrada'}
          </button>
        </form>

        {/* Mensaje de Error */}
        {error && (
          <div
            style={{
              marginTop: '1.25rem',
              padding: '0.85rem 1rem',
              background: 'rgba(139, 26, 46, 0.25)',
              border: '1px solid rgba(139, 26, 46, 0.6)',
              borderRadius: 'var(--border-radius)',
              color: '#ff8099',
              fontSize: '0.9rem',
            }}
          >
            <strong>❌ Error:</strong> {error}
          </div>
        )}

        {/* Boleto Ya Canjeado (Alerta Anti-Fraude) */}
        {resultado?.yaUtilizado && (
          <div
            style={{
              marginTop: '1.25rem',
              padding: '1rem',
              background: 'rgba(234, 179, 8, 0.15)',
              border: '1px solid #eab308',
              borderRadius: 'var(--border-radius)',
              color: '#fef08a',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🚫</span>
              <strong style={{ color: '#facc15', fontSize: '1rem' }}>¡BOLETO YA CANJEADO!</strong>
            </div>
            <p style={{ fontSize: '0.88rem', margin: '0 0 0.5rem', color: 'var(--color-texto-suave)' }}>
              Este boleto ya fue utilizado para ingresar anteriormente. <strong>Acceso denegado.</strong>
            </p>
            {resultado.ticket && (
              <div style={{ fontSize: '0.82rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                <div><strong>Obra:</strong> {resultado.ticket.obra}</div>
                <div><strong>Asiento:</strong> {resultado.ticket.asiento}</div>
                <div><strong>Titular:</strong> {resultado.ticket.nombre_cliente}</div>
                <div><strong>Canjeado el:</strong> {new Date(resultado.ticket.fecha_utilizacion).toLocaleString('es-VE')}</div>
                {resultado.ticket.validado_por && <div><strong>Validado por:</strong> {resultado.ticket.validado_por}</div>}
              </div>
            )}
          </div>
        )}

        {/* Éxito - Entrada Autorizada */}
        {resultado?.success && (
          <div
            style={{
              marginTop: '1.25rem',
              padding: '1.25rem',
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid #22c55e',
              borderRadius: 'var(--border-radius)',
              color: '#86efac',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.4rem' }}>✅</span>
              <strong style={{ color: '#4ade80', fontSize: '1.1rem' }}>ENTRADA VÁLIDA — ACCESO PERMITIDO</strong>
            </div>
            <div style={{ fontSize: '0.9rem', display: 'grid', gap: '0.35rem', marginTop: '0.75rem', color: 'var(--color-texto)' }}>
              <div><strong>Boleto:</strong> <span style={{ fontFamily: 'monospace', color: 'var(--color-primario)' }}>{resultado.ticket.ticket_id}</span></div>
              <div><strong>Obra:</strong> {resultado.ticket.obra}</div>
              <div><strong>Sala:</strong> {resultado.ticket.sala || 'Sala Principal'} | <strong>Butaca:</strong> <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{resultado.ticket.asiento}</span></div>
              <div><strong>Función:</strong> {resultado.ticket.fecha_funcion} - {resultado.ticket.hora_funcion || '19:00'}</div>
              <div><strong>Espectador:</strong> {resultado.ticket.nombre_cliente}</div>
              <div><strong>Comprobante:</strong> {resultado.ticket.ref_pago}</div>
            </div>
          </div>
        )}
      </div>

      {/* Historial Reciente de la Sesión en Puerta */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', margin: '0 0 0.5rem' }}>
          📋 Últimos Boletos Validados
        </h3>
        <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Registro temporal de entradas canjeadas durante esta sesión operativa.
        </p>

        {historialValidaciones.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-texto-muted)', fontSize: '0.88rem' }}>
            Aún no se han escaneado boletos en esta sesión.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 350, overflowY: 'auto' }}>
            {historialValidaciones.map((t, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--color-borde)',
                  borderRadius: 'var(--border-radius)',
                  padding: '0.6rem 0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-texto)' }}>{t.obra}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-texto-muted)' }}>
                    Asiento <strong>{t.asiento}</strong> • {t.nombre_cliente}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-admin" style={{ fontSize: '0.7rem' }}>CANJEADO</span>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-primario)', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                    {t.ticket_id}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
