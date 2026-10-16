'use client';

import { useRef, useState, useEffect, type ReactNode } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

const snappyEase = [0.16, 1, 0.3, 1] as const;

/**
 * Ensures client-only preferences (such as prefers-reduced-motion) do not cause
 * React SSR hydration mismatch errors between server-rendered HTML and client VDOM.
 */
function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}

interface MotionRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  yOffset?: number;
  once?: boolean;
}

export function MotionReveal({
  children,
  className,
  delay = 0,
  duration = 0.35,
  yOffset = 14,
  once = true,
}: MotionRevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, margin: '-50px 0px' });
  const isHydrated = useHydrated();
  const shouldReduceRaw = useReducedMotion();
  const shouldReduce = isHydrated && Boolean(shouldReduceRaw);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: yOffset }}
      animate={
        shouldReduce
          ? { opacity: 1, y: 0 }
          : isInView
          ? { opacity: 1, y: 0 }
          : { opacity: 0, y: yOffset }
      }
      transition={{
        duration: shouldReduce ? 0.01 : duration,
        delay: shouldReduce ? 0 : delay,
        ease: snappyEase,
      }}
    >
      {children}
    </motion.div>
  );
}

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  delayChildren?: number;
}

export function MotionStaggerContainer({
  children,
  className,
  staggerDelay = 0.06,
  delayChildren = 0.04,
}: StaggerContainerProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px 0px' });
  const isHydrated = useHydrated();
  const shouldReduceRaw = useReducedMotion();
  const shouldReduce = isHydrated && Boolean(shouldReduceRaw);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial='hidden'
      animate={isInView || shouldReduce ? 'visible' : 'hidden'}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: shouldReduce ? 0 : staggerDelay,
            delayChildren: shouldReduce ? 0 : delayChildren,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const isHydrated = useHydrated();
  const shouldReduceRaw = useReducedMotion();
  const shouldReduce = isHydrated && Boolean(shouldReduceRaw);

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: shouldReduce ? 0.01 : 0.3,
            ease: snappyEase,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
