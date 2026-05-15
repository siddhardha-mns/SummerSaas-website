function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || '').trim();
    if (action === 'getParticipants') {
      return jsonResponse_(200, {
        success: true,
        participants: getParticipants_(),
      });
    }

    return jsonResponse_(200, {
      success: true,
      message: 'Jury evaluations service is running',
    });
  } catch (error) {
    return jsonResponse_(500, {
      success: false,
      error: error && error.message ? error.message : 'Unknown error',
    });
  }
}

function doPost(e) {
  var lock = null;
  try {
    const action = String((e && e.parameter && e.parameter.action) || '').trim();
    if (action !== 'submitJuryEvaluation') {
      throw new Error('Unsupported action');
    }

    const payload = parsePayload_(e);
    const normalized = validateEvaluationPayload_(payload);

    lock = LockService.getScriptLock();
    lock.waitLock(10000);

    const ss = SpreadsheetApp.openById('1mqKoZJQRdlBizdyJbsjAkx7lvFkUMjT3EmxhmDituk0');
    const sheet = getOrCreateSheet_(ss, 'Jury Evaluations');
    ensureEvaluationHeader_(sheet);

    Logger.log(JSON.stringify({
      judgeName: normalized.judgeName,
      serialNo: normalized.serialNo,
      teamName: normalized.teamName,
      teamId: normalized.teamId,
      scores: normalized.scores,
      total: normalized.total,
    }));

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

    sheet.getRange(
      sheet.getLastRow() + 1,
      1,
      1,
      row.length
    ).setValues([row]);

    SpreadsheetApp.flush();

    const lastRow = sheet.getLastRow();
    Logger.log('Last Row After Insert: ' + lastRow);

    return jsonResponse_(200, {
      success: true,
      message: 'Evaluation saved',
    });
  } catch (error) {
    return jsonResponse_(500, {
      success: false,
      error: error && error.message ? error.message : 'Unknown error',
    });
  } finally {
    try {
      if (lock) lock.releaseLock();
    } catch (releaseError) {
      // Ignore release failures.
    }
  }
}

function getParticipants_() {
  const ss = SpreadsheetApp.openById('1mqKoZJQRdlBizdyJbsjAkx7lvFkUMjT3EmxhmDituk0');
  const sheet = findParticipantSheet_(ss);
  if (!sheet) {
    throw new Error('No participant sheet found');
  }

  const values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  const headers = values[0].map(function(header) {
    return String(header || '').trim().toLowerCase();
  });

  return values.slice(1)
    .filter(function(row) {
      return row.some(function(cell) {
        return String(cell || '').trim() !== '';
      });
    })
    .map(function(row, index) {
      const entry = rowToObject_(headers, row);
      return {
        serialNo: firstMatch_(entry, ['serial no', 'serialno', 'serial', 'sno', 'sl no', 'slno', 's.no']),
        teamId: firstMatch_(entry, ['team id', 'teamid', 'team_id', 'team code', 'teamcode']),
        teamName: firstMatch_(entry, ['team name', 'teamname', 'team', 'group name', 'group']) || '—',
        name: firstMatch_(entry, ['name', 'participant name', 'full name', 'fullname']) || '—',
        email: firstMatch_(entry, ['email', 'email id', 'mail']) || '—',
        phone: firstMatch_(entry, ['phone', 'mobile', 'contact', 'phone number']) || '—',
        college: firstMatch_(entry, ['college', 'institution', 'university', 'college name']) || '—',
        track: firstMatch_(entry, ['track', 'selected track', 'domain', 'category']) || '—',
        role: firstMatch_(entry, ['role', 'member role']) || '—',
        status: normalizeStatus_(firstMatch_(entry, ['status', 'check-in status', 'checkinstatus', 'check in status'])) || 'pending',
        time: firstMatch_(entry, ['time', 'timestamp', 'check-in time', 'checkin time']) || '—',
        rowNumber: index + 2,
        raw: entry,
      };
    });
}

