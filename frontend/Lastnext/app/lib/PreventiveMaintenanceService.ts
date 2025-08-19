// app/lib/PreventiveMaintenanceService.ts

import apiClient, { handleApiError } from './api-client';
import {
  validateFrequency,
  type PreventiveMaintenance,
  type ServiceResponse,
} from './preventiveMaintenanceModels';

export type CreatePreventiveMaintenanceData = {
  pmtitle: string;
  property_id: string; // kept in type for callers, but not sent to backend
  machine_ids: string[];
  scheduled_date: string; // YYYY-MM-DD or ISO string
  frequency: string; // frontend values (daily, weekly, biweekly, monthly, quarterly, biannually, annually, custom)
  custom_days?: number;
  notes?: string;
  topic_ids: number[];
  before_image?: File;
  after_image?: File;
  procedure?: string;
  completed_date?: string;
};

export type UpdatePreventiveMaintenanceData = Partial<CreatePreventiveMaintenanceData>;

export interface CompletePreventiveMaintenanceData {
  completion_notes?: string;
  after_image?: File;
}

export interface DashboardStats {
  avg_completion_times: Record<string, number>;
  counts: {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
  };
  frequency_distribution: {
    frequency: string;
    count: number;
  }[];
  completion_rate?: number;
  machine_distribution?: {
    machine_id: string;
    name: string;
    count: number;
  }[];
  upcoming: PreventiveMaintenance[];
}

export interface UploadImagesData {
  before_image?: File;
  after_image?: File;
}

// Add interface for paginated response
interface PaginatedMaintenanceResponse {
  results: PreventiveMaintenance[];
  count: number;
  next?: string | null;
  previous?: string | null;
}

// Union type for API responses
type MaintenanceApiResponse = PreventiveMaintenance[] | PaginatedMaintenanceResponse;

class PreventiveMaintenanceService {
  private baseUrl: string = '/api/preventive-maintenance';

  private normalizeDateTime(value?: string): string | undefined {
    if (!value) return undefined;
    // Already ISO with time
    if (/T\d{2}:\d{2}/.test(value)) return value;
    // Append midnight
    return `${value}T00:00:00`;
  }

  // Map frontend frequency labels to backend choices
  private mapFrequencyToBackend(value?: string): { freq?: string; customDays?: number } {
    if (!value) return { freq: undefined };
    switch (value) {
      case 'annually':
        return { freq: 'annual' };
      case 'biannually':
        return { freq: 'semi_annual' };
      case 'biweekly':
        // Backend has no biweekly; use custom=14 days if not provided
        return { freq: 'custom', customDays: 14 };
      default:
        return { freq: value };
    }
  }

  // Helper method to extract items from API response
  private extractItemsFromResponse(data: MaintenanceApiResponse): { items: PreventiveMaintenance[]; count: number } {
    if (Array.isArray(data)) {
      return { items: data, count: data.length };
    } else {
      return { items: data.results || [], count: data.count || 0 };
    }
  }

