/**
 * API клиент для работы с backend
 */
import { getPublicApiBase } from '@/lib/publicBase';

const API_URL = getPublicApiBase();
const API_V1 = API_URL ? `${API_URL}/api/v1` : `/api/v1`;

export interface ApiError {
  detail: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  user_type: 'supplier' | 'customer' | 'admin';
  is_active: boolean;
  description?: string | null;
  contact_phone?: string | null;
  integration_type?: string | null;
  integration_config?: any;
  logo_url?: string | null;
  delivery_address?: string | null;
}

export interface OrderItem {
  id: number;
  product_id: number;
  quantity: string;
  price: string;
  total: string;
}

export interface Order {
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

export interface Product {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  items_per_box?: number | null;
  image_url?: string | null;
  supplier_id: number;
}

export interface CategoriesResponse {
  categories: string[];
}

export interface InventoryItem {
  id: number;
  product_id: number;
  supplier_id: number;
  quantity: string;
  price: string;
  last_synced_at?: string | null;
  sync_source?: string | null;
}

function isNetworkFetchError(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    (err.message === 'Failed to fetch' ||
      err.message.includes('fetch') ||
      err.message.includes('NetworkError') ||
      err.message.includes('Load failed'))
  );
}

function raiseNetworkError(cause: unknown): never {
  if (isNetworkFetchError(cause)) {
    throw new Error(
      'Нет соединения с сервером. Убедитесь, что Docker-стек запущен (backend + БД). ' +
        'Откройте сайт тем же хостом, что и раньше (localhost и 127.0.0.1 — разные сайты для браузера). ' +
        'С телефона в Wi‑Fi используйте http://IP-компьютера:8080 или туннель.'
    );
  }
  throw cause instanceof Error ? cause : new Error(String(cause));
}

function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('auth_token');
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : null;
}

function formatApiErrorDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg?: string }).msg ?? JSON.stringify(item));
        }
        return JSON.stringify(item);
      })
      .filter(Boolean);
    return parts.length ? parts.join('; ') : 'Ошибка запроса';
  }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    return String((detail as { message?: string }).message);
  }
  try {
    return JSON.stringify(detail);
  } catch {
    return 'Ошибка запроса';
  }
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    if (typeof window !== 'undefined') {
      this.token = getStoredAuthToken();
    }
  }

  setToken(token: string | null) {
    const normalized = token ? token.trim() : null;
    this.token = normalized;
    if (normalized && typeof window !== 'undefined') {
      localStorage.setItem('auth_token', normalized);
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Убеждаемся, что endpoint начинается с / и не содержит полный URL
    let cleanEndpoint = endpoint;
    if (cleanEndpoint.startsWith('http://') || cleanEndpoint.startsWith('https://')) {
      // Если передан полный URL, извлекаем только путь
      try {
        const urlObj = new URL(cleanEndpoint);
        cleanEndpoint = urlObj.pathname + urlObj.search;
      } catch {
        // Если не удалось распарсить, используем как есть
      }
    }
    if (!cleanEndpoint.startsWith('/')) {
      cleanEndpoint = `/${cleanEndpoint}`;
    }
    const url = `${this.baseUrl}${cleanEndpoint}`;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    // Не устанавливаем Content-Type для FormData (браузер установит автоматически с boundary)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const authToken =
      typeof window !== 'undefined' ? getStoredAuthToken() ?? this.token : this.token;
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const method = (options.method || 'GET').toUpperCase();
    const fetchInit: RequestInit = {
      ...options,
      headers,
    };
    if (method === 'GET' && fetchInit.cache === undefined) {
      fetchInit.cache = 'no-store';
    }

    let response: Response;
    try {
      response = await fetch(url, fetchInit);
    } catch (e) {
      raiseNetworkError(e);
    }

    if (!response.ok) {
      if (response.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-session-expired'));
      }
      const errorBody = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
      }));
      const err = errorBody as { detail?: unknown };
      const message = err.detail !== undefined ? formatApiErrorDetail(err.detail) : 'Ошибка запроса';
      throw new Error(message);
    }

    // Проверяем, есть ли контент в ответе
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    // Если ответ пустой (204 No Content или content-length = 0), возвращаем null
    if (response.status === 204 || contentLength === '0') {
      return null as T;
    }
    
    // Если нет content-type или это не JSON, возвращаем текст
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      return (text ? JSON.parse(text) : null) as T;
    }
    
    // Парсим JSON только если есть контент
    const text = await response.text();
    if (!text || text.trim() === '') {
      return null as T;
    }
    
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      // Если не удалось распарсить, возвращаем null
      return null as T;
    }
  }

  async login(email: string, password: string) {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);

    const data = await this.request<{ access_token: string; token_type: string }>(
      `/auth/login`,
      { method: 'POST', body: formData },
    );
    this.setToken(data.access_token);
    return data;
  }

  async register(userData: {
    email: string;
    password: string;
    full_name: string;
    user_type: string;
  }) {
    return this.request<User>(`/auth/register`, {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getCurrentUser() {
    return this.request<User>(`/auth/me`);
  }

  async updateProfile(profileData: {
    email?: string;
    password?: string;
    full_name?: string;
    description?: string;
    contact_phone?: string;
    integration_type?: string;
    integration_config?: any;
  }) {
    return this.request<User>(`/auth/me`, {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    });
  }

  async uploadLogo(file: File): Promise<User> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<User>(`/auth/me/logo`, { method: 'POST', body: formData });
  }

  async deleteLogo(): Promise<User> {
    return this.request<User>(`/auth/me/logo`, {
      method: 'DELETE',
    });
  }

  logout() {
    this.setToken(null);
  }

  // Товары
  async getProducts(params?: {
    skip?: number;
    limit?: number;
    search?: string;
    supplier_id?: number;
    category?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return this.request<Product[]>(`/products${query ? `?${query}` : ''}`);
  }

  async getProduct(productId: number) {
    return this.request<Product>(`/products/${productId}`);
  }

  async createProduct(productData: {
    name: string;
    description?: string;
    category?: string;
    unit: string;
    items_per_box?: number;
    supplier_id: number;
    quantity?: number;
    price?: number;
  }) {
    const { supplier_id, ...body } = productData;
    return this.request<Product>(`/products?supplier_id=${supplier_id}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updateProduct(productId: number, productData: {
    name?: string;
    description?: string | null;
    category?: string | null;
    unit?: string;
    items_per_box?: number;
    image_url?: string | null;
    /** Остаток и цена обновляют запись inventory на сервере (тот же PATCH, что и поля товара). */
    quantity?: number;
    price?: number;
  }) {
    const body: Record<string, unknown> = {};
    if (productData.name !== undefined) body.name = productData.name;
    if (productData.description !== undefined) body.description = productData.description;
    if (productData.category !== undefined) body.category = productData.category;
    if (productData.unit !== undefined) body.unit = productData.unit;
    if (productData.items_per_box !== undefined) body.items_per_box = productData.items_per_box;
    if (productData.image_url !== undefined) body.image_url = productData.image_url;
    if (productData.quantity !== undefined) body.quantity = productData.quantity;
    if (productData.price !== undefined) body.price = productData.price;
    return this.request<Product>(`/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async uploadProductImage(productId: number, file: File): Promise<Product> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<Product>(`/products/${productId}/image`, { method: 'POST', body: formData });
  }

  async deleteProductImage(productId: number): Promise<any> {
    return this.request(`/products/${productId}/image`, {
      method: 'DELETE',
    });
  }

  async deleteProduct(productId: number) {
    return this.request(`/products/${productId}`, {
      method: 'DELETE',
    });
  }

  async searchProducts(searchParams: {
    query?: string;
    category?: string;
    supplier_id?: number;
    min_price?: number;
    max_price?: number;
    in_stock?: boolean;
  }) {
    return this.request<Product[]>(`/products/search`, {
      method: 'POST',
      body: JSON.stringify(searchParams),
    });
  }

  // Заказы
  async createOrder(orderData: {
    supplier_id: number;
    items: Array<{
      product_id: number;
      quantity: number;
      price: number;
    }>;
    delivery_address: string;
    contact_phone?: string;
    notes?: string;
  }) {
    return this.request<Order>(`/orders`, {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async getOrders(params?: {
    skip?: number;
    limit?: number;
    /** например pending — ожидают обработки (для поставщика) */
    status?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return this.request<Order[]>(`/orders${query ? `?${query}` : ''}`);
  }

  async getOrder(orderId: number) {
    return this.request<Order>(`/orders/${orderId}`);
  }

  async updateOrder(orderId: number, updateData: {
    status?: string;
    notes?: string;
  }) {
    return this.request<Order>(`/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  }

  // Поставщики
  async getDistributors(params?: { skip?: number; limit?: number }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return this.request<User[]>(`/distributors${query ? `?${query}` : ''}`);
  }

  async getDistributor(distributorId: number) {
    return this.request<User>(`/distributors/${distributorId}`);
  }

  // Остатки
  async getProductInventory(productId: number) {
    return this.request<InventoryItem[]>(`/inventory/product/${productId}`);
  }

  async getSupplierInventory(supplierId: number) {
    return this.request<InventoryItem[]>(`/inventory/supplier/${supplierId}`);
  }

  async createInventory(inventoryData: {
    product_id: number;
    quantity: number;
    price: number;
  }) {
    return this.request<InventoryItem>(`/inventory`, {
      method: 'POST',
      body: JSON.stringify(inventoryData),
    });
  }

  async updateInventory(inventoryId: number, inventoryData: {
    quantity?: number;
    price?: number;
  }) {
    return this.request<InventoryItem>(`/inventory/${inventoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(inventoryData),
    });
  }

  async getCategories() {
    return this.request<CategoriesResponse>(`/categories`);
  }
}

export const api = new ApiClient(API_V1);

