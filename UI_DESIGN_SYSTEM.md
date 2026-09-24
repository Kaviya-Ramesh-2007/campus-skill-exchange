# UI Design System

## Purpose

The shared UI package provides a small, accessible visual foundation for Campus Skill Exchange. It does not contain product screens or domain data.

## Principles

- Use semantic HTML before adding ARIA.
- Use real buttons for actions and real links for navigation.
- Maintain visible keyboard focus.
- Support keyboard navigation and screen readers.
- Provide clear loading, empty, error, and validation states.
- Use contextual language such as “Skills I Can Teach” and “Session Partner”, never fixed participant roles.
- Keep verification, certification, match, and assessment language precise.
- Treat color as supplementary information, never the only signal.

## Tokens

`packages/ui/src/styles.css` defines the initial:

- color tokens;
- spacing scale;
- typography defaults;
- border radii;
- shadows;
- focus styles;
- reduced-motion behavior;
- responsive-friendly primitives.

The token names are prefixed with `cse-` to avoid collisions with feature styles.

## Foundation components

The package currently includes:

- `Button`
- `Input`
- `Card`
- `Badge`
- `Alert`
- `Loading`
- `EmptyState`
- `Avatar`
- `Modal`
- `Toast`

Components are intentionally small and composable. Feature branches must reuse them rather than creating duplicate primitives.

## Accessibility expectations

- Buttons expose disabled and busy states.
- Inputs provide labels, hints, and error relationships.
- Loading indicators use status semantics.
- Alerts use appropriate status/alert roles.
- Modals expose dialog semantics and Escape-key dismissal. A future feature must add focus trapping and focus restoration when a modal is used in a real workflow.
- Empty states use real headings and text, not placeholder data.
- Color contrast must remain readable in supported themes.
- All interactive controls must be reachable and operable by keyboard.

## Product boundary

Prompt 1 adds only the authentication routes and an identity/account view. No profile, skill, matching, payment, product-session, dashboard, admin, or other future feature page exists. Future UI work should add feature components under the web app while keeping shared primitives in `packages/ui`.

## Adding a component

Before adding a shared component, confirm that:

1. It is reusable across at least two future features or required by the application shell.
2. It has a clear API and accessibility behavior.
3. It does not encode a product-specific data model.
4. It has tests and documentation.
5. Existing primitives are not sufficient.
