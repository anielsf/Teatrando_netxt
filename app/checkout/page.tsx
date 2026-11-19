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
  const [asientosOcupados, setAsientosOcupados] = useState<string[]>([]);
  const [metodoPago, setMetodoPago] = useState<'pasarela' | 'pagomovil' | 'transferencia' | 'binance'>('pasarela');

  // Configuración de modo de pasarela (cargado desde admin)
  const [modoPasarela, setModoPasarela] = useState<'pagolink_hosted' | 'c2p_directo'>('c2p_directo');
  const [urlCheckoutPagoLink, setUrlCheckoutPagoLink] = useState<string>('');
  const [cargandoSesionPagoLink, setCargandoSesionPagoLink] = useState(false);

  // Formulario Bancario y Pasarela
  const [bancoEmisor, setBancoEmisor] = useState('0102');
  const [telefonoEmisor, setTelefonoEmisor] = useState('');
  const [cedulaEmisor, setCedulaEmisor] = useState('');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [tokenOtp, setTokenOtp] = useState('');

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

  // Cargar el modo de pasarela configurado por el admin
  useEffect(() => {
    fetch('/api/config-pago')
      .then((r) => r.json())
      .then((data) => {
        if (data?.modo) setModoPasarela(data.modo);
      })
      .catch(() => {});
  }, []);

  // Cargar asientos ya ocupados para esta obra en tiempo real
  useEffect(() => {
    if (carteleraSeleccionada?.id) {
      fetch(`/api/tickets?id_obra=${encodeURIComponent(carteleraSeleccionada.id)}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const ocup = data.map((t: any) => String(t.asiento).trim().toUpperCase());
            setAsientosOcupados(ocup);
            // Si el asiento A1 está ocupado, seleccionar el primer asiento libre
            if (ocup.includes('A1')) {
              const todos = ['A','B','C','D'].flatMap((f) => [1,2,3,4,5,6,7,8].map((c) => `${f}${c}`));
              const libre = todos.find((a) => !ocup.includes(a));
              if (libre) setAsientoSeleccionado(libre);
            }
          }
        })
        .catch(() => {});
    }
  }, [carteleraSeleccionada?.id]);

  // Si no hay obra seleccionada en el store, permitir elegir o volver a cartelera
  const obra = carteleraSeleccionada;

  const precioUSD = obra ? Number(obra.precio_usd) || 15 : 15;
  const precioVES = convertToVES(precioUSD);

  // Generador de asientos del teatro (Filas A a D, columnas 1 a 8)
  const filas = ['A', 'B', 'C', 'D'];
  const columnas = [1, 2, 3, 4, 5, 6, 7, 8];

  const handlePagar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!obra) {
      setError('No hay ninguna obra seleccionada.');
      return;
    }

    // ── MODO PAGOLINK HOSTED: crear sesión y redirigir ──────────────────────
    if (metodoPago === 'pasarela' && modoPasarela === 'pagolink_hosted') {
      setCargandoSesionPagoLink(true);
      setError('');
      try {
        const res = await fetch('/api/tickets/pagolink-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_obra: obra.id,
            obra: obra.obra,
            asiento: asientoSeleccionado,
            fecha_funcion: obra.fecha ? String(obra.fecha).split('T')[0] : new Date().toISOString().split('T')[0],
            nombre_cliente: user?.nombre || 'Espectador',
            email_cliente: user?.email || '',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo crear la sesión de pago.');
        // Redirigir al checkout oficial de PagoLink
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          throw new Error('URL de pago no disponible.');
        }
      } catch (err: any) {
        setError(err.message);
        setCargandoSesionPagoLink(false);
      }
      return;
    }

    // ── MODO C2P DIRECTO: validar campos y enviar ────────────────────────────
    if (metodoPago === 'pasarela') {
      if (!bancoEmisor || !telefonoEmisor.trim() || !cedulaEmisor.trim() || !tokenOtp.trim()) {
        setError('Para procesar con la pasarela bancaria se requiere Banco, Cédula, Teléfono y Token OTP.');
        return;
      }
    } else {
      if (!referenciaPago.trim()) {
        setError('Por favor ingresa el número de referencia del comprobante de pago.');
        return;
      }
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
          nombre_cliente: user?.nombre || 'Espectador',
          email_cliente: user?.email || '',
          metodo_pago: metodoPago,
          banco_emisor: bancoEmisor,
          telefono_emisor: telefonoEmisor.trim(),
          cedula_emisor: cedulaEmisor.trim(),
          token_otp: tokenOtp.trim(),
          ref_pago: metodoPago === 'pasarela' ? undefined : refFormateada,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al emitir el ticket.');

      setTicketEmitido(data.ticket);
      setAsientosOcupados((prev) => [...prev, String(asientoSeleccionado).trim().toUpperCase()]);

      // Generar código QR para el boleto
      const qrPayload = JSON.stringify({
        ticket: data.ticket.ticket_id,
        obra: data.ticket.obra,
        asiento: data.ticket.asiento,
        fecha: data.ticket.fecha_funcion,
        ref: data.ticket.ref_pago,
        cliente: data.ticket.nombre_cliente,
        estado: data.ticket.estado,
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
            Ir a la Cartelera
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
              <span style={{ fontSize: '3rem' }}></span>
              <h1 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', margin: '0.5rem 0' }}>
                {ticketEmitido.estado === 'valido' ? '¡Boleto Emitido y Confirmado!' : '¡Boleto Registrado con Éxito!'}
              </h1>
              {ticketEmitido.estado === 'valido' ? (
                <>
                  <p style={{ color: '#4ade80', fontWeight: 600, margin: '0.35rem 0', fontSize: '1rem' }}>
                    ✅ Pago Conciliado por Pasarela Bancaria (Ref: {ticketEmitido.ref_pago})
                  </p>
                  <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                    Tu entrada está 100% activa. No requiere verificación manual: presenta el código QR directamente en puerta.
                  </p>
                </>
              ) : (
                <>
                  <p style={{ color: '#f59e0b', fontWeight: 600 }}>
                    ⏳ Tu pago (Ref: {ticketEmitido.ref_pago}) está pendiente de verificación por administración.
                  </p>
                  <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                    Una vez confirmado por administración, tu entrada quedará habilitada para el canje de acceso en taquilla.
                  </p>
                </>
              )}
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
                  <div style={{ marginTop: '0.4rem' }}>
                    {ticketEmitido.estado === 'valido' ? (
                      <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', border: '1px solid #22c55e', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                        ✓ Pago Aprobado en Vivo
                      </span>
                    ) : (
                      <span style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#fde047', border: '1px solid #eab308', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                        ⏳ Pendiente de Auditoría
                      </span>
                    )}
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
                      {ticketEmitido.fecha_funcion ? String(ticketEmitido.fecha_funcion).split('T')[0] : ''} · {ticketEmitido.hora_funcion?.slice(0, 5) || '19:00'}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-texto-muted)' }}>BUTACA ASIGNADA:</span>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#4ade80' }}>
                      Asiento {ticketEmitido.asiento}
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
                Imprimir Boleto
              </button>
              <a href="/cuenta" className="btn btn-primario">
                Ver en Mi Cuenta
              </a>
              <a href="/cartelera" className="btn btn-secundario">
                Volver a la Cartelera
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
                Adquisición de Boletos Teatrales
              </h1>
              <p style={{ color: 'var(--color-texto-suave)' }}>
                Selecciona tu butaca y realiza tu pago en Bolívares a la tasa oficial del Banco Central de Venezuela.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
              {/* COLUMNA IZQUIERDA: RESUMEN DE LA OBRA Y MAPA DE BUTACAS */}
              <div>
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ color: 'var(--color-primario)', marginBottom: '0.75rem' }}>Obra Seleccionada</h3>
                  <h2 style={{ fontFamily: 'var(--font-familia)', fontSize: '1.4rem', margin: '0 0 0.5rem' }}>{obra?.obra}</h2>
                  <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.88rem', margin: '0 0 0.5rem' }}>
                    {obra?.funcion} · {obra?.sala}
                  </p>
                  <p style={{ color: 'var(--color-texto-muted)', fontSize: '0.85rem' }}>
                    {obra?.fecha ? String(obra.fecha).split('T')[0] : ''} · {obra?.hora?.slice(0, 5)}
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
                  <h3 style={{ color: 'var(--color-primario)', marginBottom: '0.5rem' }}>Selección de Butaca</h3>
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
                          const ocupado = asientosOcupados.includes(idAsiento.toUpperCase());
                          const seleccionado = asientoSeleccionado === idAsiento;

                          return (
                            <button
                              key={idAsiento}
                              type="button"
                              disabled={ocupado}
                              onClick={() => {
                                if (!ocupado) setAsientoSeleccionado(idAsiento);
                              }}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                border: ocupado
                                  ? '1px solid #7f1d1d'
                                  : `1px solid ${seleccionado ? 'var(--color-primario)' : 'rgba(255,255,255,0.15)'}`,
                                background: ocupado
                                  ? 'rgba(185, 28, 28, 0.4)'
                                  : seleccionado
                                  ? 'var(--color-primario)'
                                  : 'rgba(255,255,255,0.05)',
                                color: ocupado
                                  ? '#fca5a5'
                                  : seleccionado
                                  ? 'var(--color-fondo)'
                                  : 'var(--color-texto)',
                                fontWeight: seleccionado ? 700 : 500,
                                fontSize: '0.75rem',
                                cursor: ocupado ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s ease',
                                opacity: ocupado ? 0.6 : 1,
                              }}
                              title={ocupado ? `Asiento ${idAsiento} (Ocupado)` : `Asiento ${idAsiento} (Disponible)`}
                            >
                              {ocupado ? '✕' : col}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Leyenda de butacas */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginTop: '1.25rem', fontSize: '0.78rem', color: 'var(--color-texto-suave)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: 14, height: 14, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 3 }} />
                      Disponible
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: 14, height: 14, background: 'var(--color-primario)', borderRadius: 3 }} />
                      Seleccionada
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: 14, height: 14, background: 'rgba(185, 28, 28, 0.4)', border: '1px solid #7f1d1d', borderRadius: 3 }} />
                      Ocupada
                    </div>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setMetodoPago('pasarela')}
                    className={`btn ${metodoPago === 'pasarela' ? 'btn-primario' : 'btn-secundario'}`}
                    style={{ fontSize: '0.82rem', padding: '0.6rem 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                  >
                    <span>⚡ Pasarela API</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetodoPago('pagomovil')}
                    className={`btn ${metodoPago === 'pagomovil' ? 'btn-primario' : 'btn-secundario'}`}
                    style={{ fontSize: '0.82rem', padding: '0.6rem 0.4rem' }}
                  >
                    Pago Móvil
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetodoPago('transferencia')}
                    className={`btn ${metodoPago === 'transferencia' ? 'btn-primario' : 'btn-secundario'}`}
                    style={{ fontSize: '0.82rem', padding: '0.6rem 0.4rem' }}
                  >
                    Transferencia
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetodoPago('binance')}
                    className={`btn ${metodoPago === 'binance' ? 'btn-primario' : 'btn-secundario'}`}
                    style={{ fontSize: '0.82rem', padding: '0.6rem 0.4rem' }}
                  >
                    Binance / Cripto
                  </button>
                </div>

                {/* Datos del receptor según el método */}
                {metodoPago === 'pasarela' && modoPasarela === 'pagolink_hosted' && (
                  <div
                    style={{
                      background: 'rgba(34, 197, 94, 0.08)',
                      border: '2px solid rgba(34, 197, 94, 0.4)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      marginBottom: '1.5rem',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌐</div>
                    <div style={{ fontWeight: 700, color: '#4ade80', fontSize: '1rem', marginBottom: '0.4rem' }}>
                      Pago a través del Checkout Oficial de PagoLink
                    </div>
                    <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem', margin: '0 0 0.75rem 0', lineHeight: 1.5 }}>
                      Al continuar serás redirigido al portal de pago seguro de PagoLink donde podrás pagar con
                      <strong> Pago Móvil, C2P, Binance Pay o Transferencia</strong>. Al completar tu pago, regresarás automáticamente con tu boleto confirmado.
                    </p>
                    <div style={{ color: 'var(--color-primario)', fontWeight: 700, fontSize: '1.1rem' }}>
                      Total a pagar: {formatVES(precioVES)} (${precioUSD} USD)
                    </div>
                  </div>
                )}

                {metodoPago === 'pasarela' && modoPasarela === 'c2p_directo' && (
                  <div
                    style={{
                      background: 'rgba(34, 197, 94, 0.1)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '1.5rem',
                      fontSize: '0.88rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#4ade80', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>⚡ Pasarela Automatizada de Pago (C2P en Vivo)</span>
                      <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.12)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                        API Conectada
                      </span>
                    </div>
                    <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.82rem', margin: '0 0 0.5rem 0' }}>
                      Ingresa tu banco, teléfono y el <strong>Token OTP (Clave Dinámica)</strong> generado desde la app de tu banco. Tu boleto quedará aprobado de inmediato.
                    </p>
                    <div style={{ color: 'var(--color-primario)', fontWeight: 700 }}>
                      • Monto a debitar: {formatVES(precioVES)} (${precioUSD} USD)
                    </div>
                  </div>
                )}

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
                  {/* En modo PagoLink Hosted, solo mostramos el botón de redireccion */}
                  {metodoPago === 'pasarela' && modoPasarela === 'pagolink_hosted' ? (
                    <>
                      {error && <p style={{ color: '#ff8099', fontSize: '0.85rem', margin: 0 }}>⚠️ {error}</p>}
                      <button
                        type="submit"
                        className="btn btn-primario"
                        disabled={cargandoSesionPagoLink}
                        style={{ width: '100%', marginTop: '0.5rem', padding: '0.9rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                      >
                        {cargandoSesionPagoLink
                          ? '⏳ Creando sesión de pago...'
                          : `🌐 Ir al Checkout de PagoLink · Asiento ${asientoSeleccionado}`}
                      </button>
                      <p style={{ color: 'var(--color-texto-muted)', fontSize: '0.75rem', textAlign: 'center', margin: 0 }}>
                        Serás redirigido a pay.pagolink.co para completar el pago de forma segura.
                      </p>
                    </>
                  ) : (
                    <>
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
                          Teléfono Pagador *
                        </label>
                        <input
                          type="tel"
                          placeholder="04121234567"
                          className="input"
                          value={telefonoEmisor}
                          onChange={(e) => setTelefonoEmisor(e.target.value)}
                          required={metodoPago === 'pasarela'}
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

                    {metodoPago === 'pasarela' ? (
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#4ade80', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
                          Clave Dinámica / Token OTP *
                        </label>
                        <input
                          type="password"
                          maxLength={8}
                          placeholder="Clave de 6 a 8 dígitos"
                          className="input"
                          value={tokenOtp}
                          onChange={(e) => setTokenOtp(e.target.value)}
                          required
                          style={{ borderColor: 'rgba(34, 197, 94, 0.4)' }}
                        />
                      </div>
                    ) : (
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
                    )}
                  </div>

                  {error && <p style={{ color: '#ff8099', fontSize: '0.85rem', margin: 0 }}>⚠️ {error}</p>}

                  <button
                    type="submit"
                    className="btn btn-primario"
                    disabled={procesando}
                    style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
                  >
                    {procesando
                      ? 'Conectando con la Pasarela y Emitiendo...'
                      : metodoPago === 'pasarela'
                      ? `⚡ Pagar y Emitir Boleto en Vivo (${asientoSeleccionado})`
                      : `Confirmar y Emitir Boleto (${asientoSeleccionado})`}
                  </button>
                    </>
                  )}
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
