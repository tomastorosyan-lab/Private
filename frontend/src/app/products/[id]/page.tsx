'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, type Product, type InventoryItem, type User } from '@/lib/api';
import { authService } from '@/lib/auth';
import Link from 'next/link';

function formatStockForCustomer(quantityRaw: string, itemsPerBox?: number | null): string {
  const quantity = Math.floor(parseFloat(quantityRaw) || 0);
  const boxSize = Math.max(1, Number(itemsPerBox) || 1);
  const threshold = boxSize * 10;
  return quantity > threshold ? 'много' : String(quantity);
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = Number(params.id);
  const [product, setProduct] = useState<Product | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [supplier, setSupplier] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProductData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [productData, inventoryData] = await Promise.all([
        api.getProduct(productId),
        api.getProductInventory(productId),
      ]);
      setProduct(productData);
      setInventory(inventoryData);

      if (inventoryData.length > 0) {
        const supplierData = await api.getDistributor(inventoryData[0].supplier_id);
        setSupplier(supplierData);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки товара');
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/login');
      return;
    }

    loadProductData();
  }, [router, loadProductData]);

  useEffect(() => {
    const onRefresh = () => {
      loadProductData();
    };
    window.addEventListener('products-catalog-refresh', onRefresh);
    return () => window.removeEventListener('products-catalog-refresh', onRefresh);
  }, [loadProductData]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Загрузка...</div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error || 'Товар не найден'}</p>
        <Link href="/products" className="text-primary hover:underline mt-2 inline-block">
          Вернуться к каталогу
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/products" className="text-primary hover:underline">
        ← Вернуться к каталогу
      </Link>

      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>
        
        {product.description && (
          <p className="text-gray-600 mb-4">{product.description}</p>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <span className="text-sm text-gray-500">Категория:</span>
            <span className="ml-2 text-gray-900">{product.category || 'Не указана'}</span>
          </div>
          <div>
            <span className="text-sm text-gray-500">Единица измерения:</span>
            <span className="ml-2 text-gray-900">{product.unit}</span>
          </div>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-xl font-semibold mb-4">Остатки у поставщиков</h2>
          {inventory.length === 0 ? (
            <p className="text-gray-500">Товар отсутствует на складах</p>
          ) : (
            <div className="space-y-4">
              {inventory.map((inv) => (
                <div
                  key={inv.id}
                  className="border border-gray-200 rounded-lg p-4 flex justify-between items-center"
                >
                  <div>
                    <div className="font-semibold">{supplier?.full_name || 'Поставщик'}</div>
                    <div className="text-sm text-gray-600">
                      В наличии: {formatStockForCustomer(inv.quantity, product.items_per_box)} {product.unit}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {parseFloat(inv.price).toFixed(2)} ₽
                    </div>
                    <div className="text-sm text-gray-500">за {product.unit}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