function parsePayload_(e) {
  if (!e) return {};

  const contents = e.postData && e.postData.contents ? String(e.postData.contents) : '';
  if (contents) {
    try {
      return JSON.parse(contents);
    } catch (jsonError) {
      // Fall through to parameter parsing.
    }
  }

  const parameter = e.parameter || {};
  const payload = Object.assign({}, parameter);

  if (typeof payload.scores === 'string' && payload.scores.trim()) {
    try {
      payload.scores = JSON.parse(payload.scores);
    } catch (jsonError) {
      payload.scores = {};
    }
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

function validateEvaluationPayload_(payload) {
  if (!payload) throw new Error('Missing payload');

  const judgeName = String(payload.judgeName || '').trim();
  const serialNo = String(payload.serialNo || '').trim();
  const teamName = String(payload.teamName || '').trim();
  const teamId = String(payload.teamId || '').trim();
  const scores = payload.scores || {};

  if (!judgeName) throw new Error('Judge name is required');
  if (!serialNo) throw new Error('Serial number is required');
  if (!teamName) throw new Error('Team name is required');
  if (!teamId) throw new Error('Team ID is required');

  const normalizedScores = {
    problemUnderstanding: requireScore_(scores.problemUnderstanding, 'Problem Understanding'),
    innovationUniqueness: requireScore_(scores.innovationAndUniqueness, 'Innovation & Uniqueness'),
    realWorldImpact: requireScore_(scores.realWorldImpact, 'Real World Impact'),
    scalabilityStartupPotential: requireScore_(scores.scalabilityStartupPotential, 'Scalability / Startup Potentiality'),
    technicalDepth: requireScore_(scores.technicalDepth, 'Technical Depth'),
    userTractionValidation: requireScore_(scores.userTractionValidation, 'User Traction & Validation'),
    presentationCommunication: requireScore_(scores.presentationCommunication, 'Presentation & Communication'),
  };

  const total = Number(payload.total);
  if (!isFinite(total)) throw new Error('Total score is required');

  return {
    sheetName: String(payload.sheetName || 'Jury Evaluations').trim() || 'Jury Evaluations',
    judgeName: judgeName,
    serialNo: serialNo,
    teamName: teamName,
    teamId: teamId,
    scores: normalizedScores,
    total: Math.round(total * 100) / 100,
  };
}

function requireScore_(value, label) {
  const score = Number(value);
  if (!isFinite(score) || score < 1 || score > 10) {
    throw new Error(label + ' must be a number between 1 and 10');
  }
  return score;
}

function ensureEvaluationHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;

  sheet.appendRow([
    'Timestamp',
    'Judge Name',
    'Serial No',
    'Team Name',
    'Team ID',
    'Problem Understanding',
    'Innovation & Uniqueness',
    'Real World Impact',
    'Scalability / Startup Potentiality',
    'Technical Depth',
    'User Traction & Validation',
    'Presentation & Communication',
    'Total',
  ]);
}

function findParticipantSheet_(ss) {
  const preferredNames = [
    'Participants',
    'Registrations',
    'Registration',
    'Team Registrations',
    'Teams',
    'Sheet1',
  ];

  for (var i = 0; i < preferredNames.length; i++) {
    const sheet = ss.getSheetByName(preferredNames[i]);
    if (sheet && sheet.getLastRow() > 0) return sheet;
  }

  const sheets = ss.getSheets();
  for (var j = 0; j < sheets.length; j++) {
    const sheet = sheets[j];
    if (sheet.getLastRow() > 0) return sheet;
  }

  return null;
}

function getOrCreateSheet_(ss, name) {
  const existing = ss.getSheetByName(name);
  if (existing) return existing;
  return ss.insertSheet(name);
}

function rowToObject_(headers, row) {
  const obj = {};
  headers.forEach(function(header, index) {
    if (!header) return;
    obj[header] = row[index];
  });
  return obj;
}

function firstMatch_(obj, keys) {
  for (var i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (obj[key] != null && String(obj[key]).trim() !== '') {
      return String(obj[key]).trim();
    }
  }
  return '';
}

function normalizeStatus_(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'pending';
  if (['checkedin', 'checked-in', 'checked in', 'yes', 'true', '1'].indexOf(normalized) !== -1) {
    return 'checkedin';
  }
  return 'pending';
}

function jsonResponse_(statusCode, body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
