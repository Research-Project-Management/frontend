import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { motion, AnimatePresence, LayoutGroup } from "framer-motion"

import { cn } from "~/lib/utils"

type TabsVariant = "underline" | "pill"

const TabsContext = React.createContext<{ 
  value?: string;
  variant: TabsVariant;
  onValueChange?: (v: string) => void;
  instanceId: string;
}>({ variant: "underline", instanceId: "" })

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> & { variant?: TabsVariant }
>(({ value: propValue, onValueChange: propOnValueChange, defaultValue, variant = "underline", children, ...props }, ref) => {
  const [internalValue, setInternalValue] = React.useState(propValue || defaultValue)
  const id = React.useId()

  // Sync internal state with prop if controlled
  React.useEffect(() => {
    if (propValue !== undefined) setInternalValue(propValue)
  }, [propValue])

  const handleValueChange = React.useCallback((v: string) => {
    setInternalValue(v)
    propOnValueChange?.(v)
  }, [propOnValueChange])

  return (
    <TabsContext.Provider value={{ value: internalValue, variant, onValueChange: handleValueChange, instanceId: id }}>
      <TabsPrimitive.Root
        ref={ref}
        value={internalValue}
        onValueChange={handleValueChange}
        {...props}
      >
        {children}
      </TabsPrimitive.Root>
    </TabsContext.Provider>
  )
})
Tabs.displayName = TabsPrimitive.Root.displayName

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const { variant, instanceId } = React.useContext(TabsContext)

  return (
    <LayoutGroup id={instanceId}>
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          "inline-flex items-center text-muted-foreground",
          variant === "underline" && "w-full justify-start border-b border-border bg-transparent p-0",
          variant === "pill" && "h-9 justify-center rounded-lg bg-muted/50 p-1",
          className
        )}
        {...props}
      />
    </LayoutGroup>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, value, ...props }, ref) => {
  const { value: activeValue, variant, instanceId } = React.useContext(TabsContext)
  const isActive = activeValue === value

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn(
        "relative inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variant === "underline" && "px-4 py-3 data-[state=active]:text-foreground hover:text-foreground/80",
        variant === "pill" && "flex-1 px-3 py-1 rounded-md text-muted-foreground data-[state=active]:text-primary-foreground hover:bg-muted/30 transition-colors duration-200",
        className
      )}
      {...props}
    >
      <span className="relative z-10">{props.children}</span>
      {isActive && (
        <motion.div
           layoutId={`activeTabMarker-${instanceId}`}
           className={cn(
              "absolute z-0",
              variant === "underline" && "bottom-0 left-0 right-0 h-[2px] bg-primary",
              variant === "pill" && "inset-0 rounded-md bg-foreground shadow-sm"
           )}
           initial={false}
           transition={{ 
             type: "spring", 
             stiffness: 450, 
             damping: 30,
             mass: 0.8
           }}
        />
      )}
    </TabsPrimitive.Trigger>
  );
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  >
     <AnimatePresence mode="wait">
       <motion.div
          key={props.value}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
       >
          {props.children}
       </motion.div>
     </AnimatePresence>
  </TabsPrimitive.Content>
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
