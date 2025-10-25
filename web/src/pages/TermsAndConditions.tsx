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
            <h1 className="text-4xl font-bold text-primary mb-8 text-center">
              Terms and Conditions
            </h1>
            
            <div className="prose prose-lg max-w-none">
              <p className="text-muted-foreground mb-6 text-center">
                Last updated: {new Date().toLocaleDateString()}
              </p>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">1. Acceptance of Terms</h2>
                <p className="text-foreground mb-4">
                  By accessing and using ChoreBlimey ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">2. Use License</h2>
                <p className="text-foreground mb-4">
                  Permission is granted to temporarily download one copy of ChoreBlimey per device for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
                </p>
                <ul className="list-disc pl-6 text-foreground mb-4">
                  <li>modify or copy the materials</li>
                  <li>use the materials for any commercial purpose or for any public display</li>
                  <li>attempt to reverse engineer any software contained on ChoreBlimey's website</li>
                  <li>remove any copyright or other proprietary notations from the materials</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">3. User Accounts</h2>
                <p className="text-foreground mb-4">
                  When you create an account with us, you must provide information that is accurate, complete, and current at all times. You are responsible for safeguarding the password and for all activities that occur under your account.
                </p>
                <p className="text-foreground mb-4">
                  You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">4. Family Safety</h2>
                <p className="text-foreground mb-4">
                  ChoreBlimey is designed for family use. Parents and guardians are responsible for:
                </p>
                <ul className="list-disc pl-6 text-foreground mb-4">
                  <li>Supervising their children's use of the service</li>
                  <li>Ensuring appropriate content and interactions</li>
                  <li>Managing family member access and permissions</li>
                  <li>Protecting their children's privacy and safety</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">5. Prohibited Uses</h2>
                <p className="text-foreground mb-4">
                  You may not use our service:
                </p>
                <ul className="list-disc pl-6 text-foreground mb-4">
                  <li>For any unlawful purpose or to solicit others to perform unlawful acts</li>
                  <li>To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances</li>
                  <li>To infringe upon or violate our intellectual property rights or the intellectual property rights of others</li>
                  <li>To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate</li>
                  <li>To submit false or misleading information</li>
                  <li>To upload or transmit viruses or any other type of malicious code</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">6. Content</h2>
                <p className="text-foreground mb-4">
                  Our service allows you to post, link, store, share and otherwise make available certain information, text, graphics, videos, or other material ("Content"). You are responsible for the Content that you post to the service, including its legality, reliability, and appropriateness.
                </p>
                <p className="text-foreground mb-4">
                  By posting Content to our service, you grant us the right and license to use, modify, publicly perform, publicly display, reproduce, and distribute such Content on and through the service.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">7. Privacy Policy</h2>
                <p className="text-foreground mb-4">
                  Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the service, to understand our practices.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">8. Termination</h2>
                <p className="text-foreground mb-4">
                  We may terminate or suspend your account and bar access to the service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including but not limited to a breach of the Terms.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">9. Disclaimer</h2>
                <p className="text-foreground mb-4">
                  The information on this service is provided on an "as is" basis. To the fullest extent permitted by law, this Company:
                </p>
                <ul className="list-disc pl-6 text-foreground mb-4">
                  <li>excludes all representations and warranties relating to this service and its contents</li>
                  <li>excludes all liability for damages arising out of or in connection with your use of this service</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">10. Governing Law</h2>
                <p className="text-foreground mb-4">
                  These Terms shall be interpreted and governed by the laws of the jurisdiction in which ChoreBlimey operates, without regard to its conflict of law provisions.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">11. Changes</h2>
                <p className="text-foreground mb-4">
                  We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">12. Contact Information</h2>
                <p className="text-foreground mb-4">
                  If you have any questions about these Terms and Conditions, please contact us through our support channels.
                </p>
              </section>

              <div className="mt-12 pt-8 border-t border-border">
                <p className="text-center text-muted-foreground">
                  By using ChoreBlimey, you agree to these terms and conditions.
                </p>
                <div className="text-center mt-4">
                  <a 
                    href="/" 
                    className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Return to ChoreBlimey
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
