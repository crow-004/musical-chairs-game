// This file now serves as the entry point to initialize the AppController

import * as Sentry from "@sentry/browser";
import { ethers } from "ethers";

// Expose to window for compatibility with existing code expecting globals
window.Sentry = Sentry;
window.ethers = ethers;

Sentry.init({
  dsn: "__SENTRY_DSN_FRONTEND__", // This will be replaced by Nginx
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event, hint) {
    if (event.extra) {
      delete event.extra.playerAddress;
    }
    return event;
  },
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("UNHANDLED PROMISE REJECTION:", event.reason);
  Sentry.captureException(event.reason, {
    extra: { "unhandled_rejection": true },
  });
});


import { AppController } from "./js/appController.js"; // Import the controller class

// --- UI Elements ---
const connectButton = document.getElementById("connect-button");
const walletStatus = document.getElementById("wallet-status");
const networkStatus = document.getElementById("network-status");
const requiredNetwork = document.getElementById("required-network");
const playerAddrSpan = document.getElementById("player-address");
const contractAddrSpan = document.getElementById("contract-address");
const stakeAmountSpan = document.getElementById("stake-amount");
const commissionAmountSpan = document.getElementById("commission-amount"); // Keep this reference
const joinButton = document.getElementById("join-button");
const depositButton = document.getElementById("deposit-button");
const reactButton = document.getElementById("react-button");
const refundButton = document.getElementById("refund-button");
const claimButton = document.getElementById("claim-button");
const gameIdSpan = document.getElementById("game-id"); // Keep this reference
const gameStatusText = document.getElementById("game-status-text"); // Keep this reference
const depositedCountSpan = document.getElementById("deposited-count"); // Keep this reference
const playerListUl = document.getElementById("player-list"); // Keep this reference
const winnersListSpan = document.getElementById("winners-list"); // Keep this reference
const loserAddrSpan = document.getElementById("loser-address"); // Keep this reference
const logOutput = document.getElementById("log-output"); // Keep this reference
const winSound = document.getElementById("winSound"); // Audio element for winning
const gameMusic = document.getElementById("gameMusic"); // Audio element - Keep this reference
const referralsLink = document.getElementById("referrals-link"); // NEW: Link to dashboard
// ADDED: Elements for the record display
const recordAmountSpan = document.getElementById("record-amount");
const recordHolderSpan = document.getElementById("record-holder");
const playerBalanceSpan = document.getElementById("player-balance");
const unlockSound = document.getElementById("unlockSound");
const activeUsersText = document.getElementById("active-users-text"); // NEW
const visitors24hText = document.getElementById("visitors-24h-text"); // NEW
// NEW: Background music elements
const backgroundMusic = document.getElementById("backgroundMusic");
const muteToggleButton = document.getElementById("mute-toggle-button");


