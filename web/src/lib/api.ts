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

  async updateFamily(data: { 
    nameCipher?: string
    region?: string
    maxBudgetPence?: number
    budgetPeriod?: 'weekly' | 'monthly'
    showLifetimeEarnings?: boolean
    giftsEnabled?: boolean
    // Streak Settings
    streakProtectionDays?: number
    bonusEnabled?: boolean
    bonusDays?: number
    bonusMoneyPence?: number
    bonusStars?: number
    bonusType?: 'money' | 'stars' | 'both'
    penaltyEnabled?: boolean
    firstMissPence?: number
    firstMissStars?: number
    secondMissPence?: number
    secondMissStars?: number
    thirdMissPence?: number
    thirdMissStars?: number
    penaltyType?: 'money' | 'stars' | 'both'
    minBalancePence?: number
    minBalanceStars?: number
    holidayMode?: boolean
    holidayStartDate?: string | null
    holidayEndDate?: string | null
  }) {
    return this.patch('/family', data)
  }

  async getFamilyMembers() {
    return this.get('/family/members')
  }

  async updateFamilyMember(memberId: string, data: { displayName?: string; birthMonth?: number | null; birthYear?: number | null }) {
    return this.patch(`/family/members/${memberId}`, data)
  }

  async generateDeviceToken(memberId: string) {
    return this.post(`/family/members/${memberId}/device-token`, {})
  }

  async toggleMemberPause(memberId: string) {
    return this.patch(`/family/members/${memberId}/pause`)
  }

  async removeMember(memberId: string) {
    return this.delete(`/family/members/${memberId}`)
  }

  async getMemberStats(memberId: string) {
    return this.get(`/family/members/${memberId}/stats`)
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
    email?: string; 
    role: 'parent_admin' | 'parent_co_parent' | 'parent_viewer' | 'grandparent' | 'uncle_aunt' | 'relative_contributor' | 'child_player'; 
    nameCipher: string; 
    nickname: string; 
    ageGroup?: string; 
    birthYear?: number;
    birthMonth?: number;
    sendEmail?: boolean 
  }) {
    return this.post('/family/invite', data)
  }

  // Children endpoints
  async createChild(data: { nickname: string; realNameCipher?: string; dobCipher?: string; ageGroup?: string }) {
    return this.post('/children', data)
  }

  async updateChild(childId: string, data: { nickname?: string; ageGroup?: string; gender?: string; birthMonth?: number; birthYear?: number; theme?: string }) {
    return this.patch(`/children/${childId}`, data)
  }

  async removeChild(childId: string) {
    return this.delete(`/children/${childId}`)
  }

  async toggleChildPause(childId: string) {
    return this.patch(`/children/${childId}/pause`)
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

  async getWalletStats(childId: string) {
    return this.get(`/wallet/${childId}/stats`)
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

  async redeemReward(data: { rewardId?: string; familyGiftId?: string; childId?: string }) {
    return this.post('/redemptions', data)
  }

  async getRedemptions(status?: string, childId?: string) {
    const params = new URLSearchParams()
    if (status) params.append('status', status)
    if (childId) params.append('childId', childId)
    const url = params.toString() ? `/redemptions?${params.toString()}` : '/redemptions'
    return this.get(url)
  }

  async fulfillRedemption(redemptionId: string) {
    return this.post(`/redemptions/${redemptionId}/fulfill`, {})
  }

  async rejectRedemption(redemptionId: string) {
    return this.post(`/redemptions/${redemptionId}/reject`, {})
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

  // Gift Templates (browse available templates - read-only)
  async getGiftTemplates(params?: { type?: string; category?: string; age?: string; gender?: string; featured?: string }) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : ''
    return this.get(`/gift-templates${queryString}`)
  }

  // Family Gifts (parent manages gifts for their family)
  async getFamilyGifts(params?: { type?: string; active?: string; childId?: string }) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : ''
    return this.get(`/family/gifts${queryString}`)
  }

  async getFamilyGift(id: string) {
    return this.get(`/family/gifts/${id}`)
  }

  async createFamilyGift(data: {
    title: string
    description?: string
    type: 'amazon_product' | 'activity' | 'custom'
    provider?: 'amazon_associates' | 'amazon_sitestripe'
    amazonAsin?: string
    affiliateUrl?: string
    sitestripeUrl?: string
    imageUrl?: string
    category?: string
    starsRequired: number
    availableForAll?: boolean
    availableForChildIds?: string[]
    recurring?: boolean
    ageTag?: string
    genderTag?: string
  }) {
    return this.post('/family/gifts', data)
  }

  async addGiftFromTemplate(templateId: string, data: {
    starsRequired: number
    availableForAll?: boolean
    availableForChildIds?: string[]
    recurring?: boolean
  }) {
    return this.post(`/family/gifts/${templateId}/add`, data)
  }

  async updateFamilyGift(id: string, data: {
    starsRequired?: number
    availableForAll?: boolean
    availableForChildIds?: string[]
    active?: boolean
    recurring?: boolean
    title?: string
    description?: string
  }) {
    return this.patch(`/family/gifts/${id}`, data)
  }

  async deleteFamilyGift(id: string) {
    return this.delete(`/family/gifts/${id}`)
  }
}

export const apiClient = new ApiClient()
export default apiClient
