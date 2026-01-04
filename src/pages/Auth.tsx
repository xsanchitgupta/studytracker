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
      className={cn("relative rounded-xl group", containerClassName)}
    >
      <div 
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 z-0"
        style={{
          opacity,
          background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, rgba(124, 58, 237, 0.3), transparent 40%)`,
        }}
      />
      <div className="relative z-10 bg-background/80 backdrop-blur-xl rounded-xl border border-input transition-all group-focus-within:border-primary group-focus-within:ring-4 group-focus-within:ring-primary/10">
        <Icon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <Input 
          className={cn("pl-10 h-11 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0", className)} 
          {...props} 
        />
      </div>
    </div>
  );
};

// --- LIQUID TABS ---
const LiquidTabs = ({ activeTab, onTabChange }: { activeTab: string, onTabChange: (val: string) => void }) => {
  return (
    <div className="relative grid grid-cols-2 p-1 bg-muted/40 rounded-xl h-12">
      <div 
        className={cn(
          "absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-background shadow-sm transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]",
          activeTab === "signin" ? "left-1" : "left-[calc(50%+4px)]"
        )} 
      />
      <button type="button" onClick={() => onTabChange("signin")} className={cn("relative z-10 text-sm font-medium transition-colors duration-300", activeTab === "signin" ? "text-foreground" : "text-muted-foreground")}>
        Sign In
      </button>
      <button type="button" onClick={() => onTabChange("signup")} className={cn("relative z-10 text-sm font-medium transition-colors duration-300", activeTab === "signup" ? "text-foreground" : "text-muted-foreground")}>
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
        "relative w-full h-12 rounded-xl overflow-hidden group transition-all hover:scale-[1.02] active:scale-[0.98]",
        isLoading && "opacity-80 cursor-not-allowed"
      )}
      disabled={isLoading}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-primary via-purple-600 to-primary bg-[length:200%_100%] animate-[shimmer_3s_infinite_linear]" />
      <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] bg-no-repeat transition-[background-position] duration-0 ease-linear group-hover:bg-[position:200%_0,0_0] group-hover:duration-[1500ms]" />
      <div className="relative flex items-center justify-center gap-2 text-primary-foreground font-semibold">{children}</div>
    </button>
  );
};

// --- GLASS GOOGLE BUTTON ---
const GlassButton = ({ children, ...props }: any) => {
  return (
    <button
      type="button"
      className="relative w-full h-12 rounded-xl border-2 border-border bg-transparent overflow-hidden group transition-all hover:border-primary/50 hover:bg-muted/30"
      {...props}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)]" />
      <div className="relative flex items-center justify-center gap-2 font-medium text-foreground">{children}</div>
    </button>
  );
};

// --- LIVE TICKER (Desktop Version) ---
const LiveTicker = () => {
  const [index, setIndex] = useState(0);
  const events = [
    { icon: Trophy, text: "Alex just earned 'Math Wizard'", color: "text-yellow-500" },
    { icon: Zap, text: "Sarah hit a 7-day streak!", color: "text-blue-500" },
    { icon: Star, text: "David aced Physics 101", color: "text-purple-500" },
    { icon: TrendingUp, text: "Community study hours: 10k+", color: "text-green-500" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % events.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-12 overflow-hidden">
      {events.map((event, i) => (
        <div key={i} className={cn("absolute inset-0 flex items-center gap-3 transition-all duration-500 transform", i === index ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")}>
          <div className="p-2 rounded-full bg-white/10 backdrop-blur-md">
            <event.icon className={cn("h-4 w-4", event.color)} />
          </div>
          <span className="text-sm font-medium text-white/80">{event.text}</span>
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
    <div className="mb-6 flex justify-center lg:hidden">
       <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-xs font-medium text-primary border border-primary/20 animate-in fade-in slide-in-from-top-2">
          <span className="relative flex h-2 w-2">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
             <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
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
    <div className={cn("min-h-screen w-full flex overflow-hidden font-sans selection:bg-primary/30",
      theme === "dark" ? "bg-black text-white" : "bg-white text-zinc-950"
    )}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* LEFT SIDE - VISUALS (Desktop Only) */}
      <div className="hidden lg:flex w-1/2 relative bg-[#050505] items-center justify-center overflow-hidden border-r border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,_#1e1b4b_0%,_transparent_50%)]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10" />
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] animate-pulse duration-[5000ms]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] animate-pulse duration-[7000ms]" />

        <div className="relative z-10 max-w-md space-y-8">
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl animate-in slide-in-from-left-8 duration-1000 hover:scale-105 transition-transform cursor-default">
            <div className="flex items-center gap-3 mb-6">
               <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
               <p className="text-xs font-medium text-white/50 uppercase tracking-widest">Live Updates</p>
            </div>
            <LiveTicker />
            <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-end">
               <div>
                  <p className="text-3xl font-bold text-white">98%</p>
                  <p className="text-xs text-white/40">Success Rate</p>
               </div>
               <div className="flex -space-x-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="h-8 w-8 rounded-full border-2 border-[#050505] bg-gradient-to-br from-gray-700 to-gray-900" />
                  ))}
               </div>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-5xl font-bold tracking-tight text-white">
              Focus on <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">what matters.</span>
            </h1>
            <p className="text-lg text-white/50 font-light max-w-sm">
              We handle the organization. You handle the learning.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - FORM */}
      <div className="w-full lg:w-1/2 flex flex-col relative bg-background">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-30 dark:opacity-5" />

        {/* Navbar */}
        <div className="flex items-center justify-between p-6">
           <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate("/")}>
              <div className="bg-primary/10 p-2 rounded-xl text-primary transition-transform group-hover:rotate-12">
                <BookOpen className="h-5 w-5" />
              </div>
              <span className="font-bold text-lg tracking-tight">StudySync</span>
           </div>
           <ThemeToggle />
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-[400px] animate-in slide-in-from-bottom-4 duration-700">
            
            {/* MOBILE ONLY TICKER */}
            <MobileTicker />

            {isVerificationSent ? (
              <div className="text-center space-y-6">
                 <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-green-500/5 animate-[bounce_1s_infinite]">
                    <Mail className="h-10 w-10" />
                 </div>
                 <div>
                    <h2 className="text-2xl font-bold">Check your inbox</h2>
                    <p className="text-muted-foreground mt-2">
                       We sent a verification link to <br/><span className="text-foreground font-medium">{email}</span>
                    </p>
                 </div>
                 <button onClick={() => setIsVerificationSent(false)} className="text-sm text-primary hover:underline flex items-center justify-center gap-2 w-full">
                    <ArrowLeft className="h-4 w-4" /> Back to Login
                 </button>
              </div>
            ) : (
              <>
                <div className="mb-8">
                   <h2 className="text-3xl font-bold tracking-tight mb-2">Get started</h2>
                   <p className="text-muted-foreground">Sign in to sync your progress across devices.</p>
                </div>

                <div className="space-y-6">
                  <LiquidTabs activeTab={activeTab} onTabChange={setActiveTab} />

                  {activeTab === "signin" ? (
                     <form onSubmit={handleSignIn} className="space-y-4 animate-in fade-in duration-300">
                        <div className="space-y-2">
                           <Label>Email</Label>
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
                           <div className="flex justify-between">
                              <Label>Password</Label>
                              <button type="button" onClick={handleForgotPassword} className="text-xs font-medium text-primary hover:text-purple-500 transition-colors">Forgot password?</button>
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
                          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In"}
                        </CosmicButton>
                     </form>
                  ) : (
                     <form onSubmit={handleSignUp} className="space-y-4 animate-in fade-in duration-300">
                        <div className="space-y-2">
                           <Label>Full Name</Label>
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
                           <Label>Email</Label>
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
                           <Label>Password</Label>
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
                          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Account"}
                        </CosmicButton>
                     </form>
                  )}

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/60" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground font-medium">Or</span></div>
                  </div>

                  <GlassButton onClick={handleGoogleSignIn} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="mr-2 h-5 w-5 text-orange-500" />}
                    Continue with Google
                  </GlassButton>
                </div>
              </>
            )}
            
            <p className="text-center text-xs text-muted-foreground pt-4">
              Protected by reCAPTCHA and subject to the <br/>StudySync <span className="underline cursor-pointer hover:text-primary">Privacy Policy</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;