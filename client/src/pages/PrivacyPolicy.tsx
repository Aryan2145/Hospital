import { ArrowLeft, Shield } from "lucide-react";
import { useLocation } from "wouter";

export default function PrivacyPolicy() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" data-testid="privacy-policy-page">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          data-testid="button-back-home"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-privacy-title">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Last Updated: March 18, 2026</p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-foreground border-b pb-2">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              MyProSys Hospital CRM ("we," "our," or "us") is a cloud-based Customer Relationship Management platform designed for hospitals and healthcare organizations. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform. We are committed to protecting the privacy and security of all personal and health-related information entrusted to us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground border-b pb-2">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">We collect the following categories of information:</p>
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium text-foreground">2.1 Patient Information</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                  <li>Name, phone number, email address</li>
                  <li>Age, gender, and demographic details</li>
                  <li>Medical inquiry and consultation history</li>
                  <li>Appointment and treatment records</li>
                  <li>Insurance and billing information</li>
                  <li>Communication history (calls, messages, notes)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-base font-medium text-foreground">2.2 Hospital Staff Information</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                  <li>Employee name, email, phone number, and role</li>
                  <li>Login credentials and authentication data</li>
                  <li>Activity logs and system usage records</li>
                </ul>
              </div>
              <div>
                <h3 className="text-base font-medium text-foreground">2.3 Marketing and Campaign Data</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                  <li>Lead source and campaign attribution (UTM parameters)</li>
                  <li>Ad platform data from Meta (Facebook/Instagram) integrations</li>
                  <li>Campaign performance metrics (impressions, clicks, conversions)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-base font-medium text-foreground">2.4 Technical Data</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                  <li>Browser type and version</li>
                  <li>IP address and access timestamps</li>
                  <li>Device information and session data</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground border-b pb-2">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">We use collected information for the following purposes:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li>Managing patient inquiries, appointments, and treatment journeys</li>
              <li>Facilitating communication between hospital staff and patients</li>
              <li>Tracking lead sources and marketing campaign effectiveness</li>
              <li>Generating operational dashboards and analytics reports</li>
              <li>Sending appointment reminders and follow-up notifications via WhatsApp, SMS, or email</li>
              <li>Managing insurance coordination and billing workflows</li>
              <li>Ensuring platform security and preventing unauthorized access</li>
              <li>Improving platform features and user experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground border-b pb-2">4. Data Sharing and Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">We do not sell your personal information. We may share data in the following circumstances:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li><strong>Within the Hospital Organization:</strong> Data is accessible to authorized hospital staff based on their role and access level (Full, Masked, or None for sensitive patient health information).</li>
              <li><strong>Third-Party Integrations:</strong> When enabled by the hospital, data may be shared with integrated services including Meta (Facebook/Instagram) for lead capture, telephony services for call tracking, and WhatsApp Business API for messaging.</li>
              <li><strong>Service Providers:</strong> We use cloud hosting and infrastructure providers to operate the platform. These providers are contractually obligated to protect your data.</li>
              <li><strong>Legal Compliance:</strong> We may disclose information when required by law, regulation, or legal proceedings.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground border-b pb-2">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">We implement industry-standard security measures to protect your information:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li>Role-Based Access Control (RBAC) with a 4-tier hierarchy (System Admin, Admin, Manager, Agent/Counsellor)</li>
              <li>PHI (Protected Health Information) access levels: Full, Masked, or No access based on user role</li>
              <li>Encrypted data transmission using HTTPS/TLS protocols</li>
              <li>Secure authentication with session management</li>
              <li>Audit trails for all data modifications, including clinical notes</li>
              <li>Multi-tenant data isolation ensuring each hospital's data is completely separated</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground border-b pb-2">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain personal and patient data for as long as the hospital maintains an active subscription with MyProSys Hospital CRM, or as required by applicable healthcare regulations and legal obligations. Upon termination of a subscription, data may be retained for a reasonable period to allow for data export, after which it will be securely deleted or anonymized.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground border-b pb-2">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data.</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data, subject to legal retention requirements.</li>
              <li><strong>Portability:</strong> Request your data in a structured, commonly used format.</li>
              <li><strong>Objection:</strong> Object to certain processing activities, such as marketing communications.</li>
              <li><strong>Withdraw Consent:</strong> Where processing is based on consent, you may withdraw it at any time.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              To exercise any of these rights, please contact the hospital that manages your records or reach out to us directly using the contact information below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground border-b pb-2">8. Cookies and Tracking</h2>
            <p className="text-muted-foreground leading-relaxed">
              The platform uses essential cookies for session management and authentication. We do not use tracking cookies for advertising purposes. Third-party integrations (such as Meta) may use their own cookies and tracking mechanisms on their respective platforms, governed by their own privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground border-b pb-2">9. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">Our platform integrates with the following third-party services, each governed by their own privacy policies:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li><strong>Meta Platforms (Facebook/Instagram):</strong> For lead generation and campaign analytics</li>
              <li><strong>WhatsApp Business API:</strong> For patient communication and notifications</li>
              <li><strong>Telephony Services:</strong> For telephony integration and call tracking</li>
              <li><strong>Google Services:</strong> For data import capabilities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground border-b pb-2">10. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              MyProSys Hospital CRM is a business-to-business platform designed for use by authorized hospital personnel. It is not intended for direct use by individuals under the age of 18. Patient records for minors are managed by authorized hospital staff in accordance with applicable laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground border-b pb-2">11. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. We will notify registered users of significant changes through the platform. The "Last Updated" date at the top of this page indicates when the policy was most recently revised.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground border-b pb-2">12. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="mt-3 p-4 bg-slate-50 rounded-lg border">
              <p className="text-foreground font-medium">MyProSys Hospital CRM</p>
              <p className="text-muted-foreground text-sm">Operated by RGB India</p>
              <p className="text-muted-foreground text-sm mt-2">Email: tech@rgbindia.com</p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} MyProSys Hospital CRM. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
