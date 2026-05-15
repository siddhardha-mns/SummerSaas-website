// ─── ROLE TOGGLE ─────────────────────────────────────
function setRole(role, el) {
  currentRole = role;
  document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');

  // Show password only for admin
  const userEl = document.getElementById('login-user');
  const passField = document.getElementById('password-field');
  if (role === 'admin') {
    userEl.placeholder = 'admin';
    userEl.value = 'admin';
    passField.style.display = 'block';
    document.getElementById('login-pass').value = '';
  } else {
    userEl.placeholder = 'your-registered@email.com';
    userEl.value = '';
    passField.style.display = 'none';
  }
}

// ─── LOGIN ────────────────────────────────────────────
function doLogin() {
  const user = document.getElementById('login-user').value.trim();
  if (!user) { showToast('Please enter your email or ID'); return; }

  // ADMIN CHECK — requires password
  if (currentRole === 'admin') {
    const pass = (document.getElementById('login-pass') || {}).value || '';
    if (user === 'admin' && pass === 'summer2026') {
      showPage('page-admin');
      renderAdminAnnouncements();
      renderParticipantsTable();
      showToast('Welcome, Administrator');
      if (typeof fetchViaAppsScript === 'function') fetchViaAppsScript();
      return;
    } else {
      showToast('❌ Invalid Admin Credentials');
      return;
    }
  }

  // PARTICIPANT LOGIN FLOW
  let participant = participants.find(p => p.email.toLowerCase() === user.toLowerCase());

  if (participant) {
    completeParticipantLogin(participant, user);
  } else {
    // If not found locally, try fetching from Apps Script directly
    showToast('⏳ Looking up participant...');
    const url = typeof _appsScriptUrl !== 'undefined' ? _appsScriptUrl : '';
    if (!url) {
      showToast('❌ Email not found locally and no Apps Script URL configured.');
      return;
    }
    
    const fetchUrl = url + (url.includes('?') ? '&' : '?') + 'action=getParticipants';
    fetch(fetchUrl)
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        const rows = data.participants || [];
        
        // Update local state
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
        
        if (typeof generateParticipantIds === 'function') generateParticipantIds();
        if (typeof saveData === 'function') saveData();
        
        participant = participants.find(p => p.email.toLowerCase() === user.toLowerCase());
        
        if (participant) {
          showToast('✅ Participant found!');
          completeParticipantLogin(participant, user);
        } else {
          showToast('❌ Email not found in Google Sheet. Please use the email you registered with.');
        }
      })
      .catch(err => {
        showToast('⚠️ Could not connect to Google Sheets: ' + err.message);
      });
  }
}

function completeParticipantLogin(participant, user) {
  if (typeof generateParticipantIds === 'function') generateParticipantIds();
  showPage('page-participant');
  document.getElementById('p-username').textContent = user;
  renderParticipantAnnouncements();
  updateParticipantDashboard(participant);
  updateParticipantStats();
}

function doLogout() {
  showPage('page-login');
}

// ─── UPDATE PARTICIPANT STATS ─────────────────────────
function updateParticipantStats() {
  const statVals = document.querySelectorAll('#ptab-qr .stat-val');
  if (statVals.length >= 4) {
    statVals[1].textContent = participants.length;

    // Count unique teams
    const teams = new Set(participants.map(p => p.team).filter(t => t && t !== '—'));
    statVals[2].textContent = teams.size;
  }
}
