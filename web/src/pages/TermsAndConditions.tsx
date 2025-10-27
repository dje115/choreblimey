import React from 'react'
import SEOHead from '../components/SEOHead'

const TermsAndConditions: React.FC = () => {
  return (
    <>
      <SEOHead 
        title="Terms and Conditions - ChoreBlimey"
        description="Terms and conditions for using ChoreBlimey, the fun family chore management app."
      />
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="bg-card rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-primary mb-4">
                Welcome to ChoreBlimey! 🧹⭐
              </h1>
              <p className="text-lg text-muted-foreground">
                Let's make chores fun for the whole family!
              </p>
            </div>
            
            <div className="prose prose-lg max-w-none">
              <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-6 mb-8 border-l-4 border-blue-500">
                <p className="text-foreground mb-0">
                  <strong>Hey there! 👋</strong> These are our friendly rules for using ChoreBlimey. 
                  We've written them in plain English so everyone in the family can understand them. 
                  If you have any questions, just ask!
                </p>
              </div>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center">
                  <span className="mr-3">🤝</span>
                  How We Work Together
                </h2>
                <p className="text-foreground mb-4">
                  When you use ChoreBlimey, you're joining our family-friendly community! 
                  We're here to help make chores more fun and rewarding for everyone. 
                  By using our app, you're agreeing to play fair and be kind to each other.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center">
                  <span className="mr-3">👨‍👩‍👧‍👦</span>
                  Your Family Account
                </h2>
                <p className="text-foreground mb-4">
                  We keep your family's information safe and separate from other families. 
                  Parents are in charge of their family's account and making sure everyone 
                  uses ChoreBlimey in a positive way.
                </p>
                <p className="text-foreground mb-4">
                  <strong>For Parents:</strong> You're responsible for supervising your children's 
                  use of the app and making sure they're safe while having fun!
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center">
                  <span className="mr-3">🛡️</span>
                  Keeping Everyone Safe
                </h2>
                <p className="text-foreground mb-4">
                  ChoreBlimey is designed to be a safe, fun place for families. Here's how we keep it that way:
                </p>
                <ul className="list-disc pl-6 text-foreground mb-4 space-y-2">
                  <li><strong>Be Kind:</strong> No bullying, mean words, or hurtful behavior</li>
                  <li><strong>Be Honest:</strong> Don't cheat or lie about completing chores</li>
                  <li><strong>Be Respectful:</strong> Treat everyone in your family with respect</li>
                  <li><strong>Be Safe:</strong> Don't share personal information with strangers</li>
                  <li><strong>Be Fair:</strong> Play by the rules and help others succeed too</li>
                </ul>
                
                <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-4 mt-4 border-l-4 border-red-500">
                  <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">🚫 Prohibited Content:</h4>
                  <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                    <li>• No inappropriate language or content</li>
                    <li>• No sharing of personal information</li>
                    <li>• No harassment or bullying</li>
                    <li>• No spam or unwanted messages</li>
                    <li>• No content that violates family values</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center">
                  <span className="mr-3">⭐</span>
                  Your Content & Privacy
                </h2>
                <p className="text-foreground mb-4">
                  ChoreBlimey is designed to be private and safe for your family. Here's what we do and don't collect:
                </p>
                
                <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-4 mb-4 border-l-4 border-green-500">
                  <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">✅ What We Collect (Minimal & Safe):</h4>
                  <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                    <li>• <strong>Parent email</strong> - For secure login (no passwords needed!)</li>
                    <li>• <strong>Child nickname</strong> - Just what they want to be called</li>
                    <li>• <strong>Real name</strong> - Optional, encrypted for family records</li>
                    <li>• <strong>Birth year</strong> - Required for age-appropriate experience and safety</li>
                    <li>• <strong>Birth month</strong> - Optional, for birthday bonuses and precise age calculation</li>
                    <li>• <strong>Chore progress</strong> - What chores are done and when</li>
                    <li>• <strong>Text notes</strong> - Optional messages about completed chores</li>
                  </ul>
                </div>

                <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-4 mb-4 border-l-4 border-red-500">
                  <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">❌ What We DON'T Collect:</h4>
                  <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                    <li>• <strong>No photos</strong> - We don't collect or store any photos</li>
                    <li>• <strong>No exact birth dates</strong> - Only year (required) and month (optional)</li>
                    <li>• <strong>No location data</strong> - We don't track where you are</li>
                    <li>• <strong>No personal details</strong> - No addresses, phone numbers, etc.</li>
                  </ul>
                </div>

                <p className="text-foreground mb-4">
                  <strong>Your Privacy Matters:</strong> We never share your family's information with 
                  other families or companies without your permission. Check out our 
                  <a href="/privacy" className="text-primary hover:underline"> Privacy Policy</a> to learn more!
                </p>
                
                <div className="bg-purple-50 dark:bg-purple-900/10 rounded-lg p-4 mb-4 border-l-4 border-purple-500">
                  <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">🎂 Why We Need Birth Year:</h4>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mb-2">
                    We require your child's birth year to provide the best possible experience:
                  </p>
                  <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                    <li>• <strong>Age-appropriate rewards</strong> - Suggest gifts and activities suitable for their age</li>
                    <li>• <strong>Safe content</strong> - Ensure all features and content are appropriate for their developmental stage</li>
                    <li>• <strong>Tailored experience</strong> - Customize the app interface and difficulty level</li>
                    <li>• <strong>Birthday celebrations</strong> - Provide special birthday month bonuses and features</li>
                    <li>• <strong>Educational value</strong> - Deliver age-appropriate lessons about money and responsibility</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center">
                  <span className="mr-3">🎯</span>
                  How We Make Chores Fun
                </h2>
                <p className="text-foreground mb-4">
                  ChoreBlimey uses games, rewards, and friendly competition to make chores more enjoyable:
                </p>
                <ul className="list-disc pl-6 text-foreground mb-4 space-y-2">
                  <li><strong>Star System:</strong> Earn stars for completing chores</li>
                  <li><strong>Streaks:</strong> Build daily habits with streak bonuses</li>
                  <li><strong>Challenges:</strong> Friendly competition between siblings</li>
                  <li><strong>Rewards:</strong> Redeem stars for real rewards</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center">
                  <span className="mr-3">💰</span>
                  How We Keep ChoreBlimey Free
                </h2>
                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4 mb-4 border-l-4 border-blue-500">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">💡 Our Free Model:</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                    ChoreBlimey is completely free to use! We keep it free through optional affiliate partnerships:
                  </p>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• <strong>Amazon & other retailers</strong> - We may earn small commissions on purchases</li>
                    <li>• <strong>Always optional</strong> - You never have to buy anything to use ChoreBlimey</li>
                    <li>• <strong>No pressure</strong> - Rewards are just suggestions, not requirements</li>
                    <li>• <strong>Transparent</strong> - We're upfront about how we support the app</li>
                  </ul>
                </div>
                <p className="text-foreground mb-4">
                  When families choose to purchase rewards through our suggested links (like Amazon), 
                  we may receive a small commission. This helps us keep ChoreBlimey free for everyone! 
                  You're never obligated to buy anything - the app works perfectly without any purchases.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center">
                  <span className="mr-3">🔄</span>
                  Changes & Updates
                </h2>
                <p className="text-foreground mb-4">
                  We're always working to make ChoreBlimey better! Sometimes we might update these rules 
                  to add new features or improve safety. When we do, we'll let you know so you can stay informed.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center">
                  <span className="mr-3">⚠️</span>
                  Important Disclaimers
                </h2>
                <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-lg p-4 mb-4 border-l-4 border-yellow-500">
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Please Note:</h4>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-2">
                    <li>• <strong>No uptime guarantee</strong> - We can't promise ChoreBlimey will always be available</li>
                    <li>• <strong>No data backup guarantee</strong> - Please don't rely on us as your only record of chore progress</li>
                    <li>• <strong>Development focus</strong> - We're focused on making fun family apps, not enterprise software</li>
                    <li>• <strong>Terms are necessary</strong> - We need these rules to protect everyone, but our main goal is family fun!</li>
                  </ul>
                </div>
                <p className="text-foreground mb-4">
                  We're a small team passionate about making chores fun for families. While we do our best 
                  to keep ChoreBlimey running smoothly, we can't guarantee it will always be available or 
                  that your data will never be lost. Please keep your own records of important chore progress!
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center">
                  <span className="mr-3">🗑️</span>
                  Account Management & Deletion
                </h2>
                <p className="text-foreground mb-4">
                  You have full control over your family's ChoreBlimey account:
                </p>
                <ul className="list-disc pl-6 text-foreground mb-4 space-y-2">
                  <li><strong>Delete anytime:</strong> You can delete your family account at any time</li>
                  <li><strong>Complete data removal:</strong> All family data is permanently deleted within 30 days</li>
                  <li><strong>Child data protection:</strong> Parents control all child data and can remove it instantly</li>
                  <li><strong>No data retention:</strong> We don't keep backups of deleted family data</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center">
                  <span className="mr-3">🤔</span>
                  Questions? We're Here to Help!
                </h2>
                <p className="text-foreground mb-4">
                  If you or your family have any questions about these rules or how ChoreBlimey works, 
                  don't hesitate to reach out! We're here to help make your family's chore experience 
                  as fun and successful as possible.
                </p>
              </section>

              <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-6 mb-8 border-l-4 border-green-500">
                <h3 className="text-lg font-semibold text-primary mb-3">Remember: ChoreBlimey is About Fun! 🎉</h3>
                <p className="text-foreground mb-0">
                  These rules are here to make sure everyone has a great time using ChoreBlimey. 
                  When we all work together and follow these guidelines, chores become something 
                  the whole family can enjoy!
                </p>
              </div>

              <div className="mt-12 pt-8 border-t border-border">
                <p className="text-center text-muted-foreground mb-6">
                  <strong>Last updated:</strong> {new Date().toLocaleDateString()}
                </p>
                <p className="text-center text-muted-foreground mb-6">
                  By using ChoreBlimey, you're agreeing to these friendly rules. 
                  Let's make chores fun together! 🧹⭐
                </p>
                <div className="text-center">
                  <a 
                    href="/" 
                    className="inline-flex items-center px-8 py-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-lg font-semibold"
                  >
                    🏠 Back to ChoreBlimey
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default TermsAndConditions
