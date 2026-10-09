# AWS icon-license spike

- Date: 2026-08-29
- Result: Pass
- Status: superseded by the decision update of 2026-10-09

## Question

Do current official AWS terms clearly permit Rootform to redistribute and
mechanically optimize raw AWS Architecture Icon SVGs inside its binary/web pack?

## Verdict

No. AWS explicitly allows customers and partners to use current toolkits and
assets to create architecture diagrams and materials such as whitepapers,
presentations, data sheets, and posters. Current AWS Intellectual Property
License separately prohibits modifying, distributing, or creating derivative
works from AWS Content unless a separate license expressly permits it. The icon
page does not clearly grant redistribution of raw assets inside another
software product or modification through SVG optimization.

Rootform therefore vendors no AWS icon. AWS presentation identities
remain data-only and resolve through neutral local fallback. This preserves
semantics, offline operation, and provider-neutral rendering. Generated diagrams
may be reconsidered separately, but raw asset bundling needs written permission
or clearer official terms.

## Evidence

```text
official page: https://aws.amazon.com/architecture/icons/
archive: Icon-package_07312026.zip
archive bytes: 13,988,918
archive SHA-256: d2d166c453526471749d520e0db022c459abef759d2946cf2dd1d1c992dc6526
page snapshot SHA-256: 256bb7252eff6f58badc6585d25d944239f46367e447d23e988160f31bdd52a5
IP license updated: 2025-10-27
```

Official sources:

- <https://aws.amazon.com/architecture/icons/>
- <https://aws.amazon.com/legal/aws-ip-license-terms/>
- <https://aws.amazon.com/legal/trademark-guidelines/>

## Reconsideration trigger

Written AWS permission or a separate official architecture-icon license that
expressly permits raw redistribution and required transformations.

## Decision update (2026-10-09)

Rootform now uses the official AWS Architecture Icons in the Explorer and the
Playground. The renderer icon pack ships 70 SVG files selected from
`Icon-package_07312026` exactly as published: no optimization, recoloring or
other transformation. The renderer bundle carries the AWS usage notice and lists
the icons in its third-party inventory.

The AWS presentation catalog maps 106 of 108 Rules and every mapped Concept to
these identities. The `subnet` and `security-group` Rules keep a neutral
symbol: AWS draws a security group as a group border, and its subnet icons
assert public or private exposure, which these Rules do not establish. Concepts
shared by several AWS services, such as managed caches, managed database
components and managed file storage, also stay neutral because no single
service icon describes them.
