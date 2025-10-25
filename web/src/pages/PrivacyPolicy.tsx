import React from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                🎉
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                ChoreBlimey!
              </h1>
            </Link>
            <Link 
              to="/"
              className="text-purple-600 hover:text-purple-700 font-semibold"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-8">Privacy Policy & GDPR Compliance</h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-8">
              <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
            </p>

            <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">🔒 What Data We Collect</h2>
            <p className="text-gray-600 mb-4">
              We collect minimal data to make ChoreBlimey! work for your family:
            </p>
            
            <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
              <li><strong>Account Information:</strong> Email address and encrypted password</li>
              <li><strong>Family Data:</strong> Family name (encrypted) and basic settings</li>
              <li><strong>Child Profiles:</strong> Nickname, age group (5-8, 9-11, 12-15), and theme preferences</li>
              <li><strong>Chore Data:</strong> Chore titles, descriptions, and reward amounts</li>
              <li><strong>Progress Data:</strong> Completed chores, earned stars, and wallet balances</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">🔒 What We Collect (Required vs Optional)</h2>
            <p className="text-gray-600 mb-4">
              We collect minimal data to make ChoreBlimey! work for your family:
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-800 mb-2">✅ Required Data:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Parent email address (for smart login authentication)</li>
                <li>• Family name (encrypted)</li>
                <li>• Child nickname and age group (auto-calculated from birthday)</li>
                <li>• Chore information and progress data</li>
              </ul>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-green-800 mb-2">🎯 Optional Data (You Choose):</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• <strong>Child email address</strong> - Optional, can be added later by parent</li>
                <li>• <strong>Gender</strong> - Male, Female, or Other/Prefer not to say (for gift suggestions)</li>
                <li>• <strong>Birth month and year</strong> - For birthday reminders and age-appropriate rewards</li>
                <li>• <strong>Child interests</strong> - For personalized gift suggestions</li>
                <li>• <strong>Theme preferences</strong> - For customized app appearance</li>
              </ul>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-red-800 mb-2">🚫 What We DON'T Collect:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• <strong>No exact birthdays</strong> - only month and year if you choose to provide them</li>
                <li>• <strong>No location data</strong> - we don't track where you are</li>
                <li>• <strong>No browsing history</strong> - we don't track your internet activity</li>
                <li>• <strong>No personal photos</strong> - we don't store or process images</li>
                <li>• <strong>No third-party data</strong> - we don't buy or share your information</li>
              </ul>
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">🎯 How We Use Your Data</h2>
            <p className="text-gray-600 mb-4">
              Your data is used only to provide the ChoreBlimey! service:
            </p>
            
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-800 mb-2">Required Data Usage:</h4>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• Provide the core ChoreBlimey! service</li>
                  <li>• Track chore completion and star earnings</li>
                  <li>• Manage family accounts and permissions</li>
                  <li>• Send important account notifications</li>
                </ul>
              </div>
              
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                <h4 className="font-semibold text-pink-800 mb-2">Optional Data Usage:</h4>
                <ul className="text-sm text-pink-700 space-y-1">
                  <li>• <strong>Gender</strong> - For gender-appropriate gift suggestions</li>
                  <li>• <strong>Birth month/year</strong> - For birthday reminders and age-appropriate rewards</li>
                  <li>• <strong>Interests</strong> - For personalized gift recommendations</li>
                  <li>• <strong>Themes</strong> - For customized app appearance</li>
                </ul>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">🗑️ Data Deletion & Account Management</h2>
            <p className="text-gray-600 mb-4">
              <strong>Complete Data Deletion:</strong> When you delete your family account, we permanently remove ALL data:
            </p>
            
            <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
              <li>All family information and settings</li>
              <li>All child profiles and progress data</li>
              <li>All chore history and completion records</li>
              <li>All wallet balances and transaction history</li>
              <li>All account data is permanently deleted within 30 days</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">⏰ Automatic Account Deletion</h2>
            <p className="text-gray-600 mb-4">
              To protect your privacy, we automatically delete inactive accounts:
            </p>
            
            <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
              <li><strong>6 months inactive:</strong> Accounts with no parent or child logins are automatically deleted</li>
              <li><strong>12 months suspended:</strong> If you suspend your account, we'll keep it for 12 months before deletion</li>
              <li><strong>Email notifications:</strong> We'll email you 30 days before automatic deletion</li>
              <li><strong>Easy reactivation:</strong> Just log in to prevent deletion</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">🔐 Smart Login & Data Security</h2>
            <p className="text-gray-600 mb-4">
              We use smart login technology to keep your family's data secure:
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-800 mb-2">🔑 Smart Login System:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• <strong>No passwords to remember</strong> - secure magic link authentication</li>
                <li>• <strong>Parent email only</strong> - children use join codes from parent portal</li>
                <li>• <strong>Child email optional</strong> - can be added later if needed</li>
                <li>• <strong>Secure join codes</strong> - time-limited, single-use codes for child access</li>
              </ul>
            </div>
            
            <p className="text-gray-600 mb-4">
              We protect your family's data with:
            </p>
            
            <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
              <li>End-to-end encryption for sensitive data</li>
              <li>Secure cloud storage with industry-standard protection</li>
              <li>Regular security audits and updates</li>
              <li>No third-party data sharing without your explicit consent</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">👨‍👩‍👧‍👦 Your Rights (GDPR)</h2>
            <p className="text-gray-600 mb-4">
              Under GDPR, you have the right to:
            </p>
            
            <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
              <li><strong>Access:</strong> Request a copy of all data we have about your family</li>
              <li><strong>Correction:</strong> Update or correct any inaccurate information</li>
              <li><strong>Deletion:</strong> Request complete deletion of your family's data</li>
              <li><strong>Portability:</strong> Export your data in a readable format</li>
              <li><strong>Restriction:</strong> Limit how we process your data</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">📧 Contact Us</h2>
            <p className="text-gray-600 mb-4">
              For any privacy questions or to exercise your rights:
            </p>
            
            <div className="bg-purple-50 rounded-lg p-6">
              <p className="text-gray-700">
                <strong>Email:</strong> privacy@choreblimey.com<br/>
                <strong>Response Time:</strong> Within 30 days<br/>
                <strong>Data Protection Officer:</strong> Available upon request
              </p>
            </div>

            <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">💝 Our Commitment</h3>
              <p className="text-gray-600">
                We built ChoreBlimey! to help families, not to exploit data. Your privacy is our priority, 
                and we'll always be transparent about how we use your information. 
                <strong>We never sell your data to third parties.</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy
