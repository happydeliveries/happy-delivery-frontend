import api from './api';

export const restaurantService = {
  async searchRestaurants(lat: number, lng: number, filters = {}) {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      ...filters,
    });
    return api.get(`/restaurants/search?${params}`);
  },

  async getHomeFeed() {
    return api.get('/restaurants/feed/home');
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

  async searchFood(query: string, lat: number, lng: number) {
    const params = new URLSearchParams({
      query: query,
      lat: lat.toString(),
      lng: lng.toString(),
    });
    return api.get(`/restaurants/search/food?${params}`);
  },

  async getMenuItemDetail(restaurantId: string, itemId: string) {
    return api.get(`/restaurants/${restaurantId}/menu-items/${itemId}`);
  },
};