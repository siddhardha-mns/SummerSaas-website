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
    // Sync back to Google Sheet if Apps Script is connected
    if (typeof syncCheckinToSheet === 'function') {
      syncCheckinToSheet(p.email, 'checkedin', p.time);
    }
    saveData();
    addRecentCheckin(p);
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

function manualLookup() {
  const inputEl = document.getElementById('manual-lookup-input');
  if (!inputEl) return;
  const val = inputEl.value.trim().toLowerCase();
  if (!val) return;

  const found = participants.find(p => p.id.toLowerCase() === val || p.email.toLowerCase() === val);
  if (found) {
    const result = document.getElementById('checkin-result');
    document.getElementById('cr-name').textContent = found.name + ' — ' + found.id;
    document.getElementById('cr-detail').textContent =
      `Team: ${found.team} | Track: ${found.track} | Status: ${found.status === 'checkedin' ? '⚠️ Already checked in' : '✅ Ready to check in'}`;
    result.className = 'checkin-result visible ' + (found.status === 'checkedin' ? 'error' : 'success');
    result._participant = found;
  } else {
    showToast('❌ Participant not found');
  }
  inputEl.value = ''; // clear input for next scan
}

function addRecentCheckin(p) {
  const container = document.getElementById('recent-checkins');
  if (!container) return;

  // Remove "No recent check-ins" text if present
  if (container.innerHTML.includes('No recent check-ins')) {
    container.innerHTML = '';
  }

  const el = document.createElement('div');
  el.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:.6rem .8rem;background:var(--surface2);border-radius:8px;animation:fadeUp .3s ease';
  el.innerHTML = `
    <div><div style="font-size:.85rem;font-weight:700">${p.name}</div><div style="font-size:.72rem;color:var(--text-muted);font-family:var(--mono)">${p.id}</div></div>
    <span class="badge badge-green">✓ In</span>
  `;
  container.prepend(el);
}
