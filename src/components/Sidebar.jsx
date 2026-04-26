import { useState, useRef, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { initials, avatarColor } from '../lib/utils';

export default function Sidebar({ groups, activeSelection, onSelect, getUnreadCount, isMobile, isOpen, onClose, onCreateGroup, allUsers, onAdminGroup, memberRoles }) {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [width, setWidth] = useState(240);
  const [collapsed, setCollapsed] = useState(() => { const init = {}; return init; });
  const [initialised, setInitialised] = useState(false);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  function onMouseDown(e) {
    dragging.current = true; startX.current = e.clientX; startW.current = width;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
  function onMouseMove(e) {
    if (!dragging.current) return;
    setWidth(Math.max(180, Math.min(380, startW.current + (e.clientX - startX.current))));
  }
  function onMouseUp() {
    dragging.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  // Collapse all groups on first load
  useEffect(() => {
    if (!initialised && groups.length > 0) {
      const init = {};
      groups.forEach(g => { init[g.id] = true; });
      setCollapsed(init);
      setInitialised(true);
    }
  }, [groups]);

  // Need useEffect import
  function toggleCollapse(groupId) {
    setCollapsed(s => ({ ...s, [groupId]: !s[groupId] }));
  }

  const pc = avatarColor(profile?.name);

  const NavBtn = ({ id, label, icon, count, indent = false }) => {
    const active = activeSelection?.id === id;
    return (
      <button onClick={() => { onSelect({ id, type: activeSelection?.type }); if (isMobile) onClose(); }} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `6px ${indent ? '12px' : '10px'}`, paddingLeft: indent ? 28 : 10,
        margin: '1px 4px', borderRadius: 6, width: 'calc(100% - 8px)',
        background: active ? 'rgba(29,111,164,0.2)' : 'none',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        color: active ? '#58a6ff' : 'var(--text2)',
      }}>
        <span style={{ fontSize: 12, fontWeight: active ? 500 : 400, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ flexShrink: 0 }}>{icon}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        </span>
        {count > 0 && <span style={{ background: 'var(--accent)', color: 'white', fontSize: 10, fontWeight: 600, borderRadius: 10, padding: '1px 5px', flexShrink: 0 }}>{count}</span>}
      </button>
    );
  };

  const sidebarContent = (
    <div style={{ width: isMobile ? 260 : width, background: 'var(--bg2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent-light)', letterSpacing: '0.15em', fontWeight: 500 }}>VESSELCHATS</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div title={`${profile?.name} — click to sign out`} onClick={() => { if (window.confirm('Sign out?')) signOut(auth); }} style={{ width: 24, height: 24, borderRadius: '50%', background: pc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: pc.color, cursor: 'pointer', flexShrink: 0 }}>
            {initials(profile?.name || '')}
          </div>
          {isMobile && <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 16, cursor: 'pointer' }}>✕</button>}
        </div>
      </div>

      {/* DMs section */}
      <div style={{ padding: '6px 0 2px' }}>
        <button onClick={() => { onSelect({ type: 'dms', id: 'dms' }); if (isMobile) onClose(); }} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', margin: '1px 4px', borderRadius: 6, width: 'calc(100% - 8px)',
          background: activeSelection?.type === 'dms' && activeSelection?.id === 'dms' ? 'rgba(29,111,164,0.2)' : 'none',
          border: 'none', cursor: 'pointer', color: activeSelection?.type === 'dms' && activeSelection?.id === 'dms' ? '#58a6ff' : 'var(--text2)',
        }}>
          <span style={{ fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>💬 Direct Messages</span>
          {getUnreadCount('dms_total') > 0 && <span style={{ background: 'var(--accent)', color: 'white', fontSize: 10, borderRadius: 10, padding: '1px 5px' }}>{getUnreadCount('dms_total')}</span>}
        </button>

        {/* DM contacts */}
        {activeSelection?.type === 'dms' && allUsers && Object.entries(allUsers).map(([uid, u]) => {
          if (uid === profile?.id) return null;
          const dmId = [profile?.id, uid].sort().join('_');
          const u2 = getUnreadCount('dm_' + dmId);
          const uc = avatarColor(u.name);
          const active = activeSelection?.dmUserId === uid;
          return (
            <button key={uid} onClick={() => { onSelect({ type: 'dms', id: 'dms', dmUserId: uid, dmId }); if (isMobile) onClose(); }} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px 5px 26px', margin: '1px 4px', borderRadius: 6, width: 'calc(100% - 8px)',
              background: active ? 'rgba(29,111,164,0.15)' : 'none', border: 'none', cursor: 'pointer',
            }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: uc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color: uc.color, flexShrink: 0 }}>{initials(u.name)}</div>
              <span style={{ fontSize: 12, color: active ? '#58a6ff' : u2 > 0 ? 'var(--text)' : 'var(--text2)', fontWeight: u2 > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{u.name}</span>
              {u2 > 0 && <span style={{ background: 'var(--accent)', color: 'white', fontSize: 10, borderRadius: 10, padding: '1px 5px', flexShrink: 0 }}>{u2}</span>}
            </button>
          );
        })}
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '4px 10px' }} />

      {/* Groups */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {groups.map(group => {
          const isCollapsed = collapsed[group.id];
          const filteredVessels = (group.vessels || []).filter(v => !search || v.name.toLowerCase().includes(search.toLowerCase()));
          const groupUnread = (group.vessels || []).reduce((sum, v) => sum + getUnreadCount(group.id + '_' + v.id), 0)
            + getUnreadCount(group.id + '_common') + getUnreadCount(group.id + '_mentions');

          return (
            <div key={group.id} style={{ marginBottom: 4 }}>
              {/* Group header */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '2px 10px 2px 4px' }}>
                <button onClick={() => toggleCollapse(group.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0,
                  background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)', transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', flexShrink: 0, display: 'inline-block' }}>▾</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: groupUnread > 0 ? 'var(--text)' : 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</span>
                  {groupUnread > 0 && <span style={{ background: '#d4a72c', color: '#0d1117', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 6px', flexShrink: 0 }}>{groupUnread}</span>}
                </button>
                {memberRoles?.[group.id] === 'admin' && (
                  <button onClick={() => onAdminGroup && onAdminGroup(group.id, group.name)} title="Manage group" style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
                    fontSize: 13, padding: '2px 4px', borderRadius: 4, flexShrink: 0,
                    lineHeight: 1
                  }} onMouseEnter={e => e.currentTarget.style.color='var(--text)'} onMouseLeave={e => e.currentTarget.style.color='var(--text3)'}>
                    ⚙️
                  </button>
                )}
              </div>

              {!isCollapsed && (
                <div>
                  <NavBtn id={group.id + '_all'} label="All messages" icon="📋" count={0} indent />
                  <NavBtn id={group.id + '_common'} label="Common" icon="💬" count={getUnreadCount(group.id + '_common')} indent />
                  <NavBtn id={group.id + '_mentions'} label="Mentions" icon="@" count={getUnreadCount(group.id + '_mentions')} indent />

                  {filteredVessels.length > 0 && (
                    <div style={{ margin: '4px 10px 2px 26px', fontSize: 10, color: 'var(--text3)', letterSpacing: '0.05em' }}>VESSELS</div>
                  )}
                  {filteredVessels.map(v => {
                    const vUnread = getUnreadCount(group.id + '_' + v.id);
                    const active = activeSelection?.id === group.id + '_' + v.id;
                    const vc = avatarColor(v.name);
                    return (
                      <button key={v.id} onClick={() => { onSelect({ type: 'vessel', id: group.id + '_' + v.id, groupId: group.id, vesselId: v.id }); if (isMobile) onClose(); }} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px 5px 28px', margin: '1px 4px', borderRadius: 6, width: 'calc(100% - 8px)',
                        background: active ? 'rgba(29,111,164,0.2)' : 'none', border: 'none', cursor: 'pointer',
                      }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: vc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color: vc.color, flexShrink: 0 }}>{initials(v.name)}</div>
                        <span style={{ fontSize: 12, color: active ? '#58a6ff' : vUnread > 0 ? 'var(--text)' : 'var(--text2)', fontWeight: vUnread > 0 ? 600 : active ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{v.name}</span>
                        {vUnread > 0 && <span style={{ background: 'var(--accent)', color: 'white', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 5px', flexShrink: 0, minWidth: 18, textAlign: 'center' }}>{vUnread}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Search (shown when multiple vessels exist) */}
        {groups.some(g => (g.vessels || []).length > 3) && (
          <div style={{ padding: '6px 8px 2px' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vessels..."
              style={{ width: '100%', padding: '5px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 11, outline: 'none' }} />
          </div>
        )}

        {/* Create group */}
        <button onClick={onCreateGroup} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', margin: '8px 4px 4px', borderRadius: 6, width: 'calc(100% - 8px)', background: 'none', border: '1px dashed var(--border2)', cursor: 'pointer', color: 'var(--text3)', fontSize: 12 }}>
          <span>+</span> Create new group
        </button>
      </div>
    </div>
  );

  if (isMobile) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: isOpen ? 'flex' : 'none' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>{sidebarContent}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexShrink: 0, height: '100%' }}>
      {sidebarContent}
      <div onMouseDown={onMouseDown} style={{ width: 4, cursor: 'col-resize', background: 'transparent', flexShrink: 0 }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(29,111,164,0.4)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
    </div>
  );
}
