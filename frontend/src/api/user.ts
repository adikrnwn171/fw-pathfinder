import { api } from "./client";
import type { User } from "@/types/api";

export async function getUsers(): Promise<User[]> {
    const response = await api.get<User[]>(`/auth/users`);

    return response.data
}

export async function updateUser(user_id: number, new_password: string) {
    const response = await api.patch('/auth/admin/reset-password', {user_id, new_password});

    return response.data
}

export async function createUser(email: string, password: string, role:"admin"|"engineer" ) {
    const response = await api.post('/auth/register', { email, password, role });

    return response.data
}