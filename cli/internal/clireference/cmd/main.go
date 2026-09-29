// Command cmd writes, prints or checks the committed CLI reference. It runs
// from the module root, where the reference path is resolved.
package main

import (
	"bytes"
	"flag"
	"fmt"
	"os"

	"github.com/rootform-dev/rootform/cli/internal/clireference"
)

func main() {
	check := flag.Bool("check", false, "check the committed CLI reference")
	write := flag.Bool("write", false, "write the committed CLI reference")
	flag.Parse()
	if *check && *write {
		fail("-check and -write are mutually exclusive")
	}
	generated, err := clireference.Current()
	if err != nil {
		fail(err.Error())
	}
	switch {
	case *check:
		committed, err := os.ReadFile(clireference.Output)
		if err != nil {
			fail(err.Error())
		}
		if !bytes.Equal(committed, generated) {
			fail("committed CLI reference is stale; run with -write")
		}
	case *write:
		if err := os.WriteFile(clireference.Output, generated, 0o644); err != nil {
			fail(err.Error())
		}
	default:
		if _, err := os.Stdout.Write(generated); err != nil {
			fail(err.Error())
		}
	}
}

func fail(message string) {
	_, _ = fmt.Fprintln(os.Stderr, "cli-reference:", message)
	os.Exit(1)
}
