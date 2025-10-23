import React, { useState } from 'react'
import { apiClient } from '../../lib/api'

interface FamilyMember {
  id: string
  userId: string
  role: 'parent_admin' | 'parent_viewer' | 'relative_contributor' | 'child_player'
  invitedBy?: string
  createdAt: string
  user: {
    email: string
  }
}

interface Family {
  id: string
  nameCipher: string
  region?: string
  maxBudgetPence?: number
  budgetPeriod?: 'weekly' | 'monthly'
  showLifetimeEarnings: boolean
}

interface FamilyManagementProps {
  family: Family
  members: FamilyMember[]
  onFamilyUpdated: (family: Family) => void
  onMemberAdded: (member: FamilyMember) => void
}

/**
 * FamilyManagement - Component for managing family settings and members
 * @component
 * @param {FamilyManagementProps} props - Component props
 * @returns {JSX.Element} Family management component
 */
export const FamilyManagement: React.FC<FamilyManagementProps> = ({
  family,
  members,
  onFamilyUpdated,
  onMemberAdded
}) => {
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [inviteData, setInviteData] = useState({
    email: '',
    nickname: '',
    ageGroup: '5-8'
  })

  const [familySettings, setFamilySettings] = useState({
    nameCipher: family.nameCipher,
    region: family.region || '',
    maxBudgetPence: family.maxBudgetPence || 0,
    budgetPeriod: family.budgetPeriod || 'weekly',
    showLifetimeEarnings: family.showLifetimeEarnings
  })

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const member = await apiClient.inviteFamilyMember(inviteData)
      onMemberAdded(member)
      setInviteData({ email: '', nickname: '', ageGroup: '5-8' })
      setShowInviteModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite member')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateFamily = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const updatedFamily = await apiClient.updateFamily(familySettings)
      onFamilyUpdated(updatedFamily)
      setShowSettingsModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update family')
    } finally {
      setLoading(false)
    }
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'parent_admin': return 'Parent Admin'
      case 'parent_viewer': return 'Parent Viewer'
      case 'relative_contributor': return 'Relative Contributor'
      case 'child_player': return 'Child Player'
      default: return role
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Family Management</h2>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Invite Member
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Family Settings
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Family Info */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Family Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Family Name</label>
            <p className="mt-1 text-sm text-gray-900">{family.nameCipher}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Region</label>
            <p className="mt-1 text-sm text-gray-900">{family.region || 'Not set'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Budget Period</label>
            <p className="mt-1 text-sm text-gray-900 capitalize">{family.budgetPeriod || 'weekly'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Max Budget</label>
            <p className="mt-1 text-sm text-gray-900">
              {family.maxBudgetPence ? `£${(family.maxBudgetPence / 100).toFixed(2)}` : 'Not set'}
            </p>
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Family Members</h3>
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{member.user.email}</p>
                <p className="text-xs text-gray-500">{getRoleDisplayName(member.role)}</p>
              </div>
              <div className="text-xs text-gray-500">
                Joined {new Date(member.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Invite Family Member</h3>
            <form onSubmit={handleInviteMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <input
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Nickname</label>
                <input
                  type="text"
                  value={inviteData.nickname}
                  onChange={(e) => setInviteData(prev => ({ ...prev, nickname: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Age Group</label>
                <select
                  value={inviteData.ageGroup}
                  onChange={(e) => setInviteData(prev => ({ ...prev, ageGroup: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="5-8">5-8 years</option>
                  <option value="9-11">9-11 years</option>
                  <option value="12-15">12-15 years</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Family Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Family Settings</h3>
            <form onSubmit={handleUpdateFamily} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Family Name</label>
                <input
                  type="text"
                  value={familySettings.nameCipher}
                  onChange={(e) => setFamilySettings(prev => ({ ...prev, nameCipher: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Region</label>
                <input
                  type="text"
                  value={familySettings.region}
                  onChange={(e) => setFamilySettings(prev => ({ ...prev, region: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Budget Period</label>
                <select
                  value={familySettings.budgetPeriod}
                  onChange={(e) => setFamilySettings(prev => ({ ...prev, budgetPeriod: e.target.value as 'weekly' | 'monthly' }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Max Budget (pence)</label>
                <input
                  type="number"
                  value={familySettings.maxBudgetPence}
                  onChange={(e) => setFamilySettings(prev => ({ ...prev, maxBudgetPence: parseInt(e.target.value) }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  max="100000"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showLifetimeEarnings"
                  checked={familySettings.showLifetimeEarnings}
                  onChange={(e) => setFamilySettings(prev => ({ ...prev, showLifetimeEarnings: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="showLifetimeEarnings" className="ml-2 block text-sm text-gray-900">
                  Show lifetime earnings to children
                </label>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
