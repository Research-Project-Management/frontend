import { motion, type Variants, type BezierDefinition } from "framer-motion";
import { cn } from "~/lib/utils";

interface FluxLogoProps {
  className?: string;
  animate?: boolean;
}

export function FluxLogo({ className, animate = true }: FluxLogoProps) {
  const containerVariants: Variants = {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const pathVariants: Variants = {
    initial: { opacity: 0, scale: 0.8 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1] as BezierDefinition, // ease-out-expo
      },
    },
    hover: {
      scale: 1.05,
      transition: { duration: 0.3 },
    },
  };

  return (
    <motion.svg
      width="200"
      height="200"
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-24", className)}
      variants={containerVariants}
      initial="initial"
      animate={animate ? "animate" : "initial"}
      whileHover="hover"
      key={animate ? "animated-logo" : "static-logo"}
    >
      <motion.path
        d="M0 130H41.5556C49.2875 130 55.5556 136.268 55.5556 144V200H14C6.26802 200 0 193.732 0 186V130Z"
        fill="#FFCB2C"
        variants={pathVariants}
      />
      <motion.path
        d="M144.444 0H192C196.418 0 200 3.58172 200 8V166C200 184.778 184.778 200 166 200H144.444V0Z"
        fill="#3370FF"
        variants={pathVariants}
      />
      <motion.path
        d="M0 34C0 15.2223 15.2223 0 34 0H150V50H0V34Z"
        fill="#3370FF"
        variants={pathVariants}
      />
      <motion.path
        d="M72.2222 65H119.778C124.196 65 127.778 68.5817 127.778 73V182C127.778 191.941 119.719 200 109.778 200H72.2222V65Z"
        fill="#F97802"
        variants={pathVariants}
      />
      <motion.path
        d="M0 83C0 73.0589 8.05888 65 18 65H77V115H0V83Z"
        fill="#F97802"
        variants={pathVariants}
      />
    </motion.svg>
  );
}
