import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { watchAuth, getTeacher, signupState } from '../lib/db.js';
import Loading from './Loading.jsx';

const Ctx = createContext({ teacher: null, loading: true, setTeacher: () => {} });

export function TeacherProvider({ children }) {
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      watchAuth(async (user) => {
        if (signupState.busy) return; // 가입 화면이 직접 처리
        if (!user || user.isAnonymous) {
          setTeacher(null);
        } else {
          try {
            const t = await getTeacher(user.uid);
            if (!signupState.busy) setTeacher(t);
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
