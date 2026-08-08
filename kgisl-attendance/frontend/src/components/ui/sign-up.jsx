import { cn } from "@/lib/utils";
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useMemo, useCallback, createContext, Children } from "react";
import { cva } from "class-variance-authority";
import { ArrowRight, Mail, Gem, Lock, Eye, EyeOff, ArrowLeft, X, AlertCircle, PartyPopper, Loader } from "lucide-react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import confetti from "canvas-confetti";

// --- CONFETTI LOGIC ---
const ConfettiContext = createContext({});

const Confetti = forwardRef((props, ref) => {
  const { options, globalOptions = { resize: true, useWorker: true }, manualstart = false, ...rest } = props;
  const instanceRef = useRef(null);
  const canvasRef = useCallback((node) => {
    if (node !== null) {
      if (instanceRef.current) return;
      instanceRef.current = confetti.create(node, { ...globalOptions, resize: true });
    } else {
      if (instanceRef.current) {
        instanceRef.current.reset();
        instanceRef.current = null;
      }
    }
  }, [globalOptions]);

  const fire = useCallback((opts = {}) => instanceRef.current?.({ ...options, ...opts }), [options]);
  const api = useMemo(() => ({ fire }), [fire]);
  useImperativeHandle(ref, () => api, [api]);
  useEffect(() => { if (!manualstart) fire(); }, [manualstart, fire]);

  return <canvas ref={canvasRef} {...rest} />;
});
Confetti.displayName = "Confetti";

