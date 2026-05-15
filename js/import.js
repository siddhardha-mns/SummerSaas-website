// ─── CSV / GOOGLE SHEETS IMPORT ───────────────────────

let _pendingCSVData = [];
let _gsheetMode = 'apps-script'; // 'apps-script' or 'direct'
let _appsScriptUrl = 'https://script.google.com/macros/s/AKfycbxKnH7DtJItRhKOPCVOQ5hQf-SqNn3Lty1TfG4-656arls3pDJNB4PkUSb2rhizg3DJ/exec';

// ─── MODE TOGGLE ──────────────────────────────────────
function setGSheetMode(mode, el) {
  _gsheetMode = mode;
  document.getElementById('gsheet-mode-apps-script').style.display = mode === 'apps-script' ? 'block' : 'none';
  document.getElementById('gsheet-mode-direct').style.display = mode === 'direct' ? 'block' : 'none';
  document.querySelectorAll('#gsheet-mode-tabs .pill-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

// ─── CSV PARSING ──────────────────────────────────────
// Adapted for sheet columns: S.No, Reg ID, Name, Email, Phone, College, Team Name, Selected Track, Role
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse header to detect column mapping (case-insensitive)
  const header = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, ' '));
  const colMap = {
    sno:     findCol(header, ['s.no', 'sno', 's. no', '#', 'serial', 'sl.no']),
    id:      findCol(header, ['reg id', 'regid', 'reg_id', 'id', 'participant_id', 'participantid', 'hack_id', 'registration id']),
    name:    findCol(header, ['name', 'full_name', 'fullname', 'participant', 'full name']),
    email:   findCol(header, ['email', 'e-mail', 'mail', 'email_address', 'email id']),
    phone:   findCol(header, ['phone', 'phone number', 'mobile', 'contact', 'phone no', 'contact number']),
    college: findCol(header, ['college', 'institution', 'university', 'college name', 'institute']),
    team:    findCol(header, ['team name', 'team', 'team_name', 'teamname', 'group']),
    track:   findCol(header, ['selected track', 'track', 'category', 'theme', 'domain']),
    role:    findCol(header, ['role', 'position', 'member role', 'team role']),
    status:  findCol(header, ['status', 'checkin', 'check_in', 'checked_in', 'check-in']),
    time:    findCol(header, ['time', 'checkin_time', 'check_in_time', 'timestamp', 'check-in time']),
  };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;

    const name = getCol(cols, colMap.name);
    if (!name) continue; // skip empty rows

    const statusRaw = (getCol(cols, colMap.status) || '').toLowerCase();
    const status = ['checkedin','checked_in','checked in','yes','true','1','done'].includes(statusRaw) ? 'checkedin' : 'pending';

    rows.push({
      id:      getCol(cols, colMap.id) || '',
      name:    name,
      email:   getCol(cols, colMap.email) || '',
      phone:   getCol(cols, colMap.phone) || '',
      college: getCol(cols, colMap.college) || '',
      team:    getCol(cols, colMap.team) || '—',
      track:   getCol(cols, colMap.track) || '—',
      role:    getCol(cols, colMap.role) || '',
      status:  status,
      time:    status === 'checkedin' ? (getCol(cols, colMap.time) || new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})) : '—',
    });
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function findCol(header, aliases) {
  for (const alias of aliases) {
    const idx = header.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function getCol(cols, idx) {
  return idx >= 0 && idx < cols.length ? cols[idx].trim() : '';
}

// ─── CSV FILE UPLOAD HANDLER ──────────────────────────
function handleCSVUpload(file) {
  if (!file) return;
  if (!file.name.endsWith('.csv')) {
    showToast('⚠️ Please upload a .csv file');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const parsed = parseCSV(e.target.result);
    if (parsed.length === 0) {
      showToast('⚠️ No valid rows found in CSV');
      return;
    }
    _pendingCSVData = parsed;
    showCSVPreview(parsed);
    showToast(`📄 ${parsed.length} participants detected — review & confirm`);
  };
  reader.readAsText(file);
}

function showCSVPreview(data) {
  const preview = document.getElementById('csv-preview');
  const tbody = document.getElementById('csv-preview-tbody');
  const count = document.getElementById('csv-row-count');

  count.textContent = `${data.length} rows detected`;
  tbody.innerHTML = '';
  data.slice(0, 20).forEach((p, i) => {
    tbody.innerHTML += `<tr>
      <td style="color:var(--text-muted)">${i+1}</td>
      <td style="font-weight:700;font-family:var(--sans)">${p.name}</td>
      <td>${p.email}</td><td>${p.team}</td><td>${p.track}</td>
    </tr>`;
  });
  if (data.length > 20) {
    tbody.innerHTML += `<tr><td colspan="5" style="color:var(--text-muted);text-align:center;font-style:italic">… and ${data.length - 20} more rows</td></tr>`;
  }
  preview.style.display = 'block';
}

function confirmCSVImport() {
  if (_pendingCSVData.length === 0) return;
  participants = _pendingCSVData;
  _pendingCSVData = [];
  generateParticipantIds();
  saveData();
  renderParticipantsTable();
  updateOverviewStats();
  document.getElementById('csv-preview').style.display = 'none';
  document.getElementById('csv-file-input').value = '';
  showToast(`✅ Imported ${participants.length} participants with team-based IDs!`);
}

function cancelCSVImport() {
  _pendingCSVData = [];
  document.getElementById('csv-preview').style.display = 'none';
  document.getElementById('csv-file-input').value = '';
}

// ─── DRAG & DROP ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('csv-drop-zone');
  if (!zone) return;

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleCSVUpload(file);
  });
});

