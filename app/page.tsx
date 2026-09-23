import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';

export const metadata = {
  title: 'Inicio — Teatrando',
  description: 'Descubre las obras en cartelera y vive la experiencia teatral',
};

// Server Component — SSR
export default async function HomePage() {
  const supabase = createSupabaseServerClient();

  // Cargar obras destacadas (SSR para SEO)
  const { data: obras } = await supabase
    .from('carteleras')
    .select('id, obra, funcion, fecha, hora, imagen, precio_usd, genero, sala, sinopsis')
    .eq('visible', true)
    .order('fecha', { ascending: true })
    .limit(3);

  // Cargar estadísticas del teatro
  const { data: stats } = await supabase
    .from('estadisticas_teatro')
    .select('*')
    .eq('id_teatro', 1)
    .single();

  return (
    <>
      <Navbar />
      <main>
        {/* Hero Section */}
        <section style={{
          textAlign: 'center',
          padding: '5rem 1.5rem',
          background: 'radial-gradient(ellipse at top, #1a0a0d 0%, var(--color-fondo) 60%)',
        }}>
          <div className="contenedor">
            <p style={{ color: 'var(--color-primario)', fontStyle: 'italic', marginBottom: '1rem' }}>
              Bienvenido a la temporada 2026-2027
            </p>
            <h1 style={{ fontFamily: 'var(--font-familia)', fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', marginBottom: '1.5rem' }}>
              El arte de vivir<br />
              <span style={{ color: 'var(--color-primario)' }}>la escena</span>
            </h1>
            <p style={{ color: 'var(--color-texto-suave)', maxWidth: 520, margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
              Explora la cartelera teatral, selecciona tu butaca y obtén tu ticket digital
              con código QR para la mejor experiencia cultural de Venezuela.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/cartelera" className="btn btn-primario" style={{ fontSize: '1rem', padding: '0.8rem 2rem' }}>
                Ver Cartelera Completa
              </Link>
              <Link href="/auth" className="btn btn-secundario" style={{ fontSize: '1rem', padding: '0.8rem 2rem' }}>
                Crear Cuenta Gratis
              </Link>
            </div>
          </div>
        </section>

        {/* Estadísticas */}
        {stats && (
          <section style={{ padding: '3rem 1.5rem', borderTop: '1px solid var(--color-borde)' }}>
            <div className="contenedor">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', textAlign: 'center' }}>
                {[
                  { valor: stats.total_funciones || 24, label: 'Funciones realizadas' },
                  { valor: `${stats.porcentaje_ocupacion || 91}%`, label: 'Ocupación promedio' },
                  { valor: `${stats.calificacion_promedio || 4.9}⭐`, label: 'Calificación de críticos' },
                  { valor: stats.butacas_vendidas?.toLocaleString() || '5,280', label: 'Butacas vendidas' },
                ].map((stat) => (
                  <div key={stat.label} className="card" style={{ padding: '1.5rem 1rem' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primario)', fontFamily: 'var(--font-familia)' }}>
                      {stat.valor}
                    </div>
                    <div style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Obras Destacadas */}
        {obras && obras.length > 0 && (
          <section style={{ padding: '3rem 1.5rem' }}>
            <div className="contenedor">
              <h2 style={{ fontFamily: 'var(--font-familia)', color: 'var(--color-primario)', marginBottom: '2rem' }}>
                🎭 En Cartelera
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {obras.map((obra) => (
                  <Link key={obra.id} href="/cartelera" className="card" style={{ display: 'block', textDecoration: 'none' }}>
                    {obra.imagen && (
                      <img
                        src={obra.imagen}
                        alt={obra.obra}
                        style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 'var(--border-radius)', marginBottom: '1rem' }}
                      />
                    )}
                    <div className="badge badge-usuario" style={{ marginBottom: '0.5rem' }}>{obra.genero || 'Teatro'}</div>
                    <h3 style={{ fontFamily: 'var(--font-familia)', marginBottom: '0.25rem' }}>{obra.obra}</h3>
                    <p style={{ color: 'var(--color-texto-suave)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{obra.funcion}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--color-texto-muted)', fontSize: '0.82rem' }}>
                        📅 {obra.fecha} · {obra.hora?.slice(0,5)}
                      </span>
                      <span style={{ color: 'var(--color-primario)', fontWeight: 700 }}>
                        ${obra.precio_usd}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <Link href="/cartelera" className="btn btn-secundario">Ver toda la cartelera →</Link>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}