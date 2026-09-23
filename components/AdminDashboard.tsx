'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/Modal';
import { useCurrency } from '@/hooks/useCurrency';
import { TheaterStatistics } from '@/components/TheaterStatistics';
import { SubscriptionModal } from '@/components/SubscriptionModal';

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
  grupo_teatral?: string;
  id_usuario_grupo?: string;
  butacas_disponibles?: number;
  aforo_total?: number;
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
  grupo_teatral?: string;
}

export function AdminDashboard({ user }: { user: { id?: string; nombre: string; email: string; rol: string } }) {
  const isGrupoTH = user.rol === 'Grupo th';
  const isAdmin = user.rol === 'Admin';

  const [tab, setTab] = useState<'carteleras' | 'tickets' | 'metricas' | 'semanas_historicas' | 'grupo_stats'>('carteleras');
  const [carteleras, setCarteleras] = useState<CarteleraItem[]>([]);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Estadísticas del Grupo TH
  const [metricasGrupo, setMetricasGrupo] = useState<any>(null);

  // Modal formulario
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSuscripcionOpen, setModalSuscripcionOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Modo de imagen: 'archivo' o 'url'
  const [modoImagen, setModoImagen] = useState<'archivo' | 'url'>('archivo');

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
    grupo_teatral: isGrupoTH ? user.nombre : 'Compañía Teatral Residente',
    butacas_disponibles: 80,
    aforo_total: 80,
  };

  const [formData, setFormData] = useState(FORM_INITIAL);

  const { formatUSD, formatVES } = useCurrency();

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // Cargar todas las carteleras
      const resCart = await fetch('/api/carteleras?admin=true');
      if (resCart.ok) {
        const dataCart = await resCart.json();
        // Si es Grupo th, filtrar inicialmente sus carteleras o ver todas con filtro
        setCarteleras(dataCart);
      }

      // Cargar tickets de todas las ventas
      const resTick = await fetch('/api/tickets');
      if (resTick.ok) {
        const dataTick = await resTick.json();
        setTickets(Array.isArray(dataTick) ? dataTick : []);
      }

      // Cargar métricas por grupo (géneros, críticas, compras)
      const resEst = await fetch(`/api/estadisticas?grupo=${encodeURIComponent(isGrupoTH ? user.nombre : '')}`);
      if (resEst.ok) {
        const dataEst = await resEst.json();
        setMetricasGrupo(dataEst.metricasGrupo);
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
      grupo_teatral: item.grupo_teatral || (isGrupoTH ? user.nombre : 'Compañía Teatral Residente'),
      butacas_disponibles: item.butacas_disponibles !== undefined ? item.butacas_disponibles : 80,
      aforo_total: item.aforo_total !== undefined ? item.aforo_total : 80,
    });
    setModalOpen(true);
    setError('');
    setMensaje('');
  };

  // Subida directa de imagen desde archivo
  const handleSubirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no debe exceder los 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setFormData((prev) => ({ ...prev, imagen: dataUrl }));
      setError('');
    };
    reader.readAsDataURL(file);
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

      setMensaje(
        formData.id
          ? '¡Cartelera actualizada exitosamente!'
          : `¡Nueva cartelera agregada por el grupo ${data.grupo_teatral || formData.grupo_teatral}!`
      );
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
          ...item,
          precioUSD: item.precio_usd,
          visible: nuevoEstado,
        }),
      });

      if (res.ok) {
        setCarteleras((prev) =>
          prev.map((c) => (c.id === item.id ? { ...c, visible: nuevoEstado } : c))
        );
        setMensaje(`La obra "${item.obra}" ahora está ${nuevoEstado ? 'Visible' : 'Oculta'}.`);
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

  // Filtrado de carteleras según rol y búsqueda
  const cartelerasVisibles = carteleras.filter((c) => {
    if (isGrupoTH) {
      // El grupo th puede ver sus obras o identificar todas
      return (
        c.grupo_teatral?.toLowerCase() === user.nombre.toLowerCase() ||
        c.obra.toLowerCase().includes(busqueda.toLowerCase())
      );
    }
    return (
      c.obra.toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.genero && c.genero.toLowerCase().includes(busqueda.toLowerCase())) ||
      (c.grupo_teatral && c.grupo_teatral.toLowerCase().includes(busqueda.toLowerCase())) ||
      (c.sala && c.sala.toLowerCase().includes(busqueda.toLowerCase()))
    );
  });

  const cartelerasFiltradas = cartelerasVisibles.filter((c) =>
    c.obra.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.genero && c.genero.toLowerCase().includes(busqueda.toLowerCase())) ||
    (c.grupo_teatral && c.grupo_teatral.toLowerCase().includes(busqueda.toLowerCase()))
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
        <div
          style={{
            background: 'rgba(52, 168, 83, 0.15)',
            border: '1px solid rgba(52, 168, 83, 0.4)',
            color: '#7ccc8e',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--border-radius)',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>✅ {mensaje}</span>
          <button onClick={() => setMensaje('')} style={{ background: 'none', border: 'none', color: '#7ccc8e', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {error && (
        <div
          style={{
            background: 'rgba(139, 26, 46, 0.2)',
            border: '1px solid rgba(139, 26, 46, 0.5)',
            color: '#ff8099',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--border-radius)',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#ff8099', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Tarjetas de Resumen KPI */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem' }}>🎭 Obras en Repertorio</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-primario)', marginTop: '0.25rem' }}>
            {carteleras.length} <span style={{ fontSize: '0.9rem', color: 'var(--color-texto-muted)' }}>({cartelerasActivas} en vivo)</span>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem' }}>🎟️ Boletos Vendidos</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#4ade80', marginTop: '0.25rem' }}>
            {tickets.length}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem' }}>💵 Total Ingresos (USD)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-primario)', marginTop: '0.25rem' }}>
            ${totalRecaudadoUSD.toFixed(2)}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem' }}>🇻🇪 Recaudación en Bolívares</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-acento)', marginTop: '0.25rem' }}>
            Bs. {totalRecaudadoVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Navegación de pestañas */}
      <div
        style={{
          display: 'flex',
          gap: '0.6rem',
          borderBottom: '1px solid var(--color-borde)',
          paddingBottom: '0.75rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setTab('carteleras'); setBusqueda(''); }}
            className={`btn ${tab === 'carteleras' ? 'btn-primario' : 'btn-secundario'}`}
            style={{ fontSize: '0.88rem' }}
          >
            🎭 Carteleras ({carteleras.length})
          </button>

          <button
            onClick={() => { setTab('tickets'); setBusqueda(''); }}
            className={`btn ${tab === 'tickets' ? 'btn-primario' : 'btn-secundario'}`}
            style={{ fontSize: '0.88rem' }}
          >
            🎟️ Ventas y Boletos ({tickets.length})
          </button>

          {/* Pestaña de Estadísticas de Grupo TH */}
          <button
            onClick={() => setTab('grupo_stats')}
            className={`btn ${tab === 'grupo_stats' ? 'btn-primario' : 'btn-secundario'}`}
            style={{ fontSize: '0.88rem' }}
          >
            📈 Estadísticas {isGrupoTH ? 'de mi Grupo TH' : 'por Género & Críticas'}
          </button>

          {/* Pestaña de Microteatral y Semanas Pasadas (basada en la imagen de referencia) */}
          <button
            onClick={() => setTab('semanas_historicas')}
            className={`btn ${tab === 'semanas_historicas' ? 'btn-primario' : 'btn-secundario'}`}
            style={{ fontSize: '0.88rem', border: '1px solid #d4af37' }}
          >
            🏛️ Microteatral & Semanas Pasadas
          </button>

          {isAdmin && (
            <button
              onClick={() => setTab('metricas')}
              className={`btn ${tab === 'metricas' ? 'btn-primario' : 'btn-secundario'}`}
              style={{ fontSize: '0.88rem' }}
            >
              🛡️ Auditoría del Teatro
            </button>
          )}
        </div>

        {tab === 'carteleras' && (
          <button
            onClick={abrirCrear}
            className="btn btn-primario"
            style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>➕</span> Agregar Cartelera {isGrupoTH ? `(${user.nombre})` : ''}
          </button>
        )}
      </div>

      {/* Barra de búsqueda */}
      {tab === 'carteleras' || tab === 'tickets' ? (
        <div style={{ marginBottom: '1.5rem' }}>
          <input
            type="text"
            className="input"
            placeholder={
              tab === 'carteleras'
                ? 'Buscar obra por título, género o grupo teatral...'
                : 'Buscar ticket por código, cliente, obra o referencia bancaria...'
            }
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ maxWidth: 450 }}
          />
        </div>
      ) : null}

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ color: 'var(--color-texto-suave)', marginTop: '1rem' }}>Cargando datos teatrales...</p>
        </div>
      )}

      {/* ─── PESTAÑA 1: GESTIÓN DE CARTELERAS ─── */}
      {!loading && tab === 'carteleras' && (
        <div>
          {cartelerasFiltradas.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--color-texto-suave)', marginBottom: '1rem' }}>
                No se encontraron carteleras para los filtros seleccionados.
              </p>
              <button onClick={abrirCrear} className="btn btn-primario">
                Crear una nueva cartelera
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 800 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-borde)', color: 'var(--color-primario)' }}>
                    <th style={{ padding: '0.75rem' }}>Obra / Afiche</th>
                    <th style={{ padding: '0.75rem' }}>Grupo TH Creador</th>
                    <th style={{ padding: '0.75rem' }}>Género & Sala</th>
                    <th style={{ padding: '0.75rem' }}>Fecha & Hora</th>
                    <th style={{ padding: '0.75rem' }}>Butacas Disp.</th>
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

                      {/* Identificador de Grupo TH */}
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            background: 'rgba(212, 175, 55, 0.12)',
                            color: '#d4af37',
                            border: '1px solid rgba(212, 175, 55, 0.3)',
                            padding: '0.25rem 0.55rem',
                            borderRadius: '12px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            display: 'inline-block',
                          }}
                        >
                          🎭 {item.grupo_teatral || 'Compañía Residente'}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem' }}>
                        <div><span className="badge badge-usuario" style={{ fontSize: '0.75rem' }}>{item.genero || 'Teatro'}</span></div>
                        <small style={{ color: 'var(--color-texto-suave)' }}>{item.sala || 'Sala Principal'}</small>
                      </td>

                      <td style={{ padding: '0.75rem' }}>
                        <div>📅 {item.fecha ? String(item.fecha).split('T')[0] : 'Por definir'}</div>
                        <small style={{ color: 'var(--color-texto-muted)' }}>⏰ {item.hora ? item.hora.slice(0, 5) : ''}</small>
                      </td>

                      {/* Label de Butacas disponibles */}
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            color: (item.butacas_disponibles || 0) > 10 ? '#22c55e' : '#f97316',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                          }}
                        >
                          🪑 {item.butacas_disponibles ?? 80} / {item.aforo_total ?? 80} disp.
                        </span>
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
                            fontWeight: 600,
                          }}
                          title="Alternar visibilidad"
                        >
                          {item.visible ? '● Visible' : '○ Oculta'}
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
                              border: '1px solid rgba(139, 26, 46, 0.5)',
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

      {/* ─── PESTAÑA 2: VENTAS Y BOLETOS ─── */}
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
                        <span
                          style={{
                            fontFamily: 'monospace',
                            background: 'rgba(255,255,255,0.07)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: 4,
                            fontSize: '0.85rem',
                          }}
                        >
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

      {/* ─── PESTAÑA 3: ESTADÍSTICAS DEL GRUPO TH (Por Género, Críticas y Compras) ─── */}
      {!loading && tab === 'grupo_stats' && (
        <div style={{ display: 'grid', gap: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontFamily: 'Playfair Display, serif', color: 'var(--color-primario)', margin: 0 }}>
                📈 Estadísticas de Ventas y Críticas — {isGrupoTH ? user.nombre : 'Todos los Grupos TH'}
              </h2>
              <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Rendimiento de obras, ingresos por género teatral y calificaciones de la crítica especializada.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {/* Ventas por Género */}
            <div className="card">
              <h3 style={{ color: 'var(--color-primario)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🎭 Ventas por Género Teatral
              </h3>
              {metricasGrupo?.ventasPorGenero && metricasGrupo.ventasPorGenero.length > 0 ? (
                <div style={{ display: 'grid', gap: '0.85rem' }}>
                  {metricasGrupo.ventasPorGenero.map((g: any) => (
                    <div key={g.genero} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{g.genero}</strong>
                        <span style={{ color: 'var(--color-primario)', fontWeight: 700 }}>
                          ${Number(g.total_usd).toFixed(2)} USD
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-texto-muted)', marginTop: '0.2rem' }}>
                        <span>{g.total_boletos} entradas vendidas</span>
                        <span>Bs. {Number(g.total_ves).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--color-texto-muted)', fontSize: '0.88rem' }}>No hay ventas registradas por género aún.</p>
              )}
            </div>

            {/* Puntuación y Críticas de los Críticos */}
            <div className="card">
              <h3 style={{ color: 'var(--color-primario)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ⭐ Valoración de Críticos por Obra
              </h3>
              {metricasGrupo?.criticasPorObra && metricasGrupo.criticasPorObra.length > 0 ? (
                <div style={{ display: 'grid', gap: '0.85rem' }}>
                  {metricasGrupo.criticasPorObra.map((c: any) => (
                    <div key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{c.obra}</strong>
                        <span style={{ color: '#d4af37', fontWeight: 700 }}>
                          ★ {Number(c.promedio_estrellas).toFixed(1)} / 5.0
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-texto-muted)', marginTop: '0.2rem' }}>
                        <span>Grupo: {c.grupo_teatral || 'Residente'}</span>
                        <span>{c.total_criticas} reseñas de críticos</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--color-texto-muted)', fontSize: '0.88rem' }}>Aún no hay críticas publicadas para tus obras.</p>
              )}
            </div>
          </div>

          {/* Compras Detalladas para el Grupo TH */}
          <div className="card">
            <h3 style={{ color: 'var(--color-primario)', marginBottom: '1rem' }}>
              🎟️ Compras Recientes de Funciones
            </h3>
            {metricasGrupo?.comprasDetalladas && metricasGrupo.comprasDetalladas.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-borde)', color: 'var(--color-primario)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '0.5rem' }}>Ticket</th>
                      <th style={{ padding: '0.5rem' }}>Obra</th>
                      <th style={{ padding: '0.5rem' }}>Butaca</th>
                      <th style={{ padding: '0.5rem' }}>Fecha Función</th>
                      <th style={{ padding: '0.5rem' }}>Monto</th>
                      <th style={{ padding: '0.5rem' }}>Cliente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricasGrupo.comprasDetalladas.slice(0, 15).map((compra: any) => (
                      <tr key={compra.ticket_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                        <td style={{ padding: '0.5rem', fontFamily: 'monospace', color: 'var(--color-acento)' }}>{compra.ticket_id}</td>
                        <td style={{ padding: '0.5rem' }}><strong>{compra.obra}</strong></td>
                        <td style={{ padding: '0.5rem' }}>🪑 {compra.asiento}</td>
                        <td style={{ padding: '0.5rem' }}>{compra.fecha_funcion ? String(compra.fecha_funcion).split('T')[0] : ''}</td>
                        <td style={{ padding: '0.5rem', color: '#22c55e', fontWeight: 600 }}>${compra.precio_usd}</td>
                        <td style={{ padding: '0.5rem' }}>{compra.nombre_cliente}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--color-texto-muted)', fontSize: '0.88rem' }}>No hay compras registradas todavía.</p>
            )}
          </div>
        </div>
      )}

      {/* ─── PESTAÑA 4: MICROTEATRAL CARACAS & SEMANAS PASADAS ─── */}
      {!loading && tab === 'semanas_historicas' && (
        <TheaterStatistics
          isAdmin={isAdmin}
          onAbrirSuscripciones={() => setModalSuscripcionOpen(true)}
        />
      )}

      {/* ─── PESTAÑA 5: RESUMEN Y AUDITORÍA ADMIN ─── */}
      {!loading && tab === 'metricas' && isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <div className="card">
            <h3 style={{ color: 'var(--color-primario)', marginBottom: '1rem' }}>📈 Resumen del Teatro</h3>
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
            <h3 style={{ color: 'var(--color-primario)', marginBottom: '1rem' }}>🛡️ Datos del Operador</h3>
            <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div>
                <span className="texto-suave">Usuario Activo:</span>
                <p style={{ marginTop: '0.2rem', fontWeight: 600 }}>{user.nombre} ({user.email})</p>
              </div>
              <div>
                <span className="texto-suave">Rol del Sistema:</span>
                <p style={{ marginTop: '0.2rem' }}><span className="badge badge-admin">{user.rol}</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL PARA CREAR / EDITAR CARTELERA (Con Subida Directa de Imágenes y Butacas) ─── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={formData.id ? '✏️ Modificar Cartelera' : `➕ Agregar Cartelera ${isGrupoTH ? `• ${user.nombre}` : ''}`}
        size="lg"
      >
        <form onSubmit={handleGuardar} style={{ display: 'grid', gap: '1rem' }}>
          {/* Identificador del Grupo Teatral creador */}
          <div
            style={{
              background: 'rgba(212, 175, 55, 0.08)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: '8px',
              padding: '0.85rem',
            }}
          >
            <label style={{ fontSize: '0.82rem', color: '#d4af37', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
              🎭 Nombre del Grupo Teatral Creador (Grupo TH) *
            </label>
            <input
              type="text"
              required
              className="input"
              value={formData.grupo_teatral}
              onChange={(e) => setFormData({ ...formData, grupo_teatral: e.target.value })}
              placeholder="Ej: Grupo Teatral Rajatabla, Compañía Skena..."
              readOnly={isGrupoTH} // Si es Grupo th, se fija a su nombre
            />
            <small style={{ color: 'var(--color-texto-muted)', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>
              {isGrupoTH
                ? 'Las obras creadas quedarán vinculadas a tu Grupo TH para auditoría y estadísticas.'
                : 'Identificador del grupo teatral responsable de la puesta en escena.'}
            </small>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', display: 'block', marginBottom: '0.25rem' }}>
                Título de la Obra *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: La Cantante Calva"
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
                placeholder="Ej: Estreno, Temporada 2026"
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
                <option value="Comedia">Comedia</option>
                <option value="Drama">Drama</option>
                <option value="Musical">Musical</option>
                <option value="Tragedia">Tragedia</option>
                <option value="Infantil">Infantil</option>
                <option value="Terror / Erótico">Terror / Erótico</option>
                <option value="Monólogo">Monólogo</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', display: 'block', marginBottom: '0.25rem' }}>
                Sala
              </label>
              <input
                type="text"
                placeholder="Ej: Sala 7, Sala Ríos Reyna"
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

          {/* Fecha, Hora, Precio y Label de Butacas Disponibles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
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
                Precio ($ USD) *
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

            {/* Label e Input para Número de Butacas Disponibles */}
            <div>
              <label style={{ fontSize: '0.85rem', color: '#22c55e', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
                🪑 Butacas Disponibles *
              </label>
              <input
                type="number"
                min="0"
                max="5000"
                required
                className="input"
                value={formData.butacas_disponibles}
                onChange={(e) =>
                  setFormData({ ...formData, butacas_disponibles: parseInt(e.target.value, 10) || 0 })
                }
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', display: 'block', marginBottom: '0.25rem' }}>
                Aforo Total
              </label>
              <input
                type="number"
                min="1"
                className="input"
                value={formData.aforo_total}
                onChange={(e) =>
                  setFormData({ ...formData, aforo_total: parseInt(e.target.value, 10) || 80 })
                }
              />
            </div>
          </div>

          {/* ─── SUBIDA DIRECTA DE IMÁGENES / AFICHE ─── */}
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px dashed var(--color-borde)',
              borderRadius: '8px',
              padding: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', fontWeight: 600 }}>
                🖼️ Imagen de Afiche de la Obra
              </label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setModoImagen('archivo')}
                  style={{
                    background: modoImagen === 'archivo' ? 'var(--color-primario)' : 'transparent',
                    color: modoImagen === 'archivo' ? '#0d0507' : 'var(--color-texto-suave)',
                    border: '1px solid var(--color-borde)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: 4,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  📁 Subir Archivo Local
                </button>
                <button
                  type="button"
                  onClick={() => setModoImagen('url')}
                  style={{
                    background: modoImagen === 'url' ? 'var(--color-primario)' : 'transparent',
                    color: modoImagen === 'url' ? '#0d0507' : 'var(--color-texto-suave)',
                    border: '1px solid var(--color-borde)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: 4,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  🔗 Enlace URL
                </button>
              </div>
            </div>

            {modoImagen === 'archivo' ? (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSubirArchivo}
                  style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-texto-suave)', marginBottom: '0.5rem' }}
                />
                <small style={{ color: 'var(--color-texto-muted)', fontSize: '0.75rem' }}>
                  Sube directamente el afiche desde tu equipo (JPG, PNG, WEBP, máx 5MB).
                </small>
              </div>
            ) : (
              <div>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  className="input"
                  value={formData.imagen}
                  onChange={(e) => setFormData({ ...formData, imagen: e.target.value })}
                />
              </div>
            )}

            {/* Vista previa de la imagen cargada */}
            {formData.imagen && (
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img
                  src={formData.imagen}
                  alt="Vista previa"
                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--color-primario)' }}
                />
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#22c55e', display: 'block' }}>✓ Imagen cargada correctamente</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, imagen: '' })}
                    style={{ background: 'none', border: 'none', color: '#ff8099', cursor: 'pointer', fontSize: '0.75rem', padding: 0, marginTop: '0.25rem' }}
                  >
                    Eliminar imagen
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-primario)', display: 'block', marginBottom: '0.25rem' }}>
              Sinopsis de la Obra
            </label>
            <textarea
              rows={2}
              placeholder="Argumento de la obra..."
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
              placeholder="Ej: Actriz principal, Actor reparto..."
              className="input"
              value={formData.reparto}
              onChange={(e) => setFormData({ ...formData, reparto: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              type="checkbox"
              id="visibleCheck"
              checked={formData.visible}
              onChange={(e) => setFormData({ ...formData, visible: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: 'var(--color-primario)', cursor: 'pointer' }}
            />
            <label htmlFor="visibleCheck" style={{ cursor: 'pointer', fontSize: '0.88rem', color: 'var(--color-texto)' }}>
              Publicar inmediatamente como <strong>Visible</strong> en la cartelera general
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secundario" onClick={() => setModalOpen(false)} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primario" disabled={guardando}>
              {guardando ? 'Guardando...' : formData.id ? 'Guardar Cambios' : 'Publicar Cartelera'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Membresías & Planes VIP */}
      <SubscriptionModal
        isOpen={modalSuscripcionOpen}
        onClose={() => setModalSuscripcionOpen(false)}
      />
    </div>
  );
}
