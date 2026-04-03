# Social Login & Account Abstraction in Musical Chairs

Musical Chairs is designed to be the "first step" for millions of users into the Web3 world. To achieve this, we have implemented a seamless onboarding process that combines **Web2-style Social Login** with **ERC-4337 Account Abstraction**.

## Technical Architecture

Our system consists of three distinct layers that work together to provide a non-custodial but user-friendly experience.

### Layer 1: Authentication (Web3Auth)
When a user logs in via Google, Apple, or X, we use **Web3Auth**. 
*   **Deterministic Key Generation:** Web3Auth uses a distributed key management system. Based on the social provider's OAuth token and our client ID, it generates a unique **Externally Owned Account (EOA)** private key directly in the user's browser.
*   **Non-Custodial:** Neither the game developers nor Web3Auth store the user's full private key. It is reconstructed locally upon successful social authentication.

### Layer 2: Smart Account Wrapper (Permissionless.js)
Instead of forcing the user to interact directly with their EOA (which requires manual gas management and has limited security), we wrap it in a **Smart Account**.
*   **Implementation:** We utilize the **SimpleSmartAccount** standard via the `permissionless.js` library.
*   **Deterministic Address:** The address of the Smart Account is calculated using the EOA's address as the "owner" and a standard factory contract. This means that every time the user logs in with the same Google account, they will **always** get the same Smart Account address across all sessions.

### Layer 3: Transaction Execution (Bundlers & Paymasters)
Because the player's funds are kept on the Smart Account, they can perform actions that would traditionally require complex signatures.
*   **Bundling:** Transactions (like "React" or "Join") are sent as `UserOperations` to a Bundler (we use **Pimlico**). 
*   **Gas Sponsorship:** Our infrastructure supports **Paymasters**. Currently, players pay their own network fees in native ETH. However, we plan to utilize gas sponsorship for future promotional events. A permanent "Gas-Free" experience is being evaluated for the stage when the game moves to stakes using our internal token.

## How Persistence Works

One of the most common questions is: *"How does the system know I have a wallet if I just used Google?"*

1.  **Identity Mapping:** Your Google ID is cryptographically mapped to a specific EOA.
2.  **Ownership Mapping:** That EOA is the only address authorized to control your **SimpleSmartAccount**.
3.  **On-Chain Existence:** Even if you clear your browser cache or change devices, logging back in with Google triggers the same derivation path, pointing you back to your existing on-chain assets and game history.

## Self-Custody & Portability

We believe in Web3 sovereignty. Even though the onboarding feels like Web2, the user is in full control:
*   **Export Key:** Users can at any time export the private key of their EOA owner. 
*   **External Access:** This key can be imported into MetaMask or Rabby. 
*   **Direct Transfers:** Our UI includes a native "Transfer" feature, allowing users to send their ETH winnings to any external EVM address without leaving the application.
*   **Decentralized Recovery:** If our website goes down, users can access their wallet and funds through the Web3Auth Wallet Portal or by interacting with the blockchain directly via Etherscan.

## Summary of Benefits

| Feature | Benefit for the Player |
| :--- | :--- |
| **Social Sign-in** | No seed phrases to write down or lose. |
| **Future Gasless Play** | Support for sponsored fees during promo events and token-based rounds. |
| **Native Management** | Export keys or transfer funds to any EVM address directly from the UI. |
| **Deterministic ID** | Your progress and balance are tied to your social identity. |
| **Bank-Grade Security** | Powered by Intel SGX enclaves and proven ERC-4337 standards. |

---
*Built for the next billion users.*
