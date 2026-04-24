import api from './api';

export interface ComplianceIssue {
  sc_id: string;
  severity: string;
  description: string;
  suggestion: string;
}

export interface ComplianceReportResponse {
  job_id: string;
  status: string;
  score: number;
  issues: ComplianceIssue[];
}

export const complianceService = {
  runCheck: async (jobId: string): Promise<ComplianceReportResponse> => {
    const response = await api.post(`/compliance/${jobId}/check`);
    return response.data;
  },

  getReport: async (jobId: string): Promise<ComplianceReportResponse> => {
    const response = await api.get(`/compliance/${jobId}/report`);
    return response.data;
  }
};
