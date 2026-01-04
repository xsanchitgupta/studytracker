import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { 
  BookOpen, 
  Mail, 
  Lock, 
  User, 
  Loader2, 
  ArrowLeft, 
  Chrome,
  TrendingUp,
  Star,
  Trophy,
  Zap
} from "lucide-react";

// --- SPOTLIGHT INPUT ---
const SpotlightInput = ({ icon: Icon, className, containerClassName, ...props }: any) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div 
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={cn("relative rounded-2xl group shadow-lg transition-all duration-300", containerClassName)}
    >
      <div 
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 z-0"
        style={{
          opacity,
          background: `radial-gradient(500px circle at ${position.x}px ${position.y}px, rgba(168,85,247,0.25), transparent 50%)`,
        }}
      />
      <div className="relative z-10 bg-background/80 backdrop-blur-2xl rounded-2xl border border-input/60 shadow-[0_2px_24px_0_rgba(124,58,237,0.08)] transition-all group-focus-within:border-primary group-focus-within:ring-4 group-focus-within:ring-primary/20">
        <Icon className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <Input 
          className={cn("pl-12 h-12 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base font-medium tracking-wide", className)} 
          {...props} 
        />
      </div>
    </div>
  );
};

// --- LIQUID TABS ---
const LiquidTabs = ({ activeTab, onTabChange }: { activeTab: string, onTabChange: (val: string) => void }) => {
  return (
    <div className="relative grid grid-cols-2 p-1 bg-gradient-to-r from-primary/10 via-purple-200/10 to-primary/10 rounded-2xl h-14 shadow-lg">
      <div 
        className={cn(
          "absolute top-1 bottom-1 w-[calc(50%-6px)] rounded-xl bg-gradient-to-r from-primary/80 to-purple-500/80 shadow-xl blur-[1px] transition-all duration-400 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]",
          activeTab === "signin" ? "left-1" : "left-[calc(50%+6px)]"
        )} 
      />
      <button type="button" onClick={() => onTabChange("signin")} className={cn("relative z-10 text-base font-semibold transition-colors duration-300 tracking-wide", activeTab === "signin" ? "text-white drop-shadow-lg" : "text-muted-foreground")}>
        Sign In
      </button>
      <button type="button" onClick={() => onTabChange("signup")} className={cn("relative z-10 text-base font-semibold transition-colors duration-300 tracking-wide", activeTab === "signup" ? "text-white drop-shadow-lg" : "text-muted-foreground")}>
        Create Account
      </button>
    </div>
  );
};

// --- COSMIC SUBMIT BUTTON ---
const CosmicButton = ({ children, isLoading, ...props }: any) => {
  return (
    <button 
      className={cn(
        "relative w-full h-14 rounded-2xl overflow-hidden group transition-all hover:scale-[1.025] active:scale-[0.98] shadow-xl",
        isLoading && "opacity-80 cursor-not-allowed"
      )}
      disabled={isLoading}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-primary via-fuchsia-500 to-primary bg-[length:300%_100%] animate-[shimmer_2.5s_infinite_linear]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_40%,rgba(255,255,255,0.18)_50%,transparent_60%)] bg-[length:250%_250%,100%_100%] bg-no-repeat transition-[background-position] duration-0 ease-linear group-hover:bg-[position:200%_0,0_0] group-hover:duration-[1200ms]" />
      <div className="relative flex items-center justify-center gap-2 text-lg text-primary-foreground font-bold tracking-wide drop-shadow-lg">{children}</div>
    </button>
  );
};

// --- GLASS GOOGLE BUTTON ---
const GlassButton = ({ children, ...props }: any) => {
  return (
    <button
      type="button"
      className="relative w-full h-14 rounded-2xl border-2 border-border/70 bg-white/30 dark:bg-black/20 backdrop-blur-xl overflow-hidden group transition-all hover:border-primary/60 hover:bg-primary/10 shadow-lg"
      {...props}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18)_0%,transparent_70%)]" />
      <div className="relative flex items-center justify-center gap-2 font-semibold text-foreground text-base">{children}</div>
    </button>
  );
};

