import Link from 'next/link';
import Head from 'next/head';
import NeuronCanvas from '../components/NeuronCanvas';
import ManifestoNav from '../components/ManifestoNav';
import { useI18n } from '../lib/I18nContext';
import useReveal from '../lib/useReveal';

const EVOLUTION = [
  { from: 'Atoms combined', to: 'Molecules' },
  { from: 'Molecules combined', to: 'Cells' },
  { from: 'Cells combined', to: 'Organism' },
  { from: 'Neurons combined', to: 'Consciousness' },
  { from: 'Consciousnesses combined', to: 'Culture' },
  { from: 'Intellects will combine', to: 'Superintelligence' },
];

const COMPETITORS = [
  {
    name: 'GitHub',
    text: 'Code without ideas. Technique without philosophy. Tools without the question of why.',
  },
  {
    name: 'LinkedIn',
    text: 'Connections without depth. A career showcase. Everyone performing success.',
  },
  {
    name: 'Reddit',
    text: 'Chaos and anonymity. Memes defeat thought. Depth drowns in noise.',
  },
  {
    name: 'Twitter / X',
    text: 'Fragments without dialogue. Provocation instead of thinking. Reach instead of meaning.',
  },
];

const MANIFEST_SECTIONS = [
  { id: 'problem', labelKey: 'manifest_nav_problem' },
  { id: 'solution', labelKey: 'manifest_nav_solution' },
  { id: 'neuron', labelKey: 'manifest_nav_neuron' },
  { id: 'principles', labelKey: 'manifest_nav_principles' },
  { id: 'distribution', labelKey: 'manifest_nav_spread' },
];

