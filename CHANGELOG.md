# Changelog

## Unreleased

- Rootform is built with Go 1.26.9 and golang.org/x/net 0.61.0, which fix denial-of-service vulnerabilities in HTTP and TLS handling (CVE-2026-78667, CVE-2026-78669 and CVE-2026-97031).

## 0.2.1

- The AWS Dialect presents AWS resources with the official AWS Architecture
  Icons, and the Azure Dialect presents node pools, blob containers, storage
  queues, public IP addresses and virtual network peerings with official Azure
  icons.
- The Google Cloud Dialect presents Google Cloud resources with the official
  Google Cloud product icons: a core product shows its own icon and other
  products the icon of their category. A product without an icon in the
  library, such as the Google Cloud project, keeps a neutral symbol.
- Exported HTML pages draw the official provider icons instead of a neutral
  symbol.
- Explorer boxes keep to two rows, the label and then the resource kind, and
  widen a little for a long label. The module path moves to the tooltip and
  the Inspector.
- In planned changes and comparisons, a container without a change of its own
  shows a compact tally of the changes it holds, by kind of change.

## 0.2.0

- Analyze Terraform and OpenTofu plan and state exports into portable Forms,
  with stage architectures, comparisons, drift, evidence and explicit limits.
- Explore architectures locally or through a self-contained HTML export.
  A reopened Form keeps provider icons and labels when it records the
  Dialects embedded in the same release.
- Explain instances, Rules and recorded Policy outcomes with their provenance.
- Evaluate selected Policies and Policy Packs against plans, states or
  comparison Forms, with text, Markdown, JSON and SARIF reports.
- Use official Dialects and RF Vocabulary as one immutable release set.
  Acquire selected external content explicitly through exact locks and vendor
  directories; analysis and evaluation remain offline.
- Author, format, validate and test Dialects and Policy Packs with the Rootform
  language tools and language server.
- Use a consistent command interface, explicit exit statuses and bounded
  input documents. Plans, states and Forms larger than 128 MiB are refused.
- Contribute to the Apache-2.0 CLI Go module, public document schemas,
  contracts, official Dialects, documentation and distribution tooling.
