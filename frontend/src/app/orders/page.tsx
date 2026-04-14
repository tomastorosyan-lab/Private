'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { authService } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

interface Order {
  id: number;
  user_id: number;
  supplier_id: number;
  status: string;
  total_amount: string;
  delivery_address: string;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
  items: OrderItem[];
}

interface OrderItem {
  id: number;
  product_id: number;
  quantity: string;
  price: string;
  total: string;
}

const statusLabels: Record<string, string> = {
  pending: 'Ожидает обработки',
  confirmed: 'Подтвержден',
  processing: 'В обработке',
  shipped: 'Отправлен',
  delivered: 'Доставлен',
  cancelled: 'Отменен',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function OrdersPage() {
  const router = useRouter();
  const user = authService.getUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/login');
      return;
    }

    const currentUser = authService.getUser();
    // Поставщики и заказчики могут видеть заказы
    // API автоматически фильтрует заказы по типу пользователя
    if (currentUser && (currentUser.user_type === 'supplier' || currentUser.user_type === 'customer' || currentUser.user_type === 'admin')) {
      loadOrders();
    }
  }, [router]);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      // API автоматически фильтрует заказы по типу пользователя
      // Для поставщиков - только входящие (supplier_id = current_user.id)
      // Для заказчиков - только их заказы (user_id = current_user.id)
      const data = await api.getOrders({ limit: 100 });
      setOrders(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки заказов');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Загрузка заказов...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {user?.user_type === 'supplier' ? 'Входящие заказы' : 'Мои заказы'}
        </h1>
        {user && user.user_type !== 'supplier' && (
          <Link
            href="/orders/new"
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
          >
            Создать заказ
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Фильтр по статусам для истории заказов */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-gray-700">Фильтр по статусу:</span>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-md text-sm ${
              statusFilter === 'all'
                ? 'bg-primary-dark text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Все
          </button>
          {Object.entries(statusLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1 rounded-md text-sm ${
                statusFilter === key
                  ? 'bg-primary-dark text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {orders.filter(order => statusFilter === 'all' || order.status === statusFilter).length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500 mb-4">
            {user?.user_type === 'supplier' 
              ? 'У вас пока нет входящих заказов' 
              : 'У вас пока нет заказов'}
          </p>
          {user?.user_type === 'customer' && (
            <Link
              href="/orders/new"
              className="inline-block px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
            >
              Создать первый заказ
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Сумма
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Адрес доставки
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Телефон заказчика
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата создания
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders
                .filter(order => statusFilter === 'all' || order.status === statusFilter)
                .map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{order.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        statusColors[order.status] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {statusLabels[order.status] || order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                    {formatCurrency(order.total_amount)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {order.delivery_address}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {order.contact_phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link
                      href={`/orders/${order.id}`}
                      className="text-primary hover:text-blue-900"
                    >
                      Подробнее
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

