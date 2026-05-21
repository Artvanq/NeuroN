const prisma = require('./prisma');
const { slugify } = require('./projectSerialize');
function userCommunitiesEnabled() {
  if (process.env.ALLOW_USER_COMMUNITIES === 'false') return false;
  if (process.env.ALLOW_USER_COMMUNITIES === 'true') return true;
  const { isFeatureEnabled } = require('./featureFlags');
  if (isFeatureEnabled('user_communities')) return true;
  return process.env.NODE_ENV !== 'production';
}

const MAX_COMMUNITIES_PER_USER = 10;
const MAX_NAME_LEN = 80;
const MAX_DESC_LEN = 500;
const MAX_RULES_LEN = 16000;

const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'auth',
  'new',
  'explore',
  'settings',
  'login',
  'register',
  'projects',
  'orgs',
  'messages',
  'moderation',
  'owner',
  'health',
  'git',
  'search',
  'categories',
  'threads',
  'users',
  'p',
  't',
  'c',
  'u',
]);

function normalizeCategorySlug(raw) {
  const slug = slugify(raw);
  if (!slug || slug.length < 2) return '';
  if (RESERVED_SLUGS.has(slug)) return '';
  return slug.slice(0, 48);
}

function normalizeCategoryName(name) {
  return String(name || '').trim().slice(0, MAX_NAME_LEN);
}

function normalizeCategoryDescription(text) {
  return String(text || '').trim().slice(0, MAX_DESC_LEN);
}

function normalizeCategoryIcon(icon) {
  const trimmed = String(icon || '').trim();
  if (!trimmed) return '📚';
  return trimmed.slice(0, 8);
}

function normalizeCategoryColor(color) {
  const raw = String(color || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  return '#6366f1';
}

async function countUserCreatedCategories(userId) {
  return prisma.category.count({
    where: { createdById: String(userId) },
  });
}

async function createUserCategory({ userId, name, slug, description, icon, color, rules }) {
  if (!userCommunitiesEnabled()) {
    throw Object.assign(
      new Error(
        'User-created communities are disabled (set ALLOW_USER_COMMUNITIES=true or FEATURE_FLAGS=user_communities)'
      ),
      { status: 403 }
    );
  }

  const title = normalizeCategoryName(name);
  if (!title) {
    throw Object.assign(new Error('Community name is required'), { status: 400 });
  }

  const normalizedSlug = normalizeCategorySlug(slug || title);
  if (!normalizedSlug) {
    throw Object.assign(new Error('Invalid or reserved community slug'), { status: 400 });
  }

  const owned = await countUserCreatedCategories(userId);
  if (owned >= MAX_COMMUNITIES_PER_USER) {
    throw Object.assign(
      new Error(`You can create at most ${MAX_COMMUNITIES_PER_USER} communities`),
      { status: 403 }
    );
  }

  const existing = await prisma.category.findUnique({ where: { slug: normalizedSlug } });
  if (existing) {
    throw Object.assign(new Error('This community slug is already taken'), { status: 409 });
  }

  const rulesText = String(rules || '').trim().slice(0, MAX_RULES_LEN);

  const row = await prisma.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: {
        slug: normalizedSlug,
        name: title,
        description: normalizeCategoryDescription(description),
        icon: normalizeCategoryIcon(icon),
        color: normalizeCategoryColor(color),
        rules: rulesText,
        createdById: String(userId),
      },
      include: { createdBy: true },
    });

    await tx.categoryModerator.create({
      data: { categoryId: category.id, userId: String(userId) },
    });

    return category;
  });

  return row;
}

module.exports = {
  MAX_COMMUNITIES_PER_USER,
  normalizeCategorySlug,
  normalizeCategoryName,
  userCommunitiesEnabled,
  createUserCategory,
  countUserCreatedCategories,
};
