// ─── APPLICATION STATE & DATA ─────────────────────────
let currentRole = 'participant';

// Try loading from localStorage first, otherwise start empty
let announcements = JSON.parse(localStorage.getItem('hackportal_announcements')) || [];
let participants = JSON.parse(localStorage.getItem('hackportal_participants')) || [];

function saveData() {
  localStorage.setItem('hackportal_participants', JSON.stringify(participants));
}

function saveAnnouncements() {
  localStorage.setItem('hackportal_announcements', JSON.stringify(announcements));
}
