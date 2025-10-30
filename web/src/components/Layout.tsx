import React from 'react'
import VersionBadge from './VersionBadge'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const Layout: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isChild = user?.role === 'child_player'

  const navigationItems = isChild 
    ? [
        { path: '/child-dashboard', label: 'My Chores', icon: '🏠' },
      ]
    : [
        { path: '/dashboard', label: 'Dashboard', icon: '📊' },
        { path: '/chores', label: 'Chores', icon: '🧹' },
      ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-outline">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to={isChild ? '/child-dashboard' : '/dashboard'} className="text-xl font-bold text-primary">
                🏠 ChoreBlimey!
              </Link>
            </div>
            
            <nav className="hidden md:flex space-x-8">
              {navigationItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {item.icon} {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {user?.role === 'child_player' ? user.childId : user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="bg-destructive text-destructive-foreground px-3 py-2 rounded-md text-sm font-medium hover:bg-destructive/90 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="md:hidden bg-surface border-b border-outline">
        <div className="px-2 pt-2 pb-3 space-y-1">
          {navigationItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {item.icon} {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <VersionBadge />
    </div>
  )
}

export default Layout
