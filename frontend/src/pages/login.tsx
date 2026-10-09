import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      await api.post(`/auth/login`, { email, password });
      navigate('/'); 
    } catch (error: any) {
      let message: string;

      if (error.response?.status==500) {
        message = 'Failed to connect to the server. Please check backend connection';
      } else {
        const errorData = error.response?.data;
        message = errorData?.detail || errorData?.message || 'Email or password is incorrect';
      }
    
      setErrorMsg(message);
      setTimeout(() => {
        setErrorMsg('');
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg border border-gray-100">
        <div className='flex justify-center'>
            <img src="/NTTDATA_blue.png" alt="" style={{ width: "200px", height: "40px", margin: "10px" }}/>
        </div>
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-800">
            Firewall Path Finder
        </h2>
        
        {errorMsg && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
              placeholder="name@email.com"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="cursor-pointer mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white font-medium transition-colors hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-70"
          >
            {isLoading ? 'Loading...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}