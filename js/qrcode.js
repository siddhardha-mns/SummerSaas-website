// ─── QR CODE GENERATOR (Pure SVG, no dependencies) ────
// Implements a minimal QR Code encoder for alphanumeric data
// Based on the QR Code specification (ISO/IEC 18004)

const QRCode = (() => {
  // Error correction level L (7%)
  const EC_L = 1;

  // Alphanumeric encoding table
  const ALPHANUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

  // Generator polynomials for EC codewords
  const GF256_EXP = new Uint8Array(256);
  const GF256_LOG = new Uint8Array(256);
  (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF256_EXP[i] = x;
      GF256_LOG[x] = i;
      x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
    }
    GF256_EXP[255] = GF256_EXP[0];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF256_EXP[(GF256_LOG[a] + GF256_LOG[b]) % 255];
  }

  function polyMul(p, q) {
    const r = new Uint8Array(p.length + q.length - 1);
    for (let i = 0; i < p.length; i++)
      for (let j = 0; j < q.length; j++)
        r[i + j] ^= gfMul(p[i], q[j]);
    return r;
  }

  function genPoly(n) {
    let p = new Uint8Array([1]);
    for (let i = 0; i < n; i++)
      p = polyMul(p, new Uint8Array([1, GF256_EXP[i]]));
    return p;
  }

  function ecCodes(data, ecLen) {
    const gen = genPoly(ecLen);
    const msg = new Uint8Array(data.length + ecLen);
    msg.set(data);
    for (let i = 0; i < data.length; i++) {
      const coef = msg[i];
      if (coef !== 0)
        for (let j = 0; j < gen.length; j++)
          msg[i + j] ^= gfMul(gen[j], coef);
    }
    return msg.slice(data.length);
  }

  // Encode string to QR bit stream
  function encode(text) {
    text = text.toUpperCase();

    // Determine version (1-4 for short texts)
    const versions = [
      { v: 1, cap: 25,  dcw: 19,  ecw: 7,  size: 21 },
      { v: 2, cap: 47,  dcw: 34,  ecw: 10, size: 25 },
      { v: 3, cap: 77,  dcw: 55,  ecw: 15, size: 29 },
      { v: 4, cap: 114, dcw: 80,  ecw: 20, size: 33 },
      { v: 5, cap: 154, dcw: 108, ecw: 26, size: 37 },
      { v: 6, cap: 195, dcw: 136, ecw: 18, size: 41 },
    ];

    // Check if alphanumeric
    const isAlphaNum = [...text].every(c => ALPHANUM.includes(c));
    let ver;
    for (const v of versions) {
      const maxChars = isAlphaNum ? v.cap : Math.floor(v.dcw * 8 / 8) - 2;
      if (text.length <= (isAlphaNum ? v.cap : maxChars)) { ver = v; break; }
    }
    if (!ver) ver = versions[versions.length - 1];

    // Build bit stream
    let bits = '';

    if (isAlphaNum) {
      // Mode: Alphanumeric (0010)
      bits += '0010';
      // Character count (9 bits for v1, 11 for v2-4)
      const ccBits = ver.v <= 1 ? 9 : 11;
      bits += text.length.toString(2).padStart(ccBits, '0');

      for (let i = 0; i < text.length; i += 2) {
        if (i + 1 < text.length) {
          const val = ALPHANUM.indexOf(text[i]) * 45 + ALPHANUM.indexOf(text[i + 1]);
          bits += val.toString(2).padStart(11, '0');
        } else {
          bits += ALPHANUM.indexOf(text[i]).toString(2).padStart(6, '0');
        }
      }
    } else {
      // Mode: Byte (0100)
      bits += '0100';
      const ccBits = ver.v <= 1 ? 8 : 16;
      bits += text.length.toString(2).padStart(ccBits, '0');
      for (let i = 0; i < text.length; i++) {
        bits += text.charCodeAt(i).toString(2).padStart(8, '0');
      }
    }

    // Terminator
    bits += '0000';

    // Pad to byte boundary
    while (bits.length % 8 !== 0) bits += '0';

    // Convert to bytes
    const totalDataBytes = ver.dcw;
    const dataBytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      dataBytes.push(parseInt(bits.substr(i, 8), 2));
    }

    // Pad with alternating 236/17
    const pads = [236, 17];
    let pi = 0;
    while (dataBytes.length < totalDataBytes) {
      dataBytes.push(pads[pi % 2]);
      pi++;
    }

    // Generate error correction
    const ec = ecCodes(new Uint8Array(dataBytes), ver.ecw);

    // Final message
    const final = [...dataBytes, ...ec];

    // Create matrix
    const size = ver.size;
    const matrix = Array.from({ length: size }, () => new Uint8Array(size));
    const reserved = Array.from({ length: size }, () => new Uint8Array(size));

    // Place finder patterns
    function placeFinder(row, col) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = row + r, cc = col + c;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          const isBlack = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                         (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                         (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          matrix[rr][cc] = isBlack ? 1 : 0;
          reserved[rr][cc] = 1;
        }
      }
    }
    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      matrix[6][i] = matrix[i][6] = i % 2 === 0 ? 1 : 0;
      reserved[6][i] = reserved[i][6] = 1;
    }

    // Alignment patterns (version 2+)
    if (ver.v >= 2) {
      const positions = [6, ver.size - 7];
      if (ver.v >= 3) positions.splice(1, 0, Math.floor((6 + ver.size - 7) / 2));
      for (const r of positions) {
        for (const c of positions) {
          if (reserved[r] && reserved[r][c]) continue;
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const rr = r + dr, cc = c + dc;
              if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
              const isBlack = Math.abs(dr) === 2 || Math.abs(dc) === 2 ||
                             (dr === 0 && dc === 0);
              matrix[rr][cc] = isBlack ? 1 : 0;
              reserved[rr][cc] = 1;
            }
          }
        }
      }
    }

    // Reserve format info areas
    for (let i = 0; i < 8; i++) {
      reserved[8][i] = reserved[i][8] = 1;
      reserved[8][size - 1 - i] = reserved[size - 1 - i][8] = 1;
    }
    reserved[8][8] = 1;
    matrix[size - 8][8] = 1; // dark module
    reserved[size - 8][8] = 1;

    // Place data bits
    let bitIdx = 0;
    const allBits = final.map(b => b.toString(2).padStart(8, '0')).join('');

    for (let col = size - 1; col >= 1; col -= 2) {
      if (col === 6) col = 5;
      for (let row = 0; row < size; row++) {
        for (let c = 0; c < 2; c++) {
          const cc = col - c;
          const isUpward = Math.floor((size - 1 - col) / 2) % 2 === 0;
          const rr = isUpward ? size - 1 - row : row;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          if (reserved[rr][cc]) continue;
          if (bitIdx < allBits.length) {
            matrix[rr][cc] = parseInt(allBits[bitIdx]);
            bitIdx++;
          }
        }
      }
    }

    // Apply mask 0 (checkerboard) — simplest
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c] && (r + c) % 2 === 0) {
          matrix[r][c] ^= 1;
        }
      }
    }

    // Place format info (mask 0, EC level L)
    // Pre-computed: format bits for L, mask 0 = 111011111000100
    const formatBits = '111011111000100';
    const formatPositions1 = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
    const formatPositions2 = [[size-1,8],[size-2,8],[size-3,8],[size-4,8],[size-5,8],[size-6,8],[size-7,8],[8,size-8],[8,size-7],[8,size-6],[8,size-5],[8,size-4],[8,size-3],[8,size-2],[8,size-1]];

    for (let i = 0; i < 15; i++) {
      const bit = parseInt(formatBits[i]);
      const [r1, c1] = formatPositions1[i];
      const [r2, c2] = formatPositions2[i];
      if (r1 >= 0 && r1 < size && c1 >= 0 && c1 < size) matrix[r1][c1] = bit;
      if (r2 >= 0 && r2 < size && c2 >= 0 && c2 < size) matrix[r2][c2] = bit;
    }

    return { matrix, size };
  }

  // Render QR to SVG string
  function toSVG(text, pixelSize = 4, quietZone = 4) {
    const { matrix, size } = encode(text);
    const totalSize = (size + quietZone * 2) * pixelSize;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}">`;
    svg += `<rect width="${totalSize}" height="${totalSize}" fill="white"/>`;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c]) {
          const x = (c + quietZone) * pixelSize;
          const y = (r + quietZone) * pixelSize;
          svg += `<rect x="${x}" y="${y}" width="${pixelSize}" height="${pixelSize}" fill="black"/>`;
        }
      }
    }
    svg += '</svg>';
    return svg;
  }

  return { encode, toSVG };
})();

