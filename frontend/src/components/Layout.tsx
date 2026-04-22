'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { authService } from '@/lib/auth';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(authService.getUser());
  const [isLoading, setIsLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [pendingIncomingCount, setPendingIncomingCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = authService.getUser();
      // Если пользователь не найден, но есть токен, загружаем пользователя
      if (!currentUser && typeof window !== 'undefined') {
        const token = localStorage.getItem('auth_token');
        if (token) {
          try {
            // Загружаем пользователя из API
            const user = await authService.refreshUser();
            if (user) {
              setUser(user);
            }
          } catch {
            // Игнорируем ошибки
          }
        }
      } else {
        setUser(currentUser);
      }
      setIsLoading(false);
    };

    checkAuth();
    
    // Слушаем события изменения состояния аутентификации
    const handleAuthChange = () => {
      const currentUser = authService.getUser();
      setUser(currentUser);
    };
    
    window.addEventListener('auth-state-changed', handleAuthChange);
    
    // Обновляем при изменении пути
    const handlePathChange = () => {
      const currentUser = authService.getUser();
      setUser(currentUser);
    };
    
    // Проверяем состояние при изменении пути
    if (pathname) {
      handlePathChange();
    }

    // Функция для обновления количества товаров в корзине
    const updateCartCount = () => {
      if (typeof window !== 'undefined') {
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
          try {
            const cartData = JSON.parse(savedCart);
            // Проверяем, что это массив и он не пустой
            if (Array.isArray(cartData) && cartData.length > 0) {
              setCartCount(cartData.length);
              const total = cartData.reduce((sum: number, item: any) => {
                const price = Number(item?.price || 0);
                const quantity = Number(item?.quantity || 0);
                return sum + price * quantity;
              }, 0);
              setCartTotal(total);
            } else {
              setCartCount(0);
              setCartTotal(0);
            }
          } catch (e) {
            setCartCount(0);
            setCartTotal(0);
          }
        } else {
          setCartCount(0);
          setCartTotal(0);
        }
      }
    };

    // Обновляем количество товаров в корзине
    updateCartCount();

    // Слушаем изменения в localStorage (для обновления корзины)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cart') {
        updateCartCount();
      }
    };

    // Слушаем кастомное событие обновления корзины
    const handleCartUpdate = () => {
      updateCartCount();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('cart-updated', handleCartUpdate);

    // Периодически проверяем корзину (на случай, если изменения происходят в том же окне)
    const cartInterval = setInterval(updateCartCount, 1000);

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthChange);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('cart-updated', handleCartUpdate);
      clearInterval(cartInterval);
    };
  }, [pathname]); // Обновляем при изменении пути

  useEffect(() => {
    if (!user || user.user_type !== 'supplier') {
      setPendingIncomingCount(0);
      return;
    }
    let cancelled = false;
    const loadPending = async () => {
      try {
        const rows = await api.getOrders({ status: 'pending', limit: 500 });
        if (!cancelled) {
          setPendingIncomingCount(rows.length);
        }
      } catch {
        if (!cancelled) {
          setPendingIncomingCount(0);
        }
      }
    };
    loadPending();
    const interval = setInterval(loadPending, 60_000);
    const onOrdersChanged = () => {
      loadPending();
    };
    window.addEventListener('supplier-pending-orders-changed', onOrdersChanged);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('supplier-pending-orders-changed', onOrdersChanged);
    };
  }, [user?.id, user?.user_type, pathname]);

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    router.push('/login');
  };

  // Функция для проверки активного пункта меню
  const isActive = (href: string) => {
    if (href === '/products') {
      // Для каталога проверяем, что путь начинается с /products, но не /products/manage
      return pathname?.startsWith('/products') && !pathname?.startsWith('/products/manage');
    }
    if (href === '/products/manage') {
      return pathname?.startsWith('/products/manage');
    }
    if (href === '/orders') {
      // Для заказов проверяем, что путь начинается с /orders, но не /orders/new
      return pathname?.startsWith('/orders') && !pathname?.startsWith('/orders/new');
    }
    if (href === '/distributors') {
      return pathname === '/distributors';
    }
    if (href === '/profile') {
      return pathname === '/profile';
    }
    return pathname === href;
  };

  const formatCartTotal = (total: number) =>
    `${total.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;

  if (isLoading) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <p className="text-sm font-medium tracking-wide text-slate-500">
          Загрузка…
        </p>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200/90 bg-white/85 shadow-surface backdrop-blur-md supports-[backdrop-filter]:bg-white/75">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link 
                href="/about"
                className="flex items-center px-2 py-2 text-lg font-semibold tracking-tight text-slate-800 sm:text-xl"
              >
                <img 
                  src="/logo.svg" 
                  alt="Человек с блокнотом" 
                  className="mr-2 w-8 h-8 flex-shrink-0"
                />
                <span className="hidden sm:inline">DIS</span>
              </Link>
              {/* Мобильное меню кнопка */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden ml-2 inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-primary"
                aria-label="Меню"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {user && (
                  <>
                    {user.user_type === 'supplier' && (
                      <Link
                        href="/products/manage"
                        className={`relative z-10 inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium transition-colors ${
                          isActive('/products/manage')
                            ? 'border-primary text-primary-dark'
                            : 'border-transparent text-slate-700 hover:border-primary/40 hover:text-primary'
                        }`}
                      >
                        Мои товары
                      </Link>
                    )}
                    {user.user_type === 'customer' && (
                      <Link
                        href="/products"
                        className={`relative z-10 inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium transition-colors ${
                          isActive('/products')
                            ? 'border-primary text-primary-dark'
                            : 'border-transparent text-slate-700 hover:border-primary/40 hover:text-primary'
                        }`}
                      >
                        Каталог
                      </Link>
                    )}
                    <Link
                      href="/orders"
                      className={`relative inline-flex items-center gap-1.5 border-b-2 px-1 pt-1 text-sm font-medium transition-colors ${
                        isActive('/orders')
                          ? 'border-primary text-primary-dark'
                          : 'border-transparent text-slate-700 hover:border-primary/40 hover:text-primary'
                      }`}
                      aria-label={
                        user.user_type === 'supplier' && pendingIncomingCount > 0
                          ? `Входящие заказы, ожидают обработки: ${pendingIncomingCount}`
                          : undefined
                      }
                    >
                      <span>
                        {user.user_type === 'supplier' ? 'Входящие заказы' : 'Заказы'}
                      </span>
                      {user.user_type === 'supplier' && pendingIncomingCount > 0 && (
                        <span
                          className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-amber-900 ring-1 ring-amber-200/80"
                          title={`Ожидают обработки: ${pendingIncomingCount}`}
                        >
                          {pendingIncomingCount}
                        </span>
                      )}
                    </Link>
                    {user.user_type === 'customer' && (
                      <Link
                        href="/distributors"
                        className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium transition-colors ${
                          isActive('/distributors')
                            ? 'border-primary text-primary-dark'
                            : 'border-transparent text-slate-700 hover:border-primary/40 hover:text-primary'
                        }`}
                      >
                        Поставщики
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="hidden sm:flex items-center">
              {user ? (
                <div className="flex items-center space-x-2 sm:space-x-4">
                  {/* Индикатор корзины для заказчиков */}
                  {user.user_type === 'customer' && (
                    <Link
                      href="/orders/new"
                      className={`relative inline-flex items-center rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                        cartCount > 0
                          ? 'bg-secondary-light text-secondary-dark hover:bg-emerald-200/90'
                          : 'bg-primary-dark text-white hover:bg-primary'
                      }`}
                    >
                      <span className="mr-1 sm:mr-2">🛒</span>
                      <span className="hidden md:inline">Корзина</span>
                      {cartCount > 0 && (
                        <span className="ml-2 hidden lg:inline text-xs font-semibold text-secondary-dark/90">
                          на {formatCartTotal(cartTotal)}
                        </span>
                      )}
                      {cartCount > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center rounded-full bg-white/90 px-1.5 py-0.5 text-xs font-semibold leading-none text-secondary-dark sm:ml-2 sm:px-2 sm:py-1">
                          {cartCount}
                        </span>
                      )}
                    </Link>
                  )}
                  <Link
                    href="/profile"
                    className="max-w-[100px] truncate text-xs text-slate-600 hover:text-primary sm:max-w-none sm:text-sm"
                    title={user.full_name}
                  >
                    <span className="hidden md:inline">{user.full_name} </span>
                    <span className="text-xs">({user.user_type === 'supplier' ? 'Поставщик' : user.user_type === 'customer' ? 'Заказчик' : 'Админ'})</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="rounded-lg bg-rose-800/90 px-2 py-2 text-xs font-medium text-white shadow-sm ring-1 ring-rose-900/20 hover:bg-rose-800 sm:px-4 sm:text-sm"
                  >
                    <span className="hidden sm:inline">Выйти</span>
                    <span className="sm:hidden">✕</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <Link
                    href="/login"
                    className={`rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                      pathname === '/login'
                        ? 'bg-primary-dark text-white hover:bg-primary'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    Вход
                  </Link>
                  <Link
                    href="/register"
                    className={`rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                      pathname === '/register'
                        ? 'bg-primary-dark text-white hover:bg-primary'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    Регистрация
                  </Link>
                </div>
              )}
            </div>
          </div>
          
          {/* Мобильное меню */}
          {mobileMenuOpen && (
            <div className="border-t border-slate-200/90 sm:hidden">
              <div className="px-2 pt-2 pb-3 space-y-1">
                {user ? (
                  <>
                    {(user.user_type === 'customer' || user.user_type === 'admin') && (
                      <Link
                        href="/products"
                        className={`block rounded-lg px-3 py-2 text-base font-medium transition-colors ${
                          isActive('/products')
                            ? 'bg-primary-light text-primary-dark'
                            : 'text-slate-800 hover:bg-slate-50 hover:text-primary'
                        }`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Каталог
                      </Link>
                    )}
                    {user.user_type === 'supplier' && (
                      <Link
                        href="/products/manage"
                        className={`block rounded-lg px-3 py-2 text-base font-medium transition-colors ${
                          isActive('/products/manage')
                            ? 'bg-primary-light text-primary-dark'
                            : 'text-slate-800 hover:bg-slate-50 hover:text-primary'
                        }`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Мои товары
                      </Link>
                    )}
                    <Link
                      href="/orders"
                      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-base font-medium transition-colors ${
                        isActive('/orders')
                          ? 'bg-primary-light text-primary-dark'
                          : 'text-slate-800 hover:bg-slate-50 hover:text-primary'
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span>
                        {user.user_type === 'supplier' ? 'Входящие заказы' : 'Заказы'}
                      </span>
                      {user.user_type === 'supplier' && pendingIncomingCount > 0 && (
                        <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-900">
                          {pendingIncomingCount}
                        </span>
                      )}
                    </Link>
                    {user.user_type === 'customer' && (
                      <>
                        <Link
                          href="/orders/new"
                          className={`block rounded-lg px-3 py-2 text-base font-medium transition-colors ${
                            cartCount > 0
                              ? 'bg-secondary-light text-secondary-dark hover:bg-emerald-200/90'
                              : pathname === '/orders/new'
                              ? 'bg-primary-light text-primary-dark'
                              : 'text-slate-800 hover:bg-slate-50 hover:text-primary'
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          🛒 Корзина {cartCount > 0 && `(${cartCount})`}
                          {cartCount > 0 && ` на ${formatCartTotal(cartTotal)}`}
                        </Link>
                        <Link
                          href="/distributors"
                          className={`block rounded-lg px-3 py-2 text-base font-medium transition-colors ${
                            isActive('/distributors')
                              ? 'bg-primary-light text-primary-dark'
                              : 'text-slate-800 hover:bg-slate-50 hover:text-primary'
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Поставщики
                        </Link>
                      </>
                    )}
                    <Link
                      href="/profile"
                      className={`block rounded-lg px-3 py-2 text-base font-medium transition-colors ${
                        isActive('/profile')
                          ? 'bg-primary-light text-primary-dark'
                          : 'text-slate-800 hover:bg-slate-50 hover:text-primary'
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Профиль: {user.full_name}
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="block w-full rounded-lg bg-rose-800/90 px-3 py-2 text-left text-base font-medium text-white shadow-sm ring-1 ring-rose-900/20 hover:bg-rose-800"
                    >
                      Выйти
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="block rounded-lg px-3 py-2 text-base font-medium text-slate-800 hover:bg-slate-50 hover:text-primary"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Вход
                    </Link>
                    <Link
                      href="/register"
                      className="block rounded-lg px-3 py-2 text-base font-medium text-slate-800 hover:bg-slate-50 hover:text-primary"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Регистрация
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 pb-10 pt-24 sm:px-6 sm:pb-12 sm:pt-[5.5rem] lg:px-8">
        <div className="w-full overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}

