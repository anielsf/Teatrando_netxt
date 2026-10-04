/**
 * lib/planes.ts — acceso a la tabla public.planes
 */
import { query } from '@/lib/db';

export type RolPlan = 'Usuario' | 'Crítico' | 'Grupo th';
export const ROLES_PLAN: RolPlan[] = ['Usuario', 'Crítico', 'Grupo th'];
export const PLAN_BASE = 'Plan Básico (Gratis)'; // lo usa el trigger de registro: no se puede ocultar

export interface Plan {
  id: number;
  clave: string;
  nombre: string;
  descripcion: string;
  precio_usd: number;
  rol_otorgado: RolPlan;
  beneficios: string[];
  badge: string;
  destacado: boolean;
  requiere_aprobacion: boolean;
  activo: boolean;
  orden: number;
}

const COLUMNAS = `id, clave, nombre, descripcion, precio_usd, rol_otorgado, beneficios,
  badge, destacado, requiere_aprobacion, activo, orden`;

function normalizar(r: any): Plan {
  return {
    ...r,
    precio_usd: Number(r.precio_usd),
    beneficios: Array.isArray(r.beneficios) ? r.beneficios : [],
  };
}

export async function listarPlanes(soloActivos = true): Promise<Plan[]> {
  const rows = await query(
    `SELECT ${COLUMNAS} FROM public.planes
     ${soloActivos ? 'WHERE activo = true' : ''}
     ORDER BY orden ASC, id ASC`
  );
  return rows.map(normalizar);
}

export async function obtenerPlan(clave: string): Promise<Plan | null> {
  const rows = await query(`SELECT ${COLUMNAS} FROM public.planes WHERE clave = $1`, [clave]);
  return rows[0] ? normalizar(rows[0]) : null;
}

/** Rol final del usuario al activar un plan. Admin y Grupo th asignados a mano no se rebajan. */
export function rolResultante(rolActual: string, rolPlan: string): string {
  if (rolActual === 'Admin') return 'Admin';
  if (rolActual === 'Grupo th' && rolPlan !== 'Grupo th') return rolActual;
  return rolPlan;
}

/** Valida y normaliza el cuerpo enviado desde el panel. */
export function validarPlan(
  body: any,
  parcial: boolean
): { ok: true; datos: Record<string, any> } | { ok: false; error: string } {
  const d: Record<string, any> = {};
  const tiene = (k: string) => body[k] !== undefined;

  if (!parcial || tiene('nombre')) {
    const n = String(body.nombre ?? '').trim();
    if (!n || n.length > 100) return { ok: false, error: 'El nombre es obligatorio (máx. 100 caracteres).' };
    d.nombre = n;
  }
  if (tiene('descripcion')) d.descripcion = String(body.descripcion).trim().slice(0, 500);
  if (tiene('badge')) d.badge = String(body.badge).trim().slice(0, 40);

  if (tiene('precio_usd')) {
    const p = Number(body.precio_usd);
    if (!Number.isFinite(p) || p < 0 || p > 10000) return { ok: false, error: 'Precio USD inválido.' };
    d.precio_usd = Math.round(p * 100) / 100;
  }
  if (tiene('rol_otorgado')) {
    if (!ROLES_PLAN.includes(body.rol_otorgado)) return { ok: false, error: 'Rol otorgado no válido.' };
    d.rol_otorgado = body.rol_otorgado;
  }
  if (tiene('beneficios')) {
    const lista = Array.isArray(body.beneficios) ? body.beneficios : String(body.beneficios).split('\n');
    d.beneficios = lista.map((b: any) => String(b).trim().slice(0, 200)).filter(Boolean).slice(0, 10);
  }
  if (tiene('orden')) {
    const o = Number.parseInt(body.orden, 10);
    if (!Number.isFinite(o)) return { ok: false, error: 'Orden inválido.' };
    d.orden = o;
  }
  for (const k of ['destacado', 'requiere_aprobacion', 'activo']) {
    if (tiene(k)) d[k] = Boolean(body[k]);
  }
  return { ok: true, datos: d };
}