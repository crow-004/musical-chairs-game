# Musical Chairs: A Litepaper

**Version 1.0 - November 2025**

---

### **Abstract**

Musical Chairs is a real-time, on-chain game of speed, strategy, and survival deployed on the Arbitrum and Base networks. Inspired by the universally understood childhood game and the daily rush for a seat on the metro, it distills a moment of competitive thrill into a simple, fast, and transparently fair Web3 experience.

The game operates on a zero-sum, player-funded economic model, ensuring sustainability and avoiding the inflationary pressures common in many GameFi projects. With a focus on security, transparency, and community-driven growth, Musical Chairs aims to be a sandbox for Web3 mass adoption, proving that blockchain gaming can be both fun and economically sound.

---

### **1. The Spark of an Idea**

The concept for Musical Chairs wasn't born in a boardroom; it sparked to life in the controlled chaos of the Dubai Metro.

Picture this: a train glides into the station, doors slide open, and a silent, high-stakes race begins. People surge forward, eyes scanning for the few empty seats. It's a game of speed, observation, and a little bit of luck. A moment of hesitation, and you've lost your chance.

That fleeting, universal thrill—the rush to claim a limited spot—is the soul of this project. We asked ourselves: what if we could capture that feeling, distill it, and put it on the blockchain?

The result is Musical Chairs: a game that transforms a simple, real-world moment of competition into a transparent, fast-paced on-chain experience where timing is everything. It's not just about code; it's about recreating that primal rush for the last seat on the train.

---

### 2. The Problem

*   **High barrier to entry into Web3:** Most dApps and games are complex, require significant investment and deep technical knowledge.
*   **Unsustainable GameFi economics:** Many P2E games suffer from inflationary tokenomics, requiring a constant influx of new players to pay out older players.
*   **Lack of transparency and trust:** Players often cannot verify the fairness of game mechanics, especially in centralized online games.
*   **Difficulty for the mass user:** The lack of simple, fun and "viral" applications that could become the first experience in Web3 for millions of people.

---

### 3. The solution

*   **Radical accessibility:** Musical Chairs offers intuitive gameplay and a low entry threshold (stake < $10), making it an ideal "first game" in Web3.
*   **Sustainable zero-sum economy:** Our model is funded exclusively by players in the current session. It does not depend on the influx of new users for payouts and is inherently sustainable.
*   **Provable integrity:** All key actions (deposits, winnings) take place on-chain in a verified smart contract, ensuring complete transparency.
*   **Built-in growth mechanism:** Our on-chain referral system turns players into partners, creating a decentralized and organic growth engine.

---

### **4. Technology Stack & Architecture**

The project is built with a modern, containerized architecture to ensure reliability, security, and scalability.

