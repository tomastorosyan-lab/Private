'use client';

import { useEffect, useState } from 'react';
import { api, type User } from '@/lib/api';
import { getPublicApiBase } from '@/lib/publicBase';
import { authService } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DistributorsPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/login');
      return;
    }

    loadDistributors();
  }, [router]);

  const loadDistributors = async () => {
    try {
      setIsLoading(true);
      const data = await api.getDistributors({ limit: 100 });
      setSuppliers(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки поставщиков');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Загрузка поставщиков...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Поставщики</h1>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {suppliers.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500">Поставщики не найдены</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="relative flex h-full min-h-[260px] flex-col bg-white p-6 pb-[4.5rem] shadow rounded-lg transition-shadow hover:shadow-lg"
            >
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
                {/* Логотип поставщика */}
                <div className="mb-4 flex shrink-0 justify-center">
                  {supplier.logo_url ? (
                    <img
                      src={`${getPublicApiBase()}${supplier.logo_url}`}
                      alt={supplier.full_name}
                      className="h-24 w-24 rounded-lg border border-gray-200 bg-white object-contain p-2"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
                      <span className="text-3xl text-gray-400">🏢</span>
                    </div>
                  )}
                </div>

                <h3 className="mb-2 shrink-0 text-center text-xl font-semibold text-gray-900">
                  {supplier.full_name}
                </h3>

                {supplier.description && (
                  <p className="mb-4 text-gray-600">{supplier.description}</p>
                )}

                <div className="space-y-2 text-sm text-gray-500">
                  <p className="leading-snug">Email: {supplier.email}</p>
                  <p className="min-h-5 leading-snug">
                    Телефон: {supplier.contact_phone || '\u00A0'}
                  </p>
                </div>
              </div>

              <div className="absolute inset-x-6 bottom-6">
                <Link
                  href={`/products?supplier_id=${supplier.id}`}
                  className="block rounded-md bg-primary px-4 py-2 text-center text-sm text-white hover:bg-primary-dark"
                >
                  Посмотреть товары
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

