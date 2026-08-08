import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginStudent } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthComponent } from '../components/ui/sign-up.jsx';
import ForgotPasswordModal from '../components/ForgotPasswordModal.jsx';
import GoogleSignIn from '../components/GoogleSignIn.jsx';
import { GraduationCap } from 'lucide-react';

const StudentLogo = () => (
  <div className="bg-emerald-600 text-white rounded-lg p-1.5 shadow-lg shadow-emerald-950/50">
    <GraduationCap className="h-5 w-5" />
  </div>
);

export default function StudentLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showForgot, setShowForgot] = useState(false);

  const handleStudentAuth = async (email, password) => {
    const { token, refreshToken, user } = await loginStudent(email, password);
    login(token, refreshToken, user);
    setTimeout(() => {
      navigate('/student/dashboard');
    }, 1800);
  };

  return (
    <div className="relative">
      <AuthComponent
        logo={<StudentLogo />}
        brandName="KGiSL Student Portal"
        onLoginSubmit={handleStudentAuth}
      />
      {showForgot && <ForgotPasswordModal role="STUDENT" onClose={() => setShowForgot(false)} />}
    </div>
  );
}
