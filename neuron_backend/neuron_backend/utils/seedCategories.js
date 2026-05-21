const categoryService = require('../services/categories');

/**
 * Default Fields (broad containers). Threads live in exactly one Field;
 * cross-cutting questions are modeled as `Inquiry` tags (see seedInquiries.js).
 *
 * Philosophy: a Field is a "lens / entry point", not a university department.
 * Sub-disciplines (Astronomy, Chemistry, CogSci, Linguistics, ...) belong
 * under broader Fields, then split by Inquiry tags in the feed.
 */
const DEFAULT_CATEGORIES = [
  {
    slug: 'mind',
    name: 'Mind & Behavior',
    description: 'Psychology, cognitive science, neuroscience — how thought, feeling, and behavior arise.',
    icon: '◈',
    color: '#f472b6',
  },
  {
    slug: 'matter',
    name: 'Matter & Cosmos',
    description: 'Physics, astronomy, chemistry — the structure and dynamics of the physical world.',
    icon: '⚛',
    color: '#38bdf8',
  },
  {
    slug: 'life',
    name: 'Life & Biology',
    description: 'Biology, ecology, evolution — the architecture and history of living systems.',
    icon: '✿',
    color: '#34d399',
  },
  {
    slug: 'math',
    name: 'Math & Logic',
    description: 'Mathematics, logic, foundations — pattern, proof, and the language of structure.',
    icon: '∑',
    color: '#fbbf24',
  },
  {
    slug: 'computing',
    name: 'Computing & AI',
    description: 'Computer science, software, machine learning — computation as a way of thinking.',
    icon: '◐',
    color: '#22d3ee',
  },
  {
    slug: 'systems',
    name: 'Systems & Economics',
    description: 'Complex systems, economics, networks — feedback, emergence, and coordination at scale.',
    icon: '◉',
    color: '#fb7185',
  },
  {
    slug: 'language',
    name: 'Language & Meaning',
    description: 'Linguistics, semiotics, philosophy of language — language as a system of mind.',
    icon: '⌬',
    color: '#a78bfa',
  },
  {
    slug: 'history',
    name: 'History & Civilization',
    description: 'The evolution of ideas, institutions, and societies across time.',
    icon: '◇',
    color: '#fcd34d',
  },
  {
    slug: 'philosophy',
    name: 'Philosophy & Ethics',
    description: 'Metaphysics, epistemology, ethics — questions that outlive their answers.',
    icon: '◆',
    color: '#c084fc',
  },
  {
    slug: 'art',
    name: 'Art & Aesthetics',
    description: 'Art, aesthetics, design — thinking in images, form, and felt experience.',
    icon: '✦',
    color: '#fb923c',
  },
];

async function seedCategories() {
  const existingSlugs = await categoryService.listExistingSlugs();
  const missing = DEFAULT_CATEGORIES.filter((c) => !existingSlugs.has(c.slug));
  if (missing.length === 0) return;
  await categoryService.insertCategories(missing);
  console.log(`Categories seeded (${missing.length} new): ${missing.map((c) => c.slug).join(', ')}`);
}

module.exports = seedCategories;
module.exports.DEFAULT_CATEGORIES = DEFAULT_CATEGORIES;
