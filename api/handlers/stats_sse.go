package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"omnicall/db"
	"time"
)

// SSEServer handles server-sent events for real-time stats streaming
type SSEServer struct {
	queries *db.Queries
}

// NewSSEServer creates a new SSE server instance
func NewSSEServer(queries *db.Queries) *SSEServer {
	return &SSEServer{
		queries: queries,
	}
}

// HeartbeatMessage represents the SSE heartbeat ping
type HeartbeatMessage struct {
	Type      string `json:"type"`
	Timestamp string `json:"timestamp"`
}

// HandleStatsStream handles the /api/stats/stream SSE endpoint
// Sends heartbeat pings every 30 seconds and properly cleans up on disconnect
func (s *SSEServer) HandleStatsStream(w http.ResponseWriter, r *http.Request) {
	// Check if the response writer supports flushing (required for SSE)
	flusher, ok := w.(http.Flusher)
	if !ok {
		log.Printf("SSE: ResponseWriter does not support flushing")
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*") // Will be overridden by CORS middleware

	// Log client connection
	log.Printf("SSE: Client connected from %s", r.RemoteAddr)

	// Create ticker for 30-second heartbeat
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop() // CRITICAL: Prevents goroutine leak

	// Send initial heartbeat immediately to confirm connection
	heartbeat := HeartbeatMessage{
		Type:      "heartbeat",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
	if err := sendSSEMessage(w, flusher, heartbeat); err != nil {
		log.Printf("SSE: Failed to send initial heartbeat: %v", err)
		return
	}

	// Event loop - listens for context cancellation (client disconnect) or ticker events
	for {
		select {
		case <-r.Context().Done():
			// Client disconnected - cleanup and return
			log.Printf("SSE: Client disconnected from %s", r.RemoteAddr)
			return

		case <-ticker.C:
			// Send heartbeat ping
			heartbeat := HeartbeatMessage{
				Type:      "heartbeat",
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			}

			if err := sendSSEMessage(w, flusher, heartbeat); err != nil {
				log.Printf("SSE: Failed to send heartbeat, client likely disconnected: %v", err)
				return
			}

			log.Printf("SSE: Heartbeat sent to %s", r.RemoteAddr)
		}
	}
}

// sendSSEMessage sends a JSON message in SSE format: "data: {json}\n\n"
func sendSSEMessage(w http.ResponseWriter, flusher http.Flusher, data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	// SSE message format: "data: {json}\n\n"
	message := fmt.Sprintf("data: %s\n\n", jsonData)

	if _, err := fmt.Fprint(w, message); err != nil {
		return fmt.Errorf("failed to write message: %w", err)
	}

	// Flush the message to the client immediately
	flusher.Flush()

	return nil
}
