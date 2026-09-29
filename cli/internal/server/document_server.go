package server

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"net"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"
)

const LoopbackHost = "127.0.0.1"
const ContentSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"

type PortConflictError struct{ Port int }

func (e PortConflictError) Error() string {
	if e.Port == 0 {
		return "the loopback server could not start"
	}
	return "port " + strconv.Itoa(e.Port) + " is unavailable"
}

type PortRangeError struct{ Port int }

func (e PortRangeError) Error() string {
	return "port " + strconv.Itoa(e.Port) + " is outside the accepted range 0-65535"
}

// DocumentServer serves one run result to the explorer: the display copy of
// the validated document, its presentation catalog and the bundled assets.
// It serves nothing else: no input, archive, directory or event stream.
type DocumentServer struct {
	display      []byte
	presentation []byte
	assets       fs.FS
	port         int
	listener     net.Listener
	http         *http.Server
}

// ErrPayloadInvalid reports a display copy or presentation catalog that is not
// a JSON document. The caller validated the document before deriving its
// display copy, which by design no longer decodes as an input document.
var ErrPayloadInvalid = errors.New("the served payload is not JSON")

func NewDocument(display, presentation []byte, assets fs.FS, port int) (*DocumentServer, error) {
	if port < 0 || port > 65535 {
		return nil, PortRangeError{Port: port}
	}
	if len(display) == 0 || !json.Valid(display) || len(presentation) == 0 || !json.Valid(presentation) {
		return nil, ErrPayloadInvalid
	}
	s := &DocumentServer{display: append([]byte(nil), display...), presentation: append([]byte(nil), presentation...), assets: assets, port: port}
	s.http = &http.Server{Handler: http.HandlerFunc(s.serveHTTP), ReadHeaderTimeout: 5 * time.Second}
	return s, nil
}
func (s *DocumentServer) Listen() (net.Addr, error) {
	if s.listener != nil {
		return s.listener.Addr(), nil
	}
	listener, err := net.Listen("tcp", net.JoinHostPort(LoopbackHost, strconv.Itoa(s.port)))
	if err != nil {
		return nil, PortConflictError{Port: s.port}
	}
	s.listener = listener
	return listener.Addr(), nil
}
func (s *DocumentServer) Serve() error {
	if s.listener == nil {
		if _, err := s.Listen(); err != nil {
			return err
		}
	}
	err := s.http.Serve(s.listener)
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}
func (s *DocumentServer) Shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return s.http.Shutdown(ctx)
}
func (s *DocumentServer) serveHTTP(w http.ResponseWriter, r *http.Request) {
	host, _, err := net.SplitHostPort(r.Host)
	if err != nil || host != LoopbackHost {
		http.Error(w, "unexpected host", http.StatusBadRequest)
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Security-Policy", ContentSecurityPolicy)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
	var payload []byte
	switch r.URL.Path {
	case "/api/v1/document":
		payload = s.display
	case "/api/v1/presentation":
		payload = s.presentation
	}
	if payload != nil {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodHead {
			_, _ = w.Write(payload)
		}
		return
	}
	if s.assets == nil {
		http.NotFound(w, r)
		return
	}
	target := strings.TrimPrefix(r.URL.Path, "/")
	if target == "" {
		target = "index.html"
	}
	if target != "index.html" && target != "rootform-mark.svg" && !strings.HasPrefix(target, "assets/") {
		http.NotFound(w, r)
		return
	}
	if path.Clean(target) != target || strings.Contains(target, "..") {
		http.NotFound(w, r)
		return
	}
	body, readErr := fs.ReadFile(s.assets, target)
	if readErr != nil {
		http.NotFound(w, r)
		return
	}
	switch path.Ext(target) {
	case ".html":
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
	case ".js":
		w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
	case ".css":
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
	case ".svg":
		w.Header().Set("Content-Type", "image/svg+xml")
	}
	if r.Method != http.MethodHead {
		_, _ = w.Write(body)
	}
}
