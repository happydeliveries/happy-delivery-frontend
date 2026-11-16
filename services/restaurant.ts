import api from './api';

export const restaurantService = {
  async searchRestaurants(lat: number, lng: number, filters: Record<string, any> = {}) {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
    });
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (Array.isArray(value)) {
        if (value.length > 0) params.append(key, value.join(','));
        return;
      }
      params.append(key, String(value));
    });
    return api.get(`/restaurants/search?${params.toString()}`);
  },

  async getHomeFeed(lat?: number, lng?: number) {
    const params = new URLSearchParams();
    if (typeof lat === 'number' && Number.isFinite(lat)) params.append('lat', lat.toString());
    if (typeof lng === 'number' && Number.isFinite(lng)) params.append('lng', lng.toString());
    const qs = params.toString();
    return api.get(qs ? `/restaurants/feed/home?${qs}` : '/restaurants/feed/home');
  },

  async getRestaurant(id: string) {
    return api.get(`/restaurants/${id}`);
  },

  async getRestaurantMenus(restaurantId: string) {
    return api.get(`/restaurants/${restaurantId}/menus`);
  },

  async createRestaurant(data: any) {
    return api.post('/restaurants', data);
  },

  async getMyRestaurants() {
    return api.get('/restaurants/my/restaurants');
  },

  async createMenu(restaurantId: string, data: any) {
    return api.post(`/restaurants/${restaurantId}/menus`, data);
  },

  async addMenuItem(restaurantId: string, menuId: string, data: any) {
    return api.post(`/restaurants/${restaurantId}/menus/${menuId}/items`, data);
  },

  async searchFood(query: string, lat?: number, lng?: number) {
    const params = new URLSearchParams();
    if (query !== undefined && query !== null) params.append('query', String(query));
    if (typeof lat === 'number' && Number.isFinite(lat)) params.append('lat', lat.toString());
    if (typeof lng === 'number' && Number.isFinite(lng)) params.append('lng', lng.toString());
    return api.get(`/restaurants/search/food?${params.toString()}`);
  },

  async getMenuItemDetail(restaurantId: string, itemId: string) {
    return api.get(`/restaurants/${restaurantId}/menu-items/${itemId}`);
  },
};