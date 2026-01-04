import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { BookOpen, Mail, Lock, User, Loader2, CheckCircle2, ArrowLeft, Sparkles } from "lucide-react";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  
  const { signIn, signUp, resetPassword, signInWithGoogle, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();

  const getFriendlyErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/email-already-in-use': 
        return "An account with this email already exists. Try signing in instead!";
      case 'auth/invalid-credential': 
        return "Incorrect email or password. Please try again.";
      case 'auth/invalid-email': 
        return "That doesn't look like a valid email address.";
      case 'auth/weak-password': 
        return "Your password is too weak. Try adding more characters.";
      case 'auth/unverified-email': 
        return "Please verify your email! Check your inbox for the link.";
      case 'auth/user-not-found': 
        return "No account found with this email.";
      case 'auth/popup-closed-by-user':
        return "The login window was closed before finishing.";
      default: 
        return "Something went wrong. Please try again.";
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signIn(email, password);
      toast({ 
        title: "Welcome back!", 
        description: "Successfully signed in. Redirecting..." 
      });
      
      // Navigate to gateway which will route based on role
      navigate("/gateway", { replace: true });
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: getFriendlyErrorMessage(error.code),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signUp(email, password);
      setIsVerificationSent(true); 
      toast({
        title: "Verification email sent!",
        description: "Please check your inbox before trying to sign in.",
      });
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: getFriendlyErrorMessage(error.code),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      toast({ 
        title: "Welcome!", 
        description: "Successfully signed in with Google. Redirecting..." 
      });
      
      // Navigate to gateway which will route based on role
      navigate("/gateway", { replace: true });
    } catch (error: any) {
      toast({
        title: "Google Sign-In failed",
        description: getFriendlyErrorMessage(error.code),
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ 
        title: "Email required", 
        description: "Please enter your email address first.", 
        variant: "destructive" 
      });
      return;
    }
    setIsLoading(true);
    try {
      await resetPassword(email);
      toast({ 
        title: "Reset link sent!", 
        description: "Check your inbox for instructions to change your password." 
      });
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: "Could not send reset email. Please verify the address.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center transition-colors duration-300",
        theme === "dark" 
          ? "bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background"
          : "bg-gradient-to-br from-background via-background to-muted/20"
      )}>
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen flex flex-col transition-colors duration-300",
      theme === "dark" 
        ? "bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background"
        : "bg-gradient-to-br from-background via-background to-muted/20"
    )}>
      <header className={cn("sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300",
        theme === "dark" ? "bg-background/80 border-white/5" : "bg-background/60 border-border shadow-sm"
      )}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-xl transition-all duration-300",
              theme === "dark" ? "bg-primary/20" : "bg-primary/10"
            )}>
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <span className={cn("text-2xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent")}>
              StudySync
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className={cn("w-full max-w-md border backdrop-blur-xl shadow-2xl transition-all duration-300",
          theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
        )}>
          {isVerificationSent ? (
            <div className="p-6 text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="h-16 w-16 text-green-500 animate-in zoom-in duration-300" />
              </div>
              <CardHeader className="p-0">
                <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
                <CardDescription>
                  Verification link sent to <span className="font-semibold text-foreground">{email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 pt-4">
                <p className="text-sm text-muted-foreground mb-6">
                  You must verify your email before you can sign in.
                </p>
                <Button variant="outline" className="w-full" onClick={() => setIsVerificationSent(false)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
                </Button>
              </CardContent>
            </div>
          ) : (
            <>
              <CardHeader className="text-center space-y-2">
                <div className="flex justify-center mb-2">
                  <div className={cn("p-3 rounded-2xl",
                    theme === "dark" ? "bg-primary/20" : "bg-primary/10"
                  )}>
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <CardTitle className={cn("text-3xl font-bold", theme === "dark" ? "text-white" : "text-foreground")}>
                  Welcome to StudySync
                </CardTitle>
                <CardDescription className="text-base">Track your goals, ace your exams</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs defaultValue="signin" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="signin">Sign In</TabsTrigger>
                    <TabsTrigger value="signup">Sign Up</TabsTrigger>
                  </TabsList>

                  <TabsContent value="signin">
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signin-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="signin-email" 
                            type="email" 
                            placeholder="you@example.com" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            className="pl-10" 
                            required 
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label htmlFor="signin-password">Password</Label>
                          <button 
                            type="button" 
                            onClick={handleForgotPassword} 
                            className="text-xs text-primary hover:underline font-medium"
                            disabled={isLoading}
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="signin-password" 
                            type="password" 
                            placeholder="••••••••" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            className="pl-10" 
                            required 
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90" 
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Signing in...
                          </>
                        ) : (
                          "Sign In"
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Full Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="signup-name" 
                            type="text" 
                            placeholder="John Doe" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            className="pl-10" 
                            required 
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="signup-email" 
                            type="email" 
                            placeholder="you@example.com" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            className="pl-10" 
                            required 
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="signup-password" 
                            type="password" 
                            placeholder="••••••••" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            className="pl-10" 
                            required 
                            minLength={6}
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90" 
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Creating account...
                          </>
                        ) : (
                          "Create Account"
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>

                {/* SOCIAL DIVIDER */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                {/* GOOGLE BUTTON */}
                <Button 
                  variant="outline" 
                  type="button" 
                  className="w-full border-2" 
                  onClick={handleGoogleSignIn} 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  )}
                  Google
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </main>

      <footer className="text-center p-4 text-sm text-muted-foreground">
        © 2025 StudySync. All rights reserved.
      </footer>
    </div>
  );
};

export default Auth;