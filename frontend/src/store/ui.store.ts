import { create } from 'zustand'

interface Notification {
  id: string
  title: string
  message: string
  type: 'success' | 'error' | 'info'
  read: boolean
  created_at: string
}

interface UIState {
  sidebarOpen: boolean
  activePage: string
  notifications: Notification[]
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setActivePage: (page: string) => void
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'created_at'>) => void
  markAllRead: () => void
  unreadCount: () => number
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: true,
  activePage: 'dashboard',
  notifications: [],

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActivePage: (page) => set({ activePage: page }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        {
          ...notification,
          id: crypto.randomUUID(),
          read: false,
          created_at: new Date().toISOString(),
        },
        ...state.notifications,
      ].slice(0, 50), // keep last 50
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}))
