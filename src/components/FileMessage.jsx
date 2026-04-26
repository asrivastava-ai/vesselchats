export default function FileMessage({ file, isMe }) {
  const isImage = file.type && file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf';
  const isWord = file.name?.match(/\.(doc|docx)$/i);
  const isExcel = file.name?.match(/\.(xls|xlsx)$/i);

  function fileIcon() {
    if (isPdf) return '📄';
    if (isWord) return '📝';
    if (isExcel) return '📊';
    return '📎';
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  if (isImage) return (
    <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', maxWidth: 260 }}>
      <img src={file.url} alt={file.name} style={{ width: '100%', borderRadius: 10, display: 'block', cursor: 'zoom-in', border: '1px solid rgba(255,255,255,0.08)' }} />
      <div style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.5)' : 'var(--text3)', marginTop: 3 }}>{file.name}</div>
    </a>
  );

  return (
    <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: isMe ? 'rgba(0,0,0,0.2)' : 'var(--bg2)', border: `1px solid ${isMe ? 'rgba(255,255,255,0.1)' : 'var(--border2)'}`, minWidth: 180, maxWidth: 260 }}>
        <div style={{ fontSize: 22 }}>{fileIcon()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: isMe ? 'white' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
          <div style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.5)' : 'var(--text3)', marginTop: 2 }}>{formatSize(file.size)} · tap to open</div>
        </div>
      </div>
    </a>
  );
}
