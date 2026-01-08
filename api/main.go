package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"

	// "net/smtp" // Uncomment when using SMTP email sending
	"omnicall/db"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
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
	Success   bool     `json:"success"`
	User      *db.User `json:"user,omitempty"`
	SessionID string   `json:"sessionId,omitempty"`
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

type SendOTPRequest struct {
	Email string `json:"email"`
}

type VerifyOTPRequest struct {
	Email string `json:"email"`
	OTP   string `json:"otp"`
}

type OTPResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

type CallRecordRequest struct {
	CallSID    string  `json:"call_sid"`
	FromNumber string  `json:"from_number"`
	ToNumber   string  `json:"to_number"`
	CallStatus string  `json:"call_status"`
	Duration   int32   `json:"duration"`
	CustomerID *int32  `json:"customer_id,omitempty"`
}

type CallStatsResponse struct {
	Success      bool    `json:"success"`
	TotalCalls   int64   `json:"total_calls"`
	AnsweredCalls int64  `json:"answered_calls"`
	MissedCalls  int64   `json:"missed_calls"`
	AvgDuration  float64 `json:"avg_duration"`
}

func main() {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Build MySQL DSN from environment variables
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbName := os.Getenv("DB_NAME")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")

	// Validate required MySQL credentials
	if dbHost == "" || dbPort == "" || dbName == "" || dbUser == "" || dbPassword == "" {
		log.Fatal("Missing required database environment variables")
	}

	// Build MySQL DSN: username:password@tcp(host:port)/dbname?params
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&charset=utf8mb4",
		dbUser, dbPassword, dbHost, dbPort, dbName)

	// Initialize database
	database, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}
	defer database.Close()

	// Test the connection
	if err := database.Ping(); err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	log.Printf("Connected to MySQL at %s:%s", dbHost, dbPort)

	// Schema initialization not needed - MySQL database already has schema
	// if err := initSchema(database); err != nil {
	// 	log.Fatal("Failed to initialize schema:", err)
	// }

	queries := db.New(database)
	server := &Server{db: database, queries: queries}

	// Setup router
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://127.0.0.1:3000", "https://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check route
	r.Get("/health", server.health)

	// Auth routes
	r.Post("/api/auth/register", server.register)
	r.Post("/api/auth/login", server.login)
	r.Post("/api/auth/logout", server.logout)
	r.Get("/api/auth/me", server.getCurrentUser)
	r.Post("/api/auth/otp/send", server.sendOTP)
	r.Post("/api/auth/otp/verify", server.verifyOTP)

	// Company routes
	r.Get("/api/companies", server.getCompanies)
	r.Post("/api/companies", server.createCompany)

	// Customer routes
	r.Get("/api/customers/by-phone", server.getCustomerByPhone)

	// Agent status routes
	r.Get("/api/agent/status", server.getAgentStatus)
	r.Post("/api/agent/status", server.updateAgentStatus)

	// Call tracking routes
	r.Post("/api/calls", server.createCallRecord)
	r.Put("/api/calls/{call_sid}", server.updateCallRecord)
	r.Get("/api/calls/stats", server.getCallStats)

	// Twilio routes
	r.Get("/api/twilio/token", server.getTwilioToken)

	// Twilio webhooks (public endpoints for TwiML)
	r.Post("/twilio/outbound-voice", server.handleOutboundVoice)
	r.Get("/twilio/outbound-voice", server.handleOutboundVoice)
	r.Post("/twilio/incoming-call", server.handleIncomingCall)
	r.Get("/twilio/incoming-call", server.handleIncomingCall)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	fmt.Printf("\n🚀 OmniCall API Server running on http://localhost:%s\n", port)
	fmt.Println("📊 Health check: http://localhost:" + port + "/health")
	fmt.Println("🔐 Auth API: http://localhost:" + port + "/api/auth")
	fmt.Println("🏢 Companies API: http://localhost:" + port + "/api/companies")
	fmt.Println("📞 Twilio API: http://localhost:" + port + "/api/twilio\n")

	log.Fatal(http.ListenAndServe(":"+port, r))
}

