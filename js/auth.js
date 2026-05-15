// ─── ROLE TOGGLE ─────────────────────────────────────
function setRole(role, el) {
  currentRole = role;
  document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

// ─── LOGIN ────────────────────────────────────────────
function doLogin() {
  const user = document.getElementById('login-user').value;
  if (!user) { showToast('Please enter your email'); return; }

  // Ensure all participants have team-based IDs
  generateParticipantIds();

  showPage(currentRole === 'admin' ? 'page-admin' : 'page-participant');

  if (currentRole === 'participant') {
    document.getElementById('p-username').textContent = user;
    renderParticipantAnnouncements();

    // Find the participant by email and render their unique QR
    const participant = participants.find(p =>
      p.email.toLowerCase() === user.toLowerCase() ||
      p.name.toLowerCase() === user.toLowerCase()
    );

    if (participant) {
      updateParticipantDashboard(participant);
    } else {
      // Create a guest entry if not found
      const guest = {
        id: '',
        name: user.split('@')[0],
        email: user,
        team: 'Unassigned',
        track: '—',
        status: 'pending',
        time: '—'
      };
      participants.push(guest);
      generateParticipantIds();
      // Re-find to get the generated ID
      const guestWithId = participants.find(p => p.email === user);
      updateParticipantDashboard(guestWithId || guest);
    }

    // Update participant stats
    updateParticipantStats();
  } else {
    renderAdminAnnouncements();
    renderParticipantsTable();
  }
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
