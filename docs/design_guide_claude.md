# Maeri Control Centre — Design Guide

> For prompting Claude to replicate UI. All values are extracted from the live codebase.

---

## Design Tokens

### Colors
```
Brand Primary:   #d57282   (buttons, active states, accents)
Brand Hover:     #ce5a56   (primary button hover)
Brand Light:     #f9e8eb   (hover backgrounds, badge fills, tinted containers)
Brand Pale:      #fdf5f7   (very subtle backgrounds)

Page BG:         #fffbf6   (warm cream — page body)
Sidebar BG:      #faf7f5   (warm white — sidebar, table headers, section fills)
Card BG:         #ffffff

Text Primary:    #525252   (headings, body, strong labels)
Text Muted:      #8a8a8a   (secondary labels, helper text)
Text Faint:      #b8a0a0   (tertiary, timestamps, placeholders)

Border:          #E2E2E2   (cards, inputs, dividers)
Border Light:    #f0eae6   (internal dividers, modal body separators)

Success:         #27a559 / bg #f0faf4
Error:           #e05252 / bg #fff0f0
Warning:         #d4600a / bg #fff3e8
Info:            #1a8fde / bg #e8f5ff
```

### Typography
```
Font:   Poppins (weights 300,400,500,600,700), fallback sans-serif

Page title:         16px / 600
Section header:     14px / 600
Body:               14px / 400
Helper/label:       12px / 400 / #8a8a8a
Form label:         10px / 500 / uppercase / tracking-widest / #8a8a8a
Table header:       12px / 600
Metric value:       24px / 600
Badge/chip:         11–12px / 500–600
```

### Shadows
```
Card:       0 2px 16px rgba(213,114,130,0.07)
Modal:      0 8px 40px rgba(0,0,0,0.18)
Button:     0 4px 14px rgba(213,114,130,0.28)
Btn hover:  0 6px 18px rgba(206,90,86,0.35)
Dropdown:   0 8px 24px rgba(0,0,0,0.10)
Header:     0 1px 0 #E2E2E2, 0 2px 8px rgba(213,114,130,0.04)
Panel:      -4px 0 32px rgba(0,0,0,0.10)   ← right slide-in panels
```

### Border Radius
```
Cards / Modals:     rounded-2xl  (~18px)
Inputs / Selects:   rounded-xl   (12px)
Small buttons:      rounded-lg   (8px)
Primary CTA:        22px pill    (border-radius: 22px)
Badges / chips:     rounded-full
```

---

## Components

### Card
```jsx
// Standard card shell
<div style={{
  background: '#fff',
  border: '1px solid #E2E2E2',
  borderRadius: '18px',          // rounded-2xl
  boxShadow: '0 2px 16px rgba(213,114,130,0.07)',
  padding: '20px',               // p-5
}}>
  {/* Optional card header */}
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
    <div style={{ width: 3, height: 14, borderRadius: 2, background: '#d57282' }} />
    <span style={{ fontSize: 14, fontWeight: 600, color: '#525252' }}>Section Title</span>
  </div>
</div>
```
- Hover: `hover:-translate-y-px transition-all duration-200` (subtle lift)
- Section bg (inside card): `#faf7f5`, border `1px solid #f0eae6`, rounded-xl, p-4

---

### Button — Primary
```jsx
<button style={{
  background: '#d57282',
  color: '#fff',
  borderRadius: 22,
  padding: '10px 20px',
  fontSize: 14, fontWeight: 600,
  border: 'none',
  boxShadow: '0 4px 14px rgba(213,114,130,0.28)',
  transition: 'all 200ms',
  cursor: 'pointer',
}}>
  Label
</button>
// Hover: background #ce5a56, shadow '0 6px 18px rgba(206,90,86,0.35)', translateY(-1px)
// Disabled: opacity 0.6, no shadow
```

