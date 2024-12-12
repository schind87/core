import { fetchMenuData } from "./mealViewerService";

interface MenuData {
  date: string;
  items: string[];
}

interface MenuCache {
  data: Map<string, MenuData>;
  lastUpdated: Date | null;
}

class MenuCacheService {
  private static instance: MenuCacheService;
  private cache: MenuCache = {
    data: new Map(),
    lastUpdated: null,
  };
  private initialized = false;

  private readonly CACHE_DURATION = 1000 * 60 * 60; // 1 hour
  private refreshInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): MenuCacheService {
    if (!MenuCacheService.instance) {
      MenuCacheService.instance = new MenuCacheService();
    }
    return MenuCacheService.instance;
  }

  public async initializeCache() {
    if (this.initialized) {
      return;
    }

    await this.refreshCache();
    this.refreshInterval = setInterval(
      () => this.refreshCache(),
      this.CACHE_DURATION,
    );
    this.initialized = true;
  }

  private async refreshCache() {
    try {
      console.log("Refreshing menu cache...");
      const data = await fetchMenuData();
      // Convert the data into a Map keyed by date
      const menuMap = new Map<string, MenuData>();
      if (data && Array.isArray(data)) {
        data.forEach((menu) => {
          menuMap.set(menu.date, menu);
        });
      }
      this.cache = {
        data: menuMap,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error("Error refreshing menu cache:", error);
      throw error;
    }
  }

  public getCachedMenu(date?: string) {
    if (!date) {
      return Array.from(this.cache.data.values());
    }
    return this.cache.data.get(date);
  }

  public getLastUpdated() {
    return this.cache.lastUpdated;
  }

  public isInitialized() {
    return this.initialized;
  }

  public hasMenuForDate(date: string): boolean {
    return this.cache.data.has(date);
  }
}

export const menuCacheService = MenuCacheService.getInstance();
