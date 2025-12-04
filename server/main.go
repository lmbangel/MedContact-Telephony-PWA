package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"omnicall/db"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	_ "github.com/mattn/go-sqlite3"
	twilioJwt "github.com/twilio/twilio-go/client/jwt"
	"golang.org/x/crypto/bcrypt"
)

type Server struct {
	db      *sql.DB
	queries *db.Queries
}

// Request/Response types
type RegisterRequest struct {
	Email     string `json:"email"`
	Password  string `json:"password"`
	Firstname string `json:"firstname"`
	Lastname  string `json:"lastname"`
	AgentID   string `json:"agent_id"`
	CompanyID int64  `json:"company_id"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type CompanyCreate struct {
	Name string `json:"name"`
}

type AuthResponse struct {
	Success   bool        `json:"success"`
	User      *db.User    `json:"user,omitempty"`
	SessionID string      `json:"sessionId,omitempty"`
}

type UserResponse struct {
	Success bool     `json:"success"`
	User    *db.User `json:"user,omitempty"`
}

type CompaniesResponse struct {
	Success   bool         `json:"success"`
	Companies []db.Company `json:"companies"`
}

type CompanyResponse struct {
	Success bool        `json:"success"`
	Company *db.Company `json:"company,omitempty"`
}

type CustomerResponse struct {
	Success  bool         `json:"success"`
	Customer *db.Customer `json:"customer,omitempty"`
}

type ErrorResponse struct {
	Detail string `json:"detail"`
}

type TwilioTokenResponse struct {
	Token    string `json:"token"`
	Identity string `json:"identity"`
}

func main() {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Get database path from env or use default
	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "./omnicall.db"
	}

	// Initialize database
	database, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}
	defer database.Close()

	// Initialize schema
	if err := initSchema(database); err != nil {
		log.Fatal("Failed to initialize schema:", err)
	}

	queries := db.New(database)
	server := &Server{db: database, queries: queries}

	// Setup router
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:8000", "http://localhost:3001", "http://localhost:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Routes
	r.Get("/", server.root)
	r.Get("/health", server.health)

	// Auth routes
	r.Post("/api/auth/register", server.register)
	r.Post("/api/auth/login", server.login)
	r.Post("/api/auth/logout", server.logout)
	r.Get("/api/auth/me", server.getCurrentUser)

	// Company routes
	r.Get("/api/companies", server.getCompanies)
	r.Post("/api/companies", server.createCompany)

	// Customer routes
	r.Get("/api/customers/by-phone", server.getCustomerByPhone)

	// Twilio routes
	r.Get("/api/twilio/token", server.getTwilioToken)

	// Twilio webhooks (public endpoints for TwiML)
	r.Post("/twilio/outbound-voice", server.handleOutboundVoice)
	r.Get("/twilio/outbound-voice", server.handleOutboundVoice)
	r.Post("/twilio/incoming-call", server.handleIncomingCall)
	r.Get("/twilio/incoming-call", server.handleIncomingCall)

	fmt.Println("\n🚀 OmniCall API Server running on http://localhost:3000")
	fmt.Println("📊 Health check: http://localhost:3000/health")
	fmt.Println("🔐 Auth API: http://localhost:3000/api/auth")
	fmt.Println("🏢 Companies API: http://localhost:3000/api/companies")
	fmt.Println("📞 Twilio API: http://localhost:3000/api/twilio\n")

	log.Fatal(http.ListenAndServe(":3000", r))
}

func initSchema(database *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS companies (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		firstname TEXT NOT NULL,
		lastname TEXT NOT NULL,
		agent_id TEXT NOT NULL UNIQUE,
		company_id INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (company_id) REFERENCES companies (id)
	);

	CREATE TABLE IF NOT EXISTS sessions (
		id TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		expires_at DATETIME NOT NULL,
		FOREIGN KEY (user_id) REFERENCES users (id)
	);
	`
	_, err := database.Exec(schema)
	return err
}

