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

## Personal documentation identity

The public documentation and repository README use the name **My Homarr**, owned by `socilate47/my-homarr`. Their register is a personal homelab field guide, with setup and useful service links ahead of marketing. The application’s existing Mantine design remains its own runtime owner.

Documentation colors are owned by `apps/docs/src/css/custom.css`: ink `#102c44`, light background `#f5f8fc`, primary teal `#087f8c`, and orange `#b65c30`. Dark mode uses background `#101f2c`, surface `#142735`, teal `#63c4c2`, and orange `#edab7c`. System font stacks keep the notes readable without an external font download; monospace labels and port numbers give the site its operator context.

The signature visual is a small illustrative lab board, explicitly labeled as an example. The homepage has three clear routes: setup, discovery and personalization. It uses no fabricated reviews, uptime statistics or upstream funding/partner claims. The logo mark is the repository-native `my-homarr-mark.svg`.

Navigation and edit links point to this repository. Upstream reference content and attribution remain visible. Upstream analytics, assistant widget and search-index configuration are removed; an optional personal Algolia index must be configured explicitly. The docs workflow validates types and broken links and uploads a build artifact without publishing it automatically.
