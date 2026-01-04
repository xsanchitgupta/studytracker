import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export const useStudyLogger = () => {
  // Call this function when a video ends or timer stops
  const logSession = async (userId: string, minutes: number, subject: string = "General") => {
    if (!userId || minutes <= 0) return;

    try {
      await addDoc(collection(db, "users", userId, "study_logs"), {
        minutes,
        subject, // e.g., "Math", "Physics" (derive from playlist title)
        createdAt: serverTimestamp(),
        date: new Date().toISOString() // ISO string for easier client-side filtering
      });
      console.log("Logged study session");
    } catch (error) {
      console.error("Failed to log session:", error);
    }
  };

  return { logSession };
};