// --- LIVE TICKER (Desktop Version) ---
const LiveTicker = () => {
  const [index, setIndex] = useState(0);
  const events = [
    { icon: Trophy, text: "Alex just earned 'Math Wizard'", color: "text-yellow-400 drop-shadow-glow" },
    { icon: Zap, text: "Sarah hit a 7-day streak!", color: "text-blue-400 drop-shadow-glow" },
    { icon: Star, text: "David aced Physics 101", color: "text-purple-400 drop-shadow-glow" },
    { icon: TrendingUp, text: "Community study hours: 10k+", color: "text-green-400 drop-shadow-glow" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % events.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-14 overflow-hidden">
      {events.map((event, i) => (
        <div key={i} className={cn("absolute inset-0 flex items-center gap-4 transition-all duration-700 transform", i === index ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0")}>
          <div className="p-2 rounded-full bg-gradient-to-br from-white/20 to-primary/10 shadow-lg backdrop-blur-md">
            <event.icon className={cn("h-5 w-5", event.color)} />
          </div>
          <span className="text-base font-semibold text-white/90 tracking-wide drop-shadow">{event.text}</span>
        </div>
      ))}
    </div>
  );
};

// --- MOBILE TICKER (New! For small screens) ---
const MobileTicker = () => {
  const [index, setIndex] = useState(0);
  const events = [
     "🚀 Alex earned 'Math Wizard'",
     "🔥 Sarah: 7-day streak!",
     "⭐ David aced Physics 101",
     "📈 10k+ study hours logged"
  ];
  
  useEffect(() => {
     const interval = setInterval(() => {
       setIndex((prev) => (prev + 1) % events.length);
     }, 3000);
     return () => clearInterval(interval);
  }, []);

  return (
    <div className="mb-8 flex justify-center lg:hidden">
       <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-gradient-to-r from-primary/20 via-fuchsia-400/10 to-primary/20 text-sm font-semibold text-primary border border-primary/30 shadow-lg animate-in fade-in slide-in-from-top-2">
          <span className="relative flex h-3 w-3">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
             <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </span>
          <span key={index} className="animate-in fade-in slide-in-from-bottom-1 duration-300">{events[index]}</span>
       </div>
    </div>
  );
};

// --- MAIN AUTH PAGE ---

const Auth = () => {
  const [activeTab, setActiveTab] = useState("signin");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mounted, setMounted] = useState(false);
  
  const { signIn, signUp, resetPassword, signInWithGoogle, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn(email, password);
      setTimeout(() => {
        toast({ title: "Welcome back!", description: "Redirecting to your dashboard..." });
        navigate("/gateway", { replace: true });
      }, 500);
    } catch (error: any) {
      toast({ title: "Error", description: error.code || "Sign in failed", variant: "destructive" });
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signUp(email, password, name);
      setIsVerificationSent(true); 
    } catch (error: any) {
      toast({ title: "Error", description: error.code || "Sign up failed", variant: "destructive" });
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      navigate("/gateway", { replace: true });
    } catch (error: any) {
      toast({ title: "Error", description: "Google Sign-In failed.", variant: "destructive" });
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: "Email required", description: "Enter your email to reset password.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await resetPassword(email);
      toast({ title: "Sent!", description: "Check your inbox." });
    } catch (error: any) {
      toast({ title: "Error", description: "Could not send reset email.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted || authLoading) return null;

  return (
    <div className={cn(
      "min-h-screen w-full flex overflow-hidden font-sans selection:bg-primary/30",
      theme === "dark" ? "bg-gradient-to-br from-black via-zinc-900 to-[#1e1b4b] text-white" : "bg-gradient-to-br from-white via-zinc-100 to-[#f3e8ff] text-zinc-950"
    )}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .drop-shadow-glow { filter: drop-shadow(0 0 8px rgba(168,85,247,0.7)); }
      `}</style>

      {/* LEFT SIDE - VISUALS (Desktop Only) */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center overflow-hidden border-r border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,_#1e1b4b_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
        <div className="absolute top-1/3 left-1/4 w-[28rem] h-[28rem] bg-gradient-to-br from-primary/30 via-fuchsia-400/20 to-purple-500/20 rounded-full blur-[120px] animate-pulse duration-[5000ms]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-purple-500/20 to-primary/10 rounded-full blur-[90px] animate-pulse duration-[7000ms]" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-fuchsia-400/20 to-primary/10 rounded-full blur-[120px] opacity-60" />

        <div className="relative z-10 max-w-md space-y-10">
          <div className="p-10 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-3xl shadow-2xl animate-in slide-in-from-left-8 duration-1000 hover:scale-105 transition-transform cursor-default">
            <div className="flex items-center gap-4 mb-8">
               <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse shadow-lg" />
               <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Live Updates</p>
            </div>
            <LiveTicker />
            <div className="mt-8 pt-8 border-t border-white/10 flex justify-between items-end">
               <div>
                  <p className="text-4xl font-extrabold text-white drop-shadow-glow">98%</p>
                  <p className="text-xs text-white/50 font-medium">Success Rate</p>
               </div>
               <div className="flex -space-x-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="h-10 w-10 rounded-full border-2 border-[#050505] bg-gradient-to-br from-gray-700 to-gray-900 shadow-lg ring-2 ring-primary/20" />
                  ))}
               </div>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-6xl font-extrabold tracking-tight text-white leading-tight drop-shadow-glow">
              Focus on <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-fuchsia-400 to-purple-400 animate-gradient-x">what matters.</span>
            </h1>
            <p className="text-xl text-white/70 font-light max-w-sm drop-shadow">
              We handle the organization.<br/>You handle the learning.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - FORM */}
      <div className="w-full lg:w-1/2 flex flex-col relative bg-background/80">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1.5px,transparent_1.5px)] [background-size:18px_18px] opacity-40 dark:opacity-10" />

        {/* Navbar */}
        <div className="flex items-center justify-between p-8">
           <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate("/")}>
              <div className="bg-gradient-to-br from-primary/20 to-fuchsia-400/20 p-3 rounded-2xl text-primary shadow-lg transition-transform group-hover:rotate-12">
                <BookOpen className="h-6 w-6" />
              </div>
              <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-primary via-fuchsia-400 to-purple-400 bg-clip-text text-transparent drop-shadow-glow">StudySync</span>
           </div>
           <ThemeToggle />
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-[440px] animate-in slide-in-from-bottom-4 duration-700 bg-white/70 dark:bg-zinc-900/80 rounded-3xl shadow-2xl border border-zinc-200/60 dark:border-zinc-800/60 backdrop-blur-2xl px-8 py-10">
            
            {/* MOBILE ONLY TICKER */}
            <MobileTicker />

            {isVerificationSent ? (
              <div className="text-center space-y-8">
                 <div className="w-24 h-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8 ring-4 ring-green-500/10 animate-[bounce_1.2s_infinite] shadow-lg">
                    <Mail className="h-12 w-12" />
                 </div>
                 <div>
                    <h2 className="text-3xl font-extrabold">Check your inbox</h2>
                    <p className="text-muted-foreground mt-3 text-base">
                       We sent a verification link to <br/><span className="text-foreground font-semibold">{email}</span>
                    </p>
                 </div>
                 <button onClick={() => setIsVerificationSent(false)} className="text-base text-primary hover:underline flex items-center justify-center gap-2 w-full font-semibold">
                    <ArrowLeft className="h-5 w-5" /> Back to Login
                 </button>
              </div>
            ) : (
              <>
                <div className="mb-10">
                   <h2 className="text-4xl font-extrabold tracking-tight mb-3 bg-gradient-to-r from-primary via-fuchsia-400 to-purple-400 bg-clip-text text-transparent drop-shadow-glow">Get started</h2>
                   <p className="text-muted-foreground text-base font-medium">Sign in to sync your progress across devices.</p>
                </div>

                <div className="space-y-8">
                  <LiquidTabs activeTab={activeTab} onTabChange={setActiveTab} />

                  {activeTab === "signin" ? (
                     <form onSubmit={handleSignIn} className="space-y-5 animate-in fade-in duration-300">
                        <div className="space-y-2">
                           <Label className="text-base font-semibold">Email</Label>
                           <SpotlightInput 
                             icon={Mail}
                             type="email" 
                             placeholder="name@example.com" 
                             value={email}
                             onChange={(e: any) => setEmail(e.target.value)}
                             required
                             disabled={isLoading}
                           />
                        </div>
                        <div className="space-y-2">
                           <div className="flex justify-between items-center">
                              <Label className="text-base font-semibold">Password</Label>
                              <button type="button" onClick={handleForgotPassword} className="text-xs font-bold text-primary hover:text-fuchsia-500 transition-colors underline underline-offset-2">Forgot password?</button>
                           </div>
                           <SpotlightInput 
                             icon={Lock}
                             type="password" 
                             placeholder="••••••••" 
                             value={password}
                             onChange={(e: any) => setPassword(e.target.value)}
                             required
                             disabled={isLoading}
                           />
                        </div>
                        <CosmicButton type="submit" isLoading={isLoading}>
                          {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Sign In"}
                        </CosmicButton>
                     </form>
                  ) : (
                     <form onSubmit={handleSignUp} className="space-y-5 animate-in fade-in duration-300">
                        <div className="space-y-2">
                           <Label className="text-base font-semibold">Full Name</Label>
                           <SpotlightInput 
                             icon={User}
                             placeholder="Vedant Pathak" 
                             value={name}
                             onChange={(e: any) => setName(e.target.value)}
                             required
                             disabled={isLoading}
                           />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-base font-semibold">Email</Label>
                           <SpotlightInput 
                             icon={Mail}
                             type="email" 
                             placeholder="name@example.com" 
                             value={email}
                             onChange={(e: any) => setEmail(e.target.value)}
                             required
                             disabled={isLoading}
                           />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-base font-semibold">Password</Label>
                           <SpotlightInput 
                             icon={Lock}
                             type="password" 
                             placeholder="••••••••" 
                             value={password}
                             onChange={(e: any) => setPassword(e.target.value)}
                             required
                             minLength={6}
                             disabled={isLoading}
                           />
                        </div>
                        <CosmicButton type="submit" isLoading={isLoading}>
                          {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Create Account"}
                        </CosmicButton>
                     </form>
                  )}

                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/70" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-3 text-muted-foreground font-bold tracking-widest">Or</span></div>
                  </div>

                  <GlassButton onClick={handleGoogleSignIn} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Chrome className="mr-2 h-6 w-6 text-orange-500" />}
                    Continue with Google
                  </GlassButton>
                </div>
              </>
            )}
            
            <p className="text-center text-xs text-muted-foreground pt-6 font-medium">
              Protected by reCAPTCHA and subject to the <br/>
              <span className="underline cursor-pointer hover:text-primary font-semibold">StudySync Privacy Policy</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
