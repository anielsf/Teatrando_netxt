'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Modal } from '@/components/Modal';
import { useCartelera } from '@/hooks/useCartelera';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import type { Cartelera } from '@/store/appStore';
import { useAppStore } from '@/store/appStore';

export default function CarteleraPage() {
  const { carteleras, loading, error, filtros, setFiltros } = useCartelera();
  const { formatUSD, formatVES, convertToVES, tasaBCV } = useCurrency();
  const { isAuthenticated, isAdmin } = useAuth();
  const { setCarteleraSeleccionada } = useAppStore();
  const [obraDetalle, setObraDetalle] = useState<Cartelera | null>(null);
  const router = useRouter();

  const generos = [...new Set(carteleras.map((c) => c.genero).filter(Boolean))];

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
      <main style={{ padding: '2rem 0' }}>
        <div className="contenedor">
          <h1 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', marginBottom: '0.5rem' }}>
            Cartelera Teatral
          </h1>
          <p style={{ color: 'var(--color-texto-suave)', marginBottom: '2rem' }}>
            Tasa BCV: <strong style={{ color: 'var(--color-primario)' }}>Bs. {tasaBCV.toFixed(2)}</strong>
          </p>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <input
              type="text"
              placeholder="Buscar obra..."
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
          {loading && <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}
          {error && <p style={{ color: '#ff6b8a' }}>⚠️ {error}</p>}

          {/* Grid de carteleras */}
          {!loading && !error && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {carteleras.map((obra) => (
                <article key={obra.id} className="card">
                  {obra.imagen && (
                    <img src={obra.imagen} alt={obra.obra}
                      style={{ width: '100%', height: 190, objectFit: 'cover', borderRadius: 'var(--border-radius)', marginBottom: '1rem' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div className="badge badge-usuario" style={{ marginBottom: '0.5rem' }}>{obra.genero}</div>
                  <h2 style={{ fontFamily: 'var(--font-familia)', fontSize: '1.15rem', marginBottom: '0.25rem' }}>{obra.obra}</h2>
                  <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    {obra.funcion} · {obra.sala}
                  </p>
                  <p style={{ color: 'var(--color-texto-muted)', fontSize: '0.82rem', marginBottom: '1rem' }}>
                    📅 {obra.fecha && typeof obra.fecha === 'string' 
    ? obra.fecha.split('T')[0].split('-').reverse().join('/') 
    : (obra.fecha || '')} · ⏰ {obra.hora?.slice(0,5)} · 🎬 {obra.duracion_min} min
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ color: 'var(--color-primario)', fontWeight: 700, fontSize: '1.1rem' }}>{formatUSD(obra.precio_usd)}</div>
                      <div style={{ color: 'var(--color-texto-muted)', fontSize: '0.78rem' }}>{formatVES(convertToVES(obra.precio_usd))}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-secundario" style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
                        onClick={() => setObraDetalle(obra)}>
                        Detalle
                      </button>
                      <button className="btn btn-primario" style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
                        onClick={() => handleComprar(obra)}>
                        Comprar
                      </button>

                      {/* BOTONES CONDICIONALES PARA EL ADMINISTRADOR */}
                      {isAdmin && (
                        <>
                          <button 
                            className="btn" 
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', backgroundColor: '#c9a24b', color: '#fff' }}
                            onClick={() => {
                              setCarteleraSeleccionada(obra);
                              router.push(`/admin/cartelera/editar?id=${obra.id}`);
                            }}
                          >
                            ⚙️ Configurar
                          </button>
                          <button 
                            className="btn" 
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', backgroundColor: '#ff6b8a', color: '#fff' }}
                            onClick={async () => {
                              if (confirm(`¿Seguro que deseas eliminar la obra "${obra.obra}"?`)) {
                                try {
                                  const response = await fetch(`/api/carteleras?id=${obra.id}`, { method: 'DELETE' });
                                  if (response.ok) {
                                    window.location.reload();
                                  } else {
                                    alert('Error al intentar eliminar la cartelera');
                                  }
                                } catch (err) {
                                  console.error('Error:', err);
                                  alert('Ocurrió un fallo en la conexión');
                                }
                              }
                            }}
                          >
                            🗑️ Eliminar
                          </button>
                        </>
                      )}
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
      <Modal isOpen={!!obraDetalle} onClose={() => setObraDetalle(null)}
        title={obraDetalle?.obra} size="lg">
        {obraDetalle && (
          <div>
            {obraDetalle.imagen && (
              <img src={obraDetalle.imagen} alt={obraDetalle.obra}
                style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 'var(--border-radius)', marginBottom: '1.5rem' }} />
            )}
            <p style={{ color: 'var(--color-texto-suave)', marginBottom: '1rem', lineHeight: 1.7 }}>{obraDetalle.sinopsis}</p>
            {obraDetalle.reparto && (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-texto-muted)', marginBottom: '1rem' }}>
                <strong style={{ color: 'var(--color-primario)' }}>Reparto:</strong> {obraDetalle.reparto}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn btn-primario" onClick={() => { setObraDetalle(null); handleComprar(obraDetalle); }}>
                🎟️ Comprar Entrada
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
