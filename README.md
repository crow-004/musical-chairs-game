# Musical Chairs on Web3

![Game Banner](https://raw.githubusercontent.com/crow-004/musical-chairs-game/main/docs/images/banner.png)

A real-time multiplayer musical chairs game on the blockchain, built with Go and Web3 technologies. This project is a showcase of a full-stack application featuring a Go backend, smart contracts on Ethereum, and a vanilla JavaScript frontend.

This repository serves as the main hub for the Musical Chairs project, including documentation, feedback, and bug reports.

---

## ▶️ Play the Game

**[Click here to play Musical Chairs!](https://muschairs.com)**

---

## 📜 Table of Contents

- [Key Features](#-key-features)
- [Open Source Commitment](#️-open-source-commitment)
- [Technology Stack](#-technology-stack)
- [How to Play](#-how-to-play)
- [Feedback and Bug Reports](#-feedback-and-bug-reports)
- [License](#️-license)

---

## ✨ Key Features

- **Real-time Multiplayer:** WebSocket-based communication for instant game state updates.
- **Blockchain Integration:** Smart contracts on Ethereum manage game logic and funds.
- **Secure Authentication:** Players sign messages with their wallets to join, no password required.
- **Referral System:** On-chain referral tracking.
- **Full Stack:** A complete application showcasing a robust backend, interactive frontend, and secure smart contracts.

---

## 🛡️ Open Source Commitment

In the spirit of Web3, we believe that trust is paramount. To ensure full transparency and allow our community to verify our code, we have open-sourced all smart contracts governing the game.

-   **Smart Contract Repository:** [**github.com/crow-004/musical-chairs-contracts**](https://github.com/crow-004/musical-chairs-contracts)

While the smart contracts are public, the backend and frontend source code remains proprietary for now to protect our unique implementation and business logic. We believe this hybrid approach provides the best of both worlds: on-chain trust and off-chain competitive advantage.

---

## 🛠️ Technology Stack

This project is built with a modern, containerized architecture to ensure reliability and scalability.

- **Backend:** Written in **Go**, handling all real-time game logic, user sessions, and WebSocket communication. The source code is currently proprietary.
- **Smart Contracts:** **Solidity** contracts, deployed on an Ethereum-compatible network, manage the core game rules and funds. The contracts are **open-source (MIT License)** and have been verified on-chain. You can review the code in our [contracts repository](https://github.com/crow-004/musical-chairs-contracts).
- **Frontend:** Built with vanilla **JavaScript, HTML, and CSS** for a fast and responsive user experience.
- **Infrastructure:** The entire application is containerized using **Docker** and orchestrated with **Docker Compose**, running behind an **Nginx** reverse proxy for security and performance.
- **Code Quality:** **SonarQube** is used for continuous static code analysis to maintain high code quality.

---

## 🎮 How to Play

1.  Visit the game website: **[muschairs.com](https://muschairs.com)**
2.  Connect your Web3 wallet (e.g., MetaMask).
3.  Ensure you are on the correct network (the required Chain ID will be displayed on the page).
4.  Click "Join Game" and follow the prompts to participate!

---

## 🐞 Feedback and Bug Reports

Your feedback is highly appreciated! If you encounter a bug, have a suggestion, or want to ask a question, please **[open an issue on this repository](https://github.com/crow-004/musical-chairs-game/issues)**.

When reporting a bug, please include:
- A clear description of the issue.
- Steps to reproduce the bug.
- Your browser and wallet information.
- Any relevant console logs or screenshots.

---

## ⚖️ License

The contents of this repository (documentation, issues, etc.) are available for the community. The smart contract source code is released under the **MIT License**. The backend and frontend source code is proprietary and all rights are reserved.
