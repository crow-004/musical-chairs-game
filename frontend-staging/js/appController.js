// Use the globally available ethers object from the CDN script
// import { ethers } from 'ethers'; // Import ethers
import { sdk } from 'https://esm.sh/@farcaster/miniapp-sdk';

// --- Configuration ---
// Production URLs. Nginx will handle routing.
const BACKEND_URL = ""; // Relative path is correct, requests will go to the same host
const WEBSOCKET_URL = "wss://" + window.location.host + "/ws"; // Use secure WebSocket
const REQUIRED_PLAYERS = 5; // Define the number of players needed for the game
// const ETH_DECIMALS = 18; // ETH always has 18 decimals - ethers handles this

// --- Constants ---
const MAX_LOG_LINES = 100; // Limit the number of lines in the log output
const REFERRER_KEY = "musical_chairs_referrer_address"; // Key for localStorage

/**
 * Central controller for the Musical Chairs frontend application.
 * Manages state, interacts with wallet, backend API, WebSocket, and smart contract.
 */
export class AppController {
  // --- State Variables ---
  ethersProvider = null;
  signer = null;
  playerAddress = null;
  chainId = null;
  backendConfig = null;
  gameContract = null;
  currentGameId = null; // Backend Pending ID or Onchain ID
  currentOnchainGameId = null; // Explicitly store the onchain ID
  requiredPlayerCount = 5; // Default value, will be updated from config
  currentGameState = null;
  hasDeposited = false;
  depositTimerInterval = null;
  ws = null;
  clickTimerInterval = null;
  waitingRoomTimerInterval = null;
  isConnecting = false; // Flag to prevent concurrent connection attempts
  requiredChainId = null;
  lastLogMessage = "";
  web3Modal = null; // NEW: To hold the Web3Modal instance
  isMusicPlaying = false; // NEW: Track background music state

  // --- UI Elements (references passed from index.html) ---
  ui = {};

  /**
   * @param {object} uiElements - An object containing references to all necessary DOM elements.
   */
  constructor(uiElements) {
    this.ui = uiElements;
    // Set initial audio volume (optional)
    if (this.ui.gameMusic) {
      this.ui.gameMusic.volume = 0.3; // Set volume to 30%
    }
    if (this.ui.winSound) {
      this.ui.winSound.volume = 0.5; // Set win sound volume to 50%
    }
    if (this.ui.unlockSound) {
      this.ui.unlockSound.muted = true; // Ensure it's always muted
    }
    if (this.ui.backgroundMusic) {
      this.ui.backgroundMusic.volume = 0.2; // Set a low volume for background music
    }
  }

