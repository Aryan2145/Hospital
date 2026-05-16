import { ArrowLeft, FileText } from "lucide-react";
import { useLocation } from "wouter";

export default function TermsAndConditions() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" data-testid="terms-page">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          data-testid="button-back-home"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-terms-title">Terms and Conditions</h1>
            <p className="text-sm text-muted-foreground">Effective Date: 15/05/2026</p>
          </div>
        </div>

        <div className="text-sm text-muted-foreground mb-8 space-y-0.5">
          <p><span className="font-medium text-foreground">Product:</span> RGB-HCRM</p>
          <p><span className="font-medium text-foreground">Website:</span> https://rgbindia.com</p>
          <p><span className="font-medium text-foreground">Company:</span> RGB Business Growth Consulting</p>
          <p><span className="font-medium text-foreground">Email:</span> tech@rgbindia.com</p>
          <p><span className="font-medium text-foreground">Address:</span> 804, Avadh Kontina, VIP Road, Vesu, Surat, Gujarat, India</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-muted-foreground leading-relaxed">

          <p>
            Welcome to RGB-HCRM. These Terms and Conditions govern the access to and use of RGB-HCRM, including its website, software platform, CRM modules, dashboards, integrations, communication tools, reports, workflows, and related services.
          </p>
          <p>
            By accessing or using RGB-HCRM, the customer organization and its authorized users agree to be bound by these Terms and Conditions. If you do not agree with these Terms, you should not access or use RGB-HCRM.
          </p>

          <Section title="1. About RGB-HCRM">
            <p>
              RGB-HCRM is a healthcare-focused customer relationship management platform developed to help healthcare organizations manage patient enquiries, appointments, follow-ups, lead tracking, referral tracking, campaign tracking, communication workflows, and related administrative and growth processes.
            </p>
            <p>
              RGB-HCRM is designed to support the commercial, operational, and administrative side of the healthcare journey. It is not a clinical decision-making system, hospital information system, electronic medical record system, prescription system, or medical advice platform.
            </p>
            <p>
              All clinical decisions, medical advice, diagnosis, treatment, prescriptions, procedures, and patient outcomes remain the responsibility of the healthcare organization and its qualified medical professionals.
            </p>
          </Section>

          <Section title="2. Eligibility to Use">
            <p>
              RGB-HCRM is intended for use by hospitals, clinics, healthcare providers, diagnostic centers, wellness centers, and other healthcare-related organizations.
            </p>
            <p>The platform may be used only by authorized employees, consultants, representatives, or users approved by the customer organization.</p>
            <p>By using RGB-HCRM, the customer organization and its users confirm that:</p>
            <ul>
              <li>They are legally authorized to use the platform.</li>
              <li>They will use the platform only for lawful business purposes.</li>
              <li>They will comply with all applicable laws, rules, regulations, and professional standards.</li>
              <li>They will not misuse, copy, damage, disrupt, reverse-engineer, or interfere with the platform.</li>
              <li>They will not use RGB-HCRM for any unauthorized, unlawful, misleading, or harmful activity.</li>
            </ul>
          </Section>

          <Section title="3. User Accounts and Login Access">
            <p>RGB-HCRM provides user access through login credentials created or approved for specific users.</p>
            <p>Each user is responsible for:</p>
            <ul>
              <li>Keeping login credentials confidential.</li>
              <li>Not sharing usernames, passwords, OTPs, or access links with unauthorized persons.</li>
              <li>Using the platform only within the role and access rights assigned to them.</li>
              <li>Immediately informing the organization administrator or RGB-HCRM support team in case of suspected misuse or unauthorized access.</li>
              <li>Ensuring that platform access is not used from unsafe, shared, or compromised devices.</li>
            </ul>
            <p>
              RGB-HCRM reserves the right to suspend, restrict, or disable access if misuse, unauthorized access, suspicious activity, security risk, or breach of these Terms is detected.
            </p>
          </Section>

          <Section title="4. Role-Based Access">
            <p>
              RGB-HCRM may provide different access levels for administrators, managers, doctors, counsellors, patient coordinators, telecallers, front office users, marketing users, billing users, insurance users, and other roles.
            </p>
            <p>The customer organization is responsible for:</p>
            <ul>
              <li>Assigning correct roles to its users.</li>
              <li>Ensuring that users receive access only to the information required for their work.</li>
              <li>Reviewing user access periodically.</li>
              <li>Removing or disabling access for employees, consultants, or users who are no longer associated with the organization.</li>
              <li>Preventing unauthorized access to patient, lead, business, or financial information.</li>
            </ul>
            <p>RGB-HCRM provides access control features, but proper use of those features remains the responsibility of the customer organization.</p>
          </Section>

          <Section title="5. Customer Data and Patient Information">
            <p>
              The data entered, uploaded, stored, processed, or generated in RGB-HCRM may include patient enquiries, contact details, appointment details, consultation-related notes, follow-up records, referral details, campaign source details, communication records, internal remarks, estimates, and other business-related information.
            </p>
            <p>The customer organization remains responsible for:</p>
            <ul>
              <li>Collecting patient, lead, and customer data lawfully.</li>
              <li>Obtaining necessary consent wherever required.</li>
              <li>Ensuring accuracy and completeness of data entered into the platform.</li>
              <li>Using patient and lead information only for legitimate and lawful purposes.</li>
              <li>Complying with applicable privacy, data protection, healthcare, communication, and professional laws.</li>
              <li>Ensuring that its users do not enter unlawful, false, misleading, offensive, or unauthorized content into the platform.</li>
            </ul>
            <p>
              RGB-HCRM will process customer data only for providing, maintaining, supporting, securing, and improving the platform and related services, subject to the applicable Privacy Policy and agreed commercial arrangements.
            </p>
          </Section>

          <Section title="6. Patient Consent and Communication">
            <p>
              RGB-HCRM may support communication through phone calls, WhatsApp, SMS, email, or other communication channels, either directly or through third-party integrations.
            </p>
            <p>The customer organization is solely responsible for ensuring that patients, leads, referrers, or contacts have provided appropriate consent for receiving communication.</p>
            <p>The customer organization must ensure that:</p>
            <ul>
              <li>Communication is lawful, relevant, and appropriate.</li>
              <li>Marketing or promotional communication is sent only where permitted.</li>
              <li>Opt-out, unsubscribe, or "do not contact" requests are respected.</li>
              <li>Communication frequency is reasonable.</li>
              <li>Patient privacy and dignity are maintained.</li>
              <li>Communication does not violate any law, platform policy, medical ethics, or professional standard.</li>
            </ul>
            <p>RGB-HCRM provides tools for communication management, but responsibility for lawful communication remains with the customer organization.</p>
          </Section>

          <Section title="7. Third-Party Integrations">
            <p>
              RGB-HCRM may integrate with third-party platforms, including but not limited to Meta, WhatsApp Business, telephony providers, Google services, analytics platforms, payment systems, communication tools, cloud services, and other external applications.
            </p>
            <p>Use of third-party integrations may be subject to the terms, conditions, policies, pricing, permissions, technical limitations, and availability of those third-party platforms.</p>
            <p>RGB-HCRM is not responsible for:</p>
            <ul>
              <li>Downtime, interruption, or errors in third-party services.</li>
              <li>Changes in third-party APIs, permissions, policies, or pricing.</li>
              <li>Rejection, restriction, or withdrawal of permissions by third-party platforms.</li>
              <li>Expired, revoked, invalid, or incorrectly configured tokens, credentials, or access keys.</li>
              <li>Loss of functionality caused by third-party changes.</li>
              <li>Non-compliance by the customer organization with third-party platform requirements.</li>
            </ul>
            <p>The customer organization is responsible for maintaining valid accounts, permissions, approvals, tokens, credentials, business verification, and platform compliance wherever required.</p>
          </Section>

          <Section title="8. Meta, WhatsApp, Campaign, and Lead Integrations">
            <p>
              Where RGB-HCRM is connected with Meta, Facebook, Instagram, WhatsApp Business, advertising platforms, lead forms, campaign tools, or similar systems, the customer organization is responsible for:
            </p>
            <ul>
              <li>Using authorized and verified business accounts.</li>
              <li>Maintaining correct App IDs, App Secrets, access tokens, page permissions, webhook settings, callback URLs, verify tokens, and related credentials.</li>
              <li>Ensuring compliance with Meta, WhatsApp, advertising platform, and communication policies.</li>
              <li>Maintaining a valid Privacy Policy, Terms and Conditions, Data Deletion URL, website, and consent mechanisms wherever required.</li>
              <li>Avoiding spam, misleading communication, unauthorized data use, or policy violations.</li>
              <li>Ensuring that campaign content, lead forms, and patient communication comply with applicable laws and platform rules.</li>
            </ul>
            <p>
              RGB-HCRM may support lead capture, campaign tracking, enquiry management, communication workflows, and reporting, but platform approval, permission approval, business verification, and policy compliance remain the responsibility of the customer organization.
            </p>
          </Section>

          <Section title="9. Data Security">
            <p>
              RGB-HCRM takes reasonable technical and organizational measures to protect customer data from unauthorized access, misuse, loss, alteration, or disclosure.
            </p>
            <p>However, no software system, cloud service, internet-based platform, or digital communication system can guarantee absolute security.</p>
            <p>The customer organization and its users are responsible for:</p>
            <ul>
              <li>Using strong passwords.</li>
              <li>Avoiding shared login credentials.</li>
              <li>Restricting platform access to authorized users.</li>
              <li>Keeping devices, browsers, and networks secure.</li>
              <li>Not downloading, exporting, or sharing data irresponsibly.</li>
              <li>Not storing credentials in unsafe locations.</li>
              <li>Immediately reporting suspected security incidents to RGB-HCRM.</li>
            </ul>
            <p>RGB-HCRM shall not be responsible for security breaches caused by customer-side negligence, shared passwords, compromised devices, unauthorized internal access, or misuse by customer users.</p>
          </Section>

          <Section title="10. Data Backup, Retention, and Deletion">
            <p>RGB-HCRM may maintain backups and system records as part of its standard operational, security, and recovery processes.</p>
            <p>
              Data retention, backup frequency, deletion timelines, data export rights, and archival processes may depend on the subscription plan, service agreement, technical setup, applicable law, and commercial arrangement with the customer organization.
            </p>
            <p>The customer organization should maintain its own backup of important business records wherever required.</p>
            <p>
              Upon termination of services, RGB-HCRM may restrict or remove access to the platform. Data may be retained, exported, deleted, or archived as per the applicable agreement, retention policy, and legal requirements.
            </p>
            <p>Requests for data deletion, export, or correction may be sent to: <a href="mailto:tech@rgbindia.com" className="text-primary hover:underline">tech@rgbindia.com</a></p>
          </Section>

          <Section title="11. Acceptable Use">
            <p>
              Users agree not to use RGB-HCRM for any activity that is illegal, unauthorized, abusive, harmful, misleading, or damaging to the platform, patients, customer organizations, third parties, or RGB Business Growth Consulting.
            </p>
            <p>Users shall not:</p>
            <ul>
              <li>Use the platform for illegal, fraudulent, or unauthorized purposes.</li>
              <li>Upload harmful, offensive, defamatory, unlawful, or misleading content.</li>
              <li>Send spam, unsolicited, or unauthorized promotional messages.</li>
              <li>Access or attempt to access data without permission.</li>
              <li>Attempt to hack, overload, scan, damage, disrupt, or interfere with the platform.</li>
              <li>Reverse-engineer, copy, resell, sublicense, or commercially exploit the platform.</li>
              <li>Misrepresent identity, authority, qualification, or affiliation.</li>
              <li>Violate patient privacy, data protection, communication, or healthcare laws.</li>
              <li>Upload viruses, malware, scripts, bots, or harmful code.</li>
              <li>Use the platform in a way that damages the reputation or functioning of RGB-HCRM.</li>
            </ul>
            <p>Violation of acceptable use may result in suspension or termination of access.</p>
          </Section>

          <Section title="12. Platform Availability">
            <p>RGB-HCRM aims to provide reliable access to the platform. However, platform access may be interrupted from time to time due to:</p>
            <ul>
              <li>Scheduled maintenance.</li>
              <li>Emergency maintenance.</li>
              <li>Server issues.</li>
              <li>Hosting or cloud service disruptions.</li>
              <li>Internet connectivity failures.</li>
              <li>Third-party service failures.</li>
              <li>Software bugs or technical issues.</li>
              <li>Security incidents.</li>
              <li>Force majeure events.</li>
            </ul>
            <p>RGB-HCRM does not guarantee uninterrupted, error-free, always-available, or fully secure service at all times. Where feasible, RGB-HCRM may provide advance notice for planned maintenance.</p>
          </Section>

          <Section title="13. Product Updates and Changes">
            <p>RGB-HCRM may update, modify, improve, add, remove, or restructure platform features from time to time. Such changes may include:</p>
            <ul>
              <li>User interface improvements.</li>
              <li>Workflow changes.</li>
              <li>Security updates.</li>
              <li>New modules.</li>
              <li>Integration updates.</li>
              <li>Bug fixes.</li>
              <li>Performance improvements.</li>
              <li>Reporting enhancements.</li>
              <li>Feature restructuring.</li>
            </ul>
            <p>RGB-HCRM will make reasonable efforts to avoid unnecessary disruption. Certain changes may be made without prior notice where required for security, compliance, system stability, or product improvement.</p>
          </Section>

          <Section title="14. Subscription, Fees, and Payment">
            <p>
              Use of RGB-HCRM may be subject to subscription fees, implementation fees, customization charges, integration fees, training charges, support fees, or other charges agreed separately.
            </p>
            <p>The customer organization agrees to pay applicable fees as per the agreed proposal, invoice, service order, subscription plan, or commercial agreement.</p>
            <p>Unless otherwise agreed in writing:</p>
            <ul>
              <li>Fees are payable as per the agreed billing cycle.</li>
              <li>Taxes, including GST and other applicable taxes, shall be charged as per law.</li>
              <li>Delayed or failed payment may result in suspension or termination of access.</li>
              <li>Fees once paid may not be refundable except where specifically agreed in writing.</li>
            </ul>
            <p>Commercial terms, service scope, and payment obligations may be governed by a separate proposal, agreement, invoice, or subscription order.</p>
          </Section>

          <Section title="15. Implementation, Training, and Support">
            <p>RGB-HCRM may provide onboarding, implementation assistance, training, configuration support, and technical support as agreed with the customer organization.</p>
            <p>The customer organization is responsible for:</p>
            <ul>
              <li>Providing required information on time.</li>
              <li>Nominating internal administrators and key users.</li>
              <li>Participating in training sessions.</li>
              <li>Ensuring internal adoption by its team.</li>
              <li>Reviewing configured workflows.</li>
              <li>Validating data accuracy.</li>
              <li>Reporting issues in a timely and clear manner.</li>
              <li>Ensuring that users follow the defined process.</li>
            </ul>
            <p>Support scope, support hours, timelines, escalation process, and response levels may be defined separately.</p>
          </Section>

          <Section title="16. Customization and Configuration">
            <p>
              RGB-HCRM may allow workflow configuration, status customization, role configuration, dashboard setup, integration setup, reporting customization, and other product adjustments.
            </p>
            <p>Any special customization, new workflow, custom report, special integration, feature development, or product change may be separately evaluated and charged.</p>
            <p>RGB-HCRM reserves the right to accept, reject, defer, modify, or prioritize customization requests based on:</p>
            <ul>
              <li>Product roadmap.</li>
              <li>Technical feasibility.</li>
              <li>Security considerations.</li>
              <li>Compliance requirements.</li>
              <li>Commercial viability.</li>
              <li>Relevance to the broader product.</li>
            </ul>
            <p>
              Unless specifically agreed otherwise in writing, customizations, improvements, workflows, modules, reports, designs, and product ideas developed for one customer may be included in the broader RGB-HCRM product.
            </p>
          </Section>

          <Section title="17. Intellectual Property Rights">
            <p>
              All rights, title, and interest in RGB-HCRM, including its software, source code, object code, architecture, workflows, modules, dashboards, designs, documentation, product concepts, user interface, reports, trademarks, logos, trade names, and related intellectual property, belong to RGB Business Growth Consulting or its licensors.
            </p>
            <p>The customer organization and its users receive only a limited, non-exclusive, non-transferable, revocable right to use RGB-HCRM during the active subscription or service period.</p>
            <p>No customer or user may, without written permission:</p>
            <ul>
              <li>Copy the platform.</li>
              <li>Modify or create derivative works.</li>
              <li>Reverse-engineer or decompile the software.</li>
              <li>Sell, lease, sublicense, distribute, or commercially exploit the platform.</li>
              <li>Remove proprietary notices.</li>
              <li>Use RGB-HCRM branding without permission.</li>
              <li>Replicate the product design, workflows, modules, or architecture for competing purposes.</li>
            </ul>
          </Section>

          <Section title="18. Customer Content Ownership">
            <p>The customer organization owns the data and content entered or uploaded by its users into RGB-HCRM.</p>
            <p>By using RGB-HCRM, the customer organization grants RGB Business Growth Consulting permission to host, store, process, transmit, display, secure, backup, analyze, and use such data only for:</p>
            <ul>
              <li>Providing the platform.</li>
              <li>Supporting customer users.</li>
              <li>Running integrations.</li>
              <li>Troubleshooting issues.</li>
              <li>Improving platform performance.</li>
              <li>Generating reports and dashboards.</li>
              <li>Maintaining security and system reliability.</li>
              <li>Fulfilling agreed service obligations.</li>
            </ul>
            <p>RGB-HCRM does not claim ownership over customer data.</p>
          </Section>

          <Section title="19. Analytics and Aggregated Data">
            <p>
              RGB-HCRM may use anonymized, aggregated, or statistical data to improve the product, monitor performance, enhance workflows, identify usage patterns, develop insights, and improve system reliability.
            </p>
            <p>Such aggregated data will not identify any individual patient, lead, user, or customer organization.</p>
            <p>RGB-HCRM may use such aggregated insights for product development, benchmarking, internal analysis, and business improvement.</p>
          </Section>

          <Section title="20. Medical Disclaimer">
            <p>RGB-HCRM is not a medical advice platform and does not provide diagnosis, treatment, prescription, clinical recommendation, or medical opinion.</p>
            <p>RGB-HCRM does not replace:</p>
            <ul>
              <li>Doctors.</li>
              <li>Hospitals.</li>
              <li>Medical professionals.</li>
              <li>Clinical judgment.</li>
              <li>Medical records.</li>
              <li>Patient examination.</li>
              <li>Diagnostic reports.</li>
              <li>Treatment protocols.</li>
              <li>Emergency care systems.</li>
            </ul>
            <p>
              Doctors, hospitals, clinics, and healthcare professionals remain fully responsible for all clinical decisions, patient care, medical advice, prescriptions, treatments, procedures, surgeries, follow-ups, and outcomes.
            </p>
            <p>
              RGB-HCRM only supports enquiry management, appointment coordination, follow-up tracking, communication management, lead management, referral tracking, campaign tracking, administrative workflows, and business process visibility.
            </p>
          </Section>

          <Section title="21. Limitation of Liability">
            <p>To the maximum extent permitted by law, RGB Business Growth Consulting and RGB-HCRM shall not be liable for:</p>
            <ul>
              <li>Loss of business, revenue, profit, goodwill, or opportunity.</li>
              <li>Loss, corruption, or inaccuracy of data.</li>
              <li>Incorrect data entered by customer users.</li>
              <li>Missed follow-ups, appointments, calls, or reminders due to user error, incorrect configuration, third-party failure, or technical issues.</li>
              <li>Clinical decisions, medical advice, treatment outcomes, or patient dissatisfaction.</li>
              <li>Third-party service failures or policy changes.</li>
              <li>Unauthorized access caused by customer-side negligence.</li>
              <li>Misuse of patient data by customer users.</li>
              <li>Indirect, incidental, special, punitive, or consequential damages.</li>
            </ul>
            <p>
              RGB-HCRM's total liability, if any, shall be limited to the amount paid by the customer organization for the relevant service period, unless otherwise required by law or agreed in writing.
            </p>
          </Section>

          <Section title="22. Indemnity">
            <p>
              The customer organization agrees to indemnify and hold harmless RGB Business Growth Consulting, RGB-HCRM, its owners, directors, employees, consultants, partners, vendors, and service providers from any claims, damages, penalties, losses, liabilities, costs, or expenses arising out of:
            </p>
            <ul>
              <li>Misuse of RGB-HCRM.</li>
              <li>Violation of these Terms.</li>
              <li>Violation of applicable laws.</li>
              <li>Unauthorized or unlawful use of patient, lead, or customer data.</li>
              <li>Failure to obtain required consent.</li>
              <li>Unlawful communication with patients, leads, or contacts.</li>
              <li>Breach of privacy, data protection, healthcare, or communication laws.</li>
              <li>Clinical decisions, medical advice, procedures, treatment, or patient outcomes.</li>
              <li>Breach of third-party platform policies.</li>
              <li>Actions or omissions of the customer organization or its users.</li>
            </ul>
          </Section>

          <Section title="23. Suspension and Termination">
            <p>RGB-HCRM may suspend, restrict, or terminate access to the platform if:</p>
            <ul>
              <li>Fees are unpaid.</li>
              <li>The customer violates these Terms.</li>
              <li>The platform is misused.</li>
              <li>There is a security risk.</li>
              <li>The customer uses the platform unlawfully.</li>
              <li>Required third-party permissions are revoked or invalid.</li>
              <li>Customer users misuse data or access rights.</li>
              <li>The customer's subscription or service agreement expires.</li>
              <li>Continued access may create legal, security, operational, or reputational risk.</li>
            </ul>
            <p>
              Upon termination, access to RGB-HCRM may be disabled. Data export, retention, deletion, or archival shall be handled as per the applicable agreement, retention policy, technical feasibility, and legal requirements.
            </p>
          </Section>

          <Section title="24. Confidentiality">
            <p>Both RGB Business Growth Consulting and the customer organization agree to protect confidential information received during the course of using or providing RGB-HCRM.</p>
            <p>Confidential information may include:</p>
            <ul>
              <li>Patient data.</li>
              <li>Lead data.</li>
              <li>Business data.</li>
              <li>Pricing.</li>
              <li>Reports.</li>
              <li>Credentials.</li>
              <li>Technical architecture.</li>
              <li>Product roadmap.</li>
              <li>Workflows.</li>
              <li>Internal processes.</li>
              <li>Training material.</li>
              <li>Commercial terms.</li>
            </ul>
            <p>
              Confidential information must not be disclosed to unauthorized persons except where required by law, court order, regulatory authority, or written agreement between the parties.
            </p>
            <p>This obligation continues even after termination of services.</p>
          </Section>

          <Section title="25. Force Majeure">
            <p>RGB-HCRM shall not be responsible for delay, interruption, failure, or non-performance caused by events beyond reasonable control. Such events may include:</p>
            <ul>
              <li>Natural disasters.</li>
              <li>Fire, flood, earthquake, or extreme weather.</li>
              <li>War, terrorism, civil unrest, or public disorder.</li>
              <li>Government action or regulatory restriction.</li>
              <li>Pandemic, epidemic, or public health emergency.</li>
              <li>Power failure.</li>
              <li>Internet or telecom failure.</li>
              <li>Cyberattack.</li>
              <li>Cloud service failure.</li>
              <li>Third-party service disruption.</li>
              <li>Labour issues.</li>
              <li>Any event beyond reasonable control.</li>
            </ul>
            <p>During such events, RGB-HCRM will make reasonable efforts to restore services where feasible.</p>
          </Section>

          <Section title="26. Changes to These Terms">
            <p>RGB Business Growth Consulting may update these Terms and Conditions from time to time.</p>
            <p>
              Updated Terms may be posted on the website, displayed within the platform, or communicated through email or other official channels.
            </p>
            <p>
              Continued use of RGB-HCRM after the updated Terms are published or communicated shall mean that the customer organization and its users accept the revised Terms.
            </p>
            <p>Users are encouraged to review these Terms periodically.</p>
          </Section>

          <Section title="27. Governing Law and Jurisdiction">
            <p>These Terms and Conditions shall be governed by and interpreted in accordance with the laws of India.</p>
            <p>
              Subject to applicable law, the courts located in Surat, Gujarat, India shall have exclusive jurisdiction over any dispute, claim, or proceeding arising from or relating to these Terms, RGB-HCRM, or services provided by RGB Business Growth Consulting.
            </p>
          </Section>

          <Section title="28. Contact Information">
            <p>For questions, notices, support requests, or concerns regarding these Terms and Conditions, please contact:</p>
            <div className="mt-3 space-y-0.5">
              <p><span className="font-medium text-foreground">Company:</span> RGB Business Growth Consulting</p>
              <p><span className="font-medium text-foreground">Product:</span> RGB-HCRM</p>
              <p><span className="font-medium text-foreground">Email:</span> <a href="mailto:tech@rgbindia.com" className="text-primary hover:underline">tech@rgbindia.com</a></p>
              <p><span className="font-medium text-foreground">Website:</span> <a href="https://rgbindia.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://rgbindia.com</a></p>
              <p><span className="font-medium text-foreground">Address:</span> 804, Avadh Kontina, VIP Road, Vesu, Surat, Gujarat, India</p>
            </div>
          </Section>

          <div className="mt-10 p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500">
            <p className="font-medium text-slate-700 mb-1">Website Footer Note</p>
            <p>
              By using RGB-HCRM, you agree to our Terms and Conditions and Privacy Policy. RGB-HCRM supports healthcare organizations in managing enquiries, appointments, follow-ups, communication, lead tracking, referral tracking, campaign tracking, and growth workflows. RGB-HCRM is not a medical advice platform and does not replace professional clinical judgment.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-foreground border-b border-slate-200 pb-2 mb-4">{title}</h2>
      <div className="space-y-3 [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:space-y-1 [&_ul]:text-muted-foreground [&_p]:text-muted-foreground [&_p]:leading-relaxed">
        {children}
      </div>
    </section>
  );
}
