/**
 * In-Memory Cache Service для оптимизации производительности
 * Кэширует NFT, аналитику и другие тяжёлые запросы
 */

class CacheService {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 минут TTL по умолчанию
  }

  /**
   * Получить значение из кэша
   * @param {string} key - Ключ кэша
   * @returns {any|null} Значение или null если не найдено/истекло
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    // Проверяем TTL
    const now = Date.now();
    if (now > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    console.log(`💾 [Cache HIT] ${key} (expires in ${Math.round((item.expiresAt - now) / 1000)}s)`);
    return item.value;
  }

  /**
   * Сохранить значение в кэш
   * @param {string} key - Ключ кэша
   * @param {any} value - Значение для сохранения
   * @param {number} ttl - Time to live в миллисекундах (опционально)
   */
  set(key, value, ttl = this.ttl) {
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, expiresAt });
    console.log(`💾 [Cache SET] ${key} (TTL: ${ttl / 1000}s)`);
  }

  /**
   * Удалить значение из кэша
   * @param {string} key - Ключ кэша
   */
  delete(key) {
    this.cache.delete(key);
    console.log(`💾 [Cache DELETE] ${key}`);
  }

  /**
   * Очистить весь кэш
   */
  clear() {
    this.cache.clear();
    console.log(`💾 [Cache CLEAR] All entries deleted`);
  }

  /**
   * Получить статистику кэша
   */
  getStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    return {
      totalEntries: entries.length,
      activeEntries: entries.filter(([_, item]) => now <= item.expiresAt).length,
      expiredEntries: entries.filter(([_, item]) => now > item.expiresAt).length,
    };
  }

  /**
   * Очистить истёкшие записи
   */
  cleanExpired() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`💾 [Cache CLEAN] Removed ${cleaned} expired entries`);
    }
    
    return cleaned;
  }
}

// Singleton instance
const cacheService = new CacheService();

// Автоматическая очистка истёкших записей каждые 2 минуты
setInterval(() => {
  cacheService.cleanExpired();
}, 2 * 60 * 1000);

module.exports = cacheService;