// ─── GOOGLE SHEETS FETCH ──────────────────────────────
function fetchGoogleSheet() {
  if (_gsheetMode === 'apps-script') {
    fetchViaAppsScript();
  } else {
    fetchViaDirectURL();
  }
}

// ─── MODE 1: Apps Script Web App ──────────────────────
function fetchViaAppsScript() {
  // Use hardcoded URL; also check input field in case user updated it
  const inputEl = document.getElementById('gsheet-apps-script-url');
  const url = (inputEl && inputEl.value.trim()) || _appsScriptUrl;

  if (!url) { showToast('⚠️ No Apps Script URL configured'); return; }

  _appsScriptUrl = url; // Keep in sync
  const fetchUrl = url + (url.includes('?') ? '&' : '?') + 'action=getParticipants';

  setGSheetStatus('loading', '<span class="spinner"></span> Fetching from Google Sheets…');

  fetch(fetchUrl)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (data.error) throw new Error(data.error);

      const rows = data.participants || [];
      if (rows.length === 0) {
        setGSheetStatus('error', '⚠️ No participants found in sheet.');
        return;
      }

      participants = rows.map(r => ({
        id:      r.id || r.regId || '',
        name:    r.name || '',
        email:   r.email || '',
        phone:   r.phone || '',
        college: r.college || '',
        team:    r.team || r.teamName || '—',
        track:   r.track || r.selectedTrack || '—',
        role:    r.role || '',
        status:  r.status || 'pending',
        time:    r.time || '—',
      }));

      generateParticipantIds();
      saveData();
      renderParticipantsTable();
      updateOverviewStats();
      setGSheetStatus('success', `✅ Synced ${participants.length} participants from Google Sheets!`);
      showToast(`✅ ${participants.length} participants loaded`);
    })
    .catch(err => {
      setGSheetStatus('error', `❌ Failed: ${err.message}`);
      showToast(`⚠️ Sheet sync failed: ${err.message}`);
    });
}

