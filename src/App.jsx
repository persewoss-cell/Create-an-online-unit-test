import { Routes, Route, Navigate } from 'react-router-dom';
import { firebaseReady } from './firebase.js';
import { TeacherProvider, RequireTeacher } from './components/TeacherAuth.jsx';
import SetupGuide from './components/SetupGuide.jsx';
import StudentLogin from './pages/student/StudentLogin.jsx';
import ExamList from './pages/student/ExamList.jsx';
import TakeExam from './pages/student/TakeExam.jsx';
import Result from './pages/student/Result.jsx';
import TeacherLogin from './pages/teacher/TeacherLogin.jsx';
import Dashboard from './pages/teacher/Dashboard.jsx';
import ExamCreate from './pages/teacher/ExamCreate.jsx';
import ExamDetail from './pages/teacher/ExamDetail.jsx';
import Roster from './pages/teacher/Roster.jsx';

export default function App() {
  if (!firebaseReady) return <SetupGuide />;
  return (
    <TeacherProvider>
      <Routes>
        <Route path="/" element={<StudentLogin />} />
        <Route path="/exams" element={<ExamList />} />
        <Route path="/exam/:id" element={<TakeExam />} />
        <Route path="/exam/:id/result" element={<Result />} />
        <Route path="/teacher" element={<TeacherLogin />} />
        <Route path="/teacher/dashboard" element={<RequireTeacher><Dashboard /></RequireTeacher>} />
        <Route path="/teacher/new" element={<RequireTeacher><ExamCreate /></RequireTeacher>} />
        <Route path="/teacher/exam/:id" element={<RequireTeacher><ExamDetail /></RequireTeacher>} />
        <Route path="/teacher/students" element={<RequireTeacher><Roster /></RequireTeacher>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </TeacherProvider>
  );
}
