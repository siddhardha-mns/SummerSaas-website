// ─── CSV / GOOGLE SHEETS IMPORT ───────────────────────

let _pendingCSVData = [];

// ─── CSV PARSING ──────────────────────────────────────
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse header to detect column mapping
  const header = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const colMap = {
    id:     findCol(header, ['id', 'participant_id', 'participantid', 'hack_id']),
    name:   findCol(header, ['name', 'full_name', 'fullname', 'participant']),
    email:  findCol(header, ['email', 'e-mail', 'mail', 'email_address']),
    team:   findCol(header, ['team', 'team_name', 'teamname', 'group']),
    track:  findCol(header, ['track', 'category', 'theme']),
    status: findCol(header, ['status', 'checkin', 'check_in', 'checked_in']),
    time:   findCol(header, ['time', 'checkin_time', 'check_in_time', 'timestamp']),
  };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;

    const statusRaw = (getCol(cols, colMap.status) || '').toLowerCase();
    const status = ['checkedin','checked_in','checked in','yes','true','1','done'].includes(statusRaw) ? 'checkedin' : 'pending';

    rows.push({
      id:     getCol(cols, colMap.id)    || `HACK-IMP-${String(i).padStart(4,'0')}`,
      name:   getCol(cols, colMap.name)  || `Participant ${i}`,
      email:  getCol(cols, colMap.email) || '',
      team:   getCol(cols, colMap.team)  || '—',
      track:  getCol(cols, colMap.track) || '—',
      status: status,
      time:   status === 'checkedin' ? (getCol(cols, colMap.time) || new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})) : '—',
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
  const urlInput = document.getElementById('gsheet-url-input');
  const statusEl = document.getElementById('gsheet-status');
  const rawUrl = urlInput.value.trim();

  if (!rawUrl) { showToast('⚠️ Please enter a Google Sheet URL'); return; }

  // Extract sheet ID from URL
  const match = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    setGSheetStatus('error', '❌ Invalid Google Sheets URL. Expected format: docs.google.com/spreadsheets/d/...');
    return;
  }

  const sheetId = match[1];

  // Extract gid if present, default to 0
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
      renderParticipantsTable();
      updateOverviewStats();
      setGSheetStatus('success', `✅ Imported ${parsed.length} participants with team-based IDs!`);
      showToast(`✅ ${parsed.length} participants loaded from Google Sheets`);
    })
    .catch(err => {
      setGSheetStatus('error', `❌ Failed to fetch: ${err.message}`);
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
  // Update the overview tab stat cards if they exist
  const statCards = document.querySelectorAll('#atab-overview .stat-val');
  if (statCards.length >= 3) {
    const total = participants.length;
    const checkedIn = participants.filter(p => p.status === 'checkedin').length;
    const pending = total - checkedIn;
    statCards[0].textContent = total;
    statCards[1].textContent = checkedIn;
    statCards[2].textContent = pending;
  }
}