### Button — Secondary (outline)
```jsx
<button style={{
  background: '#fff',
  color: '#525252',
  border: '1px solid #E2E2E2',
  borderRadius: 12,           // rounded-xl
  padding: '8px 16px',
  fontSize: 14, fontWeight: 500,
  cursor: 'pointer',
}}>
  Label
</button>
// Hover: background #f9e8eb
```

### Button — Icon/Ghost
```jsx
<button className="w-7 h-7 rounded-lg flex items-center justify-center text-[#b8a0a0] hover:bg-[#f0e8e8] transition-colors">
  <Icon size={15} />
</button>
```

---

### Badge / Status Pill
```jsx
// Pattern: text-[11px] font-semibold px-2 py-0.5 rounded-full
// Colors depend on semantic meaning:

// Success / Delivered
{ background: '#f0faf4', color: '#27a559' }
// Error / RTO / Out of stock
{ background: '#fff0f0', color: '#e05252' }
// Warning / Low stock
{ background: '#fff3e8', color: '#d4600a' }
// Info / In Transit
{ background: '#e8f5ff', color: '#1a8fde' }
// New / Pending
{ background: '#f0f4ff', color: '#4a6cf7' }
// Neutral / Muted
{ background: '#f5f0ed', color: '#8a8a8a' }
// Brand / Active
{ background: '#f9e8eb', color: '#d57282' }
```

---

### Input — Text
```jsx
<input style={{
  width: '100%',
  background: '#fafafa',
  border: '1px solid #E2E2E2',
  borderRadius: 12,
  padding: '10px 16px',
  fontSize: 14,
  color: '#525252',
  outline: 'none',
}} />
// Focus: border-color #d57282, box-shadow '0 0 0 3px rgba(213,114,130,0.1)'
// Placeholder color: #c0b8b8
```

### Input — Form Label (always above input)
```jsx
<label style={{
  display: 'block',
  fontSize: 10,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.065em',
  color: '#8a8a8a',
  marginBottom: 6,
}}>
  Field Name
</label>
```

### Input — Stepper (number with +/- buttons)
```jsx
// Container: flex items-center border border-[#E2E2E2] rounded-xl overflow-hidden
// Minus/Plus buttons: px-3 py-2, color #d57282, hover:bg-[#f5f0ed]
// Center input: text-sm font-semibold text-center, no border/bg, flex-1
```

### Textarea
```jsx
<textarea style={{
  background: '#fff',
  border: '1px solid #E2E2E2',
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 14,
  resize: 'none',
}} />
// Character counter below: text-xs text-right mt-1, color #c0b8b8
```

---

### Dropdown / Select
```jsx
// Trigger button: full-width, flex justify-between items-center, px-4 py-2.5,
//   border '1px solid #E2E2E2', rounded-xl, text-sm
//   placeholder color #c0b8b8, value color #525252
//   chevron rotates 180deg when open

// Dropdown menu:
{
  position: 'absolute', top: '100%', marginTop: 4,
  background: '#fff',
  border: '1px solid #E2E2E2',
  borderRadius: 12,
  boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
  zIndex: 50, minWidth: 180,
}

// Menu item: px-3 py-2, text-sm, color #525252
// Selected item: color #d57282, fontWeight 600
// Hover item: background #f9e8eb
```

---

### Modal
```jsx
// Backdrop
<div style={{
  position: 'fixed', inset: 0, zIndex: 50,
  background: 'rgba(0,0,0,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
}}>
  {/* Content box */}
  <div style={{
    background: '#fff',
    borderRadius: 18,
    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
    width: '100%', maxWidth: 448,   // or 512 for lg
    overflow: 'hidden',
  }}>
    {/* Header */}
    <div style={{
      padding: '20px 24px 16px',
      borderBottom: '1px solid #f0eae6',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#525252' }}>Modal Title</span>
      {/* Close: p-1 rounded-lg hover:bg-[#f5f0ed], X icon 16px, color #8a8a8a */}
    </div>
    {/* Body */}
    <div style={{ padding: '20px 24px' }}>
      {/* space-y-4 between fields */}
    </div>
    {/* Footer */}
    <div style={{ padding: '0 24px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {/* Secondary button + Primary button */}
    </div>
  </div>
</div>
```

