// ─── PAGE SWITCHING ────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ─── PARTICIPANT TAB SWITCHING ─────────────────────────
function switchParticipantTab(tab, el) {
  ['qr','announcements','schedule'].forEach(t => {
    document.getElementById('ptab-'+t).style.display = 'none';
  });
  document.getElementById('ptab-'+tab).style.display = 'flex';
  document.getElementById('ptab-'+tab).style.flexDirection = 'column';
  document.querySelectorAll('#page-participant .nav-link').forEach(l => l.classList.remove('active'));
  el.classList.add('active');
  if (tab === 'announcements') document.getElementById('ann-badge').style.display = 'none';
}

// ─── ADMIN TAB SWITCHING ──────────────────────────────
function switchAdminTab(tab, el) {
  ['overview','scanner','announce','participants','exports'].forEach(t => {
    document.getElementById('atab-'+t).style.display = 'none';
  });
  document.getElementById('atab-'+tab).style.display = 'flex';
  document.getElementById('atab-'+tab).style.flexDirection = 'column';
  document.querySelectorAll('#page-admin .nav-link').forEach(l => l.classList.remove('active'));
  el.classList.add('active');
}
