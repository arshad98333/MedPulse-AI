import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Stethoscope, 
  Settings, 
  LogOut,
  FileText,
  Activity
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: Users, label: "Patients", path: "/search" },
    { icon: Stethoscope, label: "Consultation", path: "/consultation" },
    { icon: FileText, label: "Reports", path: "/reports" },
  ];

  return (
    <div className="h-screen w-64 bg-slate-900 text-white flex flex-col fixed left-0 top-0 border-r border-slate-800 z-50">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="bg-blue-600 p-2 rounded-lg">
           <Activity size={20} className="text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight">MedPulse AI</span>
      </div>

      <div className="p-6 flex items-center gap-3">
        <img 
          src="https://picsum.photos/100/100" 
          alt="Dr. Profile" 
          className="w-10 h-10 rounded-full border-2 border-blue-500"
        />
        <div>
          <h3 className="text-sm font-semibold">Dr. Usman</h3>
          <p className="text-xs text-slate-400">BAMS Generalist</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
              isActive(item.path) 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}
        
        <div className="mt-8 pt-8 border-t border-slate-800">
           <Link
            to="/settings"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <Settings size={18} />
            Settings
          </Link>
        </div>
      </nav>

      <div className="p-4">
        <button className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors">
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;