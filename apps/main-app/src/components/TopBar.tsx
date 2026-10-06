import { Link, NavLink } from 'react-router-dom';

/** 全站顶栏：品牌 + 主导航，任何页面都在这层壳里 */
export function TopBar(): JSX.Element {
  return (
    <header className="topbar">
      <Link to="/" className="topbar__brand">
        <span className="topbar__mark" aria-hidden>
          G
        </span>
        游戏平台
      </Link>

      <nav className="topbar__nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `topbar__link ${isActive ? 'topbar__link--active' : ''}`}
        >
          游戏库
        </NavLink>
        <a
          className="topbar__link"
          href="https://qiankun.umijs.org/"
          target="_blank"
          rel="noreferrer"
        >
          微前端文档
        </a>
      </nav>
    </header>
  );
}
