export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (stats: any) => boolean;
};

export const BADGES: Badge[] = [
  {
    id: "first_steps",
    name: "First Steps",
    description: "Watched your first lecture",
    icon: "🌱",
    condition: (stats) => stats.watchedLectures >= 1
  },
  {
    id: "dedicated",
    name: "Dedicated",
    description: "Watched 10 lectures",
    icon: "🎓",
    condition: (stats) => stats.watchedLectures >= 10
  },
  {
    id: "scholar",
    name: "Scholar",
    description: "Completed 5 goals",
    icon: "🏆",
    condition: (stats) => stats.completedGoals >= 5
  },
  {
    id: "marathoner",
    name: "Marathoner",
    description: "Accumulated 10 hours of watch time",
    icon: "⚡",
    condition: (stats) => stats.totalMinutes >= 600
  }
];

export function getEarnedBadges(userStats: { watchedLectures: number; completedGoals: number; totalMinutes: number }) {
  return BADGES.filter(badge => badge.condition(userStats));
}