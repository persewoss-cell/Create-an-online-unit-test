export default function Loading({ text = '불러오는 중…' }) {
  return (
    <div className="center muted">
      <span className="spinner" /> {text}
    </div>
  );
}
