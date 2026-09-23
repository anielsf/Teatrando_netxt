'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import styles from '../page.module.css';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const { updatePassword } = useAuth();
  const router = useRouter();

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    setError('');
    setMensaje('');

    const result = await updatePassword(password);
    if (result.success) {
      setMensaje('¡Contraseña actualizada con éxito! Redirigiendo a tu cuenta...');
      setTimeout(() => {
        router.push('/cuenta');
      }, 2000);
    } else {
      setError(result.error || 'No se pudo actualizar la contraseña. El enlace puede haber expirado.');
    }
    setLoading(false);
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.titulo}>🔒 Nueva Contraseña</h1>
          <p className={styles.slogan}>Restablece tu acceso a Teatrando</p>
        </div>

        {error && <p className={styles.error}>⚠️ {error}</p>}
        {mensaje && <p className={styles.success}>✅ {mensaje}</p>}

        <form onSubmit={handleUpdate} className={styles.form}>
          <input
            type="password"
            placeholder="Nueva contraseña (mín. 8 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            required
            minLength={8}
            autoComplete="new-password"
          />

          <input
            type="password"
            placeholder="Confirma tu nueva contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input"
            required
            minLength={8}
            autoComplete="new-password"
          />

          <button
            type="submit"
            className="btn btn-primario"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {loading ? 'Guardando contraseña...' : 'Actualizar Contraseña'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/auth')}
            className="btn btn-secundario"
            style={{ width: '100%', marginTop: '0.25rem' }}
          >
            Volver al Login
          </button>
        </form>
      </div>
    </main>
  );
}
