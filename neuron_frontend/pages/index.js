import Link from 'next/link';
import Head from 'next/head';
import NeuronCanvas from '../components/NeuronCanvas';
import ManifestoNav from '../components/ManifestoNav';
import { useI18n } from '../lib/I18nContext';
import useReveal from '../lib/useReveal';

const EVOLUTION = [
  { from: 'evo_1_from', to: 'evo_1_to' },
  { from: 'evo_2_from', to: 'evo_2_to' },
  { from: 'evo_3_from', to: 'evo_3_to' },
  { from: 'evo_4_from', to: 'evo_4_to' },
  { from: 'evo_5_from', to: 'evo_5_to' },
  { from: 'evo_6_from', to: 'evo_6_to' },
];

const COMPETITORS = [
  { name: 'GitHub', textKey: 'comp_github_text' },
  { name: 'LinkedIn', textKey: 'comp_linkedin_text' },
  { name: 'Reddit', textKey: 'comp_reddit_text' },
  { name: 'Twitter / X', textKey: 'comp_twitter_text' },
];

const MANIFEST_SECTIONS = [
  { id: 'problem', labelKey: 'manifest_nav_problem' },
  { id: 'solution', labelKey: 'manifest_nav_solution' },
  { id: 'neuron', labelKey: 'manifest_nav_neuron' },
  { id: 'principles', labelKey: 'manifest_nav_principles' },
  { id: 'distribution', labelKey: 'manifest_nav_spread' },
];

const PRINCIPLES = [
  { titleKey: 'principle_1_title', textKey: 'principle_1_text' },
  { titleKey: 'principle_2_title', textKey: 'principle_2_text' },
  { titleKey: 'principle_3_title', textKey: 'manifest_depth_principle' },
  { titleKey: 'principle_4_title', textKey: 'principle_4_text' },
  { titleKey: 'principle_5_title', textKey: 'principle_5_text' },
];

