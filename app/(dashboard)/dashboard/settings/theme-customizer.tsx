"use client"

import { useTransition, useState } from "react"
import { Check, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  THEME_PRESET_LIST,
  type ThemePresetName,
  normalizeHex,
} from "@/lib/theme"
import { updateStoreThemeAction, type StoreThemeActionState } from "./actions"

interface ThemeCustomizerProps {
  initialTheme: {
    themePreset: ThemePresetName
    primaryColor: string
    accentColor: string
  }
}

export function ThemeCustomizer({ initialTheme }: ThemeCustomizerProps) {
  const [themePreset, setThemePreset] = useState<ThemePresetName>(
    initialTheme.themePreset
  )
  const [primaryColor, setPrimaryColor] = useState(initialTheme.primaryColor)
  const [accentColor, setAccentColor] = useState(initialTheme.accentColor)
  const [error, setError] = useState<string | undefined>()
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  // A preset is "active" when its colors exactly match the current colors.
  const activePreset = THEME_PRESET_LIST.find(
    (p) =>
      normalizeHex(primaryColor) === p.primaryColor &&
      normalizeHex(accentColor) === p.accentColor
  )?.name

  function selectPreset(name: ThemePresetName) {
    const preset = THEME_PRESET_LIST.find((p) => p.name === name)
    if (!preset) return
    setThemePreset(name)
    setPrimaryColor(preset.primaryColor)
    setAccentColor(preset.accentColor)
    setSaved(false)
  }

  function handlePrimaryChange(value: string) {
    setPrimaryColor(value)
    setSaved(false)
  }

  function handleAccentChange(value: string) {
    setAccentColor(value)
    setSaved(false)
  }

  function handleSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const result = await updateStoreThemeAction(
        {} as StoreThemeActionState,
        formData
      )
      if (result.error) {
        setError(result.error)
      } else {
        setSaved(true)
      }
    })
  }

  // Normalize for the preview (fall back to current value so typing is fluid).
  const previewPrimary = normalizeHex(primaryColor) ?? primaryColor
  const previewAccent = normalizeHex(accentColor) ?? accentColor

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* ── Controls ── */}
      <form action={handleSubmit} className="space-y-6">
        <input type="hidden" name="themePreset" value={themePreset} />
        <input type="hidden" name="primaryColor" value={previewPrimary} />
        <input type="hidden" name="accentColor" value={previewAccent} />

        <div className="space-y-3">
          <Label>Theme preset</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {THEME_PRESET_LIST.map((preset) => {
              const active = preset.name === activePreset
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => selectPreset(preset.name)}
                  aria-pressed={active}
                  className={[
                    "flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors",
                    active
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/40",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-6 w-6 rounded-full border"
                      style={{ backgroundColor: preset.primaryColor }}
                      aria-hidden
                    />
                    <span
                      className="h-6 w-6 rounded-full border"
                      style={{ backgroundColor: preset.accentColor }}
                      aria-hidden
                    />
                    {active && (
                      <Check className="ml-auto h-4 w-4 text-primary" />
                    )}
                  </div>
                  <span className="text-sm font-medium">{preset.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {preset.description}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField
            id="primaryColor"
            label="Primary color"
            value={primaryColor}
            onChange={handlePrimaryChange}
          />
          <ColorField
            id="accentColor"
            label="Accent color"
            value={accentColor}
            onChange={handleAccentChange}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && (
          <p className="text-sm text-emerald-600">Theme saved successfully.</p>
        )}

        <Button type="submit" disabled={isPending}>
          <Save />
          {isPending ? "Saving..." : "Save theme"}
        </Button>
      </form>

      {/* ── Live preview ── */}
      <div className="space-y-3">
        <Label>Live preview</Label>
        <StorefrontPreview
          primaryColor={previewPrimary}
          accentColor={previewAccent}
        />
      </div>
    </div>
  )
}

/** Hex color input paired with a native color picker swatch. */
function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const normalized = normalizeHex(value) ?? "#000000"
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={normalized}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} picker`}
          className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#334155"
          className="font-mono uppercase"
        />
      </div>
    </div>
  )
}

/**
 * Miniature storefront product page preview. Colors are applied via CSS
 * variables scoped to this container so they never leak to the dashboard.
 */
function StorefrontPreview({
  primaryColor,
  accentColor,
}: {
  primaryColor: string
  accentColor: string
}) {
  return (
    <div
      className="overflow-hidden rounded-lg border bg-background text-foreground"
      style={
        {
          "--primary": primaryColor,
          "--accent": accentColor,
          "--primary-foreground": "#ffffff",
          "--accent-foreground": "#ffffff",
        } as React.CSSProperties
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: "var(--primary)" }}
            aria-hidden
          />
          <span className="text-xs font-semibold">ShopNova</span>
        </div>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-foreground)]"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Cart
        </span>
      </div>

      {/* Product */}
      <div className="grid grid-cols-2 gap-3 p-3">
        <div
          className="aspect-square rounded-md"
          style={{
            backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
          }}
          aria-hidden
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-medium text-muted-foreground">
            Electronics
          </span>
          <span className="text-xs font-semibold">Wireless Headphones</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold">R 199.99</span>
            <span className="text-[10px] text-muted-foreground line-through">
              R 249.99
            </span>
          </div>
          <span
            className="mt-1 w-fit rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-foreground)]"
            style={{ backgroundColor: "var(--accent)" }}
          >
            Sale
          </span>
          <button
            type="button"
            className="mt-1.5 rounded-md px-2 py-1 text-[10px] font-medium text-[var(--primary-foreground)]"
            style={{ backgroundColor: "var(--primary)" }}
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  )
}
