'use client';

import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-12">
      <header className="pt-2 text-center sm:pt-4">
        <h1 className="text-display font-semibold tracking-tight text-slate-900 text-balance sm:text-display-lg">
          Как работает абхазхаб
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
          Простой и удобный процесс заказа товаров от поставщиков
        </p>
      </header>

      {/* Инфографика процесса */}
      <div className="surface-card p-6 sm:p-8">
        <div className="space-y-12">
          {/* Шаг 1 */}
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0">
              <div className="w-24 h-24 bg-primary-light rounded-full flex items-center justify-center">
                <span className="text-4xl">1</span>
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="mb-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                Заказчик выбирает товары
              </h3>
              <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                Заказчик просматривает каталог товаров от разных поставщиков, 
                сравнивает цены и остатки, формирует корзину с товарами от одного или нескольких поставщиков.
              </p>
            </div>
            <div className="flex-shrink-0">
              <div className="w-32 h-32 bg-secondary-light rounded-lg flex items-center justify-center">
                <span className="text-5xl">🛒</span>
              </div>
            </div>
          </div>

          {/* Стрелка */}
          <div className="flex justify-center">
            <div className="w-1 h-16 bg-primary rounded-full"></div>
          </div>

          {/* Шаг 2 */}
          <div className="flex flex-col md:flex-row-reverse items-center gap-8">
            <div className="flex-shrink-0">
              <div className="w-24 h-24 bg-primary-light rounded-full flex items-center justify-center">
                <span className="text-4xl">2</span>
              </div>
            </div>
            <div className="flex-1 text-center md:text-right">
              <h3 className="mb-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                абхазхаб формирует заказы
              </h3>
              <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                Наш сервис автоматически группирует товары по поставщикам и формирует отдельные заказы 
                для каждого поставщика. Заказы отправляются поставщикам в удобном формате.
              </p>
            </div>
            <div className="flex-shrink-0">
              <div className="w-32 h-32 bg-secondary-light rounded-lg flex items-center justify-center">
                <span className="text-5xl">📋</span>
              </div>
            </div>
          </div>

          {/* Стрелка */}
          <div className="flex justify-center">
            <div className="w-1 h-16 bg-primary rounded-full"></div>
          </div>

          {/* Шаг 3 */}
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0">
              <div className="w-24 h-24 bg-primary-light rounded-full flex items-center justify-center">
                <span className="text-4xl">3</span>
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="mb-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                Поставщик получает заказ
              </h3>
              <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                Поставщик видит входящий заказ в своем личном кабинете, 
                может принять или отклонить заказ, а также добавить примечания.
              </p>
            </div>
            <div className="flex-shrink-0">
              <div className="w-32 h-32 bg-secondary-light rounded-lg flex items-center justify-center">
                <span className="text-5xl">📨</span>
              </div>
            </div>
          </div>

          {/* Стрелка */}
          <div className="flex justify-center">
            <div className="w-1 h-16 bg-primary rounded-full"></div>
          </div>

          {/* Шаг 4 */}
          <div className="flex flex-col md:flex-row-reverse items-center gap-8">
            <div className="flex-shrink-0">
              <div className="w-24 h-24 bg-primary-light rounded-full flex items-center justify-center">
                <span className="text-4xl">4</span>
              </div>
            </div>
            <div className="flex-1 text-center md:text-right">
              <h3 className="mb-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                Доставка товара
              </h3>
              <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                Поставщик собирает заказ и доставляет товар заказчику по указанному адресу. 
                Заказчик отслеживает статус доставки в своем личном кабинете.
              </p>
            </div>
            <div className="flex-shrink-0">
              <div className="w-32 h-32 bg-secondary-light rounded-lg flex items-center justify-center">
                <span className="text-5xl">🚚</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Преимущества */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="surface-card p-6 text-center">
          <div className="text-4xl mb-4">⚡</div>
          <h3 className="mb-2 text-lg font-semibold tracking-tight text-slate-900">Быстро</h3>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            Автоматическое формирование заказов экономит время
          </p>
        </div>
        <div className="surface-card p-6 text-center">
          <div className="text-4xl mb-4">🎯</div>
          <h3 className="mb-2 text-lg font-semibold tracking-tight text-slate-900">Удобно</h3>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            Один сервис для работы со всеми поставщиками
          </p>
        </div>
        <div className="surface-card p-6 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="mb-2 text-lg font-semibold tracking-tight text-slate-900">Прозрачно</h3>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            Отслеживание статусов заказов в реальном времени
          </p>
        </div>
      </div>

      {/* Кнопка возврата */}
      <div className="text-center">
        <Link
          href="/products"
          className="inline-block rounded-lg bg-primary-dark px-6 py-3 text-sm font-medium text-white shadow-surface transition-colors hover:bg-primary"
        >
          Перейти в каталог
        </Link>
      </div>
    </div>
  );
}

