'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { authService } from '@/lib/auth';
import { formatCurrency } from '@/lib/utils';

interface Product {
  id: number;
  name: string;
  unit: string;
  category?: string | null;
  items_per_box?: number | null;
  supplier_id: number;
}

interface Inventory {
  id: number;
  product_id: number;
  quantity: string;
  price: string;
}

interface Supplier {
  id: number;
  full_name: string;
  email: string;
}

interface CartItem {
  product: Product;
  inventory: Inventory;
  quantity: number;
  price: number;
}

export default function NewOrderPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/login');
      return;
    }

    const user = authService.getUser();
    // Поставщики не могут создавать заказы
    if (user && user.user_type === 'supplier') {
      router.push('/orders');
      return;
    }

    // Загружаем данные пользователя для автозаполнения
    const loadUserData = async () => {
      try {
        const userData = await api.getCurrentUser();
        if (userData.delivery_address) {
          setDeliveryAddress(userData.delivery_address);
        }
        if (userData.contact_phone) {
          setContactPhone(userData.contact_phone);
        }
      } catch (err) {
        console.error('Ошибка загрузки данных пользователя:', err);
      }
    };

    loadUserData();
    loadSuppliers();
    loadAllProductsAndInventory();
    
    // Загружаем корзину из localStorage, если она есть
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        const cartData = JSON.parse(savedCart);
        // Проверяем, что это массив
        if (Array.isArray(cartData)) {
          // Валидируем и очищаем корзину от невалидных данных
          const validCart = cartData.filter((item: any) => {
            // Проверяем, что у товара есть ID (обязательное поле)
            return item && item.product && typeof item.product.id === 'number' && item.product.id > 0;
          });
          
          if (validCart.length !== cartData.length) {
            // Если были удалены невалидные товары, сохраняем очищенную корзину
            localStorage.setItem('cart', JSON.stringify(validCart));
          }
          
          setCart(validCart);
        } else {
          // Если данные некорректны, очищаем
          setCart([]);
          localStorage.removeItem('cart');
        }
      } catch (e) {
        console.error('Ошибка загрузки корзины из localStorage:', e);
        setCart([]);
        localStorage.removeItem('cart'); // Удаляем поврежденные данные
      }
    }
    // Если корзины нет в localStorage, оставляем состояние пустым (не устанавливаем явно)
  }, [router]);

  // Синхронизируем корзину с localStorage при изменении
  useEffect(() => {
    // Сохраняем корзину в localStorage при любом изменении
    if (typeof window !== 'undefined') {
      if (cart.length > 0) {
        localStorage.setItem('cart', JSON.stringify(cart));
      } else {
        // Очищаем только если корзина действительно пуста (не при первой загрузке)
        // Проверяем, что это не начальное состояние
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
          try {
            const cartData = JSON.parse(savedCart);
            // Если в localStorage была непустая корзина, а сейчас она пуста - очищаем
            if (Array.isArray(cartData) && cartData.length > 0) {
              localStorage.removeItem('cart');
            }
          } catch (e) {
            // Игнорируем ошибки парсинга
          }
        }
      }
      window.dispatchEvent(new Event('cart-updated'));
    }
  }, [cart]);


  const loadSuppliers = async () => {
    try {
      const data = await api.getDistributors({ limit: 100 });
      setSuppliers(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки поставщиков');
    }
  };

  const loadAllProductsAndInventory = async () => {
    try {
      setIsLoading(true);
      // Загружаем все товары от всех поставщиков
      const productsData = await api.getProducts({ limit: 1000 });
      setProducts(productsData);
      
      // Загружаем остатки для всех поставщиков
      const suppliersData = await api.getDistributors({ limit: 100 });
      const inventoryPromises = suppliersData.map((supplier: Supplier) =>
        api.getSupplierInventory(supplier.id).catch(() => [])
      );
      const inventoryArrays = await Promise.all(inventoryPromises);
      const allInventory = inventoryArrays.flat();
      setInventory(allInventory);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки товаров');
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    const productInventory = inventory.find((inv) => inv.product_id === product.id);
    if (!productInventory) {
      setError('Товар отсутствует на складе');
      return;
    }

    if (parseFloat(productInventory.quantity) <= 0) {
      setError('Товар закончился на складе');
      return;
    }

    const itemsPerBox = product.items_per_box || 1;
    const initialQuantity = itemsPerBox; // Добавляем одну упаковку или одну штуку

    const existingItem = cart.find((item) => item.product.id === product.id);
    if (existingItem) {
      const newQuantity = existingItem.quantity + itemsPerBox;
      const available = parseFloat(productInventory.quantity);
      if (newQuantity > available) {
        setError(`Доступно только ${available} ${product.unit}`);
        return;
      }
      const newCart = cart.map((item) =>
        item.product.id === product.id
          ? { 
              ...item, 
              quantity: newQuantity,
              product: {
                ...item.product,
                items_per_box: item.product.items_per_box || product.items_per_box
              }
            }
          : item
      );
      setCart(newCart);
      localStorage.setItem('cart', JSON.stringify(newCart));
      // Отправляем событие обновления корзины
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cart-updated'));
      }
    } else {
      const newCart = [
        ...cart,
        {
          product: {
            ...product,
            category: product.category,
            items_per_box: product.items_per_box,
          },
          inventory: productInventory,
          quantity: initialQuantity,
          price: parseFloat(productInventory.price),
        },
      ];
      setCart(newCart);
      localStorage.setItem('cart', JSON.stringify(newCart));
      // Отправляем событие обновления корзины
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cart-updated'));
      }
    }
    setError('');
  };

  const removeFromCart = (productId: number) => {
    const newCart = cart.filter((item) => item.product.id !== productId);
    setCart(newCart);
    // Отправляем событие обновления корзины
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cart-updated'));
    }
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('cart');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cart-updated'));
    }
  };

  const updateCartQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const item = cart.find((i) => i.product.id === productId);
    if (!item) return;

    const itemsPerBox = item.product.items_per_box || 1;
    
    // Если товар продается упаковками, проверяем кратность
    if (itemsPerBox > 1) {
      // Округляем до ближайшей упаковки вниз
      const boxes = Math.floor(quantity / itemsPerBox);
      if (boxes < 1) {
        setError(`Минимальное количество: ${itemsPerBox} ${item.product.unit} (1 упаковка)`);
        return;
      }
      const correctQuantity = boxes * itemsPerBox;
      if (quantity !== correctQuantity) {
        quantity = correctQuantity; // Исправляем на кратное упаковке
      }
    }
    
    const available = parseFloat(item.inventory.quantity);
    if (quantity > available) {
      setError(`Доступно только ${available} ${item.product.unit}`);
      return;
    }

    const newCart = cart.map((item) =>
      item.product.id === productId ? { ...item, quantity } : item
    );
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
    // Отправляем событие обновления корзины
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cart-updated'));
    }
    setError('');
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (cart.length === 0) {
      setError('Добавьте товары в заказ');
      return;
    }

    if (!deliveryAddress.trim()) {
      setError('Укажите адрес доставки');
      return;
    }

    try {
      setIsLoading(true);
      
      // Группируем товары по поставщикам
      const ordersBySupplier: Record<number, CartItem[]> = {};
      cart.forEach((item) => {
        if (!ordersBySupplier[item.product.supplier_id]) {
          ordersBySupplier[item.product.supplier_id] = [];
        }
        ordersBySupplier[item.product.supplier_id].push(item);
      });

      // Создаем заказы для каждого поставщика
      const orderPromises = Object.entries(ordersBySupplier).map(async ([supplierId, items]) => {
        // Фильтруем товары, у которых есть валидный product_id
        const validItems = items.filter((item) => {
          return item && item.product && typeof item.product.id === 'number' && item.product.id > 0;
        });
        
        if (validItems.length === 0) {
          throw new Error('В заказе нет валидных товаров');
        }
        
        const orderData = {
          supplier_id: Number(supplierId),
          items: validItems.map((item) => {
            // Убеждаемся, что передаем именно ID товара, а не название
            if (!item.product.id || typeof item.product.id !== 'number') {
              throw new Error(`Неверный ID товара для товара: ${item.product.name || 'неизвестный'}`);
            }
            return {
              product_id: item.product.id,
              quantity: item.quantity,
              price: item.price,
            };
          }),
          delivery_address: deliveryAddress,
          contact_phone: contactPhone || undefined,
          notes: notes || undefined,
        };

        return api.createOrder(orderData);
      });

      const orders = await Promise.all(orderPromises);
      
      // Очищаем корзину после успешного создания заказа
      setCart([]);
      localStorage.removeItem('cart');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cart-updated'));
      }
      
      // Перенаправляем на страницу со списком заказов
      router.push('/orders');
    } catch (err: any) {
      setError(err.message || 'Ошибка создания заказа');
    } finally {
      setIsLoading(false);
    }
  };

  const availableProducts = products.filter((product) => {
    const productInventory = inventory.find((inv) => inv.product_id === product.id);
    const hasStock = productInventory && parseFloat(productInventory.quantity) > 0;
    return hasStock;
  });

  // Отладочная информация
  console.log('Корзина:', cart);
  console.log('Количество товаров в корзине:', cart.length);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Создание заказа</h1>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Корзина - показываем всегда, чтобы было видно */}
      <div className="bg-white shadow-lg rounded-lg p-4 sm:p-6" style={{ minHeight: '200px' }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg sm:text-xl font-semibold text-primary-dark">
            🛒 Корзина {cart.length > 0 && `(${cart.length} ${cart.length === 1 ? 'товар' : cart.length < 5 ? 'товара' : 'товаров'})`}
          </h2>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Очистить корзину
            </button>
          )}
        </div>
        {cart.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg mb-2">Корзина пуста</p>
            <p className="text-sm">Добавьте товары из каталога, перейдя на страницу "Каталог товаров"</p>
          </div>
        ) : (
          <div className="space-y-6">
            {(() => {
              // Группируем товары по поставщикам
              const cartBySupplier: Record<number, CartItem[]> = {};
              cart.forEach((item) => {
                if (!cartBySupplier[item.product.supplier_id]) {
                  cartBySupplier[item.product.supplier_id] = [];
                }
                cartBySupplier[item.product.supplier_id].push(item);
              });

              return Object.entries(cartBySupplier).map(([supplierId, items]) => {
                const supplier = suppliers.find((s) => s.id === Number(supplierId));
                const supplierTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
                
                // Группируем товары по категориям внутри поставщика
                const cartByCategory: Record<string, CartItem[]> = {};
                items.forEach((item) => {
                  const category = item.product.category || 'Без категории';
                  if (!cartByCategory[category]) {
                    cartByCategory[category] = [];
                  }
                  cartByCategory[category].push(item);
                });
                
                // Сортируем категории по алфавиту
                const sortedCategories = Object.keys(cartByCategory).sort();
                
                return (
                  <div key={supplierId} className="border border-gray-200 rounded-lg p-4 bg-gray-100">
                    <h3 className="font-semibold text-lg mb-3">
                      Поставщик: <span className="font-bold text-primary-dark">{supplier?.full_name || 'Неизвестно'}</span>
                    </h3>
                    <div className="space-y-4">
                      {sortedCategories.map((category) => {
                        // Сортируем товары в категории по цене (по возрастанию)
                        const categoryItems = cartByCategory[category].sort((a, b) => a.price - b.price);
                        
                        return (
                          <div key={category} className="mb-4 last:mb-0">
                            <h4 className="font-medium text-md text-gray-700 mb-2 border-b pb-1">
                              {category}
                            </h4>
                            <div className="space-y-3">
                              {categoryItems.map((item) => (
                                <div
                                  key={item.product.id}
                                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-2 sm:gap-0"
                                >
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold truncate">{item.product.name}</h4>
                            <div className="text-sm text-gray-600">
                              {item.price} ₽ × {(() => {
                                const itemsPerBox = item.product.items_per_box || 1;
                                if (itemsPerBox > 1) {
                                  const boxes = Math.floor(item.quantity / itemsPerBox);
                                  return `${boxes} уп. (${item.quantity} ${item.product.unit})`;
                                }
                                return `${item.quantity} ${item.product.unit}`;
                              })()}
                            </div>
                            {item.product.items_per_box && item.product.items_per_box > 1 && (
                              <div className="text-xs text-gray-500 mt-1">
                                В упаковке: {item.product.items_per_box} {item.product.unit}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
                            <div className="flex flex-col space-y-2 w-full sm:w-auto">
                              <div className="flex items-center space-x-2">
                                <label className="text-sm font-medium text-gray-700">
                                  {(() => {
                                    const itemsPerBox = item.product.items_per_box ?? null;
                                    return (itemsPerBox !== null && itemsPerBox > 1) ? 'Упаковок:' : 'Количество:';
                                  })()}
                                </label>
                                <div className="flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const itemsPerBox = item.product.items_per_box || 1;
                                      const newQuantity = item.quantity - itemsPerBox;
                                      if (newQuantity <= 0) {
                                        removeFromCart(item.product.id);
                                      } else {
                                        updateCartQuantity(item.product.id, newQuantity);
                                      }
                                    }}
                                    className="px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-100 text-sm"
                                    title={item.product.items_per_box && item.product.items_per_box > 1 ? `Уменьшить на ${item.product.items_per_box} ${item.product.unit} (1 уп.)` : 'Уменьшить на 1'}
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    max={Math.floor(parseFloat(item.inventory.quantity) / (item.product.items_per_box || 1))}
                                    value={(() => {
                                      const itemsPerBox = item.product.items_per_box || 1;
                                      if (itemsPerBox > 1) {
                                        return Math.floor(item.quantity / itemsPerBox);
                                      }
                                      return item.quantity;
                                    })()}
                                    onChange={(e) => {
                                      const itemsPerBox = item.product.items_per_box || 1;
                                      let boxes = parseInt(e.target.value);
                                      
                                      // Если значение пустое или некорректное, устанавливаем 1
                                      if (isNaN(boxes) || boxes < 1) {
                                        boxes = 1;
                                      }
                                      
                                      const maxBoxes = Math.floor(parseFloat(item.inventory.quantity) / itemsPerBox);
                                      const clampedBoxes = Math.max(1, Math.min(boxes, maxBoxes));
                                      
                                      // Вычисляем количество в штуках на основе упаковок
                                      const quantity = clampedBoxes * itemsPerBox;
                                      
                                      // Обновляем корзину напрямую, минуя updateCartQuantity для более точного контроля
                                      const newCart = cart.map((cartItem) => {
                                        if (cartItem.product.id === item.product.id) {
                                          return { ...cartItem, quantity };
                                        }
                                        return cartItem;
                                      });
                                      setCart(newCart);
                                      localStorage.setItem('cart', JSON.stringify(newCart));
                                      if (typeof window !== 'undefined') {
                                        window.dispatchEvent(new Event('cart-updated'));
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const itemsPerBox = item.product.items_per_box || 1;
                                      let boxes = parseInt(e.target.value);
                                      
                                      // Если значение пустое или некорректное, устанавливаем 1
                                      if (isNaN(boxes) || boxes < 1) {
                                        boxes = 1;
                                      }
                                      
                                      const maxBoxes = Math.floor(parseFloat(item.inventory.quantity) / itemsPerBox);
                                      const clampedBoxes = Math.max(1, Math.min(boxes, maxBoxes));
                                      
                                      // Вычисляем количество в штуках на основе упаковок
                                      const quantity = clampedBoxes * itemsPerBox;
                                      
                                      // Обновляем корзину напрямую
                                      const newCart = cart.map((cartItem) => {
                                        if (cartItem.product.id === item.product.id) {
                                          return { ...cartItem, quantity };
                                        }
                                        return cartItem;
                                      });
                                      setCart(newCart);
                                      localStorage.setItem('cart', JSON.stringify(newCart));
                                      if (typeof window !== 'undefined') {
                                        window.dispatchEvent(new Event('cart-updated'));
                                      }
                                    }}
                                    className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-primary focus:border-primary text-center"
                                  />
                                  <span className="text-sm text-gray-500">
                                    {item.product.items_per_box && item.product.items_per_box > 1 
                                      ? `уп. (${item.quantity} ${item.product.unit})` 
                                      : item.product.unit}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const itemsPerBox = item.product.items_per_box || 1;
                                      const maxQuantity = Math.floor(parseFloat(item.inventory.quantity) / itemsPerBox) * itemsPerBox;
                                      if (item.quantity + itemsPerBox <= maxQuantity) {
                                        updateCartQuantity(item.product.id, item.quantity + itemsPerBox);
                                      } else {
                                        setError(`Максимальное количество: ${maxQuantity} ${item.product.unit}`);
                                      }
                                    }}
                                    className="px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-100 text-sm"
                                    title={item.product.items_per_box && item.product.items_per_box > 1 ? `Увеличить на ${item.product.items_per_box} ${item.product.unit} (1 уп.)` : 'Увеличить на 1'}
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              <div className="text-sm font-semibold text-primary-dark bg-primary-light px-3 py-2 rounded-md border border-primary">
                                Итого: {item.quantity} {item.product.unit} × {item.price.toFixed(2)} ₽ = <span className="text-lg">{formatCurrency(item.price * item.quantity)}</span>
                              </div>
                            </div>
                            <div className="w-20 sm:w-24 text-right font-semibold text-sm sm:text-base">
                              {formatCurrency(item.price * item.quantity)}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.product.id)}
                              className="text-red-600 hover:text-red-800 text-xs sm:text-sm px-2"
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex justify-between items-center pt-2 border-t mt-4">
                        <span className="text-sm font-medium text-gray-600">Итого по поставщику:</span>
                        <span className="text-lg font-bold">{formatCurrency(supplierTotal)}</span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
            <div className="flex justify-between items-center pt-4 border-t-2 border-gray-300">
              <span className="text-lg font-semibold">Общая сумма:</span>
              <span className="text-2xl font-bold text-primary-dark">{formatCurrency(calculateTotal())}</span>
            </div>
            <div className="bg-primary-light border border-primary rounded-lg p-3">
              <p className="text-sm text-primary-dark">
                <strong>Примечание:</strong> Будет создано {Object.keys(cart.reduce((acc, item) => {
                  acc[item.product.supplier_id] = true;
                  return acc;
                }, {} as Record<number, boolean>)).length} заказ(ов) - по одному на каждого поставщика.
              </p>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Информация о доставке</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Адрес доставки *
              </label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                placeholder="г. Москва, ул. Ленина, д. 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Контактный телефон
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                placeholder="+7 (999) 123-45-67"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Примечания
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                placeholder="Дополнительная информация к заказу"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isLoading || cart.length === 0}
            className="px-6 py-2 bg-primary-dark text-white rounded-md hover:bg-primary disabled:opacity-50"
          >
            {isLoading ? 'Создание...' : 'Создать заказ'}
          </button>
        </div>
      </form>
    </div>
  );
}

