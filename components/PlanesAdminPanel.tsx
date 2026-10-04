'use client';

/**
 * PlanesAdminPanel — configuración de planes de suscripción (solo Admin).
 * - Crear / editar planes, mostrar u ocultar (sin borrar).
 * - Aprobar o rechazar solicitudes pendientes.
 */
import { useEffect, useState, useCallback } from 'react';

interface Plan {
  id: number;
  clave: string;
  nombre: string;
  descripcion: string;
  precio_usd: number;
  rol_otorgado: 'Usuario' | 'Crítico' | 'Grupo th';
  beneficios: string[];
  badge: string;
  destacado: boolean;
  requiere_aprobacion: boolean;
  activo: boolean;
  orden: number;
}

interface Solicitud {
  id: string;
  plan: string;
  precio_usd: number;
  precio_ves: number;
  ref_pago: string;
  usuario_nombre: string | null;
  usuario_email: string | null;
  usuario_rol: string | null;
}

interface FormPlan {
  id: number | null;
  nombre: string;
  descripcion: string;
  precio_usd: string;
  rol_otorgado: Plan['rol_otorgado'];
  badge: string;
  orden: string;
  beneficios: string;
  destacado: boolean;
  requiere_aprobacion: boolean;
  activo: boolean;
}

const FORM_VACIO: FormPlan = {
  id: null, nombre: '', descripcion: '', precio_usd: '0', rol_otorgado: 'Usuario',
  badge: '', orden: '99', beneficios: '', destacado: false, requiere_aprobacion: false, activo: true,
};

const th: React.CSSProperties = { padding: '0.75rem' };
const td: React.CSSProperties = { padding: '0.75rem' };
const label: React.CSSProperties = { fontSize: '0.8rem', color: 'var(--color-texto-suave)', display: 'block', marginBottom: '0.25rem' };

