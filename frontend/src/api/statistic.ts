import axios from "axios";
import { API_BASE_URL } from "./client";
import type { StatsPeriod, StatsResponse } from "@/types/api";

export async function getStats(period?: StatsPeriod, start_date?: string, end_date?: string): Promise<StatsResponse> {
    const response = await axios.get<StatsResponse>(`${API_BASE_URL}/stats`, {
        params: {
            period,
            start_date,
            end_date
        }
    });

    return response.data
}