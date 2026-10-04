'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/Modal';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/hooks/useCurrency';

const BANCOS_VENEZUELA = [
  { codigo: '0102', nombre: 'Banco de Venezuela' },
  { codigo: '0134', nombre: 'Banesco' },
  { codigo: '0105', nombre: 'Banco Mercantil' },
  { codigo: '0108', nombre: 'BBVA Provincial' },
  { codigo: '0172', nombre: 'Bancamiga' },
  { codigo: '0191', nombre: 'Banco Nacional de Crédito (BNC)' },
];

interface PlanItem {
  id: string;            // clave del plan (lo que se guarda en la base de datos)
  nombre: string;
  precioUSD: number;
  descripcion: string;
  beneficios: string[];
  badge: string;
  destacado: boolean;
  requiereAprobacion: boolean;
}

const PLAN_VACIO: PlanItem = {
  id: '', nombre: '', precioUSD: 0, descripcion: '', beneficios: [], badge: '', destacado: false, requiereAprobacion: false,
};

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SubscriptionModal({ isOpen, onClose }: SubscriptionModalProps) {
  const { user, isAuthenticated } = useAuth();
  const { tasaBCV, convertToVES, formatVES } = useCurrency();

  const [planes, setPlanes] = useState<PlanItem[]>([]);
  const [cargandoPlanes, setCargandoPlanes] = useState(false);
  const [planSeleccionado, setPlanSeleccionado] = useState<PlanItem>(PLAN_VACIO);
  const [paso, setPaso] = useState<'seleccion' | 'pago' | 'exito'>('seleccion');

  // Formulario Pago Móvil
  const [bancoEmisor, setBancoEmisor] = useState('0102');
  const [telefonoEmisor, setTelefonoEmisor] = useState('');
  const [cedulaEmisor, setCedulaEmisor] = useState('');
  const [referenciaPago, setReferenciaPago] = useState('');

  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [resultadoSuscripcion, setResultadoSuscripcion] = useState<any | null>(null);

  // Los planes visibles los configura el Admin (tabla public.planes)
  useEffect(() => {
    if (!isOpen) return;
    let cancelado = false;
    setCargandoPlanes(true);
    fetch('/api/planes')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) => {
        if (cancelado) return;
        const lista: PlanItem[] = (Array.isArray(data) ? data : []).map((p) => ({
          id: p.clave,
          nombre: p.nombre,
          precioUSD: Number(p.precio_usd),
          descripcion: p.descripcion,
          beneficios: Array.isArray(p.beneficios) ? p.beneficios : [],
          badge: p.badge,
          destacado: !!p.destacado,
          requiereAprobacion: !!p.requiere_aprobacion,
        }));
        setPlanes(lista);
        setPlanSeleccionado(lista.find((p) => p.destacado) || lista[0] || PLAN_VACIO);
      })
      .catch(() => { if (!cancelado) setPlanes([]); })
      .finally(() => { if (!cancelado) setCargandoPlanes(false); });
    return () => { cancelado = true; };
  }, [isOpen]);

  const precioVES = convertToVES(planSeleccionado.precioUSD);

  const iniciarPago = (plan: PlanItem) => {
    setPlanSeleccionado(plan);
    if (plan.precioUSD === 0) {
      // Plan básico gratuito
      ejecutarSuscripcionGratuita(plan.id);
    } else {
      setPaso('pago');
    }
  };

  const ejecutarSuscripcionGratuita = async (planId: string) => {
    if (!isAuthenticated) {
      window.location.href = '/auth?next=/cuenta';
      return;
    }
    setProcesando(true);
    try {
      const res = await fetch('/api/suscripciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          precioUSD: 0,
          tasaBCV,
          refPago: 'PLAN-GRATIS',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al activar plan');
      setResultadoSuscripcion(data);
      setPaso('exito');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const handlePagarSuscripcion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referenciaPago.trim()) {
      setError('Por favor ingresa el número de referencia del Pago Móvil o transferencia.');
      return;
    }

    if (!isAuthenticated) {
      window.location.href = '/auth?next=/cuenta';
      return;
    }

    setProcesando(true);
    setError('');

    try {
      const refFinal = `PAGOMOVIL-SUBS-${bancoEmisor}-${referenciaPago.trim()}`;
      const res = await fetch('/api/suscripciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planSeleccionado.id,
          precioUSD: planSeleccionado.precioUSD,
          tasaBCV,
          precioVES,
          refPago: refFinal,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar la suscripción.');

      setResultadoSuscripcion(data);
      setPaso('exito');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const reiniciar = () => {
    setPaso('seleccion');
    setError('');
    setReferenciaPago('');
    onClose();
    if (paso === 'exito') {
      window.location.reload();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={reiniciar} title="★ Membresías & Planes VIP Teatrando" size="lg">
      <div>
        {paso === 'seleccion' && (
          <div>
            <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              Elige tu membresía teatral y desbloquea los beneficios de cada plan.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {!cargandoPlanes && planes.length === 0 && (
                <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--color-texto-suave)' }}>
                  No hay planes disponibles por ahora.
                </p>
              )}
              {planes.map((plan) => {
                const esActual = user?.plan === plan.id;
                const esVIP = plan.destacado;
                return (
                  <div
                    key={plan.id}
                    className="card"
                    style={{
                      border: esVIP ? '2px solid #d4af37' : '1px solid var(--color-borde)',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      background: esVIP ? 'linear-gradient(180deg, rgba(201,162,75,0.1) 0%, rgba(13,5,7,0.9) 100%)' : undefined,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span className={esVIP ? 'badge badge-critico' : 'badge badge-usuario'} style={{ fontSize: '0.72rem' }}>
                          {plan.badge}
                        </span>
                        {esActual && <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 600 }}>Tu Plan Actual</span>}
                      </div>

                      <h3 style={{ fontFamily: 'var(--font-familia)', color: esVIP ? '#d4af37' : 'var(--color-texto)', fontSize: '1.2rem', margin: '0.25rem 0' }}>
                        {plan.nombre}
                      </h3>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primario)', margin: '0.5rem 0' }}>
                        ${plan.precioUSD} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--color-texto-muted)' }}>/mes</span>
                      </div>
                      {plan.precioUSD > 0 && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-texto-suave)', marginBottom: '0.75rem' }}>
                          Aprox. {formatVES(convertToVES(plan.precioUSD))} (Tasa BCV)
                        </div>
                      )}
                      <p style={{ fontSize: '0.82rem', color: 'var(--color-texto-suave)', marginBottom: '1rem', minHeight: 40 }}>
                        {plan.descripcion}
                      </p>

                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem', fontSize: '0.8rem', color: 'var(--color-texto)', display: 'grid', gap: '0.4rem' }}>
                        {plan.beneficios.map((b, i) => (
                          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ color: '#22c55e' }}>✓</span> {b}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      onClick={() => iniciarPago(plan)}
                      className={`btn ${esVIP ? 'btn-primario' : 'btn-secundario'}`}
                      style={{ width: '100%', fontSize: '0.85rem' }}
                      disabled={esActual}
                    >
                      {esActual ? 'Plan Activo' : plan.precioUSD === 0 ? (plan.requiereAprobacion ? 'Solicitar plan' : 'Seleccionar Gratis') : (plan.requiereAprobacion ? 'Solicitar con Pago Móvil' : 'Suscribirme con Pago Móvil')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {paso === 'pago' && (
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <button
                onClick={() => setPaso('seleccion')}
                style={{ background: 'none', border: 'none', color: 'var(--color-texto-suave)', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ← Volver a elegir plan
              </button>
              <h2 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', margin: '0.5rem 0' }}>
                Pago de Suscripción: {planSeleccionado.nombre}
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {/* Datos de Pago Móvil receptor */}
              <div style={{ background: 'rgba(201,162,75,0.1)', border: '1px solid rgba(201,162,75,0.3)', padding: '1.25rem', borderRadius: '10px', fontSize: '0.88rem' }}>
                <h4 style={{ color: 'var(--color-primario)', margin: '0 0 0.75rem' }}>📱 Datos para tu Pago Móvil:</h4>
                <div style={{ display: 'grid', gap: '0.4rem' }}>
                  <div>• Banco Destino: <strong>0102 - Banco de Venezuela</strong></div>
                  <div>• Teléfono: <strong>0414-8328726</strong></div>
                  <div>• RIF: <strong>J-50123456-0</strong></div>
                  <div>• Titular: <strong>Teatrando Producciones C.A.</strong></div>
                  <div style={{ borderTop: '1px dashed var(--color-borde)', paddingTop: '0.5rem', marginTop: '0.3rem' }}>
                    • Monto en USD: <strong>${planSeleccionado.precioUSD} USD</strong>
                  </div>
                  <div>• Tasa Oficial BCV: <strong>Bs. {tasaBCV.toFixed(2)}</strong></div>
                  <div style={{ color: '#22c55e', fontSize: '1.1rem', fontWeight: 700, marginTop: '0.2rem' }}>
                    • Total exacto a transferir: {formatVES(precioVES)}
                  </div>
                </div>
              </div>

              {/* Formulario de reporte */}
              <form onSubmit={handlePagarSuscripcion} style={{ display: 'grid', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--color-texto-suave)', display: 'block', marginBottom: '0.25rem' }}>
                    Banco Emisor (desde donde pagas) *
                  </label>
                  <select className="input" value={bancoEmisor} onChange={(e) => setBancoEmisor(e.target.value)} required>
                    {BANCOS_VENEZUELA.map((b) => (
                      <option key={b.codigo} value={b.codigo}>{b.codigo} - {b.nombre}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
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

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--color-texto-suave)', display: 'block', marginBottom: '0.25rem' }}>
                    Número de Referencia Bancaria *
                  </label>
                  <input
                    type="text"
                    placeholder="Últimos dígitos (ej: 847291)"
                    className="input"
                    value={referenciaPago}
                    onChange={(e) => setReferenciaPago(e.target.value)}
                    required
                  />
                </div>

                {error && <p style={{ color: '#ff8099', fontSize: '0.85rem', margin: 0 }}>⚠️ {error}</p>}

                <button
                  type="submit"
                  className="btn btn-primario"
                  disabled={procesando}
                  style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
                >
                  {procesando ? 'Activando Membresía...' : `Confirmar Suscripción (${formatVES(precioVES)})`}
                </button>
              </form>
            </div>
          </div>
        )}

        {paso === 'exito' && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <span style={{ fontSize: '3.5rem' }}>{resultadoSuscripcion?.pendiente ? '⏳' : '🎉'}</span>
            <h2 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', margin: '0.5rem 0' }}>
              {resultadoSuscripcion?.pendiente ? '¡Solicitud enviada!' : '¡Membresía Activada con Éxito!'}
            </h2>
            <p style={{ color: '#22c55e', fontWeight: 600, fontSize: '1.05rem', marginBottom: '1rem' }}>
              {resultadoSuscripcion?.pendiente
                ? `Tu solicitud al ${resultadoSuscripcion?.plan || planSeleccionado.nombre} está en revisión`
                : `Ahora formas parte del ${resultadoSuscripcion?.plan || planSeleccionado.nombre}`}
            </p>
            <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.9rem', maxWidth: 450, margin: '0 auto 1.5rem' }}>
              {resultadoSuscripcion?.pendiente
                ? 'Un administrador verificará tu pago y activará el plan. Tu rol actual no cambia hasta entonces.'
                : <>Tu rol es ahora <strong>{resultadoSuscripcion?.rol}</strong>. Ya puedes disfrutar los beneficios de tu plan.</>}
            </p>
            <button onClick={reiniciar} className="btn btn-primario">
              Continuar a Teatrando
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}