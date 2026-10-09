import { Routes, Route } from 'react-router-dom'
import OverviewPage from '@/pages/overview'
import LookupPage from '@/pages/lookup'
import BatchPage from '@/pages/batch'
import HistoryPage from '@/pages/history'
import StatisticsPage from '@/pages/statistics'
import IpLookupPage from './pages/ipLookup'
import Login from './pages/login'
import ProtectedRoute from './components/protected-route'
import UsersPage from './pages/users'
import DbReference from './pages/db'
import InsertReferences from './pages/insertDb'



export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<h1>403 - Access Denied</h1>} />
      <Route element={<ProtectedRoute />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/lookup" element={<LookupPage />} />
          <Route path="/batch" element={<BatchPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/iplookup" element={<IpLookupPage />} />
          <Route path="/db" element={<DbReference />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['admin']}/>}>
          <Route path="/users" element={<UsersPage />} />
          <Route path='/db/insert' element={<InsertReferences />}/>
      </Route>
    </Routes>
  )
}