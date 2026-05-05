'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authService.login(email, password);
      const next = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('next')
        : null;
      router.push(next && next.startsWith('/') ? next : '/products');
    } catch (err: any) {
      setError(err.message || 'Ошибка входа. Проверьте email и пароль.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center py-6 sm:min-h-[min(32rem,calc(100vh-8rem))] sm:py-10">
      <div className="surface-card space-y-8 p-6 sm:p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Авторизация
          </h2>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-lg border border-red-200/80 bg-red-50/90 p-4 backdrop-blur-sm">
              <p className="text-sm leading-snug text-red-800">{error}</p>
            </div>
          )}
          <div className="-space-y-px rounded-lg shadow-sm">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative z-10 block w-full rounded-t-lg border border-slate-200 px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:z-20 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Пароль
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full rounded-b-lg border border-slate-200 px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:z-20 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="text-right">
            <Link
              href="/password-reset"
              className="text-sm font-medium text-primary hover:text-primary-dark"
            >
              Забыли пароль?
            </Link>
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full justify-center rounded-lg border border-transparent bg-primary-dark px-4 py-2.5 text-sm font-medium text-white shadow-surface transition-colors hover:bg-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading ? 'Вход…' : 'Войти'}
            </button>
            <Link
              href="/register"
              className="flex w-full justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Регистрация
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}




