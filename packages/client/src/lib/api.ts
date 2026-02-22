import axios from 'axios';
import type { Scan, ScanConfig, FullReport } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const scanApi = {
  create: async (url: string, config?: Partial<ScanConfig>) => {
    const response = await api.post<{ id: string; status: string; rootUrl: string }>('/scans', {
      url,
      config,
    });
    return response.data;
  },

  list: async (limit = 50, offset = 0) => {
    const response = await api.get<Scan[]>(`/scans?limit=${limit}&offset=${offset}`);
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get<Scan>(`/scans/${id}`);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/scans/${id}`);
  },

  cancel: async (id: string) => {
    const response = await api.post(`/scans/${id}/cancel`);
    return response.data;
  },
};

export const reportApi = {
  get: async (scanId: string) => {
    const response = await api.get<FullReport>(`/reports/${scanId}`);
    return response.data;
  },

  exportUrl: (scanId: string) => `/api/reports/${scanId}/export`,
};

export default api;
