'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/hooks/useCurrency';
import { useAppStore } from '@/store/appStore';
import QRCode from 'qrcode';

const BANCOS_VENEZUELA = [
  { codigo: '0102', nombre: 'Banco de Venezuela' },
  { codigo: '0134', nombre: 'Banesco' },
  { codigo: '0105', nombre: 'Banco Mercantil' },
  { codigo: '0108', nombre: 'BBVA Provincial' },
  { codigo: '0172', nombre: 'Bancamiga' },
  { codigo: '0191', nombre: 'Banco Nacional de Crédito (BNC)' },
  { codigo: '0114', nombre: 'Bancaribe' },
  { codigo: '0116', nombre: 'Banco Occidental de Descuento (BOD/BNC)' },
  { codigo: '0168', nombre: 'Bancrecer' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { carteleraSeleccionada } = useAppStore();
  const { formatUSD, formatVES, convertToVES, tasaBCV } = useCurrency();

  // Estados de checkout
  const [asientoSeleccionado, setAsientoSeleccionado] = useState<string>('A1');
  const [metodoPago, setMetodoPago] = useState<'pagomovil' | 'transferencia' | 'binance'>('pagomovil');

  // Formulario Pago Móvil
  const [bancoEmisor, setBancoEmisor] = useState('0102');
  const [telefonoEmisor, setTelefonoEmisor] = useState('');
  const [cedulaEmisor, setCedulaEmisor] = useState('');
  const [referenciaPago, setReferenciaPago] = useState('');

  // Estados de proceso
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [ticketEmitido, setTicketEmitido] = useState<any | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth?next=/checkout');
    }
  }, [authLoading, isAuthenticated, router]);

  // Si no hay obra seleccionada en el store, permitir elegir o volver a cartelera
  const obra = carteleraSeleccionada;

  const precioUSD = obra ? Number(obra.precio_usd) || 15 : 15;
  const precioVES = convertToVES(precioUSD);

  // Generador de asientos del teatro (Filas A a D, columnas 1 a 8)
  const filas = ['A', 'B', 'C', 'D'];
  const columnas = [1, 2, 3, 4, 5, 6, 7, 8];

  const handlePagar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referenciaPago.trim()) {
      setError('Por favor ingresa el número de referencia del comprobante de pago.');
      return;
    }

    if (!obra) {
      setError('No hay ninguna obra seleccionada.');
      return;
    }

    setProcesando(true);
    setError('');

    try {
      const refFormateada = `${metodoPago.toUpperCase()}-${bancoEmisor}-${referenciaPago.trim()}`;

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_obra: obra.id,
          obra: obra.obra,
          funcion: obra.funcion || 'Función Principal',
          sala: obra.sala || 'Sala Principal',
          asiento: asientoSeleccionado,
          fecha_funcion: obra.fecha ? String(obra.fecha).split('T')[0] : new Date().toISOString().split('T')[0],
          hora_funcion: obra.hora || '19:00',
          precio_usd: precioUSD,
          precio_ves: precioVES,
          tasa_bcv: tasaBCV,
          ref_pago: refFormateada,
          nombre_cliente: user?.nombre || 'Espectador',
          email_cliente: user?.email || '',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al emitir el ticket.');

      setTicketEmitido(data.ticket);

      // Generar código QR para el boleto
      const qrPayload = JSON.stringify({
        ticket: data.ticket.ticket_id,
        obra: data.ticket.obra,
        asiento: data.ticket.asiento,
        fecha: data.ticket.fecha_funcion,
        ref: data.ticket.ref_pago,
        cliente: data.ticket.nombre_cliente,
      });

      const qr = await QRCode.toDataURL(qrPayload, {
        width: 240,
        margin: 1,
        color: { dark: '#0d0507', light: '#f5e6c8' },
      });
      setQrDataUrl(qr);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  if (!obra && !ticketEmitido) {
    return (
      <>
        <Navbar />
        <main className="contenedor" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', marginBottom: '1rem' }}>
            No has seleccionado ninguna obra
          </h1>
          <p style={{ color: 'var(--color-texto-suave)', marginBottom: '2rem' }}>
            Por favor ingresa a la cartelera y selecciona la obra que deseas disfrutar.
          </p>
          <a href="/cartelera" className="btn btn-primario">
            🎭 Ir a la Cartelera
          </a>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="contenedor" style={{ padding: '2.5rem 1.5rem 5rem' }}>
        {ticketEmitido ? (
          /* =====================================================
             PANTALLA DE COMPRA EXITOSA Y TICKET GENERADO
          ===================================================== */
          <div style={{ maxWidth: 650, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <span style={{ fontSize: '3rem' }}>🎉</span>
              <h1 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', margin: '0.5rem 0' }}>
                ¡Pago Confirmado y Boleto Emitido!
              </h1>
              <p style={{ color: '#7ccc8e', fontWeight: 600 }}>
                Tu pago mediante pasarela venezolana fue registrado con éxito.
              </p>
            </div>

            {/* Boleto Teatral Digital */}
            <div
              style={{
                background: 'linear-gradient(135deg, #1f0b12 0%, #0d0507 100%)',
                border: '2px solid var(--color-primario)',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 20px 50px rgba(0,0,0,0.7), var(--sombra-glow)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px dashed var(--color-primario)', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
                <div>
                  <span style={{ color: 'var(--color-primario)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                    🎭 Teatrando — Boleto Oficial
                  </span>
                  <h2 style={{ fontFamily: 'var(--font-familia)', color: '#fff', fontSize: '1.7rem', margin: '0.25rem 0' }}>
                    {ticketEmitido.obra}
                  </h2>
                  <p style={{ color: 'var(--color-texto-suave)', margin: 0, fontSize: '0.9rem' }}>
                    {ticketEmitido.funcion} · {ticketEmitido.sala}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--color-texto-muted)', fontSize: '0.75rem' }}>CÓDIGO DE TICKET</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.2rem', color: 'var(--color-acento)' }}>
                    {ticketEmitido.ticket_id}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'center' }}>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-texto-muted)' }}>ESPECTADOR:</span>
                    <div style={{ fontWeight: 600, color: 'var(--color-texto)' }}>{ticketEmitido.nombre_cliente}</div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-texto-muted)' }}>FECHA Y HORA:</span>
                    <div style={{ fontWeight: 600, color: 'var(--color-texto)' }}>
                      📅 {ticketEmitido.fecha_funcion ? String(ticketEmitido.fecha_funcion).split('T')[0] : ''} · ⏰ {ticketEmitido.hora_funcion?.slice(0, 5) || '19:00'}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-texto-muted)' }}>BUTACA ASIGNADA:</span>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#4ade80' }}>
                      🪑 Asiento {ticketEmitido.asiento}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-texto-muted)' }}>PAGO REGISTRADO:</span>
                    <div style={{ color: 'var(--color-primario)', fontWeight: 600 }}>
                      ${ticketEmitido.precio_usd} USD ({formatVES(ticketEmitido.precio_ves || 0)})
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-texto-muted)' }}>
                      Ref: {ticketEmitido.ref_pago}
                    </div>
                  </div>
                </div>

                {/* Código QR del Boleto */}
                {qrDataUrl && (
                  <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '12px' }}>
                    <img src={qrDataUrl} alt="QR del ticket" style={{ width: 170, height: 170, borderRadius: 8 }} />
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-texto-suave)', marginTop: '0.5rem', margin: 0 }}>
                      Presenta este QR al ingresar a la sala
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2.5rem', flexWrap: 'wrap' }}>
              <button onClick={() => window.print()} className="btn btn-secundario">
                🖨️ Imprimir Boleto
              </button>
              <a href="/cuenta" className="btn btn-primario">
                🎟️ Ver en Mi Cuenta
              </a>
              <a href="/cartelera" className="btn btn-secundario">
                🎭 Volver a la Cartelera
              </a>
            </div>
          </div>
        ) : (
          /* =====================================================
             FORMULARIO DE SELECCIÓN Y PASARELA DE PAGOS VENEZUELA
          ===================================================== */
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <a href="/cartelera" style={{ color: 'var(--color-texto-suave)', textDecoration: 'none', fontSize: '0.9rem' }}>
                ← Volver a la Cartelera
              </a>
              <h1 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', margin: '0.5rem 0' }}>
                🎟️ Adquisición de Boletos Teatrales
              </h1>
              <p style={{ color: 'var(--color-texto-suave)' }}>
                Selecciona tu butaca y realiza tu pago en Bolívares a la tasa oficial del Banco Central de Venezuela.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
              {/* COLUMNA IZQUIERDA: RESUMEN DE LA OBRA Y MAPA DE BUTACAS */}
              <div>
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ color: 'var(--color-primario)', marginBottom: '0.75rem' }}>🎭 Obra Seleccionada</h3>
                  <h2 style={{ fontFamily: 'var(--font-familia)', fontSize: '1.4rem', margin: '0 0 0.5rem' }}>{obra?.obra}</h2>
                  <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.88rem', margin: '0 0 0.5rem' }}>
                    {obra?.funcion} · {obra?.sala}
                  </p>
                  <p style={{ color: 'var(--color-texto-muted)', fontSize: '0.85rem' }}>
                    📅 {obra?.fecha ? String(obra.fecha).split('T')[0] : ''} · ⏰ {obra?.hora?.slice(0, 5)}
                  </p>

                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-borde)', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span className="texto-suave">Precio de Entrada:</span>
                      <strong style={{ color: 'var(--color-primario)', fontSize: '1.2rem' }}>{formatUSD(precioUSD)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span className="texto-suave">Tasa Oficial BCV:</span>
                      <strong style={{ color: 'var(--color-acento)' }}>Bs. {tasaBCV.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px dashed var(--color-borde)' }}>
                      <span style={{ fontWeight: 600 }}>Total a Pagar (VES):</span>
                      <strong style={{ color: '#4ade80', fontSize: '1.3rem' }}>{formatVES(precioVES)}</strong>
                    </div>
                  </div>
                </div>

                {/* Selección interactiva de butacas */}
                <div className="card">
                  <h3 style={{ color: 'var(--color-primario)', marginBottom: '0.5rem' }}>🪑 Selección de Butaca</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-texto-suave)', marginBottom: '1rem' }}>
                    Elige tu asiento preferido frente al escenario:
                  </p>

                  {/* Escenario */}
                  <div
                    style={{
                      background: 'rgba(201, 162, 75, 0.2)',
                      border: '1px solid var(--color-primario)',
                      borderRadius: '8px',
                      padding: '0.4rem',
                      textAlign: 'center',
                      color: 'var(--color-primario)',
                      fontWeight: 600,
                      letterSpacing: '0.2em',
                      fontSize: '0.75rem',
                      marginBottom: '1.5rem',
                    }}
                  >
                    — ESCENARIO PRINCIPAL —
                  </div>

                  {/* Grilla de asientos */}
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {filas.map((fila) => (
                      <div key={fila} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                        <span style={{ width: 20, fontSize: '0.8rem', color: 'var(--color-texto-muted)', fontWeight: 700 }}>
                          {fila}
                        </span>
                        {columnas.map((col) => {
                          const idAsiento = `${fila}${col}`;
                          const seleccionado = asientoSeleccionado === idAsiento;
                          return (
                            <button
                              key={idAsiento}
                              type="button"
                              onClick={() => setAsientoSeleccionado(idAsiento)}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                border: `1px solid ${seleccionado ? 'var(--color-primario)' : 'rgba(255,255,255,0.15)'}`,
                                background: seleccionado ? 'var(--color-primario)' : 'rgba(255,255,255,0.05)',
                                color: seleccionado ? 'var(--color-fondo)' : 'var(--color-texto)',
                                fontWeight: seleccionado ? 700 : 500,
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              title={`Asiento ${idAsiento}`}
                            >
                              {col}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
                    Asiento seleccionado:{' '}
                    <strong style={{ color: 'var(--color-primario)', fontSize: '1rem' }}>{asientoSeleccionado}</strong>
                  </div>
                </div>
              </div>

              {/* COLUMNA DERECHA: PASARELA DE PAGO COMPATIBLE CON VENEZUELA */}
              <div className="card">
                <h3 style={{ color: 'var(--color-primario)', marginBottom: '0.5rem' }}>
                  🇻🇪 Pasarela de Pagos Nacional (Venezuela)
                </h3>
                <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Paga seguro en Bolívares mediante Pago Móvil interbancario o transferencia nacional.
                </p>

                {/* Métodos de Pago */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setMetodoPago('pagomovil')}
                    className={`btn ${metodoPago === 'pagomovil' ? 'btn-primario' : 'btn-secundario'}`}
                    style={{ flex: 1, fontSize: '0.85rem', padding: '0.6rem 0.5rem' }}
                  >
                    📱 Pago Móvil
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetodoPago('transferencia')}
                    className={`btn ${metodoPago === 'transferencia' ? 'btn-primario' : 'btn-secundario'}`}
                    style={{ flex: 1, fontSize: '0.85rem', padding: '0.6rem 0.5rem' }}
                  >
                    🏦 Transferencia
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetodoPago('binance')}
                    className={`btn ${metodoPago === 'binance' ? 'btn-primario' : 'btn-secundario'}`}
                    style={{ flex: 1, fontSize: '0.85rem', padding: '0.6rem 0.5rem' }}
                  >
                    🟡 Binance / Cripto
                  </button>
                </div>

                {/* Datos del receptor según el método */}
                {metodoPago === 'pagomovil' && (
                  <div
                    style={{
                      background: 'rgba(201, 162, 75, 0.1)',
                      border: '1px solid rgba(201, 162, 75, 0.3)',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '1.5rem',
                      fontSize: '0.88rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--color-primario)', marginBottom: '0.4rem' }}>
                      Datos para emitir tu Pago Móvil:
                    </div>
                    <div style={{ display: 'grid', gap: '0.3rem' }}>
                      <div>• Banco Receptor: <strong>0102 - Banco de Venezuela</strong></div>
                      <div>• Teléfono: <strong>0414-8328726</strong></div>
                      <div>• RIF / Cédula: <strong>J-50123456-0</strong></div>
                      <div>• Titular: <strong>Teatrando Producciones C.A.</strong></div>
                      <div style={{ color: '#4ade80', fontWeight: 700, marginTop: '0.3rem' }}>
                        • Monto exacto a transferir: {formatVES(precioVES)}
                      </div>
                    </div>
                  </div>
                )}

                {metodoPago === 'transferencia' && (
                  <div
                    style={{
                      background: 'rgba(201, 162, 75, 0.1)',
                      border: '1px solid rgba(201, 162, 75, 0.3)',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '1.5rem',
                      fontSize: '0.88rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--color-primario)', marginBottom: '0.4rem' }}>
                      Datos de Cuenta Bancaria Nacional:
                    </div>
                    <div style={{ display: 'grid', gap: '0.3rem' }}>
                      <div>• Banco: <strong>Banco de Venezuela</strong></div>
                      <div>• Cuenta Corriente: <strong style={{ fontFamily: 'monospace' }}>0102-0123-45-0000123456</strong></div>
                      <div>• Titular: <strong>Teatrando Producciones C.A.</strong></div>
                      <div>• RIF: <strong>J-50123456-0</strong></div>
                      <div style={{ color: '#4ade80', fontWeight: 700, marginTop: '0.3rem' }}>
                        • Monto a transferir: {formatVES(precioVES)}
                      </div>
                    </div>
                  </div>
                )}

                {metodoPago === 'binance' && (
                  <div
                    style={{
                      background: 'rgba(240, 185, 11, 0.1)',
                      border: '1px solid rgba(240, 185, 11, 0.3)',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '1.5rem',
                      fontSize: '0.88rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#f0b90b', marginBottom: '0.4rem' }}>
                      Pago en USDT vía Binance Pay:
                    </div>
                    <div style={{ display: 'grid', gap: '0.3rem' }}>
                      <div>• Binance Pay ID: <strong style={{ fontFamily: 'monospace' }}>384920184</strong></div>
                      <div>• Monto USDT: <strong>${precioUSD.toFixed(2)} USDT</strong></div>
                    </div>
                  </div>
                )}

                {/* Formulario de reporte de pago */}
                <form onSubmit={handlePagar} style={{ display: 'grid', gap: '0.9rem' }}>
                  {metodoPago !== 'binance' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--color-texto-suave)', display: 'block', marginBottom: '0.25rem' }}>
                          Banco Emisor *
                        </label>
                        <select
                          className="input"
                          value={bancoEmisor}
                          onChange={(e) => setBancoEmisor(e.target.value)}
                          required
                        >
                          {BANCOS_VENEZUELA.map((b) => (
                            <option key={b.codigo} value={b.codigo}>
                              {b.codigo} - {b.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--color-texto-suave)', display: 'block', marginBottom: '0.25rem' }}>
                          Teléfono Pagador
                        </label>
                        <input
                          type="tel"
                          placeholder="04121234567"
                          className="input"
                          value={telefonoEmisor}
                          onChange={(e) => setTelefonoEmisor(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--color-texto-suave)', display: 'block', marginBottom: '0.25rem' }}>
                        Cédula del Titular *
                      </label>
                      <input
                        type="text"
                        placeholder="V-12345678"
                        className="input"
                        value={cedulaEmisor}
                        onChange={(e) => setCedulaEmisor(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--color-texto-suave)', display: 'block', marginBottom: '0.25rem' }}>
                        Nº de Referencia Bancaria *
                      </label>
                      <input
                        type="text"
                        placeholder="Últimos dígitos (ej: 984721)"
                        className="input"
                        value={referenciaPago}
                        onChange={(e) => setReferenciaPago(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {error && <p style={{ color: '#ff8099', fontSize: '0.85rem', margin: 0 }}>⚠️ {error}</p>}

                  <button
                    type="submit"
                    className="btn btn-primario"
                    disabled={procesando}
                    style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
                  >
                    {procesando ? 'Validando y Emitiendo Boleto...' : `Confirmar y Emitir Boleto (${asientoSeleccionado})`}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