// Handlers
func (s *Server) root(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "OmniCall API Server",
		"version": "1.0.0",
		"endpoints": map[string]string{
			"health":    "/health",
			"auth":      "/api/auth",
			"companies": "/api/companies",
		},
	})
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate required fields
	if req.Email == "" || req.Password == "" || req.Firstname == "" || req.Lastname == "" || req.AgentID == "" {
		respondError(w, http.StatusBadRequest, "All fields are required")
		return
	}

	// Check if user exists
	if _, err := s.queries.GetUserByEmail(r.Context(), req.Email); err == nil {
		respondError(w, http.StatusBadRequest, "User with this email already exists")
		return
	}

	// Check if agent_id exists
	if _, err := s.queries.GetUserByAgentID(r.Context(), req.AgentID); err == nil {
		respondError(w, http.StatusBadRequest, "Agent ID already exists")
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to process password")
		return
	}

	// Create user
	user, err := s.queries.CreateUser(r.Context(), db.CreateUserParams{
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Firstname:    req.Firstname,
		Lastname:     req.Lastname,
		AgentID:      req.AgentID,
		CompanyID:    req.CompanyID,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	// Create session
	sessionID := generateSessionID()
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	session, err := s.queries.CreateSession(r.Context(), db.CreateSessionParams{
		ID:        sessionID,
		UserID:    user.ID,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create session")
		return
	}

	// Set cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    session.ID,
		Path:     "/",
		MaxAge:   7 * 24 * 60 * 60,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(AuthResponse{
		Success:   true,
		User:      &user,
		SessionID: session.ID,
	})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Email == "" || req.Password == "" {
		respondError(w, http.StatusBadRequest, "Email and password are required")
		return
	}

	// Get user
	user, err := s.queries.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		respondError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	// Create session
	sessionID := generateSessionID()
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	session, err := s.queries.CreateSession(r.Context(), db.CreateSessionParams{
		ID:        sessionID,
		UserID:    user.ID,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create session")
		return
	}

	// Set cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    session.ID,
		Path:     "/",
		MaxAge:   7 * 24 * 60 * 60,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuthResponse{
		Success:   true,
		User:      &user,
		SessionID: session.ID,
	})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_id")
	if err == nil {
		s.queries.DeleteSession(r.Context(), cookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (s *Server) getCurrentUser(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_id")
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Get session
	session, err := s.queries.GetSession(r.Context(), cookie.Value)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Session expired")
		return
	}

	// Check expiration
	if time.Now().After(session.ExpiresAt) {
		s.queries.DeleteSession(r.Context(), session.ID)
		respondError(w, http.StatusUnauthorized, "Session expired")
		return
	}

	// Get user
	user, err := s.queries.GetUserByID(r.Context(), session.UserID)
	if err != nil {
		respondError(w, http.StatusNotFound, "User not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(UserResponse{
		Success: true,
		User:    &user,
	})
}

func (s *Server) getCompanies(w http.ResponseWriter, r *http.Request) {
	companies, err := s.queries.GetAllCompanies(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get companies")
		return
	}

	// Create default company if none exist
	if len(companies) == 0 {
		company, err := s.queries.CreateCompany(r.Context(), "Default Company")
		if err == nil {
			companies = append(companies, company)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(CompaniesResponse{
		Success:   true,
		Companies: companies,
	})
}

func (s *Server) createCompany(w http.ResponseWriter, r *http.Request) {
	var req CompanyCreate
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "Company name is required")
		return
	}

	company, err := s.queries.CreateCompany(r.Context(), req.Name)
	if err != nil {
		if err.Error() == "UNIQUE constraint failed: companies.name" {
			respondError(w, http.StatusBadRequest, "Company with this name already exists")
		} else {
			respondError(w, http.StatusInternalServerError, "Failed to create company")
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(CompanyResponse{
		Success: true,
		Company: &company,
	})
}

func (s *Server) getCustomerByPhone(w http.ResponseWriter, r *http.Request) {
	phone := r.URL.Query().Get("phone")
	if phone == "" {
		respondError(w, http.StatusBadRequest, "Phone number is required")
		return
	}

	log.Printf("🔍 Looking up customer by phone: %s", phone)

	// Try exact match first
	customer, err := s.queries.GetCustomerByPhone(r.Context(), sql.NullString{
		String: phone,
		Valid:  true,
	})
	if err != nil && err != sql.ErrNoRows {
		respondError(w, http.StatusInternalServerError, "Failed to get customer")
		return
	}

	// If not found, try normalizing phone number (remove spaces, hyphens, etc.)
	found := false
	if err == sql.ErrNoRows {
		// Normalize the input phone number
		normalizedPhone := normalizePhoneNumber(phone)
		log.Printf("📞 Normalized input phone: %s", normalizedPhone)

		// Query all customers and find matching normalized phone
		customers, err := s.queries.GetAllCustomers(r.Context())
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to get customers")
			return
		}

		log.Printf("👥 Checking %d customers", len(customers))

		// Find customer with matching normalized phone
		for _, c := range customers {
			if c.Phone.Valid {
				normalizedCustomerPhone := normalizePhoneNumber(c.Phone.String)
				log.Printf("  Comparing: input=%s vs customer=%s (original: %s)", normalizedPhone, normalizedCustomerPhone, c.Phone.String)
				if normalizedCustomerPhone == normalizedPhone {
					customer = c
					found = true
					log.Printf("✅ Found matching customer: %s %s", c.FirstName, c.LastName)
					break
				}
			}
		}
	} else if err == nil {
		found = true
	}

	if !found {
		log.Printf("❌ No customer found for phone: %s", phone)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(CustomerResponse{
			Success:  false,
			Customer: nil,
		})
		return
	}

	log.Printf("✅ Returning customer: %s %s", customer.FirstName, customer.LastName)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(CustomerResponse{
		Success:  true,
		Customer: &customer,
	})
}

func (s *Server) getTwilioToken(w http.ResponseWriter, r *http.Request) {
	// Get current user from session
	cookie, err := r.Cookie("session_id")
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	session, err := s.queries.GetSession(r.Context(), cookie.Value)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Session expired")
		return
	}

	if time.Now().After(session.ExpiresAt) {
		s.queries.DeleteSession(r.Context(), session.ID)
		respondError(w, http.StatusUnauthorized, "Session expired")
		return
	}

	user, err := s.queries.GetUserByID(r.Context(), session.UserID)
	if err != nil {
		respondError(w, http.StatusNotFound, "User not found")
		return
	}

	// Get Twilio credentials from environment
	accountSID := os.Getenv("TWILIO_ACCOUNT_SID")
	apiKeySID := os.Getenv("TWILIO_API_KEY_SID")
	apiKeySecret := os.Getenv("TWILIO_API_KEY_SECRET")
	twimlAppSID := os.Getenv("TWILIO_TWIML_APP_SID")

	log.Printf("Twilio Credentials Check - AccountSID: %s, APIKeySID: %s, TwiMLAppSID: %s",
		accountSID, apiKeySID, twimlAppSID)

	if accountSID == "" || apiKeySID == "" || apiKeySecret == "" {
		log.Printf("ERROR: Twilio credentials missing - AccountSID: %t, APIKeySID: %t, APIKeySecret: %t",
			accountSID != "", apiKeySID != "", apiKeySecret != "")
		respondError(w, http.StatusInternalServerError, "Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, and TWILIO_API_KEY_SECRET environment variables.")
		return
	}

	// Create identity from user's agent ID
	identity := user.AgentID
	log.Printf("Generating Twilio token for identity: %s", identity)

	// Create access token parameters using Twilio SDK
	params := twilioJwt.AccessTokenParams{
		AccountSid:    accountSID,
		SigningKeySid: apiKeySID,
		Secret:        apiKeySecret,
		Identity:      identity,
		Ttl:           3600, // 1 hour in seconds
	}

	log.Printf("Creating access token with params...")
	// Create the access token
	accessToken := twilioJwt.CreateAccessToken(params)

	// Create the voice grant
	voiceGrant := &twilioJwt.VoiceGrant{
		Incoming: twilioJwt.Incoming{Allow: true},
		Outgoing: twilioJwt.Outgoing{
			ApplicationSid: twimlAppSID,
		},
	}

	log.Printf("Adding voice grant...")
	// Add the voice grant to the token
	accessToken.AddGrant(voiceGrant)

	log.Printf("Generating JWT token string...")
	// Generate the JWT string
	tokenString, err := accessToken.ToJwt()
	if err != nil {
		log.Printf("ERROR: Failed to generate Twilio token: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to generate access token")
		return
	}

	log.Printf("Successfully generated Twilio token for %s", identity)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(TwilioTokenResponse{
		Token:    tokenString,
		Identity: identity,
	})
}

func (s *Server) handleOutboundVoice(w http.ResponseWriter, r *http.Request) {
	// Parse form data
	if err := r.ParseForm(); err != nil {
		log.Printf("Error parsing form: %v", err)
	}

	toNumber := r.FormValue("To")
	callSID := r.FormValue("CallSid")

	// Get phone number from environment
	fromNumber := os.Getenv("TWILIO_PHONE_NUMBER")
	if fromNumber == "" {
		fromNumber = "+13612664115" // Fallback to your number
	}

	if toNumber == "" {
		log.Println("No 'To' number received from Twilio")
		toNumber = "+1234567890" // Fallback
	}

	log.Printf("📞 Outbound call: To=%s, From=%s, CallSID=%s", toNumber, fromNumber, callSID)

	// Return TwiML that tells Twilio to dial the number
	twiml := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
	<Dial callerId="%s">
		<Number>%s</Number>
	</Dial>
</Response>`, fromNumber, toNumber)

	w.Header().Set("Content-Type", "application/xml")
	w.Write([]byte(twiml))
}

func (s *Server) handleIncomingCall(w http.ResponseWriter, r *http.Request) {
	// Parse form data
	if err := r.ParseForm(); err != nil {
		log.Printf("Error parsing form: %v", err)
	}

	from := r.FormValue("From")
	to := r.FormValue("To")
	callSID := r.FormValue("CallSid")

	log.Printf("📞 Incoming call: From=%s, To=%s, CallSID=%s", from, to, callSID)

	// Get the first agent from the database to route the call to
	// In a production system, you'd implement proper call routing logic
	var agentID string
	query := `SELECT agent_id FROM users LIMIT 1`
	err := s.db.QueryRow(query).Scan(&agentID)
	if err != nil {
		log.Printf("Error getting agent: %v", err)
		agentID = "agent001" // Fallback to default agent
	}

	log.Printf("Routing call to agent: %s", agentID)

	// Return TwiML to route the call to the agent's browser
	twiml := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
	<Say>Welcome to OmniCall. Please wait while we connect you to an agent.</Say>
	<Dial>
		<Client>%s</Client>
	</Dial>
	<Say>Sorry, the agent is not available. Please try again later.</Say>
</Response>`, agentID)

	w.Header().Set("Content-Type", "application/xml")
	w.Write([]byte(twiml))
}

// Helper functions
func generateSessionID() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func normalizePhoneNumber(phone string) string {
	// Remove all spaces, hyphens, parentheses, and dots
	normalized := ""
	for _, char := range phone {
		if char >= '0' && char <= '9' || char == '+' {
			normalized += string(char)
		}
	}
	return normalized
}

func respondError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(ErrorResponse{Detail: message})
}