  async getAllPreventiveMaintenance(
    params?: Record<string, any>
  ): Promise<ServiceResponse<MaintenanceApiResponse>> {
    try {
      const response = await apiClient.get<MaintenanceApiResponse>(`${this.baseUrl}/`, { params: { ...params } });
      return {
        success: true,
        data: response.data,
        message: 'Fetched maintenance items successfully',
      };
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  async getPreventiveMaintenanceById(id: string): Promise<ServiceResponse<PreventiveMaintenance>> {
    if (!id) {
      return { success: false, message: 'PM ID is required to fetch details' };
    }

    try {
      const response = await apiClient.get<PreventiveMaintenance>(`${this.baseUrl}/${id}/`);
      return { success: true, data: response.data, message: 'Maintenance fetched successfully' };
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  async createPreventiveMaintenance(
    data: CreatePreventiveMaintenanceData
  ): Promise<ServiceResponse<PreventiveMaintenance>> {
    try {
      const formData = new FormData();

      // Normalize and append core fields
      if (data.pmtitle?.trim()) formData.append('pmtitle', data.pmtitle.trim());
      formData.append('scheduled_date', this.normalizeDateTime(data.scheduled_date)!);
      if (data.completed_date) formData.append('completed_date', this.normalizeDateTime(data.completed_date)!);

      const { freq, customDays } = this.mapFrequencyToBackend(data.frequency);
      if (freq) formData.append('frequency', freq);
      const finalCustomDays = data.custom_days ?? customDays;
      if (finalCustomDays != null) formData.append('custom_days', String(finalCustomDays));

      if (data.notes !== undefined) formData.append('notes', data.notes?.trim() || '');
      if (data.procedure !== undefined) formData.append('procedure', data.procedure?.trim() || '');

      // Arrays
      if (data.topic_ids?.length) data.topic_ids.forEach((id) => formData.append('topic_ids', String(id)));
      if (data.machine_ids?.length) data.machine_ids.forEach((id) => formData.append('machine_ids', id));

      // Do NOT send property_id (backend derives it from machines)

      // Files
      if (data.before_image instanceof File) formData.append('before_image', data.before_image);
      if (data.after_image instanceof File) formData.append('after_image', data.after_image);

      const createResponse = await apiClient.post<any>(`${this.baseUrl}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const responseData = createResponse.data;
      let actualRecord: PreventiveMaintenance;

      if (responseData && typeof responseData === 'object') {
        if ('data' in responseData && (responseData as any).data && 'pm_id' in (responseData as any).data) {
          actualRecord = (responseData as any).data as PreventiveMaintenance;
        } else if ('pm_id' in responseData) {
          actualRecord = responseData as PreventiveMaintenance;
        } else if ('results' in responseData && Array.isArray((responseData as any).results) && (responseData as any).results[0]?.pm_id) {
          actualRecord = (responseData as any).results[0] as PreventiveMaintenance;
        } else {
          throw new Error('Invalid response format: Missing pm_id');
        }
      } else {
        throw new Error('Invalid response');
      }

      return { success: true, data: actualRecord, message: 'Maintenance created successfully' };
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  async updatePreventiveMaintenance(
    id: string,
    data: UpdatePreventiveMaintenanceData
  ): Promise<ServiceResponse<PreventiveMaintenance>> {
    if (!id) {
      return { success: false, message: 'PM ID is required for updates' };
    }

    try {
      const formData = new FormData();

      // Core fields
      if (data.pmtitle !== undefined) formData.append('pmtitle', (data.pmtitle || '').trim() || 'Untitled Maintenance');
      if (data.scheduled_date !== undefined) formData.append('scheduled_date', this.normalizeDateTime(data.scheduled_date)!);
      if (data.completed_date !== undefined) formData.append('completed_date', data.completed_date ? this.normalizeDateTime(data.completed_date)! : '');

      if (data.frequency !== undefined) {
        const { freq, customDays } = this.mapFrequencyToBackend(data.frequency);
        if (freq) formData.append('frequency', freq);
        // Only set custom_days if explicitly provided or implied by mapping
        if (data.custom_days !== undefined) {
          formData.append('custom_days', data.custom_days != null ? String(data.custom_days) : '');
        } else if (customDays != null) {
          formData.append('custom_days', String(customDays));
        }
      } else if (data.custom_days !== undefined) {
        formData.append('custom_days', data.custom_days != null ? String(data.custom_days) : '');
      }

      if (data.notes !== undefined) formData.append('notes', data.notes?.trim() || '');
      if (data.procedure !== undefined) formData.append('procedure', data.procedure?.trim() || '');

      // Arrays
      if (data.topic_ids !== undefined && data.topic_ids.length) data.topic_ids.forEach((id) => formData.append('topic_ids', String(id)));
      if (data.machine_ids !== undefined && data.machine_ids.length) data.machine_ids.forEach((id) => formData.append('machine_ids', id));

      // Do NOT send property_id

      // Files
      if (data.before_image instanceof File) formData.append('before_image', data.before_image);
      if (data.after_image instanceof File) formData.append('after_image', data.after_image);

      const response = await apiClient.put<PreventiveMaintenance>(`${this.baseUrl}/${id}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      return { success: true, data: response.data, message: 'Maintenance updated successfully' };
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  async completePreventiveMaintenance(
    id: string,
    data: CompletePreventiveMaintenanceData
  ): Promise<ServiceResponse<PreventiveMaintenance>> {
    if (!id) {
      return { success: false, message: 'PM ID is required to mark as complete' };
    }

    try {
      const formData = new FormData();
      if (data.completion_notes?.trim()) formData.append('completion_notes', data.completion_notes.trim());
      if (data.after_image instanceof File) formData.append('after_image', data.after_image);

      const response = await apiClient.post<PreventiveMaintenance>(`${this.baseUrl}/${id}/complete/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      return { success: true, data: response.data, message: 'Maintenance completed successfully' };
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  async uploadMaintenanceImages(
    pmId: string,
    data: UploadImagesData
  ): Promise<ServiceResponse<null>> {
    if (!pmId) {
      return { success: false, message: 'PM ID is required for image upload' };
    }

    const hasBefore = data.before_image instanceof File;
    const hasAfter = data.after_image instanceof File;
    if (!hasBefore && !hasAfter) {
      return { success: true, data: null, message: 'No images provided' };
    }

    try {
      const imageFormData = new FormData();
      if (hasBefore) imageFormData.append('before_image', data.before_image!);
      if (hasAfter) imageFormData.append('after_image', data.after_image!);

      await apiClient.post(`${this.baseUrl}/${pmId}/upload-images/`, imageFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      return { success: true, data: null, message: 'Images uploaded successfully' };
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  async deletePreventiveMaintenance(id: string): Promise<ServiceResponse<null>> {
    if (!id) {
      return { success: false, message: 'PM ID is required for deletion' };
    }

    try {
      await apiClient.delete(`${this.baseUrl}/${id}/`);
      return { success: true, data: null, message: 'Maintenance deleted successfully' };
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  async getMaintenanceStatistics(): Promise<ServiceResponse<DashboardStats>> {
    try {
      const response = await apiClient.get<DashboardStats>(`${this.baseUrl}/stats/`);
      return { success: true, data: response.data, message: 'Statistics fetched successfully' };
    } catch (error: any) {
      // If no data exists (404), return empty stats
      if ((error as any).status === 404 || (error as any).response?.status === 404) {
        const emptyStats: DashboardStats = {
          counts: { total: 0, completed: 0, pending: 0, overdue: 0 },
          frequency_distribution: [],
          avg_completion_times: {},
          upcoming: [],
        };
        return { success: true, data: emptyStats, message: 'No maintenance data found' };
      }
      throw handleApiError(error);
    }
  }

  async getUpcomingMaintenance(days: number = 30): Promise<ServiceResponse<PreventiveMaintenance[]>> {
    try {
      const response = await apiClient.get<PreventiveMaintenance[]>(`${this.baseUrl}/upcoming/`, { params: { days } });
      return { success: true, data: response.data, message: 'Upcoming maintenance fetched successfully' };
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  async getEnhancedStatistics(upcomingDays: number = 30): Promise<ServiceResponse<DashboardStats>> {
    try {
      const statsResponse = await this.getMaintenanceStatistics();
      if (!statsResponse.success || !statsResponse.data) return statsResponse;

      const upcomingResponse = await this.getUpcomingMaintenance(upcomingDays);
      if (upcomingResponse.success && upcomingResponse.data) {
        const enhancedStats: DashboardStats = {
          ...statsResponse.data,
          upcoming: upcomingResponse.data,
        };
        return { success: true, data: enhancedStats, message: 'Enhanced statistics fetched successfully' };
      }

      return statsResponse;
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Debug helpers kept for parity with prior implementation
  async debugMachineFiltering(machineId: string): Promise<void> {
    try {
      const allResponse = await this.getAllPreventiveMaintenance();
      if (allResponse.success && allResponse.data) {
        const { items: allItems } = this.extractItemsFromResponse(allResponse.data);
        // eslint-disable-next-line no-console
        console.log('DEBUG total items:', allItems.length);
      }
      const apiFiltered = await this.getAllPreventiveMaintenance({ machine_id: machineId });
      if (apiFiltered.success && apiFiltered.data) {
        const { items: apiItems } = this.extractItemsFromResponse(apiFiltered.data);
        // eslint-disable-next-line no-console
        console.log('DEBUG API filtered items:', apiItems.length);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Debug error:', error);
    }
  }

  async debugMaintenanceData(): Promise<void> {
    try {
      // eslint-disable-next-line no-console
      console.log('=== DEBUG MAINTENANCE DATA ===');
      await apiClient.get<any>(`${this.baseUrl}/stats/`);
      await apiClient.get<any>(`${this.baseUrl}/upcoming/?days=30`);
      await apiClient.get<any>(`${this.baseUrl}/`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Debug error:', error);
    }
  }
}

export const preventiveMaintenanceService = new PreventiveMaintenanceService();