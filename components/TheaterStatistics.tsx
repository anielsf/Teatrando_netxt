'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/Modal';

interface SemanaEstadistica {
  id?: number;
  semana_numero: number;
  titulo_evento: string;
  salas_activas: number;
  capacidad_semanal: number;
  entradas_semana: number;
  crecimiento_porcentaje: string;
  valoracion_critica: number;
  entradas_por_dia: Array<{ dia: string; promo: string; cantidad: number }>;
  top_salas: Array<{ sala: string; asistencia: number }>;
  generos_comparativa: {
    comedia_s1: number;
    drama_s1: number;
    otros_s1: number;
    comedia_s2: number;
    drama_s2: number;
    otros_s2: number;
  };
  nota_salas?: string;
  nota_generos?: string;
}

interface TheaterStatisticsProps {
  isAdmin?: boolean;
  onAbrirSuscripciones?: () => void;
}

// Parsea de forma segura campos que pueden llegar como string JSONB desde PostgreSQL
function parseCampoJSON<T>(valor: T | string | null | undefined, defecto: T): T {
  if (valor === null || valor === undefined) return defecto;
  if (typeof valor === 'string') {
    try { return JSON.parse(valor) as T; } catch { return defecto; }
  }
  return valor as T;
}

function normalizarSemana(s: SemanaEstadistica): SemanaEstadistica {
  const generos = parseCampoJSON(s.generos_comparativa, {
    comedia_s1: 0, drama_s1: 0, otros_s1: 0,
    comedia_s2: 0, drama_s2: 0, otros_s2: 0,
  });

  return {
    ...s,
    // node-postgres puede devolver columnas numeric como string.
    semana_numero: Number(s.semana_numero) || 0,
    salas_activas: Number(s.salas_activas) || 0,
    capacidad_semanal: Number(s.capacidad_semanal) || 0,
    entradas_semana: Number(s.entradas_semana) || 0,
    valoracion_critica: Number(s.valoracion_critica) || 0,
    entradas_por_dia: parseCampoJSON(s.entradas_por_dia, []).map((d: any) => ({
      dia: String(d?.dia ?? ''),
      promo: String(d?.promo ?? ''),
      cantidad: Number(d?.cantidad) || 0,
    })),
    top_salas: parseCampoJSON(s.top_salas, []).map((sala: any) => ({
      sala: String(sala?.sala ?? ''),
      asistencia: Number(sala?.asistencia) || 0,
    })),
    generos_comparativa: {
      comedia_s1: Number(generos.comedia_s1) || 0,
      drama_s1: Number(generos.drama_s1) || 0,
      otros_s1: Number(generos.otros_s1) || 0,
      comedia_s2: Number(generos.comedia_s2) || 0,
      drama_s2: Number(generos.drama_s2) || 0,
      otros_s2: Number(generos.otros_s2) || 0,
    },
  };
}

export function TheaterStatistics({ isAdmin = false, onAbrirSuscripciones }: TheaterStatisticsProps) {
  const [datos, setDatos] = useState<SemanaEstadistica | null>(null);
  const [semanas, setSemanas] = useState<SemanaEstadistica[]>([]);
  const [semanaSeleccionada, setSemanaSeleccionada] = useState<number>(2);
  const [modalFormOpen, setModalFormOpen] = useState(false);
  const [tooltipDia, setTooltipDia] = useState<{ dia: string; cantidad: number; promo: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Formulario para que el admin agregue/edite semanas pasadas
  const [formSemana, setFormSemana] = useState({
    semana_numero: 3,
    titulo_evento: 'Microteatral Caracas (Semana 3)',
    salas_activas: 22,
    capacidad_semanal: 14000,
    entradas_semana: 2850,
    crecimiento_porcentaje: '+5.28%',
    valoracion_critica: 4.95,
    nota_salas: 'Sala 7 continúa liderando con máxima ocupación.',
    nota_generos: 'Comedia representa el 65% de la taquilla total.',
    miercoles: 760,
    jueves: 480,
    viernes: 570,
    sabado: 510,
    domingo: 490,
  });

  const cargarEstadisticas = async () => {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/estadisticas');
      if (res.ok) {
        const json = await res.json();
        // Normalizar campos JSONB que pueden venir como string desde PostgreSQL
        const semanasNorm: SemanaEstadistica[] = Array.isArray(json.semanasHistoricas)
          ? json.semanasHistoricas.map(normalizarSemana)
          : [];
        setSemanas(semanasNorm);

        // La API puede devolver semanaActual o, si no existe, la primera semana histórica.
        const actual = json.semanaActual
          ? normalizarSemana(json.semanaActual)
          : semanasNorm[0] ?? null;

        setDatos(actual);

        if (actual?.semana_numero) {
          setSemanaSeleccionada(actual.semana_numero);
        }
      } else {
        const txt = await res.text();
        setErrorMsg(`Error del servidor: ${res.status} — ${txt.slice(0, 200)}`);
      }
    } catch (e: any) {
      console.error('Error cargando estadísticas:', e);
      setErrorMsg('No se pudo conectar al servidor de estadísticas. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cambiarSemana = (num: number) => {
    setSemanaSeleccionada(num);
    const encontrada = semanas.find((s) => s.semana_numero === num);
    if (encontrada) setDatos(encontrada);
  };

  const handleGuardarSemana = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        semana_numero: formSemana.semana_numero,
        titulo_evento: formSemana.titulo_evento,
        salas_activas: formSemana.salas_activas,
        capacidad_semanal: formSemana.capacidad_semanal,
        entradas_semana: formSemana.entradas_semana,
        crecimiento_porcentaje: formSemana.crecimiento_porcentaje,
        valoracion_critica: formSemana.valoracion_critica,
        entradas_por_dia: [
          { dia: 'Miér', promo: '3×1', cantidad: Number(formSemana.miercoles) },
          { dia: 'Jue', promo: '2×1', cantidad: Number(formSemana.jueves) },
          { dia: 'Vie', promo: '2×1', cantidad: Number(formSemana.viernes) },
          { dia: 'Sáb', promo: 'T.Plana', cantidad: Number(formSemana.sabado) },
          { dia: 'Dom', promo: '2×1', cantidad: Number(formSemana.domingo) },
        ],
        top_salas: [
          { sala: 'Sala 7', asistencia: 530 },
          { sala: 'Sala 19', asistencia: 440 },
          { sala: 'Sala 21', asistencia: 420 },
          { sala: 'Sala 6', asistencia: 400 },
          { sala: 'Sala 15', asistencia: 380 },
          { sala: 'Sala 9', asistencia: 320 },
        ],
        generos_comparativa: {
          comedia_s1: 2150,
          drama_s1: 380,
          otros_s1: 50,
          comedia_s2: Number(formSemana.entradas_semana) * 0.7,
          drama_s2: Number(formSemana.entradas_semana) * 0.22,
          otros_s2: Number(formSemana.entradas_semana) * 0.08,
        },
        nota_salas: formSemana.nota_salas,
        nota_generos: formSemana.nota_generos,
      };

      const res = await fetch('/api/estadisticas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setModalFormOpen(false);
        await cargarEstadisticas();
      }
    } catch (err) {
      console.error('Error guardando semana histórica:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="spinner" />
        <p style={{ color: 'rgba(245,230,200,0.7)', marginTop: '1rem' }}>
          Cargando estadísticas...
        </p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '3rem 1.5rem',
          border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: '12px',
          background: 'rgba(127,29,29,0.12)',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</div>
        <h3 style={{ color: '#fca5a5', marginBottom: '0.5rem' }}>
          No se pudieron cargar las estadísticas
        </h3>
        <p style={{ color: 'rgba(245,230,200,0.75)', marginBottom: '1rem' }}>
          {errorMsg}
        </p>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={cargarEstadisticas}
        >
          🔄 Reintentar
        </button>
      </div>
    );
  }

  if (!datos) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '3rem 1.5rem',
          border: '1px solid rgba(201,162,75,0.25)',
          borderRadius: '12px',
          background: '#160a0f',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🏛️</div>
        <h3 style={{ color: '#d4af37', marginBottom: '0.5rem' }}>
          No hay semanas registradas
        </h3>
        <p style={{ color: 'rgba(245,230,200,0.7)' }}>
          El administrador todavía no ha cargado datos históricos.
        </p>
      </div>
    );
  }

  // Máximo para escalar las barras de días
  const maxEntradasDia = 800;
  const maxTopSalas = 600;
  const maxGeneros = 2500;

  return (
    <div
      style={{
        background: '#0d0507',
        color: '#f5e6c8',
        padding: '2rem 1.5rem',
        borderRadius: '16px',
        border: '1px solid rgba(201, 162, 75, 0.25)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* ─── ENCABEZADO INSTITUCIONAL DE LA SEDE TEATRAL ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <span
            style={{
              background: '#d4af37',
              color: '#0d0507',
              padding: '0.2rem 0.6rem',
              borderRadius: '4px',
              fontWeight: 700,
              fontSize: '0.72rem',
              letterSpacing: '0.05em',
            }}
          >
            🏛️ Sede Teatral Oficial
          </span>
          <h1
            style={{
              fontFamily: 'Playfair Display, serif',
              color: '#d4af37',
              fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
              margin: '0.4rem 0 0.25rem',
              fontWeight: 700,
            }}
          >
            Teatro Municipal de Caracas
          </h1>
          <p style={{ color: 'rgba(245, 230, 200, 0.7)', fontSize: '0.85rem', margin: 0 }}>
            Av. Lecuna, Esquina de Reducto a Municipal, Centro de Caracas &nbsp;|&nbsp; 📞 +58 (212) 555-8328
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {isAdmin && (
            <button
              onClick={() => setModalFormOpen(true)}
              className="btn btn-secundario"
              style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem' }}
            >
              ➕ Cargar Datos de Semana
            </button>
          )}

          <button
            onClick={onAbrirSuscripciones}
            style={{
              background: 'transparent',
              color: '#d4af37',
              border: '1px solid #d4af37',
              padding: '0.55rem 1.1rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            ★ Ver Membresías & Planes VIP
          </button>
        </div>
      </div>

      {/* ─── 4 TARJETAS KPI SUPERIORES ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div style={{ background: '#160a0f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'rgba(245,230,200,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            SALAS ACTIVAS
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, color: '#f5e6c8', marginTop: '0.3rem' }}>
            {datos.salas_activas} <span style={{ fontSize: '1rem', fontWeight: 400, color: 'rgba(245,230,200,0.6)' }}>salas</span>
          </div>
        </div>

        <div style={{ background: '#160a0f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'rgba(245,230,200,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            CAPACIDAD SEMANAL
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, color: '#22c55e', marginTop: '0.3rem' }}>
            {datos.capacidad_semanal.toLocaleString('es-VE')} <span style={{ fontSize: '1rem', fontWeight: 400, color: 'rgba(245,230,200,0.6)' }}>esp.</span>
          </div>
        </div>

        <div style={{ background: '#160a0f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'rgba(245,230,200,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            ENTRADAS S{datos.semana_numero}
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, color: '#d4af37', marginTop: '0.3rem' }}>
            {datos.entradas_semana.toLocaleString('es-VE')}{' '}
            <span style={{ fontSize: '0.88rem', color: '#22c55e', fontWeight: 600 }}>{datos.crecimiento_porcentaje}</span>
          </div>
        </div>

        <div style={{ background: '#160a0f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'rgba(245,230,200,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            VALORACIÓN CRÍTICA
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, color: '#d4af37', marginTop: '0.3rem' }}>
            ★ {datos.valoracion_critica.toFixed(2)} <span style={{ fontSize: '1rem', fontWeight: 400, color: 'rgba(245,230,200,0.6)' }}>/ 5.0</span>
          </div>
        </div>
      </div>

      {/* ─── TÍTULO DE LA SECCIÓN DE ESTADÍSTICAS Y SELECTOR DE SEMANA ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#f5e6c8', fontSize: '1.35rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#d4af37' }}>📊</span> Estadísticas — {datos.titulo_evento}
        </h2>

        {/* Selector de semanas históricas */}
        {semanas.length > 1 && (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'rgba(245,230,200,0.6)' }}>Ver:</span>
            {semanas.map((s) => (
              <button
                key={s.semana_numero}
                onClick={() => cambiarSemana(s.semana_numero)}
                style={{
                  background: semanaSeleccionada === s.semana_numero ? '#d4af37' : '#1a0d13',
                  color: semanaSeleccionada === s.semana_numero ? '#0d0507' : '#f5e6c8',
                  border: '1px solid rgba(201,162,75,0.3)',
                  borderRadius: '4px',
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Semana {s.semana_numero}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── GRÁFICOS: FILA SUPERIOR (Entradas por Día + Top 6 Salas) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Gráfico 1: Entradas Vendidas por Día */}
        <div style={{ background: '#13080c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <span style={{ width: 10, height: 10, background: '#d4af37', borderRadius: '2px', display: 'inline-block' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: '#f5e6c8' }}>
              Entradas Vendidas por Día (Semana {datos.semana_numero})
            </h3>
          </div>

          {/* Gráfico de barras con escala y grid */}
          <div style={{ position: 'relative', height: 230, borderBottom: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: '0.5rem' }}>
            {/* Líneas horizontales de fondo */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.07)' }} />
            <div style={{ position: 'absolute', top: '25%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.07)' }} />
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.07)' }} />
            <div style={{ position: 'absolute', top: '75%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.07)' }} />

            {datos.entradas_por_dia.map((d) => {
              const alturaPorc = Math.min(100, Math.round((d.cantidad / maxEntradasDia) * 100));
              const esSabado = d.dia === 'Sáb';
              return (
                <div
                  key={d.dia}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, width: '16%' }}
                  onMouseEnter={() => setTooltipDia(d)}
                  onMouseLeave={() => setTooltipDia(null)}
                >
                  {/* Tooltip interactivo si coincide */}
                  {tooltipDia?.dia === d.dia && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: `${alturaPorc + 15}%`,
                        background: '#1a0d13',
                        border: '1px solid #d4af37',
                        padding: '0.35rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: '#f5e6c8',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        zIndex: 10,
                      }}
                    >
                      <strong style={{ color: '#d4af37' }}>{d.dia} ({d.promo})</strong>
                      <div>Entradas vendidas: <strong>{d.cantidad}</strong></div>
                    </div>
                  )}

                  {/* Barra */}
                  <div
                    style={{
                      width: '85%',
                      height: `${alturaPorc * 1.8}px`,
                      background: esSabado
                        ? 'linear-gradient(180deg, #10b981 0%, #047857 100%)'
                        : 'linear-gradient(180deg, #c9a24b 0%, #8b6b23 100%)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease, filter 0.2s',
                      cursor: 'pointer',
                      border: esSabado ? '1px solid #34d399' : '1px solid #eab308',
                    }}
                    title={`${d.dia} (${d.promo}): ${d.cantidad} entradas`}
                  />

                  {/* Etiquetas de eje X */}
                  <span style={{ fontSize: '0.72rem', color: '#f5e6c8', marginTop: '0.4rem', fontWeight: 600 }}>
                    {d.dia}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'rgba(245,230,200,0.5)' }}>
                    ({d.promo})
                  </span>
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: '0.75rem', color: 'rgba(245,230,200,0.6)', marginTop: '0.75rem', margin: '0.75rem 0 0' }}>
            Miércoles (3×1), Jueves–Viernes–Domingo (2×1+Sixpacks), Sábado (Tarifa Plana $3.51)
          </p>
        </div>

        {/* Gráfico 2: Top 6 Salas por Asistencia */}
        <div style={{ background: '#13080c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1rem' }}>🏆</span>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: '#f5e6c8' }}>
              Top 6 Salas por Asistencia (S{datos.semana_numero})
            </h3>
          </div>

          {/* Gráfico de barras */}
          <div style={{ position: 'relative', height: 230, borderBottom: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: '0.5rem' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.07)' }} />
            <div style={{ position: 'absolute', top: '25%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.07)' }} />
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.07)' }} />
            <div style={{ position: 'absolute', top: '75%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.07)' }} />

            {datos.top_salas.map((s, idx) => {
              const alturaPorc = Math.min(100, Math.round((s.asistencia / maxTopSalas) * 100));
              return (
                <div key={s.sala} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, width: '14%' }}>
                  <div
                    style={{
                      width: '85%',
                      height: `${alturaPorc * 1.8}px`,
                      background: idx === 0
                        ? 'linear-gradient(180deg, #d4af37 0%, #a17822 100%)'
                        : 'linear-gradient(180deg, #b88d30 0%, #7d5b16 100%)',
                      borderRadius: '4px 4px 0 0',
                      border: '1px solid #d4af37',
                    }}
                    title={`${s.sala}: ${s.asistencia} espectadores`}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#f5e6c8', marginTop: '0.4rem', whiteSpace: 'nowrap' }}>
                    {s.sala}
                  </span>
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: '0.75rem', color: 'rgba(245,230,200,0.6)', marginTop: '0.75rem', margin: '0.75rem 0 0' }}>
            {datos.nota_salas || 'Sala 7 lidera con 515 espectadores en la segunda semana.'}
          </p>
        </div>
      </div>

      {/* ─── GRÁFICO 3: Comedia vs Drama — Semana 1 vs Semana 2 ─── */}
      <div style={{ background: '#13080c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🎭</span>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: '#f5e6c8' }}>
              Comedia vs Drama — Semana 1 vs Semana 2
            </h3>
          </div>

          {/* Leyenda de colores */}
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: 12, height: 12, background: '#c9a24b', borderRadius: 2 }} /> Comedia
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: 12, height: 12, background: '#22c55e', borderRadius: 2 }} /> Drama
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: 12, height: 12, background: '#6366f1', borderRadius: 2 }} /> Otros (Terror/Erótico)
            </span>
          </div>
        </div>

        {/* Gráfico comparativo de barras agrupadas */}
        <div style={{ position: 'relative', height: 210, borderBottom: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: '0.5rem' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.07)' }} />
          <div style={{ position: 'absolute', top: '33%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.07)' }} />
          <div style={{ position: 'absolute', top: '66%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.07)' }} />

          {/* Semana 1 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '38%' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.6rem', height: 160, width: '100%', justifyContent: 'center' }}>
              {/* Comedia S1 */}
              <div
                style={{
                  width: '38%',
                  height: `${(datos.generos_comparativa.comedia_s1 / maxGeneros) * 160}px`,
                  background: '#c9a24b',
                  borderRadius: '4px 4px 0 0',
                }}
                title={`Comedia S1: ${datos.generos_comparativa.comedia_s1} espectadores`}
              />
              {/* Drama S1 */}
              <div
                style={{
                  width: '38%',
                  height: `${(datos.generos_comparativa.drama_s1 / maxGeneros) * 160}px`,
                  background: '#22c55e',
                  borderRadius: '4px 4px 0 0',
                }}
                title={`Drama S1: ${datos.generos_comparativa.drama_s1} espectadores`}
              />
              {/* Otros S1 */}
              <div
                style={{
                  width: '24%',
                  height: `${(datos.generos_comparativa.otros_s1 / maxGeneros) * 160}px`,
                  background: '#6366f1',
                  borderRadius: '4px 4px 0 0',
                }}
                title={`Otros S1: ${datos.generos_comparativa.otros_s1} espectadores`}
              />
            </div>
            <span style={{ fontSize: '0.8rem', color: '#f5e6c8', marginTop: '0.5rem', fontWeight: 600 }}>Semana 1</span>
          </div>

          {/* Semana 2 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '38%' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.6rem', height: 160, width: '100%', justifyContent: 'center' }}>
              {/* Comedia S2 */}
              <div
                style={{
                  width: '38%',
                  height: `${(datos.generos_comparativa.comedia_s2 / maxGeneros) * 160}px`,
                  background: '#c9a24b',
                  borderRadius: '4px 4px 0 0',
                }}
                title={`Comedia S2: ${datos.generos_comparativa.comedia_s2} espectadores`}
              />
              {/* Drama S2 */}
              <div
                style={{
                  width: '38%',
                  height: `${(datos.generos_comparativa.drama_s2 / maxGeneros) * 160}px`,
                  background: '#22c55e',
                  borderRadius: '4px 4px 0 0',
                }}
                title={`Drama S2: ${datos.generos_comparativa.drama_s2} espectadores`}
              />
              {/* Otros S2 */}
              <div
                style={{
                  width: '24%',
                  height: `${(datos.generos_comparativa.otros_s2 / maxGeneros) * 160}px`,
                  background: '#6366f1',
                  borderRadius: '4px 4px 0 0',
                }}
                title={`Otros S2: ${datos.generos_comparativa.otros_s2} espectadores`}
              />
            </div>
            <span style={{ fontSize: '0.8rem', color: '#f5e6c8', marginTop: '0.5rem', fontWeight: 600 }}>Semana 2</span>
          </div>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'rgba(245,230,200,0.6)', marginTop: '0.75rem', margin: '0.75rem 0 0' }}>
          {datos.nota_generos || 'Drama cayó un 22.25% en la segunda semana, mientras Comedia mantiene el 64% de la cartelera (14 de 22 salas).'}
        </p>
      </div>

      {/* ─── SECCIÓN INFORMATIVA INFERIOR (Historia, Servicios, Normas) ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: '1.5rem',
        }}
      >
        <div>
          <h4 style={{ color: '#d4af37', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>
            | Historia & Arquitectura
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'rgba(245,230,200,0.7)', lineHeight: 1.6, margin: 0 }}>
            Inaugurado en 1881 bajo el gobierno de Antonio Guzmán Blanco, el Teatro Municipal de Caracas es una joya
            neoclásica de la arquitectura escénica venezolana con acústica de estándar europeo.
          </p>
        </div>

        <div>
          <h4 style={{ color: '#d4af37', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>
            | Servicios al Público
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8rem', color: 'rgba(245,230,200,0.7)', display: 'grid', gap: '0.3rem' }}>
            <li>✓ Estacionamiento techado y vigilado</li>
            <li>✓ Cafetería gourmet en el foyer</li>
            <li>✓ Acceso accesible para sillas de ruedas</li>
            <li>✓ Guardarropa de cortesía</li>
            <li>✓ Climatización integral de sala</li>
          </ul>
        </div>

        <div>
          <h4 style={{ color: '#d4af37', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>
            | Normas de Sala
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8rem', color: 'rgba(245,230,200,0.7)', display: 'grid', gap: '0.3rem' }}>
            <li>▲ Silenciar teléfonos móviles durante la función</li>
            <li>▲ Prohibido el uso de flash fotográfico</li>
            <li>▲ Se ruega puntualidad (las puertas cierran a la tercera llamada)</li>
            <li>▲ No se permite el ingreso con alimentos o bebidas a la platea</li>
          </ul>
        </div>
      </div>

      {/* ─── MODAL PARA QUE EL ADMIN AGREGUE DATOS DE SEMANAS PASADAS ─── */}
      <Modal
        isOpen={modalFormOpen}
        onClose={() => setModalFormOpen(false)}
        title="➕ Registrar Datos de Semana Pasada"
        size="md"
      >
        <form onSubmit={handleGuardarSemana} style={{ display: 'grid', gap: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-primario)' }}>Nº Semana *</label>
              <input
                type="number"
                min="1"
                required
                className="input"
                value={formSemana.semana_numero}
                onChange={(e) => setFormSemana({ ...formSemana, semana_numero: parseInt(e.target.value, 10) })}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-primario)' }}>Título del Evento *</label>
              <input
                type="text"
                required
                className="input"
                value={formSemana.titulo_evento}
                onChange={(e) => setFormSemana({ ...formSemana, titulo_evento: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-primario)' }}>Salas Activas</label>
              <input
                type="number"
                className="input"
                value={formSemana.salas_activas}
                onChange={(e) => setFormSemana({ ...formSemana, salas_activas: parseInt(e.target.value, 10) })}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-primario)' }}>Entradas Vendidas</label>
              <input
                type="number"
                className="input"
                value={formSemana.entradas_semana}
                onChange={(e) => setFormSemana({ ...formSemana, entradas_semana: parseInt(e.target.value, 10) })}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-primario)' }}>Crecimiento %</label>
              <input
                type="text"
                className="input"
                placeholder="+8.45%"
                value={formSemana.crecimiento_porcentaje}
                onChange={(e) => setFormSemana({ ...formSemana, crecimiento_porcentaje: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-primario)' }}>
              Entradas por Día (Miér / Jue / Vie / Sáb / Dom):
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem', marginTop: '0.25rem' }}>
              <input
                type="number"
                placeholder="Miér"
                className="input"
                value={formSemana.miercoles}
                onChange={(e) => setFormSemana({ ...formSemana, miercoles: parseInt(e.target.value, 10) || 0 })}
              />
              <input
                type="number"
                placeholder="Jue"
                className="input"
                value={formSemana.jueves}
                onChange={(e) => setFormSemana({ ...formSemana, jueves: parseInt(e.target.value, 10) || 0 })}
              />
              <input
                type="number"
                placeholder="Vie"
                className="input"
                value={formSemana.viernes}
                onChange={(e) => setFormSemana({ ...formSemana, viernes: parseInt(e.target.value, 10) || 0 })}
              />
              <input
                type="number"
                placeholder="Sáb"
                className="input"
                value={formSemana.sabado}
                onChange={(e) => setFormSemana({ ...formSemana, sabado: parseInt(e.target.value, 10) || 0 })}
              />
              <input
                type="number"
                placeholder="Dom"
                className="input"
                value={formSemana.domingo}
                onChange={(e) => setFormSemana({ ...formSemana, domingo: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-primario)' }}>Nota o Comentario de Salas</label>
            <input
              type="text"
              className="input"
              value={formSemana.nota_salas}
              onChange={(e) => setFormSemana({ ...formSemana, nota_salas: e.target.value })}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-primario)' }}>Nota o Análisis de Géneros</label>
            <input
              type="text"
              className="input"
              value={formSemana.nota_generos}
              onChange={(e) => setFormSemana({ ...formSemana, nota_generos: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setModalFormOpen(false)} className="btn btn-secundario">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primario">
              Guardar Estadística
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
