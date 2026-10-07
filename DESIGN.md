# Homarr design context

The existing Mantine theme and shared components are the visual source of truth. Discovery extends the management pages with the same typography, spacing, borders and responsive card grids; it does not introduce a new theme.

## Owners and behavior

- Selects: Mantine Select with visible labels, search and keyboard navigation.
- Forms: explicit Save action, disabled pending controls, inline mutation errors, shared success notifications.
- Secrets: administrator-only reveal action, hide control and explicit confirmation before token rotation.
- Layout: Mantine Stack, Group and SimpleGrid; one column on small screens, two columns where space permits. Long names, addresses and installation commands wrap.
- Media: existing UploadMedia and IconPicker; icon pickers remain image-only, backgrounds allow supported videos.
- Motion: silent looping wallpaper videos pause when hidden, respect reduced motion and expose a pause control.
- Localization: English source messages under the existing translation package; other locales use the established English fallback.

## Verification

Go agent checks run locally. Node, pnpm and browser runtime are unavailable in this environment, so UI behavior, typechecks and browser checks require the project build environment before deployment.
