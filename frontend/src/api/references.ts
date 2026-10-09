import type { CidrEntry, TopologyGraphResponse, CidrCreateRequest, VSysCreateRequest, UpdateFirewallRequest, ConnectionPayload, payloadConnection } from "@/types/api";
import { api } from "./client";


export async function fetchCidr() {
    const response = await api.get<CidrEntry[]>(`/db`);
    return response.data;
}

export async function deleteCidr(zone: string, segment: string) {
    const response = await api.delete(`/db/lookup?zone=${zone}&segment=${segment}`);
    return response.data
}

export async function addCidr(data: CidrCreateRequest) {
    const response = await api.post(`/db`, data);
    return response.data
}

export async function fetchFwDb() {
    const response = await api.get<TopologyGraphResponse>(`/firewalls`);
    return response.data
}

export async function addFw(data: VSysCreateRequest) {
    const response = await api.post(`/firewalls`, data);
    return response.data
}

export async function updateFw(
    firewallName: string,
    data: UpdateFirewallRequest
) {
    const response = await api.patch(
        `/firewall/${encodeURIComponent(firewallName)}`,
        data
    );

    return response.data;
}

export async function deleteFw(firewallName: string) {
    const response = await api.delete(`/firewall/${encodeURIComponent(firewallName)}`)
    return response.data
}

export async function addConnection( data: payloadConnection ): Promise<ConnectionPayload> { 
    const response = await api.post( `/connection`, data ); 
    return response.data; }

export async function deleteConnection(id: string): Promise<void> { 
    await api.delete(`/connection/${encodeURIComponent(id)}`); 
}