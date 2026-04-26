export function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function avatarColor(str) {
  const colors = [
    { bg: 'rgba(29,111,164,0.22)', color: '#58a6ff' },
    { bg: 'rgba(26,127,75,0.22)', color: '#3fb950' },
    { bg: 'rgba(158,106,3,0.22)', color: '#d4a72c' },
    { bg: 'rgba(182,35,36,0.22)', color: '#f85149' },
    { bg: 'rgba(130,80,180,0.22)', color: '#c084fc' },
    { bg: 'rgba(20,150,150,0.22)', color: '#39d3bb' },
  ];
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function formatTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export function groupByDate(msgs, formatDateFn) {
  const groups = [];
  let currentDate = null;
  msgs.forEach(m => {
    const dateStr = m.timestamp ? formatDateFn(m.timestamp) : '';
    if (dateStr !== currentDate) { currentDate = dateStr; groups.push({ type: 'date', label: dateStr }); }
    groups.push({ type: 'message', data: m });
  });
  return groups;
}

export function generateDmId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}
