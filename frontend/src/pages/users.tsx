import {
  UserPlus,
  X,
  CheckCircle2,
} from 'lucide-react'

import React, { useState, useMemo, useEffect } from 'react';
import type { User } from '@/types/api'
import { createUser, getUsers, updateUser } from '@/api/user';
import { getInitials } from '@/utils/utility';


export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  
  // State Modal Change Password
  const [selectedEngineer, setSelectedEngineer] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // State Modal Create User
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createRole, setCreateRole] = useState<'admin' | 'engineer'>('engineer');
  const [createPassword, setCreatePassword] = useState('');
  const [createError, setCreateError] = useState('');

  // State Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filter Data
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch = u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, searchQuery, roleFilter]);

  // Statistik
  const stats = useMemo(() => {
    return {
      total: users.length,
      engineers: users.filter((u) => u.role === 'engineer').length,
      admins: users.filter((u) => u.role === 'admin').length,
    };
  }, [users]);

  // Submit Handler: Change Password
  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword.length < 6) {
      setErrorMsg('Password must be minimum 6 character.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Confirm password doesn't match.");
      return;
    }

    try {
        if (!selectedEngineer) {
            setErrorMsg("No user selected")
            return
        };
        updateUser(selectedEngineer?.id, newPassword)
    } catch (err) {
        setErrorMsg((err as Error).message);
    }

    setToastMsg(`Password for ${selectedEngineer?.email} successfully changed!`);
    handleCloseChangePasswordModal();

    setTimeout(() => setToastMsg(null), 3000);
  };

  // Submit Handler: Create User
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    const emailTrimmed = createEmail.trim().toLowerCase();

    if (!emailTrimmed) {
      setCreateError('Email cannot be empty.');
      return;
    }

    const isDuplicate = users.some((u) => u.email.toLowerCase() === emailTrimmed);
    if (isDuplicate) {
      setCreateError('Email already registered.');
      return;
    }

    if (createPassword.length < 6) {
      setCreateError('Password must be minimun 6 character.');
      return;
    }

    const newUser: User = {
      id: Date.now(), 
      email: emailTrimmed,
      role: createRole,
    };

    try {
        await createUser(emailTrimmed, createPassword, createRole)
    } catch (err) {
        setErrorMsg((err as Error).message)
    }

    setUsers((prev) => [newUser, ...prev]);
    setToastMsg(`User ${emailTrimmed} successfully added!`);
    handleCloseAddModal();

    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleCloseChangePasswordModal = () => {
    setSelectedEngineer(null);
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg('');
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setCreateEmail('');
    setCreateRole('engineer');
    setCreatePassword('');
    setCreateError('');
  };

  useEffect(() => {
    const getAllUsers = async () => {
        const response = await getUsers();
        setUsers(response)
    }

    getAllUsers()
  }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-gray-50 text-gray-800">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center justify-center cursor-pointer gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          <UserPlus className="w-4 h-4" />
          Create User
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-semibold uppercase text-gray-400">Total Users</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-semibold uppercase text-gray-400">Engineers</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{stats.engineers}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-semibold uppercase text-gray-400">Admins</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{stats.admins}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-3 justify-between">
        <input
          type="text"
          placeholder="Search email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-72 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Role</option>
          <option value="admin">Admin</option>
          <option value="engineer">Engineer</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-600 border-b border-gray-200">
                <th className="py-3 px-4 font-semibold">User</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-gray-400">
                    No user found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    {/* User Info */}
                    <td className="py-3 px-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs uppercase">
                        {/* {user.email.substring(0, 2)} */}
                        {getInitials(user?.email)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.email}</p>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3 px-4 capitalize">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                        user.role === 'admin' 
                          ? 'bg-purple-50 text-purple-700 border-purple-200' 
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {user.role}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      {/* {user.role === 'engineer' ? ( */}
                        <button
                          onClick={() => setSelectedEngineer(user)}
                          className="cursor-pointer px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Change Password
                        </button>
                      {/* ) : (
                        <span className="text-xs text-gray-400 italic">N/A</span>
                      )} */}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Tambah User Baru */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Create New User
              </h3>
              <button
                onClick={handleCloseAddModal}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUserSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="name@email.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as 'admin' | 'engineer')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="engineer">Engineer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Min. 6 character"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="cursor-pointer px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="cursor-pointer px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Change Password */}
      {selectedEngineer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Change Password
              </h3>
              <button
                onClick={handleCloseChangePasswordModal}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm text-gray-600">
              Change password for user: <span className="font-semibold text-gray-900">{selectedEngineer.email}</span>
            </div>

            {errorMsg && (
              <div className="p-3 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Input new password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={handleCloseChangePasswordModal}
                  className="cursor-pointer px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cursor-pointer px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}