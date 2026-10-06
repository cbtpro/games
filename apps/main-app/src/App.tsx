import { Navigate, Route, Routes } from 'react-router-dom';
import { TopBar } from './components/TopBar';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PlayPage } from './pages/PlayPage';

export default function App(): JSX.Element {
  return (
    <div className="shell">
      <TopBar />
      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/play/:gameCode" element={<PlayPage />} />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </main>
    </div>
  );
}
