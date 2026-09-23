'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface Critica {
  id: number;
  nombre_autor: string;
  rol_autor: string;
  texto: string;
  estrellas: number;
  esDestacada?: boolean;
  fecha?: string;
}

interface CriticReviewSectionProps {
  idObra: string;
  obraTitulo: string;
  onCriticaAgregada?: () => void;
}

export function CriticReviewSection({ idObra, obraTitulo, onCriticaAgregada }: CriticReviewSectionProps) {
  const { user, isCritic, isAuthenticated } = useAuth();
  const [criticas, setCriticas] = useState<Critica[]>([]);
  const [loading, setLoading] = useState(true);
  const [puntuacion, setPuntuacion] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const cargarInteracciones = async () => {
    try {
      const res = await fetch(`/api/interacciones?id_obra=${encodeURIComponent(idObra)}`);
      if (res.ok) {
        const data = await res.json();
        // Filtrar y ordenar críticas
        const listaCriticas: Critica[] = data.map((item: any) => ({
          id: item.id,
          nombre_autor: item.nombreAutor || item.nombre_autor || 'Crítico Teatral',
          rol_autor: item.rolAutor || item.rol_autor || 'Crítico',
          texto: item.valor || '',
          estrellas: Number(item.estrellas) || 5,
          esDestacada: item.esDestacada || item.es_destacada || false,
          fecha: item.fechaRegistro || item.fecha_registro,
        }));
        setCriticas(listaCriticas);
      }
    } catch (err: any) {
      console.error('Error cargando críticas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarInteracciones();
  }, [idObra]);

  const ratingLabels: Record<number, string> = {
    1: '1/5 - Deficiente',
    2: '2/5 - Regular',
    3: '3/5 - Buena',
    4: '4/5 - Muy Buena',
    5: '5/5 - ¡Obra Maestra!',
  };

  const handleEnviarCritica = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) {
      setError('Por favor redacta tu reseña o comentario crítico.');
      return;
    }

    setEnviando(true);
    setError('');
    setMensaje('');

    try {
      const res = await fetch('/api/interacciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_obra: idObra,
          tipo: 'critica',
          valor: texto.trim(),
          estrellas: puntuacion,
          nombre_autor: user?.nombre || 'Crítico de Arte',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al publicar la crítica');

      setMensaje('¡Tu crítica y valoración han sido publicadas con éxito!');
      setTexto('');
      setPuntuacion(5);
      await cargarInteracciones();
      if (onCriticaAgregada) onCriticaAgregada();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const promedioEstrellas =
    criticas.length > 0
      ? (criticas.reduce((acc, c) => acc + (c.estrellas || 0), 0) / criticas.length).toFixed(1)
      : null;

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-borde)', paddingTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', margin: 0, fontSize: '1.25rem' }}>
          🎭 Críticas Teatrales y Calificaciones
        </h3>

        {promedioEstrellas && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(201, 162, 75, 0.15)', padding: '0.3rem 0.75rem', borderRadius: '16px', border: '1px solid rgba(201, 162, 75, 0.3)' }}>
            <span style={{ color: '#d4af37', fontSize: '1.1rem' }}>★</span>
            <strong style={{ color: 'var(--color-primario)', fontSize: '1rem' }}>{promedioEstrellas} / 5</strong>
            <small style={{ color: 'var(--color-texto-muted)' }}>({criticas.length} {criticas.length === 1 ? 'opinión' : 'opiniones'})</small>
          </div>
        )}
      </div>

      {/* FORMULARIO PARA EL ROL DE CRÍTICO O ADMIN */}
      {isCritic && (
        <div style={{
          background: 'rgba(139, 26, 46, 0.12)',
          border: '1px solid rgba(201, 162, 75, 0.3)',
          borderRadius: 'var(--border-radius)',
          padding: '1.25rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.2rem' }}>⭐</span>
            <strong style={{ color: 'var(--color-primario)' }}>
              Panel de Crítica Oficial: {user?.nombre} <span className="badge badge-critico" style={{ marginLeft: '0.4rem' }}>{user?.rol}</span>
            </strong>
          </div>

          <form onSubmit={handleEnviarCritica}>
            {/* Selector de 1 a 5 estrellas */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-texto-suave)', marginBottom: '0.4rem' }}>
                Tu Puntuación Teatral:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {[1, 2, 3, 4, 5].map((estrella) => {
                    const activa = (hoverRating !== null ? hoverRating : puntuacion) >= estrella;
                    return (
                      <button
                        type="button"
                        key={estrella}
                        onClick={() => setPuntuacion(estrella)}
                        onMouseEnter={() => setHoverRating(estrella)}
                        onMouseLeave={() => setHoverRating(null)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '1.8rem',
                          color: activa ? '#d4af37' : 'rgba(255,255,255,0.2)',
                          transition: 'transform 0.15s, color 0.15s',
                          padding: '0 2px',
                          lineHeight: 1
                        }}
                        title={`${estrella} estrellas`}
                      >
                        ★
                      </button>
                    );
                  })}
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-acento)', fontWeight: 600 }}>
                  {ratingLabels[hoverRating || puntuacion]}
                </span>
              </div>
            </div>

            {/* Texto de la crítica */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-texto-suave)', marginBottom: '0.4rem' }}>
                Reseña Crítica (dirección, actuaciones, escenografía, texto):
              </label>
              <textarea
                rows={3}
                className="input"
                style={{ width: '100%', resize: 'vertical' }}
                placeholder="Escribe tu análisis y veredicto profesional sobre la obra..."
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                required
              />
            </div>

            {error && <p style={{ color: '#ff8099', fontSize: '0.85rem', marginBottom: '0.5rem' }}>⚠️ {error}</p>}
            {mensaje && <p style={{ color: '#7ccc8e', fontSize: '0.85rem', marginBottom: '0.5rem' }}>✅ {mensaje}</p>}

            <button
              type="submit"
              className="btn btn-primario"
              disabled={enviando}
              style={{ fontSize: '0.88rem', padding: '0.5rem 1.25rem' }}
            >
              {enviando ? 'Publicando...' : 'Publicar Crítica Oficial'}
            </button>
          </form>
        </div>
      )}

      {!isAuthenticated && (
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px dashed var(--color-borde)',
          borderRadius: 'var(--border-radius)',
          padding: '1rem',
          textAlign: 'center',
          marginBottom: '1.5rem',
          fontSize: '0.88rem'
        }}>
          ¿Eres crítico teatral o asistente a la función?{' '}
          <a href="/auth" style={{ color: 'var(--color-primario)', textDecoration: 'underline' }}>
            Inicia sesión
          </a>{' '}
          para compartir tu valoración.
        </div>
      )}

      {/* LISTA DE CRÍTICAS PUBLICADAS */}
      {loading ? (
        <p style={{ color: 'var(--color-texto-muted)', fontSize: '0.85rem' }}>Cargando críticas...</p>
      ) : criticas.length === 0 ? (
        <p style={{ color: 'var(--color-texto-muted)', fontSize: '0.88rem', fontStyle: 'italic' }}>
          Esta obra aún no tiene críticas registradas. {isCritic ? '¡Sé el primero en emitir tu veredicto!' : ''}
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {criticas.map((c) => (
            <div
              key={c.id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 'var(--border-radius)',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong style={{ color: 'var(--color-texto)', fontSize: '0.95rem' }}>{c.nombre_autor}</strong>
                  <span className={c.rol_autor === 'Crítico' ? 'badge badge-critico' : 'badge badge-usuario'} style={{ fontSize: '0.72rem' }}>
                    {c.rol_autor || 'Crítico'}
                  </span>
                  {c.esDestacada && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-primario)', fontWeight: 600 }}>
                      ✓ Crítica Destacada
                    </span>
                  )}
                </div>

                {/* Estrellas */}
                <div style={{ display: 'flex', color: '#d4af37', fontSize: '1rem' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} style={{ opacity: star <= c.estrellas ? 1 : 0.25 }}>★</span>
                  ))}
                  <span style={{ marginLeft: '0.3rem', fontSize: '0.82rem', color: 'var(--color-texto-muted)' }}>
                    ({c.estrellas}/5)
                  </span>
                </div>
              </div>

              <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>
                "{c.texto}"
              </p>

              {c.fecha && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-texto-muted)', marginTop: '0.5rem' }}>
                  {new Date(c.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
