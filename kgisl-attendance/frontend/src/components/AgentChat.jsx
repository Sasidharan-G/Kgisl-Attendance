import React, { useState, useRef, useEffect } from 'react';
import { sendAgentMessage } from '../services/api';

export default function AgentChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'agent', text: "Hello! I'm Genius, your Faculty Assistant. How can I help you today?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (messageText) => {
    const textToSend = messageText || input;
    if (!textToSend.trim()) return;

    setMessages(prev => [...prev, { sender: 'user', text: textToSend }]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await sendAgentMessage(textToSend);
      setMessages(prev => [...prev, { sender: 'agent', text: response.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { sender: 'agent', text: "Sorry, I couldn't reach the server right now." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const quickPrompts = [
    "Today's Attendance",
    "Show active sessions",
    "Who is absent today?"
  ];

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 p-4 rounded-full bg-[#625CA8] hover:bg-[#7771BD] text-white shadow-glow transition-transform duration-300 ${isOpen ? 'scale-0' : 'scale-100'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[350px] md:w-[400px] h-[500px] max-h-[80vh] flex flex-col rounded-2xl bg-[#1E1B4B]/95 backdrop-blur-xl border border-[#484575] shadow-2xl overflow-hidden animate-[slideUp_0.3s_ease-out]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#484575] bg-[#302D68]/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#625CA8]/20 flex items-center justify-center border border-[#625CA8]/30">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Genius</h3>
                <p className="text-xs text-[#3FA37C] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#3FA37C] animate-pulse"></span> Online
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 text-[#B4B2C7] hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3 text-sm whitespace-pre-wrap ${msg.sender === 'user' ? 'bg-[#625CA8] text-white rounded-tr-none' : 'bg-[#302D68] border border-[#484575] text-[#F5F5F7] rounded-tl-none'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-[#302D68] border border-[#484575] rounded-2xl rounded-tl-none p-3 flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#B4B2C7] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#B4B2C7] animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#B4B2C7] animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto custom-scrollbar no-scrollbar py-2">
            {quickPrompts.map((prompt, i) => (
              <button 
                key={i} 
                onClick={() => handleSend(prompt)}
                className="whitespace-nowrap px-3 py-1.5 rounded-full border border-[#484575] bg-[#302D68]/50 text-xs text-[#B4B2C7] hover:text-white hover:bg-[#625CA8]/20 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-[#484575] bg-[#302D68]/30">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-center gap-2"
            >
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1 bg-[#272465]/50 border border-[#484575] rounded-full px-4 py-2.5 text-sm text-white placeholder-[#B4B2C7] focus:outline-none focus:border-[#625CA8] transition-colors"
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isTyping}
                className="p-2.5 rounded-full bg-[#625CA8] text-white disabled:opacity-50 hover:bg-[#7771BD] transition-colors flex-shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
              </button>
            </form>
          </div>
        </div>
      )}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #484575; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}
