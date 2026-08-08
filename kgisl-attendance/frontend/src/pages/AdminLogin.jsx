import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginAdmin, loginFaculty } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthComponent } from '../components/ui/sign-up.jsx';
import ForgotPasswordModal from '../components/ForgotPasswordModal.jsx';
import { ShieldCheck, UserCheck } from 'lucide-react';

const AdminLogo = () => (
  <div className="bg-blue-600 text-white rounded-lg p-1.5 shadow-lg shadow-blue-950/50">
    <ShieldCheck className="h-5 w-5" />
  </div>
);

const FacultyLogo = () => (
  <div className="bg-indigo-600 text-white rounded-lg p-1.5 shadow-lg shadow-indigo-950/50">
    <UserCheck className="h-5 w-5" />
  </div>
);

export default function AdminLogin({ portal = 'ADMIN' }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showForgot, setShowForgot] = useState(false);

  const handleAuthSubmit = async (email, password) => {
    const res = portal === 'ADMIN' ? await loginAdmin(email, password) : await loginFaculty(email, password);
    login(res.token, res.refreshToken, res.user);
    setTimeout(() => {
      navigate(portal === 'ADMIN' ? '/admin/timetable' : '/faculty/dashboard');
    }, 1800);
  };

  return (
    <div className="relative">
      <AuthComponent
        logo={portal === 'ADMIN' ? <AdminLogo /> : <FacultyLogo />}
        brandName={portal === 'ADMIN' ? 'KGiSL Admin Portal' : 'KGiSL Faculty Portal'}
        onLoginSubmit={handleAuthSubmit}
      />
      {showForgot && <ForgotPasswordModal role={portal} onClose={() => setShowForgot(false)} />}
    </div>
  );
}
