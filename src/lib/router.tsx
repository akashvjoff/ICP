import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface RouterContextType {
  path: string;
  navigate: (to: string) => void;
  params: Record<string, string>;
}

const RouterContext = createContext<RouterContextType>({
  path: '/',
  navigate: () => {},
  params: {},
});

export const useRouter = () => useContext(RouterContext);

interface RouterProps {
  children: ReactNode;
}

export const Router: React.FC<RouterProps> = ({ children }) => {
  const [path, setPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string) => {
    if (to !== window.location.pathname) {
      window.history.pushState({}, '', to);
      setPath(to);
      window.scrollTo(0, 0);
    }
  };

  return (
    <RouterContext.Provider value={{ path, navigate, params: {} }}>
      {children}
    </RouterContext.Provider>
  );
};

// Route matching utility
export function matchRoute(
  currentPath: string,
  routePattern: string
): { matches: boolean; params: Record<string, string> } {
  const currentSegments = currentPath.split('/').filter(Boolean);
  const patternSegments = routePattern.split('/').filter(Boolean);

  if (currentSegments.length !== patternSegments.length) {
    return { matches: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternSegments.length; i++) {
    const patternSeg = patternSegments[i];
    const currentSeg = currentSegments[i];

    if (patternSeg.startsWith(':')) {
      const paramName = patternSeg.slice(1);
      params[paramName] = decodeURIComponent(currentSeg);
    } else if (patternSeg !== currentSeg) {
      return { matches: false, params: {} };
    }
  }

  return { matches: true, params };
}

interface RouteProps {
  pattern: string;
  component: React.ComponentType<{ params: Record<string, string> }>;
}

export const Route: React.FC<RouteProps> = ({ pattern, component: Component }) => {
  const { path } = useRouter();
  const { matches, params } = matchRoute(path, pattern);

  if (!matches) return null;
  return <Component params={params} />;
};
