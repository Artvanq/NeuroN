import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import LegalDocument from '../components/LegalDocument';
import { getLegalMeta } from '../lib/legal';

function buildSections(operator) {
  return [
    {
      id: 'acceptance',
      title: '1. Acceptance',
      paragraphs: [
        `These Terms of Use ("Terms") govern access to and use of the ${operator} platform ("Service"). By creating an account, signing in, or using the Service, you agree to these Terms.`,
        'If you do not agree, do not use the Service. We may update these Terms; material changes will be reflected on this page with an updated date. Continued use after changes constitutes acceptance.',
      ],
    },
    {
      id: 'eligibility',
      title: '2. Eligibility and accounts',
      paragraphs: [
        'You must be able to form a binding contract in your jurisdiction and comply with applicable law. You are responsible for keeping your credentials confidential and for all activity under your account.',
        'You must provide accurate registration information and keep your email reachable if verification is required. One person or legal entity per account unless we explicitly allow otherwise.',
        'We may suspend or terminate accounts that violate these Terms, applicable law, or platform policy, with or without notice where permitted by law.',
      ],
    },
    {
      id: 'content',
      title: '3. Your content',
      paragraphs: [
        'You retain ownership of content you submit (threads, replies, messages, project files, issues, and related metadata). You grant the Service a non-exclusive, worldwide license to host, display, reproduce, and process your content solely to operate and improve the Service (including backups, search, moderation, and notifications).',
        'You represent that you have the rights to post your content and that it does not infringe third-party rights. You are solely responsible for what you publish.',
      ],
    },
    {
      id: 'conduct',
      title: '4. Acceptable use',
      paragraphs: [
        'You must not: attempt unauthorized access; interfere with the Service; scrape or overload systems beyond reasonable use; distribute malware; harass or threaten others; post illegal content; impersonate others; or circumvent security, rate limits, or moderation.',
        'Automated posting or voting that manipulates rankings is prohibited unless we provide an official API and you comply with its terms.',
      ],
    },
    {
      id: 'moderation',
      title: '5. Moderation and enforcement',
      paragraphs: [
        'Community fields and platform moderators may review reports, remove or restrict content, lock threads, and apply sanctions including bans. Moderation decisions are made in good faith to protect users and the Service.',
        'You may appeal certain sanctions where the Service provides an appeals flow. Abuse of the reporting system may itself result in restrictions.',
      ],
    },
    {
      id: 'projects',
      title: '6. Projects, git, and collaboration',
      paragraphs: [
        'Project repositories, pull requests, issues, and CI runs are provided as collaboration tools. You must not store secrets in repositories; use environment-specific secret management outside public files.',
        'Git access (HTTP or SSH) is authenticated per user. You are responsible for tokens and SSH keys issued from your account.',
      ],
    },
    {
      id: 'privacy',
      title: '7. Privacy',
      paragraphs: [
        'Our Privacy Policy describes how we collect and use personal data, including export and account deletion. It is incorporated into these Terms by reference.',
      ],
    },
    {
      id: 'third-party',
      title: '8. Third-party services',
      paragraphs: [
        'The Service may integrate optional providers (email delivery, media storage, captcha, error monitoring, OAuth login). Their use is subject to their terms and our Privacy Policy.',
        'We are not responsible for third-party sites linked from user content.',
      ],
    },
    {
      id: 'disclaimer',
      title: '9. Disclaimers',
      paragraphs: [
        'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT, TO THE MAXIMUM EXTENT PERMITTED BY LAW.',
        'We do not guarantee uninterrupted or error-free operation, preservation of all data, or suitability for any particular purpose.',
      ],
    },
    {
      id: 'liability',
      title: '10. Limitation of liability',
      paragraphs: [
        'TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE OPERATOR AND ITS AFFILIATES SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.',
        'Where liability cannot be excluded, our aggregate liability shall not exceed the greater of (a) amounts you paid us in the twelve months before the claim, or (b) one hundred US dollars, unless mandatory law requires otherwise.',
      ],
    },
    {
      id: 'termination',
      title: '11. Termination',
      paragraphs: [
        'You may delete your account in Settings, subject to retention described in the Privacy Policy. We may terminate or suspend access for violations or operational reasons.',
        'Sections that by nature should survive (content licenses granted for backup retention periods, disclaimers, liability limits, and governing law) survive termination.',
      ],
    },
    {
      id: 'law',
      title: '12. Governing law',
      paragraphs: [
        'These Terms are governed by the laws applicable to the operator’s principal place of business, without regard to conflict-of-law rules, unless mandatory consumer protection laws in your country require otherwise.',
        'Disputes should first be raised via the contact email below. Courts with jurisdiction over the operator may hear disputes that cannot be resolved informally.',
      ],
    },
  ];
}

export default function TermsPage() {
  const meta = getLegalMeta();
  const sections = buildSections(meta.operator);

  return (
    <Layout title="Terms of Use">
      <PageHeader
        eyebrow="Legal"
        title="Terms of Use"
        description="Rules for using the platform responsibly and lawfully."
      />
      <section className="panel legal-panel">
        <LegalDocument
          title="Terms of Use"
          description="Rules for using the platform."
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
