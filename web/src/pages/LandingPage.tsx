import React from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import LanguageSelector from '../components/LanguageSelector'
import SEOHead from '../components/SEOHead'

const LandingPage: React.FC = () => {
  const { t } = useLanguage()
  
  return (
    <>
      <SEOHead />
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                  🎉
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  ChoreBlimey!
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <LanguageSelector />
                <Link 
                  to="/login"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-full font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  {t('get_started_free')} 🚀
                </Link>
              </div>
            </div>
          </div>
        </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-8">
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
              {t('turn_chores_into_cheers')}
            </span>
            <br />
            <span className="text-4xl sm:text-5xl lg:text-6xl text-gray-800">
              🎉
            </span>
          </h1>
          
          <p className="text-xl sm:text-2xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed">
            {t('fun_way_to_teach', {
              earning: <span className="font-semibold text-purple-600">{t('earning')}</span>,
              saving: <span className="font-semibold text-pink-600">{t('saving')}</span>,
              spending: <span className="font-semibold text-orange-600">{t('smart_spending')}</span>
            })}
            <br />
            {t('no_more_chore_battles')} - {t('just_happy_families')}! ✨
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              to="/login"
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-full text-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-2"
            >
              {t('start_family_adventure')}! 🌟
            </Link>
            <div className="text-sm text-gray-500">
              ✨ 100% {t('free_forever')} • {t('no_credit_card_required')}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">
              {t('why_families_love')} ChoreBlimey! 💝
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We make learning about money fun, not scary! Your kids will actually 
              <span className="font-semibold text-purple-600"> want</span> to do their chores! 
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="text-4xl mb-4">⭐</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Star Rewards System</h3>
              <p className="text-gray-600 leading-relaxed">
                Kids earn stars for completing chores! They can save up for amazing rewards - 
                from a special pizza night to cool toys from our curated gift list. 
                <span className="font-semibold text-purple-600"> You choose what works for your family!</span>
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Pocket Money Made Fun</h3>
              <p className="text-gray-600 leading-relaxed">
                Set budgets, track spending, and watch your kids learn the value of money! 
                They'll understand that <span className="font-semibold text-pink-600">earning</span> 
                feels better than just getting money handed to them.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="text-4xl mb-4">🎁</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Flexible Gift System</h3>
              <p className="text-gray-600 leading-relaxed">
                <span className="font-semibold text-orange-600">You're in control!</span> 
                Use our curated gift suggestions OR create your own rewards 
                like "Extra screen time" or "Choose dinner tonight". 
                <span className="font-semibold text-purple-600">It's all about what works for YOUR family!</span>
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">No Pressure Shopping</h3>
              <p className="text-gray-600 leading-relaxed">
                We never force purchases! Our gift suggestions are just that - 
                <span className="font-semibold text-green-600">suggestions</span>. 
                If you like them, great! If not, create your own rewards. 
                <span className="font-semibold text-purple-600">Your family, your rules!</span>
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Real-Time Updates</h3>
              <p className="text-gray-600 leading-relaxed">
                Watch the magic happen! When kids complete chores, everyone gets notified instantly. 
                No more "Did you do your chores?" - you'll know right away! 
                <span className="font-semibold text-pink-600">It's like having a family assistant!</span>
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Smart Learning</h3>
              <p className="text-gray-600 leading-relaxed">
                Kids learn that work = reward, building healthy money habits that last a lifetime. 
                They'll understand saving, spending, and the joy of earning their own rewards!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-800 mb-4">
            How ChoreBlimey Works! 🎪
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            It's so simple, even the kids will love it! (And you'll love the results)
          </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Create Chores</h3>
              <p className="text-gray-600 leading-relaxed">
                Parents set tasks and rewards. 
                <span className="font-semibold text-purple-600">You decide everything!</span>
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-orange-500 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Kids Complete & Earn</h3>
              <p className="text-gray-600 leading-relaxed">
                Children do chores, get stars and pocket money. 
                <span className="font-semibold text-pink-600">No more nagging needed!</span>
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Redeem Rewards</h3>
              <p className="text-gray-600 leading-relaxed">
                Kids choose gifts or save for bigger goals. 
                <span className="font-semibold text-orange-600">Learning has never been this fun!</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl font-bold text-gray-800 mb-4">
          Always Free, Always Fun! 🎉
        </h2>
        <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
          ChoreBlimey is completely free to use! We're supported by families who choose to use our gift suggestions, but 
          <span className="font-semibold text-purple-600">you're never required to buy anything</span>.
        </p>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">How We Keep It Free! 💝</h3>
            <div className="grid md:grid-cols-2 gap-8 text-left">
              <div>
                <h4 className="text-lg font-semibold text-purple-600 mb-3">✨ Optional Gift Suggestions</h4>
                <p className="text-gray-600 mb-4">
                  We curate amazing gift ideas for your kids! If you like them and decide to purchase, 
                  we get a small commission. <span className="font-semibold">But you can always create your own rewards!</span>
                </p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-pink-600 mb-3">🎁 Your Family, Your Rules</h4>
                <p className="text-gray-600">
                  Want to reward with "Extra screen time" or "Choose the movie tonight"? 
                  <span className="font-semibold">Go for it!</span> We're here to help, not control your family.
                </p>
              </div>
            </div>
            
            {/* Amazon Affiliate Disclosure */}
            <div className="mt-8 p-6 bg-white/70 rounded-xl border border-purple-200">
              <h4 className="text-lg font-semibold text-gray-700 mb-3">📋 Transparency Note</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                <span className="font-semibold">Amazon Associates Disclosure:</span> ChoreBlimey! is a participant in the Amazon Services LLC Associates Program, 
                an affiliate advertising program designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.com. 
                When you click on our gift suggestions and make a purchase, we may receive a small commission at no extra cost to you. 
                <span className="font-semibold text-purple-600">This helps us keep ChoreBlimey! completely free for all families!</span>
              </p>
              <p className="text-sm text-gray-500 mt-2">
                💡 <span className="font-semibold">Remember:</span> You're never required to use our gift suggestions - 
                you can always create your own custom rewards for your family!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Ready to Turn Chores Into Cheers? 🎉
          </h2>
          <p className="text-xl text-white/90 mb-12 max-w-3xl mx-auto">
            Join thousands of happy families who've discovered the secret to 
            <span className="font-semibold"> stress-free chore time</span> and 
            <span className="font-semibold"> money-smart kids</span>!
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              to="/login"
              className="bg-white text-purple-600 px-8 py-4 rounded-full text-lg font-bold hover:bg-gray-50 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-2"
            >
              Start Your Free Family Adventure! 🚀
            </Link>
            <div className="text-white/80 text-sm">
              ✨ No credit card • No hidden fees • Just happy families!
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                🎉
              </div>
              <h3 className="text-2xl font-bold">ChoreBlimey!</h3>
            </div>
            <p className="text-gray-400 mb-6">
              Making chores fun and teaching kids about money - one star at a time! ⭐
            </p>
            
            {/* Legal Links */}
            <div className="flex flex-wrap justify-center gap-6 mb-6">
              <Link to="/privacy" className="text-gray-400 hover:text-white transition-colors text-sm">
                Privacy Policy & GDPR
              </Link>
              <Link to="/terms" className="text-gray-400 hover:text-white transition-colors text-sm">
                Terms & Conditions
              </Link>
              <a href="mailto:privacy@choreblimey.com" className="text-gray-400 hover:text-white transition-colors text-sm">
                Contact Privacy
              </a>
              <a href="mailto:legal@choreblimey.com" className="text-gray-400 hover:text-white transition-colors text-sm">
                Contact Legal
              </a>
            </div>
            
            <div className="text-sm text-gray-500">
              © 2024 ChoreBlimey! • Made with 💝 for happy families
            </div>
          </div>
        </div>
      </footer>
    </div>
    </>
  )
}

export default LandingPage
