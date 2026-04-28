'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const validateEmail = (email: string): string | null => {
  if (!email) return 'Email обязателен для заполнения';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Введите корректный email адрес';
  return null;
};

const validatePassword = (password: string): string | null => {
  if (!password) return 'Пароль обязателен для заполнения';
  if (password.length < 8) return 'Пароль должен содержать минимум 8 символов';
  return null;
};

export default function PasswordResetPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const normalizedEmail = email.trim().toLowerCase();

  const handleSendCode = async () => {
    setError('');
    setInfo('');
    const emailError = validateEmail(normalizedEmail);
    if (emailError) {
      setError(emailError);
      return;
    }

    try {
      setIsLoading(true);
      const result = await api.sendPasswordResetCode(normalizedEmail);
      setCodeSent(true);
      setInfo(result.message || 'Код сброса отправлен на почту');
    } catch (err: any) {
      setError(err.message || 'Не удалось отправить код сброса');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setInfo('');

    const emailError = validateEmail(normalizedEmail);
    if (emailError) {
      setError(emailError);
      return;
    }
    if (!code || code.trim().length !== 6) {
      setError('Введите 6-значный код из письма');
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== passwordConfirm) {
      setError('Пароли не совпадают');
      return;
    }

    try {
      setIsLoading(true);
      await api.resetPassword(normalizedEmail, code.trim(), password, passwordConfirm);
      setInfo('Пароль успешно изменен. Сейчас откроется вход.');
      setTimeout(() => router.push('/login'), 1200);
    } catch (err: any) {
      setError(err.message || 'Не удалось изменить пароль');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center py-6 sm:min-h-[min(34rem,calc(100vh-8rem))] sm:py-10">
      <div className="surface-card space-y-8 p-6 sm:p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Сброс пароля
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Вспомнили пароль?{' '}
            <Link href="/login" className="font-medium text-primary hover:text-primary-dark">
              Войти
            </Link>
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleReset}>
          {error && (
            <div className="rounded-lg border border-red-200/80 bg-red-50/90 p-4 backdrop-blur-sm">
              <p className="text-sm leading-snug text-red-800">{error}</p>
            </div>
          )}
          {info && (
            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/90 p-4 backdrop-blur-sm">
              <p className="text-sm leading-snug text-emerald-800">{info}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm"
                placeholder="email@example.com"
              />
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <button
                type="button"
                onClick={handleSendCode}
                disabled={isLoading}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {codeSent ? 'Отправить код снова' : 'Отправить код сброса'}
              </button>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Код из письма"
              />
              <p className="text-xs text-slate-600">
                Код действует ограниченное время. Если письма нет, проверьте папку «Спам».
              </p>
            </div>

            <div>
              <label htmlFor="reset-password" className="block text-sm font-medium text-slate-700">
                Новый пароль
              </label>
              <input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm"
                placeholder="Минимум 8 символов"
              />
            </div>

            <div>
              <label htmlFor="reset-password-confirm" className="block text-sm font-medium text-slate-700">
                Повторите пароль
              </label>
              <input
                id="reset-password-confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm"
                placeholder="Введите новый пароль еще раз"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full justify-center rounded-lg border border-transparent bg-primary-dark px-4 py-2.5 text-sm font-medium text-white shadow-surface transition-colors hover:bg-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
          >
            {isLoading ? 'Сохраняем…' : 'Изменить пароль'}
          </button>
        </form>
      </div>
    </div>
  );
}
