/**
 * UNIFIED HACKPORTAL APPS SCRIPT
 * 
 * Combine this code into your ONE working Google Apps Script project.
 * This script handles:
 * 1. Fetching participants (for Admin/Participant/Jury portals)
 * 2. Updating check-in status (for Admin scanner)
 * 3. Submitting jury evaluations (to a separate "Jury Evaluations" sheet)
 */

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || '').trim();
    
    // 1. Fetch Participants
    if (action === 'getParticipants') {
      return jsonResponse_(200, {
        success: true,
        participants: getParticipants_(),
      });
    }

    // 2. Update Check-in Status (Fallback to GET if POST fails due to CORS)
    if (action === 'updateStatus') {
      return handleUpdateStatus_(e.parameter);
    }

    return jsonResponse_(200, {
      success: true,
      message: 'Unified HackPortal service is running',
      actions: ['getParticipants', 'updateStatus', 'submitJuryEvaluation']
    });
  } catch (error) {
    return jsonResponse_(500, { success: false, error: error.message });
  }
}

function doPost(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || '').trim();
    
    // 3. Submit Jury Evaluation
    if (action === 'submitJuryEvaluation') {
      return handleSubmitJuryEvaluation_(e);
    }
    
    // Handle updateStatus via POST as well
    if (action === 'updateStatus') {
      return handleUpdateStatus_(e.parameter);
    }

    throw new Error('Unsupported action: ' + action);
  } catch (error) {
    return jsonResponse_(500, { success: false, error: error.message });
  }
}

// ─── HANDLERS ───────────────────────────────────────────

function handleUpdateStatus_(params) {
  const email = String(params.email || '').trim();
  const status = String(params.status || 'checkedin').trim();
  const time = String(params.time || '').trim();
  
  if (!email) throw new Error('Email is required');
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = findParticipantSheet_(ss);
  if (!sheet) throw new Error('Participant sheet not found');
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const emailIdx = headers.indexOf('email');
  if (emailIdx === -1) throw new Error('Email column not found');
  
  const statusIdx = headers.indexOf('status') !== -1 ? headers.indexOf('status') : -1;
  const timeIdx = headers.indexOf('time') !== -1 ? headers.indexOf('time') : -1;
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][emailIdx]).trim().toLowerCase() === email.toLowerCase()) {
      if (statusIdx !== -1) sheet.getRange(i + 1, statusIdx + 1).setValue(status);
      if (timeIdx !== -1) sheet.getRange(i + 1, timeIdx + 1).setValue(time);
      SpreadsheetApp.flush();
      return jsonResponse_(200, { success: true, message: 'Status updated' });
    }
  }
  
  throw new Error('Participant with email ' + email + ' not found');
}

function handleSubmitJuryEvaluation_(e) {
  const payload = parseJuryPayload_(e);
  const normalized = validateJuryPayload_(payload);
  
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet_(ss, 'Jury Evaluations');
    ensureJuryHeader_(sheet);
    
    const row = [
      new Date(),
      normalized.judgeName,
      normalized.serialNo,
      normalized.teamName,
      normalized.teamId,
      normalized.scores.problemUnderstanding,
      normalized.scores.innovationUniqueness,
      normalized.scores.realWorldImpact,
      normalized.scores.scalabilityStartupPotential,
      normalized.scores.technicalDepth,
      normalized.scores.userTractionValidation,
      normalized.scores.presentationCommunication,
      normalized.total,
    ];
    
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    
    return jsonResponse_(200, { success: true, message: 'Evaluation saved' });
  } finally {
    lock.releaseLock();
  }
}

// ─── HELPERS ────────────────────────────────────────────

