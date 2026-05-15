let currentJuryUser = '';
let currentEvaluatingTeam = null;
let juryTeams = [];
let juryTeamsLoaded = false;
let juryFetchInFlight = null;
let juryLastQuery = '';
let jurySubmitInFlight = false;

const JURY_FETCH_API_URL = 'https://script.google.com/macros/s/AKfycbyJ62yFlR4DVKC1266QJYI4ta_hp0niv_yoMTAckkpGZucyW-CU2d_Cdfe11W3bQ6OP/exec';
const JURY_SUBMIT_API_URL = 'https://script.google.com/macros/s/AKfycbxKnH7DtJItRhKOPCVOQ5hQf-SqNn3Lty1TfG4-656arls3pDJNB4PkUSb2rhizg3DJ/exec';

const JURY_SCORE_FIELDS = [
  { id: 'score-problemUnderstanding', key: 'problemUnderstanding' },
  { id: 'score-innovation', key: 'innovationAndUniqueness' },
  { id: 'score-impact', key: 'realWorldImpact' },
  { id: 'score-scalability', key: 'scalabilityStartupPotential' },
  { id: 'score-technicalDepth', key: 'technicalDepth' },
  { id: 'score-traction', key: 'userTractionValidation' },
  { id: 'score-presentation', key: 'presentationCommunication' },
];

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstDefined(row, keys) {
  for (const key of keys) {
    if (row && row[key] != null && String(row[key]).trim() !== '') return String(row[key]).trim();
  }
  return '';
}

function normalizeJuryMember(row, index) {
  const teamName = firstDefined(row, ['teamName', 'team', 'team_name', 'groupName', 'group', 'teamname']) || '—';
  const teamId = firstDefined(row, ['teamId', 'team_id', 'teamID', 'team_code', 'teamCode', 'teamNumber', 'teamNo', 'regId', 'id']);
  const serialNo = firstDefined(row, ['serialNo', 'serial', 'sno', 'slNo', 'slno', 'sNo', 's.no', 'SNo']);

  return {
    raw: row || {},
    order: index,
    teamName,
    teamId: teamId || '',
    serialNo: serialNo || '',
    name: firstDefined(row, ['name', 'memberName', 'fullName', 'participantName', 'participant_name']) || '—',
    email: firstDefined(row, ['email', 'mail', 'emailAddress', 'email_address']) || '—',
    phone: firstDefined(row, ['phone', 'mobile', 'contact', 'phoneNumber', 'phone_number']) || '—',
    college: firstDefined(row, ['college', 'institution', 'university', 'collegeName', 'college_name']) || '—',
    role: firstDefined(row, ['role', 'memberRole', 'member_role']) || '—',
    track: firstDefined(row, ['track', 'selectedTrack', 'selected_track', 'category', 'domain']) || '—',
    status: firstDefined(row, ['status', 'checkinStatus', 'check_in_status']) || 'pending',
    time: firstDefined(row, ['time', 'timestamp', 'registeredAt', 'registrationTime']) || '—',
  };
}

function normalizeTeamId(team) {
  return team.teamId || team.teamName || '—';
}

function buildJuryTeams(rows) {
  const teamMap = new Map();

  rows.forEach((row, index) => {
    const member = normalizeJuryMember(row, index);
    if (!member.teamName || member.teamName === '—') return;

    const key = member.teamId ? `id:${member.teamId}` : `name:${member.teamName.toLowerCase()}`;
    if (!teamMap.has(key)) {
      teamMap.set(key, {
        key,
        teamName: member.teamName,
        teamId: member.teamId || member.teamName,
        serialNo: member.serialNo || String(teamMap.size + 1),
        members: [],
        firstOrder: index,
      });
    }

    const team = teamMap.get(key);
    if (!team.serialNo && member.serialNo) team.serialNo = member.serialNo;
    if (!team.teamId && member.teamId) team.teamId = member.teamId;
    team.members.push(member);
  });

  return Array.from(teamMap.values())
    .sort((a, b) => a.firstOrder - b.firstOrder)
    .map((team, index) => ({
      ...team,
      displaySerial: team.serialNo || String(index + 1),
      displayTeamId: normalizeTeamId(team),
    }));
}

