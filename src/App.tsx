import { useCallback, useEffect, useState } from 'react';
import { findPostByPath } from './content/registry';
import { HomePage } from './pages/HomePage';
import { PostPage } from './pages/PostPage';

export function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((route: string) => {
    if (route === window.location.pathname) return;
    window.history.pushState({}, '', route);
    setPathname(route);
  }, []);

  const post = findPostByPath(pathname);
  if (post) {
    return <PostPage post={post} onNavigate={navigate} />;
  }

  return <HomePage onNavigate={navigate} />;
}

export default App;
