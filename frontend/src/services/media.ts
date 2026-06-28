import api from './api';

export interface MediaUploadResponse {
  job_id: string;
  filename: string;
  status: string;
}

export interface MediaProcessRequest {
  cvd_type?: string;
  severity?: number;
  compression_level?: string;
  processing_mode?: string;
  processing_duration_ms?: number;
  upload_latency_ms?: number;
  pdf_page_count?: number;
  pdf_vector_complexity?: number;
  original_size_bytes?: number;
  processed_size_bytes?: number;
  video_fps?: number;
}

export interface MediaStatusResponse {
  job_id: string;
  status: string;
  progress: number;
  download_url: string | null;
  download_url_original: string | null;
  thumbnail_url?: string | null;
  filename?: string | null;
  media_type?: string | null;
}

export interface MediaHistoryResponse {
  job_id: string;
  filename: string;
  status: string;
  created_at: string;
  type: string;
  download_url: string | null;
  download_url_original: string | null;
  thumbnail_url?: string | null;
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

  getHistory: async (jobIds?: string[]): Promise<MediaHistoryResponse[]> => {
    const params = jobIds && jobIds.length > 0 ? { job_ids: jobIds.join(',') } : {};
    const response = await api.get('/media/history', { params });
    return response.data;
  },

  deleteMedia: async (jobId: string): Promise<{ status: string; message: string }> => {
    const response = await api.delete(`/media/${jobId}`);
    return response.data;
  },

  clearAllMedia: async (): Promise<{ status: string; message: string }> => {
    const response = await api.delete('/media/clear-all');
    return response.data;
  }
};
