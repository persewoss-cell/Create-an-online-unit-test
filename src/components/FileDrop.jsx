import { useRef, useState } from 'react';

/**
 * 파일을 끌어다 놓거나 눌러서 고르는 칸
 * @param {{accept:string, onFile:(file:File)=>void, label:string, hint?:string, file?:File|null, testId?:string}} props
 */
export default function FileDrop({ accept, onFile, label, hint, file, testId, compact }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const exts = accept.split(',').map((a) => a.trim().toLowerCase()).filter((a) => a.startsWith('.'));
  const ok = (f) => !exts.length || exts.some((e) => f.name.toLowerCase().endsWith(e)) || accept.includes(f.type);

  function pick(f) {
    if (!f) return;
    if (!ok(f)) {
      alert(`${exts.join(', ')} 파일만 올릴 수 있어요.`);
      return;
    }
    onFile(f);
  }

  return (
    <div
      className={`filedrop ${over ? 'over' : ''} ${compact ? 'compact' : ''}`}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        pick(e.dataTransfer.files?.[0]);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      data-testid={testId}
    >
      <div className="filedrop-icon">📂</div>
      <div>
        <b>{label}</b>
        <div className="small muted">{file ? `선택됨: ${file.name}` : hint || '여기로 파일을 끌어다 놓거나 눌러서 고르세요'}</div>
      </div>
      <input
        ref={input}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          pick(e.target.files[0]);
          e.target.value = '';
        }}
        aria-label={label}
      />
    </div>
  );
}
