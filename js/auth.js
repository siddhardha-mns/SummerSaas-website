// ─── ROLE TOGGLE ─────────────────────────────────────
function setRole(role, el) {
  currentRole = role;
  document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');

  // Show password only for admin and jury
  const userEl = document.getElementById('login-user');
  const passField = document.getElementById('password-field');
  const userLabel = document.querySelector('#page-login .field label');
  if (role === 'admin') {
    if (userLabel) userLabel.textContent = 'Username';
    userEl.placeholder = 'admin';
    userEl.value = 'admin';
    passField.style.display = 'block';
    document.getElementById('login-pass').value = '';
  } else if (role === 'jury') {
    if (userLabel) userLabel.textContent = 'Username';
    userEl.placeholder = 'jury1';
    userEl.value = '';
    passField.style.display = 'block';
    document.getElementById('login-pass').value = '';
  } else {
    if (userLabel) userLabel.textContent = 'Email / ID';
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

  // JURY CHECK — requires password
  if (currentRole === 'jury') {
    const pass = (document.getElementById('login-pass') || {}).value || '';
    const validJuries = {
      'jury1': 'summerjury1',
      'jury2': 'summerjury2',
      'jury3': 'summerjury3'
    };
    if (validJuries[user] && validJuries[user] === pass) {
      if (typeof setupJuryPortal === 'function') setupJuryPortal(user);
      showPage('page-jury');
      showToast('Welcome, ' + user);
      return;
    } else {
      showToast('❌ Invalid Jury Credentials');
      return;
    }
  }

  // PARTICIPANT LOGIN FLOW
  let participant = participants.find(p => p.email.toLowerCase() === user.toLowerCase());

  if (participant) {
    completeParticipantLogin(participant, user);
  } else {
    // If not found locally, try fetching from Apps Script directly
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
      loginBtn.innerHTML = '<span class="spinner" style="border-color:#fff;border-top-color:transparent;width:14px;height:14px;margin-right:.5rem;vertical-align:middle;margin-top:-2px"></span>Logging in...';
      loginBtn.disabled = true;
      loginBtn.style.opacity = '0.7';
      loginBtn.style.cursor = 'not-allowed';
    }

    const restoreBtn = () => {
      if (loginBtn) {
        loginBtn.innerHTML = 'Sign In →';
        loginBtn.disabled = false;
        loginBtn.style.opacity = '1';
        loginBtn.style.cursor = 'pointer';
      }
    };

    showToast('⏳ Looking up participant...');
    const url = typeof _appsScriptUrl !== 'undefined' ? _appsScriptUrl : '';
    if (!url) {
      showToast('❌ Email not found locally and no Apps Script URL configured.');
      restoreBtn();
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
      })
      .finally(() => {
        restoreBtn();
      });
  }
}

function completeParticipantLogin(participant, user) {
  if (typeof generateParticipantIds === 'function') generateParticipantIds();
  showPage('page-participant');
  document.getElementById('p-username').textContent = user;
  renderParticipantAnnouncements();
  updateParticipantDashboard(participant);
}

function doLogout() {
  currentRole = 'participant';
  const defaultRoleTab = document.querySelector('.role-tab');
  if (defaultRoleTab) setRole('participant', defaultRoleTab);
  showPage('page-login');
}

