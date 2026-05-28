import React from "react";
import { cn } from "~/lib/utils";

interface FluxIconProps extends React.SVGProps<SVGSVGElement> {
  colored?: boolean;
}

export function FluxIcon({ className, colored = true, ...props }: FluxIconProps) {
  return (
    <svg
      viewBox="0 0 250 250"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4 shrink-0 rounded-full", className)}
      {...props}
    >
      <g clipPath="url(#clip0_216_31)">
        {/* If monochrome/currentColor is requested, we keep the background transparent */}
        <rect width="250" height="250" rx="125" fill={colored ? "white" : "transparent"} />
        <g filter="url(#filter0_f_216_31)">
          <path
            d="M6 159.75H58.1111C65.8431 159.75 72.1111 166.018 72.1111 173.75V242H20C12.268 242 6 235.732 6 228V159.75Z"
            fill={colored ? "#FFCB2C" : "currentColor"}
          />
          <path
            d="M177.889 7H234.48C239.738 7 244 11.2085 244 16.4V202.05C244 224.114 225.885 242 203.54 242H177.889V7Z"
            fill={colored ? "#3370FF" : "currentColor"}
          />
          <path
            d="M6 46.95C6 24.8862 24.1146 7 46.46 7H184.5V65.75H6V46.95Z"
            fill={colored ? "#3370FF" : "currentColor"}
          />
          <path
            d="M91.9444 83.375H148.536C153.793 83.375 158.056 87.5835 158.056 92.775V220.85C158.056 232.531 148.465 242 136.636 242H91.9444V83.375Z"
            fill={colored ? "#F97802" : "currentColor"}
          />
          <path
            d="M6 104.525C6 92.8442 15.5901 83.375 27.42 83.375H97.63V142.125H6V104.525Z"
            fill={colored ? "#F97802" : "currentColor"}
          />
        </g>
      </g>
      <defs>
        <filter
          id="filter0_f_216_31"
          x="-66.5"
          y="-65.5"
          width="383"
          height="380"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="36.25" result="effect1_foregroundBlur_216_31" />
        </filter>
        <clipPath id="clip0_216_31">
          <rect width="250" height="250" rx="125" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
