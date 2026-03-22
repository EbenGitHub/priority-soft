"use client";

import React, { useEffect, useState } from 'react';
import StaffDashboard from '../../components/dashboard/StaffDashboard';
import ManagerDashboard from '../../components/dashboard/ManagerDashboard';
import AdminDashboard from '../../components/dashboard/AdminDashboard';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('shiftSync_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto animate-fade-in-up">
      <header className="mb-8">
        <h2 className="text-4xl font-extrabold text-white tracking-tight">Overview</h2>
        <p className="text-slate-400 mt-2 text-lg">Manage your assignments and real-time scheduling constraints.</p>
      </header>

      {user.role === 'STAFF' && <StaffDashboard user={user} />}
      {user.role === 'MANAGER' && <ManagerDashboard user={user} />}
      {user.role === 'ADMIN' && <AdminDashboard user={user} />}
    </div>
  );
}
