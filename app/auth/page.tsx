'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import styles from './page.module.css';

export default function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register' | 'reset'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const { login, loginWithGoogle, register, resetPassword } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true); setError(''); setMensaje('');
    const form = new FormData(e.currentTarget);
    const result = await login(form.get('email') as string, form.get('password') as string);
    if (result.success) {
      router.push('/');
    } else {
      setError(result.error || 'Credenciales incorrectas.');
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true); setError(''); setMensaje('');
    const form = new FormData(e.currentTarget);
    const result = await register(
      form.get('nombre') as string,
      form.get('email') as string,
      form.get('password') as string,
    );
    if (result.success) {
      setMensaje('¡Registro exitoso! Revisa tu correo para confirmar tu cuenta.');
      setTab('login');
    } else {
      setError(result.error || 'Error en el registro.');
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true); setError(''); setMensaje('');
    const form = new FormData(e.currentTarget);
    const email = form.get('email') as string;
    const result = await resetPassword(email);
    if (result.success) {
      setMensaje('Te hemos enviado un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada o spam.');
    } else {
      setError(result.error || 'No se pudo enviar el correo de recuperación.');
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true); setError('');
    const result = await loginWithGoogle();
    if (!result.success) {
      setError(result.error || 'Error con Google SSO.');
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.titulo}>🎭 Teatrando</h1>
          <p className={styles.slogan}>Vive la escena</p>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'login' ? styles.tabActivo : ''}`}
            onClick={() => { setTab('login'); setError(''); setMensaje(''); }}
          >
            Iniciar Sesión
          </button>
          <button
            className={`${styles.tab} ${tab === 'register' ? styles.tabActivo : ''}`}
            onClick={() => { setTab('register'); setError(''); setMensaje(''); }}
          >
            Registrarse
          </button>
        </div>

        {/* Mensajes */}
        {error   && <p className={styles.error}>⚠️ {error}</p>}
        {mensaje && <p className={styles.success}>✅ {mensaje}</p>}

        {/* Formulario Login */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className={styles.form}>
            <input name="email" type="email" placeholder="Correo electrónico"
              className="input" required autoComplete="email" />
            <input name="password" type="password" placeholder="Contraseña"
              className="input" required autoComplete="current-password" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.25rem' }}>
              <button
                type="button"
                onClick={() => { setTab('reset'); setError(''); setMensaje(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primario)',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  textDecoration: 'underline',
                  padding: 0
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <button type="submit" className="btn btn-primario" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </form>
        )}

        {/* Formulario Recuperación de Contraseña */}
        {tab === 'reset' && (
          <form onSubmit={handleResetPassword} className={styles.form}>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-texto-suave)', marginBottom: '0.5rem' }}>
              Ingresa tu correo electrónico registrado y te enviaremos las instrucciones para restablecer tu contraseña.
            </p>
            <input name="email" type="email" placeholder="Correo electrónico registrado"
              className="input" required autoComplete="email" />
            <button type="submit" className="btn btn-primario" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
              {loading ? 'Enviando enlace...' : 'Enviar Enlace de Recuperación'}
            </button>
            <button
              type="button"
              onClick={() => { setTab('login'); setError(''); setMensaje(''); }}
              className="btn btn-secundario"
              style={{ width: '100%', marginTop: '0.25rem' }}
            >
              ← Volver a Iniciar Sesión
            </button>
          </form>
        )}

        {/* Formulario Registro */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className={styles.form}>
            <input name="nombre" type="text" placeholder="Nombre completo"
              className="input" required autoComplete="name" />
            <input name="email" type="email" placeholder="Correo electrónico"
              className="input" required autoComplete="email" />
            <input name="password" type="password" placeholder="Contraseña (mín. 8 caracteres)"
              className="input" required minLength={8} autoComplete="new-password" />
            <button type="submit" className="btn btn-primario" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
              {loading ? 'Registrando...' : 'Crear Cuenta'}
            </button>
          </form>
        )}

        {/* Separador */}
        <div className={styles.separador}>
          <span className={styles.separadorTexto}>o continúa con</span>
        </div>

        {/* Google SSO */}
        <button onClick={handleGoogle} disabled={loading} className={`btn ${styles.btnGoogle}`}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuar con Google
        </button>
      </div>
    </main>
  );
}
