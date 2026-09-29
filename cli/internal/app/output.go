package app

import (
	"errors"
	"io"
	"os"
	"path/filepath"
)

// destination is where one command writes its result: the process output
// stream, or a file that only appears once the whole result was written.
type destination struct {
	writer io.Writer
	file   *os.File
	target string
}

// openDestination routes output to the given file, or to fallback when no file
// was named. A file is written through a temporary sibling so an interrupted
// run never leaves a partial result behind, and "-" keeps the common
// convention of naming the output stream.
func openDestination(path string, fallback io.Writer) (*destination, error) {
	if path == "" || path == "-" {
		return &destination{writer: fallback}, nil
	}
	file, err := os.CreateTemp(filepath.Dir(path), ".rootform-out-*")
	if err != nil {
		return nil, errors.New("the output file could not be created")
	}
	return &destination{writer: file, file: file, target: path}, nil
}

func (d *destination) Write(payload []byte) (int, error) { return d.writer.Write(payload) }

// Commit puts a file destination in place. It is a no-op for the output
// stream.
func (d *destination) Commit() error {
	if d.file == nil {
		return nil
	}
	name := d.file.Name()
	if err := d.file.Close(); err != nil {
		os.Remove(name)
		return errors.New("the output file could not be finalized")
	}
	if err := os.Rename(name, d.target); err != nil {
		os.Remove(name)
		return errors.New("the output file could not be finalized")
	}
	d.file = nil
	return nil
}

// Abort discards an unfinished file destination.
func (d *destination) Abort() {
	if d.file == nil {
		return
	}
	name := d.file.Name()
	d.file.Close()
	os.Remove(name)
	d.file = nil
}