// ─── MODE 2: Direct Sheet URL (CSV export) ────────────
function fetchViaDirectURL() {
  const urlInput = document.getElementById('gsheet-url-input');
  const rawUrl = urlInput.value.trim();

  if (!rawUrl) { showToast('⚠️ Please enter a Google Sheet URL'); return; }

  const match = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    setGSheetStatus('error', '❌ Invalid Google Sheets URL. Expected: docs.google.com/spreadsheets/d/...');
    return;
  }

  const sheetId = match[1];
  const gidMatch = rawUrl.match(/gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  setGSheetStatus('loading', '<span class="spinner"></span> Fetching data from Google Sheets…');

  fetch(csvUrl)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status} — Make sure the sheet is shared publicly`);
      return res.text();
    })
    .then(csvText => {
      const parsed = parseCSV(csvText);
      if (parsed.length === 0) {
        setGSheetStatus('error', '⚠️ No valid rows found. Check that the sheet has the expected columns.');
        return;
      }
      participants = parsed;
      generateParticipantIds();
      saveData();
      renderParticipantsTable();
      updateOverviewStats();
      setGSheetStatus('success', `✅ Imported ${parsed.length} participants with team-based IDs!`);
      showToast(`✅ ${parsed.length} participants loaded from Google Sheets`);
    })
    .catch(err => {
      setGSheetStatus('error', `❌ Failed to fetch: ${err.message}`);
    });
}

// ─── SYNC CHECK-IN BACK TO SHEET ──────────────────────
function syncCheckinToSheet(email, status, time) {
  if (!_appsScriptUrl) return; // No Apps Script URL configured

  const url = _appsScriptUrl +
    `?action=updateStatus&email=${encodeURIComponent(email)}` +
    `&status=${encodeURIComponent(status || 'checkedin')}` +
    `&time=${encodeURIComponent(time || '')}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        console.log(`✅ Synced check-in for ${email} to Google Sheet`);
      }
    })
    .catch(() => {
      // Silent fail — sheet sync is best-effort
      console.warn(`⚠️ Could not sync check-in for ${email}`);
    });
}

function setGSheetStatus(type, html) {
  const el = document.getElementById('gsheet-status');
  el.style.display = 'block';
  el.className = `gsheet-${type}`;
  el.style.padding = '.75rem 1rem';
  el.style.borderRadius = '8px';
  el.style.fontSize = '.85rem';
  el.innerHTML = html;
}

// ─── UPDATE OVERVIEW STATS ────────────────────────────
function updateOverviewStats() {
  const statCards = document.querySelectorAll('#atab-overview .stat-val');
  if (statCards.length >= 3) {
    const total = participants.length;
    const checkedIn = participants.filter(p => p.status === 'checkedin').length;
    const pending = total - checkedIn;
    statCards[0].textContent = total;
    statCards[1].textContent = checkedIn;
    statCards[2].textContent = pending;

    // Update Teams count
    const teams = new Set(participants.map(p => p.team).filter(t => t && t !== '—'));
    const teamsEl = document.getElementById('admin-teams-count');
    if (teamsEl) teamsEl.textContent = teams.size;

    // Update progress bar
    const progressText = document.querySelector('#atab-overview .card > div > div > span:last-child');
    const progressBar = document.querySelector('#atab-overview .card > div > div:nth-child(2) > div');
    const pct = total === 0 ? 0 : Math.round((checkedIn / total) * 100);
    if (progressText) {
      progressText.textContent = `${pct}%`;
      progressText.previousElementSibling.textContent = `${checkedIn} / ${total} checked in`;
    }
    if (progressBar) progressBar.style.width = `${pct}%`;

    // Update track stats
    const tracks = {};
    participants.forEach(p => {
      const tr = p.track || 'Unassigned';
      if (!tracks[tr]) tracks[tr] = 0;
      if (p.status === 'checkedin') tracks[tr]++;
    });

    const trackContainer = document.getElementById('track-stats-container');
    if (trackContainer) {
      trackContainer.innerHTML = '';
      Object.entries(tracks).forEach(([track, count]) => {
        trackContainer.innerHTML += `
          <div style="display:flex;justify-content:space-between;font-size:.85rem;padding:.5rem;background:var(--surface2);border-radius:8px">
            <span>🎯 ${track}</span><span style="font-weight:700">${count} checked in</span>
          </div>`;
      });
    }
  }
}
