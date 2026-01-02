import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BookOpen,
  Target,
  Trophy,
  MessageCircle,
  Play,
  TrendingUp,
  Calendar,
  Clock,
  LogOut,
  Settings,
  Bell,
  ChevronRight,
  Flame,
  Star,
  Users,
} from "lucide-react";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  const stats = [
    { label: "Study Streak", value: "7 days", icon: Flame, color: "text-orange-500" },
    { label: "Goals Completed", value: "24/30", icon: Target, color: "text-green-500" },
    { label: "Leaderboard Rank", value: "#42", icon: Trophy, color: "text-yellow-500" },
    { label: "Hours This Week", value: "18.5h", icon: Clock, color: "text-blue-500" },
  ];

  const quickActions = [
    { label: "Study Goals", icon: Target, href: "/goals", color: "bg-gradient-to-br from-green-500 to-emerald-600" },
    { label: "Playlists", icon: Play, href: "/playlists", color: "bg-gradient-to-br from-purple-500 to-violet-600" },
    { label: "Practice Tests", icon: BookOpen, href: "/tests", color: "bg-gradient-to-br from-blue-500 to-cyan-600" },
    { label: "Leaderboard", icon: Trophy, href: "/leaderboard", color: "bg-gradient-to-br from-yellow-500 to-orange-600" },
    { label: "Chat", icon: MessageCircle, href: "/chat", color: "bg-gradient-to-br from-pink-500 to-rose-600" },
    { label: "Performance", icon: TrendingUp, href: "/performance", color: "bg-gradient-to-br from-indigo-500 to-purple-600" },
  ];

  const upcomingTasks = [
    { title: "Complete Math Chapter 5", deadline: "Today, 6:00 PM", progress: 75 },
    { title: "Physics Practice Test", deadline: "Tomorrow, 10:00 AM", progress: 30 },
    { title: "Chemistry Revision", deadline: "Dec 15, 2:00 PM", progress: 0 },
  ];

  const recentActivity = [
    { action: "Completed", subject: "Calculus Quiz", time: "2 hours ago", score: "85%" },
    { action: "Watched", subject: "Organic Chemistry Lecture", time: "5 hours ago" },
    { action: "Started", subject: "Physics Playlist", time: "Yesterday" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              StudySync
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">
                3
              </span>
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
            <Avatar
            className="h-9 w-9 cursor-pointer"
              onClick={() => navigate("/profile")}
            >
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Welcome Section */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              Welcome back, {user?.displayName || user?.email?.split("@")[0] || "Student"}! 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              Ready to crush your goals today?
            </p>
          </div>
          <Button onClick={handleLogout} variant="outline" className="w-fit">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </section>

        {/* Stats Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickActions.map((action) => (
              <Card
                key={action.label}
                className="cursor-pointer hover:scale-105 transition-transform border-border/50 overflow-hidden group"
                onClick={() => navigate(action.href)}
              >
                <CardContent className={`p-4 ${action.color} text-white`}>
                  <action.icon className="h-8 w-8 mb-2" />
                  <p className="font-medium text-sm">{action.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming Tasks */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Upcoming Tasks
                </CardTitle>
                <Button variant="ghost" size="sm">
                  View All <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingTasks.map((task, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.deadline}</p>
                    </div>
                    <span className="text-xs font-medium text-primary">{task.progress}%</span>
                  </div>
                  <Progress value={task.progress} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Recent Activity
                </CardTitle>
                <Button variant="ghost" size="sm">
                  View All <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Star className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{activity.action}</span> {activity.subject}
                    </p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                  {activity.score && (
                    <span className="text-sm font-bold text-green-500">{activity.score}</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Suggested Connections */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Connect with Peers
            </CardTitle>
            <CardDescription>Students with similar rankings and goals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col items-center gap-2 min-w-[80px]">
                  <Avatar className="h-14 w-14 border-2 border-primary">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white">
                      S{i}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-xs font-medium text-center">Student {i}</p>
                  <span className="text-[10px] text-muted-foreground">Rank #{40 + i}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
