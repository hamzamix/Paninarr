import React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';

type User = {
  id: string;
  nickname: string;
  recovery_code: string;
  join_date: string;
  country: string;
  avatar: string;
  level: number;
  xp: number;
  coins: number;
  total_points: number;
  daily_streak: number;
  favorite_team?: string;
  predicted_winner?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (recoveryCode: string) => Promise<boolean>;
  register: (nickname: string, favoriteTeam?: string, predictedWinner?: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUserId = localStorage.getItem('wc_user_id');
    if (storedUserId) {
        refreshUser(storedUserId).finally(() => setLoading(false));
    } else {
        setLoading(false);
    }
  }, []);

  const refreshUser = async (userIdStr?: string) => {
      const uId = userIdStr || localStorage.getItem('wc_user_id');
      if (!uId) return;
      try {
          const res = await fetch('/api/me', { headers: { 'x-user-id': uId }});
          if (res.ok) {
              const data = await res.json();
              setUser(data.user);
          } else {
              if (res.status === 401 || res.status === 404) {
                 localStorage.removeItem('wc_user_id');
                 setUser(null);
              }
          }
      } catch(e) {
          console.error(e);
      }
  }

  const login = async (recoveryCode: string) => {
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recoveryCode })
        });
        if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            localStorage.setItem('wc_user_id', data.user.id);
            return true;
        }
        return false;
    } catch(e) {
        return false;
    }
  };

  const register = async (nickname: string, favoriteTeam?: string, predictedWinner?: string) => {
      try {
          const res = await fetch('/api/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nickname, favoriteTeam, predictedWinner })
          });
          if (res.ok) {
              const data = await res.json();
              setUser(data.user);
              localStorage.setItem('wc_user_id', data.user.id);
              // Show recovery code to user after this (handled in UI)
              alert(`IMPORTANT! Save your recovery code: ${data.recoveryCode}`);
              return true;
          }
          return false;
      } catch(e) {
          return false;
      }
  }

  const logout = () => {
    localStorage.removeItem('wc_user_id');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
