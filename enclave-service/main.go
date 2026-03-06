package main

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"sort"
	"strings"

	"github.com/edgelesssys/ego/enclave"
)

// Click represents a player's action with a timestamp.
type Click struct {
	PlayerAddress string `json:"playerAddress"`
	ReactionTime  int64  `json:"reactionTime"` // Nanoseconds
}

// GameResultRequest is the payload sent by the main backend.
type GameResultRequest struct {
	GameID           string   `json:"gameId"`
	DepositedPlayers []string `json:"depositedPlayers"`
	Clicks           []Click  `json:"clicks"`
	MinPlayers       int      `json:"minPlayers"`
}

// GameResultResponse is the signed result returned by the enclave.
type GameResultResponse struct {
	Winners []string `json:"winners"`
	Loser   string   `json:"loser"`
	Error   string   `json:"error,omitempty"`
	// In a real production scenario, you might sign this response with a key generated inside the enclave.
	// For now, we rely on the TLS connection terminated inside the enclave (EGo feature) or just the logic isolation.
}

func main() {
	// EGo can terminate TLS inside the enclave, ensuring the request reaches the secure environment directly.
	// We use Attested TLS to allow the client to verify the enclave's identity and integrity.
	http.HandleFunc("/api/result", handleDetermineResult)
	http.HandleFunc("/api/attestation", handleAttestation)

	port := "8081"
	fmt.Printf("Enclave Service listening on port %s (HTTP)...\n", port)

	// TLS is disabled for internal Docker communication.
	// Attestation verification should be done by checking the report payload from /api/attestation.

	server := &http.Server{
		Addr: ":" + port,
	}

	log.Fatal(server.ListenAndServe())
}

func handleAttestation(w http.ResponseWriter, r *http.Request) {
	// Get nonce from query parameter to prevent replay attacks
	nonce := r.URL.Query().Get("nonce")
	var reportData []byte
	if nonce != "" {
		// Use the provided nonce as user data for the report.
		// SGX ReportData is limited to 64 bytes.
		if len(nonce) > 64 {
			reportData = []byte(nonce[:64])
		} else {
			reportData = []byte(nonce)
		}
	} else {
		reportData = []byte("musical-chairs-attestation")
	}

	// Generate a remote report to prove this code is running in SGX.
	// You can include a nonce or public key in the report data to bind it to a specific session/key.
	report, err := enclave.GetRemoteReport(reportData)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get attestation report: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"report": fmt.Sprintf("%x", report),
	})
}

func handleDetermineResult(w http.ResponseWriter, r *http.Request) {
	var req GameResultRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	winners, loser, err := determineWinnersAndLoser(req)
	if err != nil {
		json.NewEncoder(w).Encode(GameResultResponse{Error: err.Error()})
		return
	}

	resp := GameResultResponse{
		Winners: winners,
		Loser:   loser,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// determineWinnersAndLoser contains the core logic moved from the main backend.
func determineWinnersAndLoser(req GameResultRequest) ([]string, string, error) {
	if len(req.DepositedPlayers) < req.MinPlayers {
		return nil, "", fmt.Errorf("not enough deposited players (%d/%d)", len(req.DepositedPlayers), req.MinPlayers)
	}

	// Map clicks for easy lookup
	clickedMap := make(map[string]bool)
	for _, c := range req.Clicks {
		clickedMap[strings.ToLower(c.PlayerAddress)] = true
	}

	// Identify who did NOT click
	depositedButNotClicked := []string{}
	for _, addr := range req.DepositedPlayers {
		lowerAddr := strings.ToLower(addr)
		if !clickedMap[lowerAddr] {
			depositedButNotClicked = append(depositedButNotClicked, lowerAddr)
		}
	}

	var loser string

	// Logic to determine loser
	if len(depositedButNotClicked) > 0 {
		// If some people didn't click, one of them loses.
		// We use crypto/rand inside the enclave for secure randomness.
		maxIndex := big.NewInt(int64(len(depositedButNotClicked)))
		nBig, err := rand.Int(rand.Reader, maxIndex)
		if err != nil {
			// Fallback (should be extremely rare)
			loser = depositedButNotClicked[0]
		} else {
			loser = depositedButNotClicked[nBig.Int64()]
		}
	} else {
		// Everyone clicked. The LAST person to click loses.
		// Sort clicks by reaction time (descending) to find the slowest.
		// Note: We trust the timestamps provided by the backend, but the sorting logic is guaranteed here.
		// Ideally, the enclave would measure time, but that requires moving the WebSocket connection here.
		sort.Slice(req.Clicks, func(i, j int) bool {
			return req.Clicks[i].ReactionTime > req.Clicks[j].ReactionTime
		})

		// The first element is now the one with the largest (slowest) reaction time
		// But we must ensure the clicker is actually a deposited player
		for _, click := range req.Clicks {
			clickerAddr := strings.ToLower(click.PlayerAddress)
			isDeposited := false
			for _, dp := range req.DepositedPlayers {
				if strings.ToLower(dp) == clickerAddr {
					isDeposited = true
					break
				}
			}
			if isDeposited {
				loser = clickerAddr
				break
			}
		}
	}

	if loser == "" {
		return nil, "", fmt.Errorf("could not determine loser")
	}

	// Determine winners (everyone else)
	winners := []string{}
	for _, addr := range req.DepositedPlayers {
		lowerAddr := strings.ToLower(addr)
		if lowerAddr != loser {
			winners = append(winners, lowerAddr)
		}
	}
	sort.Strings(winners) // Deterministic order

	return winners, loser, nil
}
