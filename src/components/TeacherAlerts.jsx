import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeacher } from './TeacherAuth.jsx';
import { useToast } from './Toast.jsx';
import { watchMyExams, watchSubmissionsLive, watchKeysLive } from '../lib/db.js';
import { gradeSubmission } from '../lib/grading.js';
import { retakeState } from '../lib/retake.js';
import { showDesktop } from '../lib/desktopNotify.js';

/**
 * 선생님 화면 어디에 있든(다른 창을 보고 있어도) 학생이 제출하거나 확인할 일이 생기면 알려 준다.
 *  - 이 창을 보고 있으면: 화면 위쪽 알림
 *  - 창을 내렸거나 다른 프로그램을 쓰는 중이면: Windows 바탕화면 알림(켜 둔 경우) + 돌아왔을 때 볼 수 있게 화면 알림
 */
export default function TeacherAlerts() {
  const { teacher, owner } = useTeacher();
  const nav = useNavigate();
  const [toast, notify] = useToast(12000);

  useEffect(() => {
    if (!teacher || !owner) return undefined;
    const perExam = new Map(); // 평가 id → {exam, subs, keys, stop}
    const tell = (exam, text, tab) => {
      const go = () => nav(`/teacher/exam/${exam.id}${tab ? `?tab=${tab}` : ''}`);
      const away = document.visibilityState !== 'visible' || !document.hasFocus();
      if (away) showDesktop(exam.title, text, { tag: `${exam.id}-${text}`, onClick: go });
      notify(`${text} (${exam.title})`, { kind: 'success', sticky: away, action: { label: '보기', onClick: go } });
    };
    const pendingOf = (x, sub) => {
      if (!x.keys) return 0;
      const r = gradeSubmission(x.exam, x.keys, sub);
      return r.reviewCount + retakeState(x.exam, x.keys, sub, r).pending.length;
    };
    const onSubs = (x, list) => {
      const before = x.subs;
      x.subs = list;
      if (!before) return; // 처음 받은 목록은 기준으로만
      for (const sub of list) {
        const old = before.find((s) => s.id === sub.id);
        const who = `${sub.classNo}반 ${sub.number}번 ${sub.name}`;
        if (!old) {
          const review = pendingOf(x, sub);
          tell(x.exam, `${who} 학생이 제출했어요.${review ? ` 확인할 답 ${review}개` : ''}`, review ? 'review' : '');
        } else if ((sub.retakes?.length || 0) > (old.retakes?.length || 0)) {
          const more = pendingOf(x, sub) > pendingOf(x, old);
          tell(x.exam, `${who} 학생이 오답 재응시 답을 냈어요.${more ? ' 선생님 확인이 필요해요.' : ''}`, more ? 'review' : '');
        }
      }
    };
    const stopList = watchMyExams(
      owner.uid,
      (list) => {
        for (const e of list) {
          const known = perExam.get(e.id);
          if (known) {
            known.exam = e;
            continue;
          }
          const x = { exam: e, subs: null, keys: null };
          const quiet = () => {};
          const stops = [
            watchSubmissionsLive(e.id, (subs) => onSubs(x, subs), quiet),
            watchKeysLive(e.id, (keys) => { x.keys = keys; }, quiet),
          ];
          x.stop = () => stops.forEach((f) => f());
          perExam.set(e.id, x);
        }
        for (const [id, x] of perExam) {
          if (!list.some((e) => e.id === id)) {
            x.stop();
            perExam.delete(id);
          }
        }
      },
      () => {},
    );
    return () => {
      stopList();
      perExam.forEach((x) => x.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher?.uid, owner?.uid]);

  return toast;
}
