'use client';

import Link from 'next/link';

type Obra = {
  id: string | number;
  obra: string;
  funcion: string;
  fecha: string;
  hora?: string;
  imagen?: string;
  precio_usd: number | string;
  genero?: string;
};

export function ObraCard({ obra }: { obra: Obra }) {
  return (
    <Link href="/cartelera" className="card" style={{ display: 'block', textDecoration: 'none' }}>
      {obra.imagen && (
        <img
          src={obra.imagen}
          alt={obra.obra}
          style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 'var(--border-radius)', marginBottom: '1rem' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
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
  );
}