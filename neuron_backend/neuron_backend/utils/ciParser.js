function parseCiConfig(content) {
  const text = String(content || '');
  const triggers = new Set();
  const steps = [];
  let inSteps = false;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (/^on\s*:/.test(trimmed)) {
      const rest = trimmed.replace(/^on\s*:\s*/, '');
      if (rest.startsWith('[')) {
        rest
          .replace(/[\[\]]/g, '')
          .split(',')
          .forEach((t) => {
            const v = t.trim().replace(/['"]/g, '');
            if (v) triggers.add(v);
          });
      } else {
        const v = rest.replace(/['"]/g, '').trim();
        if (v) triggers.add(v);
      }
      continue;
    }

    if (/^steps\s*:/.test(trimmed) || /^jobs\s*:/.test(trimmed)) {
      inSteps = true;
      continue;
    }

    if (inSteps && /^-\s*run\s*:/.test(trimmed)) {
      const cmd = trimmed.replace(/^-\s*run\s*:\s*/, '').replace(/^['"]|['"]$/g, '');
      if (cmd) steps.push(cmd);
    }
  }

  if (triggers.size === 0) {
    triggers.add('push');
  }

  return {
    name: 'CI',
    triggers: [...triggers],
    steps: steps.length > 0 ? steps : ['echo "No steps defined in .neuron/ci.yml"'],
  };
}

module.exports = { parseCiConfig };
