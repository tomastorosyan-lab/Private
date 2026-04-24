'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, Order, OrderItem, Product } from '@/lib/api';
import { authService } from '@/lib/auth';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

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
  confirmed: 'bg-primary-light text-primary-dark',
  processing: 'bg-purple-100 text-purple-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params.id);
  const [order, setOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Record<number, Product>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const user = authService.getUser();

  const getPackagingInfo = (item: OrderItem) => {
    const product = products[item.product_id];
    const itemsPerBox = product?.items_per_box && product.items_per_box > 0 ? product.items_per_box : null;
    const quantity = Number(item.quantity);
    if (!itemsPerBox || !Number.isFinite(quantity)) {
      return null;
    }
    const boxes = quantity / itemsPerBox;
    const roundedBoxes = Number.isInteger(boxes) ? boxes : Number(boxes.toFixed(2));
    return {
      boxes: roundedBoxes,
      itemsPerBox,
      unit: product?.unit || 'шт',
    };
  };

  const handlePrintShipmentDoc = () => {
    if (!order) return;
    const createdAt = new Date(order.created_at).toLocaleString('ru-RU');
    const rows = order.items
      .map((item, idx) => {
        const product = products[item.product_id];
        const productName = product?.name || `Товар #${item.product_id}`;
        const packaging = getPackagingInfo(item);
        const packagingText = packaging
          ? `${packaging.boxes} уп. (по ${packaging.itemsPerBox} ${packaging.unit})`
          : '—';
        return `
          <tr>
            <td>${idx + 1}</td>
            <td>${productName}</td>
            <td>${item.quantity}</td>
            <td>${packagingText}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${formatCurrency(item.total)}</td>
          </tr>
        `;
      })
      .join('');

    const html = `
      <!doctype html>
      <html lang="ru">
        <head>
          <meta charset="utf-8" />
          <title>Отгрузка по заказу #${order.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            .meta { margin-bottom: 16px; line-height: 1.5; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 13px; }
            th { background: #f3f4f6; }
            .total { margin-top: 16px; font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Документ на отгрузку</h1>
          <div class="meta">
            <div><strong>Заказ:</strong> #${order.id}</div>
            <div><strong>Дата заказа:</strong> ${createdAt}</div>
            <div><strong>Адрес доставки:</strong> ${order.delivery_address}</div>
            <div><strong>Телефон:</strong> ${order.contact_phone || 'не указан'}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>Товар</th>
                <th>Кол-во, ед.</th>
                <th>Кол-во, уп.</th>
                <th>Цена</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="total">Итого: ${formatCurrency(order.total_amount)}</div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      setError('Не удалось открыть окно печати. Разрешите всплывающие окна.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/login');
      return;
    }

    loadOrder();
  }, [orderId, router]);

  const loadOrder = async () => {
    try {
      setIsLoading(true);
      const data = await api.getOrder(orderId);
      setOrder(data);
      
      // Загружаем информацию о товарах
      if (data.items && data.items.length > 0) {
        const productIds = data.items.map(item => item.product_id);
        const uniqueProductIds = Array.from(new Set(productIds));
        
        // Загружаем информацию о каждом товаре
        const productPromises = uniqueProductIds.map(productId => 
          api.getProduct(productId).catch(() => null)
        );
        
        const productResults = await Promise.all(productPromises);
        const productsMap: Record<number, Product> = {};
        
        productResults.forEach((product, index) => {
          if (product) {
            productsMap[uniqueProductIds[index]] = product;
          }
        });
        
        setProducts(productsMap);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки заказа');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'confirmed' | 'cancelled') => {
    if (!order) return;
    
    if (newStatus === 'cancelled' && !confirm('Вы уверены, что хотите отказаться от заказа?')) {
      return;
    }

    try {
      setIsUpdating(true);
      setError('');
      const updatedOrder = await api.updateOrder(orderId, { status: newStatus });
      setOrder(updatedOrder);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('supplier-pending-orders-changed'));
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка обновления статуса заказа');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Загрузка заказа...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error || 'Заказ не найден'}</p>
        <Link href="/orders" className="text-primary hover:underline mt-2 inline-block">
          Вернуться к заказам
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/orders" className="text-primary hover:underline">
        ← Вернуться к заказам
      </Link>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Заказ #{order.id}</h1>
            <p className="text-gray-500 mt-2">
              Создан: {new Date(order.created_at).toLocaleString('ru-RU')}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
              statusColors[order.status] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {statusLabels[order.status] || order.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Информация о доставке</h2>
            <div className="text-gray-600 space-y-1">
              <p>{order.delivery_address}</p>
              {order.contact_phone && <p>Телефон: {order.contact_phone}</p>}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2">Общая сумма заказа</h2>
            <p className="text-3xl font-bold text-primary-dark">
              {formatCurrency(order.total_amount)}
            </p>
          </div>
        </div>

        {order.notes && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Примечания:</h3>
            <p className="text-gray-700">{order.notes}</p>
          </div>
        )}

        {/* Кнопки управления заказом для поставщиков */}
        {user?.user_type === 'supplier' && order.status === 'pending' && (
          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleUpdateStatus('confirmed')}
              disabled={isUpdating}
              className="flex-1 px-6 py-3 bg-secondary text-white rounded-md hover:bg-secondary-dark font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? 'Обработка...' : 'Принять заказ'}
            </button>
            <button
              onClick={() => handleUpdateStatus('cancelled')}
              disabled={isUpdating}
              className="flex-1 px-6 py-3 bg-red-500 text-white rounded-md hover:bg-red-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? 'Обработка...' : 'Отказаться от заказа'}
            </button>
          </div>
        )}
        {user?.user_type === 'supplier' && order.status !== 'cancelled' && (
          <div className="mb-6">
            <button
              onClick={handlePrintShipmentDoc}
              className="w-full sm:w-auto px-6 py-3 bg-primary-dark text-white rounded-md hover:bg-primary font-semibold"
            >
              Сформировать документ на отгрузку
            </button>
          </div>
        )}

        {/* Кнопка отмены заказа для заказчика */}
        {user?.user_type === 'customer' && order.user_id === user.id && order.status === 'pending' && (
          <div className="mb-6">
            <button
              onClick={() => handleUpdateStatus('cancelled')}
              disabled={isUpdating}
              className="w-full sm:w-auto px-6 py-3 bg-red-500 text-white rounded-md hover:bg-red-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? 'Обработка...' : 'Отменить заказ'}
            </button>
            <p className="mt-2 text-sm text-gray-500">
              Вы можете отменить заказ до того, как поставщик его подтвердит
            </p>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold mb-4">Позиции заказа</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Товар
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Количество
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Упаковок к отгрузке
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Цена
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Сумма
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {products[item.product_id]?.name || `Товар #${item.product_id}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(() => {
                        const packaging = getPackagingInfo(item);
                        if (!packaging) return '—';
                        return `${packaging.boxes} уп.`;
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(item.price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

