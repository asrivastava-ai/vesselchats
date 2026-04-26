import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { initials } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const token = params.get('token');

  const [invite, setInvite] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isGroupLink, setIsGroupLink] = useState(false);
  const [joined, setJoined] = useState(false);

  // Load invite
  useEffect(() => {
    if (!token) { setError('Invalid invite link.'); setInviteLoading(false); return; }
    getDoc(doc(db, 'invites', token)).then(snap => {
      if (!snap.exists()) { setError('This invite link is invalid.'); }
      else if (snap.data().used && !snap.data().permanent) { setError('This invite link has already been used.'); }
      else {
        const data = snap.data();
        setInvite(data);
        setIsGroupLink(data.groupLink === true);
        if (!data.groupLink) { setName(data.name || ''); setEmail(data.email || ''); }
      }
      setInviteLoading(false);
    });
  }, [token]);

  // Auto-join if already logged in
  useEffect(() => {
    if (authLoading || inviteLoading || !user || !invite || joined) return;
    autoJoin();
  }, [authLoading, inviteLoading, user, invite]);

  async function autoJoin() {
    setSubmitting(true);
    try {
      const memberSnap = await getDoc(doc(db, 'groups', invite.groupId, 'members', user.uid));
      if (!memberSnap.exists()) {
        await setDoc(doc(db, 'groups', invite.groupId, 'members', user.uid), {
          role: invite.role || 'member',
          joinedAt: serverTimestamp(),
          name: profile?.name || '',
          email: profile?.email || ''
        });
        await updateDoc(doc(db, 'users', user.uid), { groups: arrayUnion(invite.groupId) });
        if (!invite.permanent) await updateDoc(doc(db, 'invites', token), { used: true });
      }
      setJoined(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError('Failed to join: ' + err.message);
      setSubmitting(false);
    }
  }

  async function handleAccept(e) {
    e.preventDefault();
    setSubmitting(true); setError('');
    if (password !== password2) { setError('Passwords do not match.'); setSubmitting(false); return; }
    if (password.length < 8) { setError('Min. 8 characters.'); setSubmitting(false); return; }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const uid = cred.user.uid;
      await setDoc(doc(db, 'users', uid), {
        name: name.trim(), email: email.trim().toLowerCase(),
        initials: initials(name.trim()), createdAt: serverTimestamp(), groups: []
      });
      await setDoc(doc(db, 'groups', invite.groupId, 'members', uid), {
        role: invite.role || 'member', joinedAt: serverTimestamp(),
        name: name.trim(), email: email.trim().toLowerCase()
      });
      await updateDoc(doc(db, 'users', uid), { groups: arrayUnion(invite.groupId) });
      if (!invite.permanent) await updateDoc(doc(db, 'invites', token), { used: true });
      navigate('/');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email already has an account. Sign in first, then open the invite link again.');
      } else {
        setError('Something went wrong: ' + err.message);
      }
    }
    setSubmitting(false);
  }

  const inp = { width: '100%', padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 14, outline: 'none' };

  if (inviteLoading || authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>Checking invite...</div>
  );

  if (error && !invite) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: 'var(--bg)' }}>
      <p style={{ color: '#f85149' }}>{error}</p>
      <Link to="/login" style={{ color: 'var(--accent-light)', fontSize: 13 }}>Go to login</Link>
    </div>
  );

  // Already logged in — show auto-join screen
  if (user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 360, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent-light)', letterSpacing: '0.15em', marginBottom: 24 }}>VESSELCHATS</div>
        {joined ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Joined {invite?.groupName}!</h2>
            <p style={{ color: 'var(--text2)', fontSize: 13 }}>Taking you to the chat...</p>
          </>
        ) : submitting ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Joining {invite?.groupName}...</h2>
            <p style={{ color: 'var(--text2)', fontSize: 13 }}>Just a moment.</p>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Join {invite?.groupName}?</h2>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>You're signed in as <strong style={{ color: 'var(--text)' }}>{profile?.name}</strong></p>
            <button onClick={autoJoin} style={{ width: '100%', padding: 11, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              Join group
            </button>
            {error && <p style={{ color: '#f85149', fontSize: 13, marginTop: 10 }}>{error}</p>}
          </>
        )}
      </div>
    </div>
  );

  // Not logged in — signup form
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 380 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent-light)', letterSpacing: '0.15em', marginBottom: 8 }}>VESSELCHATS</div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>You've been invited</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>
            Join <strong style={{ color: 'var(--text)' }}>{invite?.groupName}</strong>
          </p>
        </div>

        {!isGroupLink && (
          <div style={{ padding: '10px 14px', background: 'var(--accent-bg)', border: '1px solid rgba(29,111,164,0.3)', borderRadius: 'var(--radius)', marginBottom: 20, fontSize: 13 }}>
            Invited as <strong>{invite?.email}</strong> · Role: <strong>{invite?.role || 'member'}</strong>
          </div>
        )}
        {isGroupLink && (
          <div style={{ padding: '10px 14px', background: 'rgba(158,106,3,0.1)', border: '1px solid rgba(158,106,3,0.25)', borderRadius: 'var(--radius)', marginBottom: 20, fontSize: 13, color: '#d4a72c' }}>
            Group invite · You'll join as a <strong>member</strong>
          </div>
        )}

        <form onSubmit={handleAccept} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 5 }}>Your full name</label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Siddharth Sharma" style={inp} />
          </div>
          {isGroupLink && (
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 5 }}>Your email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" style={inp} />
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 5 }}>Choose a password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 8 characters" style={inp} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 5 }}>Confirm password</label>
            <input type="password" value={password2} onChange={e => setPassword2(e.target.value)} required style={inp} />
          </div>
          {error && <p style={{ color: '#f85149', fontSize: 13 }}>{error}</p>}
          <button type="submit" disabled={submitting} style={{ marginTop: 4, padding: 11, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'white', fontSize: 14, fontWeight: 500 }}>
            {submitting ? 'Joining...' : 'Create account & join'}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
          Already have an account? <Link to={`/login?redirect=/invite?token=${token}`} style={{ color: 'var(--accent-light)' }}>Sign in first</Link>
        </p>
      </div>
    </div>
  );
}
