package middleware

import (
	"log"
	"net/http"
	"omnicall/db"
	"time"
)

// RequireRole creates a middleware that checks if the authenticated user's role
// is in the allowed roles list. Returns 401 if not authenticated, 403 if role not allowed.
func RequireRole(queries *db.Queries, allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract session_id from cookie
			cookie, err := r.Cookie("session_id")
			if err != nil {
				log.Printf("Role middleware: No session cookie found")
				http.Error(w, `{"detail":"Not authenticated"}`, http.StatusUnauthorized)
				return
			}

			// Get session
			session, err := queries.GetSession(r.Context(), cookie.Value)
			if err != nil {
				log.Printf("Role middleware: Invalid session")
				http.Error(w, `{"detail":"Session expired"}`, http.StatusUnauthorized)
				return
			}

			// Check if session is expired
			if time.Now().After(session.ExpiresAt) {
				queries.DeleteSession(r.Context(), session.ID)
				log.Printf("Role middleware: Session expired")
				http.Error(w, `{"detail":"Session expired"}`, http.StatusUnauthorized)
				return
			}

			// Get user from session
			user, err := queries.GetUserByID(r.Context(), session.UserID)
			if err != nil {
				log.Printf("Role middleware: User not found")
				http.Error(w, `{"detail":"User not found"}`, http.StatusUnauthorized)
				return
			}

			// Check if user's role is in the allowed roles
			roleAllowed := false
			for _, allowedRole := range allowedRoles {
				if user.Role == allowedRole {
					roleAllowed = true
					break
				}
			}

			if !roleAllowed {
				log.Printf("Role middleware: User %s (role: %s) not authorized for this endpoint", user.Email, user.Role)
				http.Error(w, `{"detail":"Forbidden - insufficient permissions"}`, http.StatusForbidden)
				return
			}

			// User is authenticated and has correct role - proceed
			log.Printf("Role middleware: User %s (role: %s) authorized", user.Email, user.Role)
			next.ServeHTTP(w, r)
		})
	}
}
