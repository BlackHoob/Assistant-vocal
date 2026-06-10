import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppUser {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  phone?: string;
}

interface AuthState {
  user: AppUser | null;
  token: string | null;
  loading: boolean;
  // Admin
  adminToken: string | null;
  adminUser: { id: number; username: string; email: string; role: string } | null;

  setAuth: (token: string, user: AppUser) => void;
  setAdmin: (token: string, admin: any) => void;
  logoutAdmin: () => void;
  logout: () => void;
  init: () => Promise<void>;
  isAdmin: () => boolean;
}

const API = 'http://localhost:4000/api';

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: true,
      adminToken: null,
      adminUser: null,

      setAuth: (token, user) => set({ token, user }),
      setAdmin: (token, admin) => set({ adminToken: token, adminUser: admin }),
      logoutAdmin: () => set({ adminToken: null, adminUser: null }),
      isAdmin: () => !!get().adminToken && !!get().adminUser,

      logout: () => set({ user: null, token: null, adminToken: null, adminUser: null }),

      init: async () => {
        set({ loading: true });
        const { token } = get();
        if (!token) return set({ loading: false });
        try {
          const res = await fetch(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const user = await res.json();
            set({ user, loading: false });
          } else {
            set({ user: null, token: null, loading: false });
          }
        } catch {
          set({ loading: false });
        }
      },
    }),
    {
      name: 'nestor-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        adminToken: state.adminToken,
        adminUser: state.adminUser,
      }),
    }
  )
);