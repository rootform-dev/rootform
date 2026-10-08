# Documentation contribution data

Documentation previews render an exact public source revision with an approved
shell. Content is data, not a build project: no PR dependencies, scripts, build
configuration, MDX, components or plugins execute with private access or
deployment credentials.

Markdown frontmatter accepts `title`, `description`, `tableOfContents`, `template`
and `draft`. Titles/descriptions are strings; table-of-contents/draft controls
are booleans; templates are `doc` or `splash`. Page-head scripts and component
overrides are not documentation content.

Raw HTML is limited to inert text, anchors, tables, details and local media.
Scripts, styles, event handlers, frames, forms, executable URL schemes, SVG and
internal shell markers are refused. Code inside fenced examples remains text.
Images/videos must resolve to ordinary files within `docs/assets/`, with a
matching PNG/WebP/MP4/WebM signature. Remote images, symlinks, special
files and traversal beyond the documentation tree are refused.

Documentation directives support directories, steps, tabs and local videos.
CI recipe scripts/YAML are validated on public read-only runners; the preview
does not execute them. Navigation and capture metadata are JSON data.

Each Markdown file is limited to 2 MiB, media to 32 MiB, and one documentation
input to 2,000 files / 128 MiB. A rejected preview identifies a content
validation problem; no private build log or repository access is required.
