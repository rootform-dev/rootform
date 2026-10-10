# Google Cloud icon-license spike

- Date: 2026-10-10
- Result: Pass

## Question

Can the Explorer, its HTML export and the Playground present Google Cloud
resources with the official Google Cloud product icons?

## Verdict

Yes. Google publishes its product icons on its official icons page for Google
Cloud architecture diagrams and technical documentation, and its product icon
guide assigns each product an icon: a core product carries its unique icon and
every other product the icon of its category. The renderer icon pack embeds
the selected SVG files exactly as published, beside a usage notice that
records the archives, the guide and their digests. It never uses them as
Rootform identity.

The Google presentation catalog maps 197 of 217 Rules and 58 of 70 Concepts
to these identities. Twenty Rules keep a neutral symbol because the library
has no icon for their product: the Google Cloud project, Firebase Realtime
Database, Oracle Database@Google Cloud, Colab Enterprise, Compliance Manager,
Developer Connect, Secure Source Manager, Cloud Source Repositories and
multicast. Concepts shared by products with different icons, or produced by
no Rule, keep their generic identity. A product the guide does not list takes
its category from the Google Cloud products catalog.

## Evidence

```text
official page: https://cloud.google.com/icons
core product icons: https://services.google.com/fh/files/misc/core-products-icons.zip
core archive SHA-256: 6531a10f58bc599c24d9a455d81dd757c1a03c3c43da9cddf639b859c1c1eece
category icons: https://services.google.com/fh/files/misc/category-icons.zip
category archive SHA-256: e5bc3abd3527dc2500e9bff7f15870783e2c764129c49b7cd4c1b4e105345002
product icon guide: https://services.google.com/fh/files/misc/google-cloud-product-icons.pdf
guide SHA-256: 3cea6ac3abf8183462addffc2e3533a4c75f681f91981a2061131cbdc0c800a0
guide updated: 2026-05
downloaded: 2026-10-10
```