export default function Home() {
  const { t } = useI18n();
  useReveal();

  return (
    <>
      <Head>
        <title>Neuron · A platform for cognitive synesthesia</title>
        <meta
          name="description"
          content="An environment where separate minds connect and create shared perception that none of them possessed individually."
        />
      </Head>

      <div className="landing">
        <div className="mesh-bg" aria-hidden />
        <NeuronCanvas density={0.14} intensity={0.95} />
        <div className="grain" aria-hidden />

        <div className="landing-shell">
          <ManifestoNav variant="landing" sections={MANIFEST_SECTIONS} />

          <div className="manifesto">
          <header className="manifesto-hero">
            <p className="manifesto-eyebrow reveal">{t('manifest_eyebrow')}</p>
            <h1 className="reveal" data-delay="1">
              {t('manifest_hero_h1')}
            </h1>
            <div className="manifesto-hero-actions reveal manifesto-hero-actions-tight" data-delay="2">
              <Link href="/explore" className="manifesto-cta manifesto-cta-lg">
                {t('manifest_enter')}
              </Link>
              <Link href="/login" className="manifesto-ghost">
                {t('manifest_signin')}
              </Link>
            </div>
            <div className="hero-signal reveal" data-delay="3" aria-hidden>
              <span className="hero-signal-dot" />
              <span className="hero-signal-text">
                {t('manifest_hero_signal')}
              </span>
            </div>
          </header>

          <section className="manifesto-section" id="problem">
            <p className="section-num reveal">{t('manifest_s1_num')}</p>
            <h2 className="reveal" data-delay="1">{t('manifest_s1_h2')}</h2>
            <p className="reveal" data-delay="2">
              {t('manifest_s1_p1')}
            </p>
            <p className="manifesto-emphasis reveal" data-delay="3">
              {t('manifest_s1_emphasis')}
            </p>

            <ul className="competitor-list">
              {COMPETITORS.map((c, i) => (
                <li key={c.name} className="reveal" data-delay={(i % 4) + 1}>
                  <strong>{c.name}</strong>
                  <span>{t(c.textKey)}</span>
                </li>
              ))}
            </ul>
            <p className="manifesto-muted reveal">
              {t('manifest_s1_muted')}
            </p>
          </section>

          <section className="manifesto-section" id="solution">
            <p className="section-num reveal">{t('manifest_s2_num')}</p>
            <h2 className="reveal" data-delay="1">{t('manifest_s2_h2')}</h2>
            <p className="reveal" data-delay="2">
              {t('manifest_s2_p1')}<em>{t('manifest_s2_emergence')}</em>.
            </p>

            <ol className="evolution-chain">
              {EVOLUTION.map((step, i) => (
                <li key={step.from} className="reveal" data-delay={(i % 4) + 1}>
                  <span className="evo-index">{String(i + 1).padStart(2, '0')}</span>
                  <span className="evo-from">{t(step.from)}</span>
                  <span className="evo-arrow">→</span>
                  <span className="evo-to">{t(step.to)}</span>
                </li>
              ))}
            </ol>

            <p className="reveal">
              {t('manifest_s2_p2')}
            </p>
            <p className="reveal" data-delay="1">
              {t('manifest_s2_p3')}
            </p>
            <p className="manifesto-emphasis reveal" data-delay="2">
              {t('manifest_s2_emphasis')}
            </p>
          </section>

          <section className="manifesto-section manifesto-highlight reveal" id="neuron">
            <p className="section-num">{t('manifest_s3_num')}</p>
            <h2>{t('manifest_neuron_h2')}</h2>
            <p>{t('manifest_neuron_p1')}</p>
            <p>{t('manifest_neuron_p2')}</p>

            <dl className="neuron-grid">
              <div>
                <dt>{t('manifest_dt_problem')}</dt>
                <dd>{t('manifest_dd_problem')}</dd>
              </div>
              <div>
                <dt>{t('manifest_dt_solution')}</dt>
                <dd>{t('manifest_dd_solution')}</dd>
              </div>
              <div>
                <dt>{t('manifest_mechanism_label')}</dt>
                <dd>{t('manifest_mechanism')}</dd>
              </div>
              <div>
                <dt>{t('manifest_dt_value')}</dt>
                <dd>{t('manifest_dd_value')}</dd>
              </div>
              <div>
                <dt>{t('manifest_dt_incentive')}</dt>
                <dd>{t('manifest_dd_incentive')}</dd>
              </div>
            </dl>
          </section>

          <section className="manifesto-section" id="principles">
            <p className="section-num reveal">{t('manifest_s4_num')}</p>
            <h2 className="reveal" data-delay="1">{t('manifest_s4_h2')}</h2>
            <ul className="principles-list">
              {PRINCIPLES.map((p, i) => (
                <li key={p.titleKey} className="reveal" data-delay={(i % 4) + 1}>
                  <h3>{t(p.titleKey)}</h3>
                  <p>{t(p.textKey)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="manifesto-section" id="distribution">
            <p className="section-num reveal">{t('manifest_s5_num')}</p>
            <h2 className="reveal" data-delay="1">{t('manifest_s5_h2')}</h2>
            <p className="reveal" data-delay="2">
              {t('manifest_s5_p1')}
            </p>
            <p className="reveal">
              {t('manifest_s5_p2')}
            </p>
            <p className="reveal" data-delay="1">
              {t('manifest_s5_p3')}
            </p>
            <p className="manifesto-emphasis reveal" data-delay="2">
              {t('manifest_s5_emphasis')}
            </p>
          </section>

          <footer className="manifesto-footer reveal">
            <p className="manifesto-closing">{t('manifest_closing')}</p>
            <Link href="/explore" className="manifesto-cta manifesto-cta-lg">
              {t('manifest_enter')}
            </Link>
            <p className="manifesto-signoff">{t('manifest_signoff')}</p>
          </footer>
          </div>
        </div>
      </div>
    </>
  );
}
