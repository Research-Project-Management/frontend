import { useNavigation } from "react-router";
import { useEffect, useRef, useState } from "react";

export default function NavigationProgress() {
  const navigation = useNavigation();
  const isNavigating = navigation.state === "loading";
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isNavigating) {
      // Start progress
      setVisible(true);
      setProgress(10);

      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          // Slow down as it approaches 90
          const increment = Math.max(1, (90 - prev) * 0.1);
          return Math.min(prev + increment, 90);
        });
      }, 200);
    } else if (visible) {
      // Navigation complete — jump to 100 and fade out
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(100);

      timeoutRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isNavigating]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[2px] pointer-events-none">
      <div
        className="h-full bg-primary transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
