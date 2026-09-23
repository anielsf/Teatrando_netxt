/**
 * Componente: Navbar
 * Barra de navegación principal con control dinámico de rutas según roles
 * Incluye botón de Suscripciones & Membresías VIP visible para todos los usuarios
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import styles from './Navbar.module.css';

export function Navbar() {
  const { user, isAuthenticated, isAdmin, isGrupoTH, logout } = useAuth();
  const pathname = usePathname();
  const [modalSuscripcionOpen, setModalSuscripcionOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Inicio', show: true },
    { href: '/cartelera', label: 'Cartelera', show: true },
    { href: '/cuenta', label: 'Mi Cuenta', show: isAuthenticated },
    { href: '/admin', label: isAdmin ? 'Administrar' : 'Gestión Grupo TH', show: isAdmin || isGrupoTH },
  ];

  const rolBadge: Record<string, string> = {
    'Admin': '🎖️ Admin',
    'Crítico': '⭐ Crítico',
    'Grupo th': '🎭 Grupo TH',
    'Usuario': '🎟️ Usuario',
  };

  return (
    <>
      <nav className={styles.navbar}>
        <div className={styles.contenedor}>
          {/* Logo */}
          <Link href="/" className={styles.logo}>
            🎭 <span>Teatrando</span>
          </Link>

          {/* Links de navegación */}
          <ul className={styles.navLinks}>
            {navLinks
              .filter((l) => l.show)
              .map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`${styles.navLink} ${pathname === link.href ? styles.activo : ''}`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
          </ul>

          {/* Área de usuario y botón de suscripción */}
          <div className={styles.userArea}>
            {/* Botón de Suscripciones visible para todos */}
            <button
              onClick={() => setModalSuscripcionOpen(true)}
              style={{
                background: 'rgba(212, 175, 55, 0.12)',
                border: '1px solid #d4af37',
                color: '#d4af37',
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.2s ease',
              }}
              title="Ver planes de membresía y beneficios VIP"
            >
              ★ <span>Suscripciones & VIP</span>
            </button>

            {isAuthenticated && user ? (
              <>
                <span className={styles.userBadge}>
                  {rolBadge[user.rol] || user.rol}
                </span>
                <span className={styles.userName}>{user.nombre}</span>
                <button onClick={logout} className={`btn btn-secundario ${styles.btnLogout}`}>
                  Salir
                </button>
              </>
            ) : (
              <Link href="/auth" className="btn btn-primario">
                Iniciar Sesión
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Modal interactivo de Suscripciones */}
      <SubscriptionModal
        isOpen={modalSuscripcionOpen}
        onClose={() => setModalSuscripcionOpen(false)}
      />
    </>
  );
}