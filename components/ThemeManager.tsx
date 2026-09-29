'use client';

import { useState, useEffect } from 'react';
import { useAppStore, type SeasonalTheme } from '@/store/appStore';

interface ThemeManagerProps {
  onThemeSaved?: () => void;
}

const TEMAS_PREDEFINIDOS = [
  {
    nombre: 'Gala Clásica (Oro & Vino)',
    color_primario: '#c9a24b',
    color_secundario: '#8b1a2e',
    color_acento: '#d4af37',
    color_fondo: '#0d0507',
    color_texto: '#f5e6c8',
    color_texto_suave: '#d8c9b3',
    border_radius: '6px',
    font_familia: 'Playfair Display',
  },
  {
    nombre: 'Temporada Microteatro (Neón & Oscuridad)',
    color_primario: '#e11d48',
    color_secundario: '#4c0519',
    color_acento: '#fb7185',
    color_fondo: '#09090b',
    color_texto: '#fafafa',
    color_texto_suave: '#e4e4e7',
    border_radius: '10px',
    font_familia: 'Inter',
  },
  {
    nombre: 'Festival de Comedia (Dorado Solar)',
    color_primario: '#f59e0b',
    color_secundario: '#78350f',
    color_acento: '#fbbf24',
    color_fondo: '#181005',
    color_texto: '#fef3c7',
    color_texto_suave: '#fde68a',
    border_radius: '12px',
    font_familia: 'Playfair Display',
  },
  {
    nombre: 'Vanguardia / Shakespeare (Esmeralda & Mármol)',
    color_primario: '#10b981',
    color_secundario: '#064e3b',
    color_acento: '#34d399',
    color_fondo: '#021811',
    color_texto: '#ecfdf5',
    color_texto_suave: '#a7f3d0',
    border_radius: '4px',
    font_familia: 'Playfair Display',
  },
];

