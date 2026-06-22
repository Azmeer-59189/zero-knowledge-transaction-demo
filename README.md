# Blockchain Quiz 3 — Privacy Preserving Transactions Demo

## Project Overview
This repository demonstrates privacy-preserving transaction concepts using two tracks:

- A React + Vite browser demo that simulates private deposits, anonymous withdrawals, and Merkle proof verification.
- Python quiz solutions that explore privacy transactions, zero-knowledge PIN proofs, and Merkle tree membership verification.

This is an educational project designed to illustrate how private notes, public commitments, and nullifiers work together in a simplified confidentiality protocol.

## Demo Features
- Generate private notes locally for each deposit
- Store only public commitments in the mixing pool
- Withdraw anonymously by proving commitment ownership without revealing secrets
- Use nullifiers to prevent double-spending
- Build and verify Merkle proofs for deposit inclusion
- Simulate fake attack attempts to show rejection of invalid notes

## Live Demo Guide
### 1. Start the React demo
```bash
npm install
npm run dev
```
Open the local URL shown by Vite.

### 2. Create a private deposit
- Enter a user name and coin label
- Click **Generate Secret & Deposit**
- Copy the generated `ZKP-NOTE` and store it locally

### 3. Withdraw anonymously
- Select a saved note or paste a private note into the input
- Click **Withdraw Anonymously**
- The app verifies the note against the public commitment pool and marks the corresponding nullifier

### 4. Verify Merkle inclusion
- Copy the current Merkle root or paste a custom root
- Enter a leaf index and click **Generate & Verify Merkle Proof**
- Confirm that the selected deposit belongs to the pool without revealing the secret

## Installation
```bash
npm install
npm run dev
```

### Optional static server
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000`.

## Python Quiz Files
- `Q1_privacy_transaction.py` — simplified Tornado Cash-style privacy transaction simulation
- `Q2_part1_zkp_pin.py` — zero-knowledge PIN proof demonstration
- `Q2_part2_merkle_tree.py` — Merkle tree deposit/proof/verification logic
- `run_all.py` — executes all Python quiz scripts sequentially

## Technical Details
- Frontend: React, Vite
- Cryptography: browser-native SHA-256 hashing
- Data model: local private notes, public commitments, nullifiers
- Merkle tree: pairwise hashing, leaf proof generation, inclusion verification

## Project Structure
- `src/` — React application source files
- `index.html` — app entrypoint
- `package.json` — dependency and script definitions
- `README.md` — project documentation
- `style.css` — demo styling
- Python files — quiz solutions and offline proofs

## Why this project matters
This repo helps you understand how privacy protocols can separate secret ownership from publicly verifiable state. It is not a production-ready privacy system, but it illustrates the fundamental concepts behind protocols like Tornado Cash and zero-knowledge membership proofs.

## Recommended GitHub repository metadata
**Repository description:** Privacy-preserving transaction demo with React + Python quizzes for Merkle tree, nullifier, and ZKP concepts.

**Suggested topics:** blockchain, privacy, merkle-tree, zero-knowledge, react, vite, python, educational-demo

## Notes
- Private notes are generated and stored locally only.
- Public commitments are visible in the pool.
- Real zero-knowledge systems require cryptographic proofs beyond simple hashing.

## License
Add a license of your choice (for example, `MIT`) if you want to make this repo open source.
