// ─── ANNOUNCEMENT RENDERING ───────────────────────────
function renderAnnouncements(listId) {
  const container = document.getElementById(listId);
  if (!container) return;
  container.innerHTML = '';
  [...announcements].reverse().forEach(ann => {
    const priorityBadge = ann.priority === 'urgent' ? 'badge-red' : ann.priority === 'warning' ? 'badge-yellow' : 'badge-purple';
    const priorityLabel = ann.priority === 'urgent' ? '🚨 Urgent' : ann.priority === 'warning' ? '⚠️ Warning' : 'ℹ️ Info';
    container.innerHTML += `
      <div class="ann-item">
        <div class="ann-icon">${ann.icon}</div>
        <div class="ann-body" style="flex:1">
          <div class="ann-title">${ann.title} <span class="badge ${priorityBadge} ann-priority">${priorityLabel}</span></div>
          <div class="ann-text">${ann.body}</div>
          <div class="ann-meta">📅 Today · ${ann.time}</div>
        </div>
      </div>`;
  });
}

function renderParticipantAnnouncements() { renderAnnouncements('participant-ann-list'); }
function renderAdminAnnouncements() {
  renderAnnouncements('admin-ann-list');
  const countEl = document.getElementById('admin-ann-count');
  if (countEl) countEl.textContent = announcements.length;
}

// ─── SEND ANNOUNCEMENT ───────────────────────────────
function sendAnnouncement() {
  const title = document.getElementById('ann-title-input').value.trim();
  const body = document.getElementById('ann-body-input').value.trim();
  const priority = document.getElementById('ann-priority-select').value;
  if (!title || !body) { showToast('Please fill in title and message'); return; }

  const icons = { info:'📢', warning:'⚠️', urgent:'🚨' };
  const now = new Date();
  const time = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

  announcements.push({ id: Date.now(), title, body, priority, time, icon: icons[priority] });
  saveAnnouncements();
  renderAdminAnnouncements();

  document.getElementById('ann-title-input').value = '';
  document.getElementById('ann-body-input').value = '';
  showToast('✅ Announcement broadcast to all participants!');
  document.getElementById('ann-badge').style.display = 'inline';
}