function buildJuryTeamsFromResponse(data) {
  const rows = Array.isArray(data && data.participants) ? data.participants : [];

  console.log('[jury] participants array', rows);
  const groupedTeams = buildJuryTeams(rows);
  console.log('[jury] grouped teams', groupedTeams);
  return groupedTeams;
}

function buildJuryTeamsFromLocalParticipants() {
  return buildJuryTeams(Array.isArray(participants) ? participants : []);
}

function loadJuryTeams(force = false) {
  if (juryFetchInFlight && !force) return juryFetchInFlight;

  const fetchUrl = JURY_FETCH_API_URL + '?action=getParticipants';
  juryFetchInFlight = fetch(fetchUrl)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      console.log('[jury] API response', data);
      if (data && data.error) throw new Error(data.error);
      juryTeams = buildJuryTeamsFromResponse(data);
      juryTeamsLoaded = true;
      renderJuryTeamList(juryLastQuery);
      return juryTeams;
    })
    .catch(error => {
      juryTeams = buildJuryTeamsFromLocalParticipants();
      juryTeamsLoaded = true;
      renderJuryTeamList(juryLastQuery);
      showToast(`⚠️ Jury data sync failed: ${error.message}`);
      return juryTeams;
    })
    .finally(() => {
      juryFetchInFlight = null;
    });

  return juryFetchInFlight;
}

function setupJuryPortal(username) {
  currentJuryUser = username || '';
  currentEvaluatingTeam = null;
  juryLastQuery = '';
  jurySubmitInFlight = false;

  const usernameEl = document.getElementById('j-username');
  if (usernameEl) usernameEl.textContent = username || 'jury';

  const searchInput = document.getElementById('jury-search-input');
  if (searchInput) searchInput.value = '';

  const navEval = document.getElementById('nav-eval-tab');
  if (navEval) navEval.style.display = 'none';

  setupEvaluationListeners();
  switchJuryTab('search');
  renderJuryTeamList('');
  loadJuryTeams(true);
}

function renderJuryTeamList(query) {
  const listEl = document.getElementById('jury-team-results');
  if (!listEl) return;

  juryLastQuery = query || '';
  const normalizedQuery = juryLastQuery.trim().toLowerCase();

  if (!juryTeamsLoaded && (!juryTeams || juryTeams.length === 0)) {
    listEl.innerHTML = '<div class="jury-loading"><span class="spinner"></span> Loading team data...</div>';
    return;
  }

  const filteredTeams = (juryTeams || []).filter(team => team.teamName.toLowerCase().includes(normalizedQuery));
  console.log('[jury] search matches', {
    query: juryLastQuery,
    matches: filteredTeams.map(team => ({
      teamName: team.teamName,
      teamId: team.displayTeamId,
      serialNo: team.displaySerial,
    })),
  });

  if (filteredTeams.length === 0) {
    const message = normalizedQuery
      ? `No teams found for “${escapeHtml(juryLastQuery)}”`
      : 'No team data available yet.';
    listEl.innerHTML = `<div class="jury-empty">${message}</div>`;
    return;
  }

  listEl.innerHTML = '';
  filteredTeams.forEach((team, index) => {
    const card = document.createElement('div');
    card.className = 'jury-team-card';
    card.setAttribute('role', 'button');
    card.tabIndex = 0;

    card.innerHTML = `
      <div class="jury-team-head">
        <div>
          <div class="jury-team-meta">Serial No. #${escapeHtml(team.displaySerial)}</div>
          <div class="jury-team-name">${escapeHtml(team.teamName)}</div>
        </div>
        <div class="jury-team-count">${team.members.length} member${team.members.length === 1 ? '' : 's'}</div>
      </div>
      <div class="jury-team-meta">Team ID: ${escapeHtml(team.displayTeamId)}</div>
    `;

    const openTeam = () => openTeamEvaluation(team, index + 1);
    card.addEventListener('click', openTeam);
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openTeam();
      }
    });

    listEl.appendChild(card);
  });
}

function handleJurySearch(e) {
  renderJuryTeamList(e.target.value);
}

