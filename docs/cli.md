# CLI reference

Primary commands:

```text
rootform build <directory>             canonical Architecture IR
rootform build <directory> --format html --output architecture.html
rootform check <directory-or-document> policy evaluation
rootform diff <base> <head>             architecture comparison
rootform run <directory>                local browser explorer
rootform explain <document>             provenance explanation
```

Dialect authoring and local package management:

```text
rootform fmt [directory] --check
rootform validate dialects <directory>
rootform test <fixtures>
rootform install dialects <directory>
rootform lock dialects <directory>
rootform verify dialects <directory>
rootform vendor dialects
```

Machine output goes to standard output or explicit output file. Diagnostics go
to standard error. Exit status `0` means requested claim holds, `1` means
known violation or difference, `2` means invalid use, and `3` means result is
indeterminate or unavailable. Command-specific help is authoritative:

```bash
rootform <command> --help
```
