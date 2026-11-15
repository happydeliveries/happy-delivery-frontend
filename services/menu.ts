import api from './api';

export const menuService = {
  // Get popular food items near location
  async getPopularItems(lat: number, lng: number, radiusKm = 10) {
    return api.get('/menu/popular', {
      params: { lat, lng, radius: radiusKm }
    });
  },

  // Search food items
  async searchItems(searchTerm: string, lat: number, lng: number, filters = {}) {
    return api.get('/menu/search', {
      params: { q: searchTerm, lat, lng, ...filters }
    });
  },

  // Get food items by category
  async getItemsByCategory(category: string, lat: number, lng: number) {
    return api.get(`/menu/category/${category}`, {
      params: { lat, lng }
    });
  },
};