export function ThemeManager({ onThemeSaved }: ThemeManagerProps) {
  const { tema: temaActual, setTema } = useAppStore();
  const [temaForm, setTemaForm] = useState<SeasonalTheme>({
    nombre: 'Tema Personalizado',
    color_primario: temaActual.color_primario || '#c9a24b',
    color_secundario: temaActual.color_secundario || '#8b1a2e',
    color_acento: temaActual.color_acento || '#d4af37',
    color_fondo: temaActual.color_fondo || '#0d0507',
    color_texto: temaActual.color_texto || '#f5e6c8',
    color_texto_suave: temaActual.color_texto_suave || '#d8c9b3',
    border_radius: temaActual.border_radius || '6px',
    font_familia: temaActual.font_familia || 'Playfair Display',
    hero_image_url: temaActual.hero_image_url || '',
  });

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Sincronizar desde la base de datos viva
    fetch('/api/temas')
      .then((res) => res.json())
      .then((t) => {
        if (t && t.color_primario) {
          setTemaForm({
            id: t.id,
            nombre: t.nombre || 'Tema Activo',
            color_primario: t.color_primario,
            color_secundario: t.color_secundario,
            color_acento: t.color_acento,
            color_fondo: t.color_fondo,
            color_texto: t.color_texto,
            color_texto_suave: t.color_texto_suave,
            border_radius: t.border_radius || '6px',
            font_familia: t.font_familia || 'Playfair Display',
            hero_image_url: t.hero_image_url || '',
          });
        }
      })
      .catch(() => {});
  }, []);

  const aplicarPredefinido = (p: typeof TEMAS_PREDEFINIDOS[0]) => {
    setTemaForm((prev) => ({
      ...prev,
      nombre: p.nombre,
      color_primario: p.color_primario,
      color_secundario: p.color_secundario,
      color_acento: p.color_acento,
      color_fondo: p.color_fondo,
      color_texto: p.color_texto,
      color_texto_suave: p.color_texto_suave,
      border_radius: p.border_radius,
      font_familia: p.font_familia,
    }));
  };

  const handleGuardarTema = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const res = await fetch('/api/temas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...temaForm,
          activo: true,
          fecha_inicio: new Date().toISOString().split('T')[0],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar el tema.');

      // Inyectar inmediatamente en el store del cliente para cambio en vivo
      setTema({
        ...temaForm,
        id: data.tema?.id,
      });

      setMensaje('🎨 Tema estacional guardado y activado globalmente con éxito.');
      if (onThemeSaved) onThemeSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
      {/* Editor del Tema */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', marginBottom: '0.5rem' }}>
          🎨 Motor de Tematización Estacional
        </h2>
        <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
          Configura los ciclos visuales de 15 a 30 días para adaptar la plataforma según temporadas (Navidad, Semana Santa, Microteatral, etc.). Los cambios aplican dinámicamente en todo el sitio web mediante CSS Variables.
        </p>

        {mensaje && (
          <div style={{ background: 'rgba(52, 168, 83, 0.15)', border: '1px solid #34a853', color: '#86efac', padding: '0.6rem 0.85rem', borderRadius: 'var(--border-radius)', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {mensaje}
          </div>
        )}
        {error && (
          <div style={{ background: 'rgba(139, 26, 46, 0.25)', border: '1px solid #8b1a2e', color: '#ff8099', padding: '0.6rem 0.85rem', borderRadius: 'var(--border-radius)', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {/* Plantillas Rápidas */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--color-texto-muted)', display: 'block', marginBottom: '0.4rem' }}>
            PLANTILLAS ESTACIONALES PREDEFINIDAS:
          </label>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {TEMAS_PREDEFINIDOS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                className="btn btn-secundario"
                onClick={() => aplicarPredefinido(p)}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
              >
                {p.nombre}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleGuardarTema} style={{ display: 'grid', gap: '0.85rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-texto-muted)' }}>Nombre de la Temporada</label>
            <input
              type="text"
              className="input"
              value={temaForm.nombre}
              onChange={(e) => setTemaForm({ ...temaForm, nombre: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-texto-muted)' }}>Color Primario (Oro/Acento)</label>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input
                  type="color"
                  value={temaForm.color_primario}
                  onChange={(e) => setTemaForm({ ...temaForm, color_primario: e.target.value })}
                  style={{ width: 40, height: 36, border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                />
                <input
                  type="text"
                  className="input"
                  value={temaForm.color_primario}
                  onChange={(e) => setTemaForm({ ...temaForm, color_primario: e.target.value })}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-texto-muted)' }}>Color Secundario (Vino/Contraste)</label>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input
                  type="color"
                  value={temaForm.color_secundario}
                  onChange={(e) => setTemaForm({ ...temaForm, color_secundario: e.target.value })}
                  style={{ width: 40, height: 36, border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                />
                <input
                  type="text"
                  className="input"
                  value={temaForm.color_secundario}
                  onChange={(e) => setTemaForm({ ...temaForm, color_secundario: e.target.value })}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-texto-muted)' }}>Color Fondo Base</label>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input
                  type="color"
                  value={temaForm.color_fondo}
                  onChange={(e) => setTemaForm({ ...temaForm, color_fondo: e.target.value })}
                  style={{ width: 40, height: 36, border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                />
                <input
                  type="text"
                  className="input"
                  value={temaForm.color_fondo}
                  onChange={(e) => setTemaForm({ ...temaForm, color_fondo: e.target.value })}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-texto-muted)' }}>Curvatura Botones (`border-radius`)</label>
              <select
                className="input"
                value={temaForm.border_radius}
                onChange={(e) => setTemaForm({ ...temaForm, border_radius: e.target.value })}
              >
                <option value="0px">0px (Estilo Clásico Cuadrado)</option>
                <option value="4px">4px (Suave Moderno)</option>
                <option value="6px">6px (Predeterminado Teatrando)</option>
                <option value="12px">12px (Curvatura Pronunciada)</option>
                <option value="25px">25px (Píldora / Redondo)</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-texto-muted)' }}>Tipografía de Títulos</label>
            <select
              className="input"
              value={temaForm.font_familia}
              onChange={(e) => setTemaForm({ ...temaForm, font_familia: e.target.value })}
            >
              <option value="Playfair Display">Playfair Display (Teatral Clásica)</option>
              <option value="Inter">Inter (Moderna Minimalista)</option>
              <option value="Georgia">Georgia (Serif Tradicional)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-texto-muted)' }}>URL Imagen Hero Estacional (Opcional)</label>
            <input
              type="url"
              className="input"
              placeholder="https://ejemplo.com/banner-temporada.jpg"
              value={temaForm.hero_image_url || ''}
              onChange={(e) => setTemaForm({ ...temaForm, hero_image_url: e.target.value })}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primario"
            disabled={guardando}
            style={{ justifyContent: 'center', marginTop: '0.5rem', padding: '0.75rem' }}
          >
            {guardando ? 'Guardando y Aplicando...' : '💾 Activar Tema Estacional'}
          </button>
        </form>
      </div>

      {/* Vista Previa en Vivo */}
      <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', marginBottom: '0.5rem' }}>
            👁️ Vista Previa en Tiempo Real
          </h3>
          <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Así visualizarán los espectadores los botones, tarjetas y colores de la temporada.
          </p>

          {/* Caja mockup */}
          <div
            style={{
              background: temaForm.color_fondo,
              border: `1px solid ${temaForm.color_secundario}`,
              borderRadius: temaForm.border_radius,
              padding: '1.5rem',
              color: temaForm.color_texto,
            }}
          >
            <span
              style={{
                background: `${temaForm.color_primario}22`,
                color: temaForm.color_primario,
                border: `1px solid ${temaForm.color_primario}55`,
                padding: '0.2rem 0.6rem',
                borderRadius: '100px',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              Muestra Estacional
            </span>

            <h4
              style={{
                fontFamily: `'${temaForm.font_familia}', serif`,
                fontSize: '1.4rem',
                color: temaForm.color_texto,
                marginTop: '0.75rem',
                marginBottom: '0.35rem',
              }}
            >
              {temaForm.nombre}
            </h4>

            <p style={{ color: temaForm.color_texto_suave, fontSize: '0.88rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Experimenta el contraste de color y el radio de borde configurado para los componentes de venta teatral.
            </p>

            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                style={{
                  background: `linear-gradient(135deg, ${temaForm.color_primario}, ${temaForm.color_acento})`,
                  color: temaForm.color_fondo,
                  border: 'none',
                  borderRadius: temaForm.border_radius,
                  padding: '0.55rem 1.1rem',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Comprar Entrada
              </button>

              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: `1px solid ${temaForm.color_primario}`,
                  color: temaForm.color_primario,
                  borderRadius: temaForm.border_radius,
                  padding: '0.55rem 1.1rem',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Ver Cartelera
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--border-radius)', fontSize: '0.8rem', color: 'var(--color-texto-muted)' }}>
          💡 <strong>Tip:</strong> Al presionar <em>Activar Tema</em>, todos los visitantes conectados verán actualizarse el diseño instantáneamente sin necesidad de recompilar la aplicación.
        </div>
      </div>
    </div>
  );
}
