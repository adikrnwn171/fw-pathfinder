import { Navigate, Outlet } from 'react-router-dom';
import { AppLayout } from './layout/app-layout';
import { useEffect, useState, createContext, useContext } from 'react';
import type { User } from '@/types/api';
import { api } from '@/api/client';


interface AuthContextType {
  user: User | null
}

const AuthContext = createContext<AuthContextType | null>(null);

interface ProtectedRouteProps {
  allowedRoles?: Array<User['role']>;
  isAllowed?: (user: User) => boolean;
  redirectTo?: string;
}


export default function ProtectedRoute({
  allowedRoles,
  // isAllowed,
  redirectTo = '/unauthorized',
}: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<User>(`/auth/me`)
    .then((response) => {
      setUser(response.data);
    })
    .catch((error) => {
      console.error('Failed to fetch user:', error);
    })
    .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={redirectTo} replace />
  }
  

  return (
    <>
      <AuthContext.Provider value={{ user }}>
        <AppLayout>
          <Outlet />
        </AppLayout>
      </AuthContext.Provider>
    </>
  )
}

export const useAuth = () => useContext(AuthContext)