const prisma = require('./prisma');

/**
 * Starter Inquiries — cross-field questions that connect Fields.
 * Threads can carry multiple Inquiry tags; clicking one shows threads
 * from any Field that touch the same question.
 */
const DEFAULT_INQUIRIES = [
  { slug: 'nature-of-time', name: 'Nature of time', description: 'Is time fundamental or emergent?' },
  { slug: 'free-will', name: 'Free will', description: 'Agency, determinism, and choice.' },
  { slug: 'consciousness', name: 'Consciousness', description: 'What it is like, and why.' },
  { slug: 'emergence', name: 'Emergence', description: 'When the whole exceeds the parts.' },
  { slug: 'scaling-laws', name: 'Scaling laws', description: 'How behavior changes with size.' },
  { slug: 'causation', name: 'Causation', description: 'What it means for A to cause B.' },
  { slug: 'language-and-thought', name: 'Language and thought', description: 'Does language shape what we can think?' },
  { slug: 'intelligence', name: 'Intelligence', description: 'Across minds, machines, and species.' },
  { slug: 'altruism', name: 'Altruism', description: 'Cooperation, sacrifice, and kin.' },
  { slug: 'information', name: 'Information', description: 'Bits as physics, biology, and mind.' },
  { slug: 'entropy', name: 'Entropy', description: 'Order, disorder, and time’s arrow.' },
  { slug: 'beauty', name: 'Beauty', description: 'Why some forms move us.' },
  { slug: 'moral-progress', name: 'Moral progress', description: 'Do values get better, or just change?' },
  { slug: 'collapse', name: 'Collapse', description: 'How systems fail, ecologies to empires.' },
  { slug: 'alignment', name: 'Alignment', description: 'Goals, values, and powerful systems.' },
  { slug: 'truth', name: 'Truth', description: 'Knowing, verifying, and bullshit.' },
  { slug: 'identity', name: 'Identity', description: 'Persistence of self across change.' },
  { slug: 'memory', name: 'Memory', description: 'Storage, recall, and forgetting.' },
  { slug: 'evolution', name: 'Evolution', description: 'Variation, selection, and constraints.' },
  { slug: 'computation', name: 'Computation', description: 'What can be computed, and at what cost.' },
  { slug: 'creativity', name: 'Creativity', description: 'Where new ideas come from.' },
  { slug: 'attention', name: 'Attention', description: 'What it picks, what it costs.' },
  { slug: 'networks', name: 'Networks', description: 'Topology of connection.' },
  { slug: 'coordination', name: 'Coordination', description: 'Agents acting together without a boss.' },
  { slug: 'power', name: 'Power', description: 'Who decides, and through what.' },
  { slug: 'symbol', name: 'Symbol', description: 'Signs, meaning, and reference.' },
  { slug: 'measurement', name: 'Measurement', description: 'What counts as a number here.' },
  { slug: 'risk', name: 'Risk', description: 'Uncertainty, tails, and decision under it.' },
  { slug: 'death', name: 'Death', description: 'Endings, biological and cultural.' },
  { slug: 'origin', name: 'Origin', description: 'Where things begin: life, math, universe.' },
];

async function seedInquiries() {
  const existing = await prisma.inquiry.findMany({
    where: { slug: { in: DEFAULT_INQUIRIES.map((i) => i.slug) } },
    select: { slug: true },
  });
  const have = new Set(existing.map((r) => r.slug));
  const missing = DEFAULT_INQUIRIES.filter((i) => !have.has(i.slug));
  if (missing.length === 0) return;

  await prisma.inquiry.createMany({
    data: missing.map((i) => ({ ...i, isSeed: true })),
    skipDuplicates: true,
  });
  console.log(`Inquiries seeded (${missing.length} new)`);
}

module.exports = seedInquiries;
module.exports.DEFAULT_INQUIRIES = DEFAULT_INQUIRIES;
