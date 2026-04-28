'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { authService } from '@/lib/auth';
import { getPublicApiBase } from '@/lib/publicBase';

interface Product {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  image_url?: string | null;
  items_per_box?: number | null;
  supplier_id: number;
}

interface Supplier {
  id: number;
  full_name: string;
  logo_url?: string | null;
}

interface Inventory {
  id: number;
  product_id: number;
  supplier_id: number;
  quantity: string;
  price: string;
}

function formatStockForCustomer(quantityRaw: string, itemsPerBox?: number | null): string {
  const quantity = Math.floor(parseFloat(quantityRaw) || 0);
  const boxSize = Math.max(1, Number(itemsPerBox) || 1);
  const threshold = boxSize * 10;
  return quantity > threshold ? 'много' : String(quantity);
}

function inventoryRowForProduct(invList: Inventory[], product: Product): Inventory | undefined {
  return invList.find(
    (inv) => Number(inv.product_id) === Number(product.id) && Number(inv.supplier_id) === Number(product.supplier_id),
  );
}

export default function FavoritesPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [productQuantities, setProductQuantities] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const user = authService.getUser();
    if (user?.user_type === 'supplier') {
      router.push('/products/manage');
      return;
    }

    const raw = localStorage.getItem('favorite_products');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setFavoriteIds(parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id)));
        }
      } catch {
        setFavoriteIds([]);
      }
    }
  }, [router]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [productsData, suppliersData] = await Promise.all([
          api.getProducts({ limit: 1000 }),
          api.getDistributors({ limit: 100 }),
        ]);
        setProducts(productsData);
        setSuppliers(suppliersData);

        const inventoryPromises = suppliersData.map((supplier: Supplier) =>
          api.getSupplierInventory(supplier.id).catch(() => []),
        );
        const inventoryArrays = await Promise.all(inventoryPromises);
        setInventory(inventoryArrays.flat());
      } catch (err: any) {
        setError(err.message || 'Ошибка загрузки избранного');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const favoriteProducts = useMemo(
    () => products.filter((product) => favoriteIds.includes(product.id)),
    [products, favoriteIds],
  );

  const removeFavorite = (productId: number) => {
    const updated = favoriteIds.filter((id) => id !== productId);
    setFavoriteIds(updated);
    localStorage.setItem('favorite_products', JSON.stringify(updated));
    window.dispatchEvent(new Event('favorites-updated'));
  };

  const addToCart = (product: Product, quantity: number = 1) => {
    const productInventory = inventoryRowForProduct(inventory, product);
    if (!productInventory) {
      setError('Товар недоступен для добавления в корзину');
      return;
    }
    if (parseFloat(productInventory.quantity) <= 0) {
      setError('Товар недоступен для добавления в корзину');
      return;
    }
    if (quantity <= 0) {
      setError('Количество должно быть больше нуля');
      return;
    }
    const itemsPerBox = product.items_per_box || 1;
    const availableQuantity = parseFloat(productInventory.quantity);
    if (itemsPerBox > 1 && quantity % itemsPerBox !== 0) {
      const boxes = Math.floor(quantity / itemsPerBox);
      const correctQuantity = boxes * itemsPerBox;
      setError(`Количество должно быть кратно упаковке (${itemsPerBox} ${product.unit}). Используйте ${correctQuantity} ${product.unit} (${boxes} уп.)`);
      return;
    }
    if (quantity > availableQuantity) {
      setError(`Доступно только ${availableQuantity} ${product.unit}`);
      return;
    }

    const existingCart = localStorage.getItem('cart');
    let cart: any[] = [];
    if (existingCart) {
      try {
        cart = JSON.parse(existingCart);
      } catch {
        cart = [];
      }
    }

    const idx = cart.findIndex((item) => Number(item.product.id) === Number(product.id));
    if (idx >= 0) {
      const nextQuantity = cart[idx].quantity + quantity;
      if (nextQuantity > availableQuantity) {
        setError(`Максимальное количество: ${availableQuantity} ${product.unit}`);
        return;
      }
      cart[idx].quantity = nextQuantity;
    } else {
      cart.push({
        product: {
          id: product.id,
          name: product.name,
          unit: product.unit,
          category: product.category,
          items_per_box: product.items_per_box,
          supplier_id: product.supplier_id,
        },
        inventory: {
          id: productInventory.id,
          product_id: productInventory.product_id,
          quantity: productInventory.quantity,
          price: productInventory.price,
        },
        quantity: quantity,
        price: parseFloat(productInventory.price),
      });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cart-updated'));
    setError('');
    setProductQuantities((prev) => {
      const next = { ...prev };
      delete next[product.id];
      return next;
    });
  };

  if (isLoading) {
    return <div className="text-lg">Загрузка избранного...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Избранные товары</h1>
        <span className="text-sm text-gray-500">Всего: {favoriteProducts.length}</span>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {favoriteProducts.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <p className="text-gray-600 mb-4">Список избранного пока пуст.</p>
          <Link
            href="/products"
            className="inline-flex items-center rounded-md bg-primary-dark px-4 py-2 text-sm font-medium text-white hover:bg-primary"
          >
            Перейти в каталог
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          {favoriteProducts.map((product) => {
            const productInventory = inventoryRowForProduct(inventory, product);
            const supplier = suppliers.find((s) => Number(s.id) === Number(product.supplier_id));
            return (
              <div
                key={product.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-row items-stretch min-h-[120px]"
              >
                {product.image_url ? (
                  <div className="w-24 sm:w-28 md:w-32 shrink-0 self-stretch relative overflow-hidden bg-gray-100 border-r border-gray-200">
                    <img
                      src={`${getPublicApiBase()}${product.image_url}`}
                      alt={product.name}
                      className="h-full w-full min-h-[120px] object-cover object-center"
                    />
                  </div>
                ) : (
                  <div className="w-24 sm:w-28 md:w-32 shrink-0 self-stretch min-h-[120px] bg-gray-50 border-r border-gray-100" />
                )}

                <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => removeFavorite(product.id)}
                        aria-label="Убрать из избранного"
                        title="Убрать из избранного"
                        className="text-base leading-none mt-0.5 text-red-500 hover:text-red-600"
                      >
                        ⚑
                      </button>
                      <h3 className="text-sm font-bold text-gray-900 flex-1 line-clamp-2 leading-tight">{product.name}</h3>
                    </div>
                    {supplier?.logo_url && (
                      <Link
                        href={`/products?supplier_id=${supplier.id}`}
                        className="flex-shrink-0 bg-white rounded-lg p-1 border border-gray-200 shadow-sm hover:shadow-md hover:border-primary transition-all cursor-pointer"
                        title={`Товары поставщика: ${supplier.full_name}`}
                      >
                        <img
                          src={`${getPublicApiBase()}${supplier.logo_url}`}
                          alt={supplier.full_name || 'Поставщик'}
                          className="h-[53px] w-[53px] object-cover rounded-lg"
                        />
                      </Link>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    {productInventory ? (
                      <>
                        <span className="font-bold text-base text-primary-dark">{productInventory.price} ₽</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md whitespace-nowrap">
                          В наличии: {formatStockForCustomer(productInventory.quantity, product.items_per_box)} {product.unit}
                        </span>
                      </>
                    ) : (
                      <span className="text-orange-600 font-semibold bg-orange-50 px-2 py-0.5 rounded-md">Нет в наличии</span>
                    )}
                  </div>

                  {productInventory && parseFloat(productInventory.quantity) > 0 ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(product.items_per_box || 1) > 1 && (
                        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded whitespace-nowrap">
                          В уп.: {product.items_per_box} {product.unit}
                        </span>
                      )}
                      <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-1 py-0.5">
                        <label htmlFor={`fav-quantity-${product.id}`} className="text-xs text-gray-700 whitespace-nowrap font-medium">
                          {(product.items_per_box || 1) > 1 ? 'Уп.:' : 'Кол-во:'}
                        </label>
                        <div className="flex items-center border border-gray-300 rounded-md bg-white shadow-sm">
                          <button
                            type="button"
                            onClick={() => {
                              const itemsPerBox = product.items_per_box || 1;
                              const currentBoxes = productQuantities[product.id] ? Math.floor(productQuantities[product.id] / itemsPerBox) : 1;
                              const newBoxes = Math.max(1, currentBoxes - 1);
                              const totalQuantity = newBoxes * itemsPerBox;
                              setProductQuantities((prev) => ({ ...prev, [product.id]: totalQuantity }));
                            }}
                            className="px-1.5 py-0.5 text-gray-700 hover:bg-primary-light hover:text-primary-dark transition-colors text-xs font-bold rounded-l-md"
                            aria-label="Уменьшить количество"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            id={`fav-quantity-${product.id}`}
                            min="1"
                            step="1"
                            max={Math.floor(parseFloat(productInventory.quantity) / (product.items_per_box || 1))}
                            value={productQuantities[product.id] ? Math.floor(productQuantities[product.id] / (product.items_per_box || 1)) : 1}
                            onChange={(e) => {
                              const itemsPerBox = product.items_per_box || 1;
                              const boxes = parseInt(e.target.value) || 1;
                              const maxBoxes = Math.floor(parseFloat(productInventory.quantity) / itemsPerBox);
                              const clampedBoxes = Math.max(1, Math.min(boxes, maxBoxes));
                              const totalQuantity = clampedBoxes * itemsPerBox;
                              setProductQuantities((prev) => ({ ...prev, [product.id]: totalQuantity }));
                            }}
                            className="w-10 px-1 py-0.5 text-xs text-center font-semibold focus:outline-none focus:ring-2 focus:ring-primary border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const itemsPerBox = product.items_per_box || 1;
                              const currentBoxes = productQuantities[product.id] ? Math.floor(productQuantities[product.id] / itemsPerBox) : 1;
                              const maxBoxes = Math.floor(parseFloat(productInventory.quantity) / itemsPerBox);
                              const newBoxes = Math.min(maxBoxes, currentBoxes + 1);
                              const totalQuantity = newBoxes * itemsPerBox;
                              setProductQuantities((prev) => ({ ...prev, [product.id]: totalQuantity }));
                            }}
                            className="px-1.5 py-0.5 text-gray-700 hover:bg-primary-light hover:text-primary-dark transition-colors text-xs font-bold rounded-r-md"
                            aria-label="Увеличить количество"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-primary-dark bg-primary-light px-2 py-0.5 rounded-md whitespace-nowrap">
                        Итого: {productQuantities[product.id] || (product.items_per_box || 1)} {product.unit} на сумму {((productQuantities[product.id] || (product.items_per_box || 1)) * parseFloat(productInventory.price)).toFixed(2)} ₽
                      </div>
                      <button
                        type="button"
                        onClick={() => addToCart(product, productQuantities[product.id] || (product.items_per_box || 1))}
                        className="px-3 py-1 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg text-xs font-bold hover:from-green-700 hover:to-green-800 shadow-md hover:shadow-lg transition-all whitespace-nowrap flex-shrink-0"
                      >
                        В корзину
                      </button>
                    </div>
                  ) : (
                    <div>
                      <button
                        disabled
                        className="px-3 py-1 bg-gray-200 text-gray-500 rounded-lg text-xs font-semibold cursor-not-allowed opacity-60"
                      >
                        Нет в наличии
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

