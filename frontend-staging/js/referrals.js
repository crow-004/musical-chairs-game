// js/referrals.js

class ReferralsController {
    // State
    ethersProvider = null;
    signer = null;
    playerAddress = null;
    chainId = null;
    backendConfig = null;
    gameContract = null;
    requiredChainId = null;
    minClaimAmount = 0n; // Use BigInt for wei values

    // UI Elements
    ui = {};

    constructor(uiElements) {
        this.ui = uiElements;
    }

    async init() {
        this.log('Referrals dashboard initializing...');
        this.ui.connectButton.addEventListener('click', this.connectWallet.bind(this));
        this.ui.claimReferralEarningsButton.addEventListener('click', this.claimReferralEarnings.bind(this));
        this.ui.copyReferralLinkButton.addEventListener('click', this.copyReferralLink.bind(this));
        this.ui.showReferralsButton.addEventListener('click', this.fetchAllReferrals.bind(this));

        await this.fetchGameConfig();

        if (window.ethereum && window.ethereum.selectedAddress) {
            this.log('MetaMask already connected, attempting to initialize...');
            await this.connectWallet();
        } else {
            this.log('Please connect your wallet to manage referrals.');
            this.updateConnectionStatusUI();
        }
    }

    log(message) {
        console.log(message);
        const time = new Date().toLocaleTimeString();
        this.ui.logOutput.textContent += `\n[${time}] ${message}`;
        this.ui.logOutput.scrollTop = this.ui.logOutput.scrollHeight;
    }

    logError(message, error) {
        console.error(message, error);
        let errorMessage = message;
        if (error && error.message) {
            errorMessage += `: ${error.message}`;
        }
        this.log(`ERROR: ${errorMessage}`);
    }

    async fetchGameConfig() {
        this.log('Fetching game configuration...');
        try {
            const response = await fetch('/api/v1/config');
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            this.backendConfig = await response.json();
            this.requiredChainId = this.backendConfig.chainId ? BigInt(this.backendConfig.chainId) : null;
            // NEW: Store and display the minimum claim amount
            if (this.backendConfig.minReferralClaimAmount) {
                this.minClaimAmount = BigInt(this.backendConfig.minReferralClaimAmount);
                this.ui.minClaimAmountSpan.textContent = window.ethers.formatEther(this.minClaimAmount);
            }

            this.ui.requiredNetwork.textContent = this.requiredChainId ? String(this.requiredChainId) : '?';
            if (this.chainId) this.checkNetwork();
            if (this.ethersProvider) this.initContracts();
        } catch (error) {
            this.logError('Failed to fetch game configuration', error);
        }
    }

