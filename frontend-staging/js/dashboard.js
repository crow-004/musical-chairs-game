document.addEventListener('DOMContentLoaded', () => {
    const funnelFilterBtn = document.getElementById("funnel-filter-btn");
    const funnelResetBtn = document.getElementById("funnel-reset-btn");
    const analyticsModeToggle = document.getElementById('analytics-mode-toggle');
    const analyticsModeLabel = document.getElementById('analytics-mode-label');

    const initializeDateFilters = () => {
  const yearSelect = document.getElementById("commission-year");
  const monthSelect = document.getElementById("commission-month");
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11

  // Populate years (e.g., from 2023 to current year)
  for (let year = currentYear; year >= 2023; year--) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  }

  // Populate months
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  months.forEach((month, index) => {
    const option = document.createElement("option");
    option.value = index + 1; // 1-12
    option.textContent = month;
    monthSelect.appendChild(option);
  });

  // Set default to current month and year
  yearSelect.value = currentYear;
  monthSelect.value = currentMonth + 1;
    };

    const fetchFunnelStats = async (isReset = false) => {
        const funnelContainer = document.getElementById("funnel-container");
        funnelContainer.innerHTML = "<p>Loading stats...</p>";

        let url = '/api/v1/analytics/funnel';
        const params = new URLSearchParams();

        if (isReset) {
            document.getElementById("funnel-start-date").value = "";
            document.getElementById("funnel-end-date").value = "";
        } else {
            const startDate = document.getElementById("funnel-start-date").value;
            const endDate = document.getElementById("funnel-end-date").value;
            if (startDate) params.append("startDate", startDate);
            if (endDate) params.append("endDate", endDate);
        }

        // Always add the mode
        params.append("mode", analyticsModeToggle.checked ? 'events' : 'users');

        url += `?${params.toString()}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch stats: ${response.statusText}`);
            const stats = await response.json();
            renderFunnel(stats, funnelContainer);
        } catch (error) {
            console.error("Error fetching funnel data:", error);
            funnelContainer.innerHTML = `<p style="color: red;">Error loading stats: ${error.message}</p>`;
        }
    };

    const fetchCommissionStats = async () => {
  const commissionContainer = document.getElementById("commission-container");
  commissionContainer.innerHTML = "<p>Loading commission data...</p>";

  const year = document.getElementById("commission-year").value;
  const month = document.getElementById("commission-month").value;
  const monthName =
    document.getElementById("commission-month").options[
      document.getElementById("commission-month").selectedIndex
    ].text;

        try {
            const response = await fetch(`/api/v1/analytics/commission?year=${year}&month=${month}`);
            if (!response.ok) throw new Error(`Failed to fetch commission stats: ${response.statusText}`);
            const commissionData = await response.json();
            renderCommission(commissionData, commissionContainer, `${monthName} ${year}`);
        } catch (error) {
            console.error("Error fetching commission data:", error);
            commissionContainer.innerHTML = `<p style="color: red;">Error loading commission data: ${error.message}</p>`;
        }
    };

    const renderFunnel = (stats, container) => {
  container.innerHTML = ""; // Clear loading message

  const steps = [
    { name: "Wallets Connected", value: stats.connected_wallets || 0 },
    { name: "Join Game Clicks", value: stats.join_attempts || 0 },
    { name: "Successful Deposits", value: stats.successful_deposits || 0 },
    { name: "Games Finished", value: stats.games_finished || 0 },
  ];

  for (let i = 0; i < steps.length; i++) {
    const currentStep = steps[i];
    const prevStep = i > 0 ? steps[i - 1] : null;

    let conversionRate = "";
    if (prevStep && prevStep.value > 0) {
      const rate = (currentStep.value / prevStep.value) * 100;
      conversionRate = `<div class="conversion">${rate.toFixed(1)}% from previous step</div>`;
    }

    const cardHTML = `
            ${i > 0 ? '<div class="funnel-arrow">&#x2193;</div>' : ""}
            <div class="stat-card">
                <h3>${currentStep.name}</h3>
                <div class="value">${currentStep.value}</div>
                ${conversionRate}
            </div>
        `;
    container.innerHTML += cardHTML;
  }
    };

    const renderCommission = (data, container, period) => {
  container.innerHTML = ""; // Clear loading message

  const totalWei = data.total_commission_wei || "0";
  let totalEth = `${totalWei} wei`;

  if (typeof window.ethers !== "undefined") {
    const ethValue = parseFloat(window.ethers.formatEther(totalWei));
    totalEth = ethValue.toFixed(4); // Display with 4 decimal places
  }

  const cardHTML = `
        <div class="stat-card">
            <h3>Total Commission (${period})</h3>
            <div class="value">${totalEth} ETH</div>
        </div>
    `;

  container.innerHTML = cardHTML;
    };

    /**
     * Fetches and displays the total number of games played.
     * Uses the same date filters as the funnel.
     * @param {string} startDate - Optional start date in 'YYYY-MM-DD' format.
     * @param {string} endDate - Optional end date in 'YYYY-MM-DD' format.
     */
    const fetchTotalGames = async (startDate = '', endDate = '') => {
        const container = document.getElementById('game-activity-container');
        container.innerHTML = '<p>Loading game activity data...</p>';

        try {
            let url = '/api/v1/analytics/total-games';
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const data = await response.json();

            container.innerHTML = `<div class="stat-card"><h3>Total Games Played</h3><div class="value">${data.total_games_played || 0}</div></div>`;
        } catch (error) {
            console.error('Failed to fetch total games stats:', error);
            container.innerHTML = '<p class="error" style="color: red;">Failed to load game activity data.</p>';
        }
    };

    // --- Initialization ---
    initializeDateFilters();
    funnelFilterBtn.addEventListener("click", () => fetchFunnelStats(false));
    funnelResetBtn.addEventListener("click", () => fetchFunnelStats(true));
    document.getElementById('commission-filter-btn').addEventListener('click', fetchCommissionStats);

    analyticsModeToggle.addEventListener('change', () => {
        analyticsModeLabel.textContent = analyticsModeToggle.checked ? 'Total Events' : 'Unique Users';
        fetchFunnelStats(document.getElementById('funnel-start-date').value === '' && document.getElementById('funnel-end-date').value === ''); // Re-fetch stats when mode changes
    });

    // Initial data load
    fetchFunnelStats(true);
    fetchCommissionStats();
    fetchTotalGames(); // Fetch game activity on initial load

    // --- Augment existing event listeners to also fetch game activity ---
    funnelFilterBtn.addEventListener("click", () => {
        const startDate = document.getElementById("funnel-start-date").value;
        const endDate = document.getElementById("funnel-end-date").value;
        fetchTotalGames(startDate, endDate);
    });

    funnelResetBtn.addEventListener("click", () => {
        fetchTotalGames(); // Reset to all-time
    });

});
