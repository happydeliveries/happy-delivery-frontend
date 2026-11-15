import api from './api';

export const managerService = {
  
  async getMyRestaurants() {
    return api.get('/restaurants/my/restaurants');
  },

  async createRestaurant(data: any) {
    return api.post('/restaurants', data);
  },

  async createMenu(restaurantId: string, data: any) {
    return api.post(`/restaurants/${restaurantId}/menus`, data);
  },

  async addMenuItem(restaurantId: string, menuId: string, data: any) {
    return api.post(`/restaurants/${restaurantId}/menus/${menuId}/items`, data);
  },

  async getRestaurantOrders() {
    return api.get('/orders/my');
  },

  async getDashboardStats() {
    return api.get('/restaurants/stats');
  },

  async getRecentOrders(limit: number = 5) {
    return api.get(`/orders/my?limit=${limit}`);
  },

  async getRestaurantsSummary() {
    return api.get('/restaurants/my/restaurants'); // Reusing your existing endpoint
  },

  async getProfile() {
    return api.get('/restaurants/profile');
  },

  async getRestaurantMenus(restaurantId: string) {
    return api.get(`/restaurants/${restaurantId}/menus`);
  },

  async getMenuItem(restaurantId: string, menuId: string, itemId: string) {
    return api.get(`/restaurants/${restaurantId}/menus/${menuId}/items/${itemId}`);
  },

  async updateMenuItem(restaurantId: string, menuId: string, itemId: string, data: any) {
    return api.put(`/restaurants/${restaurantId}/menus/${menuId}/items/${itemId}`, data);
  },
};