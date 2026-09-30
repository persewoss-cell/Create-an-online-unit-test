import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { watchAuth, getTeacher, isAdminUser } from '../lib/db.js';
import Loading from './Loading.jsx';

// teacher: 로그인한 사람(관리자 또는 선생님)
// owner:   지금 보고 있는 방의 주인. 선생님은 자기 자신, 관리자가 선생님 방에 들어가면 그 선생님
const Ctx = createContext({ teacher: null, owner: null, isAdmin: false, loading: true, setTeacher: () => {}, viewAs: () => {} });
const VIEW_KEY = 'admin-view-as';

function readView() {
  try {
    return sessionStorage.getItem(VIEW_KEY);
  } catch {
    return null;
  }
}

export function TeacherProvider({ children }) {
  const [teacher, setTeacher] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      watchAuth(async (user) => {
        if (!user || user.isAnonymous) {
          setTeacher(null);
          setIsAdmin(false);
          setViewing(null);
        } else {
          try {
            const admin = isAdminUser(user);
            setIsAdmin(admin);
            setTeacher(await getTeacher(user.uid));
            const uid = admin ? readView() : null;
            setViewing(uid ? await getTeacher(uid) : null);
          } catch {
            setTeacher(null);
          }
        }
        setLoading(false);
      }),
    [],
  );

  /** 관리자: 선생님 방에 들어가기(t) / 관리자 화면으로 돌아가기(null) */
  const viewAs = useCallback((t) => {
    try {
      if (t) sessionStorage.setItem(VIEW_KEY, t.uid);
      else sessionStorage.removeItem(VIEW_KEY);
    } catch {
      /* 저장 불가 환경은 무시 */
    }
    setViewing(t);
  }, []);

  const set = useCallback((t) => {
    setTeacher(t);
    setIsAdmin(isAdminUser());
    if (!t) setViewing(null);
  }, []);

  const owner = isAdmin && viewing ? viewing : teacher;
  return (
    <Ctx.Provider value={{ teacher, owner, isAdmin, viewing: isAdmin ? viewing : null, loading, setTeacher: set, viewAs }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTeacher() {
  return useContext(Ctx);
}

export function RequireTeacher({ children }) {
  const { teacher, loading } = useTeacher();
  if (loading) return <Loading />;
  if (!teacher) return <Navigate to="/?tab=teacher" replace />;
  return children;
}
