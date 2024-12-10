import { fetchMenuData } from "./mealViewerService";

interface MenuCache {
  data: any | null; // We'll type this properly once we have the menu data structure
  lastUpdated: Date | null;
}

class MenuCacheService {
  private static instance: MenuCacheService;
  private cache: MenuCache = {
    data: null,
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
      this.cache = {
        data,
        lastUpdated: new Date(),
      };
      console.info("Menu cache updated:", this.cache.lastUpdated);
    } catch (error) {
      console.error("Error refreshing menu cache:", error);
      throw error;
    }
  }

  public getCachedMenu() {
    return this.cache.data;
  }

  public getLastUpdated() {
    return this.cache.lastUpdated;
  }

  public isInitialized() {
    return this.initialized;
  }
}

export const menuCacheService = MenuCacheService.getInstance();