function openTeamEvaluation(team, serialNo) {
  currentEvaluatingTeam = {
    ...team,
    serialNo: team.displaySerial || serialNo,
  };

  const navEval = document.getElementById('nav-eval-tab');
  if (navEval) navEval.style.display = 'inline-flex';

  switchJuryTab('evaluate');
  renderJuryEvaluation(team);
  resetJuryScores();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderJuryEvaluation(team) {
  const teamNameEl = document.getElementById('jeval-team-name');
  const serialEl = document.getElementById('jeval-serial');
  const teamIdEl = document.getElementById('jeval-team-id');
  const membersEl = document.getElementById('jeval-members');

  if (teamNameEl) teamNameEl.textContent = team.teamName || 'Team Name';
  if (serialEl) serialEl.textContent = `#${team.displaySerial || team.serialNo || '—'}`;
  if (teamIdEl) teamIdEl.textContent = team.displayTeamId || team.teamId || '—';

  if (!membersEl) return;

  const firstMember = team.members[0] || {};
  const summaryItems = [
    ['Serial Number', `#${team.displaySerial || team.serialNo || '—'}`],
    ['Team Name', team.teamName || '—'],
    ['Team ID', team.displayTeamId || team.teamId || '—'],
    ['Track', firstMember.track || '—'],
  ];

  membersEl.className = 'jury-summary-grid compact';
  membersEl.innerHTML = `
    ${summaryItems.map(([label, value]) => `
      <div class="jury-summary-item">
        <span class="jury-summary-label">${escapeHtml(label)}</span>
        <span class="jury-summary-value">${escapeHtml(value)}</span>
      </div>
    `).join('')}
  `;
}

function setupEvaluationListeners() {
  JURY_SCORE_FIELDS.forEach(field => {
    const container = document.getElementById(field.id + '-buttons');
    if (!container || container.dataset.juryBound === '1') return;

    container.dataset.juryBound = '1';
    container.innerHTML = '';

    for (let value = 1; value <= 10; value++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'jury-rating-btn';
      button.textContent = String(value);
      button.dataset.value = String(value);
      button.addEventListener('click', () => selectJuryRating(field.id, value));
      container.appendChild(button);
    }
  });
}

function selectJuryRating(scoreId, value) {
  const container = document.getElementById(scoreId + '-buttons');
  if (!container) return;

  container.dataset.selected = String(value);
  container.querySelectorAll('.jury-rating-btn').forEach(button => {
    button.classList.toggle('selected', Number(button.dataset.value) === Number(value));
  });

  calculateJuryTotal();
}

function calculateJuryTotal() {
  const values = JURY_SCORE_FIELDS
    .map(field => document.getElementById(field.id + '-buttons'))
    .map(container => Number(container && container.dataset.selected))
    .filter(value => Number.isFinite(value));

  const totalEl = document.getElementById('jury-total-score');
  const total = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

  if (totalEl) totalEl.textContent = total.toFixed(2);
  return total;
}

function resetJuryScores() {
  JURY_SCORE_FIELDS.forEach(field => {
    const container = document.getElementById(field.id + '-buttons');
    if (!container) return;
    container.dataset.selected = '';
    container.querySelectorAll('.jury-rating-btn').forEach(button => button.classList.remove('selected'));
  });
  const totalEl = document.getElementById('jury-total-score');
  if (totalEl) totalEl.textContent = '0.00';
}

function validateJuryScores() {
  const scores = {};
  for (const field of JURY_SCORE_FIELDS) {
    const container = document.getElementById(field.id + '-buttons');
    const value = Number(container && container.dataset.selected);
    if (!Number.isFinite(value) || value < 1 || value > 10) {
      return { valid: false, scores: null };
    }
    scores[field.key] = value;
  }
  return { valid: true, scores };
}

async function submitJuryEvaluation() {
  if (!currentEvaluatingTeam || jurySubmitInFlight) return;

  const validation = validateJuryScores();
  if (!validation.valid) {
    showToast('❌ Please fill all 7 categories with numbers between 1 and 10.');
    return;
  }

  const total = calculateJuryTotal();
  const scores = {
    problemUnderstanding: Number(validation.scores.problemUnderstanding),
    innovationAndUniqueness: Number(validation.scores.innovationAndUniqueness),
    realWorldImpact: Number(validation.scores.realWorldImpact),
    scalabilityStartupPotential: Number(validation.scores.scalabilityStartupPotential),
    technicalDepth: Number(validation.scores.technicalDepth),
    userTractionValidation: Number(validation.scores.userTractionValidation),
    presentationCommunication: Number(validation.scores.presentationCommunication),
  };
  const totalScore = Number(total.toFixed(2));

  const payload = {
    judgeName: currentJuryUser,
    serialNo: currentEvaluatingTeam.serialNo,
    teamName: currentEvaluatingTeam.teamName,
    teamId: currentEvaluatingTeam.displayTeamId || currentEvaluatingTeam.teamId || '',
    scores: {
      problemUnderstanding: Number(scores.problemUnderstanding),
      innovationAndUniqueness: Number(scores.innovationAndUniqueness),
      realWorldImpact: Number(scores.realWorldImpact),
      scalabilityStartupPotential: Number(scores.scalabilityStartupPotential),
      technicalDepth: Number(scores.technicalDepth),
      userTractionValidation: Number(scores.userTractionValidation),
      presentationCommunication: Number(scores.presentationCommunication),
    },
    total: Number(totalScore),
  };

  jurySubmitInFlight = true;
  showToast('⏳ Submitting evaluation...');

  try {
    const endpoint = 'https://script.google.com/macros/s/AKfycbxKnH7DtJItRhKOPCVOQ5hQf-SqNn3Lty1TfG4-656arls3pDJNB4PkUSb2rhizg3DJ/exec?action=submitJuryEvaluation';
    console.log('FINAL PAYLOAD', JSON.stringify(payload, null, 2));
    await submitJuryEvaluationViaForm(endpoint, payload);

    console.log('[jury] evaluation submitted successfully', { success: true, message: 'Evaluation saved' });
    showToast(`✅ Evaluation submitted for ${currentEvaluatingTeam.teamName}`);
    closeEvaluation(true);
  } catch (error) {
    console.error('[jury] evaluation submission failed', error);
    showToast(`⚠️ Error submitting: ${error.message}`);
  } finally {
    jurySubmitInFlight = false;
  }
}

function submitJuryEvaluationViaForm(endpoint, payload) {
  return new Promise(function(resolve, reject) {
    const iframeName = 'jury-submit-target-' + Date.now();
    const iframe = document.createElement('iframe');
    iframe.name = iframeName;
    iframe.style.display = 'none';

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = endpoint;
    form.target = iframeName;
    form.style.display = 'none';

    const fields = {
      judgeName: payload.judgeName,
      serialNo: payload.serialNo,
      teamName: payload.teamName,
      teamId: payload.teamId,
      problemUnderstanding: payload.scores.problemUnderstanding,
      innovationAndUniqueness: payload.scores.innovationAndUniqueness,
      realWorldImpact: payload.scores.realWorldImpact,
      scalabilityStartupPotential: payload.scores.scalabilityStartupPotential,
      technicalDepth: payload.scores.technicalDepth,
      userTractionValidation: payload.scores.userTractionValidation,
      presentationCommunication: payload.scores.presentationCommunication,
      total: payload.total,
    };

    Object.keys(fields).forEach(function(key) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = String(fields[key]);
      form.appendChild(input);
    });

    let loadCount = 0;
    const cleanup = function() {
      if (form.parentNode) form.parentNode.removeChild(form);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    iframe.addEventListener('load', function() {
      loadCount += 1;
      if (loadCount < 2) return;
      cleanup();
      resolve();
    });

    form.addEventListener('error', function() {
      cleanup();
      reject(new Error('Submission failed'));
    });

    document.body.appendChild(iframe);
    document.body.appendChild(form);

    setTimeout(function() {
      try {
        form.submit();
      } catch (submitError) {
        cleanup();
        reject(submitError);
      }
    }, 0);
  });
}

function closeEvaluation(resetSearch) {
  currentEvaluatingTeam = null;
  const navEval = document.getElementById('nav-eval-tab');
  if (navEval) navEval.style.display = 'none';

  const searchInput = document.getElementById('jury-search-input');
  if (resetSearch && searchInput) searchInput.value = '';

  switchJuryTab('search');
  if (resetSearch) {
    juryLastQuery = '';
    renderJuryTeamList('');
  } else {
    renderJuryTeamList(searchInput ? searchInput.value : juryLastQuery);
  }
}