    async connectWallet() {
        if (typeof window.ethereum === 'undefined') {
            this.logError('MetaMask is not installed!');
            alert('Please install MetaMask to use this feature.');
            return;
        }

        this.log('Connecting to wallet...');
        this.ui.connectButton.disabled = true;

        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.ethersProvider = new window.ethers.BrowserProvider(window.ethereum);
            this.signer = await this.ethersProvider.getSigner();
            this.playerAddress = await this.signer.getAddress();
            const network = await this.ethersProvider.getNetwork();
            this.chainId = network.chainId;

            this.log(`Wallet connected: ${this.playerAddress}`);
            this.log(`Network: ${network.name} (Chain ID: ${this.chainId})`);

            // FIX: Replace page reload with a more robust state handling
            window.ethereum.removeAllListeners("accountsChanged");
            window.ethereum.on("accountsChanged", this.handleAccountsChanged.bind(this));
            window.ethereum.removeAllListeners("chainChanged");
            window.ethereum.on("chainChanged", this.handleChainChanged.bind(this));

            if (!this.backendConfig) await this.fetchGameConfig();
            
            this.updateConnectionStatusUI();

            if (this.checkNetwork()) {
                this.initContracts();
                await this.updateReferralDashboard();
            }
        } catch (error) {
            this.logError('Failed to connect wallet', error);
        } finally {
            this.ui.connectButton.disabled = false;
        }
    }

    updateConnectionStatusUI() {
        if (this.playerAddress && this.chainId) {
            this.ui.walletStatus.textContent = 'Connected';
            this.ui.walletStatus.style.color = 'green';
            this.ui.playerAddrSpan.textContent = `${this.playerAddress.substring(0, 6)}...${this.playerAddress.substring(this.playerAddress.length - 4)}`;
            this.ui.networkStatus.textContent = `${this.chainId}`;
            this.ui.connectButton.style.display = 'none';
            this.ui.showReferralsButton.disabled = false; // Enable the button
        } else {
            this.ui.walletStatus.textContent = 'Not Connected';
            this.ui.walletStatus.style.color = 'red';
            this.ui.playerAddrSpan.textContent = 'N/A';
            this.ui.networkStatus.textContent = 'Unknown';
            this.ui.connectButton.style.display = 'inline-block';
            this.ui.showReferralsButton.disabled = true; // Ensure it's disabled when not connected
        }
    }

    checkNetwork() {
        if (!this.chainId || !this.requiredChainId) {
            this.ui.networkStatus.style.color = 'orange';
            return false;
        }
        if (BigInt(this.chainId) === BigInt(this.requiredChainId)) {
            this.ui.networkStatus.style.color = 'green';
            return true;
        } else {
            this.ui.networkStatus.style.color = 'red';
            this.logError(`Incorrect network! Please connect to Chain ID ${this.requiredChainId}.`);
            return false;
        }
    }

    initContracts() {
        if (!this.ethersProvider || !this.signer || !this.backendConfig || !this.backendConfig.contractAddress) {
            // This can happen on initial load before wallet is connected, so we don't log an error.
            return;
        }
        try {
            const gameAbi = [
                "function referralEarnings(address referrer) view returns (uint256)",
                "function claimReferralEarnings()"
            ];
            this.gameContract = new window.ethers.Contract(this.backendConfig.contractAddress, gameAbi, this.signer);
            this.log('Referral contract interface initialized.');
        } catch (error) {
            this.logError('Error initializing contracts:', error);
        }
    }

    /**
     * Resets the connection state when the wallet is disconnected or the account changes.
     */
    resetConnectionState() {
        this.ethersProvider = null;
        this.signer = null;
        this.playerAddress = null;
        this.chainId = null;
        this.gameContract = null;
        this.updateConnectionStatusUI(); // This will show "Not Connected" and disable buttons
        this.ui.referralManagementDiv.style.display = 'none'; // Hide the dashboard
        this.log('Connection state reset.');
    }

    /**
     * Handles account changes from MetaMask without a full page reload.
     */
    handleAccountsChanged(accounts) {
        this.log('Wallet account changed. Re-initializing...');
        this.resetConnectionState();
        this.connectWallet(); // Re-run the connection process
    }

    handleChainChanged(newChainId) {
        this.log(`Network changed to Chain ID: ${newChainId}. Re-initializing...`);
        this.connectWallet();
    }

    async updateReferralDashboard() {
        if (!this.playerAddress || !this.checkNetwork()) {
            this.ui.referralManagementDiv.style.display = 'none';
            return;
        }

        this.ui.referralManagementDiv.style.display = 'block';

        // Populate referral link
        try {
            const referralLink = `${window.location.origin}/?ref=${this.playerAddress}`;
            this.ui.referralLinkInput.value = referralLink;
            // NEW: Automatically generate QR code when the link is populated
            this.generateReferralQRCode();
        } catch (error) {
            this.logError('Could not generate referral link', error);
        }

        try {
            const earnings = await this.gameContract.referralEarnings(this.playerAddress);
            const formattedEarnings = window.ethers.formatEther(earnings); // e.g., "0.12345678"
            this.ui.referralEarningsAmountSpan.textContent = parseFloat(formattedEarnings).toFixed(5); // e.g., "0.12346"
            this.ui.claimReferralEarningsButton.disabled = earnings < this.minClaimAmount;
        } catch (error) {
            // NEW: More specific error handling
            if (error.code === 'CALL_EXCEPTION') {
                this.logError('Could not fetch referral earnings. This can happen if you have unconfirmed referrals.', null);
            } else {
                this.logError('Could not fetch referral earnings', error);
            }
            this.ui.referralEarningsAmountSpan.textContent = 'Error';
            this.ui.claimReferralEarningsButton.disabled = true;
        }

        try {
            const response = await fetch(`/api/v1/referrals/pending/${this.playerAddress}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch pending referrals: ${response.statusText}`);
            }
            const pendingReferrals = await response.json();
            this.renderPendingReferrals(pendingReferrals || []);
        } catch (error) {
            this.logError('Could not fetch pending referrals', error);
            this.ui.pendingReferralsListUl.innerHTML = '<li>Error loading pending referrals.</li>';
        }
    }

    renderPendingReferrals(referrals) {
        this.ui.pendingReferralsListUl.innerHTML = '';
        if (referrals.length === 0) {
            this.ui.pendingReferralsListUl.innerHTML = '<li>No pending confirmations.</li>';
            return;
        }

        referrals.forEach(referral => {
            const li = document.createElement('li');
            const shortAddr = `${referral.player_address.substring(0, 8)}...${referral.player_address.substring(referral.player_address.length - 6)}`;
            li.innerHTML = `
                <span>Player: ${shortAddr}</span>
                <button class="confirm-referral-btn" data-player-address="${referral.player_address}">Confirm</button>
            `;
            this.ui.pendingReferralsListUl.appendChild(li);
        });

        this.ui.pendingReferralsListUl.querySelectorAll('.confirm-referral-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const playerToConfirm = event.target.dataset.playerAddress;
                this.confirmReferral(playerToConfirm, event.target);
            });
        });
    }

    async confirmReferral(playerToConfirmAddress, buttonElement) {
        this.log(`Confirming referral for player ${playerToConfirmAddress}...`);
        buttonElement.disabled = true;
        buttonElement.textContent = 'Signing...';

        try {
            const messageHash = window.ethers.solidityPackedKeccak256(['address'], [playerToConfirmAddress]);
            const signature = await this.signer.signMessage(window.ethers.getBytes(messageHash));
            this.log('Signature created. Sending to backend...');

            const response = await fetch(`/api/v1/referrals/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerAddress: playerToConfirmAddress,
                    signature: signature,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Backend failed to confirm referral.');
            }

            this.log(`Referral for ${playerToConfirmAddress} confirmed successfully!`);
            buttonElement.textContent = 'Confirmed!';
            setTimeout(() => buttonElement.parentElement.remove(), 2000);

        } catch (error) {
            this.logError(`Failed to confirm referral for ${playerToConfirmAddress}`, error);
            buttonElement.textContent = 'Error!';
            setTimeout(() => {
                buttonElement.disabled = false;
                buttonElement.textContent = 'Confirm';
            }, 3000);
        }
    }

    async fetchAllReferrals() {
        this.log("Fetching your referrals list...");
        this.ui.showReferralsButton.disabled = true;
        this.ui.showReferralsButton.textContent = "Loading...";
        try {
            const response = await fetch(`/api/v1/referrals/list/${this.playerAddress}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch referrals list: ${response.statusText}`);
            }
            const referrals = await response.json();
            this.renderAllReferrals(referrals || []);
        } catch (error) {
            this.logError('Could not fetch your referrals list', error);
            this.ui.allReferralsListDiv.innerHTML = '<p>Error loading referrals list.</p>';
        } finally {
            this.ui.showReferralsButton.disabled = false;
            this.ui.showReferralsButton.textContent = "Show My Referrals";
        }
    }

    renderAllReferrals(referrals) {
        const listDiv = this.ui.allReferralsListDiv;
        listDiv.innerHTML = ''; // Clear previous content

        if (referrals.length === 0) {
            listDiv.innerHTML = '<p>You have not referred any players yet.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'referrals-table'; // Add a class for styling if needed
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Referred Player</th>
                    <th>Status</th>
                </tr>
            </thead>
        `;
        const tbody = document.createElement('tbody');
        referrals.forEach(ref => {
            const row = tbody.insertRow();
            row.innerHTML = `<td>${ref.player_address}</td><td style="color: ${ref.status === 'confirmed' ? 'green' : 'orange'}">${ref.status}</td>`;
        });
        table.appendChild(tbody);
        listDiv.appendChild(table);
    }

    async claimReferralEarnings() {
        this.log('Attempting to claim referral earnings...');
        this.ui.claimReferralEarningsButton.disabled = true;
        this.ui.claimReferralEarningsButton.textContent = 'Claiming...';

        try {
            const tx = await this.gameContract.claimReferralEarnings();
            this.log(`Claim transaction sent: ${tx.hash}`);
            await tx.wait();
            this.log('Referral earnings claimed successfully!');
            await this.updateReferralDashboard();
        } catch (error) {
            this.logError('Failed to claim referral earnings', error);
            this.ui.claimReferralEarningsButton.disabled = false;
        } finally {
            this.ui.claimReferralEarningsButton.textContent = 'Claim Earnings';
        }
    }

    /**
     * Copies the user's referral link to the clipboard.
     */
    async copyReferralLink() {
        if (!navigator.clipboard) {
            this.logError('Clipboard API not available.');
            alert('Could not copy link. Please copy it manually.');
            return;
        }
        try {
            await navigator.clipboard.writeText(this.ui.referralLinkInput.value);
            this.log('Referral link copied to clipboard!');
            this.ui.copyReferralLinkButton.textContent = 'Copied!';
            setTimeout(() => {
                this.ui.copyReferralLinkButton.textContent = 'Copy Link';
            }, 2000); // Reset button text after 2 seconds
        } catch (err) {
            this.logError('Failed to copy referral link', err);
            alert('Failed to copy link.');
        }
    }

    /**
     * Generates and displays a QR code for the user's referral link.
     */
    generateReferralQRCode() {
        const link = this.ui.referralLinkInput.value;
        const container = this.ui.qrCodeContainer;

        if (!link || typeof QRCode === 'undefined') {
            this.logError('Could not generate QR code. Library or link missing.');
            return;
        }

        // Clear previous QR code if any
        container.innerHTML = '';

        QRCode.toCanvas(link, { width: 100 }, (error, canvas) => {
            if (error) {
                this.logError('QR code generation failed', error);
                return;
            }
            container.appendChild(canvas);
            this.log('Referral QR code generated.');
        });
    }
}

window.addEventListener('load', async () => {
    const uiElements = {
        connectButton: document.getElementById('connect-button'),
        walletStatus: document.getElementById('wallet-status'),
        networkStatus: document.getElementById('network-status'),
        requiredNetwork: document.getElementById('required-network'),
        playerAddrSpan: document.getElementById('player-address'),
        logOutput: document.getElementById('log-output'),
        referralManagementDiv: document.getElementById('referral-management'),
        referralEarningsAmountSpan: document.getElementById('referral-earnings-amount'),
        claimReferralEarningsButton: document.getElementById('claim-referral-earnings-button'),
        pendingReferralsListUl: document.getElementById('pending-referrals-list'),
        referralLinkInput: document.getElementById('referral-link-input'),
        copyReferralLinkButton: document.getElementById('copy-referral-link-button'),
        qrCodeContainer: document.getElementById('qr-code-container'),
        minClaimAmountSpan: document.getElementById('min-claim-amount'),
        showReferralsButton: document.getElementById('show-referrals-button'),
        allReferralsListDiv: document.getElementById('all-referrals-list'),
    };

    const controller = new ReferralsController(uiElements);
    await controller.init();

    // --- Logic for the referral system information toggler ---
    const toggleInfoButton = document.getElementById('toggle-info-button');
    const infoContentWrapper = document.getElementById('info-content-wrapper');

    if (toggleInfoButton && infoContentWrapper) {
        // Function to update the button text based on state
        const updateButtonText = () => {
            if (infoContentWrapper.classList.contains('collapsed')) {
                toggleInfoButton.textContent = 'Show Referral System Info';
            } else {
                toggleInfoButton.textContent = 'Hide Referral System Info';
            }
        };

        // Set the initial button text
        updateButtonText();

        // Add the click event listener
        toggleInfoButton.addEventListener('click', () => {
            infoContentWrapper.classList.toggle('collapsed');
            updateButtonText();
        });
    }
});
