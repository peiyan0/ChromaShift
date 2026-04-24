import api from './api';

export interface MediaUploadResponse {
  job_id: string;
  filename: string;
  status: string;
}

export interface MediaProcessRequest {
  cvd_type?: string;
  severity?: number;
}

export interface MediaStatusResponse {
  job_id: string;
  status: string;
  progress: number;
  download_url: string | null;
}

export interface MediaHistoryResponse {
  job_id: string;
  filename: string;
  status: string;
  created_at: string;
  type: string;
}

export const mediaService = {
  uploadMedia: async (file: File): Promise<MediaUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    
    // We override the default Content-Type header so axios sets the multipart boundary automatically
    const response = await api.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  processMedia: async (jobId: string, data: MediaProcessRequest) => {
    const response = await api.post(`/media/${jobId}/process`, data);
    return response.data;
  },

  getMediaStatus: async (jobId: string): Promise<MediaStatusResponse> => {
    const response = await api.get(`/media/${jobId}/status`);
    return response.data;
  },

  getDownloadUrl: async (jobId: string): Promise<{ url: string }> => {
    const response = await api.get(`/media/${jobId}/download`);
    return response.data;
  },

  shareMedia: async (jobId: string): Promise<{ share_url: string }> => {
    const response = await api.post(`/media/${jobId}/share`);
    return response.data;
  },

  getHistory: async (): Promise<MediaHistoryResponse[]> => {
    const response = await api.get('/media/history');
    return response.data;
  }
};
