import { ethers } from "ethers";

// Initialize ethers globally if needed by shared logic
window.ethers = ethers;

document.addEventListener('DOMContentLoaded', () => {
    console.log("Leaderboard page loaded.");
    
    // --- UTC Clock Logic ---
    const utcTimeElement = document.getElementById("utc-time");
    const utcDateElement = document.getElementById("utc-date");

    if (utcTimeElement && utcDateElement) {
      const updateUTCTime = () => {
        const now = new Date();
        // Format date as YYYY-MM-DD
        utcDateElement.textContent = now.toLocaleDateString('en-CA', { timeZone: 'UTC' });
        // Format time as HH:MM:SS UTC
        utcTimeElement.textContent = now.toLocaleTimeString('en-GB', {
          timeZone: 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }) + ' UTC';
      };
      setInterval(updateUTCTime, 1000);
      updateUTCTime(); // Initial call
    }

    // --- Fetch All Leaderboards ---
    fetchLeaderboard('daily', 'daily-leaderboard-body');
    fetchLeaderboard('weekly', 'weekly-leaderboard-body');
    fetchLeaderboard('monthly', 'monthly-leaderboard-body');
    
    // --- Fetch Streak Leaderboard ---
    fetchStreakLeaderboard();

    // --- Fetch Daily Record ---
    fetchDailyRecord();
});

async function fetchLeaderboard(period, elementId) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4">Loading leaderboard...</td></tr>';

    try {
        const response = await fetch(`/api/v1/leaderboard/${period}`);
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const data = await response.json();

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4">No leaderboard data available for this period.</td></tr>`;
            return;
        }

        tbody.innerHTML = ''; // Clear loading message
        data.forEach(entry => {
            const row = tbody.insertRow();
            const netWinningsEth = window.ethers.formatEther(entry.net_winnings);
            const address = window.ethers.getAddress(entry.player_address);
            const shortAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;

            row.innerHTML = `
                <td>${entry.rank}</td>
                <td title="${address}"><span class="addr-full">${address}</span><span class="addr-short">${shortAddress}</span></td>
                <td>${parseFloat(netWinningsEth).toFixed(5)}</td>
                <td>${entry.games_played}</td>
            `;
        });

    } catch (error) {
        console.error(`Failed to fetch ${period} leaderboard:`, error);
        tbody.innerHTML = `<tr><td colspan="4" class="error-state">Error loading leaderboard.</td></tr>`;
    }
}

async function fetchDailyRecord() {
    const amountSpan = document.getElementById('record-amount');
    const holderSpan = document.getElementById('record-holder');

    if (!amountSpan || !holderSpan) return;

    try {
        const response = await fetch('/api/v1/record/daily-winnings');
        if (!response.ok) {
            if (response.status === 404) {
                amountSpan.textContent = "No record yet";
                holderSpan.textContent = "N/A";
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const record = await response.json();
        const winningsInEth = window.ethers.formatEther(record.totalWinnings);

        amountSpan.textContent = `${parseFloat(winningsInEth).toFixed(4)} ETH`;
        const address = window.ethers.getAddress(record.playerAddress);
        const shortAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        holderSpan.innerHTML = `<span class="addr-full">${address}</span><span class="addr-short">${shortAddress}</span>`;
    } catch (error) {
        console.error("Failed to fetch daily record:", error);
        amountSpan.textContent = "Error";
        holderSpan.textContent = "Error";
    }
}

async function fetchStreakLeaderboard() {
    const tbody = document.getElementById('streaks-leaderboard-body');
    if (!tbody) return;

    try {
        // Assuming the backend exposes this endpoint. 
        // You will need to wire up the handler in your Go backend to call store.GetTopStreaks
        const response = await fetch('/api/v1/leaderboard/streaks');
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const data = await response.json();

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4">No active streaks found.</td></tr>`;
            return;
        }

        tbody.innerHTML = ''; // Clear loading message
        data.forEach((player, index) => {
            const row = tbody.insertRow();
            const address = window.ethers.getAddress(player.address);
            const shortAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;

            row.innerHTML = `
                <td>${index + 1}</td>
                <td title="${address}"><span class="addr-full">${address}</span><span class="addr-short">${shortAddress}</span></td>
                <td>${player.current_streak} 🔥</td>
                <td>${player.max_streak}</td>
            `;
        });
    } catch (error) {
        console.error("Failed to fetch streak leaderboard:", error);
        tbody.innerHTML = `<tr><td colspan="4" class="error-state">Error loading streaks.</td></tr>`;
    }
}