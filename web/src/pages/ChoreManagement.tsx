import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api'

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
}

interface ChoreFormData {
  title: string
  description: string
  frequency: 'daily' | 'weekly' | 'once'
  proof: 'none' | 'photo' | 'note'
  baseRewardPence: string
  minBidPence: string
  maxBidPence: string
}

const ChoreManagement: React.FC = () => {
  const { user } = useAuth()
  const [chores, setChores] = useState<Chore[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingChore, setEditingChore] = useState<Chore | null>(null)
  const [formData, setFormData] = useState<ChoreFormData>({
    title: '',
    description: '',
    frequency: 'daily',
    proof: 'none',
    baseRewardPence: '',
    minBidPence: '',
    maxBidPence: ''
  })

  useEffect(() => {
    loadChores()
  }, [])

  const loadChores = async () => {
    try {
      setIsLoading(true)
      const response = await apiClient.listChores()
      setChores(response.chores || [])
    } catch (error) {
      console.error('Failed to load chores:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const choreData = {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      frequency: formData.frequency,
      proof: formData.proof,
      baseRewardPence: parseInt(formData.baseRewardPence) || 0,
      minBidPence: formData.minBidPence ? parseInt(formData.minBidPence) : undefined,
      maxBidPence: formData.maxBidPence ? parseInt(formData.maxBidPence) : undefined,
    }

    try {
      if (editingChore) {
        await apiClient.updateChore(editingChore.id, choreData)
      } else {
        await apiClient.createChore(choreData)
      }
      
      await loadChores()
      resetForm()
    } catch (error) {
      console.error('Failed to save chore:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      frequency: 'daily',
      proof: 'none',
      baseRewardPence: '',
      minBidPence: '',
      maxBidPence: ''
    })
    setShowCreateForm(false)
    setEditingChore(null)
  }

  const handleEdit = (chore: Chore) => {
    setEditingChore(chore)
    setFormData({
      title: chore.title,
      description: chore.description || '',
      frequency: chore.frequency,
      proof: chore.proof,
      baseRewardPence: chore.baseRewardPence.toString(),
      minBidPence: chore.minBidPence?.toString() || '',
      maxBidPence: chore.maxBidPence?.toString() || ''
    })
    setShowCreateForm(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary mx-auto mb-4"></div>
          <p className="text-foreground text-lg font-medium">Loading chores...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="bubble-card p-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-bold text-foreground fun-title">Chore Management 🏠</h1>
                <p className="text-muted-foreground text-lg mt-2">
                  Create and manage chores for your family
                </p>
              </div>
              <button 
                onClick={() => setShowCreateForm(true)}
                className="bubble-button"
              >
                Create New Chore ✨
              </button>
            </div>
          </div>

          {/* Create/Edit Form */}
          {showCreateForm && (
            <div className="bubble-card p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-foreground">
                  {editingChore ? 'Edit Chore' : 'Create New Chore'}
                </h2>
                <button 
                  onClick={resetForm}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Chore Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-input rounded-bubble bg-surface text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="e.g., Make bed, Take out trash"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Base Reward (£)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.baseRewardPence ? (parseInt(formData.baseRewardPence) / 100).toString() : ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, baseRewardPence: (parseFloat(e.target.value || '0') * 100).toString() }))}
                      className="w-full px-4 py-3 border-2 border-input rounded-bubble bg-surface text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="0.50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-input rounded-bubble bg-surface text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Optional details about the chore..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Frequency
                    </label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value as any }))}
                      className="w-full px-4 py-3 border-2 border-input rounded-bubble bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="once">One-time</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Proof Required
                    </label>
                    <select
                      value={formData.proof}
                      onChange={(e) => setFormData(prev => ({ ...prev, proof: e.target.value as any }))}
                      className="w-full px-4 py-3 border-2 border-input rounded-bubble bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="none">No proof</option>
                      <option value="photo">Photo proof</option>
                      <option value="note">Text note</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Bidding Range (optional)
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Min £"
                        value={formData.minBidPence ? (parseInt(formData.minBidPence) / 100).toString() : ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, minBidPence: (parseFloat(e.target.value || '0') * 100).toString() }))}
                        className="flex-1 px-3 py-2 border border-input rounded-md bg-surface text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Max £"
                        value={formData.maxBidPence ? (parseInt(formData.maxBidPence) / 100).toString() : ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, maxBidPence: (parseFloat(e.target.value || '0') * 100).toString() }))}
                        className="flex-1 px-3 py-2 border border-input rounded-md bg-surface text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button type="submit" className="bubble-button">
                    {editingChore ? 'Update Chore' : 'Create Chore'} 🎯
                  </button>
                  <button type="button" onClick={resetForm} className="bubble-button bg-surface text-foreground hover:bg-surface-glass">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Chores List */}
          <div className="bubble-card p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-foreground">Family Chores 📋</h2>
              <span className="text-muted-foreground">{chores.length} active chore{chores.length !== 1 ? 's' : ''}</span>
            </div>
            
            {chores.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🏠</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No chores yet!</h3>
                <p className="text-muted-foreground mb-6">Create your first chore to get your family organized.</p>
                <button 
                  onClick={() => setShowCreateForm(true)}
                  className="bubble-button"
                >
                  Create First Chore ✨
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {chores.map((chore) => (
                  <div key={chore.id} className="bg-surface border-2 border-outline rounded-bubble p-6 hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h3 className="text-xl font-semibold text-foreground">{chore.title}</h3>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            chore.active 
                              ? 'bg-success/20 text-success border border-success/30' 
                              : 'bg-muted text-muted-foreground border border-muted'
                          }`}>
                            {chore.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        
                        {chore.description && (
                          <p className="text-muted-foreground mb-4">{chore.description}</p>
                        )}
                        
                        <div className="flex items-center space-x-6 text-sm">
                          <div className="flex items-center space-x-2">
                            <span className="text-muted-foreground">Frequency:</span>
                            <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded-full text-xs font-medium">
                              {chore.frequency}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <span className="text-muted-foreground">Reward:</span>
                            <span className="font-semibold text-foreground">
                              £{(chore.baseRewardPence / 100).toFixed(2)}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <span className="text-muted-foreground">Proof:</span>
                            <span className="capitalize">
                              {chore.proof === 'none' ? 'None' : chore.proof}
                            </span>
                          </div>
                          
                          {(chore.minBidPence || chore.maxBidPence) && (
                            <div className="flex items-center space-x-2">
                              <span className="text-muted-foreground">Bidding:</span>
                              <span className="text-xs">
                                £{chore.minBidPence ? (chore.minBidPence / 100).toFixed(2) : '0'} - £{chore.maxBidPence ? (chore.maxBidPence / 100).toFixed(2) : '∞'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <button 
                          onClick={() => handleEdit(chore)}
                          className="bubble-button bg-surface text-foreground hover:bg-surface-glass text-sm px-4 py-2"
                        >
                          Edit ✏️
                        </button>
                        <button 
                          onClick={() => {/* TODO: Implement delete */}}
                          className="bubble-button bg-destructive text-destructive-foreground hover:bg-destructive/90 text-sm px-4 py-2"
                        >
                          Delete ❌
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assignment Management - Coming Soon */}
          <div className="bubble-card p-6 opacity-75">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-foreground">Chore Assignments 🎯</h2>
              <span className="text-sm bg-warning/20 text-warning px-3 py-1 rounded-full border border-warning/30">
                Coming Soon
              </span>
            </div>
            <p className="text-muted-foreground">
              Assign chores to children and enable competitive bidding for more excitement!
            </p>
          </div>

          {/* Pending Completions - Coming Soon */}
          <div className="bubble-card p-6 opacity-75">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-foreground">Pending Approvals ⏳</h2>
              <span className="text-sm bg-warning/20 text-warning px-3 py-1 rounded-full border border-warning/30">
                Coming Soon
              </span>
            </div>
            <p className="text-muted-foreground">
              Review and approve completed chores to credit children's wallets.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChoreManagement
