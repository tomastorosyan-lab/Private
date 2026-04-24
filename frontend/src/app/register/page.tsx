'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/lib/auth';
import { api } from '@/lib/api';

// Функции валидации
const validateEmail = (email: string): string | null => {
  if (!email) return 'Email обязателен для заполнения';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Введите корректный email адрес (например: user@example.com)';
  }
  return null;
};

const validatePhone = (phone: string): string | null => {
  if (!phone) return null; // Телефон не обязателен
  // Формат: +7XXXXXXXXXX или 8XXXXXXXXXX или +375XXXXXXXXX и т.д.
  const phoneRegex = /^(\+?[1-9]\d{1,14}|8\d{10})$/;
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, ''); // Убираем пробелы, дефисы, скобки
  if (!phoneRegex.test(cleanPhone)) {
    return 'Введите корректный номер телефона (например: +79991234567 или 89991234567)';
  }
  return null;
};

const validateFullName = (name: string): string | null => {
  if (!name) return 'Имя обязательно для заполнения';
  if (name.length < 2) return 'Имя должно содержать минимум 2 символа';
  // Только буквы, пробелы, дефисы, апострофы (для имен типа О'Брайен)
  const nameRegex = /^[a-zA-Zа-яА-ЯёЁ\s\-'']+$/;
  if (!nameRegex.test(name)) {
    return 'Имя может содержать только буквы, пробелы, дефисы и апострофы';
  }
  return null;
};

const validatePassword = (password: string): string | null => {
  if (!password) return 'Пароль обязателен для заполнения';
  if (password.length < 8) return 'Пароль должен содержать минимум 8 символов';
  return null;
};

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    user_type: 'customer' as 'supplier' | 'customer',
  });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  const handleSendCode = async () => {
    setError('');
    setInfo('');
    const emailError = validateEmail(formData.email);
    if (emailError) {
      setFieldErrors((prev) => ({ ...prev, email: emailError }));
      return;
    }
    try {
      setIsLoading(true);
      const result = await api.sendRegisterCode(formData.email.trim().toLowerCase());
      const verificationRequired = result.verification_required !== false;
      setCodeSent(verificationRequired);
      setIsEmailVerified(!verificationRequired);
      setInfo(result.message || (verificationRequired ? 'Код отправлен на указанную почту' : 'Можно завершить регистрацию без кода'));
    } catch (err: any) {
      setError(err.message || 'Не удалось отправить код');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmCode = async () => {
    setError('');
    setInfo('');
    if (!verificationCode || verificationCode.trim().length !== 6) {
      setError('Введите 6-значный код из письма');
      return;
    }
    try {
      setIsLoading(true);
      await api.confirmRegisterCode(formData.email.trim().toLowerCase(), verificationCode.trim());
      setIsEmailVerified(true);
      setInfo('Email подтвержден. Теперь можно завершить регистрацию.');
    } catch (err: any) {
      setError(err.message || 'Неверный код подтверждения');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Валидация всех полей
    const errors: Record<string, string> = {};
    const emailError = validateEmail(formData.email);
    if (emailError) errors.email = emailError;
    
    const nameError = validateFullName(formData.full_name);
    if (nameError) errors.full_name = nameError;
    
    const passwordError = validatePassword(formData.password);
    if (passwordError) errors.password = passwordError;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      if (!isEmailVerified) {
        setError('Сначала подтвердите email 6-значным кодом');
        setIsLoading(false);
        return;
      }
      await api.register({
        ...formData,
        email: formData.email.trim().toLowerCase(),
      });
      await authService.login(formData.email.trim().toLowerCase(), formData.password);
      router.push('/products');
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации. Попробуйте еще раз.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md py-6 sm:py-10">
      <div className="surface-card space-y-8 p-6 sm:p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Регистрация
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Уже есть аккаунт?{' '}
            <Link
              href="/login"
              className="font-medium text-primary hover:text-primary-dark"
            >
              Войти
            </Link>
          </p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
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
              <label htmlFor="full_name" className="block text-sm font-medium text-slate-700">
                Полное имя
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm ${
                  fieldErrors.full_name ? 'border-red-300' : 'border-slate-200'
                }`}
                placeholder="Название компании или ФИО"
                value={formData.full_name}
                onChange={(e) => {
                  setFormData({ ...formData, full_name: e.target.value });
                  if (fieldErrors.full_name) {
                    setFieldErrors({ ...fieldErrors, full_name: '' });
                  }
                }}
              />
              {fieldErrors.full_name && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.full_name}</p>
              )}
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm ${
                  fieldErrors.email ? 'border-red-300' : 'border-slate-200'
                }`}
                placeholder="email@example.com"
                value={formData.email}
                disabled={isEmailVerified}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  setIsEmailVerified(false);
                  setCodeSent(false);
                  setVerificationCode('');
                  if (fieldErrors.email) {
                    setFieldErrors({ ...fieldErrors, email: '' });
                  }
                }}
              />
              {fieldErrors.email && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
              )}
            </div>
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={isLoading || isEmailVerified}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  {codeSent ? 'Отправить код снова' : 'Отправить код'}
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Код из письма"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  disabled={isEmailVerified}
                  className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleConfirmCode}
                  disabled={isLoading || isEmailVerified || !codeSent}
                  className="rounded-lg bg-primary-dark px-3 py-2 text-sm font-medium text-white hover:bg-primary disabled:opacity-50"
                >
                  Подтвердить
                </button>
              </div>
              <p className="text-xs text-slate-600">
                Для завершения регистрации нужно подтвердить email 6-значным кодом.
              </p>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Пароль
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm ${
                  fieldErrors.password ? 'border-red-300' : 'border-slate-200'
                }`}
                placeholder="Минимум 8 символов"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (fieldErrors.password) {
                    setFieldErrors({ ...fieldErrors, password: '' });
                  }
                }}
              />
              {fieldErrors.password && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
              )}
            </div>
            <div>
              <label htmlFor="user_type" className="block text-sm font-medium text-slate-700">
                Тип пользователя
              </label>
              <select
                id="user_type"
                name="user_type"
                required
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm"
                value={formData.user_type}
                onChange={(e) => setFormData({ ...formData, user_type: e.target.value as any })}
              >
                <option value="customer">Заказчик</option>
                <option value="supplier">Поставщик</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full justify-center rounded-lg border border-transparent bg-primary-dark px-4 py-2.5 text-sm font-medium text-white shadow-surface transition-colors hover:bg-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
          >
            {isLoading ? 'Регистрация…' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>
    </div>
  );
}

