import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import LegalDocument from '../components/LegalDocument';
import { getLegalMeta } from '../lib/legal';

function buildSections(operator) {
  return [
    {
      id: 'controller',
      title: '1. Who we are',
      paragraphs: [
        `${operator} ("we", "us") operates this Neuron instance. For privacy requests, contact the address at the bottom of this page.`,
        'This policy describes personal data we process when you use accounts, Resonance (threads and fields), Dialogue (messages), and Projects (repositories, issues, pull requests).',
      ],
    },
    {
      id: 'collect',
      title: '2. Data we collect',
      paragraphs: [
        'Account data: username, email, password hash (if you use password login), profile fields, OAuth identifiers when you link providers, two-factor settings, and session metadata.',
        'Content data: threads, replies, votes, messages, encryption metadata for chat, project files and metadata, issues, comments, reviews, and moderation records tied to your account.',
        'Technical data: IP address and user agent in security logs, rate-limit counters, push subscription endpoints, notification preferences, and optional analytics events (see Analytics below).',
      ],
    },
    {
      id: 'purposes',
      title: '3. Why we use data',
      paragraphs: [
        'To provide and secure the Service: authentication, authorization, real-time features, email verification, password reset, notifications (in-app, email, and optional web push), search, and recommendations.',
        'To prevent abuse: captcha (when enabled), report handling, sanctions, and audit logs for moderator actions.',
        'To operate infrastructure: backups, error monitoring (when Sentry is configured), and aggregated analytics (when ClickHouse is configured).',
      ],
    },
    {
      id: 'legal-bases',
      title: '4. Legal bases (EEA/UK users)',
      paragraphs: [
        'Contract: processing necessary to provide the Service you signed up for.',
        'Legitimate interests: security, fraud prevention, improving reliability, and moderation—balanced against your rights.',
        'Consent: optional cookies beyond essentials, web push subscriptions, and non-essential marketing if ever offered.',
        'Legal obligation: where we must retain or disclose data under applicable law.',
      ],
    },
    {
      id: 'sharing',
      title: '5. Processors and sharing',
      paragraphs: [
        'We use subprocessors only as needed to run the instance you use, for example: email delivery (Resend), media storage (Cloudflare R2 when enabled), captcha (Cloudflare Turnstile when enabled), and error tracking (Sentry when configured).',
        'We do not sell your personal data. We may disclose data if required by law or to protect rights, safety, and integrity of the Service.',
        'Other users can see content you publish according to visibility settings (public projects, public fields, direct messages to participants).',
      ],
    },
    {
      id: 'retention',
      title: '6. Retention',
      paragraphs: [
        'Account and content data are kept while your account is active. When you delete your account, we remove or anonymize associated records according to database rules; some logs or backups may persist for a limited period before rotation.',
        'Session and security logs are retained for operational needs, typically on the order of weeks unless a longer period is required for an investigation.',
        'Analytics outbox rows are marked processed after shipping; downstream ClickHouse retention is configured by the operator.',
      ],
    },
    {
      id: 'rights',
      title: '7. Your rights',
      paragraphs: [
        'In Settings you can export a copy of your account data and permanently delete your account (subject to confirmation).',
        'Depending on your location, you may have rights to access, rectify, erase, restrict, port, or object to processing, and to lodge a complaint with a supervisory authority.',
        'Contact us using the email below to exercise rights; we may need to verify your identity.',
      ],
    },
    {
      id: 'cookies',
      title: '8. Cookies and local storage',
      paragraphs: [
        'Essential cookies and local storage are used for authentication, session security, and CSRF protection. These are necessary for the Service to function.',
        'We may store your cookie consent choice locally. Optional analytics or preference cookies, if introduced, will be described here and in the cookie banner.',
      ],
    },
    {
      id: 'security',
      title: '9. Security',
      paragraphs: [
        'We use HTTPS in production, hashed passwords, optional two-factor authentication, encrypted chat payloads, rate limiting, and access controls. No method of transmission or storage is 100% secure.',
        'Report suspected vulnerabilities to the contact address below.',
      ],
    },
    {
      id: 'analytics',
      title: '10. Analytics',
      paragraphs: [
        'We queue anonymized or pseudonymous usage events in our database outbox. A background worker ships them to ClickHouse when configured, or logs them when ClickHouse is not set up.',
        'Analytics are used to understand feature usage and reliability, not to sell advertising profiles.',
      ],
    },
    {
      id: 'children',
      title: '11. Children',
      paragraphs: [
        'The Service is not directed at children under 16 (or the age required in your jurisdiction). We do not knowingly collect data from children.',
      ],
    },
    {
      id: 'transfers',
      title: '12. International transfers',
      paragraphs: [
        'If subprocessors or infrastructure are located outside your country, data may be transferred with appropriate safeguards (standard contractual clauses or equivalent mechanisms) where required.',
      ],
    },
    {
      id: 'changes',
      title: '13. Changes',
      paragraphs: [
        'We may update this policy. The "Last updated" date at the top will change. Material changes may be communicated via the Service or email where appropriate.',
      ],
    },
  ];
}

export default function PrivacyPage() {
  const meta = getLegalMeta();
  const sections = buildSections(meta.operator);

  return (
    <Layout title="Privacy Policy">
      <PageHeader
        eyebrow="Legal"
        title="Privacy Policy"
        description="What we collect, why we use it, and how you control your data."
      />
      <section className="panel legal-panel">
        <LegalDocument
          title="Privacy Policy"
          description="Data practices for this Neuron instance."
          lastUpdated={meta.lastUpdated}
          contact={meta.contact}
          operator={meta.operator}
          siteUrl={meta.siteUrl}
          sections={sections}
        />
      </section>
    </Layout>
  );
}
