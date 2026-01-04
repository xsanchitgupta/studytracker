import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Goals from "./pages/goals";
import Playlists from "./pages/Playlists";
import Profile from "./pages/Profile";
import { AdminRoute } from "@/components/AdminRoute";
import AdminPanel from "./pages/AdminPanel";

// NEW IMPORTS
import Leaderboard from "./pages/Leaderboard";
import Chat from "./pages/Chat";
import Performance from "./pages/Performance";
import Flashcards from "./pages/Flashcards";
import Gateway from "./pages/gateway";
import Layout from "./components/Layout"; // Import the new Layout component

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ErrorBoundary>
                <Routes>
                  {/* WRAP EVERYTHING IN LAYOUT */}
                  <Route element={<Layout />}>
                    
                    {/* Public Routes */}
                    <Route path="/" element={<Landing />} />
                    <Route path="/auth" element={<Auth />} />
                    
                    {/* Gateway (Role Redirection) */}
                    <Route path="/gateway" element={<Gateway />} />
                    
                    {/* Admin Routes */}
                    <Route
                      path="/admin"
                      element={
                        <AdminRoute>
                          <AdminPanel />
                        </AdminRoute>
                      }
                    />

                    {/* Protected User Routes */}
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <Dashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/goals"
                      element={
                        <ProtectedRoute>
                          <Goals />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/playlists"
                      element={
                        <ProtectedRoute>
                          <Playlists />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/leaderboard"
                      element={
                        <ProtectedRoute>
                          <Leaderboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/chat"
                      element={
                        <ProtectedRoute>
                          <Chat />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/performance"
                      element={
                        <ProtectedRoute>
                          <Performance />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/flashcards"
                      element={
                        <ProtectedRoute>
                          <Flashcards />
                        </ProtectedRoute>
                      }
                    />

                    {/* 404 Route */}
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </ErrorBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;