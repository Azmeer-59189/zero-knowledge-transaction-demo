"""
Q1 - Privacy Preserving Transactions using Zero-Knowledge Proof Simulation
Inspired by Tornado Cash concept for educational use.

Run:
    python Q1_privacy_transaction.py
"""

import hashlib
import secrets
from dataclasses import dataclass
from typing import Dict, List, Set


def sha256(text: str) -> str:
    """Return SHA-256 hash of a string."""
    return hashlib.sha256(text.encode()).hexdigest()


@dataclass
class DepositNote:
    """Private note kept by user after deposit."""
    user: str
    secret: str
    commitment: str
    nullifier: str


class MiniTornadoCash:
    """
    Simplified anonymous pool:
    - deposit stores only commitment hash
    - withdrawal verifies a proof object
    - nullifier prevents double spending
    """

    def __init__(self) -> None:
        self.commitments: List[str] = []
        self.pool: Dict[str, float] = {}
        self.spent_nullifiers: Set[str] = set()

    def deposit(self, user: str, amount: float = 1.0) -> DepositNote:
        """Generate user secret, create commitment, and store it in pool."""
        secret = secrets.token_hex(16)
        nullifier = secrets.token_hex(16)
        commitment = sha256(secret + nullifier)

        self.commitments.append(commitment)
        self.pool[commitment] = amount

        return DepositNote(user=user, secret=secret, commitment=commitment, nullifier=nullifier)

    def generate_proof(self, note: DepositNote) -> Dict[str, str]:
        """
        In a real ZKP, the secret is not revealed to verifier.
        This simplified proof exposes only commitment and nullifier_hash.
        The verifier checks pool membership and double-spend status.
        """
        return {
            "commitment": note.commitment,
            "nullifier_hash": sha256(note.nullifier),
            "statement": "I know secret and nullifier for a valid commitment in the pool."
        }

    def verify_proof(self, proof: Dict[str, str]) -> bool:
        """Verify proof without accessing original secret."""
        commitment = proof.get("commitment")
        nullifier_hash = proof.get("nullifier_hash")

        if commitment not in self.commitments:
            return False

        if nullifier_hash in self.spent_nullifiers:
            return False

        return True

    def withdraw(self, proof: Dict[str, str], receiver_address: str) -> bool:
        """Withdraw if proof is valid, then mark nullifier as spent."""
        if not self.verify_proof(proof):
            print("Withdrawal failed: invalid proof or double spending detected.")
            return False

        self.spent_nullifiers.add(proof["nullifier_hash"])
        print(f"Withdrawal successful to anonymous receiver: {receiver_address}")
        return True


def simulate_attack(system: MiniTornadoCash) -> None:
    """Attacker tries to withdraw using fake commitment."""
    fake_proof = {
        "commitment": sha256("fake-secret"),
        "nullifier_hash": sha256("fake-nullifier"),
        "statement": "Fake proof"
    }
    print("\nAttack Simulation:")
    result = system.withdraw(fake_proof, "attacker_wallet")
    print("Attack success?", result)


def main() -> None:
    system = MiniTornadoCash()

    print("=== Q1: Privacy Preserving Transaction System ===\n")
    users = ["Ali", "Sara", "Ahmed", "Zain", "Ebad"]
    notes: List[DepositNote] = []

    print("Deposit Phase: multiple users deposit into one mixing pool")
    for user in users:
        note = system.deposit(user, amount=1.0)
        notes.append(note)
        print(f"{user} deposited. Stored commitment: {note.commitment[:20]}...")

    print("\nCurrent mixing pool size:", len(system.commitments))
    print("Because commitments are mixed together, outsider cannot directly link deposit to withdrawal.")

    print("\nProof + Withdrawal Phase")
    selected_note = notes[2]  # Ahmed withdraws, but receiver is anonymous
    proof = system.generate_proof(selected_note)

    print("Proof sent to verifier:")
    print("commitment:", proof["commitment"][:30] + "...")
    print("nullifier_hash:", proof["nullifier_hash"][:30] + "...")
    print("Original secret is NOT shown to verifier.")

    system.withdraw(proof, "anonymous_wallet_001")

    print("\nDouble Spending Test: same proof used again")
    second_try = system.withdraw(proof, "anonymous_wallet_002")
    print("Second withdrawal success?", second_try)

    simulate_attack(system)


if __name__ == "__main__":
    main()
