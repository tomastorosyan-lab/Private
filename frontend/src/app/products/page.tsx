'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { getPublicApiBase } from '@/lib/publicBase';
import { authService } from '@/lib/auth';
import { PRODUCT_CATEGORY_TREE } from '@/lib/productCategoryTree';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Product {
  id: number;
  name: string;
  description: string | null;
  category_id?: number | null;
  category: string | null;
  category_path?: string | null;
  unit: string;
  image_url?: string | null;
  items_per_box?: number | null;
  supplier_id: number;
}

interface Supplier {
  id: number;
  full_name: string;
  email: string;
  logo_url?: string | null;
}

interface Inventory {
  id: number;
  product_id: number;
  supplier_id: number;
  quantity: string;
  price: string;
}

function inventoryRowForProduct(invList: Inventory[], product: Product): Inventory | undefined {
  const pid = Number(product.id);
  const sid = Number(product.supplier_id);
  return invList.find(
    (inv) => Number(inv.product_id) === pid && Number(inv.supplier_id) === sid
  );
}

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [productPopularity, setProductPopularity] = useState<Record<number, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [productQuantities, setProductQuantities] = useState<Record<number, number>>({});
  const [favoriteProductIds, setFavoriteProductIds] = useState<number[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [selectedProductForDescription, setSelectedProductForDescription] = useState<Product | null>(null);
  const [categoryIdsByName, setCategoryIdsByName] = useState<Record<string, number>>({});
  
  // Фильтры
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedAvailability, setSelectedAvailability] = useState<string>('all'); // 'all', 'in_stock', 'out_of_stock'
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [deliveryOption, setDeliveryOption] = useState<'any' | '1h' | 'today' | 'tomorrow' | '3d' | '7d'>('any');
  const [expandedCategoryGroups, setExpandedCategoryGroups] = useState<string[]>([]);
  
  // Сортировка
  const [sortBy, setSortBy] = useState<string>('name'); // 'name', 'price_asc', 'price_desc', 'quantity_asc', 'quantity_desc', 'popularity_desc'
  // Отслеживаем предыдущий supplier_id из URL для сброса фильтров
  const prevSupplierIdRef = useRef<string | null>(null);

  // Функция сброса всех фильтров
  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedSupplierId(null);
    setSelectedAvailability('all');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('name');
    // Очищаем supplier_id из URL (используем replace, чтобы не добавлять в историю)
    router.replace('/products');
    prevSupplierIdRef.current = null;
  };

  const toggleCategoryGroup = (groupName: string) => {
    setExpandedCategoryGroups((prev) => (
      prev.includes(groupName)
        ? prev.filter((name) => name !== groupName)
        : [...prev, groupName]
    ));
  };

  const effectiveCategoryNameFilter = useMemo(() => {
    if (!selectedCategory) return null;
    const selectedGroup = PRODUCT_CATEGORY_TREE.find((group) => group.name === selectedCategory);
    if (!selectedGroup) {
      return new Set<string>([selectedCategory]);
    }
    const allowed = new Set<string>([selectedGroup.name]);
    (selectedGroup.children || []).forEach((child) => allowed.add(child.name));
    return allowed;
  }, [selectedCategory]);

  const effectiveCategoryIdFilter = useMemo(() => {
    if (!effectiveCategoryNameFilter) return null;
    const ids = new Set<number>();
    effectiveCategoryNameFilter.forEach((name) => {
      const id = categoryIdsByName[name];
      if (typeof id === 'number') ids.add(id);
    });
    return ids.size ? ids : null;
  }, [effectiveCategoryNameFilter, categoryIdsByName]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      const supplierIdParam = searchParams.get('supplier_id');
      const supplierId = supplierIdParam ? Number(supplierIdParam) : undefined;

      const [productsData, suppliersData, categoriesData, ordersData] = await Promise.all([
        api.getProducts({ limit: 1000, supplier_id: supplierId }),
        api.getDistributors({ limit: 100 }),
        api.getCategories().catch(() => ({ tree: [] })),
        api.getOrders({ limit: 1000 }).catch(() => []),
      ]);
      setProducts(productsData);
      setSuppliers(suppliersData);
      const byName: Record<string, number> = {};
      (categoriesData.tree || []).forEach((node) => {
        if (typeof node.id === 'number' && typeof node.name === 'string') {
          byName[node.name] = node.id;
        }
      });
      setCategoryIdsByName(byName);

      const popularityMap: Record<number, number> = {};
      (ordersData as any[]).forEach((order) => {
        const items = Array.isArray(order?.items) ? order.items : [];
        items.forEach((item: any) => {
          const productId = Number(item?.product_id);
          const quantity = Number(item?.quantity || 0);
          if (!Number.isFinite(productId)) return;
          popularityMap[productId] = (popularityMap[productId] || 0) + (Number.isFinite(quantity) ? quantity : 0);
        });
      });
      setProductPopularity(popularityMap);

      const inventoryPromises = suppliersData.map((supplier: Supplier) =>
        api.getSupplierInventory(supplier.id).catch(() => [])
      );
      const inventoryArrays = await Promise.all(inventoryPromises);
      const allInventory = inventoryArrays.flat();
      setInventory(allInventory);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки данных');
    } finally {
      setIsLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('favorite_products');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setFavoriteProductIds(parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id)));
      }
    } catch {
      // Ignore broken local data and start with empty favorites.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('favorite_products', JSON.stringify(favoriteProductIds));
  }, [favoriteProductIds]);

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/login');
      return;
    }

    const user = authService.getUser();
    // Поставщики не должны иметь доступ к каталогу товаров
    if (user && user.user_type === 'supplier') {
      router.push('/products/manage');
      return;
    }

    // Получаем supplier_id из URL параметров
    const supplierIdParam = searchParams.get('supplier_id');
    if (supplierIdParam) {
      setSelectedSupplierId(Number(supplierIdParam));
    } else {
      setSelectedSupplierId(null);
    }

    loadData();
  }, [router, searchParams, loadData]);

  useEffect(() => {
    const onCatalogRefresh = () => {
      if (!authService.isAuthenticated()) return;
      const u = authService.getUser();
      if (u?.user_type === 'supplier') return;
      loadData();
    };
    window.addEventListener('products-catalog-refresh', onCatalogRefresh);
    return () => window.removeEventListener('products-catalog-refresh', onCatalogRefresh);
  }, [loadData]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!authService.isAuthenticated()) return;
      if (authService.getUser()?.user_type === 'supplier') return;
      loadData();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadData]);

  // Отслеживаем изменение supplier_id из URL и сбрасываем фильтры
  useEffect(() => {
    const supplierIdParam = searchParams.get('supplier_id');
    
    // Сбрасываем остальные фильтры только если supplier_id изменился в URL
    // Это происходит при клике на логотип поставщика
    if (supplierIdParam !== prevSupplierIdRef.current) {
      prevSupplierIdRef.current = supplierIdParam;
      
      // Сбрасываем фильтры только если supplier_id присутствует в URL
      if (supplierIdParam) {
        setSearchQuery('');
        setSelectedCategory('');
        setSelectedAvailability('all');
        setMinPrice('');
        setMaxPrice('');
        setSortBy('name');
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedCategory) return;
    const selectedGroup = PRODUCT_CATEGORY_TREE.find(
      (group) => group.name === selectedCategory || (group.children || []).some((child) => child.name === selectedCategory)
    );
    if (!selectedGroup) return;
    setExpandedCategoryGroups((prev) => (
      prev.includes(selectedGroup.name) ? prev : [...prev, selectedGroup.name]
    ));
  }, [selectedCategory]);

  const handleSearch = async () => {
    try {
      setIsLoading(true);
      const results = await api.searchProducts({
        query: searchQuery || undefined,
      });
      setProducts(results);
    } catch (err: any) {
      setError(err.message || 'Ошибка поиска');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFavorite = (productId: number) => {
    setFavoriteProductIds((prev) => (
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    ));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('favorites-updated'));
    }
  };

  const addToCart = (product: Product, quantity: number = 1) => {
    const productInventory = inventoryRowForProduct(inventory, product);
    if (!productInventory) {
      setError('Товар отсутствует на складе');
      setSuccess('');
      return;
    }

    if (parseFloat(productInventory.quantity) <= 0) {
      setError('Товар закончился на складе');
      setSuccess('');
      return;
    }

    const itemsPerBox = product.items_per_box || 1;
    const availableQuantity = parseFloat(productInventory.quantity);
    
    // Проверяем, что количество кратно упаковке
    if (itemsPerBox > 1 && quantity % itemsPerBox !== 0) {
      const boxes = Math.floor(quantity / itemsPerBox);
      const correctQuantity = boxes * itemsPerBox;
      setError(`Количество должно быть кратно упаковке (${itemsPerBox} ${product.unit}). Используйте ${correctQuantity} ${product.unit} (${boxes} уп.)`);
      setSuccess('');
      return;
    }

    if (quantity > availableQuantity) {
      setError(`Доступно только ${availableQuantity} ${product.unit}`);
      setSuccess('');
      return;
    }

    if (quantity <= 0) {
      setError('Количество должно быть больше нуля');
      setSuccess('');
      return;
    }

    if (!Number.isFinite(Number(product.id)) || Number(product.id) <= 0) {
      setError('Ошибка: у товара отсутствует валидный ID');
      setSuccess('');
      return;
    }
    
    // Сохраняем товар в localStorage для передачи на страницу создания заказа
    const cartItem = {
      product: {
        id: product.id, // Обязательно передаем ID товара, а не название
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
    };

    // Получаем существующую корзину из localStorage
    const existingCart = localStorage.getItem('cart');
    let cart: any[] = [];
    if (existingCart) {
      try {
        cart = JSON.parse(existingCart);
      } catch (e) {
        cart = [];
      }
    }

    // Проверяем, есть ли уже этот товар в корзине
    const existingItemIndex = cart.findIndex((item) => Number(item.product.id) === Number(product.id));
    if (existingItemIndex >= 0) {
      // Увеличиваем количество
      const newQuantity = cart[existingItemIndex].quantity + quantity;
      
      // Проверяем кратность упаковке
      if (itemsPerBox > 1 && newQuantity % itemsPerBox !== 0) {
        const boxes = Math.floor(newQuantity / itemsPerBox);
        const correctQuantity = boxes * itemsPerBox;
        setError(`Количество должно быть кратно упаковке (${itemsPerBox} ${product.unit}). Используйте ${correctQuantity} ${product.unit} (${boxes} уп.)`);
        setSuccess('');
        return;
      }
      
      if (newQuantity > availableQuantity) {
        setError(`Максимальное количество: ${availableQuantity} ${product.unit}`);
        setSuccess('');
        return;
      }
      cart[existingItemIndex].quantity = newQuantity;
    } else {
      // Добавляем новый товар
      cart.push(cartItem);
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    const boxes = itemsPerBox > 1 ? Math.floor(quantity / itemsPerBox) : quantity;
    const quantityText = itemsPerBox > 1 
      ? `${boxes} уп. (${quantity} ${product.unit})`
      : `${quantity} ${product.unit}`;
    setSuccess(`Товар "${product.name}" (${quantityText}) добавлен в корзину`);
    setError('');
    
    // Очищаем количество для этого товара
    setProductQuantities(prev => {
      const newQuantities = { ...prev };
      delete newQuantities[product.id];
      return newQuantities;
    });
    setSuccess(`Товар "${product.name}" (${quantity} ${product.unit}) добавлен в корзину`);
    setError('');
    
    // Очищаем количество для этого товара
    setProductQuantities(prev => {
      const newQuantities = { ...prev };
      delete newQuantities[product.id];
      return newQuantities;
    });
    
    // Отправляем событие обновления корзины
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cart-updated'));
    }
    
    setSuccess('Товар добавлен в корзину');
    setError('');
    
    // Очищаем сообщение через 3 секунды
    setTimeout(() => setSuccess(''), 3000);
  };

  // Фильтруем товары
  const filteredProducts = products.filter((product) => {
    // Фильтр по поставщику
    if (selectedSupplierId !== null) {
      if (product.supplier_id !== selectedSupplierId) {
        return false;
      }
    }
    
    // Фильтр по поисковому запросу
    if (searchQuery && !product.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Фильтр по категории
    if (effectiveCategoryIdFilter && product.category_id != null) {
      if (!effectiveCategoryIdFilter.has(Number(product.category_id))) {
        return false;
      }
    } else if (effectiveCategoryNameFilter) {
      const productCategory = product.category || '';
      if (!effectiveCategoryNameFilter.has(productCategory)) {
        return false;
      }
    }
    
    // Фильтр по наличию
    const productInventory = inventoryRowForProduct(inventory, product);
    if (selectedAvailability === 'in_stock') {
      if (!productInventory || parseFloat(productInventory.quantity) <= 0) {
        return false;
      }
    } else if (selectedAvailability === 'out_of_stock') {
      if (productInventory && parseFloat(productInventory.quantity) > 0) {
        return false;
      }
    }
    
    // Фильтр по цене
    if (productInventory) {
      const price = parseFloat(productInventory.price);
      if (minPrice && price < parseFloat(minPrice)) {
        return false;
      }
      if (maxPrice && price > parseFloat(maxPrice)) {
        return false;
      }
    }
    
    return true;
  }).sort((a, b) => {
    const inventoryA = inventoryRowForProduct(inventory, a);
    const inventoryB = inventoryRowForProduct(inventory, b);
    
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name, 'ru');
      case 'price_asc':
        const priceA = inventoryA ? parseFloat(inventoryA.price) : 0;
        const priceB = inventoryB ? parseFloat(inventoryB.price) : 0;
        return priceA - priceB;
      case 'price_desc':
        const priceA2 = inventoryA ? parseFloat(inventoryA.price) : 0;
        const priceB2 = inventoryB ? parseFloat(inventoryB.price) : 0;
        return priceB2 - priceA2;
      case 'popularity_desc':
        const popularityA = productPopularity[a.id] || 0;
        const popularityB = productPopularity[b.id] || 0;
        if (popularityB !== popularityA) {
          return popularityB - popularityA;
        }
        return a.name.localeCompare(b.name, 'ru');
      case 'quantity_asc':
        const qtyA = inventoryA ? parseFloat(inventoryA.quantity) : 0;
        const qtyB = inventoryB ? parseFloat(inventoryB.quantity) : 0;
        return qtyA - qtyB;
      case 'quantity_desc':
        const qtyA2 = inventoryA ? parseFloat(inventoryA.quantity) : 0;
        const qtyB2 = inventoryB ? parseFloat(inventoryB.quantity) : 0;
        return qtyB2 - qtyA2;
      default:
        return 0;
    }
  });

  if (isLoading && products.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Загрузка товаров...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Каталог товаров</h1>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-2">
          <div className="rounded-3xl bg-slate-100 px-4 py-5 shadow-sm xl:sticky xl:top-24">
            <div className="mb-6">
              <h3 className="text-3xl font-semibold text-slate-900">Категория</h3>
              <div className="mt-3 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('');
                    setExpandedCategoryGroups([]);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-base text-slate-700 hover:bg-slate-200/60"
                  aria-label="Все категории"
                >
                  <span className="text-xl text-slate-400">‹</span>
                  <span>Все категории</span>
                </button>
                {PRODUCT_CATEGORY_TREE.map((group) => (
                  <div key={group.name} className="space-y-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleCategoryGroup(group.name)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/60"
                        aria-label={expandedCategoryGroups.includes(group.name) ? `Свернуть ${group.name}` : `Развернуть ${group.name}`}
                      >
                        <span
                          className={`text-sm transition-transform ${
                            expandedCategoryGroups.includes(group.name) ? 'rotate-90' : ''
                          }`}
                        >
                          ▶
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCategory(group.name)}
                        className={`flex-1 rounded-lg px-2 py-1 text-left text-base transition-colors ${
                          selectedCategory === group.name
                            ? 'bg-blue-100 text-blue-900'
                            : 'text-slate-700 hover:bg-slate-200/60'
                        }`}
                      >
                        <span className="line-clamp-2">{group.name}</span>
                      </button>
                    </div>
                    {expandedCategoryGroups.includes(group.name) && (
                      <div className="ml-8 space-y-1">
                        {group.children?.map((child) => (
                          <button
                            key={child.name}
                            type="button"
                            onClick={() => setSelectedCategory(child.name)}
                            className={`block w-full rounded-lg px-2 py-1 text-left text-sm transition-colors ${
                              selectedCategory === child.name
                                ? 'bg-blue-100 text-blue-900'
                                : 'text-slate-700 hover:bg-slate-200/60'
                            }`}
                          >
                            <span className="line-clamp-2">{child.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-3xl font-semibold text-slate-900">Доставка</h4>
              <div className="mt-3 space-y-2">
                {[
                  { value: 'any', label: 'Неважно' },
                  { value: '1h', label: 'От 1 часа' },
                  { value: 'today', label: 'Сегодня' },
                  { value: 'tomorrow', label: 'Завтра' },
                  { value: '3d', label: 'До 3 дней' },
                  { value: '7d', label: 'До 7 дней' },
                ].map((option) => (
                  <label key={option.value} className="flex items-center gap-3 text-base text-slate-900">
                    <input
                      type="radio"
                      name="delivery"
                      checked={deliveryOption === option.value}
                      onChange={() => setDeliveryOption(option.value as 'any' | '1h' | 'today' | 'tomorrow' | '3d' | '7d')}
                      className="h-5 w-5 accent-blue-600"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <h4 className="text-3xl font-semibold text-slate-900">Цена</h4>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-300 text-xs text-slate-600">i</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="20"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-400 focus:outline-none"
                />
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="769823"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-400 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 w-full rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Сбросить фильтры
              </button>
            </div>

          </div>
        </div>

        <div className="xl:col-span-10">
          {filteredProducts.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-6 text-center py-12 text-gray-500">
              Товары не найдены
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-6 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
            {filteredProducts.map((product) => {
              const productInventory = inventoryRowForProduct(inventory, product);
              const supplier = suppliers.find((s) => Number(s.id) === Number(product.supplier_id));
              const itemsPerBox = product.items_per_box || 1; // Количество штук в упаковке
              const selectedQuantity = productQuantities[product.id] ?? 0;
              
              return (
                <div
                  key={product.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-primary-light transition-all duration-200 flex flex-col group"
                >
                  {/* Изображение на всю высоту карточки */}
                  {product.image_url ? (
                    <div
                      className="w-full h-44 shrink-0 relative overflow-hidden bg-gray-100 border-b border-gray-200"
                      onClick={() => setSelectedProductForDescription(product)}
                    >
                      <img
                        src={`${getPublicApiBase()}${product.image_url}`}
                        alt={product.name}
                        className="h-full w-full object-cover object-center cursor-pointer transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-44 shrink-0 bg-gray-50 border-b border-gray-100" />
                  )}

                  {/* Основной контент */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5 p-3">
                    {/* Верхняя часть: название и логотип */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleFavorite(product.id)}
                          aria-label={favoriteProductIds.includes(product.id) ? 'Убрать из избранного' : 'Добавить в избранное'}
                          title={favoriteProductIds.includes(product.id) ? 'Убрать из избранного' : 'Добавить в избранное'}
                          className={`text-base leading-none mt-0.5 ${favoriteProductIds.includes(product.id) ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                          ⚑
                        </button>
                        <h3 className="text-sm font-bold text-gray-900 flex-1 line-clamp-2 leading-tight group-hover:text-primary-dark transition-colors">{product.name}</h3>
                      </div>
                      {/* Логотип поставщика */}
                      {supplier?.logo_url && (
                        <Link 
                          href={`/products?supplier_id=${supplier.id}`}
                          className="flex-shrink-0 bg-white rounded-lg p-1 border border-gray-200 shadow-sm hover:shadow-md hover:border-primary transition-all cursor-pointer"
                          title={`Товары поставщика: ${supplier.full_name}`}
                        >
                          <img 
                            src={`${getPublicApiBase()}${supplier.logo_url}`}
                            alt={supplier.full_name}
                            className="h-[53px] w-[53px] object-cover rounded-lg"
                            title={supplier.full_name}
                          />
                        </Link>
                      )}
                    </div>
                    
                    {/* Средняя часть: цена и наличие */}
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      {productInventory ? (
                        <>
                          <span className="font-bold text-base text-primary-dark">{productInventory.price} ₽</span>
                          <span className="text-gray-300">•</span>
                          <span className="text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md whitespace-nowrap">В наличии: {Math.floor(parseFloat(productInventory.quantity))} {product.unit}</span>
                        </>
                      ) : (
                        <span className="text-orange-600 font-semibold bg-orange-50 px-2 py-0.5 rounded-md">Нет в наличии</span>
                      )}
                    </div>
                    
                    {/* Нижняя часть: управление количеством и кнопка */}
                    {productInventory && parseFloat(productInventory.quantity) > 0 ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                        {itemsPerBox > 1 && (
                          <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded whitespace-nowrap">В уп.: {itemsPerBox} {product.unit}</span>
                        )}
                        <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-1 py-0.5">
                          <label htmlFor={`quantity-${product.id}`} className="text-xs text-gray-700 whitespace-nowrap font-medium">
                            {itemsPerBox > 1 ? 'Уп.:' : 'Кол-во:'}
                          </label>
                          <div className="flex items-center border border-gray-300 rounded-md bg-white shadow-sm">
                            <button
                              type="button"
                              onClick={() => {
                                const currentBoxes = Math.floor(selectedQuantity / itemsPerBox);
                                const newBoxes = Math.max(0, currentBoxes - 1);
                                const totalQuantity = newBoxes * itemsPerBox;
                                setProductQuantities(prev => ({
                                  ...prev,
                                  [product.id]: totalQuantity
                                }));
                              }}
                              className="px-1.5 py-0.5 text-gray-700 hover:bg-primary-light hover:text-primary-dark active:bg-primary transition-colors text-xs font-bold rounded-l-md"
                              aria-label="Уменьшить количество"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              id={`quantity-${product.id}`}
                              min="0"
                              step="1"
                              max={Math.floor(parseFloat(productInventory.quantity) / itemsPerBox)}
                              value={Math.floor(selectedQuantity / itemsPerBox)}
                              onChange={(e) => {
                                const boxes = parseInt(e.target.value) || 0;
                                const maxBoxes = Math.floor(parseFloat(productInventory.quantity) / itemsPerBox);
                                const clampedBoxes = Math.max(0, Math.min(boxes, maxBoxes));
                                const totalQuantity = clampedBoxes * itemsPerBox;
                                setProductQuantities(prev => ({
                                  ...prev,
                                  [product.id]: totalQuantity
                                }));
                              }}
                              className="w-10 px-1 py-0.5 text-xs text-center font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const currentBoxes = Math.floor(selectedQuantity / itemsPerBox);
                                const maxBoxes = Math.floor(parseFloat(productInventory.quantity) / itemsPerBox);
                                const newBoxes = Math.min(maxBoxes, currentBoxes + 1);
                                const totalQuantity = newBoxes * itemsPerBox;
                                setProductQuantities(prev => ({
                                  ...prev,
                                  [product.id]: totalQuantity
                                }));
                              }}
                              className="px-1.5 py-0.5 text-gray-700 hover:bg-primary-light hover:text-primary-dark active:bg-primary transition-colors text-xs font-bold rounded-r-md"
                              aria-label="Увеличить количество"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="text-xs font-bold text-primary-dark bg-primary-light px-2 py-0.5 rounded-md whitespace-nowrap">
                          Итого: {selectedQuantity} {product.unit} на сумму {(selectedQuantity * parseFloat(productInventory.price)).toFixed(2)} ₽
                        </div>
                        </div>
                        <button
                          onClick={() => addToCart(product, selectedQuantity)}
                          disabled={selectedQuantity === 0}
                          className={`w-full px-3 py-1 rounded-lg text-xs font-bold shadow-md transition-all ${
                            selectedQuantity === 0
                              ? 'bg-green-200 text-green-800 cursor-not-allowed'
                              : 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 hover:shadow-lg'
                          }`}
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
      </div>

      {/* Модальное окно с описанием товара */}
      {selectedProductForDescription && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedProductForDescription(null)}
        >
          <div 
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-gray-900">{selectedProductForDescription.name}</h2>
              <button
                onClick={() => setSelectedProductForDescription(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            {selectedProductForDescription.image_url && (
              <div className="mb-4 flex justify-center">
                <img 
                  src={`${getPublicApiBase()}${selectedProductForDescription.image_url}`}
                  alt={selectedProductForDescription.name}
                  className="max-w-full h-auto max-h-96 object-contain rounded-lg"
                />
              </div>
            )}
            
            {selectedProductForDescription.description ? (
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Описание:</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedProductForDescription.description}</p>
              </div>
            ) : (
              <p className="text-gray-500 italic mb-4">Описание отсутствует</p>
            )}
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Категория:</span>
                <span className="ml-2 text-gray-900">{selectedProductForDescription.category || 'Не указана'}</span>
              </div>
              <div>
                <span className="text-gray-500">Единица измерения:</span>
                <span className="ml-2 text-gray-900">{selectedProductForDescription.unit}</span>
              </div>
              {selectedProductForDescription.items_per_box && (
                <div>
                  <span className="text-gray-500">В упаковке:</span>
                  <span className="ml-2 text-gray-900">{selectedProductForDescription.items_per_box} {selectedProductForDescription.unit}</span>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedProductForDescription(null)}
                className="px-4 py-2 bg-primary-dark text-white rounded-md hover:bg-primary"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

