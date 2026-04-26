import { useState } from 'react';
import { collection, doc, setDoc, serverTimestamp, addDoc, updateDoc, arrayUnion } from 'firebase/firestore';
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
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 28 }}>
          You're not part of any group yet.
        </p>

        {/* Invite link box — primary action */}
        <div style={{ padding: '16px', background: 'var(--accent-bg)', border: '1px solid rgba(29,111,164,0.3)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>Have an invite link?</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>Open the invite link sent to you — it will add you to the group automatically. You can open it in this browser while signed in.</div>
        </div>

        {/* Create group — secondary */}
        {!showCreate ? (
          <button onClick={() => setShowCreate(true)} style={{ width: '100%', padding: '10px', background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
            + Create a new group instead
          </button>
        ) : (
          <form onSubmit={createGroup} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input value={groupName} onChange={e => setGroupName(e.target.value)} required
              placeholder="e.g. GeoServes Fleet Ops"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 14, outline: 'none' }}
            />
            {error && <p style={{ color: '#f85149', fontSize: 13 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setShowCreate(false)} style={{ flex: 1, padding: 10, background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text2)', fontSize: 13 }}>Cancel</button>
              <button type="submit" disabled={creating} style={{ flex: 2, padding: 10, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'white', fontSize: 13, fontWeight: 500 }}>
                {creating ? 'Creating...' : 'Create group'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
