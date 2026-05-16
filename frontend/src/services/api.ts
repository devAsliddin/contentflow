import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'
const BASE_URL_V2 = BASE_URL.replace('/v1', '/v2')

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

export const apiV2 = axios.create({
  baseURL: BASE_URL_V2,
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token
const attachToken = (config: any) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}

api.interceptors.request.use(attachToken)
apiV2.interceptors.request.use(attachToken)

// Handle 401 — refresh token
let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error)
    else p.resolve(token!)
  })
  failedQueue = []
}

async function handle401(error: any, instance: typeof api) {
  const originalRequest = error.config

  if (error.response?.status === 401 && !originalRequest._retry) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`
        return instance(originalRequest)
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      localStorage.clear()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    try {
      const resp = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
      const { access_token, refresh_token, user } = resp.data
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('refresh_token', refresh_token)
      api.defaults.headers.common.Authorization = `Bearer ${access_token}`
      apiV2.defaults.headers.common.Authorization = `Bearer ${access_token}`
      const { useAuthStore } = await import('@/store')
      useAuthStore.getState().setTokens(access_token, refresh_token, user)
      processQueue(null, access_token)
      originalRequest.headers.Authorization = `Bearer ${access_token}`
      return instance(originalRequest)
    } catch (err) {
      processQueue(err, null)
      localStorage.clear()
      const { useAuthStore } = await import('@/store')
      useAuthStore.getState().logout()
      window.location.href = '/login'
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  }

  return Promise.reject(error)
}

api.interceptors.response.use((r) => r, (err) => handle401(err, api))
apiV2.interceptors.response.use((r) => r, (err) => handle401(err, apiV2))