// Handlers
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
	result, err := s.queries.CreateUser(r.Context(), db.CreateUserParams{
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Firstname:    req.Firstname,
		Lastname:     req.Lastname,
		AgentID:      req.AgentID,
		CompanyID:    int32(req.CompanyID),
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	// Get the inserted user ID
	userID, err := result.LastInsertId()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get user ID")
		return
	}

	// Fetch the created user
	user, err := s.queries.GetUserByID(r.Context(), int32(userID))
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get user")
		return
	}

	// Create session
	sessionID := generateSessionID()
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	_, err = s.queries.CreateSession(r.Context(), db.CreateSessionParams{
		ID:        sessionID,
		UserID:    user.ID,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create session")
		return
	}

	// Fetch the created session
	session, err := s.queries.GetSession(r.Context(), sessionID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get session")
		return
	}

	// Set cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    session.ID,
		Path:     "/",
		MaxAge:   7 * 24 * 60 * 60,
		HttpOnly: true,
		Secure:   false, // Set to true in production with HTTPS
		SameSite: http.SameSiteLaxMode,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(AuthResponse{
		Success: true,
		User: &db.User{
			ID:        user.ID,
			Email:     user.Email,
			Firstname: user.Firstname,
			Lastname:  user.Lastname,
			AgentID:   user.AgentID,
			CompanyID: user.CompanyID,
		},
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

	_, err = s.queries.CreateSession(r.Context(), db.CreateSessionParams{
		ID:        sessionID,
		UserID:    user.ID,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create session")
		return
	}

	// Fetch the created session
	session, err := s.queries.GetSession(r.Context(), sessionID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get session")
		return
	}

	// Set cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    session.ID,
		Path:     "/",
		MaxAge:   7 * 24 * 60 * 60,
		HttpOnly: true,
		Secure:   false, // Set to true in production with HTTPS
		SameSite: http.SameSiteLaxMode,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuthResponse{
		Success: true,
		User: &db.User{
			ID:        user.ID,
			Email:     user.Email,
			Firstname: user.Firstname,
			Lastname:  user.Lastname,
			AgentID:   user.AgentID,
			CompanyID: user.CompanyID,
		},
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
		User: &db.User{
			ID:        user.ID,
			Email:     user.Email,
			Firstname: user.Firstname,
			Lastname:  user.Lastname,
			AgentID:   user.AgentID,
			CompanyID: user.CompanyID,
		},
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
		result, err := s.queries.CreateCompany(r.Context(), "Default Company")
		if err == nil {
			// Get the inserted company ID
			companyID, err := result.LastInsertId()
			if err == nil {
				// Fetch the created company
				company, err := s.queries.GetCompany(r.Context(), int32(companyID))
				if err == nil {
					companies = append(companies, company)
				}
			}
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

	result, err := s.queries.CreateCompany(r.Context(), req.Name)
	if err != nil {
		// MySQL unique constraint error contains "Duplicate entry"
		errMsg := err.Error()
		if strings.Contains(errMsg, "Duplicate entry") || strings.Contains(errMsg, "duplicate key") {
			respondError(w, http.StatusBadRequest, "Company with this name already exists")
		} else {
			respondError(w, http.StatusInternalServerError, "Failed to create company")
		}
		return
	}

	// Get the inserted company ID
	companyID, err := result.LastInsertId()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get company ID")
		return
	}

	// Fetch the created company
	company, err := s.queries.GetCompany(r.Context(), int32(companyID))
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get company")
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

func (s *Server) getAgentStatus(w http.ResponseWriter, r *http.Request) {
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

	// Get latest agent status
	status, err := s.queries.GetLatestAgentStatus(r.Context(), session.UserID)
	if err != nil {
		if err == sql.ErrNoRows {
			// No status found, return default offline status
			log.Printf("ℹ️ No status found for user ID: %d, returning default 'offline'", session.UserID)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"status":  "offline",
			})
			return
		}
		log.Printf("❌ Error getting agent status: %v", err)
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to get agent status: %v", err))
		return
	}

	log.Printf("✅ Agent status retrieved: '%s' for user ID: %d", status.Status, session.UserID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"status":  status.Status,
	})
}

func (s *Server) updateAgentStatus(w http.ResponseWriter, r *http.Request) {
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

	// Parse request body
	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate status
	validStatuses := map[string]bool{
		"available": true,
		"busy":      true,
		"on_break":  true,
		"offline":   true,
	}

	if !validStatuses[req.Status] {
		respondError(w, http.StatusBadRequest, "Invalid status value")
		return
	}

	// Create new status record
	_, err = s.queries.CreateAgentStatus(r.Context(), db.CreateAgentStatusParams{
		UserID: session.UserID,
		Status: req.Status,
	})
	if err != nil {
		log.Printf("❌ Error creating agent status: %v", err)
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to update agent status: %v", err))
		return
	}

	log.Printf("✅ Agent status updated to '%s' for user ID: %d", req.Status, session.UserID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"status":  req.Status,
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

// Call tracking handlers
func (s *Server) createCallRecord(w http.ResponseWriter, r *http.Request) {
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

	var req CallRecordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.CallSID == "" || req.FromNumber == "" || req.ToNumber == "" {
		respondError(w, http.StatusBadRequest, "call_sid, from_number, and to_number are required")
		return
	}

	// Create call record
	var customerID sql.NullInt32
	if req.CustomerID != nil {
		customerID = sql.NullInt32{Int32: *req.CustomerID, Valid: true}
	}

	_, err = s.queries.CreateCallRecord(r.Context(), db.CreateCallRecordParams{
		CustomerID: customerID,
		AgentID: sql.NullInt32{Int32: user.ID, Valid: true},
		CompanyID: user.CompanyID,
		CallSid: req.CallSID,
		FromNumber: sql.NullString{String: req.FromNumber, Valid: true},
		ToNumber: sql.NullString{String: req.ToNumber, Valid: true},
		CallStatus: sql.NullString{String: req.CallStatus, Valid: true},
		Duration: sql.NullInt32{Int32: req.Duration, Valid: true},
		RecordingStartTime: sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		log.Printf("Failed to create call record: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to create call record")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Call record created",
	})
}

func (s *Server) updateCallRecord(w http.ResponseWriter, r *http.Request) {
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

	callSID := chi.URLParam(r, "call_sid")
	if callSID == "" {
		respondError(w, http.StatusBadRequest, "call_sid is required")
		return
	}

	var req struct {
		CallStatus string `json:"call_status"`
		Duration   int32  `json:"duration"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	err = s.queries.UpdateCallRecord(r.Context(), db.UpdateCallRecordParams{
		CallStatus: sql.NullString{String: req.CallStatus, Valid: true},
		Duration: sql.NullInt32{Int32: req.Duration, Valid: true},
		CallSid: callSID,
	})
	if err != nil {
		log.Printf("Failed to update call record: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to update call record")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Call record updated",
	})
}

func (s *Server) getCallStats(w http.ResponseWriter, r *http.Request) {
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

	// Get call stats for today
	stats, err := s.queries.GetTodayCallStats(r.Context(), sql.NullInt32{
		Int32: session.UserID,
		Valid: true,
	})
	if err != nil {
		log.Printf("Failed to get call stats: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to get call stats")
		return
	}

	// Convert AvgDuration from interface{} to float64
	var avgDuration float64
	if stats.AvgDuration != nil {
		switch v := stats.AvgDuration.(type) {
		case float64:
			avgDuration = v
		case int64:
			avgDuration = float64(v)
		case []uint8: // MySQL DECIMAL can come as []byte
			fmt.Sscanf(string(v), "%f", &avgDuration)
		default:
			avgDuration = 0
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(CallStatsResponse{
		Success:       true,
		TotalCalls:    stats.TotalCalls,
		AnsweredCalls: stats.AnsweredCalls,
		MissedCalls:   stats.MissedCalls,
		AvgDuration:   avgDuration,
	})
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
	log.Printf("❌ ERROR [%d]: %s", status, message)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(ErrorResponse{Detail: message})
}

// Generate 6-digit OTP
func generateOTP() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(1000000))
	return fmt.Sprintf("%06d", n.Int64())
}

// Send OTP via email (currently logs to file for development)
func sendOTPEmail(to, otpCode string) error {
	// For development: Log OTP to file instead of sending email
	logMessage := fmt.Sprintf("[%s] OTP for %s: %s\n",
		time.Now().Format("2006-01-02 15:04:05"), to, otpCode)

	// Log to console
	log.Printf("📧 OTP Generated for %s: %s", to, otpCode)

	// Also append to otp.log file
	f, err := os.OpenFile("otp.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Printf("Warning: Could not write to otp.log: %v", err)
		// Don't fail if we can't write to file - just log to console
		return nil
	}
	defer f.Close()

	if _, err := f.WriteString(logMessage); err != nil {
		log.Printf("Warning: Could not write to otp.log: %v", err)
	}

	return nil

	/*
		// SMTP Email sending (uncomment when SMTP is configured)
		from := os.Getenv("SMTP_FROM")
		password := os.Getenv("SMTP_PASSWORD")
		smtpHost := os.Getenv("SMTP_HOST")
		smtpPort := os.Getenv("SMTP_PORT")

		subject := "Your MedContact Dashboard Login Code"
		body := fmt.Sprintf(`
			<html><body style="font-family: Arial, sans-serif;">
			<h2>MedContact Dashboard Login</h2>
			<p>Your one-time password is:</p>
			<h1 style="color: #3B82F6; letter-spacing: 5px;">%s</h1>
			<p>This code will expire in 5 minutes.</p>
			<p style="color: #6B7280;">If you didn't request this code, please ignore this email.</p>
			</body></html>
		`, otpCode)

		message := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-version: 1.0\r\nContent-Type: text/html; charset=\"UTF-8\"\r\n\r\n%s",
			from, to, subject, body)

		auth := smtp.PlainAuth("", from, password, smtpHost)
		err := smtp.SendMail(smtpHost+":"+smtpPort, auth, from, []string{to}, []byte(message))
		return err
	*/
}

// OTP Handlers
func (s *Server) sendOTP(w http.ResponseWriter, r *http.Request) {
	var req SendOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(OTPResponse{Success: false, Error: "Invalid request"})
		return
	}

	// Validate email format
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(OTPResponse{Success: false, Error: "Invalid email"})
		return
	}

	// Check if user exists
	_, err := s.queries.GetUserByEmail(r.Context(), req.Email)
	if err == sql.ErrNoRows {
		// Don't reveal if user exists - return success anyway for security
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(OTPResponse{Success: true, Message: "If this email exists, an OTP has been sent"})
		return
	}

	// Rate limiting: Check recent attempts
	count, _ := s.queries.CountRecentOTPAttempts(r.Context(), req.Email)
	if count >= 3 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		json.NewEncoder(w).Encode(OTPResponse{Success: false, Error: "Too many attempts. Please try again in 15 minutes"})
		return
	}

	// Generate OTP
	otpCode := generateOTP()
	expiresAt := time.Now().Add(5 * time.Minute)

	// Store in database
	_, err = s.queries.CreateOTPCode(r.Context(), db.CreateOTPCodeParams{
		Email:     req.Email,
		OtpCode:   otpCode,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		log.Printf("Failed to create OTP: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(OTPResponse{Success: false, Error: "Failed to generate OTP"})
		return
	}

	// Send email
	if err := sendOTPEmail(req.Email, otpCode); err != nil {
		log.Printf("Failed to send OTP email: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(OTPResponse{Success: false, Error: "Failed to send OTP email"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(OTPResponse{Success: true, Message: "OTP sent to your email"})
}

func (s *Server) verifyOTP(w http.ResponseWriter, r *http.Request) {
	var req VerifyOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(AuthResponse{Success: false})
		return
	}

	// Validate inputs
	if req.Email == "" || req.OTP == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(AuthResponse{Success: false})
		return
	}

	// Get valid OTP
	otpRecord, err := s.queries.GetValidOTPCode(r.Context(), db.GetValidOTPCodeParams{
		Email:   req.Email,
		OtpCode: req.OTP,
	})
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(AuthResponse{Success: false})
		return
	}

	// Mark OTP as used
	s.queries.MarkOTPCodeAsUsed(r.Context(), otpRecord.ID)

	// Get user
	user, err := s.queries.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(AuthResponse{Success: false})
		return
	}

	// Create session (same as regular login)
	sessionID := make([]byte, 32)
	rand.Read(sessionID)
	sessionIDStr := hex.EncodeToString(sessionID)

	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	_, err = s.queries.CreateSession(r.Context(), db.CreateSessionParams{
		ID:        sessionIDStr,
		UserID:    user.ID,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(AuthResponse{Success: false})
		return
	}

	// Set cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    sessionIDStr,
		Path:     "/",
		Expires:  expiresAt,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   false, // Set to true in production with HTTPS
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(AuthResponse{
		Success: true,
		User: &db.User{
			ID:        user.ID,
			Email:     user.Email,
			Firstname: user.Firstname,
			Lastname:  user.Lastname,
			AgentID:   user.AgentID,
			CompanyID: user.CompanyID,
		},
		SessionID: sessionIDStr,
	})
}
