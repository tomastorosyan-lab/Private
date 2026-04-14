'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();
  const isAuthenticated = authService.isAuthenticated();
  const user = authService.getUser();

  useEffect(() => {
    // Если пользователь авторизован, перенаправляем на соответствующую страницу
    if (isAuthenticated && user) {
      if (user.user_type === 'supplier') {
        router.push('/products/manage');
      } else if (user.user_type === 'customer') {
        router.push('/products');
      }
      // Для admin оставляем на главной странице
    }
  }, [isAuthenticated, user, router]);

  return (
    <div className="space-y-10 sm:space-y-12">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="text-display font-semibold tracking-tight text-slate-900 text-balance sm:text-display-lg">
          DIS — агрегатор поставщиков
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
          B2B-платформа для закупок: каталог, заказы и поставщики в одном интерфейсе для
          магазинов и ресторанов.
        </p>
      </header>

      {isAuthenticated ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
          <Link href="/products" className="surface-card-hover group block p-6">
            <h2 className="mb-2 text-lg font-semibold tracking-tight text-slate-900 group-hover:text-primary-dark">
              Каталог товаров
            </h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Просмотр и поиск товаров от разных поставщиков
            </p>
          </Link>
          <Link href="/orders" className="surface-card-hover group block p-6">
            <h2 className="mb-2 text-lg font-semibold tracking-tight text-slate-900 group-hover:text-primary-dark">
              Мои заказы
            </h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Просмотр и управление вашими заказами
            </p>
          </Link>
          <Link href="/distributors" className="surface-card-hover group block p-6">
            <h2 className="mb-2 text-lg font-semibold tracking-tight text-slate-900 group-hover:text-primary-dark">
              Поставщики
            </h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Список доступных поставщиков
            </p>
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-md text-center">
          <div className="surface-card p-8 sm:p-10">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Вход в рабочую среду
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Войдите или зарегистрируйтесь, чтобы работать с каталогом и заказами.
            </p>
            <div className="mt-8 space-y-3">
              <Link
                href="/login"
                className="block w-full rounded-lg bg-primary-dark px-4 py-2.5 text-center text-sm font-medium text-white shadow-surface transition-colors hover:bg-primary"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="block w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-800 shadow-surface transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                Регистрация
              </Link>
            </div>
          </div>
        </div>
      )}

      <section className="surface-card p-6 sm:p-8">
        <h3 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
          Возможности платформы
        </h3>
        <ul className="mt-5 grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-2 sm:gap-4 sm:text-[0.9375rem]">
          <li className="flex gap-2.5">
            <span className="mt-0.5 shrink-0 font-semibold text-secondary" aria-hidden>
              ✓
            </span>
            <span>Поиск товаров от множества поставщиков</span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-0.5 shrink-0 font-semibold text-secondary" aria-hidden>
              ✓
            </span>
            <span>Сравнение цен и остатков</span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-0.5 shrink-0 font-semibold text-secondary" aria-hidden>
              ✓
            </span>
            <span>Удобное создание и отслеживание заказов</span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-0.5 shrink-0 font-semibold text-secondary" aria-hidden>
              ✓
            </span>
            <span>Интеграция с системами учёта</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

