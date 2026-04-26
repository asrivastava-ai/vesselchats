import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { initials } from '../lib/utils';

const TEMP_PASS = 'VesselChats2024!';

export default function GroupAdmin({ groupId, groupName, onClose }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState('vessels');
  const [vessels, setVessels] = useState([]);
  const [members, setMembers] = useState([]);
  const [newVessel, setNewVessel] = useState('');
  const [editingVessel, setEditingVessel] = useState(null);
  const [editVesselName, setEditVesselName] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'groups', groupId, 'vessels'), snap => {
      setVessels(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)));
    });
    const u2 = onSnapshot(collection(db, 'groups', groupId, 'members'), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { u1(); u2(); };
  }, [groupId]);

  async function addVessel() {
    const name = newVessel.trim();
    if (!name) return;
    await addDoc(collection(db, 'groups', groupId, 'vessels'), { name, createdAt: serverTimestamp() });
    setNewVessel('');
  }

  async function removeVessel(id) {
    if (!window.confirm('Remove this vessel?')) return;
    await deleteDoc(doc(db, 'groups', groupId, 'vessels', id));
  }

  async function saveVesselEdit(id) {
    if (!editVesselName.trim()) return;
    const { updateDoc: upd } = await import('firebase/firestore');
    await upd(doc(db, 'groups', groupId, 'vessels', id), { name: editVesselName.trim() });
    setEditingVessel(null);
    setEditVesselName('');
  }

  async function sendInvite() {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setLoading(true); setMsg(''); setInviteLink('');
    try {
      // Check if user already exists in system
      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      await setDoc(doc(db, 'invites', token), {
        email: inviteEmail.trim().toLowerCase(),
        name: inviteName.trim(),
        groupId, groupName,
        role: inviteRole,
        existingUser: false,
        used: false,
        createdAt: serverTimestamp(),
        createdBy: profile?.name || ''
      });
      const link = `${window.location.origin}/invite?token=${token}`;
      setInviteLink(link);
      setMsg('Invite link created!');
      setInviteName(''); setInviteEmail('');
    } catch (err) {
      setMsg('Error: ' + err.message);
    }
    setLoading(false);
  }

  const btnStyle = (active) => ({
    padding: '5px 12px', fontSize: 12, fontWeight: 500,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'white' : 'var(--text2)',
    border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border2)'),
    borderRadius: 'var(--radius)', cursor: 'pointer'
  });
  const inp = { width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13, outline: 'none' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)', width: 480, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Group Admin</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{groupName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 20 }}>×</button>
        </div>
        <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6 }}>
          <button style={btnStyle(tab==='vessels')} onClick={() => setTab('vessels')}>Vessels</button>
          <button style={btnStyle(tab==='invite')} onClick={() => setTab('invite')}>Invite member</button>
          <button style={btnStyle(tab==='members')} onClick={() => setTab('members')}>Members</button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
          {tab === 'vessels' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newVessel} onChange={e => setNewVessel(e.target.value)} onKeyDown={e => e.key==='Enter'&&addVessel()} placeholder="Vessel name..." style={{ ...inp, flex: 1 }} />
                <button onClick={addVessel} style={{ padding: '8px 14px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'white', fontSize: 13 }}>Add</button>
              </div>
              {vessels.map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  {editingVessel === v.id ? (
                    <>
                      <input value={editVesselName} onChange={e => setEditVesselName(e.target.value)}
                        onKeyDown={e => { if(e.key==='Enter') saveVesselEdit(v.id); if(e.key==='Escape') setEditingVessel(null); }}
                        autoFocus style={{ flex: 1, padding: '4px 8px', background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 4, color: 'var(--text)', fontSize: 13, outline: 'none' }} />
                      <button onClick={() => saveVesselEdit(v.id)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 4, color: 'white', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}>Save</button>
                      <button onClick={() => setEditingVessel(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 13, flex: 1 }}>{v.name}</span>
                      <button onClick={() => { setEditingVessel(v.id); setEditVesselName(v.name); }} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', padding: '0 4px' }} title="Edit">✏️</button>
                      <button onClick={() => removeVessel(v.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', padding: '0 4px' }} title="Delete">🗑️</button>
                    </>
                  )}
                </div>
              ))}
              {vessels.length === 0 && <p style={{ color: 'var(--text3)', fontSize: 13 }}>No vessels yet. Add one above.</p>}
            </div>
          )}
          {tab === 'invite' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 5 }}>Full name</label><input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Sarah Mitchell" style={inp} /></div>
              <div><label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 5 }}>Email</label><input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="sarah@company.com" style={inp} /></div>
              <div><label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 5 }}>Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={inp}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button onClick={sendInvite} disabled={loading} style={{ padding: 10, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'white', fontSize: 14, fontWeight: 500 }}>
                {loading ? 'Creating...' : 'Generate invite link'}
              </button>
              {msg && <p style={{ fontSize: 13, color: msg.startsWith('Error') ? '#f85149' : 'var(--accent-light)' }}>{msg}</p>}
              {inviteLink && (
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: 12 }}>
                  <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8 }}>Send this to the invitee:</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input readOnly value={inviteLink} onClick={e => e.target.select()} style={{ ...inp, flex: 1, fontSize: 11, color: 'var(--accent-light)' }} />
                    <button onClick={() => navigator.clipboard.writeText(inviteLink)} style={{ padding: '8px 10px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12 }}>Copy</button>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>Single-use. User sets their own password on first login.</p>
                </div>
              )}
            </div>
          )}
          {tab === 'members' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--accent-light)', flexShrink: 0 }}>{initials(m.name || m.email)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name || m.email}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>{m.email} · {m.role}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
