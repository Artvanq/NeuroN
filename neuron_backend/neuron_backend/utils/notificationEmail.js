const prisma = require('./prisma');
const { sendEmail, makeUrl } = require('./email');
const { allowsNotificationChannel } = require('./notificationPreferences');

const TYPE_SUBJECTS = {
  reply: 'New response to your question',
  vote: 'Someone resonated with your content',
  message: 'New dialogue message',
  message_request: 'New message request',
  message_request_accepted: 'Your dialogue request was accepted',
  message_request_declined: 'Your dialogue request was declined',
  project_pr_opened: 'New pull request in your project',
  project_pr_review: 'Pull request review update',
  project_issue_opened: 'New issue in your project',
  project_issue_comment: 'New comment on a project issue',
  project_ci_success: 'CI passed on your project',
  project_ci_failure: 'CI failed on your project',
  synthesis_update: 'Synthesis updated on a thread you contribute to',
  moderation_warning: 'Moderation warning',
};

function renderEmail({ title, body, link }) {
  const safeTitle = String(title || 'Neuron notification');
  const safeBody = String(body || '');
  const absoluteLink = makeUrl(link || '/explore');
  const text = `${safeTitle}\n\n${safeBody}\n\nOpen: ${absoluteLink}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">${safeTitle}</h2>
      <p style="margin:0 0 16px">${safeBody}</p>
      <p style="margin:0">
        <a href="${absoluteLink}">Open in Neuron</a>
      </p>
    </div>
  `;
  return { text, html };
}

async function sendNotificationEmail({ userId, type, title, body, link }) {
  if (!userId) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerifiedAt: true, notificationPreferences: true },
  });
  if (!user?.email || !user.emailVerifiedAt) return;
  if (!allowsNotificationChannel('email', type, user.notificationPreferences)) return;

  const subject = TYPE_SUBJECTS[type] || String(title || 'Neuron notification');
  const rendered = renderEmail({ title: title || subject, body, link });
  await sendEmail({
    to: user.email,
    subject,
    html: rendered.html,
    text: rendered.text,
  });
}

module.exports = {
  sendNotificationEmail,
};
