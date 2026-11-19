'use client';

import { useState, useEffect } from 'react';

type ModoPago = 'pagolink_hosted' | 'c2p_directo';

interface ConfigPago {
  modo: ModoPago;
  descripcion: string;
  actualizado_en: string;
  actualizado_por: string;
}

export function PasarelaConfigPanel() {
  const [config, setConfig] = useState<ConfigPago | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/config-pago')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setError('No se pudo cargar la configuración actual.'));
  }, []);

  const cambiarModo = async (nuevoModo: ModoPago) => {
    if (guardando || config?.modo === nuevoModo) return;
    setGuardando(true);
    setMensaje('');
    setError('');

    try {
      const res = await fetch('/api/config-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: nuevoModo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cambiar el modo');
      setConfig(data.config);
      setMensaje(
        nuevoModo === 'pagolink_hosted'
          ? '✅ Pasarela ACTIVADA: los compradores serán redirigidos al checkout oficial de PagoLink.'
          : '✅ Modo directo ACTIVADO: los compradores pagarán con el formulario integrado en Teatrando.'
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const esModoHosted = config?.modo === 'pagolink_hosted';

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', fontSize: '1.5rem', marginBottom: '0.4rem' }}>
        ⚙️ Configuración de Pasarela de Pago
      </h2>
      <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Controla cómo los espectadores realizan el pago al comprar su boleto en Teatrando.
      </p>

      {mensaje && (
        <div style={{
          background: 'rgba(74, 222, 128, 0.12)',
          border: '1px solid rgba(74, 222, 128, 0.35)',
          color: '#4ade80',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{mensaje}</span>
          <button onClick={() => setMensaje('')} style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(139, 26, 46, 0.2)',
          border: '1px solid rgba(139, 26, 46, 0.5)',
          color: '#ff8099',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#ff8099', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {!config ? (
        <p style={{ color: 'var(--color-texto-suave)' }}>Cargando configuración...</p>
      ) : (
        <div style={{ display: 'grid', gap: '1.25rem' }}>

          {/* Estado actual */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: esModoHosted ? '#4ade80' : '#f59e0b',
              flexShrink: 0,
              boxShadow: `0 0 8px ${esModoHosted ? '#4ade80' : '#f59e0b'}`,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: esModoHosted ? '#4ade80' : '#f59e0b', marginBottom: '0.15rem' }}>
                Modo activo: {esModoHosted ? '🌐 Checkout de PagoLink (URL Externa)' : '⚡ Formulario Directo Embebido'}
              </div>
              <div style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem' }}>
                {config.descripcion}
              </div>
              <div style={{ color: 'var(--color-texto-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                Actualizado por <strong>{config.actualizado_por}</strong> el{' '}
                {new Date(config.actualizado_en).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
          </div>

          {/* Opciones de modo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>

            {/* Opción 1: PagoLink Hosted */}
            <div
              className="card"
              style={{
                padding: '1.5rem',
                border: esModoHosted
                  ? '2px solid #4ade80'
                  : '1px solid var(--color-borde)',
                cursor: 'pointer',
                transition: 'border 0.2s, box-shadow 0.2s',
                boxShadow: esModoHosted ? '0 0 16px rgba(74,222,128,0.15)' : 'none',
              }}
              onClick={() => cambiarModo('pagolink_hosted')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '1.6rem' }}>🌐</div>
                <div style={{
                  background: esModoHosted ? '#4ade80' : 'var(--color-borde)',
                  color: esModoHosted ? '#0d0507' : 'var(--color-texto-suave)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  {esModoHosted ? '● Activo' : 'Inactivo'}
                </div>
              </div>

              <h3 style={{ color: 'var(--color-primario)', fontFamily: 'var(--font-familia)', fontSize: '1.1rem', marginBottom: '0.4rem' }}>
                Checkout Oficial de PagoLink
              </h3>
              <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                Al pagar, el espectador es redirigido al checkout seguro de PagoLink donde puede elegir entre <strong>Pago Móvil</strong>, <strong>C2P</strong>, <strong>Binance Pay</strong> y <strong>Transferencia</strong>.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
                <div style={{ color: '#4ade80' }}>✓ Todos los métodos de pago en Venezuela</div>
                <div style={{ color: '#4ade80' }}>✓ Validación bancaria automática en tiempo real</div>
                <div style={{ color: '#4ade80' }}>✓ Aparece registrado en app.pagolink.co</div>
                <div style={{ color: 'var(--color-texto-muted)' }}>⚡ El espectador sale de Teatrando brevemente</div>
              </div>

              <button
                className="btn btn-primario"
                style={{ width: '100%', opacity: guardando ? 0.6 : 1 }}
                disabled={guardando || esModoHosted}
                onClick={(e) => { e.stopPropagation(); cambiarModo('pagolink_hosted'); }}
              >
                {esModoHosted ? '✓ Modo actualmente seleccionado' : (guardando ? 'Aplicando...' : 'Activar este modo')}
              </button>
            </div>

            {/* Opción 2: Formulario Directo */}
            <div
              className="card"
              style={{
                padding: '1.5rem',
                border: !esModoHosted
                  ? '2px solid #f59e0b'
                  : '1px solid var(--color-borde)',
                cursor: 'pointer',
                transition: 'border 0.2s, box-shadow 0.2s',
                boxShadow: !esModoHosted ? '0 0 16px rgba(245,158,11,0.15)' : 'none',
              }}
              onClick={() => cambiarModo('c2p_directo')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '1.6rem' }}>⚡</div>
                <div style={{
                  background: !esModoHosted ? '#f59e0b' : 'var(--color-borde)',
                  color: !esModoHosted ? '#0d0507' : 'var(--color-texto-suave)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  {!esModoHosted ? '● Activo' : 'Inactivo'}
                </div>
              </div>

              <h3 style={{ color: 'var(--color-primario)', fontFamily: 'var(--font-familia)', fontSize: '1.1rem', marginBottom: '0.4rem' }}>
                Formulario Directo Embebido
              </h3>
              <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                El espectador ingresa banco, cédula, teléfono y <strong>Clave Dinámica OTP</strong> directamente en la web de Teatrando. Se procesa vía C2P / Débito Inmediato sin salir de la página.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
                <div style={{ color: '#4ade80' }}>✓ El espectador nunca abandona Teatrando</div>
                <div style={{ color: '#4ade80' }}>✓ Experiencia visual 100% de Teatrando</div>
                <div style={{ color: 'var(--color-texto-muted)' }}>• Solo disponible con C2P / Débito Inmediato</div>
                <div style={{ color: 'var(--color-texto-muted)' }}>• Requiere que el cliente tenga OTP disponible</div>
              </div>

              <button
                className="btn"
                style={{
                  width: '100%',
                  background: !esModoHosted ? 'rgba(245,158,11,0.2)' : 'transparent',
                  border: `1px solid ${!esModoHosted ? '#f59e0b' : 'var(--color-borde)'}`,
                  color: !esModoHosted ? '#f59e0b' : 'var(--color-texto-suave)',
                  opacity: guardando ? 0.6 : 1,
                }}
                disabled={guardando || !esModoHosted}
                onClick={(e) => { e.stopPropagation(); cambiarModo('c2p_directo'); }}
              >
                {!esModoHosted ? '✓ Modo actualmente seleccionado' : (guardando ? 'Aplicando...' : 'Activar este modo')}
              </button>
            </div>
          </div>

          {/* Nota informativa */}
          <div style={{
            background: 'rgba(201,162,75,0.08)',
            border: '1px solid rgba(201,162,75,0.25)',
            borderRadius: '8px',
            padding: '1rem',
            fontSize: '0.84rem',
            color: 'var(--color-texto-suave)',
            lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--color-primario)' }}>📌 Nota técnica:</strong>{' '}
            El cambio es instantáneo. En el modo <em>Checkout de PagoLink</em>, al completar el pago el espectador es redirigido automáticamente de vuelta a Teatrando con su boleto confirmado. En el modo <em>Formulario Directo</em>, la clave OTP la genera el cliente desde la app de su banco antes de pagar.
          </div>
        </div>
      )}
    </div>
  );
}