// --- TEXT LOOP ANIMATION COMPONENT ---
export function TextLoop({ children, className, interval = 2, transition = { duration: 0.3 }, variants, onIndexChange, stopOnEnd = false }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const items = Children.toArray(children);
  useEffect(() => {
    const intervalMs = interval * 1000;
    const timer = setInterval(() => {
      setCurrentIndex((current) => {
        if (stopOnEnd && current === items.length - 1) {
          clearInterval(timer);
          return current;
        }
        const next = (current + 1) % items.length;
        onIndexChange?.(next);
        return next;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [items.length, interval, onIndexChange, stopOnEnd]);

  const motionVariants = {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -20, opacity: 0 },
  };

  return (
    <div className={cn('relative inline-block whitespace-nowrap', className)}>
      <AnimatePresence mode='popLayout' initial={false}>
        <motion.div key={currentIndex} initial='initial' animate='animate' exit='exit' transition={transition} variants={variants || motionVariants}>
          {items[currentIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// --- BUILT-IN BLUR FADE ANIMATION COMPONENT ---
function BlurFade({ children, className, variant, duration = 0.4, delay = 0, yOffset = 6, inView = true, inViewMargin = "-50px", blur = "6px" }) {
  const ref = useRef(null);
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin });
  const isInView = !inView || inViewResult;
  const defaultVariants = {
    hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: -yOffset, opacity: 1, filter: `blur(0px)` },
  };
  const combinedVariants = variant || defaultVariants;
  return (
    <motion.div ref={ref} initial="hidden" animate={isInView ? "visible" : "hidden"} exit="hidden" variants={combinedVariants} transition={{ delay: 0.04 + delay, duration, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

// --- BUILT-IN GLASS BUTTON COMPONENT ---
const glassButtonVariants = cva("relative isolate all-unset cursor-pointer rounded-full transition-all", { variants: { size: { default: "text-base font-medium", sm: "text-sm font-medium", lg: "text-lg font-medium", icon: "h-10 w-10" } }, defaultVariants: { size: "default" } });
const glassButtonTextVariants = cva("glass-button-text relative block select-none tracking-tighter", { variants: { size: { default: "px-6 py-3.5", sm: "px-4 py-2", lg: "px-8 py-4", icon: "flex h-10 w-10 items-center justify-center" } }, defaultVariants: { size: "default" } });

const GlassButton = React.forwardRef(({ className, children, size, contentClassName, onClick, ...props }, ref) => {
  const handleWrapperClick = (e) => {
    const button = e.currentTarget.querySelector('button');
    if (button && e.target !== button) button.click();
  };
  return (
    <div className={cn("glass-button-wrap cursor-pointer rounded-full relative", className)} onClick={handleWrapperClick}>
      <button className={cn("glass-button relative z-10", glassButtonVariants({ size }))} ref={ref} onClick={onClick} {...props}>
        <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>{children}</span>
      </button>
      <div className="glass-button-shadow rounded-full pointer-events-none"></div>
    </div>
  );
});
GlassButton.displayName = "GlassButton";

// --- THEME-AWARE SVG GRADIENT BACKGROUND ---
export const GradientBackground = () => (
    <>
        <style>
            {` @keyframes float1 { 0% { transform: translate(0, 0); } 50% { transform: translate(-10px, 10px); } 100% { transform: translate(0, 0); } } @keyframes float2 { 0% { transform: translate(0, 0); } 50% { transform: translate(10px, -10px); } 100% { transform: translate(0, 0); } } `}
        </style>
        <svg width="100%" height="100%" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" className="absolute top-0 left-0 w-full h-full">
            <defs>
                <linearGradient id="rev_grad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style={{stopColor: 'var(--color-primary, #3B82F6)', stopOpacity:0.8}} /><stop offset="100%" style={{stopColor: 'var(--color-chart-3, #8B5CF6)', stopOpacity:0.6}} /></linearGradient>
                <linearGradient id="rev_grad2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style={{stopColor: 'var(--color-chart-4, #EC4899)', stopOpacity:0.9}} /><stop offset="50%" style={{stopColor: 'var(--color-secondary, #6366F1)', stopOpacity:0.7}} /><stop offset="100%" style={{stopColor: 'var(--color-chart-1, #10B981)', stopOpacity:0.6}} /></linearGradient>
                <radialGradient id="rev_grad3" cx="50%" cy="50%" r="50%"><stop offset="0%" style={{stopColor: 'var(--color-destructive, #EF4444)', stopOpacity:0.8}} /><stop offset="100%" style={{stopColor: 'var(--color-chart-5, #F59E0B)', stopOpacity:0.4}} /></radialGradient>
                <filter id="rev_blur1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="35"/></filter>
                <filter id="rev_blur2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="25"/></filter>
                <filter id="rev_blur3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="45"/></filter>
            </defs>
            <g style={{ animation: 'float1 20s ease-in-out infinite' }}>
                <ellipse cx="200" cy="500" rx="250" ry="180" fill="url(#rev_grad1)" filter="url(#rev_blur1)" transform="rotate(-30 200 500)"/>
                <rect x="500" y="100" width="300" height="250" rx="80" fill="url(#rev_grad2)" filter="url(#rev_blur2)" transform="rotate(15 650 225)"/>
            </g>
            <g style={{ animation: 'float2 25s ease-in-out infinite' }}>
                <circle cx="650" cy="450" r="150" fill="url(#rev_grad3)" filter="url(#rev_blur3)" opacity="0.7"/>
                <ellipse cx="50" cy="150" rx="180" ry="120" fill="var(--color-accent, #06B6D4)" filter="url(#rev_blur2)" opacity="0.8"/>
            </g>
        </svg>
    </>
);

const GoogleIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-6 h-6"> <g fillRule="evenodd" fill="none"> <g fillRule="nonzero" transform="translate(3, 2)"> <path fill="#4285F4" d="M57.8123233,30.1515267 C57.8123233,27.7263183 57.6155321,25.9565533 57.1896408,24.1212666 L29.4960833,24.1212666 L29.4960833,35.0674653 L45.7515771,35.0674653 C45.4239683,37.7877475 43.6542033,41.8844383 39.7213169,44.6372555 L39.6661883,45.0037254 L48.4223791,51.7870338 L49.0290201,51.8475849 C54.6004021,46.7020943 57.8123233,39.1313952 57.8123233,30.1515267"></path> <path fill="#34A853" d="M29.4960833,58.9921667 C37.4599129,58.9921667 44.1456164,56.3701671 49.0290201,51.8475849 L39.7213169,44.6372555 C37.2305867,46.3742596 33.887622,47.5868638 29.4960833,47.5868638 C21.6960582,47.5868638 15.0758763,42.4415991 12.7159637,35.3297782 L12.3700541,35.3591501 L3.26524241,42.4054492 L3.14617358,42.736447 C7.9965904,52.3717589 17.959737,58.9921667 29.4960833,58.9921667"></path> <path fill="#FBBC05" d="M12.7159637,35.3297782 C12.0932812,33.4944915 11.7329116,31.5279353 11.7329116,29.4960833 C11.7329116,27.4640054 12.0932812,25.4976752 12.6832029,23.6623884 L12.6667095,23.2715173 L3.44779955,16.1120237 L3.14617358,16.2554937 C1.14708246,20.2539019 0,24.7439491 0,29.4960833 C0,34.2482175 1.14708246,38.7380388 3.14617358,42.736447 L12.7159637,35.3297782"></path> <path fill="#EB4335" d="M29.4960833,11.4050769 C35.0347044,11.4050769 38.7707997,13.7975244 40.9011602,15.7968415 L49.2255853,7.66898166 C44.1130815,2.91684746 37.4599129,0 29.4960833,0 C17.959737,0 7.9965904,6.62018183 3.14617358,16.2554937 L12.6832029,23.6623884 C15.0758763,16.5505675 21.6960582,11.4050769 29.4960833,11.4050769"></path> </g> </g></svg> );
const GitHubIcon = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" className="w-6 h-6"> <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/> </svg> );

const modalSteps = [
    { message: "Authenticating portal...", icon: <Loader className="w-12 h-12 text-primary animate-spin" /> },
    { message: "Verifying credentials...", icon: <Loader className="w-12 h-12 text-primary animate-spin" /> },
    { message: "Opening workspace...", icon: <Loader className="w-12 h-12 text-primary animate-spin" /> },
    { message: "Welcome Back!", icon: <PartyPopper className="w-12 h-12 text-emerald-500" /> }
];
const TEXT_LOOP_INTERVAL = 1.5;

const DefaultLogo = () => ( <div className="bg-blue-600 text-white rounded-md p-1.5 shadow-md"> <Gem className="h-4 w-4" /> </div> );

export const AuthComponent = ({ logo = <DefaultLogo />, brandName = "KGiSL Attendance", onLoginSubmit }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authStep, setAuthStep] = useState("email");
  const [modalStatus, setModalStatus] = useState('closed');
  const [modalErrorMessage, setModalErrorMessage] = useState('');
  const confettiRef = useRef(null);

  const isEmailValid = /\S+@\S+\.\S+/.test(email);
  const isPasswordValid = password.length >= 4;
  
  const passwordInputRef = useRef(null);

  const fireSideCanons = () => {
    const fire = confettiRef.current?.fire;
    if (fire) {
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
        const particleCount = 50;
        fire({ ...defaults, particleCount, origin: { x: 0, y: 1 }, angle: 60 });
        fire({ ...defaults, particleCount, origin: { x: 1, y: 1 }, angle: 120 });
    }
  };

  const handleFinalSubmit = async (e) => {
    if (e) e.preventDefault();
    if (modalStatus !== 'closed') return;

    setModalStatus('loading');
    try {
      if (onLoginSubmit) {
        await onLoginSubmit(email, password);
      }
      fireSideCanons();
      setModalStatus('success');
    } catch (err) {
      setModalErrorMessage(err.message || "Authentication failed. Check email & password.");
      setModalStatus('error');
    }
  };

  const handleProgressStep = () => {
    if (authStep === 'email') {
        if (isEmailValid) setAuthStep("password");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (authStep === 'email') {
          handleProgressStep();
        } else if (authStep === 'password') {
          handleFinalSubmit();
        }
    }
  };

  const handleGoBack = () => {
    if (authStep === 'password') setAuthStep('email');
  };

  const closeModal = () => {
    setModalStatus('closed');
    setModalErrorMessage('');
  };

  useEffect(() => {
      if (authStep === 'password') setTimeout(() => passwordInputRef.current?.focus(), 400);
  }, [authStep]);

  useEffect(() => {
      if (modalStatus === 'success') {
          fireSideCanons();
      }
  }, [modalStatus]);
  
  const Modal = () => (
    <AnimatePresence>
        {modalStatus !== 'closed' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-slate-900/90 border border-slate-700 rounded-2xl p-8 w-full max-w-sm flex flex-col items-center gap-4 mx-2 shadow-2xl">
                    {(modalStatus === 'error' || modalStatus === 'success') && <button onClick={closeModal} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>}
                    {modalStatus === 'error' && <>
                        <AlertCircle className="w-12 h-12 text-rose-500" />
                        <p className="text-sm font-medium text-slate-200 text-center">{modalErrorMessage}</p>
                        <GlassButton onClick={closeModal} size="sm" className="mt-4">Try Again</GlassButton>
                    </>}
                    {modalStatus === 'loading' && 
                        <TextLoop interval={TEXT_LOOP_INTERVAL} stopOnEnd={true}>
                            {modalSteps.slice(0, -1).map((step, i) => 
                                <div key={i} className="flex flex-col items-center gap-4">
                                    {step.icon}
                                    <p className="text-base font-medium text-slate-100">{step.message}</p>
                                </div>
                            )}
                        </TextLoop>
                    }
                    {modalStatus === 'success' &&
                        <div className="flex flex-col items-center gap-4">
                            {modalSteps[modalSteps.length - 1].icon}
                            <p className="text-lg font-bold text-emerald-400">{modalSteps[modalSteps.length - 1].message}</p>
                        </div>
                    }
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
  );

  return (
    <div className="bg-slate-950 min-h-screen w-screen flex flex-col">
        <style>{`
            input[type="password"]::-ms-reveal, input[type="password"]::-ms-clear { display: none !important; } input[type="password"]::-webkit-credentials-auto-fill-button, input[type="password"]::-webkit-strong-password-auto-fill-button { display: none !important; } input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active { -webkit-box-shadow: 0 0 0 30px transparent inset !important; -webkit-text-fill-color: #f8fafc !important; background-color: transparent !important; background-clip: content-box !important; transition: background-color 5000s ease-in-out 0s !important; color: #f8fafc !important; caret-color: #f8fafc !important; } input:autofill { background-color: transparent !important; background-clip: content-box !important; -webkit-text-fill-color: #f8fafc !important; color: #f8fafc !important; } input:-internal-autofill-selected { background-color: transparent !important; background-image: none !important; color: #f8fafc !important; -webkit-text-fill-color: #f8fafc !important; } input:-webkit-autofill::first-line { color: #f8fafc !important; -webkit-text-fill-color: #f8fafc !important; }
            @property --angle-1 { syntax: "<angle>"; inherits: false; initial-value: -75deg; } @property --angle-2 { syntax: "<angle>"; inherits: false; initial-value: -45deg; }
            .glass-button-wrap { --anim-time: 400ms; --anim-ease: cubic-bezier(0.25, 1, 0.5, 1); --border-width: clamp(1px, 0.0625em, 4px); position: relative; z-index: 2; transform-style: preserve-3d; transition: transform var(--anim-time) var(--anim-ease); } .glass-button-wrap:has(.glass-button:active) { transform: rotateX(25deg); } .glass-button-shadow { --shadow-cutoff-fix: 2em; position: absolute; width: calc(100% + var(--shadow-cutoff-fix)); height: calc(100% + var(--shadow-cutoff-fix)); top: calc(0% - var(--shadow-cutoff-fix) / 2); left: calc(0% - var(--shadow-cutoff-fix) / 2); filter: blur(clamp(2px, 0.125em, 12px)); transition: filter var(--anim-time) var(--anim-ease); pointer-events: none; z-index: 0; } .glass-button-shadow::after { content: ""; position: absolute; inset: 0; border-radius: 9999px; background: linear-gradient(180deg, rgba(255,255,255,0.2), rgba(255,255,255,0.1)); width: calc(100% - var(--shadow-cutoff-fix) - 0.25em); height: calc(100% - var(--shadow-cutoff-fix) - 0.25em); top: calc(var(--shadow-cutoff-fix) - 0.5em); left: calc(var(--shadow-cutoff-fix) - 0.875em); padding: 0.125em; box-sizing: border-box; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; transition: all var(--anim-time) var(--anim-ease); opacity: 1; }
            .glass-button { -webkit-tap-highlight-color: transparent; backdrop-filter: blur(clamp(1px, 0.125em, 4px)); transition: all var(--anim-time) var(--anim-ease); background: linear-gradient(-75deg, rgba(15,23,42,0.6), rgba(30,41,59,0.8), rgba(15,23,42,0.6)); box-shadow: inset 0 0.125em 0.125em rgba(255,255,255,0.1), inset 0 -0.125em 0.125em rgba(0,0,0,0.5), 0 0.25em 0.125em -0.125em rgba(0,0,0,0.4), 0 0 0.1em 0.25em inset rgba(255,255,255,0.05); } .glass-button:hover { transform: scale(0.975); backdrop-filter: blur(0.01em); } .glass-button-text { color: #f8fafc; text-shadow: 0em 0.25em 0.05em rgba(0,0,0,0.5); transition: all var(--anim-time) var(--anim-ease); } .glass-button-text::after { content: ""; display: block; position: absolute; width: calc(100% - var(--border-width)); height: calc(100% - var(--border-width)); top: calc(0% + var(--border-width) / 2); left: calc(0% + var(--border-width) / 2); box-sizing: border-box; border-radius: 9999px; overflow: clip; background: linear-gradient(var(--angle-2), transparent 0%, rgba(255,255,255,0.2) 40% 50%, transparent 55%); z-index: 3; mix-blend-mode: screen; pointer-events: none; background-size: 200% 200%; background-position: 0% 50%; transition: background-position calc(var(--anim-time) * 1.25) var(--anim-ease), --angle-2 calc(var(--anim-time) * 1.25) var(--anim-ease); } .glass-button:hover .glass-button-text::after { background-position: 25% 50%; } .glass-button:active .glass-button-text::after { background-position: 50% 15%; --angle-2: -15deg; } .glass-button::after { content: ""; position: absolute; z-index: 1; inset: 0; border-radius: 9999px; width: calc(100% + var(--border-width)); height: calc(100% + var(--border-width)); top: calc(0% - var(--border-width) / 2); left: calc(0% - var(--border-width) / 2); padding: var(--border-width); box-sizing: border-box; background: conic-gradient(from var(--angle-1) at 50% 50%, rgba(255,255,255,0.4) 0%, transparent 5% 40%, rgba(255,255,255,0.4) 50%, transparent 60% 95%, rgba(255,255,255,0.4) 100%), linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05)); mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; transition: all var(--anim-time) var(--anim-ease), --angle-1 500ms ease; box-shadow: inset 0 0 0 calc(var(--border-width) / 2) rgba(255,255,255,0.1); pointer-events: none; } .glass-button:hover::after { --angle-1: -125deg; } .glass-button:active::after { --angle-1: -75deg; }
            .glass-input-wrap { position: relative; z-index: 2; transform-style: preserve-3d; border-radius: 9999px; } .glass-input { display: flex; position: relative; width: 100%; align-items: center; gap: 0.5rem; border-radius: 9999px; padding: 0.25rem; -webkit-tap-highlight-color: transparent; backdrop-filter: blur(clamp(1px, 0.125em, 4px)); transition: all 400ms cubic-bezier(0.25, 1, 0.5, 1); background: linear-gradient(-75deg, rgba(15,23,42,0.6), rgba(30,41,59,0.8), rgba(15,23,42,0.6)); box-shadow: inset 0 0.125em 0.125em rgba(255,255,255,0.1), inset 0 -0.125em 0.125em rgba(0,0,0,0.5), 0 0.25em 0.125em -0.125em rgba(0,0,0,0.3); } .glass-input-wrap:focus-within .glass-input { backdrop-filter: blur(0.01em); } .glass-input::after { content: ""; position: absolute; z-index: 1; inset: 0; border-radius: 9999px; width: calc(100% + clamp(1px, 0.0625em, 4px)); height: calc(100% + clamp(1px, 0.0625em, 4px)); top: calc(0% - clamp(1px, 0.0625em, 4px) / 2); left: calc(0% - clamp(1px, 0.0625em, 4px) / 2); padding: clamp(1px, 0.0625em, 4px); box-sizing: border-box; background: conic-gradient(from var(--angle-1) at 50% 50%, rgba(255,255,255,0.4) 0%, transparent 5% 40%, rgba(255,255,255,0.4) 50%, transparent 60% 95%, rgba(255,255,255,0.4) 100%), linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05)); mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; transition: all 400ms cubic-bezier(0.25, 1, 0.5, 1), --angle-1 500ms ease; box-shadow: inset 0 0 0 calc(clamp(1px, 0.0625em, 4px) / 2) rgba(255,255,255,0.1); pointer-events: none; } .glass-input-wrap:focus-within .glass-input::after { --angle-1: -125deg; } .glass-input-text-area { position: absolute; inset: 0; border-radius: 9999px; pointer-events: none; } .glass-input-text-area::after { content: ""; display: block; position: absolute; width: calc(100% - clamp(1px, 0.0625em, 4px)); height: calc(100% - clamp(1px, 0.0625em, 4px)); top: calc(0% + clamp(1px, 0.0625em, 4px) / 2); left: calc(0% + clamp(1px, 0.0625em, 4px) / 2); box-sizing: border-box; border-radius: 9999px; overflow: clip; background: linear-gradient(var(--angle-2), transparent 0%, rgba(255,255,255,0.2) 40% 50%, transparent 55%); z-index: 3; mix-blend-mode: screen; pointer-events: none; background-size: 200% 200%; background-position: 0% 50%; transition: background-position calc(400ms * 1.25) cubic-bezier(0.25, 1, 0.5, 1), --angle-2 calc(400ms * 1.25) cubic-bezier(0.25, 1, 0.5, 1); } .glass-input-wrap:focus-within .glass-input-text-area::after { background-position: 25% 50%; }
        `}</style>

        <Confetti ref={confettiRef} manualstart className="fixed top-0 left-0 w-full h-full pointer-events-none z-[999]" />
        <Modal />

        <div className={cn( "fixed top-4 left-4 z-20 flex items-center gap-2", "md:left-1/2 md:-translate-x-1/2" )}>
            {logo}
            <h1 className="text-base font-bold text-slate-100">{brandName}</h1>
        </div>

        <div className={cn("flex w-full flex-1 h-full items-center justify-center bg-slate-950", "relative overflow-hidden")}>
            <div className="absolute inset-0 z-0"><GradientBackground /></div>
            <fieldset disabled={modalStatus !== 'closed'} className="relative z-10 flex flex-col items-center gap-8 w-[280px] mx-auto p-4">
                <AnimatePresence mode="wait">
                    {authStep === "email" && <motion.div key="email-content" initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="w-full flex flex-col items-center gap-4">
                        <BlurFade delay={0.25 * 1} className="w-full"><div className="text-center"><p className="font-serif font-light text-4xl sm:text-5xl md:text-6xl tracking-tight text-slate-100 whitespace-nowrap">Sign in to Portal</p></div></BlurFade>
                        <BlurFade delay={0.25 * 2}><p className="text-sm font-medium text-slate-400">Enter your institution credentials</p></BlurFade>
                        <BlurFade delay={0.25 * 3}><div className="flex items-center justify-center gap-4 w-full">
                            <GlassButton contentClassName="flex items-center justify-center gap-2" size="sm"><GoogleIcon /><span className="font-semibold text-slate-100">Google</span></GlassButton>
                            <GlassButton contentClassName="flex items-center justify-center gap-2" size="sm"><GitHubIcon /><span className="font-semibold text-slate-100">GitHub</span></GlassButton>
                        </div></BlurFade>
                        <BlurFade delay={0.25 * 4} className="w-[300px]"><div className="flex items-center w-full gap-2 py-2"><hr className="w-full border-slate-800"/><span className="text-xs font-semibold text-slate-400">OR</span><hr className="w-full border-slate-800"/></div></BlurFade>
                    </motion.div>}
                    {authStep === "password" && <motion.div key="password-title" initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="w-full flex flex-col items-center text-center gap-4">
                        <BlurFade delay={0} className="w-full"><div className="text-center"><p className="font-serif font-light text-4xl sm:text-5xl tracking-tight text-slate-100 whitespace-nowrap">Enter Password</p></div></BlurFade>
                        <BlurFade delay={0.25 * 1}><p className="text-sm font-medium text-slate-400">Enter your password to sign in</p></BlurFade>
                    </motion.div>}
                </AnimatePresence>
                
                <form onSubmit={handleFinalSubmit} className="w-[300px] space-y-6">
                     <AnimatePresence>
                        <motion.div key="email-password-fields" exit={{ opacity: 0, filter: 'blur(4px)' }} transition={{ duration: 0.3, ease: "easeOut" }} className="w-full space-y-6">
                            <BlurFade delay={authStep === 'email' ? 0.25 * 5 : 0} inView={true} className="w-full">
                                <div className="relative w-full">
                                    <AnimatePresence>
                                        {authStep === "password" && <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3, delay: 0.4 }} className="absolute -top-6 left-4 z-10"><label className="text-xs text-slate-400 font-semibold">Email</label></motion.div>}
                                    </AnimatePresence>
                                    <div className="glass-input-wrap w-full"><div className="glass-input">
                                        <span className="glass-input-text-area"></span>
                                        <div className={cn( "relative z-10 flex-shrink-0 flex items-center justify-center overflow-hidden transition-all duration-300 ease-in-out", email.length > 20 && authStep === 'email' ? "w-0 px-0" : "w-10 pl-2" )}><Mail className="h-5 w-5 text-slate-300 flex-shrink-0" /></div>
                                        <input type="email" placeholder="name@kgisl.edu" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyDown} className={cn("relative z-10 h-full w-0 flex-grow bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none transition-[padding-right] duration-300 ease-in-out delay-300", isEmailValid && authStep === 'email' ? "pr-2" : "pr-0")} />
                                        <div className={cn( "relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out", isEmailValid && authStep === 'email' ? "w-10 pr-1" : "w-0" )}><GlassButton type="button" onClick={handleProgressStep} size="icon" aria-label="Continue with email" contentClassName="text-slate-100 hover:text-white"><ArrowRight className="w-5 h-5" /></GlassButton></div>
                                    </div></div>
                                </div>
                            </BlurFade>
                            <AnimatePresence>
                                {authStep === "password" && <BlurFade key="password-field" className="w-full">
                                    <div className="relative w-full">
                                        <AnimatePresence>
                                            {password.length > 0 && <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }} className="absolute -top-6 left-4 z-10"><label className="text-xs text-slate-400 font-semibold">Password</label></motion.div>}
                                        </AnimatePresence>
                                        <div className="glass-input-wrap w-full"><div className="glass-input">
                                            <span className="glass-input-text-area"></span>
                                            <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                                                {isPasswordValid ? <button type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword(!showPassword)} className="text-slate-300 hover:text-white transition-colors p-2 rounded-full">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button> : <Lock className="h-5 w-5 text-slate-300 flex-shrink-0" />}
                                            </div>
                                            <input ref={passwordInputRef} type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown} className="relative z-10 h-full w-0 flex-grow bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none" />
                                            <div className={cn( "relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out", isPasswordValid ? "w-10 pr-1" : "w-0" )}><GlassButton type="button" onClick={handleFinalSubmit} size="icon" aria-label="Submit password" contentClassName="text-slate-100 hover:text-white"><ArrowRight className="w-5 h-5" /></GlassButton></div>
                                        </div></div>
                                    </div>
                                    <BlurFade inView delay={0.2}><button type="button" onClick={handleGoBack} className="mt-4 flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"><ArrowLeft className="w-4 h-4" /> Go back</button></BlurFade>
                                </BlurFade>}
                            </AnimatePresence>
                        </motion.div>
                    </AnimatePresence>
                </form>
            </fieldset>
        </div>
    </div>
  );
};
