'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { authService } from '@/lib/auth';
import { api } from '@/lib/api';
import { useEffect, useRef, useState } from 'react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(authService.getUser());
  const [isLoading, setIsLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [pendingIncomingCount, setPendingIncomingCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

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

    const updateFavoritesCount = () => {
      if (typeof window !== 'undefined') {
        const savedFavorites = localStorage.getItem('favorite_products');
        if (savedFavorites) {
          try {
            const favoriteData = JSON.parse(savedFavorites);
            if (Array.isArray(favoriteData)) {
              setFavoritesCount(favoriteData.length);
            } else {
              setFavoritesCount(0);
            }
          } catch {
            setFavoritesCount(0);
          }
        } else {
          setFavoritesCount(0);
        }
      }
    };

    // Обновляем количество товаров в корзине
    updateCartCount();
    updateFavoritesCount();

    // Слушаем изменения в localStorage (для обновления корзины)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cart') {
        updateCartCount();
      }
      if (e.key === 'favorite_products') {
        updateFavoritesCount();
      }
    };

    // Слушаем кастомное событие обновления корзины
    const handleCartUpdate = () => {
      updateCartCount();
    };
    const handleFavoritesUpdate = () => {
      updateFavoritesCount();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('cart-updated', handleCartUpdate);
    window.addEventListener('favorites-updated', handleFavoritesUpdate);

    // Периодически проверяем корзину (на случай, если изменения происходят в том же окне)
    const cartInterval = setInterval(updateCartCount, 1000);
    const favoritesInterval = setInterval(updateFavoritesCount, 1000);

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthChange);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('cart-updated', handleCartUpdate);
      window.removeEventListener('favorites-updated', handleFavoritesUpdate);
      clearInterval(cartInterval);
      clearInterval(favoritesInterval);
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

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!profileMenuRef.current) return;
      if (profileMenuRef.current.contains(event.target as Node)) return;
      setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

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
      return pathname?.startsWith('/orders');
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

  const handleHeaderSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/products');
  };

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
          <div className="flex h-20 items-center gap-2">
            <div className="flex items-center gap-2">
              <Link
                href="/about"
                className="flex items-center px-2 py-2 text-lg font-semibold tracking-tight text-slate-800 sm:text-xl"
              >
                <img
                  src="/logo.png"
                  alt="абхазхаб"
                  className="mr-2 h-8 w-8 flex-shrink-0 rounded-md object-cover"
                />
                <span className="hidden sm:inline">абхазхаб</span>
              </Link>
              <Link
                href="/products"
                className="hidden rounded-xl bg-primary-dark px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary sm:inline-flex"
              >
                Каталог
              </Link>
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
            </div>

            <form onSubmit={handleHeaderSearch} className="hidden flex-1 items-center gap-2 sm:flex">
              <input
                type="text"
                value={headerSearchQuery}
                onChange={(e) => setHeaderSearchQuery(e.target.value)}
                placeholder="Искать в абхазхаб"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-light"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary"
                aria-label="Поиск"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2.4" />
                  <line x1="15.2" y1="15.2" x2="20.2" y2="20.2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </button>
            </form>

            <div className="hidden sm:flex items-center">
              {user ? (
                <div className="flex items-center space-x-2 sm:space-x-4">
                  {user.user_type === 'supplier' && (
                    <Link
                      href="/products/manage"
                      className={`rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:px-3 ${
                        isActive('/products/manage')
                          ? 'bg-primary-light text-primary-dark'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      Мои товары
                    </Link>
                  )}
                  <Link
                    href="/orders"
                    className={`relative rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:px-3 ${
                      isActive('/orders')
                        ? 'bg-primary-light text-primary-dark'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {user.user_type === 'supplier' ? 'Заказы' : 'Заказы'}
                    {user.user_type === 'supplier' && pendingIncomingCount > 0 && (
                      <span className="ml-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-amber-100 px-1 text-[10px] font-semibold text-amber-900">
                        {pendingIncomingCount}
                      </span>
                    )}
                  </Link>
                  {user.user_type === 'customer' && (
                    <Link
                      href="/favorites"
                      className={`relative rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:px-3 ${
                        isActive('/favorites')
                          ? 'bg-primary-light text-primary-dark'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      Избранное
                      {favoritesCount > 0 && (
                        <span className="ml-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-rose-100 px-1 text-[10px] font-semibold text-rose-900">
                          {favoritesCount}
                        </span>
                      )}
                    </Link>
                  )}
                  {user.user_type === 'customer' && (
                    <Link
                      href="/orders/new"
                      className={`relative inline-flex items-center rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:px-3 ${
                        pathname === '/orders/new'
                          ? 'bg-primary-light text-primary-dark'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="mr-1 sm:mr-2">🛒</span>
                      <span className="hidden md:inline">Корзина</span>
                      {cartCount > 0 && (
                        <span className="ml-2 hidden lg:inline text-xs font-semibold text-slate-600">
                          на {formatCartTotal(cartTotal)}
                        </span>
                      )}
                      {cartCount > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary-light px-1.5 py-0.5 text-xs font-semibold leading-none text-primary-dark sm:ml-2 sm:px-2 sm:py-1">
                          {cartCount}
                        </span>
                      )}
                    </Link>
                  )}
                  <div className="relative" ref={profileMenuRef}>
                    <button
                      type="button"
                      onClick={() => setProfileMenuOpen((prev) => !prev)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:px-3 ${
                        isActive('/profile')
                          ? 'bg-primary-light text-primary-dark'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      Профиль
                      <span className={`transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`}>▾</span>
                    </button>
                    {profileMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg z-50">
                        <Link
                          href="/profile"
                          className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => setProfileMenuOpen(false)}
                        >
                          Личный кабинет
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            handleLogout();
                          }}
                          className="block w-full px-4 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                        >
                          Выйти
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-2 sm:space-x-4">
                  {pathname === '/register' ? (
                    <Link
                      href="/login"
                      className="rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm bg-primary-dark text-white hover:bg-primary"
                    >
                      Войти
                    </Link>
                  ) : (
                  <Link
                    href="/register"
                    className="rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm bg-primary-dark text-white hover:bg-primary"
                  >
                    Регистрация
                  </Link>
                  )}
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
                    {(user.user_type === 'customer' || user.user_type === 'admin' || user.user_type === 'supplier') && (
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
                          href="/favorites"
                          className={`block rounded-lg px-3 py-2 text-base font-medium transition-colors ${
                            isActive('/favorites')
                              ? 'bg-primary-light text-primary-dark'
                              : 'text-slate-800 hover:bg-slate-50 hover:text-primary'
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          ⚑ Избранное {favoritesCount > 0 && `(${favoritesCount})`}
                        </Link>
                        <Link
                          href="/orders/new"
                          className={`block rounded-lg px-3 py-2 text-base font-medium transition-colors ${
                            pathname === '/orders/new'
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

