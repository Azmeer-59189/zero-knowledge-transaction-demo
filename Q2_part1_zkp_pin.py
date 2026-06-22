"""
Q2 Part 1 - ZKP Foundations: 4-digit PIN proof simulation

Run:
    python Q2_part1_zkp_pin.py
"""

import hashlib
import random
import secrets


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def commit(pin: str, nonce: str) -> str:
    """Hash-based commitment: hides PIN because nonce is random."""
    return sha256(pin + nonce)


def prover_response(pin: str, nonce: str, challenge: int) -> dict:
    """
    Challenge-response simulation:
    challenge 0: open commitment partially by showing nonce only
    challenge 1: prove PIN format by showing masked PIN pattern and commitment opening hash

    Educational note: This is a simplified classroom ZKP-like protocol, not production ZKP.
    """
    if challenge == 0:
        return {"nonce": nonce}
    return {"pin_length": len(pin), "pin_is_digits": pin.isdigit(), "opening_hash": commit(pin, nonce)}


def verifier(challenge: int, commitment: str, response: dict) -> bool:
    """Verifier checks response according to challenge without learning the PIN."""
    if challenge == 0:
        return "nonce" in response and len(response["nonce"]) > 0

    return (
        response.get("pin_length") == 4
        and response.get("pin_is_digits") is True
        and response.get("opening_hash") == commitment
    )


def run_protocol(pin: str = "4829", iterations: int = 100) -> None:
    if not (len(pin) == 4 and pin.isdigit()):
        raise ValueError("PIN must be exactly 4 digits.")

    nonce = secrets.token_hex(16)
    commitment = commit(pin, nonce)
    passed = 0

    print("=== Q2 Part 1: 4-Digit PIN ZKP Simulation ===\n")
    print("Public commitment:", commitment)
    print("Actual PIN is kept private and never printed.\n")

    for _ in range(iterations):
        challenge = random.randint(0, 1)
        response = prover_response(pin, nonce, challenge)
        if verifier(challenge, commitment, response):
            passed += 1

    cheating_probability = (0.5) ** iterations

    print(f"Protocol iterations: {iterations}")
    print(f"Honest prover successful rounds: {passed}/{iterations}")
    print("Cheating prover success probability by random guessing:")
    print(f"(1/2)^{iterations} = {cheating_probability:.80f}")


if __name__ == "__main__":
    run_protocol()
