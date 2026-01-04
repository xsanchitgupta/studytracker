import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Target,
  Trophy,
  MessageCircle,
  Play,
  TrendingUp,
  Shield,
  Sparkles,
  ArrowRight,
  Check,
  Zap,
  Brain,
  Users,
  Star,
} from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const features = [
    {
      icon: Target,
      title: "Daily Study Goals",
      description: "Set and track your daily study objectives with smart reminders",
    },
    {
      icon: Play,
      title: "Custom Playlists",
      description: "Create and discover study playlists tailored to your curriculum",
    },
    {
      icon: TrendingUp,
      title: "Performance Predictor",
      description: "AI-powered predictions based on your academic records",
    },
    {
      icon: BookOpen,
      title: "Practice Tests",
      description: "Frequent quizzes on topics where you need improvement",
    },
    {
      icon: Trophy,
      title: "Leaderboard",
      description: "Compete with peers and climb the academic rankings",
    },
    {
      icon: MessageCircle,
      title: "Peer & Mentor Chat",
      description: "Connect with classmates and seniors for guidance",
    },
  ];

  const benefits = [
    "Track progress across all subjects",
    "Personalized study recommendations",
    "Encrypted & secure data",
    "Connect with study buddies",
    "AI-powered insights",
    "Dark & light mode",
  ];

  return (
    <div className={cn("min-h-screen transition-colors duration-300",
      theme === "dark" 
        ? "bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background"
        : "bg-gradient-to-br from-background via-background to-muted/20"
    )}>
      {/* Header */}
      <header className={cn("sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300",
        theme === "dark" ? "bg-background/80 border-white/5" : "bg-background/60 border-border shadow-sm"
      )}>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-xl transition-all duration-300",
              theme === "dark" ? "bg-primary/20" : "bg-primary/10"
            )}>
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              StudySync
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" onClick={() => navigate("/auth")} className="hidden sm:flex">
              Sign In
            </Button>
            <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
              Get Started <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24 text-center">
        <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-full text-primary text-sm font-medium mb-6 animate-in fade-in slide-in-from-top-4",
          theme === "dark" ? "bg-primary/20 border border-primary/30" : "bg-primary/10"
        )}>
          <Sparkles className="h-4 w-4" />
          Your Academic Success Partner
        </div>
        <h1 className={cn("text-4xl md:text-6xl font-bold mb-6 leading-tight animate-in fade-in slide-in-from-bottom-4",
          theme === "dark" ? "text-white" : "text-foreground"
        )}>
          Track Goals. Ace Exams.
          <br />
          <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Connect & Grow.
          </span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-in fade-in slide-in-from-bottom-6">
          The all-in-one platform for students to manage study goals, predict performance, 
          and connect with peers. Your data stays encrypted and private.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-8">
          <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/20">
            Start Free <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-8 border-2">
            Watch Demo
          </Button>
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap justify-center gap-6 mt-12 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-10">
          <div className={cn("flex items-center gap-2 px-4 py-2 px-4 rounded-full transition-all",
          theme === "dark" ? "bg-white/5 hover:bg-white/10" : "bg-muted/30 hover:bg-muted/50"
        )}>
            <Shield className="h-5 w-5 text-green-500" />
            End-to-End Encrypted
          </div>
          <div className={cn("flex items-center gap-2 px-4 py-2 px-4 rounded-full transition-all",
          theme === "dark" ? "bg-white/5 hover:bg-white/10" : "bg-muted/30 hover:bg-muted/50"
        )}>
            <Check className="h-5 w-5 text-green-500" />
            100% Free to Start
          </div>
          <div className={cn("flex items-center gap-2 px-4 py-2 px-4 rounded-full transition-all",
          theme === "dark" ? "bg-white/5 hover:bg-white/10" : "bg-muted/30 hover:bg-muted/50"
        )}>
            <Trophy className="h-5 w-5 text-yellow-500" />
            10K+ Students
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need to Excel</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Powerful features designed to help you stay organized, motivated, and connected
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={cn("p-6 rounded-2xl border backdrop-blur-xl transition-all duration-300 hover:shadow-xl hover:scale-[1.02] group",
                theme === "dark" ? "bg-background/40 border-white/10 hover:border-primary/30" : "bg-background/60 border-border hover:border-primary/30",
                `animate-in fade-in slide-in-from-bottom-${Math.min(index + 1, 6)}`
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center mb-4 transition-all group-hover:scale-110",
                theme === "dark" ? "bg-primary/20 group-hover:bg-primary/30" : "bg-primary/10 group-hover:bg-primary/20"
              )}>
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className={cn("text-xl font-semibold mb-2", theme === "dark" ? "text-white" : "text-foreground")}>
                {feature.title}
              </h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-muted/30 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Why Students Love StudySync
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <Check className="h-4 w-4 text-green-500" />
                    </div>
                    <span className="font-medium">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="aspect-video rounded-2xl bg-gradient-to-br from-primary/20 via-purple-500/20 to-pink-500/20 border border-border/50 flex items-center justify-center">
                <div className="text-center">
                  <BookOpen className="h-16 w-16 text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">App Preview</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 md:py-24 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Transform Your Studies?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of students already using StudySync to achieve their academic goals.
          </p>
          <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-10">
            Get Started Free <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-4">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="font-bold">StudySync</span>
          </div>
          <p>© 2025 StudySync. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;