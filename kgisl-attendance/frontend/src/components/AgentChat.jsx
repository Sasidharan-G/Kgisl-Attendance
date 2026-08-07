import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, User, ShieldAlert, CheckCircle2, ArrowRight, RefreshCw, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

export default function AgentChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const role = user?.role || 'STUDENT';

  const [messages, setMessages] = useState(() => [
    {
      sender: 'agent',
      text: role === 'ADMIN'
        ? `Hello ${user?.name || 'Admin'}! I'm Genius Admin Copilot. I have full database access to monitor college attendance, defaulters, and system health.`
        : role === 'FACULTY'
        ? `Hello ${user?.name || 'Faculty'}! I'm Genius Faculty Agent. I can assist with today's live classes, student shortage lists (< 75%), and attendance reports.`
        : `Hello ${user?.name || 'Student'}! I'm Genius Academic Copilot. I can calculate your safe classes to miss, check Block Test dates, or track leave status.`,
    },
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const quickPrompts = role === 'ADMIN'
    ? ['System Health & Stats', 'Show Shortage Defaulters (< 75%)', 'Manage Academic Setup']
    : role === 'FACULTY'
    ? ['Who is absent today?', 'Show Defaulters (< 75%)', 'Today\'s Timetable']
    : ['My Attendance %', 'Safe Bunk Calculator', 'Upcoming Block Tests', 'Apply Leave / OD'];

  const processRoleAwareResponse = (query) => {
    const q = query.toLowerCase();

    // ---------------- STUDENT ROLE INTENTS ----------------
    if (role === 'STUDENT') {
      if (q.includes('attendance') || q.includes('pct') || q.includes('%')) {
        return {
          text: `📊 **Your Attendance Overview:**\n• Overall Attendance: **78%** (Safe >= 75%)\n• AIML: 82% | PHP: 71% (Shortage Warning)\n• Total Sessions Attended: 34 / 40`,
          action: { label: 'View Full Attendance Details', path: '/student/attendance' },
        };
      }
      if (q.includes('safe') || q.includes('skip') || q.includes('bunk') || q.includes('calculator')) {
        return {
          text: `💡 **Safe Bunk Calculation:**\n• In **AIML**, you can safely skip **2 classes** and stay above 75%.\n• In **PHP (71%)**, you MUST attend the next **3 consecutive classes** to reach 75%.`,
          action: { label: 'Open Calculator Widget', path: '/student/dashboard' },
        };
      }
      if (q.includes('test') || q.includes('exam') || q.includes('block') || q.includes('timetable')) {
        return {
          text: `📝 **Upcoming Block Test Timetable:**\n1. **AIML**: Aug 24 (Mon) · 09:30 AM (MCA Lab)\n2. **PHP**: Aug 25 (Tue) · 09:30 AM (Exam Hall 2)\n3. **OSC**: Aug 26 (Wed) · 09:30 AM (Exam Hall 2)`,
          action: { label: 'View Academic Calendar', path: '/student/calendar' },
        };
      }
      if (q.includes('leave') || q.includes('od') || q.includes('apply')) {
        return {
          text: `📄 **Leave / On-Duty Request Portal:**\nYou can submit Medical Leave or On-Duty (OD) certificates directly to your faculty mentor.`,
          action: { label: 'Apply Leave / OD Now', path: '/student/leave' },
        };
      }
    }

    // ---------------- FACULTY ROLE INTENTS ----------------
    if (role === 'FACULTY') {
      if (q.includes('absent') || q.includes('today') || q.includes('active')) {
        return {
          text: `🔴 **Today's Active Class Status (Period 2 · PHP):**\n• Present: **36 Students**\n• Absent: **4 Students** (Aadhiran M, Karthik S, Pooja S, Rahul V)\n• QR Session: Active in Hall 204.`,
          action: { label: 'Open Faculty Dashboard', path: '/faculty/dashboard' },
        };
      }
      if (q.includes('defaulter') || q.includes('shortage') || q.includes('75')) {
        return {
          text: `⚠️ **Shortage Defaulters List (< 75% Criteria):**\n1. SASIDHARAN G R (48%)\n2. Karthik S (55%)\n3. Dinesh Kumar P (65%)\n4. Pooja S (70%)`,
          action: { label: 'Export Official A4 PDF Report', path: '/faculty/analytics' },
        };
      }
      if (q.includes('timetable') || q.includes('schedule') || q.includes('period')) {
        return {
          text: `⏰ **Your Today's Timetable:**\n• Period 1 (09:10 AM): AIML Lab (MCA Lab)\n• Period 2 (10:10 AM): PHP (Hall 204)\n• Period 4 (01:40 PM): NSC (MCA Lab 2)`,
          action: { label: 'Manage Timetable', path: '/faculty/timetable' },
        };
      }
    }

    // ---------------- ADMIN ROLE INTENTS ----------------
    if (role === 'ADMIN') {
      if (q.includes('system') || q.includes('health') || q.includes('stat')) {
        return {
          text: `🛡️ **System Health & DB Insights:**\n• Database: Connected (PostgreSQL)\n• Enrolled Students: **120 Students**\n• Active Faculty: **14 Members**\n• Daily QR Sessions: **18 Sessions Completed**`,
          action: { label: 'Open System Analytics', path: '/admin/analytics' },
        };
      }
      if (q.includes('defaulter') || q.includes('shortage') || q.includes('list')) {
        return {
          text: `📋 **Department Shortage Overview:**\nAcross MCA-C & MCA-A batches, **12 students** are currently below 75% attendance criteria.`,
          action: { label: 'Export Official Defaulter PDF', path: '/admin/analytics' },
        };
      }
      if (q.includes('setup') || q.includes('academic') || q.includes('batch')) {
        return {
          text: `⚙️ **Academic Setup & Catalog:**\nYou can add batches, assign faculty mentors, and configure subjects.`,
          action: { label: 'Academic Setup Portal', path: '/admin/academic' },
        };
      }
    }

    // Default Fallback Response
    return {
      text: `I'm authorized as **${role} Agent**. I can help you with data analytics, timetable lookup, shortage lists, or task automation. Try choosing a quick query below!`,
    };
  };

  const handleSend = (textToSend) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    setMessages((prev) => [...prev, { sender: 'user', text: query }]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const response = processRoleAwareResponse(query);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: response.text,
          action: response.action,
        },
      ]);
      setIsTyping(false);
    }, 600);
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`fixed bottom-6 right-6 z-[999] flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-2xl shadow-blue-900/50 transition-all duration-300 hover:scale-105 active:scale-95 ${
          isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        }`}
        aria-label="Open Genius AI Copilot"
        title="Genius AI Copilot"
      >
        <Bot size={26} />
        <span className="absolute -right-1 -top-1 flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500" />
        </span>
      </button>

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-[9999] flex h-[530px] max-h-[85vh] w-[360px] sm:w-[410px] flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  Genius AI Copilot
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[9px] font-bold text-blue-300 border border-blue-500/30">
                    {role}
                  </span>
                </h3>
                <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Role-Aware Active Agent
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white font-semibold rounded-tr-none'
                      : 'bg-slate-950/80 border border-slate-800 text-slate-200 rounded-tl-none shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Optional Action Button */}
                  {msg.action && (
                    <button
                      onClick={() => {
                        navigate(msg.action.path);
                        setIsOpen(false);
                      }}
                      className="mt-3 flex w-full items-center justify-between rounded-xl bg-blue-600/30 border border-blue-500/50 px-3 py-2 text-xs font-bold text-blue-200 hover:bg-blue-600 hover:text-white transition"
                    >
                      <span>{msg.action.label}</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-none border border-slate-800 bg-slate-950 p-3 flex gap-1.5 items-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" />
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]" />
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="border-t border-slate-800/80 bg-slate-950/40 p-2 overflow-x-auto flex gap-1.5 no-scrollbar">
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:border-blue-500 hover:text-white transition"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Form Input */}
          <div className="p-3 border-t border-slate-800 bg-slate-950">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask ${role.toLowerCase()} agent...`}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-500 transition shrink-0"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
