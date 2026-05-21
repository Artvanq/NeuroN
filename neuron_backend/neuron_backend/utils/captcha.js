async function verifyCaptchaToken({ token, remoteIp, secret: providedSecret }) {
  const secret = providedSecret || process.env.CAPTCHA_SECRET;
  if (!secret) {
    return { ok: true, skipped: true };
  }

  if (!token) {
    return { ok: false, message: 'Captcha token is required' };
  }

  const verifyUrl =
    process.env.CAPTCHA_VERIFY_URL ||
    'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  const body = new URLSearchParams({
    secret,
    response: String(token),
  });
  if (remoteIp) body.set('remoteip', String(remoteIp));

  try {
    const res = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      return { ok: false, message: 'Captcha verification failed', details: data };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: 'Captcha verification unavailable' };
  }
}

module.exports = {
  verifyCaptchaToken,
};
