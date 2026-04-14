import { motion, AnimatePresence } from "framer-motion";
import { FluxLogo } from "./FluxLogo";

interface SplashLoaderProps {
  isLoading: boolean;
}

export function SplashLoader({ isLoading }: SplashLoaderProps) {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
          }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
        >
          <div className="relative">
            {/* Animated Logo */}
            <FluxLogo className="size-32" />

            {/* Glow Effect */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: [0.1, 0.3, 0.1],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"
            />
          </div>

          {/* Text reveal */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="mt-8 flex flex-col items-center gap-2"
          >
            <h1 className="text-2xl font-bold tracking-tighter sm:text-3xl italic">
              FLUX
            </h1>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-[0.3em]">
              Research. Production. Management.
            </p>
          </motion.div>

          {/* Loading bar */}
          <div className="absolute bottom-12 w-48 h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{
                repeat: Infinity,
                duration: 1.5,
                ease: "easeInOut"
              }}
              className="h-full w-full bg-primary"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
