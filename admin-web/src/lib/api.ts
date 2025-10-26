const ADMIN_API_BASE_URL = (import.meta as any).env?.VITE_ADMIN_API_URL || 'http://localhost:1502'

// interface ApiResponse<T = any> {
//   success?: boolean
//   data?: T
//   error?: string
//   message?: string
// }

class AdminApiClient {
  private baseUrl: string

  constructor(baseUrl: string = ADMIN_API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private getAdminToken(): string | null {
    return localStorage.getItem('admin_token')
  }

  private getHeaders(includeAuth: boolean = true): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    }

    if (includeAuth) {
      const token = this.getAdminToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    return headers
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  async get<T = any>(endpoint: string, includeAuth: boolean = true): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(includeAuth),
    })
    return this.handleResponse<T>(response)
  }

  async post<T = any>(endpoint: string, data?: any, includeAuth: boolean = true): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(includeAuth),
      body: data ? JSON.stringify(data) : undefined,
    })
    return this.handleResponse<T>(response)
  }

  async patch<T = any>(endpoint: string, data?: any, includeAuth: boolean = true): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(includeAuth),
      body: data ? JSON.stringify(data) : undefined,
    })
    return this.handleResponse<T>(response)
  }

  async delete<T = any>(endpoint: string, includeAuth: boolean = true): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(includeAuth),
    })
    return this.handleResponse<T>(response)
  }

  // Admin Authentication
  async adminSignup(email: string, password: string, name?: string) {
    return this.post('/v1/admin/auth/signup', { email, password, name }, false)
  }

  async adminVerifyEmail(token: string) {
    return this.post('/v1/admin/auth/verify-email', { token }, false)
  }

  async adminLogin(email: string, password: string) {
    return this.post('/v1/admin/auth/login', { email, password }, false)
  }

  async adminVerifyTwoFactor(data: { email: string; password: string; code: string }) {
    return this.post('/v1/admin/auth/verify-2fa', data, false)
  }

  async adminLogout() {
    return this.post('/v1/admin/auth/logout')
  }

  async getAdminProfile() {
    return this.get('/v1/admin/profile')
  }

  // Account Cleanup
  async getCleanupLogs(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.get(`/v1/admin/cleanup/logs${queryString}`)
  }

  async getCleanupStats() {
    return this.get('/v1/admin/cleanup/stats')
  }

  async getCleanupStatus() {
    return this.get('/v1/admin/cleanup/status')
  }

  async triggerCleanup() {
    return this.post('/v1/admin/cleanup/trigger')
  }

  async exportCleanupLogs(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : ''
    const response = await fetch(`${this.baseUrl}/v1/admin/cleanup/export${queryString}`, {
      method: 'GET',
      headers: this.getHeaders(),
    })
    
    if (!response.ok) {
      throw new Error('Export failed')
    }
    
    return response.blob()
  }

  // System Monitoring
  async getSystemOverview() {
    return this.get('/v1/admin/monitoring/overview')
  }

  async getPerformanceMetrics() {
    return this.get('/v1/admin/monitoring/performance')
  }

  async getErrorLogs(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.get(`/v1/admin/monitoring/errors${queryString}`)
  }

  async getSecurityEvents(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.get(`/v1/admin/monitoring/security${queryString}`)
  }

  // Security Management
  async getSecurityLogs(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.get(`/v1/admin/security/logs${queryString}`)
  }

  async getActiveSessions() {
    return this.get('/v1/admin/security/sessions')
  }

  async revokeSession(sessionId: string) {
    return this.post('/v1/admin/security/revoke-session', { sessionId })
  }

  async getAuditLogs(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.get(`/v1/admin/security/audit${queryString}`)
  }

  async blockIPAddress(ipAddress: string, reason: string) {
    return this.post('/v1/admin/security/block-ip', { ipAddress, reason })
  }
}

export const adminApiClient = new AdminApiClient()
export default adminApiClient