function getParticipants_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = findParticipantSheet_(ss);
  if (!sheet) throw new Error('No participant sheet found');

  const values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  const headers = values[0].map(h => String(h || '').trim().toLowerCase());

  return values.slice(1)
    .filter(row => row.some(cell => String(cell || '').trim() !== ''))
    .map((row, index) => {
      const entry = rowToObject_(headers, row);
      return {
        id: firstMatch_(entry, ['id', 'reg id', 'regid', 'registration id', 'team id', 'teamid']),
        name: firstMatch_(entry, ['name', 'participant name', 'full name']) || '—',
        email: firstMatch_(entry, ['email', 'email address', 'mail']) || '—',
        phone: firstMatch_(entry, ['phone', 'mobile', 'contact']) || '—',
        college: firstMatch_(entry, ['college', 'institution', 'university']) || '—',
        team: firstMatch_(entry, ['team', 'team name', 'group']) || '—',
        track: firstMatch_(entry, ['track', 'category', 'domain']) || '—',
        role: firstMatch_(entry, ['role', 'position']) || '—',
        status: row[headers.indexOf('status')] || 'pending',
        time: row[headers.indexOf('time')] || '—',
      };
    });
}

function findParticipantSheet_(ss) {
  const names = ['Participants', 'Registrations', 'Teams', 'Sheet1'];
  for (let name of names) {
    const sheet = ss.getSheetByName(name);
    if (sheet) return sheet;
  }
  return ss.getSheets()[0];
}

function getOrCreateSheet_(ss, name) {
  const existing = ss.getSheetByName(name);
  if (existing) return existing;
  return ss.insertSheet(name);
}

function ensureJuryHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow([
    'Timestamp', 'Judge Name', 'Serial No', 'Team Name', 'Team ID',
    'Problem Understanding', 'Innovation & Uniqueness', 'Real World Impact',
    'Scalability / Startup Potentiality', 'Technical Depth', 
    'User Traction & Validation', 'Presentation & Communication', 'Total'
  ]);
}

function parseJuryPayload_(e) {
  const parameter = e.parameter || {};
  const payload = Object.assign({}, parameter);
  
  // Handle nested scores object if sent as JSON
  if (typeof payload.scores === 'string') {
    try { payload.scores = JSON.parse(payload.scores); } catch(err) { payload.scores = {}; }
  }
  
  if (!payload.scores || typeof payload.scores !== 'object') {
    payload.scores = {
      problemUnderstanding: parameter.problemUnderstanding,
      innovationAndUniqueness: parameter.innovationAndUniqueness,
      realWorldImpact: parameter.realWorldImpact,
      scalabilityStartupPotential: parameter.scalabilityStartupPotential,
      technicalDepth: parameter.technicalDepth,
      userTractionValidation: parameter.userTractionValidation,
      presentationCommunication: parameter.presentationCommunication,
    };
  }
  return payload;
}

function validateJuryPayload_(payload) {
  const req = (val, label) => {
    const n = Number(val);
    if (isNaN(n) || n < 1 || n > 10) throw new Error(label + ' must be 1-10');
    return n;
  };
  
  return {
    judgeName: payload.judgeName || 'Jury',
    serialNo: payload.serialNo || '—',
    teamName: payload.teamName || '—',
    teamId: payload.teamId || '—',
    scores: {
      problemUnderstanding: req(payload.scores.problemUnderstanding, 'Problem'),
      innovationUniqueness: req(payload.scores.innovationAndUniqueness, 'Innovation'),
      realWorldImpact: req(payload.scores.realWorldImpact, 'Impact'),
      scalabilityStartupPotential: req(payload.scores.scalabilityStartupPotential, 'Scalability'),
      technicalDepth: req(payload.scores.technicalDepth, 'Technical'),
      userTractionValidation: req(payload.scores.userTractionValidation, 'Traction'),
      presentationCommunication: req(payload.scores.presentationCommunication, 'Presentation'),
    },
    total: Number(payload.total) || 0
  };
}

function rowToObject_(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
  return obj;
}

function firstMatch_(obj, keys) {
  for (let k of keys) { if (obj[k]) return String(obj[k]); }
  return '';
}

function jsonResponse_(status, body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
