import * as React from "react"
import { cn } from "../../lib/utils"

const ButtonGroup = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("inline-flex rounded-md shadow-sm [&>button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>button:not(:first-child)]:ml-[-1px]", className)}
      role="group"
      {...props}
    />
  )
})
ButtonGroup.displayName = "ButtonGroup"

export { ButtonGroup }

