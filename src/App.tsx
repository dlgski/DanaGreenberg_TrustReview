import { ReviewPage } from './routes/ReviewPage';
import { SystemPage } from './routes/SystemPage';
import './App.css';

function App() {
  const path = window.location.pathname;

  return (
    <div className="app">
      <nav className="app__nav" aria-label="Primary">
        <a className="app__brand" href="/">
          Trust Review
        </a>
        <div className="app__nav-links">
          <a href="/" aria-current={path === '/' ? 'page' : undefined}>
            Review
          </a>
          <a href="/system" aria-current={path === '/system' ? 'page' : undefined}>
            System
          </a>
        </div>
      </nav>
      <main>{path === '/system' ? <SystemPage /> : <ReviewPage />}</main>
    </div>
  );
}

export default App;
