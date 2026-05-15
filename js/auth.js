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

  // PARTICIPANT LOGIN FLOW — email must exist in sheet data
  const participant = participants.find(p =>
    p.email.toLowerCase() === user.toLowerCase()
  );

  if (!participant) {
    showToast('❌ Email not found. Please use the email you registered with.');
    return;
  }

  generateParticipantIds();
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
