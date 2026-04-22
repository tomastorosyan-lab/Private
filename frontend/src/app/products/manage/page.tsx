'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getPublicApiBase } from '@/lib/publicBase';
import { authService } from '@/lib/auth';
import Link from 'next/link';
const CROP_FRAME_SIZE = 320;
const STANDARD_IMAGE_SIZE = 1024;
const STANDARD_IMAGE_TYPE = 'image/jpeg';

interface CropDraft {
  fileName: string;
  src: string;
  imageEl: HTMLImageElement;
  scale: number;
  minScale: number;
  x: number;
  y: number;
}

interface Product {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  items_per_box?: number | null;
  image_url?: string | null;
  supplier_id: number;
}

interface InventoryRow {
  id: number;
  product_id: number;
  supplier_id: number;
  quantity: string;
  price: string;
}

type FormMode = 'idle' | 'create' | 'edit';

interface ProductDraft {
  name: string;
  description: string;
  category: string;
  items_per_box: string;
  quantity: string;
  price: string;
}

const emptyDraft = (): ProductDraft => ({
  name: '',
  description: '',
  category: '',
  items_per_box: '',
  quantity: '',
  price: '',
});

/** Выбор строки inventory для товара (владелец товара / единственная строка / текущий поставщик). */
function pickInventoryForProduct(
  rows: InventoryRow[],
  productSupplierId: number
): InventoryRow | null {
  const sid = Number(productSupplierId);
  let row =
    rows.find((r) => Number(r.supplier_id) === sid) ?? null;
  if (!row && rows.length === 1) row = rows[0];
  if (!row) {
    const me = authService.getUser();
    if (me?.user_type === 'supplier' && Number.isFinite(Number(me.id))) {
      row =
        rows.find((r) => Number(r.supplier_id) === Number(me.id)) ?? null;
    }
  }
  return row;
}

