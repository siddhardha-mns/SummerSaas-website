// ─── QR SCANNER SIMULATION ────────────────────────────
function simulateScan() {
  const sample = participants[Math.floor(Math.random() * participants.length)];
  const result = document.getElementById('checkin-result');
  document.getElementById('cr-name').textContent = sample.name + ' — ' + sample.id;
  document.getElementById('cr-detail').textContent =
    `Team: ${sample.team} | Track: ${sample.track} | Status: ${sample.status === 'checkedin' ? '⚠️ Already checked in' : '✅ Ready to check in'}`;
  result.className = 'checkin-result visible ' + (sample.status === 'checkedin' ? 'error' : 'success');
  result._participant = sample;
}

function confirmCheckin() {
  const result = document.getElementById('checkin-result');
  const p = result._participant;
  if (p) {
    p.status = 'checkedin';
    p.time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    showToast(`✅ ${p.name} checked in successfully!`);
    addActivityLog(`${p.name} checked in`);
    renderParticipantsTable();
  }
  result.className = 'checkin-result';
}

function cancelCheckin() {
  document.getElementById('checkin-result').className = 'checkin-result';
}

function addActivityLog(text) {
  const log = document.getElementById('activity-log');
  if (!log) return;
  const item = document.createElement('div');
  item.style.cssText = 'display:flex;align-items:center;gap:.75rem;padding:.5rem;background:var(--surface2);border-radius:8px;animation:fadeUp .3s ease';
  item.innerHTML = `<span>✅</span><div><div style="font-size:.85rem;font-weight:700">${text}</div><div style="font-size:.75rem;color:var(--text-muted);font-family:var(--mono)">just now</div></div>`;
  log.prepend(item);
}
