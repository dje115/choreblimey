import React, { useState, useEffect } from 'react'
import { useAdminAuth } from '../contexts/AdminAuthContext'
import { adminApiClient } from '../lib/api'

interface ProfanityWord {
  id: string
  word: string
}

interface FlaggedMessage {
  id: string
  messageId: string
  familyId: string
  originalMessage: string
  filteredMessage: string
  flaggedWords: string[]
  senderId: string | null
  senderType: 'parent' | 'child'
  createdAt: string
}

const AdminProfanity: React.FC = () => {
  const { adminLogout } = useAdminAuth()
  const [words, setWords] = useState<ProfanityWord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [newWord, setNewWord] = useState('')
  const [bulkWords, setBulkWords] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [flaggedMessages, setFlaggedMessages] = useState<FlaggedMessage[]>([])
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'words' | 'flagged'>('words')

  useEffect(() => {
    if (activeTab === 'words') {
      loadWords()
    } else {
      loadFlaggedMessages()
    }
  }, [activeTab, searchTerm])

  const loadWords = async () => {
    try {
      setLoading(true)
      const response = await adminApiClient.listProfanityWords({
        limit: 2000,
        search: searchTerm || undefined
      })
      setWords(response.words || [])
    } catch (error) {
      console.error('Failed to load profanity words:', error)
      alert('Failed to load profanity words: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const loadFlaggedMessages = async () => {
    try {
      setLoading(true)
      const response = await adminApiClient.getFlaggedMessages({ limit: 50 })
      setFlaggedMessages(response.flaggedMessages || [])
    } catch (error) {
      console.error('Failed to load flagged messages:', error)
      alert('Failed to load flagged messages: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleAddWord = async () => {
    if (!newWord.trim()) {
      alert('Please enter a word')
      return
    }

    try {
      await adminApiClient.createProfanityWord(newWord.trim())
      setNewWord('')
      setShowAddModal(false)
      loadWords()
      alert('Word added successfully')
    } catch (error) {
      alert('Failed to add word: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleBulkUpload = async () => {
    if (!bulkWords.trim()) {
      alert('Please enter words to upload')
      return
    }

    // Parse words (split by newline, comma, or space)
    const wordLines = bulkWords
      .split(/[\n,\r]+/)
      .map(line => line.trim())
      .filter(line => line.length > 0)

    if (wordLines.length === 0) {
      alert('No valid words found')
      return
    }

    if (wordLines.length > 2000) {
      alert('Maximum 2000 words allowed per upload')
      return
    }

    try {
      const response = await adminApiClient.bulkUploadProfanityWords(wordLines)
      setBulkWords('')
      setShowBulkModal(false)
      loadWords()
      alert(`Success: ${response.added} words added, ${response.skipped} skipped`)
    } catch (error) {
      alert('Failed to upload words: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleDeleteWord = async (word: string) => {
    if (!confirm(`Are you sure you want to delete "${word}"?`)) return

    try {
      // Find word ID from the list (we need to get full data)
      // For now, delete by word value
      await adminApiClient.deleteProfanityWords([word])
      loadWords()
      alert('Word deleted successfully')
    } catch (error) {
      alert('Failed to delete word: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedWords.size === 0) {
      alert('Please select words to delete')
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedWords.size} word(s)?`)) return

    try {
      await adminApiClient.deleteProfanityWords(Array.from(selectedWords))
      setSelectedWords(new Set())
      loadWords()
      alert('Words deleted successfully')
    } catch (error) {
      alert('Failed to delete words: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Read file as text
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target?.result as string
      if (!text) return

      setBulkWords(text)
      setShowBulkModal(true)
    }
    reader.readAsText(file)
  }

  const toggleWordSelection = (word: string) => {
    const newSelected = new Set(selectedWords)
    if (newSelected.has(word)) {
      newSelected.delete(word)
    } else {
      newSelected.add(word)
    }
    setSelectedWords(newSelected)
  }

  const filteredWords = words.filter(w =>
    searchTerm ? w.word.toLowerCase().includes(searchTerm.toLowerCase()) : true
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Profanity Filter</h1>
              <p className="text-gray-600 mt-1">Manage profanity words and review flagged messages</p>
            </div>
            <button
              onClick={adminLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('words')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'words'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Profanity Words ({words.length})
              </button>
              <button
                onClick={() => setActiveTab('flagged')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'flagged'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Flagged Messages ({flaggedMessages.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Words Tab */}
        {activeTab === 'words' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search words..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                ➕ Add Word
              </button>
              <button
                onClick={() => setShowBulkModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
              >
                📤 Bulk Upload
              </button>
              <label className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors cursor-pointer whitespace-nowrap text-center">
                📁 Upload File
                <input
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {selectedWords.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
                >
                  🗑️ Delete Selected ({selectedWords.size})
                </button>
              )}
            </div>

            {/* Words List */}
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading words...</p>
              </div>
            ) : filteredWords.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No words found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {filteredWords.map((wordItem) => (
                  <div
                    key={wordItem.id}
                    className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedWords.has(wordItem.word)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleWordSelection(wordItem.word)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">{wordItem.word}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteWord(wordItem.word)
                        }}
                        className="text-red-600 hover:text-red-800 text-xs"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 text-sm text-gray-600">
              Total words: {words.length} {searchTerm && `(filtered: ${filteredWords.length})`}
            </div>
          </div>
        )}

        {/* Flagged Messages Tab */}
        {activeTab === 'flagged' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading flagged messages...</p>
              </div>
            ) : flaggedMessages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No flagged messages</p>
              </div>
            ) : (
              <div className="space-y-4">
                {flaggedMessages.map((msg) => (
                  <div key={msg.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {msg.senderType === 'child' ? 'Child' : 'Parent'}
                        </span>
                        <span className="text-sm text-gray-500 ml-2">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                        {msg.flaggedWords.length} word(s)
                      </span>
                    </div>
                    <div className="mb-2">
                      <div className="text-sm text-gray-600 mb-1">
                        <strong>Original:</strong> {msg.originalMessage}
                      </div>
                      <div className="text-sm text-gray-900">
                        <strong>Filtered:</strong> {msg.filteredMessage}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Flagged words: {msg.flaggedWords.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add Word Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-4">Add Profanity Word</h2>
              <input
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="Enter word..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                onKeyPress={(e) => e.key === 'Enter' && handleAddWord()}
                autoFocus
              />
              <div className="flex gap-4">
                <button
                  onClick={handleAddWord}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setNewWord('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Upload Modal */}
        {showBulkModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[80vh] flex flex-col">
              <h2 className="text-2xl font-bold mb-4">Bulk Upload Words</h2>
              <p className="text-sm text-gray-600 mb-4">
                Enter words separated by newlines, commas, or spaces. Maximum 2000 words.
              </p>
              <textarea
                value={bulkWords}
                onChange={(e) => setBulkWords(e.target.value)}
                placeholder="word1&#10;word2&#10;word3"
                className="flex-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                rows={10}
              />
              <div className="mt-4 flex gap-4">
                <button
                  onClick={handleBulkUpload}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Upload ({bulkWords.split(/[\n,\r]+/).filter(w => w.trim()).length} words)
                </button>
                <button
                  onClick={() => {
                    setShowBulkModal(false)
                    setBulkWords('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminProfanity

