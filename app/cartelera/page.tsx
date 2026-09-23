'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Modal } from '@/components/Modal';
import { CriticReviewSection } from '@/components/CriticReviewSection';
import { useCartelera } from '@/hooks/useCartelera';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import type { Cartelera } from '@/store/appStore';
import { useAppStore } from '@/store/appStore';

export default function CarteleraPage() {
  const { carteleras, loading, error, filtros, setFiltros } = useCartelera();
  const { formatUSD, formatVES, convertToVES, tasaBCV } = useCurrency();
  const { isAuthenticated } = useAuth();
  const { setCarteleraSeleccionada } = useAppStore();
  const [obraDetalle, setObraDetalle] = useState<Cartelera | null>(null);
  const router = useRouter();

  const generos = [...new Set(carteleras.map((c) => c.genero).filter(Boolean))];
  const grupos = [...new Set(carteleras.map((c) => c.grupo_teatral).filter(Boolean))];

  const handleComprar = (obra: Cartelera) => {
    if (!isAuthenticated) {
      router.push('/auth?next=/checkout');
      return;
    }
    setCarteleraSeleccionada(obra);
    router.push('/checkout');
  };

  return (
    <>
      <Navbar />
      <main style={{ padding: '2rem 0 5rem' }}>
        <div className="contenedor">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
            <h1 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', margin: 0 }}>
              Cartelera Teatral
            </h1>
            <div style={{ background: 'rgba(212, 175, 55, 0.1)', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-texto-suave)' }}>Tasa Oficial BCV: </span>
              <strong style={{ color: 'var(--color-primario)', fontSize: '0.95rem' }}>Bs. {tasaBCV.toFixed(2)}</strong>
            </div>
          </div>

          <p style={{ color: 'var(--color-texto-suave)', marginBottom: '2rem', fontSize: '0.95rem' }}>
            Explora las obras en escena presentadas por los diferentes Grupos Teatrales (Grupos TH) de Venezuela.
          </p>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <input
              type="text"
              placeholder="Buscar por obra o grupo teatral..."
              className="input"
              style={{ flex: '1', minWidth: 200 }}
              value={filtros.texto || ''}
              onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })}
            />
            <select
              className="input"
              style={{ width: 'auto' }}
              value={filtros.genero || ''}
              onChange={(e) => setFiltros({ ...filtros, genero: e.target.value || undefined })}
            >
              <option value="">Todos los géneros</option>
              {generos.map((g) => <option key={g} value={g!}>{g}</option>)}
            </select>
          </div>

          {/* Estado de carga / error */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          )}
          {error && <p style={{ color: '#ff8099' }}>⚠️ {error}</p>}

          {/* Grid de carteleras */}
          {!loading && !error && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1.5rem' }}>
              {carteleras.map((obra) => (
                <article key={obra.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    {obra.imagen ? (
                      <img
                        src={obra.imagen}
                        alt={obra.obra}
                        style={{ width: '100%', height: 195, objectFit: 'cover', borderRadius: 'var(--border-radius)', marginBottom: '0.85rem' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: 160,
                          background: 'rgba(255,255,255,0.03)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 'var(--border-radius)',
                          marginBottom: '0.85rem',
                          fontSize: '2.5rem',
                        }}
                      >
                        🎭
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="badge badge-usuario" style={{ fontSize: '0.75rem' }}>{obra.genero || 'Teatro'}</span>
                      {/* Identificador del Grupo Teatral Creador */}
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: '#d4af37',
                          background: 'rgba(212, 175, 55, 0.1)',
                          border: '1px solid rgba(212, 175, 55, 0.25)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        🎭 {obra.grupo_teatral || 'Compañía Residente'}
                      </span>
                    </div>

                    <h2 style={{ fontFamily: 'var(--font-familia)', fontSize: '1.2rem', margin: '0.25rem 0' }}>{obra.obra}</h2>
                    <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      {obra.funcion} · {obra.sala}
                    </p>
                    <p style={{ color: 'var(--color-texto-muted)', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                      📅 {obra.fecha ? new Date(obra.fecha).toLocaleDateString('es-ES', { timeZone: 'UTC' }) : ''} · ⏰ {obra.hora?.slice(0, 5)} · 🎬 {obra.duracion_min || 90} min
                    </p>

                    {/* Label de Butacas disponibles */}
                    <div style={{ marginBottom: '1rem' }}>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: (obra.butacas_disponibles || 0) > 10 ? '#22c55e' : '#f97316',
                          background: 'rgba(255,255,255,0.04)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                        }}
                      >
                        🪑 {obra.butacas_disponibles !== undefined ? obra.butacas_disponibles : 80} butacas disponibles
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-borde)', paddingTop: '0.85rem', marginTop: '0.5rem' }}>
                    <div>
                      <div style={{ color: 'var(--color-primario)', fontWeight: 700, fontSize: '1.15rem' }}>
                        {formatUSD(obra.precio_usd)}
                      </div>
                      <div style={{ color: 'var(--color-texto-muted)', fontSize: '0.78rem' }}>
                        {formatVES(convertToVES(obra.precio_usd))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secundario"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
                        onClick={() => setObraDetalle(obra)}
                      >
                        Detalle
                      </button>
                      <button
                        className="btn btn-primario"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
                        onClick={() => handleComprar(obra)}
                      >
                        Comprar
                      </button>
                    </div>
                  </div>
                </article>
              ))}

              {carteleras.length === 0 && (
                <p style={{ color: 'var(--color-texto-muted)', gridColumn: '1/-1', textAlign: 'center', padding: '2rem' }}>
                  No se encontraron obras para los filtros seleccionados.
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modal de Detalle */}
      <Modal isOpen={!!obraDetalle} onClose={() => setObraDetalle(null)} title={obraDetalle?.obra} size="lg">
        {obraDetalle && (
          <div>
            {obraDetalle.imagen && (
              <img
                src={obraDetalle.imagen}
                alt={obraDetalle.obra}
                style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 'var(--border-radius)', marginBottom: '1.25rem' }}
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span className="badge badge-usuario">{obraDetalle.genero}</span>
              <span
                style={{
                  background: 'rgba(212, 175, 55, 0.12)',
                  color: '#d4af37',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                🎭 Creado por: {obraDetalle.grupo_teatral || 'Compañía Residente'}
              </span>
              <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '0.85rem' }}>
                🪑 {obraDetalle.butacas_disponibles ?? 80} butacas disponibles
              </span>
            </div>

            <p style={{ color: 'var(--color-texto-suave)', marginBottom: '1rem', lineHeight: 1.7 }}>
              {obraDetalle.sinopsis}
            </p>

            {obraDetalle.reparto && (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-texto-muted)', marginBottom: '1rem' }}>
                <strong style={{ color: 'var(--color-primario)' }}>Reparto:</strong> {obraDetalle.reparto}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', marginBottom: '1.5rem', borderTop: '1px solid var(--color-borde)', paddingTop: '1rem' }}>
              <div>
                <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primario)' }}>
                  {formatUSD(obraDetalle.precio_usd)}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-texto-muted)', marginLeft: '0.5rem' }}>
                  ({formatVES(convertToVES(obraDetalle.precio_usd))})
                </span>
              </div>
              <button
                className="btn btn-primario"
                onClick={() => {
                  const o = obraDetalle;
                  setObraDetalle(null);
                  handleComprar(o);
                }}
              >
                🎟️ Comprar Entrada con Pago Móvil
              </button>
            </div>

            {/* Críticas y puntuaciones de 1 a 5 estrellas para el crítico */}
            <CriticReviewSection idObra={obraDetalle.id} obraTitulo={obraDetalle.obra} />
          </div>
        )}
      </Modal>
    </>
  );
}