// ─── TEAM-BASED ID GENERATION ─────────────────────────

function generateTeamPrefix(teamName) {
  if (!teamName || teamName === '—') return 'HP';

  const words = teamName.trim().split(/\s+/);
  if (words.length === 1) {
    // Single word: take first 2-3 chars
    return words[0].substring(0, 3).toUpperCase();
  }
  // Multiple words: take first letter of each (up to 3)
  return words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
}

function generateParticipantIds() {
  const teamCounters = {};

  participants.forEach(p => {
    const prefix = generateTeamPrefix(p.team);
    if (!teamCounters[prefix]) teamCounters[prefix] = 0;
    teamCounters[prefix]++;

    // ✅ If participant already has a Reg ID from the sheet, keep it — don't overwrite
    if (p.id && p.id.trim() !== '') return;

    // Only generate an ID if one doesn't exist
    const memberNum = String(teamCounters[prefix]).padStart(3, '0');
    const hash = hashCode(p.email || p.name).toString(16).substring(0, 4).toUpperCase();
    p.id = `${prefix}-${memberNum}-${hash}`;
  });
}

function hashCode(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xFFFFFFFF;
  }
  return Math.abs(hash);
}

// ─── RENDER QR FOR PARTICIPANT VIEW ───────────────────

function renderParticipantQR(participant) {
  const qrFrame = document.getElementById('qr-frame');
  const qrIdEl = document.getElementById('qr-id-display');
  const checkinBadge = document.getElementById('qr-checkin-badge');
  const checkinStatusEl = document.getElementById('checkin-status');

  if (!qrFrame || !participant) return;

  // Generate real QR SVG encoding the participant's unique ID
  qrFrame.innerHTML = QRCode.toSVG(participant.id, 5, 3);

  // Update ID display
  if (qrIdEl) qrIdEl.textContent = `ID: ${participant.id}`;

  // Update check-in badge below QR
  if (checkinBadge) {
    if (participant.status === 'checkedin') {
      checkinBadge.className = 'badge badge-green';
      checkinBadge.textContent = `✓ Checked in at ${participant.time}`;
    } else {
      checkinBadge.className = 'badge badge-yellow';
      checkinBadge.textContent = '⏳ Not checked in yet';
    }
  }

  // Update the info card check-in status
  if (checkinStatusEl) {
    if (participant.status === 'checkedin') {
      checkinStatusEl.className = 'badge badge-green';
      checkinStatusEl.textContent = `✓ Checked in at ${participant.time}`;
    } else {
      checkinStatusEl.className = 'badge badge-yellow';
      checkinStatusEl.textContent = '⏳ Pending';
    }
  }
}

function updateParticipantDashboard(participant) {
  if (!participant) return;

  // Populate all read-only info fields from sheet data
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };

  set('p-name',    participant.name);
  set('p-email',   participant.email);
  set('p-phone',   participant.phone);
  set('p-college', participant.college);
  set('p-team',    participant.team);
  set('p-role',    participant.role);

  const trackEl = document.getElementById('p-track');
  if (trackEl) trackEl.textContent = participant.track || '—';

  // Render the QR code with the sheet's Reg ID
  renderParticipantQR(participant);
}
