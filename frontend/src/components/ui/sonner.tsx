import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useSettingsStore } from "@/stores/useSettingsStore"

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useSettingsStore((s) => s.theme)

  return (
    <Sonner
      theme={theme}
      position="top-center"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--foreground)",
          "--normal-text": "var(--background)",
          "--normal-border": "transparent",
          "--border-radius": "2px",
        } as React.CSSProperties
      }
      toastOptions={{ classNames: { toast: "cn-toast" } }}
      {...props}
    />
  )
}

export { Toaster }