// --- Initialization on page load ---
window.addEventListener("load", async () => {
  /**
   * NEW: Main application initialization logic.
   * This is wrapped in a function to be called only after age verification.
   */
  async function initializeApp() {
    // --- NEW: Theme Switcher Logic ---
    const themeToggle = document.getElementById("theme-toggle");
    const body = document.body;

    // Function to apply the theme
    const applyTheme = (theme) => {
      if (theme === "light") {
        body.classList.add("light-theme");
        themeToggle.checked = true;
      } else {
        body.classList.remove("light-theme");
        themeToggle.checked = false;
      }
    };

    // Check for saved theme in localStorage
    const savedTheme = localStorage.getItem("theme") || "dark"; // Default to dark
    applyTheme(savedTheme);

    // Add event listener for the toggle
    themeToggle.addEventListener("change", () => {
      const newTheme = themeToggle.checked ? "light" : "dark";
      localStorage.setItem("theme", newTheme);
      applyTheme(newTheme);
    });

    // --- Tournament Countdown Logic ---
    const countdownElement = document.getElementById("tournament-countdown");
    if (countdownElement) {
      // Set the date for the tournament start (YYYY-MM-DDTHH:mm:ssZ)
      const tournamentStartDate = new Date("2025-10-25T00:00:00Z"); // Set to next Saturday

      const updateCountdown = () => {
        const now = new Date();
        const distance = tournamentStartDate - now;

        if (distance < 0) {
          // If the tournament has started or is over, hide the countdown
          countdownElement.style.display = "none";
          clearInterval(countdownInterval);
          return;
        }

        // Time calculations for days, hours, minutes and seconds
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        );
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        countdownElement.innerHTML = `Tournament starts in: <strong>${days}d ${hours}h ${minutes}m ${seconds}s</strong>`;
      };

      const countdownInterval = setInterval(updateCountdown, 1000);
      updateCountdown(); // Initial call
    }

    // --- Main App Initialization ---
    // Collect all UI element references into a single object
    const uiElements = {
      connectButton,
      backToHomeButton: document.getElementById("back-to-home-button"), // New back button
      toggleStoryButton: document.getElementById("toggle-story-button"), // New story button
      toggleRulesButton: document.getElementById("toggle-rules-button"), // New button for rules
      enterAppButton: document.getElementById("enter-app-button"), // New button
      walletStatus,
      networkStatus,
      requiredNetwork,
      playerAddrSpan,
      contractAddrSpan,
      stakeAmountSpan,
      commissionAmountSpan,
      joinButton,
      depositButton,
      reactButton,
      refundButton,
      claimButton,
      gameIdSpan,
      gameStatusText,
      depositedCountSpan,
      playerListUl,
      winnersListSpan,
      loserAddrSpan,
      logOutput,
      gameMusic,
      // Add new elements for the waiting room timer and dynamic label
      waitingRoomTimerContainer: document.getElementById(
        "waiting-room-timer-container",
      ),
      waitingRoomTimer: document.getElementById("waiting-room-timer"),
      // Add new elements for the deposit timer
      depositTimerContainer: document.getElementById("deposit-timer-container"),
      depositTimer: document.getElementById("deposit-timer"),
      playerCountLabel: document.getElementById("player-count-label"),
      ruleGameStart: document.getElementById("rule-game-start"),
      ruleMusicStart: document.getElementById("rule-music-start"),
      ruleNetworkName: document.getElementById("rule-network-name"),
      ruleStakeAmount: document.getElementById("rule-stake-amount"),
      ruleCommissionPercent: document.getElementById("rule-commission-percent"),
      clickTimerContainer: document.getElementById("click-timer-container"),
      clickTimer: document.getElementById("click-timer"),
      referralsLink, // NEW
      recordAmountSpan, // ADDED
      recordHolderSpan, // ADDED
      mainTitle: document.getElementById("main-title"), // NEW: Reference to the main h1 title
      playerBalanceSpan,
      winSound,
      unlockSound,
      activeUsersText, // NEW
      visitors24hText, // NEW
      // NEW: Background music elements
      backgroundMusic,
      muteToggleButton,
      volumeOnIcon: document.getElementById("volume-on-icon"),
      volumeOffIcon: document.getElementById("volume-off-icon"),
      // --- NEW: Modal Window UI Elements (from Zyrik's version) ---
      modalOverlay: document.getElementById("custom-wallet-modal"),
      modalCloseButton: document.getElementById("custom-wallet-modal") ? document.getElementById("custom-wallet-modal").querySelector(".close-button") : null,
      desktopOptions: document.getElementById("desktop-connect-options"),
      mobileOptions: document.getElementById("mobile-deep-link-options"), // This ID might not exist in the final HTML, but it's good to have the reference.
      connectionStatusState: document.getElementById("connection-status-state"),
      failureState: document.getElementById("failure-state"),
      statusLogoContainer: document.getElementById("status-logo-container"),
      failureLogoContainer: document.getElementById("failure-logo-container"),
      statusTitle: document.getElementById("status-title"),
      statusMessage: document.getElementById("status-message"),
      downloadLink: document.getElementById("download-link"),
      tryAgainButton: document.getElementById("try-again-button"),
      backToSelectionButton: document.getElementById("back-to-selection-button"),
    };

    // Create an instance of the AppController and initialize it
    const appController = new AppController(uiElements);
    await appController.initLanding(); // Use the new lightweight init for the landing page

    // --- NEW: Static Rules Update based on Domain ---
    // This ensures rules are correct on the landing page immediately, without a backend call.
    const updateRulesFromDomain = () => {
      const hostname = window.location.hostname;
      let net = "(Arbitrum One)";
      let stake = "(0.0007 ETH)";
      
      if (hostname.includes("eth.muschairs.com")) {
        net = "(Ethereum Mainnet)";
        stake = "(0.02 ETH)";
      } else if (hostname.includes("base.muschairs.com")) {
        net = "(Base)";
        stake = "(0.007 ETH)";
      } else if (hostname.includes("test.muschairs.com")) {
        net = "(Arbitrum Sepolia Testnet)";
        stake = "(0.0007 Test-ETH)";
      }

      if (uiElements.ruleNetworkName) uiElements.ruleNetworkName.textContent = net;
      if (uiElements.ruleStakeAmount) uiElements.ruleStakeAmount.textContent = stake;
      if (uiElements.ruleCommissionPercent) uiElements.ruleCommissionPercent.textContent = "3%";
    };
    updateRulesFromDomain();

    // --- SPA & UI Logic ---
    // --- SPA & UI Navigation Logic ---
    const landingSection = document.getElementById("landing-section");
    const appSection = document.getElementById("app-section");
    const storySection = document.getElementById("story-section");
    const detailedRulesSection = document.getElementById("detailed-rules-section");
    let isAppEntered = false; // Flag to ensure enterApp is only called once

    // Logic for the "Play Now" button
    if (uiElements.enterAppButton && landingSection && appSection && detailedRulesSection) {
      uiElements.enterAppButton.addEventListener("click", async () => {
        console.log("Enter App button clicked");
        landingSection.classList.add("hidden");
        storySection.classList.add("hidden"); // Also hide story
        detailedRulesSection.classList.add("hidden"); // Also hide rules
        appSection.classList.remove("hidden");
        
        // Only run the full app initialization once
        if (!isAppEntered) {
          isAppEntered = true;
          // NEW: Also start the background music if consent was not given via modal
          // This handles the case where user ignores modal and clicks "Play Now"
          appController.playBackgroundMusic();
          // Initialize the main app components
          await appController.initApp();
        }
      });
    }

    // NEW: Logic for the "Back to Home" button
    if (uiElements.backToHomeButton && landingSection && appSection) {
      uiElements.backToHomeButton.addEventListener("click", () => {
        appSection.classList.add("hidden");
        landingSection.classList.remove("hidden");

        // NEW: Reset the rules section to its default hidden state
        if (storySection && uiElements.toggleStoryButton) {
          storySection.classList.add("hidden");
          uiElements.toggleStoryButton.textContent = "Read Our Story";
        }
        if (detailedRulesSection && uiElements.toggleRulesButton) { // This block seems to have issues, let's re-check
          detailedRulesSection.classList.add("hidden");
          uiElements.toggleRulesButton.textContent = "Show Detailed Rules & Info";
        }
      });
    }

    // Logic for the "Show/Hide Story" button
    if (uiElements.toggleStoryButton && storySection) {
      uiElements.toggleStoryButton.addEventListener("click", () => {
        storySection.classList.toggle("hidden");
        uiElements.toggleStoryButton.textContent = storySection.classList.contains("hidden") ? "Read Our Story" : "Hide Story";
      });
    }

    // Logic for the "Show/Hide Rules" button
    if (uiElements.toggleRulesButton && detailedRulesSection) {
      uiElements.toggleRulesButton.addEventListener("click", () => {
          detailedRulesSection.classList.toggle("hidden");
          uiElements.toggleRulesButton.textContent = detailedRulesSection.classList.contains("hidden")
              ? "Show Detailed Rules & Info"
              : "Hide Detailed Rules & Info";
      });
    }

    // NEW: Logic for individual collapsible rule sections with typewriter effect
    const collapsibleSections = document.querySelectorAll(".collapsible-section");
    collapsibleSections.forEach(section => {
      const header = section.querySelector(".collapsible-header");
      const content = section.querySelector(".collapsible-content");
      const icon = header.querySelector(".toggle-icon");

      // Store original HTML to re-use for typewriter
      if (content) {
        content.dataset.originalHtml = content.innerHTML;
      }

      header.addEventListener("click", () => {
        const isCollapsed = content.style.maxHeight === "0px" || !content.style.maxHeight;

        if (isCollapsed) {
          icon.textContent = "−";
          icon.style.transform = "rotate(180deg)";
          content.style.maxHeight = content.scrollHeight + "px";
          content.innerHTML = ''; // NEW: Clear content just before typing
          typewriterEffect(content);
        } else {
          icon.textContent = "+";
          icon.style.transform = "rotate(0deg)";
          content.style.maxHeight = "0px";
          // Optional: stop typing if user collapses it
          if (content.dataset.typingTimeout) {
            clearTimeout(parseInt(content.dataset.typingTimeout));
            content.innerHTML = content.dataset.originalHtml; // Show full text immediately
          }
        }
      });
    });

    // NEW: Advanced typewriter effect that preserves HTML structure
    function typewriterEffect(targetElement) {
      // If there's an ongoing animation, clear it and show the full content
      if (targetElement.dataset.typingTimeout) {
        clearTimeout(parseInt(targetElement.dataset.typingTimeout));
        targetElement.innerHTML = targetElement.dataset.originalHtml;
        targetElement.classList.remove('typing-cursor');
        delete targetElement.dataset.typingTimeout;
      }

      const originalHtml = targetElement.dataset.originalHtml;
      
      // Create a hidden template to read from
      const template = document.createElement('div');
      template.innerHTML = originalHtml;
      
      // Get all text nodes from the template
      const walker = document.createTreeWalker(template, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      let node;
      while((node = walker.nextNode())) {
        textNodes.push(node);
      }

      // Clear the target element and add the cursor
      targetElement.innerHTML = '';
      targetElement.appendChild(template.cloneNode(true)); // Add structure but empty
      const liveWalker = document.createTreeWalker(targetElement, NodeFilter.SHOW_TEXT, null, false);
      const liveTextNodes = [];
      while((node = liveWalker.nextNode())) {
        liveTextNodes.push(node);
        node.nodeValue = ''; // Clear text in the live element
      }
      
      targetElement.classList.add('typing-cursor');

      let nodeIndex = 0;
      let charIndex = 0;

      function type() {
        if (nodeIndex < textNodes.length) {
          const currentNode = textNodes[nodeIndex];
          const liveNode = liveTextNodes[nodeIndex];
          if (charIndex < currentNode.nodeValue.length) {
            liveNode.nodeValue += currentNode.nodeValue[charIndex];
            charIndex++;
            targetElement.dataset.typingTimeout = setTimeout(type, 5); // Adjust speed here
          } else {
            nodeIndex++;
            charIndex = 0;
            type(); // Move to the next node immediately
          }
        } else {
          targetElement.classList.remove('typing-cursor');
          delete targetElement.dataset.typingTimeout;
        }
      }
      type();
    }
  }

  // --- NEW: Age Verification Logic ---
  const ageModal = document.getElementById("age-verification-modal");
  const ageYesBtn = document.getElementById("age-yes-btn");
  const ageNoBtn = document.getElementById("age-no-btn");
  const ageRestrictionMessage = document.getElementById("age-restriction-message");
  const mainContent = document.querySelectorAll("body > *:not(#age-verification-modal):not(#age-restriction-message)");

  const isAgeVerified = sessionStorage.getItem("ageVerified") === "true";

  if (!isAgeVerified) {
    ageModal.style.display = "flex"; // Show the modal
  } else {
    initializeApp(); // If already verified, initialize the app immediately
  }

  ageYesBtn.addEventListener("click", () => {
    sessionStorage.setItem("ageVerified", "true");
    ageModal.style.display = "none";
    initializeApp(); // Initialize the app after user clicks "Yes"
  });

  ageNoBtn.addEventListener("click", () => {
    ageModal.style.display = "none";
    // Hide all main content
    mainContent.forEach(el => {
        if (el.id !== 'age-verification-modal' && el.id !== 'age-restriction-message' && !el.matches('script')) {
            el.style.display = 'none';
        }
    });
    ageRestrictionMessage.style.display = "block";
  });
});
