# Musical Chairs on Web3

![Game Banner](https://github.com/crow-004/musical-chairs-game/blob/main/docs/banner.png)

A real-time multiplayer musical chairs game on the blockchain, built with Go and Web3 technologies. This project is a showcase of a full-stack application featuring a Go backend, smart contracts on Ethereum, and a vanilla JavaScript frontend.

**This repository is for demonstration, feedback, and bug reports. The source code is proprietary and not available here.**

---

## ▶️ Play the Game

**[Click here to play Musical Chairs!](https://muschairs.com)**

---

## 📜 Table of Contents

- [Key Features](#-key-features)
- [Technology Stack](#️-technology-stack)
- [How to Play](#-how-to-play)
- [Feedback and Bug Reports](#-feedback-and-bug-reports)
- [Technical FAQ](#-technical-faq)
- [License](#-license)

---

## ✨ Key Features

- **Real-time Multiplayer:** WebSocket-based communication for instant game state updates.
- **Blockchain Integration:** Smart contracts on Ethereum manage game logic and ownership.
- **Secure Authentication:** Players sign messages with their wallets to join, no password required.
- **Referral System:** On-chain referral tracking.
- **Full Stack:** A complete application showcasing a robust backend, interactive frontend, and secure smart contracts.

---

## 🛠️ Technology Stack

This project is built with a modern, containerized architecture to ensure reliability and scalability.

- **Backend:** Written in **Go**, handling all real-time game logic, user sessions, and WebSocket communication.
- **Smart Contracts:** **Solidity** contracts, deployed on an Ethereum-compatible network, manage the core game rules and funds. The contract has been verified on-chain.
- **Frontend:** Built with vanilla **JavaScript, HTML, and CSS** for a fast and responsive user experience.
- **Infrastructure:** The entire application is containerized using **Docker** and orchestrated with **Docker Compose**, running behind an **Nginx** reverse proxy for security and performance.
- **Code Quality:** **SonarQube** is used for continuous static code analysis to maintain high code quality.

---

## 🎮 How to Play

1.  Visit the game website: **[your-game-url.com](https://muschairs.com)**
2.  Connect your Web3 wallet (e.g., MetaMask).
3.  Ensure you are on the correct network (the required Chain ID will be displayed on the page).
4.  Click "Join Game" and follow the prompts to participate!

---

## 🐞 Feedback and Bug Reports

Your feedback is highly appreciated! If you encounter a bug, have a suggestion, or want to ask a question, please **[open an issue](https://github.com/crow-004/musical-chairs-game/issues)** on this repository.

When reporting a bug, please include:
- A clear description of the issue.
- Steps to reproduce the bug.
- Your browser and wallet information.
- Any relevant console logs or screenshots.

---

## ❓ Technical FAQ

For more detailed technical questions, such as "How does the player authentication work?", please see our **[Technical FAQ](docs/FAQ.md)**.

---

## 📄 License

This project is proprietary. All rights are reserved. The code is **UNLICENSED** and may not be copied, modified, or distributed without explicit permission.
