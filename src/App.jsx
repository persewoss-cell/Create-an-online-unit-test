import { Routes, Route, Navigate } from 'react-router-dom';
import { firebaseReady } from './firebase.js';
import { TeacherProvider, RequireTeacher } from './components/TeacherAuth.jsx';
import TeacherAlerts from './components/TeacherAlerts.jsx';
import SetupGuide from './components/SetupGuide.jsx';
import Home from './pages/Home.jsx';
import Manual from './pages/Manual.jsx';
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
      <TeacherAlerts />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/manual" element={<Manual />} />
        <Route path="/exams" element={<ExamList />} />
        <Route path="/exam/:id" element={<TakeExam key="take" />} />
        <Route path="/exam/:id/result" element={<Result />} />
        <Route path="/exam/:id/retake" element={<TakeExam retake key="retake" />} />
        <Route path="/admin" element={<TeacherLogin />} />
        <Route path="/teacher" element={<Navigate to="/?tab=teacher" replace />} />
        <Route path="/teacher/dashboard" element={<RequireTeacher><Dashboard /></RequireTeacher>} />
        <Route path="/teacher/admin" element={<RequireTeacher><Dashboard adminRoute /></RequireTeacher>} />
        <Route path="/teacher/new" element={<RequireTeacher><ExamCreate /></RequireTeacher>} />
        <Route path="/teacher/exam/:id" element={<RequireTeacher><ExamDetail /></RequireTeacher>} />
        <Route path="/teacher/students" element={<RequireTeacher><Roster /></RequireTeacher>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </TeacherProvider>
  );
}
