// ─── CSV EXPORT ───────────────────────────────────────
function downloadCSV(type) {
  let rows = [], filename = '';
  if (type === 'participants') {
    filename = 'participants.csv';
    rows = [['ID','Name','Email','Team','Track','Status','CheckinTime'],
      ...participants.map(p => [p.id, p.name, p.email, p.team, p.track, p.status, p.time])];
  } else if (type === 'checkins') {
    filename = 'checkins.csv';
    rows = [['ID','Name','Email','Team','CheckinTime'],
      ...participants.filter(p => p.status === 'checkedin')
        .map(p => [p.id, p.name, p.email, p.team, p.time])];
  } else if (type === 'pending') {
    filename = 'pending.csv';
    rows = [['ID','Name','Email','Team'],
      ...participants.filter(p => p.status === 'pending')
        .map(p => [p.id, p.name, p.email, p.team])];
  } else if (type === 'announcements') {
    filename = 'announcements.csv';
    rows = [['ID','Title','Body','Priority','Time'],
      ...announcements.map(a => [a.id, a.title, a.body, a.priority, a.time])];
  } else if (type === 'teams') {
    filename = 'teams.csv';
    rows = [['Team','Members','Track'],
      ['Neural Ninjas','Alice Johnson, Riya Patel','AI / ML'],
      ['Chain Gang','Arjun Kumar, Dev Joshi','Web3'],
      ['Byte Busters','Shreya Nair','CyberSec'],
      ['App Alchemists','Karan Mehta, Meera Iyer','Mobile'],
      ['Zero Day','Priya Singh','CyberSec']];
  }
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  showToast(`⬇ Downloading ${filename}`);
}
