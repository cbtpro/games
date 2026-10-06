import { Link, useLocation } from 'react-router-dom';

export interface NotFoundPageProps {
  title?: string;
  message?: string;
}

/** 兜底页：路由未命中，或目标资源不存在 */
export function NotFoundPage(props: NotFoundPageProps): JSX.Element {
  const { title = '页面走丢了', message = '这个地址没有对应的页面，也许是链接过期或输入有误。' } =
    props;
  const location = useLocation();

  return (
    <section className="notfound">
      <div className="notfound__code">404</div>
      <h1>{title}</h1>
      <p>{message}</p>
      <p>
        <code className="notfound__path">{location.pathname}</code>
      </p>
      <div className="notfound__actions">
        <Link className="btn btn--primary" to="/">
          回到游戏库
        </Link>
      </div>
    </section>
  );
}