export function PlanesAdminPanel() {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [form, setForm] = useState<FormPlan | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [rp, rs] = await Promise.all([
        fetch('/api/planes?admin=true'),
        fetch('/api/suscripciones/pendientes'),
      ]);
      if (rp.ok) setPlanes(await rp.json());
      if (rs.ok) setSolicitudes(await rs.json());
    } catch (e: any) {
      setError('No se pudieron cargar los planes: ' + e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const editar = (p: Plan) => {
    setError('');
    setForm({
      id: p.id, nombre: p.nombre, descripcion: p.descripcion, precio_usd: String(p.precio_usd),
      rol_otorgado: p.rol_otorgado, badge: p.badge, orden: String(p.orden),
      beneficios: p.beneficios.join('\n'), destacado: p.destacado,
      requiere_aprobacion: p.requiere_aprobacion, activo: p.activo,
    });
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setGuardando(true);
    setError('');
    try {
      const payload = {
        nombre: form.nombre,
        descripcion: form.descripcion,
        precio_usd: Number(form.precio_usd),
        rol_otorgado: form.rol_otorgado,
        badge: form.badge,
        orden: Number(form.orden),
        beneficios: form.beneficios.split('\n'),
        destacado: form.destacado,
        requiere_aprobacion: form.requiere_aprobacion,
        activo: form.activo,
      };
      const res = await fetch(form.id ? `/api/planes/${form.id}` : '/api/planes', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar el plan.');
      setForm(null);
      await cargar();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const alternarVisible = async (p: Plan) => {
    setError('');
    const res = await fetch(`/api/planes/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !p.activo }),
    });
    if (!res.ok) setError((await res.json()).error || 'No se pudo cambiar la visibilidad.');
    await cargar();
  };

  const resolver = async (s: Solicitud, accion: 'aprobar' | 'rechazar') => {
    if (accion === 'rechazar' && !confirm('¿Rechazar esta solicitud?')) return;
    setError('');
    const res = await fetch(`/api/suscripciones/${encodeURIComponent(s.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion }),
    });
    if (!res.ok) setError((await res.json()).error || 'No se pudo resolver la solicitud.');
    await cargar();
  };

  const set = <K extends keyof FormPlan>(k: K, v: FormPlan[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div style={{ display: 'grid', gap: '2rem' }}>
      {error && <p style={{ color: '#ff8099', margin: 0 }}>⚠️ {error}</p>}

      {/* ===== Solicitudes pendientes ===== */}
      {solicitudes.length > 0 && (
        <div className="card">
          <h3 style={{ color: 'var(--color-primario)', marginBottom: '1rem' }}>⏳ Solicitudes pendientes ({solicitudes.length})</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-borde)', color: 'var(--color-primario)' }}>
                  <th style={th}>Usuario</th><th style={th}>Plan</th><th style={th}>Monto</th><th style={th}>Referencia</th>
                  <th style={{ ...th, textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={td}>
                      <strong style={{ display: 'block' }}>{s.usuario_nombre || '—'}</strong>
                      <small style={{ color: 'var(--color-texto-muted)' }}>{s.usuario_email} · {s.usuario_rol}</small>
                    </td>
                    <td style={td}>{s.plan}</td>
                    <td style={td}>${Number(s.precio_usd).toFixed(2)}<br /><small style={{ color: 'var(--color-texto-muted)' }}>Bs. {Number(s.precio_ves).toFixed(2)}</small></td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.ref_pago}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-primario" style={{ fontSize: '0.8rem', marginRight: '0.4rem' }} onClick={() => resolver(s, 'aprobar')}>Aprobar</button>
                      <button className="btn btn-secundario" style={{ fontSize: '0.8rem' }} onClick={() => resolver(s, 'rechazar')}>Rechazar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== Lista de planes ===== */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ color: 'var(--color-primario)', margin: 0 }}>💳 Planes de suscripción</h3>
          <button className="btn btn-primario" style={{ fontSize: '0.88rem' }} onClick={() => { setError(''); setForm({ ...FORM_VACIO }); }}>
            ➕ Nuevo plan
          </button>
        </div>

        {cargando ? (
          <p style={{ color: 'var(--color-texto-suave)' }}>Cargando…</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 760 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-borde)', color: 'var(--color-primario)' }}>
                  <th style={th}>Orden</th><th style={th}>Plan</th><th style={th}>Precio</th><th style={th}>Rol que otorga</th>
                  <th style={th}>Aprobación</th><th style={th}>Visible</th><th style={{ ...th, textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {planes.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', opacity: p.activo ? 1 : 0.55 }}>
                    <td style={td}>{p.orden}</td>
                    <td style={td}>
                      <strong style={{ display: 'block' }}>{p.nombre}{p.destacado ? ' ★' : ''}</strong>
                      <small style={{ color: 'var(--color-texto-muted)' }}>{p.badge}</small>
                    </td>
                    <td style={td}>{p.precio_usd === 0 ? 'Gratis' : `$${p.precio_usd.toFixed(2)}`}</td>
                    <td style={td}>{p.rol_otorgado}</td>
                    <td style={td}>{p.requiere_aprobacion ? 'Manual' : 'Automática'}</td>
                    <td style={td}>{p.activo ? '✅ Visible' : '🙈 Oculto'}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secundario" style={{ fontSize: '0.8rem', marginRight: '0.4rem' }} onClick={() => editar(p)}>Editar</button>
                      <button className="btn btn-secundario" style={{ fontSize: '0.8rem' }} onClick={() => alternarVisible(p)}>
                        {p.activo ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ color: 'var(--color-texto-muted)', fontSize: '0.78rem', marginTop: '1rem' }}>
          Ocultar un plan no afecta a quienes ya lo tienen: solo deja de ofrecerse a nuevos suscriptores. Un plan que otorga
          el rol Grupo th siempre exige aprobación manual.
        </p>
      </div>

      {/* ===== Formulario ===== */}
      {form && (
        <form onSubmit={guardar} className="card" style={{ display: 'grid', gap: '0.9rem' }}>
          <h3 style={{ color: 'var(--color-primario)', margin: 0 }}>{form.id ? 'Editar plan' : 'Nuevo plan'}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={label}>Nombre *</label>
              <input className="input" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} required maxLength={100} />
            </div>
            <div>
              <label style={label}>Precio (USD)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.precio_usd} onChange={(e) => set('precio_usd', e.target.value)} />
            </div>
            <div>
              <label style={label}>Rol que otorga</label>
              <select className="input" value={form.rol_otorgado} onChange={(e) => set('rol_otorgado', e.target.value as FormPlan['rol_otorgado'])}>
                <option value="Usuario">Usuario</option>
                <option value="Crítico">Crítico</option>
                <option value="Grupo th">Grupo th</option>
              </select>
            </div>
            <div>
              <label style={label}>Etiqueta (badge)</label>
              <input className="input" value={form.badge} onChange={(e) => set('badge', e.target.value)} maxLength={40} placeholder="Ej: Recomendado" />
            </div>
            <div>
              <label style={label}>Orden</label>
              <input className="input" type="number" value={form.orden} onChange={(e) => set('orden', e.target.value)} />
            </div>
          </div>

          <div>
            <label style={label}>Descripción</label>
            <input className="input" value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} maxLength={500} />
          </div>
          <div>
            <label style={label}>Beneficios (uno por línea, máx. 10)</label>
            <textarea className="input" rows={5} value={form.beneficios} onChange={(e) => set('beneficios', e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
            <label><input type="checkbox" checked={form.activo} onChange={(e) => set('activo', e.target.checked)} /> Visible para nuevos suscriptores</label>
            <label><input type="checkbox" checked={form.destacado} onChange={(e) => set('destacado', e.target.checked)} /> Destacado</label>
            <label>
              <input type="checkbox" checked={form.requiere_aprobacion || form.rol_otorgado === 'Grupo th'} disabled={form.rol_otorgado === 'Grupo th'}
                     onChange={(e) => set('requiere_aprobacion', e.target.checked)} /> Requiere aprobación de un Admin
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar plan'}</button>
            <button type="button" className="btn btn-secundario" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}