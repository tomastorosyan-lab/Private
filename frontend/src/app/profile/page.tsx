'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { authService, type User } from '@/lib/auth';
import { compressImage } from '@/lib/utils';
import { getPublicApiBase } from '@/lib/publicBase';

// Функции валидации
const validateEmail = (email: string): string | null => {
  if (!email) return 'Email обязателен для заполнения';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Введите корректный email адрес (например: user@example.com)';
  }
  return null;
};

const validatePhone = (phone: string): string | null => {
  if (!phone) return null; // Телефон не обязателен
  // Формат: +7XXXXXXXXXX или 8XXXXXXXXXX или +375XXXXXXXXX и т.д.
  const phoneRegex = /^(\+?[1-9]\d{1,14}|8\d{10})$/;
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, ''); // Убираем пробелы, дефисы, скобки
  if (!phoneRegex.test(cleanPhone)) {
    return 'Введите корректный номер телефона (например: +79991234567 или 89991234567)';
  }
  return null;
};

const validateFullName = (name: string): string | null => {
  if (!name) return 'Имя обязательно для заполнения';
  if (name.length < 2) return 'Имя должно содержать минимум 2 символа';
  // Только буквы, пробелы, дефисы, апострофы (для имен типа О'Брайен)
  const nameRegex = /^[a-zA-Zа-яА-ЯёЁ\s\-'']+$/;
  if (!nameRegex.test(name)) {
    return 'Имя может содержать только буквы, пробелы, дефисы и апострофы';
  }
  return null;
};

