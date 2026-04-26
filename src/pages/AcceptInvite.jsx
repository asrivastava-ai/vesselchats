import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { initials } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = params.get('token');

  const [invite, setInvite] = useState(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingUser, setExistingUser] = useState(false);

  useEffect(() => {
    if (!token) { setError('Invalid invite link.'); setLoading(false); return; }
    getDoc(doc(db, 'invites', token)).then(snap => {
      if (!snap.exists() || snap.data().used) { setError('This invite link is invalid or already used.'); }
      else { 
        const data = snap.data();
        setInvite(data); 
        setName(data.name || '');
        setExistingUser(data.existingUser || false);
      }
      setLoading(false);
    });
  }, [token]);

  async function handleAccept(e) {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      let uid;
      if (existingUser && user) {
        uid = user.uid;
      } else {
        if (password !== password2) { setError('Passwords do not match.'); setSubmitting(false); return; }
        if (password.length < 8) { setError('Min. 8 characters.'); setSubmitting(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, invite.email, password);
        uid = cred.user.uid;
        await setDoc(doc(db, 'users', uid), {
          name: name.trim(), email: invite.email,
          initials: initials(name.trim()), createdAt: serverTimestamp(), groups: []
        });
      }
      // Add user to group
      await setDoc(doc(db, 'groups', invite.groupId, 'members', uid), {
        role: invite.role || 'member', joinedAt: serverTimestamp(), name: name.trim(), email: invite.email
      });
      await updateDoc(doc(db, 'users', uid), { groups: arrayUnion(invite.groupId) });
      await updateDoc(doc(db, 'invites', token), { used: true });
      navigate('/');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('This email already has an account. Sign in first, then use the invite link.');
      else setError('Something went wrong: ' + err.message);
    }
    setSubmitting(false);
  }

  const inp = { width: '100%', padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 14, outline: 'none' };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>Checking invite...</div>;
  if (error && !invite) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <p style={{ color: '#f85149' }}>{error}</p>
      <Link to="/login" style={{ color: 'var(--accent-light)', fontSize: 13 }}>Go to login</Link>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 380 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent-light)', letterSpacing: '0.15em', marginBottom: 8 }}>VESSELCHATS</div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>You've been invited</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>Join <strong style={{ color: 'var(--text)' }}>{invite?.groupName}</strong></p>
        </div>
        <div style={{ padding: '10px 14px', background: 'var(--accent-bg)', border: '1px solid rgba(29,111,164,0.3)', borderRadius: 'var(--radius)', marginBottom: 20, fontSize: 13 }}>
          Invited as <strong>{invite?.email}</strong> · Role: <strong>{invite?.role || 'member'}</strong>
        </div>
        <form onSubmit={handleAccept} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 5 }}>Your name</label>
            <input value={name} onChange={e => setName(e.target.value)} required style={inp} />
          </div>
          {!existingUser && <>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 5 }}>Choose password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 8 characters" style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 5 }}>Confirm password</label>
              <input type="password" value={password2} onChange={e => setPassword2(e.target.value)} required style={inp} />
            </div>
          </>}
          {error && <p style={{ color: '#f85149', fontSize: 13 }}>{error}</p>}
          <button type="submit" disabled={submitting} style={{ marginTop: 4, padding: 11, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'white', fontSize: 14, fontWeight: 500 }}>
            {submitting ? 'Joining...' : 'Join group'}
          </button>
        </form>
      </div>
    </div>
  );
}
