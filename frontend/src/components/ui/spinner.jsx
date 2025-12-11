import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "../../lib/utils"

const Spinner = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <Loader2
      ref={ref}
      className={cn("animate-spin", className)}
      {...props}
    />
  )
})
Spinner.displayName = "Spinner"

export { Spinner }

