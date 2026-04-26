import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

const SUPER_ADMIN_EMAIL = 'aloksrius@yahoo.com';

function StatCard({ label, value, sub }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px' }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function daysSince(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return diff + ' days ago';
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SuperAdmin() {
  const { user, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ groups: [], users: [], messages: [] });
  const [fetching, setFetching] = useState(false);
  const [topWords, setTopWords] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  const isAuthorized = user && user.email === SUPER_ADMIN_EMAIL;

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError(''); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setLoginError('Invalid credentials.');
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!isAuthorized) return;
    setFetching(true);

    const unsubs = [];

    // Load all users
    unsubs.push(onSnapshot(collection(db, 'users'), snap => {
      setData(d => ({ ...d, users: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) }));
    }));

    // Load all groups + their members, vessels, messages
    unsubs.push(onSnapshot(collection(db, 'groups'), async snap => {
      const groups = [];
      for (const docSnap of snap.docs) {
        const group = { id: docSnap.id, ...docSnap.data(), memberCount: 0, vesselCount: 0, messageCount: 0, storageBytes: 0, lastActive: null };

        // Get members count
        const membersSnap = await getDocs(collection(db, 'groups', docSnap.id, 'members'));
        group.memberCount = membersSnap.size;

        // Get vessels count
        const vesselsSnap = await getDocs(collection(db, 'groups', docSnap.id, 'vessels'));
        group.vesselCount = vesselsSnap.size;

        // Get messages for analytics
        const msgsSnap = await getDocs(query(collection(db, 'groups', docSnap.id, 'messages'), orderBy('timestamp', 'desc')));
        group.messageCount = msgsSnap.size;

        // Last active = most recent message timestamp
        if (msgsSnap.docs.length > 0) {
          group.lastActive = msgsSnap.docs[0].data().timestamp;
        }

        // Storage: sum file sizes
        let storageBytes = 0;
        msgsSnap.docs.forEach(m => {
          if (m.data().file?.size) storageBytes += m.data().file.size;
        });
        group.storageBytes = storageBytes;

        groups.push(group);
      }
      groups.sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0));
      setData(d => ({ ...d, groups }));

      // Topic analytics — word frequency across all messages
      const wordCount = {};
      const stopWords = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'from', 'has', 'have', 'are', 'was', 'will', 'been', 'not', 'but', 'can', 'all', 'its', 'our', 'your', 'they', 'their', 'please', 'need', 'also', 'any', 'into', 'would', 'should', 'could', 'about', 'get', 'send', 'sent']);
      groups.forEach(g => {
        // We already fetched messages above - re-fetch text
      });

      // Re-scan all messages for word frequency
      for (const docSnap of snap.docs) {
        const msgsSnap2 = await getDocs(collection(db, 'groups', docSnap.id, 'messages'));
        msgsSnap2.docs.forEach(m => {
          const text = m.data().text || '';
          text.toLowerCase().split(/\s+/).forEach(w => {
            const clean = w.replace(/[^a-z0-9]/g, '');
            if (clean.length > 3 && !stopWords.has(clean)) {
              wordCount[clean] = (wordCount[clean] || 0) + 1;
            }
          });
        });
      }

      const sorted = Object.entries(wordCount).sort((a, b) => b[1] - a[1]).slice(0, 20);
      setTopWords(sorted);
      setFetching(false);
    }));

    return () => unsubs.forEach(u => u());
  }, [isAuthorized]);

  // Login screen
  if (!isAuthorized) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: 340 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent-light)', letterSpacing: '0.15em', marginBottom: 8 }}>VESSELCHATS</div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Super Admin</h1>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>Restricted access.</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Email" style={{ padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Password" style={{ padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
            {loginError && <p style={{ color: '#f85149', fontSize: 13 }}>{loginError}</p>}
            <button type="submit" disabled={loading} style={{ padding: 11, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'white', fontSize: 14, fontWeight: 500 }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Compute platform stats
  const totalGroups = data.groups.length;
  const totalUsers = data.users.length;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const activeUsers = data.users.filter(u => {
    if (!u.lastSeen) return false;
    const d = u.lastSeen?.toDate ? u.lastSeen.toDate() : new Date(u.lastSeen);
    return d.getTime() > thirtyDaysAgo;
  }).length;
  const totalMessages = data.groups.reduce((s, g) => s + (g.messageCount || 0), 0);
  const totalStorage = data.groups.reduce((s, g) => s + (g.storageBytes || 0), 0);

  const tabStyle = (t) => ({
    padding: '6px 14px', fontSize: 12, fontWeight: 500,
    background: activeTab === t ? 'var(--accent)' : 'none',
    color: activeTab === t ? 'white' : 'var(--text2)',
    border: '1px solid ' + (activeTab === t ? 'var(--accent)' : 'var(--border2)'),
    borderRadius: 'var(--radius)', cursor: 'pointer'
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent-light)', letterSpacing: '0.15em', marginBottom: 4 }}>VESSELCHATS</div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Super Admin</h1>
          </div>
          <button onClick={() => signOut(auth)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '6px 12px', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button style={tabStyle('overview')} onClick={() => setActiveTab('overview')}>Overview</button>
          <button style={tabStyle('groups')} onClick={() => setActiveTab('groups')}>Groups</button>
          <button style={tabStyle('users')} onClick={() => setActiveTab('users')}>Users</button>
          <button style={tabStyle('topics')} onClick={() => setActiveTab('topics')}>Topics</button>
        </div>

        {fetching && <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>Loading data...</div>}

        {/* Overview */}
        {activeTab === 'overview' && !fetching && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <StatCard label="Total Groups" value={totalGroups} sub="Active fleet groups" />
              <StatCard label="Total Users" value={totalUsers} sub={`${activeUsers} active last 30d`} />
              <StatCard label="Total Messages" value={totalMessages.toLocaleString()} sub="Across all groups" />
              <StatCard label="Total Storage" value={formatBytes(totalStorage)} sub="Files shared" />
            </div>

            {/* Most active groups */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Most active groups</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.groups.slice(0, 5).map(g => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{g.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>{g.memberCount} members · {g.vesselCount} vessels · last active {daysSince(g.lastActive)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-light)' }}>{g.messageCount.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>messages</div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 70 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{formatBytes(g.storageBytes)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>storage</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Groups tab */}
        {activeTab === 'groups' && !fetching && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Group name', 'Created', 'Members', 'Vessels', 'Messages', 'Storage', 'Last active'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.groups.map((g, i) => (
                  <tr key={g.id} style={{ borderBottom: i < data.groups.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>{g.name}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text2)' }}>{formatDate(g.createdAt)}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13 }}>{g.memberCount}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13 }}>{g.vesselCount}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--accent-light)', fontWeight: 500 }}>{g.messageCount.toLocaleString()}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text2)' }}>{formatBytes(g.storageBytes)}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text2)' }}>{daysSince(g.lastActive)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Users tab */}
        {activeTab === 'users' && !fetching && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Name', 'Email', 'Groups', 'Joined'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.users.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < data.users.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>{u.name || '—'}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text2)' }}>{u.email}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13 }}>{u.groups?.length || 0}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text2)' }}>{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Topics tab */}
        {activeTab === 'topics' && !fetching && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Top topics across all groups</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>Most frequently used words in messages — stop words removed.</div>
              {topWords.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>Not enough messages yet to show topics.</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {topWords.map(([word, count], i) => {
                  const maxCount = topWords[0]?.[1] || 1;
                  const size = Math.max(11, Math.min(22, 11 + (count / maxCount) * 11));
                  const opacity = 0.5 + (count / maxCount) * 0.5;
                  return (
                    <div key={word} style={{ padding: '4px 10px', background: 'var(--accent-bg)', border: '1px solid rgba(29,111,164,0.25)', borderRadius: 20, fontSize: size, color: 'var(--accent-light)', opacity, fontWeight: i < 5 ? 600 : 400 }}>
                      {word} <span style={{ fontSize: 10, opacity: 0.7 }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
