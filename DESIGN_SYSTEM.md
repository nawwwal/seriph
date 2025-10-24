# Seriph Design System

## Overview

The Seriph design system is built on a themeable foundation using CSS variables, inspired by the aesthetic of a physical bookshelf for fonts. It emphasizes clarity, legibility, and a distinctive single-accent color approach.

## Theming

### Theme Architecture

Themes are defined using CSS custom properties (CSS variables) that cascade through the entire application. Each theme sets values for core design tokens.

### Core Design Tokens

All themes must define these core tokens:

- `--paper`: Background color (the "paper" your type sits on)
- `--ink`: Primary text and UI element color (the "ink" that draws)
- `--rule`: Border width for structural elements
- `--rhythm`: Base spacing unit for vertical rhythm
- `--radius`: Border radius for rounded corners

### Extended Tokens

For additional flexibility, themes can also define:

- `--accent`: Accent color for interactive elements
- `--muted`: Subdued background color for secondary surfaces
- `--surface`: Alternative surface color
- `--shadow`: Shadow color for depth
- `--focus`: Focus ring color for accessibility

### Available Themes

#### Ink (Default)
Classic yellow paper with teal ink, inspired by vintage notepads.
```css
--paper: #F4F29A;
--ink: #0D7E6C;
```

#### Noir
Dark mode with high contrast for reduced eye strain.
```css
--paper: #0B0B0B;
--ink: #EDEDED;
```

#### Sunset
Warm cream background with burgundy ink.
```css
--paper: #FFF5E6;
--ink: #9C2B31;
```

#### Ocean
Cool blue tones for a calm, professional feel.
```css
--paper: #E7F6FF;
--ink: #0B5D8E;
```

### Adding a New Theme

1. Open `styles/themes.css`
2. Add a new theme block:

```css
[data-theme="your-theme-name"] {
  --paper: #XXXXXX;
  --ink: #XXXXXX;
  --rule: 1.5px;
  --rhythm: 10px;
  --radius: 2px;
  --accent: #XXXXXX;
  --muted: #XXXXXX;
  --surface: #XXXXXX;
  --shadow: rgba(...);
  --focus: #XXXXXX;
}
```

3. Update `components/theme/ThemeProvider.tsx` to include the new theme:

```typescript
export type ThemeName = 'ink' | 'noir' | 'sunset' | 'ocean' | 'your-theme-name';

const themes: { value: ThemeName; label: string }[] = [
  // ... existing themes
  { value: 'your-theme-name', label: 'Your Theme Name' },
];
```

4. Test the theme across all pages to ensure proper contrast and readability.

## Utility Classes

The design system provides semantic utility classes for common patterns:

### Borders
- `.rule` - Standard border using theme color
- `.rule-t`, `.rule-r`, `.rule-b`, `.rule-l` - Directional borders

### Typography
- `.cap-tight` - Tight line-height for large display text
- `.truncate-2` - Truncate text to 2 lines with ellipsis

### Buttons & Interactions
- `.btn-ink` - Button that inverts colors on hover
- `.ink-bg` - Solid background using ink color

### Decorative
- `.cover-stripe` - Decorative striped pattern for font covers
- `.caret` - Adds a right arrow (→) after element
- `.dashed-border` - SVG-based dashed border

### Animations
- `.pulse` - Gentle pulsing animation
- `.pulse-animation` - Slower pulsing animation
- `.slide-in` - Slide in from bottom with fade
- `.fade-in` - Simple fade-in animation

### Progress
- `.progress-bar` - Container for progress indicators
- `.progress-fill` - Fill element for progress bars

### Font Specimens
- `.specimen-container` - Container for font specimens with hover effects
- `.specimen-text` - Main specimen text
- `.specimen-pangram` - Pangram that reveals on hover

### Style Cards
- `.style-card` - Card for displaying font styles with hover lift effect

## Layout Patterns

### Page Structure

All pages follow this structure:

```tsx
<div className="w-screen h-screen flex flex-col">
  <NavBar />
  <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
    <header className="w-full rule-b pb-4 sm:pb-5 md:pb-6">
      {/* Page header */}
    </header>
    
    {/* Optional stats section */}
    <section className="mt-4 sm:mt-6 md:mt-8 rule-t rule-b">
      {/* Stats grid */}
    </section>
    
    <main className="mt-6 sm:mt-8 md:mt-10">
      {/* Main content */}
    </main>
    
    <footer className="mt-8 sm:mt-10 md:mt-12 rule-t pt-4 sm:pt-5 md:pt-6">
      {/* Footer */}
    </footer>
  </div>
</div>
```

### Typography Scale

Use Tailwind's responsive clamp function for fluid typography:

- Display: `text-[clamp(56px,9.5vw,140px)]`
- Headings: `text-2xl sm:text-3xl` or `text-3xl md:text-4xl`
- Body: `text-base sm:text-lg`
- Small: `text-sm` or `text-xs`

### Spacing

Use the `--rhythm` token (10px) for consistent vertical spacing:
- `mt-6 sm:mt-8 md:mt-10` for section spacing
- `gap-[calc(var(--rhythm)*1.2)]` for grid gaps

## Component Patterns

### Buttons

```tsx
<button className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] btn-ink text-sm sm:text-base">
  Button Text
</button>
```

### Cards

```tsx
<div className="rule rounded-[var(--radius)] p-6">
  {/* Card content */}
</div>
```

### Stats

```tsx
<div className="rule-r p-3 sm:p-4">
  <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Label</div>
  <div className="text-2xl sm:text-3xl font-black cap-tight">Value</div>
</div>
```

## Accessibility

- All themes maintain WCAG AA contrast ratios
- Focus states use the `--focus` token with visible outline
- Interactive elements have proper ARIA labels
- Animations respect `prefers-reduced-motion`
- Keyboard navigation is fully supported

## Tailwind Integration

The design system integrates with Tailwind CSS:

```javascript
// tailwind.config.ts
colors: {
  paper: "var(--paper)",
  ink: "var(--ink)",
  accent: "var(--accent)",
  // ...
}
```

Use arbitrary values for theme colors:
- `bg-[var(--paper)]`
- `text-[var(--ink)]`
- `border-[var(--accent)]`

## Best Practices

1. **Always use theme tokens** - Never hardcode colors
2. **Test all themes** - Ensure your component works in all available themes
3. **Maintain hierarchy** - Use font weights and sizes consistently
4. **Responsive first** - Design for mobile, enhance for desktop
5. **Semantic HTML** - Use proper HTML elements for better accessibility
6. **Animation sparingly** - Only animate when it adds value

## Files Reference

- `styles/themes.css` - Theme definitions
- `styles/utilities.css` - Utility classes
- `components/theme/ThemeProvider.tsx` - Theme context and provider
- `components/theme/ThemeSwitcher.tsx` - Theme switching UI
- `app/globals.css` - Global styles and imports
- `tailwind.config.ts` - Tailwind configuration

