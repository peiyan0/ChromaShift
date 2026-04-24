import api from './api';

export interface VisionProfile {
  cvd_type: string;
  severity: number;
  contrast_multiplier?: number;
  saturation_multiplier?: number;
  intensity?: number;
}

export const profileService = {
  getProfile: async () => {
    const response = await api.get('/profile');
    return response.data;
  },

  createProfile: async (data: VisionProfile) => {
    const response = await api.post('/profile', data);
    return response.data;
  },

  updateProfile: async (data: VisionProfile) => {
    const response = await api.put('/profile', data);
    return response.data;
  }
};
