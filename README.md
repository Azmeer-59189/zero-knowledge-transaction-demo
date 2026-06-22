# Blockchain Quiz 3 - Privacy Demo

## Overview
This project includes a polished browser-based demo of privacy-preserving transactions, along with the original Python quiz solutions.

## Web Demo
The React demo is now powered by Vite. Install dependencies and run the developer server:

```bash
npm install
npm run dev
```

Then open the local URL shown in the terminal.

### What this demo shows
- Private deposit creation with a local secret note
- Public mixing pool of commitments only
- Anonymous withdrawal using a private note
- Nullifier-based double-spend protection
- Merkle root generation and proof verification
- Fake withdrawal simulation to demonstrate security checks

## How to use the demo
1. Run the React app with `npm run dev`.
2. Enter a user name and coin label, then click **Generate Secret & Deposit**.
3. Copy the generated private note and keep it safe.
4. Use the note selector or paste the note into the withdraw box.
5. Click **Withdraw Anonymously** to verify without exposing the secret.
6. Use the Merkle proof panel to verify any leaf index.

## Run locally with Python server if needed
If you prefer, you can still serve the folder with a static server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Python files
- `Q1_privacy_transaction.py` - simplified Tornado Cash style privacy transaction system.
- `Q2_part1_zkp_pin.py` - 4-digit PIN zero-knowledge proof simulation.
- `Q2_part2_merkle_tree.py` - Merkle Tree deposit/proof/verification system.
- `run_all.py` - runs all Python quiz files sequentially.

## Notes
This project is an educational demonstration. Real zero-knowledge systems use specialized cryptographic proofs and on-chain privacy protocols.
