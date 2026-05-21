function diffLines(oldText, newText) {
  const oldLines = String(oldText || '').split('\n');
  const newLines = String(newText || '').split('\n');
  const rows = Math.max(oldLines.length, newLines.length);
  const lines = [];

  for (let i = 0; i < rows; i += 1) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    if (oldLine === newLine) {
      if (oldLine !== undefined) {
        lines.push({ type: 'same', oldNum: i + 1, newNum: i + 1, text: oldLine });
      }
    } else {
      if (oldLine !== undefined) {
        lines.push({ type: 'remove', oldNum: i + 1, text: oldLine });
      }
      if (newLine !== undefined) {
        lines.push({ type: 'add', newNum: i + 1, text: newLine });
      }
    }
  }

  return lines;
}

module.exports = { diffLines };
