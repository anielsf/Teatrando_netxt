'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/Modal';
import { useCurrency } from '@/hooks/useCurrency';

interface CarteleraItem {
  id: string;
  obra: string;
  funcion: string;
  genero?: string;
  sala?: string;
  director?: string;
  fecha: string;
  hora: string;
  precio_usd: number;
  sinopsis?: string;
  reparto?: string;
  imagen?: string;
  duracion_min?: number;
  edad_minima?: string;
  visible: boolean;
  teatroNombre?: string;
  criticas?: any[];
  comentarios?: any[];
}

interface TicketItem {
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
  hora_emision?: string;
}

const FORM_INITIAL = {
  id: '',
  obra: '',
  funcion: 'Función Principal',
  genero: 'Drama',
  sala: 'Sala Principal',
  director: '',
  fecha: new Date().toISOString().split('T')[0],
  hora: '19:00',
  precioUSD: 15,
  duracionMin: 90,
  edadMinima: 'Todo público',
  sinopsis: '',
  reparto: '',
  imagen: '',
  visible: true,
};

export function AdminDashboard({ user }: { user: { nombre: string; email: string; rol: string } }) {
  const [tab, setTab] = useState<'carteleras' | 'tickets' | 'metricas'>('carteleras');
  const [carteleras, setCarteleras] = useState<CarteleraItem[]>([]);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  // Buscador y filtros
  const [busqueda, setBusqueda] = useState('');

  // Modal formulario
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(FORM_INITIAL);
  const [guardando, setGuardando] = useState(false);

  const { formatUSD, formatVES } = useCurrency();

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // Cargar todas las carteleras (incluyendo ocultas para admin)
      const resCart = await fetch('/api/carteleras?admin=true');
      if (resCart.ok) {
        const dataCart = await resCart.json();
        setCarteleras(dataCart);
      }

      // Cargar tickets de todas las ventas
      const resTick = await fetch('/api/tickets');
      if (resTick.ok) {
        const dataTick = await resTick.json();
        setTickets(Array.isArray(dataTick) ? dataTick : []);
      }
    } catch (err: any) {
      setError('Error al cargar datos administrativos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const abrirCrear = () => {
    setFormData(FORM_INITIAL);
    setModalOpen(true);
    setError('');
    setMensaje('');
  };

  const abrirEditar = (item: CarteleraItem) => {
    setFormData({
      id: item.id,
      obra: item.obra,
      funcion: item.funcion || 'Función Principal',
      genero: item.genero || 'Drama',
      sala: item.sala || 'Sala Principal',
      director: item.director || '',
      fecha: item.fecha ? String(item.fecha).split('T')[0] : '',
      hora: item.hora ? item.hora.slice(0, 5) : '19:00',
      precioUSD: Number(item.precio_usd) || 15,
      duracionMin: item.duracion_min || 90,
      edadMinima: item.edad_minima || 'Todo público',
      sinopsis: item.sinopsis || '',
      reparto: item.reparto || '',
      imagen: item.imagen || '',
      visible: item.visible !== false,
    });
    setModalOpen(true);
    setError('');
    setMensaje('');
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const res = await fetch('/api/carteleras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar la cartelera');

      setMensaje(formData.id ? '¡Cartelera actualizada exitosamente!' : '¡Nueva cartelera agregada al repertorio!');
      setModalOpen(false);
      await cargarDatos();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const toggleVisibilidad = async (item: CarteleraItem) => {
    try {
      const nuevoEstado = !item.visible;
      const res = await fetch('/api/carteleras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          obra: item.obra,
          funcion: item.funcion,
          genero: item.genero,
          sala: item.sala,
          director: item.director,
          fecha: item.fecha,
          hora: item.hora,
          precioUSD: item.precio_usd,
          sinopsis: item.sinopsis,
          reparto: item.reparto,
          imagen: item.imagen,
          duracionMin: item.duracion_min,
          edadMinima: item.edad_minima,
          visible: nuevoEstado,
        }),
      });

      if (res.ok) {
        setCarteleras((prev) =>
          prev.map((c) => (c.id === item.id ? { ...c, visible: nuevoEstado } : c))
        );
        setMensaje(`La cartelera "${item.obra}" ahora está ${nuevoEstado ? 'Visible' : 'Oculta'}.`);
      }
    } catch (err: any) {
      setError('Error al actualizar visibilidad: ' + err.message);
    }
  };

  const handleEliminar = async (id: string, obra: string) => {
    if (!confirm(`¿Estás seguro de eliminar la cartelera "${obra}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/carteleras?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar cartelera');

      setMensaje(`Cartelera "${obra}" eliminada correctamente.`);
      setCarteleras((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Filtrados
  const cartelerasFiltradas = carteleras.filter((c) =>
    c.obra.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.genero && c.genero.toLowerCase().includes(busqueda.toLowerCase())) ||
    (c.sala && c.sala.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const ticketsFiltrados = tickets.filter((t) =>
    (t.ticket_id && t.ticket_id.toLowerCase().includes(busqueda.toLowerCase())) ||
    (t.obra && t.obra.toLowerCase().includes(busqueda.toLowerCase())) ||
    (t.nombre_cliente && t.nombre_cliente.toLowerCase().includes(busqueda.toLowerCase())) ||
    (t.ref_pago && t.ref_pago.toLowerCase().includes(busqueda.toLowerCase()))
  );

  // Cálculos de métricas
  const totalRecaudadoUSD = tickets.reduce((acc, t) => acc + (Number(t.precio_usd) || 0), 0);
  const totalRecaudadoVES = tickets.reduce((acc, t) => acc + (Number(t.precio_ves) || 0), 0);
  const cartelerasActivas = carteleras.filter((c) => c.visible).length;

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Mensajes globales */}
      {mensaje && (
        <div style={{
          background: 'rgba(52, 168, 83, 0.15)',
          border: '1px solid rgba(52, 168, 83, 0.4)',
          color: '#7ccc8e',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--border-radius)',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>✅ {mensaje}</span>
          <button onClick={() => setMensaje('')} style={{ background: 'none', border: 'none', color: '#7ccc8e', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(139, 26, 46, 0.2)',
          border: '1px solid rgba(139, 26, 46, 0.5)',
          color: '#ff8099',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--border-radius)',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#ff8099', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Tarjetas de Resumen KPI */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem' }}>🎭 Obras en Cartelera</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-primario)', marginTop: '0.25rem' }}>
            {carteleras.length} <span style={{ fontSize: '0.9rem', color: 'var(--color-texto-muted)' }}>({cartelerasActivas} activas)</span>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem' }}>🎟️ Tickets Emitidos</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#4ade80', marginTop: '0.25rem' }}>
            {tickets.length}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem' }}>💵 Recaudación (USD)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-primario)', marginTop: '0.25rem' }}>
            ${totalRecaudadoUSD.toFixed(2)}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem' }}>🇻🇪 Recaudación (VES)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-acento)', marginTop: '0.25rem' }}>
            Bs. {totalRecaudadoVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Navegación de pestañas */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        borderBottom: '1px solid var(--color-borde)',
        paddingBottom: '0.75rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => { setTab('carteleras'); setBusqueda(''); }}
            className={`btn ${tab === 'carteleras' ? 'btn-primario' : 'btn-secundario'}`}
            style={{ fontSize: '0.9rem' }}
          >
            🎭 Carteleras ({carteleras.length})
          </button>
          <button
            onClick={() => { setTab('tickets'); setBusqueda(''); }}
            className={`btn ${tab === 'tickets' ? 'btn-primario' : 'btn-secundario'}`}
            style={{ fontSize: '0.9rem' }}
          >
            🎟️ Ventas y Boletos ({tickets.length})
          </button>
          <button
            onClick={() => setTab('metricas')}
            className={`btn ${tab === 'metricas' ? 'btn-primario' : 'btn-secundario'}`}
            style={{ fontSize: '0.9rem' }}
          >
            📊 Resumen y Auditoría
          </button>
        </div>

        {tab === 'carteleras' && (
          <button
            onClick={abrirCrear}
            className="btn btn-primario"
            style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>➕</span> Agregar Nueva Cartelera
          </button>
        )}
      </div>

      {/* Barra de búsqueda */}
      {tab !== 'metricas' && (
        <div style={{ marginBottom: '1.5rem' }}>
          <input
            type="text"
            className="input"
            placeholder={tab === 'carteleras' ? 'Buscar cartelera por obra, género o sala...' : 'Buscar ticket por código, cliente, obra o referencia de pago...'}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ maxWidth: 450 }}
          />
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ color: 'var(--color-texto-suave)', marginTop: '1rem' }}>Cargando información administrativa...</p>
        </div>
      )}

      {/* PESTAÑA 1: GESTIÓN DE CARTELERAS */}
      {!loading && tab === 'carteleras' && (
        <div>
          {cartelerasFiltradas.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--color-texto-suave)', marginBottom: '1rem' }}>No se encontraron carteleras.</p>
              <button onClick={abrirCrear} className="btn btn-primario">Crear la primera cartelera</button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 700 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-borde)', color: 'var(--color-primario)' }}>
                    <th style={{ padding: '0.75rem' }}>Obra</th>
                    <th style={{ padding: '0.75rem' }}>Género / Sala</th>
                    <th style={{ padding: '0.75rem' }}>Fecha y Hora</th>
                    <th style={{ padding: '0.75rem' }}>Precio</th>
                    <th style={{ padding: '0.75rem' }}>Visibilidad</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cartelerasFiltradas.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {item.imagen ? (
                            <img
                              src={item.imagen}
                              alt={item.obra}
                              style={{ width: 44, height: 44, borderRadius: 4, objectFit: 'cover' }}
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 4, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎭</div>
                          )}
                          <div>
                            <strong style={{ color: 'var(--color-texto)', display: 'block' }}>{item.obra}</strong>
                            <small style={{ color: 'var(--color-texto-muted)' }}>{item.funcion}</small>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div><span className="badge badge-usuario" style={{ fontSize: '0.75rem' }}>{item.genero || 'Teatro'}</span></div>
                        <small style={{ color: 'var(--color-texto-suave)' }}>{item.sala || 'Sala Principal'}</small>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div>📅 {item.fecha ? String(item.fecha).split('T')[0] : 'Por definir'}</div>
                        <small style={{ color: 'var(--color-texto-muted)' }}>⏰ {item.hora ? item.hora.slice(0, 5) : ''}</small>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <strong style={{ color: 'var(--color-primario)' }}>${item.precio_usd}</strong>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <button
                          onClick={() => toggleVisibilidad(item)}
                          style={{
                            background: item.visible ? 'rgba(52, 168, 83, 0.2)' : 'rgba(139, 26, 46, 0.2)',
                            color: item.visible ? '#7ccc8e' : '#ff8099',
                            border: `1px solid ${item.visible ? 'rgba(52, 168, 83, 0.4)' : 'rgba(139, 26, 46, 0.4)'}`,
                            padding: '0.25rem 0.6rem',
                            borderRadius: '12px',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                          title="Haz clic para alternar visibilidad"
                        >
                          {item.visible ? '● Visible al público' : '○ Oculta'}
                        </button>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => abrirEditar(item)}
                            className="btn btn-secundario"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                            title="Editar cartelera"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => handleEliminar(item.id, item.obra)}
                            className="btn"
                            style={{
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.8rem',
                              background: 'rgba(139, 26, 46, 0.3)',
                              color: '#ff8099',
                              border: '1px solid rgba(139, 26, 46, 0.5)'
                            }}
                            title="Eliminar cartelera"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 2: VENTAS Y BOLETOS */}
      {!loading && tab === 'tickets' && (
        <div>
          {ticketsFiltrados.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--color-texto-suave)' }}>No se encontraron boletos registrados con ese criterio.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 850 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-borde)', color: 'var(--color-primario)' }}>
                    <th style={{ padding: '0.75rem' }}>Código / Fecha</th>
                    <th style={{ padding: '0.75rem' }}>Cliente</th>
                    <th style={{ padding: '0.75rem' }}>Obra & Función</th>
                    <th style={{ padding: '0.75rem' }}>Asiento</th>
                    <th style={{ padding: '0.75rem' }}>Pago (USD / VES)</th>
                    <th style={{ padding: '0.75rem' }}>Ref. Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketsFiltrados.map((t) => (
                    <tr key={t.id || t.ticket_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <strong style={{ color: 'var(--color-acento)', fontFamily: 'monospace' }}>{t.ticket_id}</strong>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-texto-muted)' }}>
                          {t.fecha_emision || 'Registrado'}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div>{t.nombre_cliente}</div>
                        <small style={{ color: 'var(--color-texto-muted)' }}>{t.email_cliente}</small>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <strong>{t.obra}</strong>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-texto-suave)' }}>
                          📅 {t.fecha_funcion ? String(t.fecha_funcion).split('T')[0] : ''} · {t.sala || 'Sala Teatral'}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className="badge badge-admin" style={{ fontSize: '0.85rem' }}>
                          🪑 {t.asiento}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ color: 'var(--color-primario)', fontWeight: 600 }}>${t.precio_usd}</div>
                        {t.precio_ves && (
                          <small style={{ color: 'var(--color-texto-muted)' }}>Bs. {Number(t.precio_ves).toFixed(2)}</small>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{
                          fontFamily: 'monospace',
                          background: 'rgba(255,255,255,0.07)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: 4,
                          fontSize: '0.85rem'
                        }}>
                          {t.ref_pago}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 3: RESUMEN Y AUDITORÍA */}
      {!loading && tab === 'metricas' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <div className="card">
            <h3 style={{ color: 'var(--color-primario)', marginBottom: '1rem' }}>📈 Resumen de Operaciones</h3>
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.75rem' }}>
              <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-borde)', paddingBottom: '0.5rem' }}>
                <span className="texto-suave">Total de Obras Registradas:</span>
                <strong>{carteleras.length}</strong>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-borde)', paddingBottom: '0.5rem' }}>
                <span className="texto-suave">Obras Activas en Vivo:</span>
                <strong style={{ color: '#4ade80' }}>{cartelerasActivas}</strong>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-borde)', paddingBottom: '0.5rem' }}>
                <span className="texto-suave">Obras en Borrador / Ocultas:</span>
                <strong style={{ color: '#ff8099' }}>{carteleras.length - cartelerasActivas}</strong>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-borde)', paddingBottom: '0.5rem' }}>
                <span className="texto-suave">Total Boletos Vendidos:</span>
                <strong style={{ color: 'var(--color-primario)' }}>{tickets.length}</strong>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem' }}>
                <span className="texto-suave">Ingresos Totales (Divisas):</span>
                <strong style={{ color: 'var(--color-primario)', fontSize: '1.1rem' }}>${totalRecaudadoUSD.toFixed(2)}</strong>
              </li>
            </ul>
          </div>

          <div className="card">
            <h3 style={{ color: 'var(--color-primario)', marginBottom: '1rem' }}>🛡️ Permisos y Datos del Administrador</h3>
            <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div>
                <span className="texto-suave">Administrador Activo:</span>
                <p style={{ marginTop: '0.2rem', fontWeight: 600 }}>{user.nombre} ({user.email})</p>
              </div>
              <div>
                <span className="texto-suave">Rol del Sistema:</span>
                <p style={{ marginTop: '0.2rem' }}><span className="badge badge-admin">{user.rol}</span></p>
              </div>
              <div>
                <span className="texto-suave">Acceso de Seguridad:</span>
                <p style={{ color: '#7ccc8e', marginTop: '0.2rem' }}>✓ Gestión total de cartelera, auditoría de pagos venezolanos y revisión de butacas.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA CREAR / EDITAR CARTELERA */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={formData.id ? '✏️ Modificar Cartelera' : '➕ Agregar Nueva Cartelera'}
        size="lg"
      >
        <form onSubmit={handleGuardar} style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', display: 'block', marginBottom: '0.25rem' }}>
                Título de la Obra *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Romeo y Julieta"
                className="input"
                value={formData.obra}
                onChange={(e) => setFormData({ ...formData, obra: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', display: 'block', marginBottom: '0.25rem' }}>
                Función / Temporada *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Función de Gala, Temporada 2026"
                className="input"
                value={formData.funcion}
                onChange={(e) => setFormData({ ...formData, funcion: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', display: 'block', marginBottom: '0.25rem' }}>
                Género
              </label>
              <select
                className="input"
                value={formData.genero}
                onChange={(e) => setFormData({ ...formData, genero: e.target.value })}
              >
                <option value="Drama">Drama</option>
                <option value="Comedia">Comedia</option>
                <option value="Musical">Musical</option>
                <option value="Tragedia">Tragedia</option>
                <option value="Infantil">Infantil</option>
                <option value="Clásico">Clásico</option>
                <option value="Monólogo">Monólogo</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', display: 'block', marginBottom: '0.25rem' }}>
                Sala
              </label>
              <input
                type="text"
                placeholder="Ej: Sala Ríos Reyna"
                className="input"
                value={formData.sala}
                onChange={(e) => setFormData({ ...formData, sala: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', display: 'block', marginBottom: '0.25rem' }}>
                Director
              </label>
              <input
                type="text"
                placeholder="Nombre del director"
                className="input"
                value={formData.director}
                onChange={(e) => setFormData({ ...formData, director: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', display: 'block', marginBottom: '0.25rem' }}>
                Fecha *
              </label>
              <input
                type="date"
                required
                className="input"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', display: 'block', marginBottom: '0.25rem' }}>
                Hora *
              </label>
              <input
                type="time"
                required
                className="input"
                value={formData.hora}
                onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', display: 'block', marginBottom: '0.25rem' }}>
                Precio Entrada ($ USD) *
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                required
                className="input"
                value={formData.precioUSD}
                onChange={(e) => setFormData({ ...formData, precioUSD: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', display: 'block', marginBottom: '0.25rem' }}>
                Duración (min)
              </label>
              <input
                type="number"
                min="10"
                className="input"
                value={formData.duracionMin}
                onChange={(e) => setFormData({ ...formData, duracionMin: parseInt(e.target.value, 10) || 90 })}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', display: 'block', marginBottom: '0.25rem' }}>
                Clasificación
              </label>
              <select
                className="input"
                value={formData.edadMinima}
                onChange={(e) => setFormData({ ...formData, edadMinima: e.target.value })}
              >
                <option value="Todo público">Todo público</option>
                <option value="+12">+12 años</option>
                <option value="+16">+16 años</option>
                <option value="+18">+18 años</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', display: 'block', marginBottom: '0.25rem' }}>
              URL de la Imagen de Cartelera
            </label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/..."
              className="input"
              value={formData.imagen}
              onChange={(e) => setFormData({ ...formData, imagen: e.target.value })}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', display: 'block', marginBottom: '0.25rem' }}>
              Sinopsis de la Obra
            </label>
            <textarea
              rows={3}
              placeholder="Descripción del argumento dramático..."
              className="input"
              style={{ width: '100%', resize: 'vertical' }}
              value={formData.sinopsis}
              onChange={(e) => setFormData({ ...formData, sinopsis: e.target.value })}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', display: 'block', marginBottom: '0.25rem' }}>
              Reparto / Elenco
            </label>
            <input
              type="text"
              placeholder="Ej: Actor 1, Actriz 2, Actor 3"
              className="input"
              value={formData.reparto}
              onChange={(e) => setFormData({ ...formData, reparto: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
            <input
              type="checkbox"
              id="visibleCheck"
              checked={formData.visible}
              onChange={(e) => setFormData({ ...formData, visible: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: 'var(--color-primario)', cursor: 'pointer' }}
            />
            <label htmlFor="visibleCheck" style={{ cursor: 'pointer', fontSize: '0.9rem', color: 'var(--color-texto)' }}>
              Publicar inmediatamente como <strong>Visible</strong> en la cartelera general
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setModalOpen(false)}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primario"
              disabled={guardando}
            >
              {guardando ? 'Guardando...' : formData.id ? 'Guardar Cambios' : 'Crear Cartelera'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
