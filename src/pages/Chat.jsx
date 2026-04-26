import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, query, orderBy, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import GroupAdmin from '../components/GroupAdmin';
import FileMessage from '../components/FileMessage';
import { initials, avatarColor, formatTime, formatDate, groupByDate, generateDmId } from '../lib/utils';

const MAX_FILE = 10 * 1024 * 1024;

export default function Chat() {
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState([]);
  const [allUsers, setAllUsers] = useState({});
  const [messages, setMessages] = useState([]);
  const [dmMessages, setDmMessages] = useState([]);
  const [activeSelection, setActiveSelection] = useState(null);
  const [input, setInput] = useState('');
  const [routingHint, setRoutingHint] = useState([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminGroupId, setAdminGroupId] = useState(null);
  const [adminGroupName, setAdminGroupName] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [memberRoles, setMemberRoles] = useState({});
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const msgUnsubRef = useRef(null);
  const dmUnsubRef = useRef(null);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  // Load all users
  useEffect(() => {
    return onSnapshot(collection(db, 'users'), snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() }; });
      setAllUsers(map);
    });
  }, []);

  // Load groups the user belongs to
  useEffect(() => {
    if (!profile?.groups?.length) { setGroups([]); return; }
    const unsubs = [];
    const groupData = {};
    const roles = {};

    profile.groups.forEach(gid => {
      // Listen to group doc
      const u1 = onSnapshot(doc(db, 'groups', gid), snap => {
        if (!snap.exists()) return;
        groupData[gid] = { id: gid, ...snap.data(), vessels: groupData[gid]?.vessels || [] };
        setGroups(Object.values(groupData).sort((a, b) => a.name?.localeCompare(b.name)));
      });
      // Listen to vessels
      const u2 = onSnapshot(collection(db, 'groups', gid, 'vessels'), snap => {
        const vessels = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name));
        groupData[gid] = { ...groupData[gid], vessels };
        setGroups(Object.values(groupData).sort((a, b) => a.name?.localeCompare(b.name)));
      });
      // Get user role in this group
      getDoc(doc(db, 'groups', gid, 'members', user.uid)).then(snap => {
        if (snap.exists()) { roles[gid] = snap.data().role; setMemberRoles({ ...roles }); }
      });
      unsubs.push(u1, u2);
    });
    return () => unsubs.forEach(u => u());
  }, [profile?.groups]);

  // Set default selection when groups load
  useEffect(() => {
    if (!activeSelection && groups.length > 0) {
      setActiveSelection({ type: 'group', id: groups[0].id + '_common', groupId: groups[0].id });
    }
  }, [groups]);

  // Load messages based on active selection
  useEffect(() => {
    if (!activeSelection) return;
    if (msgUnsubRef.current) { msgUnsubRef.current(); msgUnsubRef.current = null; }
    if (dmUnsubRef.current) { dmUnsubRef.current(); dmUnsubRef.current = null; }

    if (activeSelection.type === 'dms' && activeSelection.dmId) {
      const q = query(collection(db, 'dms', activeSelection.dmId, 'messages'), orderBy('timestamp', 'asc'));
      dmUnsubRef.current = onSnapshot(q, snap => {
        setDmMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setMessages([]);
      });
    } else if (activeSelection.groupId) {
      const q = query(collection(db, 'groups', activeSelection.groupId, 'messages'), orderBy('timestamp', 'asc'));
      msgUnsubRef.current = onSnapshot(q, snap => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setDmMessages([]);
      });
    }
  }, [activeSelection?.id, activeSelection?.dmId]);

  // Mark messages read on tab change
  useEffect(() => {
    if (!user || !activeSelection) return;
    const msgs = getDisplayMessages();
    msgs.forEach(m => {
      if (m.senderId !== user.uid && (!m.readBy || !m.readBy[user.uid])) {
        const msgRef = activeSelection.dmId
          ? doc(db, 'dms', activeSelection.dmId, 'messages', m.id)
          : doc(db, 'groups', activeSelection.groupId, 'messages', m.id);
        updateDoc(msgRef, { [`readBy.${user.uid}`]: true });
      }
    });
  }, [activeSelection?.id, activeSelection?.dmId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, dmMessages, activeSelection]);

  function getAllVessels() {
    return groups.flatMap(g => (g.vessels || []).map(v => ({ ...v, groupId: g.id, groupName: g.name })));
  }

  function detectVessels(text) {
    const allVessels = getAllVessels();
    const tl = text.toLowerCase();
    return allVessels.filter(v => {
      const vl = v.name.toLowerCase();
      if (tl.includes(vl)) return true;
      const words = vl.split(' ').filter(w => w.length > 2 && !['mv', 'mt', 'msc', 'the'].includes(w));
      return words.some(w => tl.includes(w));
    });
  }

  function getDisplayMessages() {
    if (!activeSelection) return [];
    if (activeSelection.dmId) return dmMessages;
    const id = activeSelection.id;
    const gid = activeSelection.groupId;
    if (!gid) return [];
    if (id === gid + '_all') return messages;
    if (id === gid + '_common') return messages.filter(m => !m.vesselIds || m.vesselIds.length === 0);
    if (id === gid + '_mentions') return messages.filter(m => {
      if (m.senderId === user?.uid) return false;
      const tl = m.text?.toLowerCase() || '';
      const name = (profile?.name || '').toLowerCase();
      const first = name.split(' ')[0];
      return tl.includes('@' + first) || tl.includes(name) || (first.length > 2 && tl.includes(first));
    });
    if (activeSelection.vesselId) return messages.filter(m => m.vesselIds?.includes(activeSelection.vesselId));
    return [];
  }

  function getUnreadCount(key) {
    if (!user) return 0;
    if (key === 'dms_total') {
      return Object.entries(allUsers).reduce((sum, [uid]) => {
        if (uid === user.uid) return sum;
        const dmId = generateDmId(user.uid, uid);
        return sum + (dmMessages.filter ? 0 : 0); // simplified — full impl needs per-DM listener
      }, 0);
    }
    if (key.startsWith('dm_')) return 0; // simplified
    const parts = key.split('_');
    if (parts.length < 2) return 0;
    const gid = parts[0];
    const suffix = parts.slice(1).join('_');
    const g = groups.find(g => g.id === gid);
    if (!g) return 0;
    const msgs = messages.filter(m => {
      // Only count messages from current group listener if group matches activeSelection
      return true;
    });
    const allMsgs = messages;
    if (suffix === 'common') return allMsgs.filter(m => m.senderId !== user.uid && (!m.vesselIds || m.vesselIds.length === 0) && (!m.readBy || !m.readBy[user.uid])).length;
    if (suffix === 'mentions') return allMsgs.filter(m => {
      if (m.senderId === user?.uid) return false;
      if (m.readBy?.[user.uid]) return false;
      const tl = m.text?.toLowerCase() || '';
      const name = (profile?.name || '').toLowerCase();
      const first = name.split(' ')[0];
      return tl.includes('@' + first) || tl.includes(name) || (first.length > 2 && tl.includes(first));
    }).length;
    // vessel
    const vessel = g.vessels?.find(v => v.id === suffix);
    if (vessel) return allMsgs.filter(m => m.senderId !== user.uid && m.vesselIds?.includes(suffix) && (!m.readBy || !m.readBy[user.uid])).length;
    return 0;
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || !user) return;

    if (activeSelection?.dmId) {
      await addDoc(collection(db, 'dms', activeSelection.dmId, 'messages'), {
        text, senderId: user.uid, senderName: profile?.name || 'Unknown',
        senderInitials: initials(profile?.name || '?'),
        timestamp: serverTimestamp(), readBy: { [user.uid]: true }
      });
    } else if (activeSelection?.groupId) {
      const matched = detectVessels(text);

      if (matched.length === 0) {
        // No vessel match — send to active group as common message
        await addDoc(collection(db, 'groups', activeSelection.groupId, 'messages'), {
          text, senderId: user.uid, senderName: profile?.name || 'Unknown',
          senderInitials: initials(profile?.name || '?'),
          timestamp: serverTimestamp(), vesselIds: [],
          readBy: { [user.uid]: true }
        });
      } else {
        // Group matched vessels by their group
        const byGroup = {};
        matched.forEach(v => {
          if (!byGroup[v.groupId]) byGroup[v.groupId] = [];
          byGroup[v.groupId].push(v.id);
        });
        // Send one message per group that has matched vessels
        for (const [gid, vids] of Object.entries(byGroup)) {
          await addDoc(collection(db, 'groups', gid, 'messages'), {
            text, senderId: user.uid, senderName: profile?.name || 'Unknown',
            senderInitials: initials(profile?.name || '?'),
            timestamp: serverTimestamp(), vesselIds: vids,
            readBy: { [user.uid]: true }
          });
        }
      }
    }
    setInput(''); setRoutingHint([]);
    inputRef.current?.focus();
  }

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file || !activeSelection) return;
    setUploadError('');
    if (file.size > MAX_FILE) { setUploadError('Max 10MB.'); return; }
    const path = `uploads/${user.uid}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);
    setUploadProgress(0);
    task.on('state_changed',
      snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      err => { setUploadError('Upload failed.'); setUploadProgress(null); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        const fileData = { url, name: file.name, type: file.type, size: file.size };
        if (activeSelection.dmId) {
          await addDoc(collection(db, 'dms', activeSelection.dmId, 'messages'), {
            text: '', senderId: user.uid, senderName: profile?.name || 'Unknown',
            senderInitials: initials(profile?.name || '?'),
            timestamp: serverTimestamp(), readBy: { [user.uid]: true }, file: fileData
          });
        } else if (activeSelection.groupId) {
          const vesselIds = activeSelection.vesselId ? [activeSelection.vesselId] : [];
          await addDoc(collection(db, 'groups', activeSelection.groupId, 'messages'), {
            text: '', senderId: user.uid, senderName: profile?.name || 'Unknown',
            senderInitials: initials(profile?.name || '?'),
            timestamp: serverTimestamp(), vesselIds, readBy: { [user.uid]: true }, file: fileData
          });
        }
        setUploadProgress(null);
        fileInputRef.current.value = '';
      }
    );
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function activeTabLabel() {
    if (!activeSelection) return 'VesselChats';
    if (activeSelection.dmId) {
      const other = allUsers[activeSelection.dmUserId];
      return '💬 ' + (other?.name || 'Direct Message');
    }
    const id = activeSelection.id;
    const gid = activeSelection.groupId;
    if (!gid) return '';
    const g = groups.find(g => g.id === gid);
    if (id === gid + '_all') return (g?.name || '') + ' · All messages';
    if (id === gid + '_common') return (g?.name || '') + ' · Common';
    if (id === gid + '_mentions') return (g?.name || '') + ' · Mentions';
    if (activeSelection.vesselId) {
      const v = g?.vessels?.find(v => v.id === activeSelection.vesselId);
      return v?.name || '';
    }
    return '';
  }

  function isAdminOfActiveGroup() {
    if (!activeSelection?.groupId) return false;
    return memberRoles[activeSelection.groupId] === 'admin';
  }

  async function handleCreateGroup(e) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    const { addDoc: addD, collection: col, setDoc: setD, doc: d, serverTimestamp: st, updateDoc: updD, arrayUnion: au } = await import('firebase/firestore');
    const gRef = await addD(col(db, 'groups'), { name: newGroupName.trim(), createdBy: user.uid, createdByName: profile?.name || '', createdAt: st() });
    await setD(d(db, 'groups', gRef.id, 'members', user.uid), { role: 'admin', joinedAt: st(), name: profile?.name || '', email: profile?.email || '' });
    await updD(d(db, 'users', user.uid), { groups: au(gRef.id) });
    setNewGroupName(''); setShowCreateGroup(false);
  }

  const displayMsgs = getDisplayMessages();
  const grouped = groupByDate(displayMsgs, formatDate);
  const allUserList = Object.entries(allUsers);
  const showEmailTeaser = activeSelection?.vesselId;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', height: 44, borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {isMobile && <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 20, cursor: 'pointer', flexShrink: 0 }}>☰</button>}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTabLabel()}</span>
        </div>
        {isAdminOfActiveGroup() && (
          <button onClick={() => setShowAdmin(true)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '4px 10px', color: 'var(--text2)', fontSize: 11, flexShrink: 0 }}>Admin</button>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar groups={groups} activeSelection={activeSelection} onSelect={setActiveSelection} getUnreadCount={getUnreadCount} isMobile={isMobile} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onCreateGroup={() => setShowCreateGroup(true)} allUsers={allUsers} memberRoles={memberRoles} onAdminGroup={(gid, gname) => { setAdminGroupId(gid); setAdminGroupName(gname); setShowAdmin(true); }} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
            {!activeSelection && (
              <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '60px 20px' }}>Select a channel or vessel to start chatting.</div>
            )}
            {activeSelection && displayMsgs.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '60px 20px' }}>
                {activeSelection.id?.includes('_mentions') ? 'No messages mentioning you yet.' : 'No messages yet. Be the first!'}
              </div>
            )}
            {grouped.map((item, i) => {
              if (item.type === 'date') return (
                <div key={'d' + i} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 20px 12px' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{item.label}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
              );
              const m = item.data;
              const isMe = m.senderId === user?.uid;
              const sc = avatarColor(m.senderName);
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', padding: '3px 16px', gap: 3 }}>
                  {!isMe && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 36 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: sc.color }}>{m.senderName}</span>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{formatTime(m.timestamp)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    {!isMe && (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: sc.color, flexShrink: 0, marginBottom: 2 }}>{m.senderInitials || initials(m.senderName)}</div>
                    )}
                    <div style={{ maxWidth: '65%' }}>
                      {/* Vessel tags in All view */}
                      {activeSelection?.id?.endsWith('_all') && m.vesselIds?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                          {m.vesselIds.map(vid => {
                            const g = groups.find(g => g.id === activeSelection.groupId);
                            const v = g?.vessels?.find(v => v.id === vid);
                            return v ? <span key={vid} style={{ fontSize: 10, padding: '1px 6px', background: 'var(--accent-bg)', color: 'var(--accent-light)', borderRadius: 4 }}>{v.name}</span> : null;
                          })}
                        </div>
                      )}
                      {m.file ? <FileMessage file={m.file} isMe={isMe} /> : (
                        <div style={{ padding: '8px 12px', borderRadius: 12, borderBottomRightRadius: isMe ? 3 : 12, borderBottomLeftRadius: isMe ? 12 : 3, background: isMe ? 'var(--accent)' : 'var(--bg3)', border: isMe ? 'none' : '1px solid var(--border)', color: isMe ? 'white' : 'var(--text)', fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word' }}>
                          {m.text}
                        </div>
                      )}
                      {/* Read receipts */}
                      <div style={{ display: 'flex', gap: 3, marginTop: 4, justifyContent: isMe ? 'flex-end' : 'flex-start', flexWrap: 'wrap', alignItems: 'center' }}>
                        {isMe && <span style={{ fontSize: 10, color: 'var(--text3)', marginRight: 2 }}>{formatTime(m.timestamp)}</span>}
                        {allUserList.map(([uid, u]) => {
                          const read = m.readBy?.[uid];
                          const c = avatarColor(u.name);
                          return <div key={uid} title={`${u.name} — ${read ? 'read' : 'unread'}`} style={{ width: 16, height: 16, borderRadius: '50%', background: read ? c.bg : 'var(--bg3)', border: `1px solid ${read ? c.color : 'var(--border2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color: read ? c.color : 'var(--text3)', opacity: read ? 1 : 0.4 }}>{initials(u.name)}</div>;
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Upload progress */}
          {uploadProgress !== null && (
            <div style={{ padding: '5px 16px', background: 'var(--accent-bg)', borderTop: '1px solid rgba(29,111,164,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 3, background: 'var(--bg3)', borderRadius: 2 }}><div style={{ height: '100%', width: uploadProgress + '%', background: 'var(--accent-light)', borderRadius: 2, transition: 'width 0.2s' }} /></div>
              <span style={{ fontSize: 11, color: 'var(--accent-light)' }}>{uploadProgress}%</span>
            </div>
          )}

          {/* Routing hint */}
          {routingHint.length > 0 && (
            <div style={{ padding: '5px 16px', background: 'rgba(158,106,3,0.1)', borderTop: '1px solid rgba(158,106,3,0.25)', fontSize: 11, color: '#d4a72c', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: 'var(--text3)' }}>Routes to:</span>
              {routingHint.map(v => (
                <span key={v.id} style={{ background: 'rgba(158,106,3,0.2)', border: '1px solid rgba(158,106,3,0.3)', padding: '1px 6px', borderRadius: 4, color: '#d4a72c', fontWeight: 500 }}>
                  {v.name}{v.groupId !== activeSelection?.groupId ? <span style={{ opacity: 0.6, fontWeight: 400 }}> · {v.groupName}</span> : ''}
                </span>
              ))}
            </div>
          )}
          {uploadError && <div style={{ padding: '5px 16px', background: 'var(--red-bg)', fontSize: 12, color: '#f85149' }}>{uploadError}</div>}

          {/* Input bar */}
          {activeSelection && (
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', cursor: 'pointer', flexShrink: 0, fontSize: 15 }}>📎</button>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} style={{ display: 'none' }} />
              <textarea ref={inputRef} value={input} onChange={e => { setInput(e.target.value); setRoutingHint(detectVessels(e.target.value)); }} onKeyDown={handleKeyDown}
                placeholder={activeSelection.dmId ? 'Send a direct message...' : 'Type a message... (Enter to send)'}
                rows={1} style={{ flex: 1, padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 20, color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'none', lineHeight: 1.5, maxHeight: 100, fontFamily: 'var(--font)' }}
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; }}
              />
              <button onClick={sendMessage} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 20, color: 'white', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>Send</button>
            </div>
          )}
        </div>

        {/* AI Ops Panel — right column, vessel active */}
        {showEmailTeaser && !isMobile && (
          <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {/* Panel header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Vessel AI Panel</div>
              <span style={{ fontSize: 10, padding: '2px 7px', background: 'rgba(158,106,3,0.15)', border: '1px solid rgba(158,106,3,0.3)', borderRadius: 10, color: '#d4a72c', fontWeight: 600 }}>COMING SOON</span>
            </div>

            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Email summary section */}
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>📧</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Email Summary</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text3)' }}>Last 48 hrs</span>
                </div>
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { icon: '🔔', label: 'NOR tendered', detail: 'Awaiting laytime start confirmation', time: '2h ago', color: '#d4a72c' },
                    { icon: '⚓', label: 'ETA update', detail: 'Master confirms arrival 14:00 LT', time: '5h ago', color: '#58a6ff' },
                    { icon: '⛽', label: 'Bunker enquiry', detail: 'Reply from ING bunkers pending', time: '8h ago', color: '#3fb950' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 8px', background: 'var(--bg2)', borderRadius: 6, border: '1px solid var(--border)', opacity: 0.6 }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: item.color }}>{item.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.detail}</div>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0, alignSelf: 'flex-start', marginTop: 1 }}>{item.time}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: '4px 0' }}>Connect Gmail or Outlook to see real data</div>
                </div>
              </div>

              {/* Voyage status */}
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>🗺️</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Voyage Status</span>
                </div>
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, opacity: 0.6 }}>
                  {[
                    { label: 'Status', value: 'At Load Port', color: '#3fb950' },
                    { label: 'ETA', value: '26 Apr 14:00 LT', color: 'var(--text)' },
                    { label: 'Cargo', value: 'Iron Ore — 62,500 MT', color: 'var(--text)' },
                    { label: 'Charterer', value: '—', color: 'var(--text3)' },
                    { label: 'Laytime', value: 'Not started', color: '#d4a72c' },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{r.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: r.color }}>{r.value}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', paddingTop: 4 }}>Connect voyage system to see live data</div>
                </div>
              </div>

              {/* Action items */}
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>✅</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>AI Action Items</span>
                </div>
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, opacity: 0.6 }}>
                  {[
                    { done: false, text: 'Confirm stowage plan with master' },
                    { done: false, text: 'Chase bunker stem confirmation' },
                    { done: true,  text: 'NOR sent to charterers' },
                    { done: false, text: 'Submit port disbursement estimate' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${item.done ? '#3fb950' : 'var(--border2)'}`, background: item.done ? 'rgba(26,127,75,0.2)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, fontSize: 9, color: '#3fb950' }}>{item.done ? '✓' : ''}</div>
                      <span style={{ fontSize: 11, color: item.done ? 'var(--text3)' : 'var(--text2)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', paddingTop: 4 }}>AI extracts action items from emails automatically</div>
                </div>
              </div>

              {/* Connect CTA */}
              <div style={{ padding: '12px', background: 'rgba(158,106,3,0.08)', border: '1px solid rgba(158,106,3,0.2)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#d4a72c', fontWeight: 500, marginBottom: 6 }}>🚀 Plugin your email to activate</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>Gmail & Outlook integration coming soon. All data shown above will be live and vessel-specific.</div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Create group modal */}
      {showCreateGroup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)', width: 380, padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Create new group</div>
            <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} required placeholder="e.g. Blue Ocean Shipping" style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setShowCreateGroup(false)} style={{ flex: 1, padding: 10, background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text2)', fontSize: 13 }}>Cancel</button>
                <button type="submit" style={{ flex: 2, padding: 10, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'white', fontSize: 13, fontWeight: 500 }}>Create group</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAdmin && adminGroupId && (
        <GroupAdmin groupId={adminGroupId} groupName={adminGroupName} onClose={() => { setShowAdmin(false); setAdminGroupId(null); }} />
      )}
    </div>
  );
}