export default function ManageProductsPage() {
  const router = useRouter();
  /** Перерисовка при загрузке пользователя из localStorage (getUser() не триггерит React сам). */
  const [authEpoch, setAuthEpoch] = useState(0);
  const [sessionReady, setSessionReady] = useState(false);
  const user = authService.getUser();
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Record<number, InventoryRow>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formMode, setFormMode] = useState<FormMode>('idle');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  /** Относительный URL картинки с сервера (для кнопки «удалить» в режиме edit). */
  const [serverImagePath, setServerImagePath] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [openingEditor, setOpeningEditor] = useState(false);
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
  const [draggingCrop, setDraggingCrop] = useState(false);
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const [categories, setCategories] = useState<string[]>([]);

  const clampCropPosition = (
    x: number,
    y: number,
    scale: number,
    image: HTMLImageElement
  ) => {
    const displayedW = image.naturalWidth * scale;
    const displayedH = image.naturalHeight * scale;
    const minX = CROP_FRAME_SIZE - displayedW;
    const minY = CROP_FRAME_SIZE - displayedH;
    return {
      x: Math.min(0, Math.max(minX, x)),
      y: Math.min(0, Math.max(minY, y)),
    };
  };

  const centerCrop = (draft: CropDraft): CropDraft => {
    const centeredX = (CROP_FRAME_SIZE - draft.imageEl.naturalWidth * draft.scale) / 2;
    const centeredY = (CROP_FRAME_SIZE - draft.imageEl.naturalHeight * draft.scale) / 2;
    const clamped = clampCropPosition(centeredX, centeredY, draft.scale, draft.imageEl);
    return { ...draft, x: clamped.x, y: clamped.y };
  };

  const openCropForImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        const minScale = Math.max(
          CROP_FRAME_SIZE / img.naturalWidth,
          CROP_FRAME_SIZE / img.naturalHeight
        );
        const x = (CROP_FRAME_SIZE - img.naturalWidth * minScale) / 2;
        const y = (CROP_FRAME_SIZE - img.naturalHeight * minScale) / 2;
        setCropDraft(centerCrop({
          fileName: file.name,
          src,
          imageEl: img,
          scale: minScale,
          minScale,
          x,
          y,
        }));
      };
      img.onerror = () => setError('Не удалось загрузить изображение для кадрирования');
      img.src = src;
    };
    reader.onerror = () => setError('Не удалось прочитать файл изображения');
    reader.readAsDataURL(file);
  };

  const applyCrop = async () => {
    if (!cropDraft) return;
    const canvas = document.createElement('canvas');
    canvas.width = STANDARD_IMAGE_SIZE;
    canvas.height = STANDARD_IMAGE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Не удалось подготовить изображение');
      return;
    }

    const sx = (0 - cropDraft.x) / cropDraft.scale;
    const sy = (0 - cropDraft.y) / cropDraft.scale;
    const sw = CROP_FRAME_SIZE / cropDraft.scale;
    const sh = CROP_FRAME_SIZE / cropDraft.scale;

    ctx.drawImage(
      cropDraft.imageEl,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      STANDARD_IMAGE_SIZE,
      STANDARD_IMAGE_SIZE
    );

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, STANDARD_IMAGE_TYPE, 0.9)
    );
    if (!blob) {
      setError('Не удалось сохранить обработанное изображение');
      return;
    }

    const normalizedName = cropDraft.fileName.replace(/\.[^.]+$/, '') + '.jpg';
    const normalized = new File([blob], normalizedName, {
      type: STANDARD_IMAGE_TYPE,
      lastModified: Date.now(),
    });
    setProductImage(normalized);
    setImagePreview(URL.createObjectURL(normalized));
    setCropDraft(null);
  };

  const notifyCatalogRefresh = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('products-catalog-refresh'));
    }
  };

  const userId = user?.id;
  const userType = user?.user_type;

  useEffect(() => {
    const onAuth = () => setAuthEpoch((n) => n + 1);
    window.addEventListener('auth-state-changed', onAuth);
    return () => window.removeEventListener('auth-state-changed', onAuth);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hasToken = !!localStorage.getItem('auth_token')?.trim();
        if (hasToken && !authService.getUser()) {
          await authService.refreshUser();
        }
      } finally {
        if (!cancelled) setSessionReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionReady) return;

    if (!authService.isAuthenticated()) {
      router.push('/login');
      return;
    }
    const u = authService.getUser();
    if (!u || (u.user_type !== 'supplier' && u.user_type !== 'admin')) {
      router.push('/products');
      return;
    }
    loadProducts();
    loadCategories();
  }, [sessionReady, router, authEpoch]);

  const loadCategories = async () => {
    try {
      const data = await api.getCategories();
      setCategories(data.categories || []);
    } catch (err: any) {
      console.error('Ошибка загрузки категорий:', err);
    }
  };

  const loadProducts = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setIsLoading(true);
      setError('');
      const currentUser = authService.getUser();
      const sid = currentUser?.id;
      const data = await api.getProducts({ supplier_id: sid, limit: 1000 });
      setProducts(data);

      const nextMap: Record<number, InventoryRow> = {};
      if (currentUser?.user_type === 'admin' && data.length > 0) {
        const invByProduct = await Promise.all(
          data.map((p: Product) => api.getProductInventory(Number(p.id)))
        );
        data.forEach((p: Product, idx: number) => {
          const pid = Number(p.id);
          const rows = Array.isArray(invByProduct[idx]) ? invByProduct[idx] : [];
          const match = pickInventoryForProduct(rows as InventoryRow[], Number(p.supplier_id));
          if (match) nextMap[pid] = match;
        });
        setInventoryMap(nextMap);
      } else if (sid) {
        const inventoryData = await api.getSupplierInventory(sid);
        inventoryData.forEach((inv: InventoryRow) => {
          nextMap[Number(inv.product_id)] = inv;
        });
        setInventoryMap(nextMap);
      } else {
        setInventoryMap({});
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки товаров');
    } finally {
      if (!opts?.silent) setIsLoading(false);
    }
  };

  const closeForm = () => {
    setFormMode('idle');
    setEditingId(null);
    setDraft(emptyDraft());
    setServerImagePath(null);
    setProductImage(null);
    setImagePreview(null);
    setCropDraft(null);
  };

  const openCreate = () => {
    setError('');
    setSuccess('');
    setFormMode('create');
    setEditingId(null);
    setDraft(emptyDraft());
    setServerImagePath(null);
    setProductImage(null);
    setImagePreview(null);
    setCropDraft(null);
  };

  /**
   * Редактирование: всегда подтягиваем товар и остатки с API (без опоры на устаревший inventoryMap).
   */
  const openEdit = async (productId: number) => {
    setError('');
    setSuccess('');
    setFormMode('edit');
    setEditingId(null);
    setDraft(emptyDraft());
    setServerImagePath(null);
    setProductImage(null);
    setImagePreview(null);
    setCropDraft(null);
    setOpeningEditor(true);
    try {
      const [p, invListRaw] = await Promise.all([
        api.getProduct(productId),
        api.getProductInventory(productId),
      ]);
      const invList = Array.isArray(invListRaw) ? invListRaw : [];
      const inv = pickInventoryForProduct(invList as InventoryRow[], Number(p.supplier_id));

      setEditingId(Number(p.id));
      setDraft({
        name: p.name,
        description: p.description ?? '',
        category: p.category ?? '',
        items_per_box: p.items_per_box != null ? String(p.items_per_box) : '',
        quantity: inv ? String(Math.floor(parseFloat(String(inv.quantity)))) : '',
        price: inv ? String(inv.price).replace(',', '.') : '',
      });
      setServerImagePath(p.image_url ?? null);
      setImagePreview(p.image_url ? `${getPublicApiBase()}${p.image_url}` : null);
    } catch (err: any) {
      setError(err.message || 'Не удалось открыть карточку для редактирования');
      closeForm();
    } finally {
      setOpeningEditor(false);
    }
  };

  const parseMoneyValue = (s: string) => parseFloat(s.trim().replace(',', '.'));
  const parseQtyValue = (s: string) => Math.floor(parseFloat(s.trim()));

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setSuccess('');

    try {
      const body: Parameters<typeof api.createProduct>[0] = {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        category: draft.category || undefined,
        unit: 'шт',
        items_per_box: draft.items_per_box ? parseInt(draft.items_per_box, 10) : undefined,
        supplier_id: user.id,
        quantity: draft.quantity.trim() ? parseQtyValue(draft.quantity) : undefined,
        price: draft.price.trim() ? parseMoneyValue(draft.price) : undefined,
      };
      if (body.quantity != null && (body.quantity < 0 || !Number.isFinite(body.quantity))) {
        setError('Укажите корректное количество');
        return;
      }
      if (body.price != null && (body.price <= 0 || !Number.isFinite(body.price))) {
        setError('Укажите корректную цену');
        return;
      }
      if (
        (draft.quantity.trim() && !draft.price.trim()) ||
        (!draft.quantity.trim() && draft.price.trim())
      ) {
        setError('Укажите оба поля: остаток и цену, или оставьте оба пустыми');
        return;
      }

      const created = await api.createProduct(body);
      if (productImage) {
        await api.uploadProductImage(created.id, productImage);
      }
      setSuccess('Товар создан');
      closeForm();
      await loadProducts();
      notifyCatalogRefresh();
    } catch (err: any) {
      setError(err.message || 'Ошибка создания');
    }
  };

  /**
   * Явно пишем остаток/цену в таблицу inventory (дополнительно к PATCH товара).
   * Так сработает даже при старом API или рассинхроне supplier_id в БД.
   */
  const persistInventoryForProduct = async (
    productId: number,
    productSupplierId: number,
    qty: number,
    price: number
  ) => {
    const rowsRaw = await api.getProductInventory(productId);
    const rows = Array.isArray(rowsRaw) ? (rowsRaw as InventoryRow[]) : [];
    let inv = pickInventoryForProduct(rows, productSupplierId);
    if (inv) {
      await api.updateInventory(Number(inv.id), { quantity: qty, price });
      return;
    }
    try {
      await api.createInventory({
        product_id: productId,
        quantity: qty,
        price,
      });
    } catch {
      const againRaw = await api.getProductInventory(productId);
      const again = Array.isArray(againRaw) ? (againRaw as InventoryRow[]) : [];
      inv = pickInventoryForProduct(again, productSupplierId);
      if (inv) {
        await api.updateInventory(Number(inv.id), { quantity: qty, price });
        return;
      }
      throw new Error('Не удалось сохранить остаток и цену');
    }
  };

  /**
   * Сохранение карточки: PATCH товара (в т.ч. quantity/price → inventory на сервере)
   * и отдельное обновление inventory, чтобы запись в БД точно менялась.
   */
  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId == null) return;
    setError('');
    setSuccess('');

    const qty = parseQtyValue(draft.quantity);
    const price = parseMoneyValue(draft.price);
    if (!Number.isFinite(qty) || qty < 0) {
      setError('Укажите корректное количество (остаток)');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError('Укажите корректную цену');
      return;
    }

    try {
      const product = await api.getProduct(editingId);
      await api.updateProduct(editingId, {
        name: draft.name.trim(),
        description: draft.description,
        category: draft.category === '' ? null : draft.category,
        unit: 'шт',
        items_per_box: draft.items_per_box
          ? parseInt(draft.items_per_box, 10)
          : undefined,
        quantity: qty,
        price,
      });

      await persistInventoryForProduct(
        editingId,
        Number(product.supplier_id),
        qty,
        price
      );

      if (productImage) {
        await api.uploadProductImage(editingId, productImage);
      }

      setSuccess('Изменения сохранены');
      closeForm();
      await loadProducts({ silent: true });
      notifyCatalogRefresh();
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения');
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    if (!confirm('Удалить этот товар?')) return;
    try {
      setError('');
      await api.deleteProduct(productId);
      setSuccess('Товар удалён');
      closeForm();
      await loadProducts();
      notifyCatalogRefresh();
    } catch (err: any) {
      setError(err.message || 'Ошибка удаления');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Загрузка товаров...</div>
      </div>
    );
  }

  const formVisible = formMode !== 'idle';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Управление товарами</h1>
        {!formVisible && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark whitespace-nowrap flex-shrink-0"
          >
            + Создать товар
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="text-sm text-green-800">{success}</div>
        </div>
      )}

      {formVisible && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">
            {formMode === 'edit' ? 'Редактирование товара' : 'Новый товар'}
          </h2>
          {formMode === 'edit' && (openingEditor || editingId == null) ? (
            <p className="text-gray-600">Загрузка данных карточки…</p>
          ) : (
            <form
              onSubmit={formMode === 'edit' ? submitEdit : submitCreate}
              className="space-y-4"
            >
              <div>
                <label htmlFor="pf-name" className="block text-sm font-medium text-gray-700">
                  Название *
                </label>
                <input
                  type="text"
                  id="pf-name"
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="pf-desc" className="block text-sm font-medium text-gray-700">
                  Описание
                </label>
                <textarea
                  id="pf-desc"
                  rows={3}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pf-cat" className="block text-sm font-medium text-gray-700">
                    Категория
                  </label>
                  <select
                    id="pf-cat"
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm"
                  >
                    <option value="">Выберите категорию</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="pf-box" className="block text-sm font-medium text-gray-700">
                    Штук в коробке
                  </label>
                  <input
                    type="number"
                    id="pf-box"
                    min={1}
                    value={draft.items_per_box}
                    onChange={(e) => setDraft({ ...draft, items_per_box: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pf-qty" className="block text-sm font-medium text-gray-700">
                    Остаток {formMode === 'edit' ? '*' : ''}
                  </label>
                  <input
                    type="number"
                    id="pf-qty"
                    step={1}
                    min={0}
                    required={formMode === 'edit'}
                    value={draft.quantity}
                    onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm"
                  />
                  {formMode === 'create' && (
                    <p className="mt-1 text-xs text-gray-500">Необязательно при создании</p>
                  )}
                </div>
                <div>
                  <label htmlFor="pf-price" className="block text-sm font-medium text-gray-700">
                    Цена за ед., ₽ {formMode === 'edit' ? '*' : ''}
                  </label>
                  <input
                    type="number"
                    id="pf-price"
                    step="0.01"
                    min="0.01"
                    required={formMode === 'edit'}
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Изображение
                </label>
                {imagePreview && (
                  <div className="mb-3">
                    <img
                      src={imagePreview}
                      alt=""
                      className="w-32 h-32 object-cover rounded-md border border-gray-300"
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setError('');
                    openCropForImage(file);
                    e.target.value = '';
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-light file:text-primary-dark"
                />
                <p className="mt-1 text-xs text-gray-500">
                  После выбора откроется окно кадрирования. Итоговый формат: квадрат 1024x1024 JPG.
                </p>
                {formMode === 'edit' && serverImagePath && !productImage && editingId != null && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('Удалить изображение?')) return;
                      try {
                        await api.deleteProductImage(editingId);
                        setServerImagePath(null);
                        setImagePreview(null);
                        await loadProducts({ silent: true });
                        notifyCatalogRefresh();
                      } catch (err: any) {
                        setError(err.message || 'Ошибка удаления изображения');
                      }
                    }}
                    className="mt-2 text-sm text-red-600 hover:text-red-800"
                  >
                    Удалить изображение
                  </button>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary hover:bg-primary-dark"
                >
                  {formMode === 'edit' ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          )}
          {cropDraft && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
                <h3 className="text-base font-semibold text-gray-900">Кадрирование изображения</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Перемещайте изображение внутри рамки и отрегулируйте масштаб.
                </p>
                <div
                  className="relative mt-4 mx-auto h-80 w-80 overflow-hidden rounded-lg border border-gray-300 bg-gray-100 select-none touch-none"
                  onMouseDown={(e) => {
                    dragStateRef.current = {
                      startX: e.clientX,
                      startY: e.clientY,
                      originX: cropDraft.x,
                      originY: cropDraft.y,
                    };
                    setDraggingCrop(true);
                  }}
                  onMouseMove={(e) => {
                    if (!draggingCrop || !dragStateRef.current) return;
                    const dx = e.clientX - dragStateRef.current.startX;
                    const dy = e.clientY - dragStateRef.current.startY;
                    const next = clampCropPosition(
                      dragStateRef.current.originX + dx,
                      dragStateRef.current.originY + dy,
                      cropDraft.scale,
                      cropDraft.imageEl
                    );
                    setCropDraft((prev) => (prev ? { ...prev, x: next.x, y: next.y } : prev));
                  }}
                  onMouseUp={() => {
                    setDraggingCrop(false);
                    dragStateRef.current = null;
                  }}
                  onMouseLeave={() => {
                    setDraggingCrop(false);
                    dragStateRef.current = null;
                  }}
                >
                  <img
                    src={cropDraft.src}
                    alt="crop preview"
                    draggable={false}
                    className="pointer-events-none absolute max-w-none"
                    style={{
                      width: `${cropDraft.imageEl.naturalWidth * cropDraft.scale}px`,
                      height: `${cropDraft.imageEl.naturalHeight * cropDraft.scale}px`,
                      left: `${cropDraft.x}px`,
                      top: `${cropDraft.y}px`,
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 border-2 border-primary/70" />
                </div>
                <div className="mt-4">
                  <label className="block text-xs text-gray-600 mb-1">Масштаб</label>
                  <input
                    type="range"
                    min={cropDraft.minScale}
                    max={Math.max(cropDraft.minScale * 3, cropDraft.minScale + 0.1)}
                    step={0.01}
                    value={cropDraft.scale}
                    onChange={(e) => {
                      const nextScale = Number(e.target.value);
                      setCropDraft((prev) => {
                        if (!prev) return prev;
                        const centerX = CROP_FRAME_SIZE / 2;
                        const centerY = CROP_FRAME_SIZE / 2;
                        const imageX = (centerX - prev.x) / prev.scale;
                        const imageY = (centerY - prev.y) / prev.scale;
                        const nextX = centerX - imageX * nextScale;
                        const nextY = centerY - imageY * nextScale;
                        const clamped = clampCropPosition(nextX, nextY, nextScale, prev.imageEl);
                        return { ...prev, scale: nextScale, x: clamped.x, y: clamped.y };
                      });
                    }}
                    className="w-full"
                  />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCropDraft((prev) => (prev ? centerCrop(prev) : prev))}
                    className="rounded-md border border-primary/30 px-3 py-2 text-sm text-primary hover:bg-primary-light/40"
                  >
                    Центрировать
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropDraft(null)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={applyCrop}
                    className="rounded-md bg-primary px-3 py-2 text-sm text-white hover:bg-primary-dark"
                  >
                    Применить
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {products.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">Пока нет товаров</p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark"
            >
              Создать товар
            </button>
          </div>
        ) : (
          <>
            {!formVisible && (
              <div className="p-4 border-b border-gray-200">
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark"
                >
                  + Создать товар
                </button>
              </div>
            )}
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Название
                    </th>
                    <th className="hidden md:table-cell px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Описание
                    </th>
                    <th className="hidden lg:table-cell px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Категория
                    </th>
                    <th className="hidden xl:table-cell px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Ед.
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Остаток
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Цена
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map((product) => {
                    const inv = inventoryMap[Number(product.id)];
                    return (
                      <tr key={product.id}>
                        <td className="px-2 sm:px-4 py-4">
                          <div className="flex items-center gap-2 sm:gap-3">
                            {product.image_url && (
                              <img
                                src={`${getPublicApiBase()}${product.image_url}`}
                                alt=""
                                className="w-8 h-8 sm:w-12 sm:h-12 object-cover rounded border flex-shrink-0"
                              />
                            )}
                            <span className="text-sm font-medium text-gray-900 truncate max-w-[150px] sm:max-w-none">
                              {product.name}
                            </span>
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-2 sm:px-4 py-4 text-sm text-gray-500">
                          <div className="truncate max-w-[200px]">{product.description || '—'}</div>
                        </td>
                        <td className="hidden lg:table-cell px-2 sm:px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                          {product.category || '—'}
                        </td>
                        <td className="hidden xl:table-cell px-2 sm:px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                          {product.unit}
                        </td>
                        <td className="px-2 sm:px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                          {inv ? `${Math.floor(parseFloat(String(inv.quantity)))} ${product.unit}` : '—'}
                        </td>
                        <td className="px-2 sm:px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                          {inv ? `${parseFloat(String(inv.price)).toFixed(2)} ₽` : '—'}
                        </td>
                        <td className="px-2 sm:px-4 py-4 text-right text-sm font-medium whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEdit(Number(product.id))}
                            className="text-primary hover:text-blue-900 text-xs sm:text-sm mr-2 sm:mr-3"
                          >
                            <span className="hidden sm:inline">Изменить</span>
                            <span className="sm:hidden">✏️</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(Number(product.id))}
                            className="text-red-600 hover:text-red-900 text-xs sm:text-sm"
                          >
                            <span className="hidden sm:inline">Удалить</span>
                            <span className="sm:hidden">❌</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <p className="text-sm text-gray-500">
        <Link href="/products" className="text-primary hover:underline">
          ← К каталогу
        </Link>
      </p>
    </div>
  );
}
