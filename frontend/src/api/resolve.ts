import axios from 'axios';
import { type IpResolve, type SingleResolveResponse } from '../types/api';
import { API_BASE_URL, api } from './client';


export const resolvePath = async (
  sourceIp: string, 
  destinationIp: string, 
  port: string,
  ticketNumber: string
): Promise<SingleResolveResponse> => {
  
  const payload = {
    source_ip: sourceIp,
    destination_ip: destinationIp,
    service: port,
    ticket_number: ticketNumber
  };

  const response = await api.post<SingleResolveResponse>(
    `/resolve`, 
    payload
  );
  
  return response.data;
};

export const resolveIp = async ( ip: string): Promise<IpResolve> => {
  const payload = {
    ip: ip
  };

  const response = await axios.post<IpResolve>(
    `${API_BASE_URL}/resolve/ip`,
    payload
  );

  return response.data
}