const PRINCIPLES = [
  {
    title: 'The question matters more than the answer',
    text: 'A good question attracts the right people. A ready answer closes dialogue. Neuron is built around open questions with no single correct answer.',
  },
  {
    title: 'Friction creates the spark',
    text: 'Echo chambers kill thought. You need people who think similarly — but not identically. The collision of different perspectives on one question creates what existed in none of them alone.',
  },
  {
    title: 'Depth over virality',
    key: 'manifest_depth_principle',
  },
  {
    title: 'Creation over consumption',
    text: 'Most platforms turn people into audiences. Neuron exists only as a place where people create — ideas, projects, connections, thoughts.',
  },
  {
    title: 'A living mind over status',
    text: 'There are no résumés, followers, or achievements here. Only how you think right now. Neuron finds you not those who are successful — but those who are compatible.',
  },
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

        <div className="manifesto">
          <ManifestoNav variant="landing" sections={MANIFEST_SECTIONS} />

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
                synapse forming · listening for the next thought
              </span>
            </div>
          </header>

          <section className="manifesto-section" id="problem">
            <p className="section-num reveal">01 — The problem</p>
            <h2 className="reveal" data-delay="1">Intellects are isolated</h2>
            <p className="reveal" data-delay="2">
              There are millions of people thinking about big questions. They sense
              that the standard paths — career, status, consumption — are not it.
              They don&apos;t need just conversation partners. They need kindred
              minds with whom they can build something new.
            </p>
            <p className="manifesto-emphasis reveal" data-delay="3">
              But the place for this does not exist.
            </p>

            <ul className="competitor-list">
              {COMPETITORS.map((c, i) => (
                <li key={c.name} className="reveal" data-delay={(i % 4) + 1}>
                  <strong>{c.name}</strong>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
            <p className="manifesto-muted reveal">
              Edge.org — a closed club. LessWrong — one topic. Clubhouse — dead.
              Are.na — creative, not scientific. Nobody got it right.
            </p>
          </section>

          <section className="manifesto-section" id="solution">
            <p className="section-num reveal">02 — The nature of the solution</p>
            <h2 className="reveal" data-delay="1">Evolution as law</h2>
            <p className="reveal" data-delay="2">
              The entire history of life can be described by one principle: union
              creates new quality. This is not a metaphor. It is a physical law —
              <em> emergence</em>.
            </p>

            <ol className="evolution-chain">
              {EVOLUTION.map((step, i) => (
                <li key={step.from} className="reveal" data-delay={(i % 4) + 1}>
                  <span className="evo-index">{String(i + 1).padStart(2, '0')}</span>
                  <span className="evo-from">{step.from}</span>
                  <span className="evo-arrow">→</span>
                  <span className="evo-to">{step.to}</span>
                </li>
              ))}
            </ol>

            <p className="reveal">
              No single neuron thinks. But billions together create consciousness —
              a phenomenon that existed in none of them individually. This is
              synesthesia at the level of mind — the highest degree of emergence.
            </p>
            <p className="reveal" data-delay="1">
              Culture partially united minds. But it is not yet synesthesia. People
              are near each other — but not merged. Each thinks in their own
              channel.
            </p>
            <p className="manifesto-emphasis reveal" data-delay="2">
              The true next step is when a physicist, a poet, and a programmer
              don&apos;t argue — but create a thought that none of them could have
              created alone.
            </p>
          </section>

          <section className="manifesto-section manifesto-highlight reveal" id="neuron">
            <p className="section-num">03 — Neuron</p>
            <h2>{t('manifest_neuron_h2')}</h2>
            <p>{t('manifest_neuron_p1')}</p>
            <p>{t('manifest_neuron_p2')}</p>

            <dl className="neuron-grid">
              <div>
                <dt>Problem</dt>
                <dd>
                  Intellects are isolated. Intelligent people think alone or drown
                  in noise.
                </dd>
              </div>
              <div>
                <dt>Solution</dt>
                <dd>
                  An environment where people connect through questions — not
                  profiles, not achievements, but living thoughts that burn inside
                  them.
                </dd>
              </div>
              <div>
                <dt>{t('manifest_mechanism_label')}</dt>
                <dd>{t('manifest_mechanism')}</dd>
              </div>
              <div>
                <dt>Value</dt>
                <dd>
                  What cannot be obtained alone. A thought that emerges only from
                  the collision of different minds.
                </dd>
              </div>
              <div>
                <dt>Incentive</dt>
                <dd>
                  You don&apos;t come for content. You come because here, finally,
                  are people who think the same way — but differently.
                </dd>
              </div>
            </dl>
          </section>

          <section className="manifesto-section" id="principles">
            <p className="section-num reveal">04 — Principles</p>
            <h2 className="reveal" data-delay="1">How Neuron works</h2>
            <ul className="principles-list">
              {PRINCIPLES.map((p, i) => (
                <li key={p.title} className="reveal" data-delay={(i % 4) + 1}>
                  <h3>{p.title}</h3>
                  <p>{p.key ? t(p.key) : p.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="manifesto-section" id="distribution">
            <p className="section-num reveal">05 — Distribution</p>
            <h2 className="reveal" data-delay="1">Why this will spread</h2>
            <p className="reveal" data-delay="2">
              Satoshi published nine pages — and the world built Bitcoin without
              him. Not because there was a good presentation. Because the idea was
              precise enough that those who read it could not help but act.
            </p>
            <p className="reveal">
              Neuron does not need advertising. It needs the voice of a founder
              speaking the truth.
            </p>
            <p className="reveal" data-delay="1">
              Intelligent people are not searching for another product. They are
              searching for a place where there are finally people who think the
              same way. When they find it — they bring others. Not because they are
              asked. Because they cannot help but share.
            </p>
            <p className="manifesto-emphasis reveal" data-delay="2">
              Ten right people matter more than a million random ones. The first ten
              create the culture. The culture attracts the next.
            </p>
          </section>

          <footer className="manifesto-footer reveal">
            <p className="manifesto-closing">{t('manifest_closing')}</p>
            <Link href="/explore" className="manifesto-cta manifesto-cta-lg">
              {t('manifest_enter')}
            </Link>
            <p className="manifesto-signoff">Neuron · for those who think differently together</p>
          </footer>
        </div>
      </div>
    </>
  );
}
