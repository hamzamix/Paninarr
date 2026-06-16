import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from './components/ui/sonner';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import Packs from './pages/Packs';
import Quiz from './pages/Quiz';
import Leaderboard from './pages/Leaderboard';
import Trades from './pages/Trades';
import Simulation from './pages/Simulation';
import Layout from './components/Layout';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center bg-zinc-950 text-white"><div className="animate-pulse">Loading Stadium...</div></div>;
  if (!user) return <Navigate to="/" />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/catalog" element={<PrivateRoute><Catalog /></PrivateRoute>} />
        <Route path="/packs" element={<PrivateRoute><Packs /></PrivateRoute>} />
        <Route path="/quiz" element={<PrivateRoute><Quiz /></PrivateRoute>} />
        <Route path="/leaderboard" element={<PrivateRoute><Leaderboard /></PrivateRoute>} />
        <Route path="/trades" element={<PrivateRoute><Trades /></PrivateRoute>} />
        <Route path="/simulation" element={<PrivateRoute><Simulation /></PrivateRoute>} />
      </Routes>
      <Toaster theme="dark" />
    </AuthProvider>
  );
}