*   **Backend:** Written in **Go**, handling all real-time game logic, user sessions, and WebSocket communication. The source code is currently proprietary to protect our unique implementation.
*   **Smart Contracts:** **Solidity** contracts deployed on the Arbitrum and Base networks manage the core game rules, funds, and referral logic. In the spirit of Web3, all smart contracts are **open-source (MIT License)** and verified on-chain. You can review the code in our [contracts repository](https://github.com/crow-004/musical-chairs-contracts).
*   **Frontend:** Built with vanilla **JavaScript, HTML, and CSS** for a lightweight, fast, and universally responsive user experience.
*   **Infrastructure:** The entire application is containerized using **Docker** and orchestrated with **Docker Compose**, running behind an **Nginx** reverse proxy for security and performance.

---

### 5. Security

*   **Audits:** We plan to conduct smart contract audits from reputable firms.
*   **Proxy contract (UUPS):** We will explain that we use an updatable proxy contract with a timelock, which gives the community time to verify updates.
*   **Key segmentation (3-key system):** Describe our system with a cold wallet for contract ownership, a hot wallet for the backend, and a separate wallet for collecting commissions.
*   **Testing:** Mention our extensive testing (unit tests, integration tests, fuzzing with Foundry/Echidna, static analysis with Slither).
*   **Vulnerability Disclosure Policy:** A link to our SECURITY.md and an address for private vulnerability reporting.

---

### **6. How to Play: Game Mechanics**

The gameplay loop is designed to be intuitive and fast, with each game session lasting under 15 minutes.

1.  **Connect & Join:** Players connect their Web3 wallet (e.g., MetaMask) to the application on the Arbitrum or Base network. Clicking "Join Game" places the player in a waiting room.
2.  **Game Creation:** A new game is created on-chain when 5 players are in the waiting room, or if a timer expires with at least 2 players.
3.  **Deposit Stake:** Once the game is created, participants have a limited time to deposit the fixed stake of 0.002 ETH into the smart contract.
4.  **The Round:** When all players have deposited, the music starts. When it stops, a "CLICK!" button appears. The last player to click is eliminated. The backend server determines the loser based on reaction time to ensure a real-time experience.
5.  **Winning & Payouts:** The game ends when only winners remain. The winners share the loser's stake, minus a small platform commission. Winnings are then available to be claimed from the smart contract.

---

### **7. Game Economics**

The economic model of Musical Chairs is designed for sustainability and fairness, deliberately avoiding the pitfalls of inflationary tokenomics.

*   **Stake:** A fixed stake of 0.002 ETH is required to participate in a game. This amount can be adjusted by the contract owner to adapt to market conditions.
*   **Prize Pool:** The prize pool for each game is funded *only* by the players in that specific game. There is no reliance on new players coming in to pay out old players. Winnings are derived directly from the loser's stake.
*   **Commission:** The platform earns revenue through a small, percentage-based commission (currently 2.5%) taken from each player's stake that contributes to the total pot. This is a classic, sustainable business model that works even with fluctuating volume.
*   **Revenue Distribution:** **100% of all platform revenue is reinvested directly back into the project.** This covers marketing expenses, operational costs (servers, gas fees), future security audits, and legal formalization. This strategy ensures that all early success directly fuels future growth.

---

### **8. Referral System**

To bootstrap community growth, we have implemented a fully on-chain referral system.

*   **How It Works:**
    1.  **Share Your Link:** Each player has a unique referral link available on their dashboard, including a QR code that can be used instead of a long text link.
    2.  **First-Time Join:** When a new player joins a game for the first time using a referral link, an on-chain request is created for the referrer to approve.
    3.  **Confirm Referees:** The referrer must approve each new player once on the "My Referrals" dashboard.
    4.  **Start Earning:** Once confirmed, the referrer earns a commission from the platform's fees for every game their referee plays, forever.

*   **Earning Commission:**
    A portion of the platform's commission from every game is allocated to a Referral Pool. This pool is then distributed among the referrers of the players in that game. Your share is proportional to the number of players you referred in that game. For example, if your referee is the only referred player in a game, you receive the entire referral commission for that game.

---

### **9. Public Roadmap**

#### Q3 2025: Foundations & Community Growth

✅ Major Contract Upgrades (V3 & V4): Implemented on-chain referrals and a percentage-based commission model.
✅ Listing: Successful listings on DappRadar and DefiLlama.
✅ **Community Building:** Launching Zealy campaigns and growing our Discord community.
✅ **UI/UX Improvements:** Enhancing the user interface based on initial player feedback.

#### Q4 2025: Ecosystem Integration & Engagement

*   **Arbitrum Portal Listing:** Securing a spot on the official Arbitrum Portal to increase visibility and trust.
*   **Listings:**
    *   Submitted to PlayToEarn.com for review.
    *   We are actively seeking a top hunter to list Musical Chairs on Product Hunt, aiming to reach a wider audience and gain valuable feedback.
    *   We are constantly looking for new platforms and listing opportunities.
*   **Gaming Guild Partnerships:** We are preparing partnership proposals for leading gaming guilds to integrate Musical Chairs into their ecosystems and offer exclusive tournaments for their members.
*   **Leaderboards & Stats:** ✅ Done: Introducing all-time and daily leaderboards.
*   **Community Tournaments:** ✅ Done: Organizing the first community-led tournaments with ETH prize pools.
*   **Contribution System:** Formalizing and launching the "Contribution Points System" to reward active community members.
*   **Marketing Kick-off:** ✅ Done: Launching initial paid marketing and bounty campaigns on platforms like X and BitcoinTalk.
*   **Infrastructure Maintenance:** Planning and executing the migration of the self-hosted Umami analytics platform to v3 to ensure accurate tracking and access to new features.
*   **Advisor Onboarding:** ✅ Done: Formalizing relationships with key growth and community advisors.
*   **Farcaster Integration:** ✅ Done: Launched an interactive Frame for real-time on-chain stats.
*   **Public Analytics:** ✅ Done: Created a public Dune Analytics dashboard to track key on-chain metrics (total games, volume, unique players).

#### Q1 2026: Seed Round & Formalization
 
*   **Seed Round Fundraising:** Actively fundraising and closing the seed round.
*   **Legal Structure:** Establishing a formal legal entity (e.g., in a crypto-friendly jurisdiction) using the proceeds from the seed round.
*   **Tokenomics & Whitepaper:** Finalizing the official Tokenomics Whitepaper (v1).
 
#### Q2 2026: Token Launch & Expansion

*   **Token Generation Event (TGE):** Issuing the official project token on Arbitrum.
*   **Vesting Contract Deployment:** Setting up and funding on-chain vesting contracts for advisors and team members according to their agreements.
*   **Airdrop:** Distributing tokens to early users based on the Contribution Points System.
*   **Staking & Utility:** Launching the first staking mechanism, allowing token holders to earn a share of platform commissions.
*   **DEX Listing & In-Game Economy Migration:** Providing deep initial liquidity on a leading DEX and transitioning the game's stake currency from ETH to $CHAIR.

### Q3 2026 & Beyond: Scaling the Ecosystem

*   **Multi-Chain Deployment:** Exploring deployment to other EVM-compatible networks (e.g., Optimism, BSC).
    *   *Note: Keeping an eye on emerging Bitcoin L2s like Hemi Network for future expansion.*
*   **Major Partnership:** Securing a strategic collaboration with a major project in the Web3 gaming or infrastructure space.
*   **CEX Listing:** Initiating conversations for listing on a reputable centralized exchange (CEX).
*   **NFT Marketplace Listing:** Listing the "Founding Player" NFT collection on major marketplaces, starting with OpenSea and then applying to premier platforms like Magic Eden.
*   **DAO Formation:** Beginning the transition to a decentralized autonomous organization (DAO) for community governance.

---

### **10. Team & Contributors**

Musical Chairs is an indie project was founded and developed by **Crow**, a solo full-stack developer with the support of AI and community contributors.

*   **Crow:** Founder & Solo Developer. Responsible for the entire stack: Backend (Go), Smart Contracts (Solidity), and Frontend.
*   **Zyrick:** Web3 UI/UX Developer. Created the wallet selection modal and assists with interface improvements. ([X Profile](https://x.com/humblechigozie_))

    *Note: This project has been built with the assistance of world-class AI tool (Gemini), which have significantly accelerated development and continue to provide invaluable support.*


*   **John:** Community contributor driving marketing and community management efforts.

---

### **11. Tokenomics (Draft v0.2)**

*   Team & Founder: 25%
*   Advisors: 5%
*   Seed Round Investors: 15%
*   Community & Airdrop: 25%
*   Treasury / Ecosystem Fund: 30%

*(Note: This is our current allocation plan and may be subject to minor adjustments as we finalize the whitepaper.)*

---
### 12. Token Usage

This section details the planned utility for the $CHAIR token within the Musical Chairs ecosystem.

*   **Staking for Income:** $CHAIR token holders will be able to stake their tokens to receive a portion of platform fees, providing a direct way to share in the project's success with the community.
*   **Governance:** In the future, the $CHAIR token will be used for voting in the DAO on key issues, such as commission size, the addition of new game modes, and the allocation of funds from the treasury.
*   **Game currency**: A smooth transition from using ETH to $CHAIR as the primary currency for betting in the game.
*   **Exclusive access:** Owning a certain number of tokens may grant access to special tournaments, exclusive NFTs, or other privileges.

---

### 13. Go-to-Market Strategy

*   **Phase 1: Organic Growth (current):**
    *   **Aggregator Listings:** DappRadar, DefiLlama for basic visibility.
    *   **Community Marketing:** Conducting tournaments, campaigns on Zealy, actively maintaining Discord/Telegram.
    *   **Content Marketing:** Articles on Medium/Dev.to, posts in X explaining the mechanics and values of the project.
*   **Phase 2: Partnerships:**
    *   **Gaming Guilds:** Offering exclusive tournaments and integration through the referral system.
    *   **Influencers:** Collaborating with micro- and mid-level influencers in the Arbitrum ecosystem.
*   **Phase 3: Paid Acquisition (post-funding):**
    *   Targeted advertising, sponsorships, and larger marketing campaigns.

---

### 14. Disclaimer

This document is for informational purposes only and does not constitute financial advice, an endorsement, or a solicitation to purchase or sell any digital assets. Cryptocurrency investments are subject to high market risk. Please make investments cautiously and conduct your own independent research (DYOR) before making any investment decisions. The plans and roadmap outlined in this document are subject to change.

---

### **15. Official Links**

To protect yourself from scams, please only use the official links provided below.

*   **Website:** [muschairs.com](https://muschairs.com)
*   **Base Network:** [base.muschairs.com](https://base.muschairs.com)
*   **Discord:** [discord.gg/wnnJKjgfZW](https://discord.gg/wnnJKjgfZW)
*   **Telegram:** [t.me/muschairs](https://t.me/muschairs)
*   **X (Twitter):** [x.com/muschairs](https://x.com/muschairs)
*   **GitHub (Main):** [github.com/crow-004/musical-chairs-game](https://github.com/crow-004/musical-chairs-game)
*   **GitHub (Contracts):** [github.com/crow-004/musical-chairs-contracts](https://github.com/crow-004/musical-chairs-contracts)
*   **DappRadar:** [dappradar.com/dapp/musical-chairs](https://dappradar.com/dapp/musical-chairs)
*   **DefiLlama:** [defillama.com/protocol/musical-chairs](https://defillama.com/protocol/musical-chairs)
*   **Dune Analytics:** [dune.com/crow004/musical-chairs-game-analytics](https://dune.com/crow004/musical-chairs-game-analytics)

The contents of this repository (documentation, issues, etc.) are available for the community. The smart contract source code is released under the **MIT License**. The backend and frontend source code is proprietary and all rights are reserved.

---

### 16. Conclusion

Musical Chairs is more than just a game; it's a demonstration of how blockchain technology can be used to create engaging, transparent, and sustainable entertainment experiences. By focusing on accessibility, community-driven growth, and robust security, we aim to onboard a new generation of users to the Arbitrum ecosystem and redefine the future of Web3 gaming.
