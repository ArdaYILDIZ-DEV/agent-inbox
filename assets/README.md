# Local design assets

These files are served from relative paths; there are no runtime font or icon CDN requests and no build step. Latin Extended subsets cover Turkish alongside the Latin font files. Commit Mono includes Turkish in its supplied Latin file. All font faces use `font-display: swap` and have system fallbacks.

- **Newsreader**: variable weight (200–800), normal and italic, Latin + Latin Extended. [Fontsource 5.2.8](https://cdn.jsdelivr.net/npm/@fontsource-variable/newsreader@5.2.8/index.css); SIL OFL 1.1 in `licenses/newsreader.txt`.
- **Instrument Sans**: variable weight (400–700), normal, Latin + Latin Extended. [Fontsource 5.2.8](https://cdn.jsdelivr.net/npm/@fontsource-variable/instrument-sans@5.2.8/index.css); SIL OFL 1.1 in `licenses/instrument-sans.txt`.
- **Commit Mono**: regular (400). [Fontsource 5.3.0](https://cdn.jsdelivr.net/npm/@fontsource/commit-mono@5.3.0/400.css); SIL OFL 1.1 in `licenses/commit-mono.txt`.
- **Phosphor Light**: seven unmodified icon paths combined into `icons.svg` symbols (256 × 256 viewBox). [Phosphor Core 2.1.1 source directory](https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/light/); MIT in `licenses/phosphor.txt`.

The font files were downloaded from the matching pinned packages' `files/` directories. The SVG sprite is used only for interface icons; all controls retain text or accessible names. No icon JavaScript or icon font is needed.
