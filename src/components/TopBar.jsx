import { Link } from 'react-router-dom';

export default function TopBar({ home = '/', children, who }) {
  return (
    <header className="topbar">
      <Link to={home} className="brand">📝 온라인 단원평가</Link>
      <div className="spacer" />
      {who && <span className="who">{who}</span>}
      {children}
    </header>
  );
}
