import React, { useState } from 'react'
import { apiClient } from '../../lib/api'

interface Chore {
  id: string
  title: string
  description?: string
  frequency: 'daily' | 'weekly' | 'once'
  proof: 'none' | 'photo' | 'note'
  baseRewardPence: number
  minBidPence?: number
  maxBidPence?: number
  active: boolean
  createdAt: string
}

interface ChoreManagementProps {
  chores: Chore[]
  onChoreCreated: (chore: Chore) => void
  onChoreUpdated: (chore: Chore) => void
  onChoreDeleted: (choreId: string) => void
}

/**
 * ChoreManagement - Component for managing family chores
 * @component
 * @param {ChoreManagementProps} props - Component props
 * @returns {JSX.Element} Chore management component
 */
export const ChoreManagement: React.FC<ChoreManagementProps> = ({
  chores,
  onChoreCreated,
  onChoreUpdated,
  onChoreDeleted
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedChore, setSelectedChore] = useState<Chore | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newChore, setNewChore] = useState({
    title: '',
    description: '',
    frequency: 'daily' as 'daily' | 'weekly' | 'once',
    proof: 'none' as 'none' | 'photo' | 'note',
    baseRewardPence: 50
  })

  const handleCreateChore = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const chore = await apiClient.createChore(newChore)
      onChoreCreated(chore)
      setNewChore({
        title: '',
        description: '',
        frequency: 'daily',
        proof: 'none',
        baseRewardPence: 50
      })
      setShowCreateModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create chore')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateChore = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChore) return

    setLoading(true)
    setError(null)

    try {
      const updatedChore = await apiClient.updateChore(selectedChore.id, {
        title: selectedChore.title,
        description: selectedChore.description,
        frequency: selectedChore.frequency,
        proof: selectedChore.proof,
        baseRewardPence: selectedChore.baseRewardPence,
        minBidPence: selectedChore.minBidPence,
        maxBidPence: selectedChore.maxBidPence
      })
      onChoreUpdated(updatedChore)
      setShowEditModal(false)
      setSelectedChore(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update chore')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteChore = async (choreId: string) => {
    if (!confirm('Are you sure you want to delete this chore?')) return

    setLoading(true)
    setError(null)

    try {
      await apiClient.deleteChore(choreId)
      onChoreDeleted(choreId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete chore')
    } finally {
      setLoading(false)
    }
  }

  const openEditModal = (chore: Chore) => {
    setSelectedChore(chore)
    setShowEditModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Chore Management</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Create New Chore
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Chores List */}
      <div className="grid gap-4">
        {chores.map((chore) => (
          <div key={chore.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">{chore.title}</h3>
                {chore.description && (
                  <p className="text-sm text-gray-600 mt-1">{chore.description}</p>
                )}
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                  <span>Frequency: {chore.frequency}</span>
                  <span>Proof: {chore.proof}</span>
                  <span>Reward: {chore.baseRewardPence}p</span>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => openEditModal(chore)}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteChore(chore.id)}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Chore Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Chore</h3>
            <form onSubmit={handleCreateChore} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={newChore.title}
                  onChange={(e) => setNewChore(prev => ({ ...prev, title: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={newChore.description}
                  onChange={(e) => setNewChore(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Frequency</label>
                  <select
                    value={newChore.frequency}
                    onChange={(e) => setNewChore(prev => ({ ...prev, frequency: e.target.value as any }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="once">Once</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Proof Required</label>
                  <select
                    value={newChore.proof}
                    onChange={(e) => setNewChore(prev => ({ ...prev, proof: e.target.value as any }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="none">None</option>
                    <option value="photo">Photo</option>
                    <option value="note">Note</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Base Reward (pence)</label>
                <input
                  type="number"
                  value={newChore.baseRewardPence}
                  onChange={(e) => setNewChore(prev => ({ ...prev, baseRewardPence: parseInt(e.target.value) }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  max="10000"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Chore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Chore Modal */}
      {showEditModal && selectedChore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Chore</h3>
            <form onSubmit={handleUpdateChore} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={selectedChore.title}
                  onChange={(e) => setSelectedChore(prev => prev ? { ...prev, title: e.target.value } : null)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={selectedChore.description || ''}
                  onChange={(e) => setSelectedChore(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Frequency</label>
                  <select
                    value={selectedChore.frequency}
                    onChange={(e) => setSelectedChore(prev => prev ? { ...prev, frequency: e.target.value as any } : null)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="once">Once</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Proof Required</label>
                  <select
                    value={selectedChore.proof}
                    onChange={(e) => setSelectedChore(prev => prev ? { ...prev, proof: e.target.value as any } : null)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="none">None</option>
                    <option value="photo">Photo</option>
                    <option value="note">Note</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Base Reward (pence)</label>
                <input
                  type="number"
                  value={selectedChore.baseRewardPence}
                  onChange={(e) => setSelectedChore(prev => prev ? { ...prev, baseRewardPence: parseInt(e.target.value) } : null)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  max="10000"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Chore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
