/**
 * Componente: Navbar
 * Barra de navegación principal con control dinámico de rutas según roles
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import styles from './Navbar.module.css';

export function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const pathname = usePathname();

  const navLinks = [
    { href: '/',         label: 'Inicio',      show: true },
    { href: '/cartelera',  label: 'Cartelera',   show: true },
    { href: '/cuenta',     label: 'Mi Cuenta',   show: isAuthenticated },
    { href: '/admin',      label: 'Administrar', show: isAdmin },
  ];

  const rolBadge: Record<string, string> = {
    'Admin':   '🎖️ Admin',
    'Crítico': '⭐ Crítico',
    'Usuario': '🎟️ Usuario',
  };

  return (
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

        {/* Área de usuario */}
        <div className={styles.userArea}>
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
  );
}