const validatePassword = (password: string): string | null => {
  if (!password) return null; // Пароль не обязателен при обновлении
  if (password.length < 8) return 'Пароль должен содержать минимум 8 символов';
  return null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    description: '',
    contact_phone: '',
    integration_type: '',
    delivery_address: '',
    min_order_amount: '',
  });

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/login');
      return;
    }

    loadProfile();
  }, [router]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const userData = await api.getCurrentUser();
      setUser(userData);
      setFormData({
        email: userData.email || '',
        full_name: userData.full_name || '',
        password: '',
        description: userData.description || '',
        contact_phone: userData.contact_phone || '',
        integration_type: userData.integration_type || 'manual',
        delivery_address: userData.delivery_address || '',
        min_order_amount:
          userData.min_order_amount != null && String(userData.min_order_amount).trim() !== ''
            ? String(userData.min_order_amount).replace(',', '.')
            : '0',
      });
      
      // Устанавливаем превью логотипа
      if (userData.logo_url) {
        setLogoPreview(`${getPublicApiBase()}${userData.logo_url}`);
      } else {
        setLogoPreview(null);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки профиля');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setFieldErrors({});

    // Валидация всех полей
    const errors: Record<string, string> = {};
    const emailError = validateEmail(formData.email);
    if (emailError) errors.email = emailError;
    
    const nameError = validateFullName(formData.full_name);
    if (nameError) errors.full_name = nameError;
    
    if (formData.password) {
      const passwordError = validatePassword(formData.password);
      if (passwordError) errors.password = passwordError;
    }
    
    if (formData.contact_phone) {
      const phoneError = validatePhone(formData.contact_phone);
      if (phoneError) errors.contact_phone = phoneError;
    }

    if (user?.user_type === 'supplier') {
      const rawMin = formData.min_order_amount.trim().replace(',', '.');
      const minNum = parseFloat(rawMin);
      if (rawMin !== '' && (!Number.isFinite(minNum) || minNum < 0)) {
        errors.min_order_amount = 'Укажите неотрицательное число (минимальная сумма заказа, ₽)';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      setIsSaving(true);

      // Подготавливаем данные для отправки (убираем пустые поля)
      const updateData: any = {};
      if (formData.email && formData.email !== user?.email) {
        updateData.email = formData.email;
      }
      if (formData.full_name && formData.full_name !== user?.full_name) {
        updateData.full_name = formData.full_name;
      }
      if (formData.password) {
        updateData.password = formData.password;
      }
      if (formData.description !== user?.description) {
        updateData.description = formData.description || null;
      }
      if (formData.contact_phone !== user?.contact_phone) {
        updateData.contact_phone = formData.contact_phone || null;
      }
      if (formData.integration_type !== user?.integration_type) {
        updateData.integration_type = formData.integration_type || null;
      }
      if (formData.delivery_address !== user?.delivery_address) {
        updateData.delivery_address = formData.delivery_address || null;
      }

      if (user?.user_type === 'supplier') {
        const prevMin =
          user?.min_order_amount != null && String(user.min_order_amount).trim() !== ''
            ? parseFloat(String(user.min_order_amount).replace(',', '.'))
            : 0;
        const nextMin = parseFloat(formData.min_order_amount.trim().replace(',', '.') || '0');
        if (Number.isFinite(nextMin) && nextMin >= 0 && nextMin !== prevMin) {
          updateData.min_order_amount = nextMin;
        }
      }

      // Если нет изменений
      if (Object.keys(updateData).length === 0) {
        setSuccess('Нет изменений для сохранения');
        setIsSaving(false);
        return;
      }

      const updatedUser = await api.updateProfile(updateData);
      setUser(updatedUser);
      setSuccess('Профиль успешно обновлен');
      
      // Обновляем данные в authService
      authService.setUser(updatedUser);
      
      // Очищаем поле пароля после успешного сохранения
      setFormData(prev => ({ ...prev, password: '' }));
    } catch (err: any) {
      setError(err.message || 'Ошибка обновления профиля');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Валидация размера файла
    if (file.size > 5 * 1024 * 1024) {
      setError('Файл слишком большой. Максимальный размер: 5MB');
      return;
    }

    // Валидация типа файла
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Неподдерживаемый тип файла. Разрешенные: JPEG, PNG, GIF, WebP');
      return;
    }

    try {
      setIsUploadingLogo(true);
      setError('');
      setSuccess('');

      // Сжимаем изображение до 128 КБ
      const compressedFile = await compressImage(file, 128);
      
      // Создаем превью
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);

      // Загружаем сжатый файл
      const updatedUser = await api.uploadLogo(compressedFile);
      setUser(updatedUser);
      setSuccess('Логотип успешно загружен');
      
      // Обновляем данные в authService
      authService.setUser(updatedUser);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки логотипа');
      setLogoPreview(user?.logo_url ? `${getPublicApiBase()}${user.logo_url}` : null);
    } finally {
      setIsUploadingLogo(false);
      // Очищаем input
      e.target.value = '';
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm('Вы уверены, что хотите удалить логотип?')) {
      return;
    }

    try {
      setIsUploadingLogo(true);
      setError('');
      setSuccess('');

      const updatedUser = await api.deleteLogo();
      setUser(updatedUser);
      setLogoPreview(null);
      setSuccess('Логотип успешно удален');
      
      // Обновляем данные в authService
      authService.setUser(updatedUser);
    } catch (err: any) {
      setError(err.message || 'Ошибка удаления логотипа');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Загрузка профиля...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Личный кабинет</h1>
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>
        )}
        <p className="text-gray-600">
          Не удалось загрузить профиль. Обычно так бывает, если сессия истекла или backend перезапущен с
          другим SECRET_KEY (старые токены перестают действовать). Войдите заново.
        </p>
        <Link
          href="/login"
          className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
        >
          Перейти ко входу
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Личный кабинет</h1>

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

      {user.user_type === 'supplier' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
          Поле <strong>«Минимальная сумма заказа»</strong> находится в форме ниже (перед типом интеграции).
          Значение 0 означает «без ограничения». Покупатель увидит порог в корзине на странице оформления
          заказа.
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        {/* Секция логотипа */}
        <div className="mb-6 pb-6 border-b">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Логотип компании
          </label>
          <div className="flex items-center space-x-4">
            {logoPreview ? (
              <div className="relative">
                <img
                  src={logoPreview}
                  alt="Логотип"
                  className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                />
                <button
                  type="button"
                  onClick={handleDeleteLogo}
                  disabled={isUploadingLogo}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-700 disabled:opacity-50"
                  title="Удалить логотип"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                Нет логотипа
              </div>
            )}
            <div>
              <input
                type="file"
                id="logo-upload"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleLogoUpload}
                disabled={isUploadingLogo}
                className="hidden"
              />
              <label
                htmlFor="logo-upload"
                className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer disabled:opacity-50 ${
                  isUploadingLogo ? 'cursor-not-allowed' : ''
                }`}
              >
                {isUploadingLogo ? 'Загрузка...' : logoPreview ? 'Изменить логотип' : 'Загрузить логотип'}
              </label>
              <p className="mt-2 text-xs text-gray-500">
                JPEG, PNG, GIF, WebP. Макс. 5MB
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ID и тип пользователя (только для просмотра) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b">
            <div>
              <label className="block text-sm font-medium text-gray-700">ID пользователя</label>
              <div className="mt-1 text-sm text-gray-500">{user.id}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Тип пользователя</label>
              <div className="mt-1 text-sm text-gray-500">
                {user.user_type === 'supplier' && 'Поставщик'}
                {user.user_type === 'customer' && 'Заказчик'}
                {user.user_type === 'admin' && 'Администратор'}
              </div>
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              id="email"
              required
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                if (fieldErrors.email) {
                  setFieldErrors({ ...fieldErrors, email: '' });
                }
              }}
              className={`mt-1 block w-full px-3 py-2 border ${
                fieldErrors.email ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm`}
            />
            {fieldErrors.email && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          {/* Полное имя */}
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
              Полное имя
            </label>
            <input
              type="text"
              id="full_name"
              required
              value={formData.full_name}
              onChange={(e) => {
                setFormData({ ...formData, full_name: e.target.value });
                if (fieldErrors.full_name) {
                  setFieldErrors({ ...fieldErrors, full_name: '' });
                }
              }}
              className={`mt-1 block w-full px-3 py-2 border ${
                fieldErrors.full_name ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm`}
            />
            {fieldErrors.full_name && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.full_name}</p>
            )}
          </div>

          {/* Пароль */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Новый пароль (оставьте пустым, чтобы не менять)
            </label>
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) => {
                setFormData({ ...formData, password: e.target.value });
                if (fieldErrors.password) {
                  setFieldErrors({ ...fieldErrors, password: '' });
                }
              }}
              minLength={8}
              className={`mt-1 block w-full px-3 py-2 border ${
                fieldErrors.password ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm`}
              placeholder="Минимум 8 символов"
            />
            {fieldErrors.password && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
            )}
          </div>

          {/* Описание (особенно для поставщиков) */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Описание компании/бизнеса
            </label>
            <textarea
              id="description"
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              placeholder="Расскажите о вашей компании или бизнесе"
            />
          </div>

          {/* Контактный телефон */}
          <div>
            <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700">
              Контактный телефон
            </label>
            <input
              type="tel"
              id="contact_phone"
              value={formData.contact_phone}
              onChange={(e) => {
                setFormData({ ...formData, contact_phone: e.target.value });
                if (fieldErrors.contact_phone) {
                  setFieldErrors({ ...fieldErrors, contact_phone: '' });
                }
              }}
              className={`mt-1 block w-full px-3 py-2 border ${
                fieldErrors.contact_phone ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm`}
              placeholder="+79991234567 или 89991234567"
            />
            {fieldErrors.contact_phone && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.contact_phone}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Формат: +79991234567 или 89991234567 (только цифры, без пробелов и скобок)
            </p>
          </div>

          {/* Адрес доставки */}
          <div>
            <label htmlFor="delivery_address" className="block text-sm font-medium text-gray-700">
              Адрес доставки
            </label>
            <input
              type="text"
              id="delivery_address"
              value={formData.delivery_address}
              onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              placeholder="Г. Сухум ул Гоголя 1"
            />
            <p className="mt-1 text-xs text-gray-500">
              Этот адрес будет автоматически подставляться при создании заказа
            </p>
          </div>

          {/* Минимальная сумма заказа (только поставщик) */}
          {user.user_type === 'supplier' && (
            <div>
              <label htmlFor="min_order_amount" className="block text-sm font-medium text-gray-700">
                Минимальная сумма заказа (₽)
              </label>
              <input
                type="number"
                id="min_order_amount"
                min={0}
                step="0.01"
                value={formData.min_order_amount}
                onChange={(e) => {
                  setFormData({ ...formData, min_order_amount: e.target.value });
                  if (fieldErrors.min_order_amount) {
                    setFieldErrors({ ...fieldErrors, min_order_amount: '' });
                  }
                }}
                className={`mt-1 block w-full px-3 py-2 border ${
                  fieldErrors.min_order_amount ? 'border-red-300' : 'border-gray-300'
                } rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm`}
                placeholder="0"
              />
              {fieldErrors.min_order_amount && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.min_order_amount}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                0 — без ограничения. Покупатель не сможет оформить заказ у вас, пока сумма по вашим
                позициям в корзине не достигнет этого значения.
              </p>
            </div>
          )}

          {user.user_type === 'supplier' && (
            <div>
              <label htmlFor="integration_type" className="block text-sm font-medium text-gray-700">
                Тип интеграции
              </label>
              <select
                id="integration_type"
                value={formData.integration_type || 'manual'}
                onChange={(e) => setFormData({ ...formData, integration_type: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              >
                <option value="manual">Ручной ввод</option>
                <option value="api">API</option>
                <option value="file">Файл</option>
              </select>
            </div>
          )}

          {/* Кнопка сохранения */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving || isUploadingLogo}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

