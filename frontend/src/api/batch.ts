import type { CsvResolveResponse } from '../types/api'
import { API_BASE_URL, api } from './client'

export const downloadTemplateCsv = async () => {
    const response = await fetch(`${API_BASE_URL}/template/csv`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fw_request_template.csv";
    a.click();
    URL.revokeObjectURL(url);
}

export const resolveCsv = async (file: File, ticketNumber?: string): Promise<CsvResolveResponse> => {
    try {
        const formData = new FormData();
        formData.append("file", file);

        if (ticketNumber) {
        formData.append("ticket_number", ticketNumber);
        }

        const response = await api.post<CsvResolveResponse>(
            `/resolve/csv`,
            formData,
            {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        }
        );

        return response.data
    } catch (error) {
        throw error
    }
}
