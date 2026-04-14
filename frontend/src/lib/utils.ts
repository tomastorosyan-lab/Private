/**
 * Утилиты для форматирования
 */

/**
 * Форматирует число с разделением по три цифры
 * @param value - число или строка для форматирования
 * @param decimals - количество знаков после запятой (по умолчанию 2)
 * @returns отформатированная строка
 */
export function formatNumber(value: number | string, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  
  // Форматируем с разделением по три цифры
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Форматирует сумму в рублях
 * @param value - число или строка
 * @returns отформатированная строка с символом рубля
 */
export function formatCurrency(value: number | string): string {
  return `${formatNumber(value)} ₽`;
}

/**
 * Сжимает изображение до размера не более maxSizeKB (по умолчанию 128 КБ)
 * @param file - исходный файл изображения
 * @param maxSizeKB - максимальный размер в КБ (по умолчанию 128)
 * @param maxWidth - максимальная ширина (по умолчанию 1920)
 * @param maxHeight - максимальная высота (по умолчанию 1920)
 * @returns Promise с сжатым файлом
 */
export async function compressImage(
  file: File,
  maxSizeKB: number = 128,
  maxWidth: number = 1920,
  maxHeight: number = 1920
): Promise<File> {
  const maxSizeBytes = maxSizeKB * 1024;
  
  // Если файл уже меньше нужного размера, возвращаем его как есть
  if (file.size <= maxSizeBytes) {
    return file;
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Вычисляем новые размеры с сохранением пропорций
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        // Создаем canvas для сжатия
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Не удалось создать контекст canvas'));
          return;
        }

        // Рисуем изображение на canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Пробуем разные уровни качества, пока не достигнем нужного размера
        let currentWidth = width;
        let currentHeight = height;
        
        const tryCompress = (quality: number): void => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Не удалось сжать изображение'));
                return;
              }

              // Если размер подходит, создаем файл
              if (blob.size <= maxSizeBytes || quality <= 0.1) {
                // Конвертируем PNG в JPEG для лучшего сжатия
                const outputType = file.type === 'image/png' ? 'image/jpeg' : (file.type || 'image/jpeg');
                const fileName = file.name.replace(/\.png$/i, '.jpg').replace(/\.(gif|bmp|webp)$/i, '.jpg');
                
                const compressedFile = new File(
                  [blob],
                  fileName,
                  {
                    type: outputType,
                    lastModified: Date.now(),
                  }
                );
                resolve(compressedFile);
              } else {
                // Уменьшаем качество и пробуем снова
                const newQuality = quality - 0.1;
                if (newQuality > 0.1) {
                  tryCompress(newQuality);
                } else {
                  // Если даже при минимальном качестве размер большой, уменьшаем размер изображения
                  currentWidth = currentWidth * 0.9;
                  currentHeight = currentHeight * 0.9;
                  canvas.width = currentWidth;
                  canvas.height = currentHeight;
                  ctx.drawImage(img, 0, 0, currentWidth, currentHeight);
                  tryCompress(0.9);
                }
              }
            },
            // Конвертируем PNG в JPEG для лучшего сжатия
            file.type === 'image/png' ? 'image/jpeg' : (file.type || 'image/jpeg'),
            quality
          );
        };

        tryCompress(0.9);
      };
      img.onerror = () => reject(new Error('Ошибка загрузки изображения'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsDataURL(file);
  });
}