  /**
   * This function is called when the user clicks "Play Now" on the landing page.
   * It initializes the main application logic.
   */
  async initLanding() {
    this.log("Landing page initializing...");
    // NEW: Set up music controls immediately
    this.ui.muteToggleButton.addEventListener("click", () => {
      this.toggleBackgroundMusic();
    });
    this.log("Initialization complete.");
    sdk.actions.ready();
  }
  async initApp() {
    this.log("Initializing full application...");
    this.playBackgroundMusic(); // Attempt to play, will be handled by user interaction

    // --- Assign main app event listeners ---
    this.ui.joinButton.addEventListener("click", this.joinGame.bind(this));
    this.ui.connectButton.addEventListener(
      "click",
      this.connectWallet.bind(this),
    );
    // Listener for the "Try Again" button in the failure modal
    if (this.ui.tryAgainButton) {
        this.ui.tryAgainButton.addEventListener("click", () =>
          this._showSelectionState(),
        );
    }
    // Inside your initApp() or setupListeners() method in appController.js:
    if (this.ui.backToSelectionButton) {
    this.ui.backToSelectionButton.addEventListener('click', () => {
        this.log("User navigating back to wallet selection.");
        this._showSelectionState(); // Call your existing helper function
    });
    }
    // --- NEW: Assign modal event listeners ---
    this.ui.modalCloseButton.addEventListener("click", () =>
      this.closeWalletModal(),
    );
    this.ui.modalOverlay.addEventListener("click", (e) => {
      // Close if clicking the overlay, not the content
      if (e.target === this.ui.modalOverlay) {
        this.closeWalletModal();
      }
    });

    // Add listener for the desktop wallet buttons inside the modal
    this.ui.desktopOptions.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON") {
        const walletKey = e.target.getAttribute("data-wallet");
        if (walletKey) {
          this.handleWalletSelection(walletKey);
        }
      }
    });
    this.ui.depositButton.addEventListener(
      "click",
      this.depositStake.bind(this),
    );
    this.ui.reactButton.addEventListener("click", this.sendReact.bind(this));
    this.ui.refundButton.addEventListener(
      "click",
      this.requestRefund.bind(this),
    );
    this.ui.claimButton.addEventListener(
      "click",
      this.claimWinningsFunc.bind(this),
    );

    this.handleReferralLinkOnLoad();

    // --- Load all backend data now ---
    this.log("Loading game data...");
    await this.fetchGameConfig(); // Moved from initLanding
    await this.fetchDailyRecord();
    this.startActiveUsersPolling(); // Start polling for active users
    this.fetchVisitors24h();

    // Attempt to auto-connect if the wallet is already permitted
    if (window.ethereum && window.ethereum.selectedAddress) {
      this.log("MetaMask already connected, attempting to initialize...");
      await this.connectWallet();
    } else {
      this.log("MetaMask not connected. Please connect your wallet.");
      this.updateConnectionStatusUI(); // Show "Not Connected" status
      this.updateUIButtons(); // Ensure buttons reflect the disconnected state
    }

    // The rest of the logic (initContracts, checkForRefundableGame, etc.)
    // is now called from within connectWallet() after a successful connection,
    // ensuring that the provider and signer are available.
    //
    // if (this.checkNetwork()) {
    //   await this.checkForRefundableGame();
    //   await this.checkForClaimableGame();
    // }
  }
  /**
   * Formats an Ethereum address for display (e.g., 0x1234...abcd).
   * @param {string} address The full address.
   * @returns {string} The formatted address.
   */
  formatAddress(address) {
    if (!address || typeof address !== "string" || address.length < 10) {
      return "N/A";
    }
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4,
    )}`;
  }

  /**
   * NEW: Tries to play the background music.
   * This will likely only succeed after a user interaction due to browser policies.
   */
  playBackgroundMusic() {
    if (this.ui.backgroundMusic && this.ui.backgroundMusic.paused && !this.isMusicPlaying) {
      this.log("Attempting to play background music...");
      this.ui.backgroundMusic.play().then(() => {
        this.log("Background music started successfully.");
        this.isMusicPlaying = true;
        this.updateMuteButtonUI();
      }).catch(error => {
        this.log("Background music auto-play was blocked by the browser. It will start after user interaction.");
        // Don't log as an error, this is expected behavior.
        console.log("Autoplay was prevented:", error.message);
        this.isMusicPlaying = false;
        this.updateMuteButtonUI();
      });
    }
  }

  /**
   * NEW: Toggles the background music on and off.
   */
  toggleBackgroundMusic() {
    if (this.ui.backgroundMusic.paused) {
      this.ui.backgroundMusic.play();
      this.isMusicPlaying = true;
    } else {
      this.ui.backgroundMusic.pause();
      this.isMusicPlaying = false;
    }
    this.updateMuteButtonUI();
  }

  /**
   * NEW: Updates the mute/unmute button icon based on the music playing state.
   */
  updateMuteButtonUI() {
    if (!this.ui.volumeOnIcon || !this.ui.volumeOffIcon) return;

    if (this.isMusicPlaying) {
      this.ui.volumeOnIcon.classList.remove('hidden');
      this.ui.volumeOffIcon.classList.add('hidden');
    } else {
      this.ui.volumeOnIcon.classList.add('hidden');
      this.ui.volumeOffIcon.classList.remove('hidden');
    }
  }

  /**
   * Checks for a referral code in the URL on page load and stores it.
   * This should only run once to credit the first referrer.
   */
  handleReferralLinkOnLoad() {
    try {
      const params = new URLSearchParams(window.location.search);
      const referrerAddress = params.get("ref");

      if (referrerAddress && window.ethers.isAddress(referrerAddress)) {
        const existingReferrer = localStorage.getItem(REFERRER_KEY);
        if (!existingReferrer) {
          localStorage.setItem(REFERRER_KEY, referrerAddress);
          this.log(`Referrer ${referrerAddress.substring(0, 6)}... saved.`);
        }
      }
    } catch (error) {
      // This can happen if URLSearchParams is not supported, but it's very rare.
      this.logError("Could not parse URL for referral link.", error);
    }
  }

  /**
   * Logs a message to the console and the UI log area.
   * Appends messages and handles auto-scrolling and line limits.
   * @param {string} message - The message to log.
   */
  log(message) {
    if (message === this.lastLogMessage) return; // Avoid duplicate consecutive messages
    this.lastLogMessage = message;
    const time = new Date().toLocaleTimeString();
    // NEW: Add timestamp to console.log as well
    console.log(`[${time}] ${message}`);
    const logEntry = `[${time}] ${message}`;

    // Append to the UI log
    this.ui.logOutput.textContent += `\n${logEntry}`;

    // Limit log lines
    const lines = this.ui.logOutput.textContent.split("\n");
    if (lines.length > MAX_LOG_LINES) {
      // Keep the last MAX_LOG_LINES lines, plus the initial message if it exists
      const initialMessage = this.ui.logOutput.textContent.startsWith(
        "Waiting for action...",
      )
        ? lines[0] + "\n"
        : "";
      this.ui.logOutput.textContent =
        initialMessage + lines.slice(lines.length - MAX_LOG_LINES).join("\n");
    }

    // Auto-scroll to the bottom
    this.ui.logOutput.scrollTop = this.ui.logOutput.scrollHeight;
  }

  /**
   * Logs an error message to the console and the UI log area.
   * @param {string} message - The error description.
   * @param {Error|any} error - The error object or details.
   */
  logError(message, error) {
    console.error(message, error);
    let errorMessage = message;
    if (error) {
      // Try to extract a meaningful message from the error object
      if (error.reason) {
        // Ethers contract error
        errorMessage += `: ${error.reason}`;
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      } else {
        errorMessage += `: ${String(error)}`;
      }
    }
    this.log(`ERROR: ${errorMessage}`); // Use the log function to display
  }

  /**
   * Handles common network-related errors from ethers.js calls.
   * Provides a more user-friendly message for common network-level failures.
   * @param {Error} error - The error object.
   * @param {string} contextMessage - A message describing the action that failed.
   * @returns {boolean} - True if the error was a recognized network error and was handled.
   */
  handleEthersNetworkError(error, contextMessage) {
    if (error.message.includes("Load failed") || error.message.includes("Failed to fetch")) {
      this.logError(
        `${contextMessage}. This can be caused by a network issue or a browser privacy extension (like an ad-blocker).`,
        null, // Pass null to prevent appending the generic error message
      );
      return true; // Error was handled
    }
    return false; // Error was not a recognized network error
  }

  /**
   * Sends an event to the analytics backend.
   * @param {string} eventType - Event type (e.g. 'WALLET_CONNECTED', 'DEPOSIT_SUCCESS').
   * @param {object} data - Additional data, including player_address and optionally game_id.
   */
  async trackEvent(eventType, data) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/events/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: eventType,
          ...data,
        }),
      });
      if (!response.ok) {
        console.error("Failed to track event:", await response.text());
      }
    } catch (error) {
      console.error("Error tracking event:", error);
    }
  }

  /**
   * Connects to the user's Ethereum wallet (MetaMask).
   * Initializes provider, signer, and fetches account/network info.
   */ // =======================================================
  // NEW: CUSTOM WALLET MODAL LOGIC 
  // =======================================================

  /**
   * UPDATED: Now opens the custom modal for wallet selection.
   * This is where the old Web3Modal open call used to be.
   */
  async connectWallet() {
    if (this.isConnecting) {
      this.log("Connection attempt already in progress.");
      return;
    }

    // --- 1. Check for In-App Browser Auto-Connect (Priority) ---
    // This handles the user opening the site directly inside a mobile wallet app.
    if (typeof window.ethereum !== "undefined" && window.ethereum.selectedAddress) {
      this.log("In-app wallet provider detected and already connected. Attempting auto-initialize...");
      this.isConnecting = true;
      if (this.ui.connectButton) {
        this.ui.connectButton.disabled = true;
        this.ui.connectButton.textContent = "Connecting...";
      }
      try {
        await this._initializeConnection(window.ethereum); // Re-uses existing core logic
      } catch (error) {
        this.logError("Auto-connect failed during init.", error);
        this.resetConnection();
      } finally {
        this.isConnecting = false;
        if (this.ui.connectButton) {
          this.ui.connectButton.disabled = false;
          this.ui.connectButton.textContent = "Connect Wallet";
        }
      }
      return;
    }

    // --- 2. Open Custom Modal for Selection/Deep Links ---
    if (this.ui.modalOverlay) {
        this.openWalletModal();
    } else {
        this.logError("Wallet modal structure not found. Check index.html.");
        alert("Wallet connection modal is missing.");
    }
  }


  /**
   * Opens the custom wallet connection modal.
   * Determines if desktop or mobile deep links should be shown.
   */
  openWalletModal() {
    // Basic check for mobile user agents
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    // Basic check for an injected wallet provider (e.g., in a DApp browser or with extension)
    const isWalletBrowser = typeof window.ethereum !== "undefined"; 

    // Logic to switch between desktop/in-wallet options and mobile deep links
    if (this.ui.desktopOptions && this.ui.mobileOptions) {
        if (isWalletBrowser && !isMobile) {
            // Desktop browser with extension
            this.ui.desktopOptions.style.display = "block";
            this.ui.mobileOptions.style.display = "none";
        } else if (isMobile && !isWalletBrowser) {
            // Mobile standard browser (needs deep links)
            this.ui.desktopOptions.style.display = "none";
            this.ui.mobileOptions.style.display = "block";
        } else {
             // Default to showing desktop options or in-wallet if detection is ambiguous
            this.ui.desktopOptions.style.display = "block";
            this.ui.mobileOptions.style.display = "none";
        }
    }

    if (this.ui.modalOverlay) {
        this.ui.modalOverlay.style.display = "block";
    }
  }

  /**
   * Closes the custom wallet connection modal.
   */
  closeWalletModal() {
    if (this.ui.modalOverlay) {
        this.ui.modalOverlay.style.display = "none";
    }
  }

  /**
   * Handles the click on a wallet button in the modal.
   * @param {string} walletKey - The key of the selected wallet (e.g., 'metamask').
   */
  async handleWalletSelection(walletKey) {
    this.openWalletModal(); // Keep modal open to show status
    
    let provider;
    let walletInfo = { 
        name: "Unknown", 
        logo: "", 
        downloadUrl: "https://muschairs.com/download-wallets" // Fallback link
    };

    const walletMap = {
      'metamask': { 
          check: window.ethereum?.isMetaMask, 
          name: "MetaMask", 
          logo: "images/icon-metamask-fox.svg", 
          downloadUrl: "https://metamask.io/download/" 
      },
      'coinbase': { 
          check: window.ethereum?.isCoinbaseWallet, 
          name: "Coinbase Wallet", 
          logo: "images/icon-coinbase.svg", 
          downloadUrl: "https://www.coinbase.com/wallet" 
      },
      'rabby': { 
          check: window.ethereum?.isRabby, 
          name: "Rabby Wallet", 
          logo: "images/icon-rabby.svg", 
          downloadUrl: "https://rabby.io/" 
      },
      'okx': { 
          check: (window.okxwallet || window.ethereum?.isOKXWallet), 
          name: "OKX Wallet", 
          logo: "images/icon-okx.svg", 
          downloadUrl: "https://www.okx.com/web3" 
      },
      'zerion': { 
      // Check for a common Zerion injection property (often similar to MetaMask/Ethereum standard)
      check: (window.ethereum && window.ethereum.isZerion), 
      name: "Zerion Wallet", 
      logo: "images/icon-zerion.svg", // Replace with your actual path
      downloadUrl: "https://zerion.io/wallet" 
      },
    };

    walletInfo = walletMap[walletKey] || walletInfo;

    // --- 1. CHECK FOR PROVIDER (Extension Installed) ---
    if (walletInfo.check) {
      provider = window.ethereum;
 
      this._showConnectingState(walletInfo.name, walletInfo.logo); // Show loading spinner modal
 
      try {
        // Attempt to request connection
        await this._initializeConnection(provider); // RE-USE THE CORE LOGIC
 
        // ONLY ON TRUE SUCCESS:
        this.closeWalletModal(); // Close only on success
        this.log("SUCCESS: Wallet connected and modal closed."); // Success feedback
        // TODO: Optional: Show a temporary green "toaster" notification here (outside the modal)

      } catch (error) {
        this.logError(`ERROR: Connection failed for ${walletInfo.name}.`, error);
 
        // Error from user cancelling, etc. Revert to selection state.
        this.ui.statusTitle.textContent = `Connection Failed`;
        this.ui.statusMessage.textContent = `User cancelled or connection timed out. Error: ${error.message.substring(0, 50)}...`;
 
        // Wait 3 seconds, then show the initial selection state again.
        setTimeout(() => {
          this._showSelectionState();
        }, 3000); 
        
        // **CRITICAL FIX: STOP EXECUTION HERE IF THERE WAS AN ERROR**
        return; 
      }
      
    } else {
      // --- 2. NO PROVIDER FOUND (Extension Missing) ---
      this.logError(`The ${walletInfo.name} extension was not detected.`);
      this._showFailureState(walletInfo.name, walletInfo.logo, walletInfo.downloadUrl);
    }
  }

// =======================================================
// END NEW: CUSTOM WALLET MODAL LOGIC
// =======================================================

  /**
   * NEW: Helper to determine wallet name from the provider object.
   * @param {object} provider The EIP-1193 provider.
   * @returns {string} The name of the wallet or 'Unknown'.
   */
  _getWalletName(provider) {
    if (!provider) return 'Unknown';
    if (provider.isMetaMask) return 'MetaMask';
    if (provider.isCoinbaseWallet) return 'Coinbase Wallet';
    if (provider.isRabby) return 'Rabby Wallet';
    if (provider.isOKXWallet || window.okxwallet) return 'OKX Wallet';
    if (provider.isZerion) return 'Zerion Wallet';
    return 'Unknown';
  }


  /**
   * The core connection logic, now separated to be called with a specific provider.
   * @param {object} provider - The EIP-1193 provider to connect to.
   */
  async _initializeConnection(provider) {
    this.log(`Initializing connection with selected wallet...`);

    try {
      // Request account access from the chosen provider
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned from wallet.");
      }

      this.ethersProvider = new window.ethers.BrowserProvider(provider);
      this.signer = await this.ethersProvider.getSigner();
      this.playerAddress = await this.signer.getAddress();

      // Get network info
      const network = await this.ethersProvider.getNetwork();
      this.chainId = network.chainId;
      
      const walletName = this._getWalletName(provider);
      // Track wallet connection event
      this.trackEvent("WALLET_CONNECTED", {
        player_address: this.playerAddress,
        data: {
          auto_connected: this.isConnecting === false,
          wallet_name: walletName,
        },
      });

      this.log(`Wallet connected: ${this.playerAddress}`);
      this.log(`Network: ${network.name} (Chain ID: ${this.chainId})`);

      // Setup event listeners for account/network changes
      provider.removeAllListeners("accountsChanged");
      provider.on(
        "accountsChanged",
        this.handleAccountsChanged.bind(this),
      );
      provider.removeAllListeners("chainChanged");
      provider.on("chainChanged", this.handleChainChanged.bind(this));

      // Fetch backend config and initialize contracts AFTER connecting
      if (!this.backendConfig) {
        await this.fetchGameConfig();
      } else {
        this.initContracts();
      }

      this.updateConnectionStatusUI();
      await this.updateBalanceDisplay();
      if (this.checkNetwork() && this.gameContract) { // Ensure contract is initialized
        await this.checkForRefundableGame();
        await this.checkForClaimableGame();
      }

      this.updateUIButtons();
    } catch (error) {
      if (error.code === 4001) {
        this.log("Wallet connection request was rejected by the user.");
      } else {
        this.logError(`Failed to connect with selected wallet.`, error);
      }
      this.resetConnection();
    } finally {
      // This logic should run regardless of connection success or failure
      this.isConnecting = false;
      this.ui.connectButton.disabled = false;
      this.ui.connectButton.textContent = "Connect Wallet";
    }
  }

  /**
   * Handles the 'accountsChanged' event from MetaMask.
   * @param {string[]} accounts - Array of connected account addresses.
   */
  async handleAccountsChanged(accounts) {
    this.log("Wallet account changed.");
    if (accounts.length === 0) {
      // MetaMask is locked or the user has disconnected all accounts
      this.log("Wallet disconnected or locked.");
      this.resetConnection();
    } else {
      try {
        // Reconnect with the new account
        await this.connectWallet(); // Re-run the connection process with the default provider
      } catch (error) {
        this.logError(
          "An error occurred while handling account change.",
          error,
        );
      }
    }
  }

  /**
   * Handles the 'chainChanged' event from MetaMask.
   * Re-initializes the connection state without a full page reload.
   * @param {string} newChainId - The new chain ID (hexadecimal string).
   */
  async handleChainChanged(newChainId) {
    this.log(
      `Network changed to Chain ID: ${newChainId}. Re-initializing connection...`,
    );
    // Re-running the connection process is a more modern approach than a full page reload.
    // It avoids disrupting the user and prevents "extension context invalidated" errors.
    try {
      await this.connectWallet(); // Re-run the connection process with the default provider
    } catch (error) {
      this.logError("An error occurred while handling chain change.", error);
    }
  }

  /**
   * Resets connection state variables and UI elements.
   */
  resetConnection() {
    this.ethersProvider = null;
    this.signer = null;
    this.playerAddress = null;
    this.chainId = null;
    this.gameContract = null;
    // Keep backendConfig and requiredChainId as they might be needed before reconnecting
    this.updateConnectionStatusUI(); // Update UI
    this.updateBalanceDisplay();
    this.resetGameControls(); // Also reset game specific controls
    this.updateUIButtons(); // Update buttons
    this.log("Connection reset.");
  }

  /**
   * Updates the UI elements displaying connection status.
   */
  updateConnectionStatusUI() {
    if (this.playerAddress && this.chainId) {
      this.ui.walletStatus.textContent = "Connected";
      this.ui.walletStatus.style.color = "green";
      this.ui.playerAddrSpan.textContent = this.formatAddress(this.playerAddress);
      this.ui.networkStatus.textContent = `${this.chainId}`; // Display Chain ID for now
    } else {
      this.ui.walletStatus.textContent = "Not Connected";
      this.ui.walletStatus.style.color = "red";
      this.ui.playerAddrSpan.textContent = "N/A";
      this.ui.playerBalanceSpan.textContent = "N/A";
      this.ui.networkStatus.textContent = "Unknown";
    }
    // Update required network display if available
    this.ui.requiredNetwork.textContent = this.requiredChainId
      ? String(this.requiredChainId)
      : "?";
  }

  /**
   * Checks if the connected network matches the required network.
   * Updates UI accordingly.
   * @returns {boolean} - True if the network is correct, false otherwise.
   */
  checkNetwork() {
    if (!this.chainId || !this.requiredChainId) {
      this.ui.networkStatus.style.color = "orange"; // Indicate uncertainty
      return false;
    }
    if (BigInt(this.chainId) === BigInt(this.requiredChainId)) {
      this.ui.networkStatus.style.color = "green";
      this.log("Connected to the correct network.");
      return true;
    } else {
      this.ui.networkStatus.style.color = "red";
      this.logError(
        `Incorrect network! Please connect to Chain ID ${this.requiredChainId}.`,
      );
      // NEW: Prompt user to switch network instead of just alerting
      this.promptSwitchNetwork();
      return false;
    }
  }

  /**
   * Prompts the user to switch to the required network in MetaMask,
   * or to add it if it doesn't exist.
   */
  async promptSwitchNetwork() {
    if (!window.ethereum || !this.requiredChainId) {
      this.logError("MetaMask is not available or required network is unknown.");
      return;
    }

    const requiredChainIdHex = "0x" + this.requiredChainId.toString(16);

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: requiredChainIdHex }],
      });
      this.log("Network switched successfully in MetaMask.");
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask.
      if (switchError.code === 4902) {
        this.log("This network is not in your MetaMask, attempting to add it...");
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: requiredChainIdHex,
                chainName: "Arbitrum Sepolia",
                rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
                nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
                blockExplorerUrls: ["https://sepolia.arbiscan.io/"],
              },
            ],
          });
        } catch (addError) {
          this.logError("Failed to add the Arbitrum Sepolia network.", addError);
        }
      } else {
        this.logError("Failed to switch the network in MetaMask.", switchError);
      }
    }
  }

  /**
   * Fetches and displays the player's ETH balance.
   */
  async updateBalanceDisplay() {
    if (!this.playerAddress || !this.ethersProvider) {
      this.ui.playerBalanceSpan.textContent = "N/A";
      return;
    }

    // NEW: Check if the network is correct before fetching balance
    if (!this.checkNetwork()) {
      this.ui.playerBalanceSpan.textContent = "Wrong Network";
      return;
    }

    try {
      const balance = await this.ethersProvider.getBalance(this.playerAddress);
      const formattedBalance = window.ethers.formatEther(balance);
      // Display with a reasonable number of decimal places
      this.ui.playerBalanceSpan.textContent = `${parseFloat(
        formattedBalance,
      ).toFixed(4)} ETH`;
    } catch (error) {
      // NEW: Check for the specific "missing trie node" error
      const errorMessage = JSON.stringify(error);
      if (errorMessage.includes("missing trie node")) {
        this.logError(
          "Failed to fetch balance due to a temporary RPC node issue. Please try refreshing, or consider using a more robust RPC URL in your wallet settings for this network, like Ankr's.",
          null,
        );
      } else if (!this.handleEthersNetworkError(error, "Failed to fetch balance")) {
        this.logError("Failed to fetch balance", error); // Log other errors normally
      }
      this.ui.playerBalanceSpan.textContent = "Error";
    }
  }

  /**
   * @private
   * Helper to get window.location.hostname, allowing for easier testing.
   */
  _getHostname() {
    return window.location.hostname;
  }

  /**
   * Fetches game configuration (addresses, stake) from the backend.
   */
  async fetchGameConfig() {
    // Ensure ethers is available globally before proceeding
    // This check is still relevant even with mocked fetch, as ethers is used for formatting
    if (typeof window.ethers === "undefined") {
      this.logError("Ethers library not loaded!");
      // Optionally disable buttons or show a message indicating missing dependency
      return;
    }

    // If not using mock, proceed to fetch from backend
    this.log("Fetching game configuration from backend...");
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/config`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      this.backendConfig = await response.json();
      this.log("Game configuration loaded:");
      console.log(this.backendConfig); // Log the full config object for debugging

      // Extract and store the required chain ID
      this.requiredChainId = this.backendConfig.chainId
        ? BigInt(this.backendConfig.chainId)
        : null;
      if (!this.requiredChainId) {
        this.logError("Required Chain ID not found in backend config!");
      }
      this.requiredPlayerCount = this.backendConfig.requiredPlayers || 5;

      this.updateUIWithConfig(); // Update UI with real data

      // Set the initial player count display with the correct value from config
      this.updateGameStateUI("Waiting to join...", 0, [], [], "N/A");

      // If already connected, check network compatibility now
      if (this.chainId) {
        this.checkNetwork();
      }
      // Initialize contracts if provider exists (meaning wallet is connected)
      if (this.ethersProvider) {
        this.initContracts();
      }
    } catch (error) {
      this.logError("Failed to fetch game configuration", error);
      // Clear potentially stale config display on error
      this.ui.contractAddrSpan.textContent = "Error";
      this.ui.stakeAmountSpan.textContent = "Error";
      this.ui.commissionAmountSpan.textContent = "Error";
      this.ui.requiredNetwork.textContent = "?";
    } // Closes catch
  }

  updateUIWithConfig() {
    if (typeof window.ethers === "undefined" || !this.backendConfig) {
      this.ui.contractAddrSpan.textContent =
        (this.backendConfig && this.backendConfig.contractAddress) || "N/A";
      this.ui.stakeAmountSpan.textContent = "N/A";
      this.ui.commissionAmountSpan.textContent = "N/A";
      this.ui.requiredNetwork.textContent =
        this.backendConfig && this.backendConfig.chainId
          ? String(this.backendConfig.chainId)
          : "?";
    } else {
      this.ui.contractAddrSpan.textContent =
        this.backendConfig.contractAddress || "N/A";
      // Always add "ETH" if value exists and ethers are available
      this.ui.stakeAmountSpan.textContent = this.backendConfig.stakeAmount
        ? window.ethers.formatEther(this.backendConfig.stakeAmount) + " ETH"
        : "N/A";

      // V4+ Commission Logic: Always use platformCommissionBps if it exists.
      // This correctly handles the case where the commission is 0.
      if (this.backendConfig.platformCommissionBps != null && this.backendConfig.stakeAmount) {
        const commissionBps = BigInt(this.backendConfig.platformCommissionBps);
        const stake = BigInt(this.backendConfig.stakeAmount);
        const commissionPerPlayer = (stake * commissionBps) / 10000n;
        this.ui.commissionAmountSpan.textContent = `${window.ethers.formatEther(commissionPerPlayer)} ETH (per player)`;
      } else {
        // Fallback if the new commission field is not available in the config.
        // This removes the dependency on the old `commissionAmount` field.
        this.ui.commissionAmountSpan.textContent = "N/A";
      }

      this.ui.requiredNetwork.textContent = this.requiredChainId
        ? String(this.requiredChainId)
        : "?";

      // --- Update Dynamic Rules Text ---
      if (this.ui.ruleNetworkName && this.backendConfig.chainId) {
        const chainId = parseInt(this.backendConfig.chainId);
        let networkName = `(Chain ID ${chainId})`;
        if (chainId === 42161) networkName = "(Arbitrum One)";
        else if (chainId === 8453) networkName = "(Base)";
        else if (chainId === 1) networkName = "(Ethereum Mainnet)";
        else if (chainId === 421614) networkName = "(Arbitrum Sepolia Testnet)";
        this.ui.ruleNetworkName.textContent = networkName;
      }

      if (this.ui.ruleStakeAmount && this.backendConfig.stakeAmount) {
        this.ui.ruleStakeAmount.textContent = `(${window.ethers.formatEther(this.backendConfig.stakeAmount)} ETH)`;
      }

      if (this.ui.ruleCommissionPercent && this.backendConfig.platformCommissionBps != null) {
        this.ui.ruleCommissionPercent.textContent = `${this.backendConfig.platformCommissionBps / 100}%`;
      }

      // --- Dynamically update game rules based on config ---
      const required = this.backendConfig.requiredPlayers;
      // Fallback to 'required' if 'minPlayersToStartAfterDeposits' is not provided or invalid
      const minToStart =
        typeof this.backendConfig.minDepositedPlayersToStart === "number"
          ? this.backendConfig.minDepositedPlayersToStart
          : required;

      if (this.ui.ruleGameStart) {
        if (!required || minToStart >= required) {
          this.ui.ruleGameStart.textContent = `Click "Join / Find Game" to enter a waiting room. A game is created on-chain when ${required} players join.`;
        } else {
          this.ui.ruleGameStart.textContent = `Click "Join / Find Game" to enter a waiting room. A game is created on-chain when ${required} players join, or if the waiting room timer expires with at least ${minToStart} players.`;
        }
      }

      if (this.ui.ruleMusicStart) {
        if (!required || minToStart >= required) {
          this.ui.ruleMusicStart.textContent = `The music will begin to play once all ${required} players have deposited their stake.`;
        } else {
          this.ui.ruleMusicStart.textContent = `The music will begin to play once all ${required} players have deposited, or if the deposit timer expires with at least ${minToStart} players.`;
        }
      }
    }
  }

  /**
   * Initializes Ethers contract instances.
   * Requires provider, signer, and backendConfig to be set.
   */
  initContracts() {
    // Ensure backendConfig is loaded before initializing contracts
    if (!this.backendConfig) {
      this.log("Cannot initialize contracts: Backend config not loaded.");
      return;
    }
    // Ensure ethers is available globally before proceeding
    if (typeof window.ethers === "undefined") {
      this.logError("Ethers library not loaded, cannot initialize contracts!");
      return;
    }

    if (
      !this.ethersProvider ||
      !this.signer ||
      !this.backendConfig ||
      !this.backendConfig.contractAddress
    ) {
      this.log(
        "Cannot initialize contracts: Missing provider, signer, or game contract address.",
      );
      return;
    }
    try {
      // Game contract ABI including deposit, refund, claim, and necessary view functions
      // NOTE: isWinner is now part of the contract again, update ABI
      const gameAbi = [
        // Transactions
        "function depositStake(uint256 _gameId)",
        "function requestRefund(uint256 _gameId)",
        "function claimWinnings(uint256 _gameId)",
        // View functions needed for UI/logic
        "function isWinnerOfGame(uint256 gameId, address playerAddress) view returns (bool)", // Corrected function name
        // V3 Referral Functions
        "function referralEarnings(address referrer) view returns (uint256)",
        "function claimReferralEarnings()",
        "function winningsClaimed(uint256 gameId, address player) view returns (bool)",
        "function winningsPerWinner(uint256 gameId) view returns (uint256)",
        "function refundClaimed(uint256 gameId, address player) view returns (bool)", // Added for refund check
        "function getPlayerDepositStatus(uint256 gameId, address playerAddress) view returns (bool)", // Added for refund check
        "function games(uint256 gameId) view returns (uint256 id, uint8 state, address[] players, uint256 depositCount, uint256 createdAt, uint256 endedAt, address loser)", // Added to potentially fetch game state directly if needed, though WS is primary
      ];
      this.gameContract = new window.ethers.Contract(
        this.backendConfig.contractAddress,
        gameAbi,
        this.signer,
      ); // Use signer for writing, provider for reading if needed
      this.log("Game contract initialized.");
    } catch (error) {
      this.logError("Error initializing contracts:", error);
      this.gameContract = null;
    }
  }

  /**
   * Sends a request to the backend API to join or find an available game.
   */
  async joinGame() {
    // --- FIX: Unlock audio context on user interaction ---
    // Mobile browsers block audio that isn't started by a direct user action.
    // By playing and immediately pausing a muted sound inside this click handler,
    // we "unlock" the browser's audio context, allowing the game music to be
    // started programmatically later by a WebSocket message.
    if (this.ui.unlockSound && this.ui.unlockSound.paused) {
      this.log("Unlocking audio context on join...");
      this.ui.unlockSound.play().catch(() => { /* Ignore errors, this is best-effort */ });
    }

    if (!this.playerAddress || !this.checkNetwork()) {
      this.logError("Cannot join game: Wallet not connected or wrong network.");
      return;
    }
    if (this.currentGameId) {
      this.logError("Already in a game or waiting room.");
      return;
    }
    this.log("Attempting to join/find a game...");
    this.ui.joinButton.disabled = true;
    this.ui.joinButton.textContent = "Joining...";

    try {
      // Step 1: Request a nonce from the backend
      this.log("Requesting join nonce...");
      const nonceResponse = await fetch(`${BACKEND_URL}/api/v1/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerAddress: this.playerAddress }),
      });

      if (!nonceResponse.ok) {
        const errorData = await nonceResponse.json();
        throw new Error(
          errorData.error ||
            `Failed to get join nonce (status: ${nonceResponse.status})`,
        );
      }
      const { nonce } = await nonceResponse.json();
      if (!nonce) {
        throw new Error("Nonce not received from server.");
      }
      this.log("Join nonce received. Please sign the message in your wallet.");

      // Step 2: Sign the nonce
      const messageToSign = `Join Musical Chairs game with nonce: ${nonce}`;
      const signature = await this.signer.signMessage(messageToSign);
      this.log("Message signed. Verifying with server...");

      // Step 3: Get referrer from localStorage
      const referrerAddress = localStorage.getItem(REFERRER_KEY);

      // Step 4: Send signature and referrer to verification endpoint
      const verifyResponse = await fetch(`${BACKEND_URL}/api/v1/join/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerAddress: this.playerAddress,
          referrerAddress: referrerAddress, // Send referrer address to backend
          signature: signature,
        }),
      });

      const data = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(
          data.error || `HTTP error! Status: ${verifyResponse.status}`,
        );
      }

      // Track join attempt event
      this.trackEvent("JOIN_ATTEMPT", { player_address: this.playerAddress });

      if (!data.gameId) {
        console.error("Invalid response from backend:", data);
        throw new Error("Received an invalid game ID from the server.");
      }

      this.log(`Joined game room. Game ID: ${data.gameId}`);
      this.currentGameId = data.gameId;
      this.currentOnchainGameId = null;
      this.handleGameUpdate(data.gameState);
      await this.connectWebSocketWithToken(data.wsToken);
    } catch (error) {
      this.logError("Failed to join game", error);
      this.resetGameControls(); // Reset game state on failure
    } finally {
      // Re-enable join button only if no game was successfully joined
      if (!this.currentGameId) {
        this.ui.joinButton.disabled = false;
      }
      this.ui.joinButton.textContent = "Join / Find Game";
      this.updateUIButtons(); // Update all button states
    }
  }

  async fetchDailyRecord() {
    // NEW: Add a guard to ensure the elements exist before fetching.
    // This prevents errors on pages where the record display is not present.
    if (!this.ui.recordAmountSpan || !this.ui.recordHolderSpan) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/record/daily-winnings`);
      if (!response.ok) {
        if (response.status === 404) {
          this.ui.recordAmountSpan.textContent = "No record yet";
          this.ui.recordHolderSpan.textContent = "N/A";
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const record = await response.json();
      const winningsInEth = window.ethers.formatEther(record.totalWinnings);
      this.ui.recordAmountSpan.textContent = `${parseFloat(winningsInEth).toFixed(
        4,
      )} ETH`;
      // NEW: Use ethers.getAddress to format with checksum
      this.ui.recordHolderSpan.textContent = window.ethers.getAddress(
        record.playerAddress,
      );
    } catch (error) {
      this.logError("Failed to fetch daily record", error);
      this.ui.recordAmountSpan.textContent = "Error";
      this.ui.recordHolderSpan.textContent = "Error";
    }
  }

  /**
   * Updates the visibility of the deposit button based on game state.
   */
  updateDepositButtonVisibility() {
    // Ensure ethers is available globally before proceeding
    if (typeof window.ethers === "undefined") {
      // Cannot format ETH amount, hide button or show error
      this.ui.depositButton.style.display = "none";
      return;
    }

    // --- DEBUG LOGGING ---
    console.log("Checking deposit button visibility with state:", {
      gameContractExists: !!this.gameContract,
      backendConfigExists: !!this.backendConfig,
      playerAddressExists: !!this.playerAddress,
      currentOnchainGameId: this.currentOnchainGameId,
      currentGameState: this.currentGameState,
    });

    // Deposit button should only be visible if game is onchain and awaiting deposits
    if (
      this.gameContract &&
      this.backendConfig &&
      this.playerAddress &&
      this.currentOnchainGameId &&
      this.currentGameState === "WaitingForDeposits" &&
      // NEW CHECK: Also ensure this specific player hasn't deposited yet.
      !this.hasDeposited
    ) {
      this.ui.depositButton.style.display = "inline-block";
      this.ui.depositButton.disabled = false;
      this.ui.depositButton.textContent = `Deposit ${window.ethers.formatEther(this.backendConfig.stakeAmount)} ETH`;
    } else {
      this.ui.depositButton.style.display = "none";
    }
  }

  /**
   * Sends a transaction to the game contract to deposit the stake.
   */
  async depositStake() {
    // --- FIX: Add explicit check for onchainGameId ---
    if (!this.currentOnchainGameId) {
      this.logError("Cannot deposit: On-chain Game ID is not yet available. Please wait a moment.", null);
      return;
    }

    if (
      !this.gameContract ||
      !this.currentOnchainGameId ||
      !this.checkNetwork() ||
      !this.backendConfig ||
      !this.backendConfig.stakeAmount
    ) {
      this.logError(
        "Cannot deposit stake: Game contract not ready, no onchain game ID, wrong network, or stake amount unknown.",
      );
      return;
    }
    this.log(
      `Depositing stake for onchain game ${this.currentOnchainGameId}...`,
    );
    this.ui.depositButton.disabled = true;
    this.ui.depositButton.textContent = "Depositing...";

    try {
      const stakeAmountInWei = BigInt(this.backendConfig.stakeAmount); // Ensure stakeAmount is in wei
      const tx = await this.gameContract.depositStake(
        this.currentOnchainGameId,
        { value: stakeAmountInWei },
      );

      this.log(`Deposit transaction sent: ${tx.hash}`);
      // Hide button immediately for better UX.
      this.ui.depositButton.style.display = "none";
      await tx.wait(); // Wait for confirmation
      this.hasDeposited = true; // Set local flag for immediate UI update
      this.log("Stake deposited successfully!");

      // Track successful deposit event
      this.trackEvent("DEPOSIT_SUCCESS", {
        player_address: this.playerAddress,
        game_id: parseInt(this.currentOnchainGameId),
        amount: this.backendConfig.stakeAmount.toString(), // Send the deposit amount
      });

      // Game state update should come via WebSocket
    } catch (error) {
      // Check if the error is a user rejection from MetaMask.
      // Ethers v6 uses a 'code' property. Common codes are 'ACTION_REJECTED'.
      // EIP-1193 providers use code 4001 for user rejection.
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        this.log("Deposit transaction was cancelled by the user.");
        // If the user just cancelled, re-enable the button so they can try again.
        this.ui.depositButton.disabled = false;
        this.ui.depositButton.style.display = "inline-block"; // Ensure it's visible
      } else {
        // For other errors (e.g., transaction reverted), log it and keep the button hidden
        // to prevent repeated failed transactions. The user should refresh or take other action.
        this.logError("Failed to deposit stake", error);
        this.ui.depositButton.style.display = "none"; // Keep it hidden on failure
        alert("Deposit failed. Please check the console for errors and refresh the page if necessary.");
      }
    } finally {
      // This block runs regardless of success or failure.
      // We only want to reset the button text, not its visibility or disabled state,
      // as that is handled in the try/catch blocks.
      if (
        typeof window.ethers !== "undefined" &&
        this.backendConfig &&
        this.backendConfig.stakeAmount
      ) {
        this.ui.depositButton.textContent = `Deposit ${window.ethers.formatEther(this.backendConfig.stakeAmount)} ETH`;
      } else {
        this.ui.depositButton.textContent = "Deposit Stake";
      }
    }
  }

  /**
   * Establishes a WebSocket connection to the backend for game updates.
   * @param {string} gameId - The ID of the game to connect to (Backend Pending ID or Onchain ID).
   */
  async connectWebSocketWithToken(token) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.log("WebSocket already open.");
      return;
    }
    if (!token) {
      this.logError("Cannot connect WebSocket: No session token provided.");
      return;
    }

    // Connect using the one-time token
    const wsUrl = `${WEBSOCKET_URL}?token=${token}`;
    this.log("Connecting to WebSocket...");

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.log(`WebSocket connection established securely.`);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleWebSocketMessage(message); // Delegate message handling
      } catch (error) {
        this.logError("Error processing WebSocket message", error);
      }
    };

    this.ws.onerror = (error) => {
      this.logError("WebSocket error occurred", error);
    };

    this.ws.onclose = (event) => {
      this.log(
        `WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason || "No reason specified"}`,
      );
      this.ws = null; // Clear the instance

      // Handle unexpected closures
      if (
        this.currentGameState !== "Finished" &&
        this.currentGameState !== "Cancelled" &&
        this.currentGameState !== "Failed"
      ) {
        this.log("Connection lost unexpectedly. You might need to rejoin.");
        this.resetGameControls(); // Resetting might be the safest option
        this.updateUIButtons();
      }
    };
  }

  /**
   * Handles incoming WebSocket messages based on their type.
   * @param {object} message - The parsed WebSocket message.
   */
  handleWebSocketMessage(message) {
    // NEW: Add a timestamp to the console log to see exactly when the message was processed by the browser.
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] WebSocket message received:`, message);
    switch (message.type) {
      case "game_update":
        this.handleGameUpdate(message.payload);
        break;
      case "game_creation_failed":
        this.logError(
          `Onchain game creation failed for pending ID ${message.payload.pendingGameID}: ${message.payload.reason}`,
        );
        alert(
          `Failed to create the game on the blockchain: ${message.payload.reason}. Please try joining again.`,
        );
        console.log(
          `Failed to create the game on the blockchain: ${message.payload.reason}. Please try joining again.`,
        );
        this.resetGameControls();
        break;
      case "start_clicking":
        this.handleStartClicking();
        break;
      case "player_joined": // Handle updates when others join
        this.log(
          `Player ${message.payload.joinedPlayer} joined the waiting room.`,
        );
        this.log("player_joined payload:", message.payload.gameState);
        this.handleGameUpdate(message.payload.gameState); // The payload from player_joined is the full game state of the pending game
        break;
      case "game_status_message":
        this.log(`Status message from server: ${message.payload.message}`);
        this.ui.gameStatusText.textContent = message.payload.message; // Update the status text
        // Optionally disable all buttons while waiting for confirmation
        this.ui.depositButton.style.display = "none";
        this.ui.joinButton.disabled = true;
        break;
      case "error":
        this.logError(
          "Error message from server via WebSocket",
          message.payload,
        );
        break;
      case "pending_game_cancelled":
        this.logError(
          `Pending game ${message.payload.pendingGameID} was cancelled: ${message.payload.message}`,
        );
        if (this.currentGameId === message.payload.pendingGameID) {
          alert(
            `The game room you were waiting in has timed out and was cancelled. Please try joining again.`,
          );
          console.log(
            `The game room you were waiting in has timed out and was cancelled. Please try joining again.`,
          );
          this.resetGameControls();
        }
        break;
      default:
        this.log(`Unknown WebSocket message type: ${message.type}`);
    }
  }

  /**
   * Handles game state updates received via WebSocket or initial join response.
   * Updates UI elements and manages audio playback.
   * @param {object} payload - The game state data from the backend.
   */
  async handleGameUpdate(payload) {
    // Store the previous state to detect when the game finishes
    const oldState = this.currentGameState;

    // ADD THIS LOG TO SEE EXACTLY WHAT THE FRONTEND RECEIVES
    console.log(
      "Received game_update payload:",
      JSON.stringify(payload, null, 2),
    );

    if (!payload || !payload.backendPendingID || !payload.state) {
      this.logError("Received invalid game update payload", payload);
      return;
    }

    // --- UPDATED LOGIC: Handle cancellation/failure from WaitingForPlayers state ---
    // If the game is cancelled or failed and the previous state was waiting for players,
    // it means the waiting room timed out. In this case, the user couldn't have
    // deposited, so we just reset the UI to allow them to join a new game
    // without needing to refresh.
    if (
      (payload.state === "Cancelled" || payload.state === "Failed") &&
      oldState === "WaitingForPlayers"
    ) {
      this.log("The waiting room timed out. You can now join a new game.");
      alert("The waiting room timed out as not enough players joined. Please try again.");
      this.resetGameControls();
      this.updateUIButtons();
      return; // Stop further processing for this specific case
    }

    // The source of truth for the game state is the payload
    this.currentGameState = payload.state;
    // The backendPendingID is the stable identifier for the game session.
    // We should always use it as the primary currentGameId.
    if (payload.backendPendingID) {
      this.currentGameId = payload.backendPendingID;
    }

    // The onchainGameID is used for contract interactions.
    // It can be null while the game is pending.
    // If the payload includes an on-chain ID, it's the new source of truth for the ID.
    if (payload.onchainGameID) {
      if (this.currentOnchainGameId !== payload.onchainGameID) {
        this.log(`Game is now on-chain! Onchain ID: ${payload.onchainGameID}`);
      }
      this.currentOnchainGameId = payload.onchainGameID;
      // The main game ID should now be the on-chain ID for all subsequent actions.
    }

    // NEW: Check if the current player has deposited based on the payload
    if (payload.depositedPlayers && this.playerAddress) {
      const playerAddrLower = this.playerAddress.toLowerCase();
      this.hasDeposited = payload.depositedPlayers.some(
        (addr) => addr.toLowerCase() === playerAddrLower,
      );
    }

    // Always display the stable backend ID to the user.
    // Show "Onchain: [ID]" in logs for debugging, but keep UI consistent.
    if (this.currentGameId) {
      this.ui.gameIdSpan.textContent = `${this.currentGameId.substring(0, 8)}...`;
    } else {
      this.ui.gameIdSpan.textContent = "N/A";
    }

    // Update UI with all the data from the payload
    this.updateGameStateUI(
      payload.state,
      payload.depositedCount || 0,
      payload.players || [],
      payload.winners || [],
      payload.loser || "N/A",
    );

    // Start or stop the waiting room timer
    this.startWaitingRoomTimer(
      payload.state,
      payload.createdAtUnix,
      payload.timeoutSeconds,
    );

    // Start or stop the deposit timer
    this.startDepositTimer(
      payload.state,
      payload.createdAtUnix,
      payload.timeoutSeconds,
    );

    // Start or stop the click timer
    this.startClickTimer(
      payload.state,
      payload.clickWindowOpenUnix,
      payload.clickTimeoutSeconds,
    );

    // Manage Audio based on state
    if (this.currentGameState === "MusicPlaying") {
      // FIX: Directly check if background music is playing and pause it.
      if (this.ui.backgroundMusic && !this.ui.backgroundMusic.paused) {
        this.log("Pausing background music for the game round.");
        this.toggleBackgroundMusic();
      }

      // NEW: Randomly select and play one of the music tracks
      if (this.ui.gameMusic.paused) {
          const trackCount = 5; // We have music1.mp3 through music5.mp3
          const randomTrackNumber = Math.floor(Math.random() * trackCount) + 1;
          const musicSrc = `audio/music${randomTrackNumber}.mp3`;
          
          if (this.ui.gameMusic.src.endsWith(musicSrc)) {
              // If the same track is selected, just play it
              this.ui.gameMusic.play().catch(e => this.logError("Audio play error:", e));
          } else {
              // Load and play the new track
              this.ui.gameMusic.src = musicSrc;
              this.ui.gameMusic.play().catch(e => this.logError("Audio play error:", e));
          }
          this.log(`Starting music (Track ${randomTrackNumber})...`);
      }
    } else {
      if (this.ui.gameMusic && !this.ui.gameMusic.paused) {
        this.log("Pausing music...");
        this.ui.gameMusic.pause();
        this.ui.gameMusic.currentTime = 0; // Optional: Reset audio to start
      }
    }

    // Show/hide Deposit button based on state
    this.updateDepositButtonVisibility();

    // Check claim status ONLY if the game is finished
    // Use currentOnchainGameId for contract interactions
    if (
      this.currentGameState === "Finished" &&
      this.playerAddress &&
      this.gameContract &&
      this.currentOnchainGameId
    ) {
      // PASS THE PAYLOAD'S WINNERS LIST TO THE FUNCTION
      await this.checkClaimStatus(payload.winners);
    } else {
      this.ui.claimButton.style.display = "none"; // Hide claim button in other states
    }

    // --- NEW: Check for win/loss state on transition to Finished ---
    if (this.currentGameState === "Finished" && oldState !== "Finished") {
      const playerAddrLower = this.playerAddress ? this.playerAddress.toLowerCase() : null;
      if (playerAddrLower) {
        const isWinner =
          payload.winners &&
          payload.winners.some((w) => w.toLowerCase() === playerAddrLower);
        const isLoser =
          payload.loser && payload.loser.toLowerCase() === playerAddrLower;

        if (isWinner) {
          this.log("Congratulations, you won!");
          alert("You win!");
          if (this.ui.winSound) { this.ui.winSound.play().catch((e) => this.logError("Win sound play error:", e)); }
        } else if (isLoser) {
          this.log("You lost this round. Better luck next time!");
          alert("Better luck next time!");
          // NEW: Update balance display for the loser as well.
          await this.updateBalanceDisplay();
          // Reset controls for the loser so they can play again.
          this.resetGameControls();
          this.updateUIButtons();
        }
      }
      // After the game finishes, refresh the daily record display
      this.log("Game finished. Refreshing daily record...");
      await this.fetchDailyRecord();
    }

    // Manage react button visibility and state
    // Show the button as soon as the game is on-chain, but keep it disabled.
    const showReactButtonStates = [
      "WaitingForDeposits",
      "MusicPlaying",
      "AwaitingClicks",
    ];
    this.ui.reactButton.style.display = showReactButtonStates.includes(
      this.currentGameState,
    )
      ? "inline-block"
      : "none";
    if (this.currentGameState !== "AwaitingClicks") {
      this.ui.reactButton.disabled = true;
      this.ui.reactButton.textContent = "CLICK!";
    }

    this.updateUIButtons(); // Update general button states (Join, Refund)
  }

  /**
   * Updates the UI elements related to the game's current state.
   * @param {string} state - The game state (e.g., 'MusicPlaying').
   * @param {number} depositedCount - Number of players who have deposited.
   * @param {string[]} players - Array of player addresses.
   * @param {string[]} winners - Array of winner addresses.
   * @param {string} loser - Address of the loser.
   */
  updateGameStateUI(state, depositedCount, players, winners, loser) {
    this.ui.gameStatusText.textContent = state || "N/A";
    // Dynamically change the label based on the game state
    if (state === "WaitingForPlayers" || state === "Waiting to join...") {
      this.ui.playerCountLabel.textContent = "Players in room";
      this.ui.depositedCountSpan.textContent = `${players.length} / ${this.requiredPlayerCount}`; // Show players in room
    } else {
      // Once the game is on-chain, the total number of players for THIS game is fixed.
      // Use the length of the players array from the payload as the denominator.
      const totalPlayersInGame = players.length;
      this.ui.playerCountLabel.textContent = "Deposits made";
      this.ui.depositedCountSpan.textContent = `${depositedCount} / ${totalPlayersInGame}`; // Show deposited players
    }

    // Update player list
    this.ui.playerListUl.innerHTML = ""; // Clear previous list
    if (players && players.length > 0) {
      players.forEach((addr) => {
        const li = document.createElement("li");
        const shortAddr = `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
        li.textContent = shortAddr;
        li.title = addr; // Show full address on hover
        if (this.playerAddress && (addr.toLowerCase() === this.playerAddress.toLowerCase())) {
          li.style.fontWeight = "bold"; // Highlight current player
        }
        this.ui.playerListUl.appendChild(li);
      });
    } else {
      const li = document.createElement("li");
      li.textContent = "(empty)";
      this.ui.playerListUl.appendChild(li);
    }

    // Update results display
    this.ui.winnersListSpan.textContent =
      winners && winners.length > 0
        ? winners.map((addr) => `${addr.substring(0, 6)}...`).join(", ")
        : "N/A";
    this.ui.loserAddrSpan.textContent =
      loser !== "N/A"
        ? `${loser.substring(0, 6)}...${loser.substring(loser.length - 4)}`
        : "N/A";

    // Show/hide result section based on state
    const resultsVisible = state === "Finished";
    // Assuming these spans are inside paragraphs or divs you can target
    const winnersParent =
      this.ui.winnersListSpan.closest("p") ||
      this.ui.winnersListSpan.closest("div");
    const loserParent =
      this.ui.loserAddrSpan.closest("p") ||
      this.ui.loserAddrSpan.closest("div");

    if (winnersParent)
      winnersParent.style.display = resultsVisible ? "block" : "none";
    if (loserParent)
      loserParent.style.display = resultsVisible ? "block" : "none";
  }

  /**
   * Handles the 'start_clicking' message from the WebSocket.
   * Pauses music and enables the react button.
   */
  handleStartClicking() {
    this.log("Music stopped! Time to click!");
    this.currentGameState = "AwaitingClicks"; // Update internal state
    this.ui.gameStatusText.textContent = "MUSIC STOPPED! CLICK NOW!"; // Update status text
    this.ui.reactButton.style.display = "inline-block";
    this.ui.reactButton.disabled = false;
    this.ui.reactButton.textContent = "CLICK!";

    // Ensure music is paused
    if (this.ui.gameMusic && !this.ui.gameMusic.paused) {
      this.ui.gameMusic.pause();
      this.ui.gameMusic.currentTime = 0; // Optional: Reset audio
    }
  }

  /**
   * Sends the 'react' action via WebSocket when the button is clicked.
   */
  sendReact() {
    // Immediately disable the button and update text for instant feedback.
    // This makes the UI feel responsive even if the event loop is busy.
    this.ui.reactButton.disabled = true;
    this.ui.reactButton.textContent = "CLICKED!";

    // --- FIX: Optimistically stop the visual timer for instant feedback ---
    if (this.clickTimerInterval) {
      clearInterval(this.clickTimerInterval);
      this.clickTimerInterval = null;
      this.ui.clickTimerContainer.style.display = "none";
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logError("Cannot react: WebSocket is not connected.");
      // Re-enable the button if the action cannot be sent.
      this.ui.reactButton.disabled = false;
      this.ui.reactButton.textContent = "CLICK!";
      return;
    }
    // Ensure player can only react when game is in AwaitingClicks state
    if (this.currentGameState !== "AwaitingClicks") {
      this.logError("Cannot react: Not in the AwaitingClicks state.");
      // Re-enable the button if the action cannot be sent.
      this.ui.reactButton.disabled = false;
      this.ui.reactButton.textContent = "CLICK!";
      return;
    }

    this.log("Sending react action...");
    this.ws.send(JSON.stringify({ action: "react" }));
  }

  /**
   * Sends a transaction to the game contract to request a refund.
   * Typically used when a game is cancelled or failed.
   */
  async requestRefund() {
    // --- NEW: Re-verify deposit status directly before refunding ---
    // This makes the function self-contained and robust against stale UI state.
    const hasDepositedOnChain = await this.gameContract.getPlayerDepositStatus(
      this.currentOnchainGameId,
      this.playerAddress,
    );

    // Consolidated checks for clarity and robustness
    if (
      !this.gameContract ||
      !this.currentOnchainGameId ||
      (this.currentGameState !== "Cancelled" &&
        this.currentGameState !== "Failed") ||
      !this.checkNetwork() ||
      !hasDepositedOnChain // Use the freshly fetched on-chain status
    ) {
      this.logError(
        "Cannot request refund. Conditions not met (check connection, network, game state, and deposit status).",
      );
      return;
    }
    this.log(
      `Requesting refund for onchain game ${this.currentOnchainGameId}...`,
    );
    this.ui.refundButton.disabled = true;
    this.ui.refundButton.textContent = "Refunding...";

    try {
      // Call the smart contract directly
      const tx = await this.gameContract.requestRefund(
        this.currentOnchainGameId,
      );
      this.log(`Refund transaction sent: ${tx.hash}`);
      await tx.wait(); // Wait for confirmation
      this.log("Refund successfully processed on-chain!");

      // --- NEW: Track successful refund event ---
      // This event is crucial for the leaderboard to correctly calculate net profit.
      this.trackEvent("REFUND_SUCCESS", {
        player_address: this.playerAddress,
        game_id: parseInt(this.currentOnchainGameId),
        amount: this.backendConfig.stakeAmount.toString(), // The refunded amount is the stake amount
      });

      // NEW: Update balance display after successful refund
      await this.updateBalanceDisplay();

      alert("Your refund has been processed. You can now join a new game.");
      // After a successful refund, reset the game state so the player can join a new game.
      this.resetGameControls();
      this.updateUIButtons(); // This will re-enable the "Join" button
    } catch (error) {
      this.logError("Failed to request refund", error);
      // Display the specific error from the backend to the user
      alert(`Refund failed: ${error.message}`);
      this.ui.refundButton.disabled = false; // Re-enable on error
    } finally {
      this.ui.refundButton.textContent = "Request Refund";
    }
  }

  /**
   * Checks if the current player is a winner and if they have already claimed winnings.
   * Shows the claim button if applicable.
   */
  async checkClaimStatus(winners) {
    if (
      !this.gameContract ||
      !this.playerAddress ||
      !this.currentOnchainGameId ||
      this.currentGameState !== "Finished"
    ) {
      this.ui.claimButton.style.display = "none";
      return;
    }

    this.log("Checking winnings claim status...");
    this.ui.claimButton.style.display = "none"; // Hide initially
    this.ui.claimButton.disabled = true;

    try {
      // Use the winners list from the payload to avoid an extra on-chain call
      const playerAddrLower = this.playerAddress.toLowerCase();
      const iAmWinner = winners && winners.some(w => w.toLowerCase() === playerAddrLower);

      if (!iAmWinner) {
        this.log("You are not a winner in this game.");
        return;
      }
      this.log("You are a winner!");

      const alreadyClaimed = await this.gameContract.winningsClaimed(
        this.currentOnchainGameId,
        this.playerAddress,
      );
      if (alreadyClaimed) {
        this.log("Winnings already claimed.");
        return;
      }
      this.log("Winnings not yet claimed.");

      // If winner and not claimed, show the button
      // Ensure ethers is available globally before formatting
      if (typeof window.ethers === "undefined") {
        this.logError(
          "Ethers library not loaded, cannot format winnings amount!",
        );
        return; // Keep button hidden
      }
      const winningsAmount = await this.gameContract.winningsPerWinner(
        this.currentOnchainGameId,
      );
      const formattedAmount = window.ethers.formatEther(winningsAmount);
      this.log(`You can claim ${formattedAmount} ETH.`);
      this.ui.claimButton.style.display = "inline-block";
      this.ui.claimButton.disabled = false;
      this.ui.claimButton.textContent = `Claim ${formattedAmount} ETH`;
    } catch (error) {
      if (!this.handleEthersNetworkError(error, "Error checking claim status")) {
        this.logError("Error checking claim status", error);
      }
      // Keep button hidden on error
    }
  }

  /**
   * Sends a transaction to the game contract to claim winnings.
   */
  async claimWinningsFunc() {
    // --- FIX: Add explicit check for onchainGameId ---
    if (!this.currentOnchainGameId) {
      this.logError("Cannot claim winnings: On-chain Game ID is not available.", null);
      return;
    }

    if (
      !this.gameContract ||
      !this.currentOnchainGameId ||
      this.currentGameState !== "Finished" ||
      !this.checkNetwork()
    ) {
      this.logError("Cannot claim winnings now.");
      return;
    }
    this.log(
      `Claiming winnings for onchain game ${this.currentOnchainGameId}...`,
    );
    this.ui.claimButton.disabled = true;
    this.ui.claimButton.textContent = "Claiming...";

    try {
      const tx = await this.gameContract.claimWinnings(
        this.currentOnchainGameId,
      );
      this.log(`Claim winnings transaction sent: ${tx.hash}`);
      await tx.wait(); // Wait for confirmation
      this.log("Winnings claimed successfully!");
      alert("Winnings claimed! You can now join a new game.");
      this.ui.claimButton.style.display = "none"; // Hide button after successful claim
      // After a successful claim, refresh the daily record display
      await this.fetchDailyRecord();

      // After a successful claim, reset the game state so the player can join a new game.
      this.resetGameControls();
      this.updateUIButtons();
    } catch (error) {
      this.logError("Failed to claim winnings", error);
      // Ensure ethers is available globally before formatting for the button text
      if (
        typeof window.ethers !== "undefined" && // Ensure ethers is loaded
        this.backendConfig && // Check if backendConfig exists
        this.backendConfig.stakeAmount // Then access stakeAmount
      ) {
        this.ui.claimButton.textContent = `Claim ${window.ethers.formatEther(this.backendConfig.stakeAmount)} ETH`; // Reset text on error
      } else {
        this.ui.claimButton.textContent = "Claim Winnings"; // Generic text
      }
      // Keep button disabled after error for safety, user might need to refresh/recheck
      // this.ui.claimButton.disabled = false; // Avoid re-enabling automatically
    }
  }

  /**
   * Resets game-specific UI elements and state variables.
   */
  resetGameControls() {
    this.currentGameId = null;
    this.currentOnchainGameId = null;
    this.currentGameState = null;
    this.hasDeposited = false;
    this.ui.gameIdSpan.textContent = "N/A";
    this.ui.depositButton.style.display = "none";
    this.ui.reactButton.disabled = true;
    this.ui.reactButton.style.display = "none"; // Hide react button too
    this.ui.reactButton.textContent = "CLICK!";
    this.ui.refundButton.style.display = "none";
    this.ui.claimButton.style.display = "none";
    this.updateGameStateUI("Waiting to join...", 0, [], [], "N/A"); // Reset visual state
    if (this.ws) {
      this.log("Closing WebSocket connection due to game reset.");
      this.ws.close();
      this.ws = null;
    }
    // Stop and clear the waiting room timer
    if (this.waitingRoomTimerInterval) {
      clearInterval(this.waitingRoomTimerInterval);
      this.waitingRoomTimerInterval = null;
    }
    // Stop and clear the deposit timer
    if (this.depositTimerInterval) {
      clearInterval(this.depositTimerInterval);
      this.depositTimerInterval = null;
    }
    // Stop and clear the click timer
    if (this.clickTimerInterval) {
      clearInterval(this.clickTimerInterval);
      this.clickTimerInterval = null;
    }
    this.ui.depositTimerContainer.style.display = "none";
    this.ui.waitingRoomTimerContainer.style.display = "none";

    // Ensure music is stopped
    if (this.ui.gameMusic && !this.ui.gameMusic.paused) {
      this.ui.gameMusic.pause();
      this.ui.gameMusic.currentTime = 0;
    }
    this.log("Game controls reset.");
  }

  /**
   * Checks if the player has a previously cancelled game they can get a refund from.
   * If so, it sets the UI to a state where the player can only request a refund.
   */
  async checkForRefundableGame() {
    if (!this.playerAddress) return;

    this.log("Checking for any previous games requiring action...");
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/v1/player/${this.playerAddress}/refundable-game`,
      );

      if (response.status === 404) {
        this.log("No previous games require action. Ready to join.");
        // No refundable game found, so we don't need to do anything here.
        // The regular UI button update will handle enabling the join button.
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! Status: ${response.status}`,
        );
      }

      const data = await response.json();
      const refundableGameState = data.gameState;

      if (this.gameContract && refundableGameState.onchainGameID) {
        this.log(`Found refundable game ${refundableGameState.onchainGameID}. Verifying your deposit and refund status...`);

        // --- FIX: Add explicit check for onchainGameId before contract calls ---
        if (!refundableGameState.onchainGameID) {
            this.logError("Refundable game data is missing the on-chain ID. Cannot proceed.", null);
            return;
        }

        const [hasDepositedOnChain, hasClaimedRefund] = await Promise.all([
          this.gameContract.getPlayerDepositStatus(
            refundableGameState.onchainGameID,
            this.playerAddress,
          ),
          this.gameContract.refundClaimed(
            // This is the new check
            refundableGameState.onchainGameID,
            this.playerAddress,
          ),
        ]);

        this.hasDeposited = hasDepositedOnChain;

        if (this.hasDeposited && !hasClaimedRefund) {
          this.log(
            `Deposit confirmed for game ${refundableGameState.onchainGameID}. You can claim a refund.`,
          );
          alert(
            `A previous game you were in was cancelled. Please use the "Request Refund" button to get your deposit back before joining a new game.`,
          );
          await this.handleGameUpdate(refundableGameState);
        } else if (this.hasDeposited && hasClaimedRefund) {
          this.log(`Found a cancelled game, but you have already claimed your refund. No action needed.`);
        } else {
          // The backend found a cancelled game the user was part of, but they hadn't deposited.
          this.log(`Found a cancelled game, but you had not deposited. No action needed.`);
        }
      } else {
        // Fallback or if contract is not ready, just log it. The button won't appear.
        this.logError("Could not verify deposit status for refundable game.");
      }

    } catch (error) {
      if (!this.handleEthersNetworkError(error, "Error checking for refundable game")) {
        this.logError("Error checking for refundable game", error);
      }
    }
  }

  /**
   * Checks if the player has a previously finished game where they can claim winnings.
   * If so, it sets the UI to a state where the player can only claim.
   */
  async checkForClaimableGame() {
    if (!this.playerAddress) return;

    this.log("Checking for any claimable winnings...");
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/v1/player/${this.playerAddress}/claimable-game`,
      );

      if (response.status === 404) {
        this.log("No pending winnings to claim.");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! Status: ${response.status}`,
        );
      }

      const data = await response.json(); // { gameState: { ... } }
      const gameState = data.gameState;

      // --- NEW, SAFER LOGIC ---
      // Instead of calling the full handleGameUpdate, which has side effects like
      // refreshing the leaderboard, we will manually set the necessary state
      // to allow the user to claim their prize.

      this.log(`Found a previous game (ID: ${gameState.onchainGameID}) where you won!`);
      alert(`You have unclaimed winnings from a previous game (ID: ${gameState.backendPendingID.substring(0, 8)}...)! Please use the "Claim" button to get your prize.`);

      // 1. Set the core game state variables
      this.currentGameState = "Finished";
      this.currentGameId = gameState.backendPendingID;
      this.currentOnchainGameId = gameState.onchainGameID;

      // 2. Update the UI to reflect this specific state
      this.updateGameStateUI(
        "Finished",
        gameState.depositedCount || 0,
        gameState.players || [],
        gameState.winners || [],
        gameState.loser || "N/A"
      );

      // 3. Explicitly check and show the claim button without other side effects
      if (this.gameContract && this.playerAddress) {
        const alreadyClaimed = await this.gameContract.winningsClaimed(this.currentOnchainGameId, this.playerAddress);
        if (!alreadyClaimed) {
            const winningsAmount = await this.gameContract.winningsPerWinner(this.currentOnchainGameId);
            const formattedAmount = window.ethers.formatEther(winningsAmount);
            this.ui.claimButton.style.display = "inline-block";
            this.ui.claimButton.disabled = false;
            this.ui.claimButton.textContent = `Claim ${formattedAmount} ETH`;
        }
      }

      // 4. Disable the "Join Game" button to force the user to claim first.
      this.ui.joinButton.disabled = true;
    } catch (error) {
      // NEW: Check for network errors specifically
      if (
        !this.handleEthersNetworkError(error, "Error checking for claimable game")
      ) {
        this.logError("Error checking for claimable game", error);
      }
    }
  }

  /**
   * Updates the enabled/disabled state and visibility of primary action buttons
   * based on the overall application state (wallet connected, network, game state).
   */
  updateUIButtons() {
    const isWalletConnected = this.playerAddress && this.signer;
    const isNetworkCorrect = this.checkNetwork(); // This also logs errors/success
    const canInteract = isWalletConnected && isNetworkCorrect; // Keep this check

    if (this.ui.referralsLink) {
      this.ui.referralsLink.style.display = canInteract ? "inline-block" : "none";
    }
    // Join button: Enabled if wallet connected and network is correct, AND no game is active
    this.ui.joinButton.disabled = !(
      canInteract &&
      !this.currentGameId &&
      !this.currentOnchainGameId
    ); // Can join if no pending or onchain game

    // Refund button: Visible if connected, correct network, and game is 'Cancelled' or 'Failed'.
    // We are now relying on the contract to revert if the user didn't actually deposit.
    const showRefund = canInteract &&
      (this.currentGameState === "Cancelled" ||
        this.currentGameState === "Failed");
    this.ui.refundButton.style.display = showRefund ? "inline-block" : "none";
    this.ui.refundButton.disabled = !showRefund;

    // Deposit button is handled by updateDepositButtonVisibility() and handleGameUpdate()
    // React button is handled by handleStartClicking() and handleGameUpdate()
    // Claim button is handled by checkClaimStatus() and handleGameUpdate()
  }

  /**
   * Starts or stops the waiting room countdown timer based on game state.
   * @param {string} state - The current game state.
   * @param {number} createdAtUnix - The unix timestamp when the pending game was created.
   * @param {number} timeoutSeconds - The timeout duration for the pending game.
   */
  startWaitingRoomTimer(state, createdAtUnix, timeoutSeconds) {
    // Clear any existing timer first
    if (this.waitingRoomTimerInterval) {
      clearInterval(this.waitingRoomTimerInterval);
      this.waitingRoomTimerInterval = null;
    }

    // Only show the timer if we are in the waiting room and have the necessary data
    if (state !== "WaitingForPlayers" || !createdAtUnix || !timeoutSeconds) {
      this.ui.waitingRoomTimerContainer.style.display = "none";
      return;
    }

    const endTime = (createdAtUnix + timeoutSeconds) * 1000; // End time in milliseconds

    this.waitingRoomTimerInterval = setInterval(() => {
      const now = new Date().getTime();
      const remainingTime = endTime - now;

      if (remainingTime <= 0) {
        clearInterval(this.waitingRoomTimerInterval);
        this.waitingRoomTimerInterval = null;
        this.ui.waitingRoomTimerContainer.style.display = "none";
        this.log("Waiting room timer expired.");
        // The backend will handle the timeout and send a cancellation message.
        return;
      }

      const minutes = Math.floor(
        (remainingTime % (1000 * 60 * 60)) / (1000 * 60),
      );
      const seconds = Math.floor((remainingTime % (1000 * 60)) / 1000);

      // Format as MM:SS
      this.ui.waitingRoomTimer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

      this.ui.waitingRoomTimerContainer.style.display = "block";
    }, 1000);
  }
  /**
   * Starts or stops the deposit countdown timer based on game state.
   * @param {string} state - The current game state.
   * @param {number} createdAtUnix - The unix timestamp when the on-chain game was created.
   * @param {number} timeoutSeconds - The timeout duration for deposits.
   */
  startDepositTimer(state, createdAtUnix, timeoutSeconds) {
    // Clear any existing timer first
    if (this.depositTimerInterval) {
      clearInterval(this.depositTimerInterval);
      this.depositTimerInterval = null;
    }

    // Only show the timer if we are waiting for deposits and have the necessary data
    if (state !== "WaitingForDeposits" || !createdAtUnix || !timeoutSeconds) {
      this.ui.depositTimerContainer.style.display = "none";
      return;
    }

    const endTime = (createdAtUnix + timeoutSeconds) * 1000; // End time in milliseconds

    this.depositTimerInterval = setInterval(() => {
      const now = new Date().getTime();
      const remainingTime = endTime - now;

      if (remainingTime <= 0) {
        clearInterval(this.depositTimerInterval);
        this.depositTimerInterval = null;
        this.ui.depositTimerContainer.style.display = "none";
        // --- NEW: Immediately hide the deposit button when the timer expires ---
        this.ui.depositButton.style.display = "none";
        this.log("Deposit timer expired.");
        // The backend will handle the timeout and send a cancellation/start message.
        return;
      }

      const minutes = Math.floor(
        (remainingTime % (1000 * 60 * 60)) / (1000 * 60),
      );
      const seconds = Math.floor((remainingTime % (1000 * 60)) / 1000);

      // Format as MM:SS
      this.ui.depositTimer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      this.ui.depositTimerContainer.style.display = "block";
    }, 1000);
  }

  /**
   * Starts or stops the click countdown timer based on game state.
   * @param {string} state - The current game state.
   * @param {number} clickWindowOpenUnix - The unix timestamp when the click window opened.
   * @param {number} clickTimeoutSeconds - The timeout duration for clicks.
   */
  startClickTimer(state, clickWindowOpenUnix, clickTimeoutSeconds) {
    // Clear any existing timer first
    if (this.clickTimerInterval) {
      clearInterval(this.clickTimerInterval);
      this.clickTimerInterval = null;
    }

    // Only show the timer if we are awaiting clicks and have the necessary data
    if (
      state !== "AwaitingClicks" ||
      !clickWindowOpenUnix ||
      !clickTimeoutSeconds
    ) {
      this.ui.clickTimerContainer.style.display = "none";
      return;
    }

    const endTime = (clickWindowOpenUnix + clickTimeoutSeconds) * 1000; // End time in milliseconds

    this.clickTimerInterval = setInterval(() => {
      const now = new Date().getTime();
      const remainingTime = endTime - now;

      if (remainingTime <= 0) {
        clearInterval(this.clickTimerInterval);
        this.clickTimerInterval = null;
        this.ui.reactButton.disabled = true; // Disable the button
        this.ui.reactButton.textContent = "Time is up!";
        this.ui.clickTimerContainer.style.display = "none";
        return;
      }

      const seconds = (remainingTime / 1000).toFixed(2);

      this.ui.clickTimer.textContent = `${seconds}s`;
      this.ui.clickTimerContainer.style.display = "block";
    }, 50); // Update more frequently for a smoother countdown
  }
  // Example of a simple utility function (can be kept or moved to a utils file)
  // export function add(a, b) { // Moved from app.js
  //     return a + b;
  // }

  /**
   * Dynamically creates a link to toggle between the production and staging sites
   * based on the current hostname.
   */
  populateSiteToggleLink() {
    if (!this.ui.mainTitle) return;

    const currentHost = this._getHostname(); // Use helper for testability
    let headerText = "Musical Chairs";
    let linkText = "";
    let linkUrl = "";

    if (currentHost.includes("test.muschairs.com")) {
      headerText = "Test Musical Chairs";
      linkText = "Return to Main Site";
      linkUrl = "https://muschairs.com";
    } else if (currentHost.includes("muschairs.com")) {
      // headerText is already correct
      linkText = "Go to Test Site";
      linkUrl = "https://test.muschairs.com";
    }

    if (linkText && linkUrl) {
      this.ui.mainTitle.innerHTML = `${headerText} <a href="${linkUrl}">${linkText}</a>`;
    } else {
      this.ui.mainTitle.textContent = headerText; // Fallback if logic fails
    }
  }

  /**
   * Fetches the number of currently active users from the backend.
   * The backend queries the Umami API.
   */
  async fetchActiveUsers() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/stats/active-users`);
      if (!response.ok) {
        // Don't show an error for this non-critical feature, just reset the display.
        this.ui.activeUsersText.textContent = "-- users online now";
        return;
      }
      const data = await response.json();
      if (typeof data.active_users === "number") {
        let count = data.active_users;
        // The user is on the site, so there's at least one active user.
        // Umami might have a slight delay in reporting, so we ensure it's at least 1.
        if (count === 0) {
          count = 1;
        }
        const userText = count === 1 ? "user" : "users";
        this.ui.activeUsersText.textContent = `${count} ${userText} online now`;
      }
    } catch (error) {
      // Also fail silently on network errors.
      this.ui.activeUsersText.textContent = "-- users online now";
      console.error("Could not fetch active users:", error); // Log for debugging.
    }
  }

  /**
   * Starts a polling mechanism to periodically update the active user count.
   */
  startActiveUsersPolling() {
    this.fetchActiveUsers(); // Fetch immediately on start.
    // Then fetch every 30 seconds.
    setInterval(() => this.fetchActiveUsers(), 30000);
  }

  /**
   * Fetches the number of unique visitors in the last 24 hours.
   */
  async fetchVisitors24h() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/stats/visitors-24h`);
      if (!response.ok) {
        this.ui.visitors24hText.textContent = "-- visitors in last 24h";
        return;
      }
      const data = await response.json();
      if (typeof data.visitors_24h === "number") {
        const visitorText = data.visitors_24h === 1 ? "visitor" : "visitors";
        this.ui.visitors24hText.textContent = `${data.visitors_24h} ${visitorText} in last 24h`;
      }
    } catch (error) {
      this.ui.visitors24hText.textContent = "-- visitors in last 24h";
      console.error("Could not fetch 24h visitors:", error);
    }
  }

  _showSelectionState() {
    this.ui.desktopOptions.style.display = "block";
    this.ui.mobileOptions.style.display = "none";
    this.ui.connectionStatusState.classList.add("hidden");
    this.ui.failureState.classList.add("hidden");
  }


  _showConnectingState(walletName, logoPath) {
    this.ui.desktopOptions.style.display = "none";
    this.ui.mobileOptions.style.display = "none";
    this.ui.failureState.classList.add("hidden");
    this.ui.connectionStatusState.classList.remove("hidden");
    this.ui.statusTitle.textContent = `Connecting to ${walletName}...`;
    this.ui.statusMessage.textContent = "Please confirm the connection in your wallet extension.";
    this.ui.statusLogoContainer.innerHTML = logoPath 
      ? `<img src="${logoPath}" alt="${walletName} Logo" class="wallet-icon-large">` 
      : `<svg class="loading-spinner" viewBox="0 0 50 50"><circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle></svg>`;
  }

  _showFailureState(walletName, logoPath, downloadUrl) {
    this.ui.desktopOptions.style.display = "none";
    this.ui.mobileOptions.style.display = "none";
    this.ui.connectionStatusState.classList.add("hidden");
    this.ui.failureState.classList.remove("hidden");
    document.getElementById("failure-wallet-name").textContent = walletName;
    this.ui.downloadLink.href = downloadUrl;
    this.ui.failureLogoContainer.innerHTML = logoPath 
      ? `<img src="${logoPath}" alt="${walletName} Logo" class="wallet-icon-large">` 
      : '';
  }
}
