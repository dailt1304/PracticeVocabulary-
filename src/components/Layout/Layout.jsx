import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { motion } from 'framer-motion';
import {
  FiHome,
  FiFolder,
  FiBarChart2,
  FiAward,
  FiLogOut,
} from 'react-icons/fi';
import './Layout.css';

const Layout = ({ children }) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', icon: <FiHome />, label: 'Trang chủ' },
    { to: '/topics', icon: <FiFolder />, label: 'Chủ đề' },
    { to: '/progress', icon: <FiBarChart2 />, label: 'Thống kê' },
    { to: '/achievements', icon: <FiAward />, label: 'Huy hiệu' },
  ];

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">📘</div>
          <h2>TOEIC Vocab</h2>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {profile?.display_name?.charAt(0)?.toUpperCase() || 'L'}
            </div>
            <div className="user-details">
              <span className="user-name">{profile?.display_name || 'Learner'}</span>
              <span className="user-xp">⭐ {profile?.total_xp || 0} XP</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleSignOut} title="Đăng xuất">
            <FiLogOut />
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `mobile-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <span className="mobile-nav-icon">{item.icon}</span>
            <span className="mobile-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Main content */}
      <main className="main-content">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
};

export default Layout;
