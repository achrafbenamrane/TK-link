# Styling (NativeWind 4 + Reanimated 4)

## NativeWind

- Style via `className` exclusively. Static inline `style` objects and
  `StyleSheet.create` in features are review-rejected; `style` is allowed only
  for values that _must_ be dynamic at runtime (e.g. safe-area insets in
  `Screen`).
- Conditional classes use `cn()` from `@/shared/lib/cn` (clsx + tailwind-merge)
  — never string templates.
- Tokens live in `tailwind.config.js` (colors `brand/surface/ink/danger/
success`, fonts `sans*`, radii `card/control`). **Never hardcode a hex color
  or raw font name in a component.** The rare imperative color comes from
  `@/shared/theme/colors.ts` (kept in sync with the Tailwind palette).
- Dark mode: tokens are designed to be remapped; when dark mode lands, it'll
  be via CSS variables in `global.css` + a `dark:` variant pass — see the ADR
  process before improvising.
- NativeWind v4 targets Tailwind CSS v3 (v5/v4 migration tracked in an ADR
  when it goes stable).
- **A class that has never been used in the repo does nothing until Metro
  rebuilds the stylesheet.** Tailwind generates only the utilities it finds in
  the source; a running dev client keeps the stylesheet it was given. Adding a
  brand-new utility (say `h-52` when the repo only ever used `h-44`) therefore
  fails **silently** — the value is simply absent, so the element gets no
  height, no padding, no color, and nothing warns you. Restart with
  `npx expo start --clear` after introducing one.
- **A dimension the layout cannot survive without does not belong in a class
  you are inventing.** It cost us a broken flash-sale card in front of the
  client: the image block collapsed to zero height, the countdown overlapped
  the merchant name, and the discount badge was clipped away. Where the whole
  component falls apart without it, pass the value through `style` — that is
  exactly the "must be dynamic" exemption above, and it cannot be lost to a
  stale build (`FlashCard`'s `IMAGE_HEIGHT`).

## Component hierarchy

1. Reach for a shared primitive first: `AppText`, `Button`, `Screen`,
   `TextField` (`@/shared/ui`).
2. Need a variant? Extend the primitive's variant map — don't fork styling at
   the call site.
3. Genuinely feature-specific UI lives in `features/X/ui/` and _composes_
   primitives.

## Animation rules (Reanimated 4)

- Reanimated 4 requires the New Architecture (mandatory since SDK 55) and
  `react-native-worklets` — both already configured; the Babel plugin is
  auto-wired by `babel-preset-expo`. Don't touch `babel.config.js` for it.
- Prefer layout/entering animations (`FadeInDown`, etc.) for lists; use
  `useAnimatedStyle` + `withTiming/withSpring` for interaction feedback.
- All animation math runs in worklets on the UI thread — never `setState`
  per frame.
- Respect `useReducedMotion()`; gate decorative motion behind it.
- Jest support comes from `setUpTests()` in `jest.setup.ts`.

## Typography

Inter via `@expo-google-fonts/inter`, loaded once in the root layout. Use
`AppText` variants (`display/title/body/caption/label`) — raw `<Text>` is
reserved for `shared/ui` internals. User-facing copy uses typographic
apostrophes (’) — docs-lint enforces. Details:
[../conventions/design-system.md](../conventions/design-system.md).
