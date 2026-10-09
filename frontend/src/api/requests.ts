import axios from 'axios'
import type { RequestListResponse, RequestDetail, StatusPatchRequest } from '../types/api'
import { API_BASE_URL, api } from './client'

export const fetchHistoryEntries = async (page: number = 1, pageSize: number = 20, searchQuery: string = '', from?: string, to?: string): Promise<RequestListResponse> => {
  
  const response = await axios.get<RequestListResponse>(`${API_BASE_URL}/requests`, {
    params: {
      page: page,
      page_size: pageSize,
      status: searchQuery.trim().toUpperCase() || undefined,
      date_from: from || undefined,
      date_to: to || undefined
    }
  });

  return response.data
};

export async function getRequestDetail(id: string): Promise<RequestDetail> {
  const response = await axios.get<RequestDetail>(`${API_BASE_URL}/requests/${id}`);

  return response.data
}

export async function updateRequest(id: string, payload: StatusPatchRequest): Promise<RequestDetail> {
  // const payload: StatusPatchRequest = { engineer_notes, status };
  // const response = await axios.patch<RequestDetail>(`${API_BASE_URL}/requests/${id}/status`, payload);
  const response = await api.patch<RequestDetail>(`/requests/${id}/status`, payload);
  return response.data
}

export async function deleteRequest(id: string): Promise<RequestDetail> {
  const response = await api.delete<RequestDetail>(`/requests/${id}/delete`);

  return response.data
}