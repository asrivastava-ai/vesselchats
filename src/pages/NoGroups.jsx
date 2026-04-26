import { useState } from 'react';
import { collection, doc, setDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { initials, avatarColor } from '../lib/utils';

export default function NoGroups() {
  const { user, profile } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  async function createGroup(e) {
    e.preventDefault();
    if (!groupName.trim()) return;
    setCreating(true); setError('');
    try {
      const groupRef = await addDoc(collection(db, 'groups'), {
        name: groupName.trim(), createdBy: user.uid,
        createdByName: profile?.name || '', createdAt: serverTimestamp()
      });
      await setDoc(doc(db, 'groups', groupRef.id, 'members', user.uid), {
        role: 'admin', joinedAt: serverTimestamp(),
        name: profile?.name || '', email: profile?.email || ''
      });
      // Update user's groups list
      const { updateDoc, arrayUnion } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', user.uid), { groups: arrayUnion(groupRef.id) });
    } catch (err) {
      setError('Failed to create group. Try again.');
    }
    setCreating(false);
  }

  const c = avatarColor(profile?.name);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent-light)', letterSpacing: '0.15em' }}>VESSELCHATS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: c.color }}>
              {initials(profile?.name || '')}
            </div>
            <button onClick={() => signOut(auth)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
          </div>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Welcome, {profile?.name?.split(' ')[0]}!</h2>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 32 }}>
          You're not part of any group yet. Create one for your fleet, or wait for an invite link from your team.
        </p>

        {!showCreate ? (
          <button onClick={() => setShowCreate(true)} style={{ width: '100%', padding: '12px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'white', fontSize: 14, fontWeight: 500 }}>
            + Create a new group
          </button>
        ) : (
          <form onSubmit={createGroup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 5 }}>Group name</label>
              <input value={groupName} onChange={e => setGroupName(e.target.value)} required
                placeholder="e.g. GeoServes Fleet Ops"
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 14, outline: 'none' }}
              />
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 5 }}>You'll be the admin. You can invite your team after creation.</p>
            </div>
            {error && <p style={{ color: '#f85149', fontSize: 13 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setShowCreate(false)} style={{ flex: 1, padding: 10, background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text2)', fontSize: 14 }}>Cancel</button>
              <button type="submit" disabled={creating} style={{ flex: 2, padding: 10, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'white', fontSize: 14, fontWeight: 500 }}>
                {creating ? 'Creating...' : 'Create group'}
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: 20, padding: '14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text2)' }}>
          <strong style={{ color: 'var(--text)' }}>Have an invite link?</strong><br />
          Open the invite link you received by email or message — it will add you to the group automatically.
        </div>
      </div>
    </div>
  );
}
