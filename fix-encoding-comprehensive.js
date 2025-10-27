const fs = require('fs');

// Read file as buffer to preserve exact bytes
const content = fs.readFileSync('web/src/pages/ParentDashboard.tsx', 'utf8');

// Comprehensive mapping of ALL garbled patterns to correct UTF-8
const fixes = {
  // Home/House emoji
  'ðŸ ': '🏠',
  
  // Manage/Document emojis  
  'ðŸ§¹': '📝',
  'ðŸ"‹': '📋',
  'ðŸ"Š': '📊',
  
  // Family emoji
  'ðŸ'¨â€ðŸ'©â€ðŸ'§â€ðŸ'¦': '👨‍👩‍👧‍👦',
  'ðŸ'¨â€ðŸ'©â€ðŸ'§': '👨‍👩‍👧',
  
  // Money/Financial emojis
  'ðŸ'°': '💰',
  'ðŸ'¸': '💸',
  'ðŸ'µ': '💵',
  
  // Action symbols
  'âž•': '➕',
  'âœï¸': '✏️',
  'âš™ï¸': '⚙️',
  'âœ…': '✅',
  'âŒ': '❌',
  'â³': '⏳',
  'â°': '⏰',
  'âš ï¸': '⚠️',
  'â¸ï¸': '⏸️',
  'âœ•': '✕',
  'âš"ï¸': '⚔️',
  'â†': '←',
  'âœ¨': '✨',
  
  // Star symbols
  'â­': '⭐',
  '⭐': '⭐',
  
  // Currency
  'Â£': '£',
  
  // Other emojis
  'ðŸŽ¯': '🎯',
  'ðŸŽ‰': '🎉',
  'ðŸŽ': '🎁',
  'ðŸŽŸï¸': '🎟️',
  'ðŸ†': '🏆',
  'ðŸŒŸ': '🌟',
  'ðŸŒ™': '🌙',
  'ðŸ"§': '📧',
  'ðŸ"¢': '🔔',
  'ðŸ"ˆ': '📈',
  
  // Text replacements
  'â€¢': '•',
  'â€¦': '…',
  'â€"': '—',
  'â€˜': ''',
  'â€™': ''',
  'â€œ': '"',
  'â€': '"',
  
  // Special patterns from the UI
  'ĐYD': '🏠',
  'ĐYS': '📝',
  'ĐY"Š': '📊',
  'ĐY'D': '💰',
  'ĐYĐ†': '🏆',
  'Y'a': '🎁',
  'JYS1/2': '📝',
  'âce': '👤',
  'âce...': '👤',
  'ðŸ'¨❌€ðŸ'©❌€ðŸ'§❌€ðŸ'¦': '👨‍👩‍👧‍👦',
  '❌€': '—',
  '❌š': '⚠',
  '❌œ': '✏',
  '❌Œ': '❌',
  '❌³': '⏳',
  '❌°': '⏰',
  '❌†': '←',
  '❌¸': '⏸',
  '❌‰': '≤'
};

// Apply all fixes
let fixed = content;
for (const [garbled, correct] of Object.entries(fixes)) {
  const regex = new RegExp(garbled.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  fixed = fixed.replace(regex, correct);
}

// Write back with UTF-8 encoding
fs.writeFileSync('web/src/pages/ParentDashboard.tsx', fixed, { encoding: 'utf8' });

console.log('✅ Fixed all encoding issues in ParentDashboard.tsx');



