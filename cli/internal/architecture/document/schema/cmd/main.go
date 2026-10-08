package main

import (
	"bytes"
	"flag"
	"fmt"
	"os"

	"github.com/rootform-dev/rootform/cli/internal/architecture/document/schema"
)

func main() {
	check := flag.Bool("check", false, "check the committed schema")
	write := flag.Bool("write", false, "write the committed schema")
	flag.Parse()

	if *check && *write {
		fail("-check and -write are mutually exclusive")
	}
	generated, err := schema.Generate()
	if err != nil {
		fail(err.Error())
	}
	switch {
	case *check:
		committed, err := os.ReadFile(schema.Output)
		if err != nil {
			fail(err.Error())
		}
		if !bytes.Equal(committed, generated) {
			fail("committed Form schema is stale; run with -write")
		}
	case *write:
		if err := os.WriteFile(schema.Output, generated, 0o644); err != nil {
			fail(err.Error())
		}
	default:
		if _, err := os.Stdout.Write(generated); err != nil {
			fail(err.Error())
		}
	}
}

func fail(message string) {
	_, _ = fmt.Fprintln(os.Stderr, "form-schema:", message)
	os.Exit(1)
}