---

### Toast
```jsx
// Position: fixed top-5 right-5 z-[999], max-w-sm

<div style={{
  background: '#fff',
  border: '1px solid #d1f0de',   // or #fdd8d8 for error
  borderRadius: 18,
  boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
  padding: '14px 16px',
  display: 'flex', alignItems: 'flex-start', gap: 12,
}}>
  {/* Icon circle: w-6 h-6 rounded-full flex items-center justify-center mt-0.5 shrink-0 */}
  {/* Success: bg #f0faf4, icon #27a559 | Error: bg #fff0f0, icon #e05252 */}

  {/* Content */}
  <div style={{ flex: 1, minWidth: 0 }}>
    <p style={{ fontSize: 14, fontWeight: 600, color: '#525252' }}>Title</p>
    <p style={{ fontSize: 12, color: '#8a8a8a', marginTop: 2 }}>Message</p>
  </div>

  {/* Close: p-0.5 rounded-md hover:bg-[#f5f0ed], X icon 13px, color #8a8a8a */}
</div>
```

---

### Table
```jsx
// Wrapper: overflow-x-auto, w-full

// thead: background #faf7f5, border-bottom 2px solid #E2E2E2
// th: px-4 py-3, text-xs font-semibold, color #525252

// tbody tr: border-bottom 1px solid #f0eae6, hover:bg-[#faf7f5]
// td: px-4 py-3, text-sm, color #525252

// Empty state: text-sm color #8a8a8a, py-12 text-center
```

---

### Chart (Recharts)

**Shared config for all charts:**
```jsx
// CartesianGrid: strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}
// XAxis/YAxis: axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8a8a8a' }}
// Tooltip: contentStyle={{ background:'#fff', border:'1px solid #E2E2E2',
//           borderRadius:10, fontSize:12, boxShadow:'0 4px 16px rgba(0,0,0,0.08)' }}

// Bar: fill="#d57282" radius={[6,6,0,0]} barSize={28}
//   cursor={{ fill: '#f9e8eb' }}

// Pie/Donut colors: Shopify #d57282, Amazon #f4a56e, Offline #8ec9b0, Unknown #c4b0b0

// Horizontal bar chart: layout="vertical"
//   YAxis: type="category" width={140} tick={{ fontSize: 11, fill: '#525252' }}
//   XAxis: type="number"
```

---

### Sidebar Nav Item
```jsx
// Active: background #d57282, color #fff, shadow '0 2px 10px rgba(213,114,130,0.22)'
// Inactive: color #525252, hover:bg-[#f0e8e8]
// Shape: rounded-xl (12px), px-3 py-2.5, text-sm font-medium
// Icon: 17px, transition-all duration-150
```

---

## Key Layout Values

```
Sidebar width:      240px (expanded) / 64px (collapsed)
Header height:      64px (h-16), sticky, z-30
Main content:       flex-1, overflow-y-auto, background #fffbf6
Metric card grid:   grid-cols-2 lg:grid-cols-4 gap-4
Page padding:       p-5 md:p-6
```

---

## Replication Rules

1. **Primary CTAs** always use 22px border-radius (pill), never rounded-xl.
2. **Cards** always have the pink-tint shadow — never flat borders only.
3. **Form labels** always uppercase, 10px, tracking-widest, #8a8a8a.
4. **Focus state** on inputs: border `#d57282` + `0 0 0 3px rgba(213,114,130,0.1)`.
5. **Hover backgrounds** use `#f9e8eb` (brand light) for nav/interactive elements, `#faf7f5` for table rows.
6. **Status colors** always come in a pair: background + matching text (see Badge section).
7. **Dividers** inside cards use `#f0eae6` (not `#E2E2E2` — that's for outer borders).
8. **Tooltip** from `@base-ui/react` — use `render={<div />}` on `TooltipTrigger`, not `asChild`.
9. **Recharts Tooltip `formatter`** — type param is `ValueType`, never type it as `number`.
