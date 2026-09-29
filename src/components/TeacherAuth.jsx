import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { watchAuth, getTeacher } from '../lib/db.js';
import Loading from './Loading.jsx';

const Ctx = createContext({ teacher: null, loading: true, setTeacher: () => {} });

export function TeacherProvider({ children }) {
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      watchAuth(async (user) => {
        if (!user || user.isAnonymous) {
          setTeacher(null);
        } else {
          try {
            setTeacher(await getTeacher(user.uid));
          } catch {
            setTeacher(null);
          }
        }
        setLoading(false);
      }),
    [],
  );
  return <Ctx.Provider value={{ teacher, loading, setTeacher }}>{children}</Ctx.Provider>;
}

export function useTeacher() {
  return useContext(Ctx);
}

export function RequireTeacher({ children }) {
  const { teacher, loading } = useTeacher();
  if (loading) return <Loading />;
  if (!teacher) return <Navigate to="/teacher" replace />;
  return children;
}
