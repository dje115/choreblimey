const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:1501/v1'

interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token')
  }

  private getHeaders(includeAuth: boolean = true, includeContentType: boolean = true): HeadersInit {
    const headers: HeadersInit = {}

    if (includeContentType) {
      headers['Content-Type'] = 'application/json'
    }

    if (includeAuth) {
      const token = this.getAuthToken()
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
      headers: this.getHeaders(includeAuth, !!data), // Only include Content-Type if there's data
      body: data ? JSON.stringify(data) : undefined,
    })

    return this.handleResponse<T>(response)
  }

  async patch<T = any>(endpoint: string, data?: any, includeAuth: boolean = true): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(includeAuth, !!data), // Only include Content-Type if there's data
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

  // Auth endpoints
  async signupParent(email: string) {
    return this.post('/auth/signup-parent', { email }, false)
  }

  async callback(token: string) {
    return this.get(`/auth/callback?token=${token}`, false)
  }

  async childJoin(data: { code?: string; qrData?: string; nickname: string; ageGroup?: string; gender?: string }) {
    return this.post('/auth/child-join', data, false)
  }

  // Family endpoints
  async getFamily() {
    return this.get('/family')
  }

  async updateFamily(data: { nameCipher?: string; region?: string; maxBudgetPence?: number; budgetPeriod?: 'weekly' | 'monthly' }) {
    return this.patch('/family', data)
  }

  async getFamilyMembers() {
    return this.get('/family/members')
  }

  async getFamilyBudget() {
    return this.get('/family/budget')
  }

  async getFamilyJoinCodes() {
    return this.get('/family/join-codes')
  }

  async createFamily(data: { nameCipher: string; region?: string }) {
    return this.post('/family', data)
  }

  async inviteToFamily(data: { 
    email: string; 
    role: 'parent_admin' | 'parent_viewer' | 'relative_contributor' | 'child_player'; 
    nameCipher: string; 
    nickname: string; 
    ageGroup?: string; 
    sendEmail?: boolean 
  }) {
    return this.post('/family/invite', data)
  }

  // Children endpoints
  async createChild(data: { nickname: string; realNameCipher?: string; dobCipher?: string; ageGroup?: string }) {
    return this.post('/children', data)
  }

  async updateChild(childId: string, data: { nickname?: string; ageGroup?: string; gender?: string; birthday?: string; theme?: string }) {
    return this.patch(`/children/${childId}`, data)
  }

  async generateChildJoinCode(data: { nickname: string; ageGroup: string; gender?: string }) {
    return this.post('/auth/generate-join-code', data)
  }

  // Chore endpoints
  async listChores() {
    return this.get('/chores')
  }

  async createChore(data: any) {
    return this.post('/chores', data)
  }

  async updateChore(id: string, data: any) {
    return this.patch(`/chores/${id}`, data)
  }

  // Assignment endpoints
  async listAssignments(childId?: string) {
    const params = childId ? `?childId=${childId}` : ''
    return this.get(`/assignments${params}`)
  }

  async createAssignment(data: { choreId: string; childId?: string; biddingEnabled?: boolean }) {
    return this.post('/assignments', data)
  }

  async deleteAssignment(assignmentId: string) {
    return this.delete(`/assignments/${assignmentId}`)
  }

  async linkAssignments(data: { assignmentId1: string; assignmentId2: string }) {
    return this.post('/assignments/link', data)
  }

  // Completion endpoints
  async listCompletions(status?: string) {
    const url = status ? `/completions?status=${status}` : '/completions'
    return this.get(url)
  }

  async createCompletion(data: { assignmentId: string; proofUrl?: string; note?: string }) {
    return this.post('/completions', data)
  }

  async approveCompletion(completionId: string) {
    return this.post(`/completions/${completionId}/approve`)
  }

  async rejectCompletion(completionId: string, reason?: string) {
    return this.post(`/completions/${completionId}/reject`, { reason })
  }

  // Bidding endpoints
  async listBids(assignmentId: string) {
    return this.get(`/bids?assignmentId=${assignmentId}`)
  }

  async competeInBid(data: { assignmentId: string; childId: string; amountPence: number; targetChildId?: string }) {
    return this.post('/bids/compete', data)
  }

  // Wallet endpoints
  async getWallet(childId: string) {
    return this.get(`/wallet/${childId}`)
  }

  async creditWallet(childId: string, data: { amountPence: number; source?: string; note?: string }) {
    return this.post(`/wallet/${childId}/credit`, data)
  }

  async getTransactions(childId: string, limit?: number) {
    const url = limit ? `/wallet/${childId}/transactions?limit=${limit}` : `/wallet/${childId}/transactions`
    return this.get(url)
  }

  // Leaderboard and rivalry
  async getLeaderboard() {
    return this.get('/leaderboard')
  }

  async getRivalryFeed() {
    return this.get('/rivalry-feed')
  }

  // Rewards and Redemptions
  async getRewards(childId?: string) {
    const url = childId ? `/rewards?childId=${childId}` : '/rewards'
    return this.get(url)
  }

  async redeemReward(data: { rewardId: string; childId?: string }) {
    return this.post('/redemptions', data)
  }

  async getRedemptions(status?: string) {
    const url = status ? `/redemptions?status=${status}` : '/redemptions'
    return this.get(url)
  }

  async fulfillRedemption(redemptionId: string) {
    return this.post(`/redemptions/${redemptionId}/fulfill`, {})
  }

  // Streaks
  async getStreakStats(childId: string) {
    return this.get(`/streaks/${childId}`)
  }

  // Payouts
  async createPayout(data: { childId: string; amountPence: number; method?: string; note?: string }) {
    return this.post('/payouts', data)
  }

  async getPayouts(childId?: string) {
    const url = childId ? `/payouts?childId=${childId}` : '/payouts'
    return this.get(url)
  }

  async getUnpaidBalance(childId: string) {
    return this.get(`/payouts/unpaid/${childId}`)
  }
}

export const apiClient = new ApiClient()
export default apiClient
