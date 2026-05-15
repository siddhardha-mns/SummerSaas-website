// ─── PARTICIPANTS TABLE RENDERING ─────────────────────
function renderParticipantsTable() {
  const tbody = document.getElementById('participants-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  participants.forEach((p, i) => {
    const badge = p.status === 'checkedin'
      ? '<span class="badge badge-green">✓ Checked In</span>'
      : '<span class="badge badge-yellow">⏳ Pending</span>';
    tbody.innerHTML += `
      <tr>
        <td style="color:var(--text-muted)">${i+1}</td>
        <td style="font-family:var(--mono);font-size:.78rem;color:var(--accent)">${p.id || '—'}</td>
        <td style="font-weight:700;font-family:var(--sans)">${p.name}</td>
        <td>${p.email}</td>
        <td>${p.phone || '—'}</td>
        <td>${p.college || '—'}</td>
        <td>${p.team}</td>
        <td>${p.track}</td>
        <td>${p.role || '—'}</td>
        <td>${badge}</td>
        <td style="color:var(--text-muted)">${p.time}</td>
      </tr>`;
  });
}
