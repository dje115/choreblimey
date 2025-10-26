import React from 'react'

const SEOHead: React.FC = () => {
  return (
    <>
      <title>ChoreBlimey! - Fun Family Chore Management & Pocket Money App</title>
      <meta name="description" content="Transform chores into fun! ChoreBlimey helps families manage tasks, teach money skills, and reward children with stars and pocket money. Free app with optional gift suggestions." />
      <meta name="keywords" content="chore management, pocket money, family app, children rewards, task management, parenting, money skills, family organization" />
      <meta name="author" content="ChoreBlimey" />
      <meta name="robots" content="index, follow" />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://choreblimey.com/" />
      <meta property="og:title" content="ChoreBlimey! - Fun Family Chore Management" />
      <meta property="og:description" content="Transform chores into fun! Help children learn money skills with stars and pocket money rewards." />
      <meta property="og:image" content="https://choreblimey.com/og-image.jpg" />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content="https://choreblimey.com/" />
      <meta property="twitter:title" content="ChoreBlimey! - Fun Family Chore Management" />
      <meta property="twitter:description" content="Transform chores into fun! Help children learn money skills with stars and pocket money rewards." />
      <meta property="twitter:image" content="https://choreblimey.com/og-image.jpg" />
      
      {/* App Store Meta Tags */}
      <meta name="apple-itunes-app" content="app-id=123456789" />
      <meta name="google-play-app" content="app-id=com.choreblimey.app" />
      
      {/* Additional SEO */}
      <link rel="canonical" href="https://choreblimey.com/" />
      <meta name="theme-color" content="#8B5CF6" />
      <meta name="msapplication-TileColor" content="#8B5CF6" />
    </>
  )
}

export default SEOHead


