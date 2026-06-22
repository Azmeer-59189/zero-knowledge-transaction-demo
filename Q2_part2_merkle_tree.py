"""
Q2 Part 2 - Merkle Trees and Anonymity Sets

Run:
    python Q2_part2_merkle_tree.py
"""

import hashlib
from typing import List, Tuple

ProofItem = Tuple[str, str]  # (sibling_hash, direction)


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def hash_pair(left: str, right: str) -> str:
    return sha256(left + right)


class MerkleTree:
    def __init__(self, deposits: List[str]) -> None:
        if not deposits:
            raise ValueError("Deposits cannot be empty.")
        self.deposits = deposits
        self.levels: List[List[str]] = []
        self.build_tree()

    def build_tree(self) -> None:
        leaves = [sha256(deposit) for deposit in self.deposits]
        self.levels = [leaves]

        current = leaves
        while len(current) > 1:
            next_level = []
            for i in range(0, len(current), 2):
                left = current[i]
                right = current[i + 1] if i + 1 < len(current) else left
                next_level.append(hash_pair(left, right))
            self.levels.append(next_level)
            current = next_level

    def root(self) -> str:
        return self.levels[-1][0]

    def generate_proof(self, leaf_index: int) -> List[ProofItem]:
        if leaf_index < 0 or leaf_index >= len(self.deposits):
            raise IndexError("Invalid leaf index.")

        proof: List[ProofItem] = []
        index = leaf_index

        for level in self.levels[:-1]:
            sibling_index = index ^ 1
            if sibling_index >= len(level):
                sibling_hash = level[index]
            else:
                sibling_hash = level[sibling_index]

            direction = "left" if sibling_index < index else "right"
            proof.append((sibling_hash, direction))
            index //= 2

        return proof


def verify_proof(leaf: str, proof: List[ProofItem], root: str) -> bool:
    current_hash = sha256(leaf)

    for sibling_hash, direction in proof:
        if direction == "left":
            current_hash = hash_pair(sibling_hash, current_hash)
        else:
            current_hash = hash_pair(current_hash, sibling_hash)

    return current_hash == root


def main() -> None:
    print("=== Q2 Part 2: Merkle Tree Anonymity System ===\n")

    deposits = [f"coin_user_{i}_unique_secret" for i in range(1, 11)]
    tree = MerkleTree(deposits)

    print("Total deposits:", len(deposits))
    print("Merkle Root:", tree.root())
    print("\nVerification for 3 different leaves:")

    for index in [0, 4, 9]:
        leaf = deposits[index]
        proof = tree.generate_proof(index)
        valid = verify_proof(leaf, proof, tree.root())
        print(f"Leaf {index} verification result: {valid}")
        print(f"Proof length for leaf {index}: {len(proof)} sibling hashes")

    print("\nCritical Answer:")
    print("If outsider sees only the root and valid proof, they cannot directly determine which deposit was spent")
    print("because the root is only a digest of the whole tree and the proof contains hashes, not user identities.")
    print("The anonymity set size is 10 because there are 10 possible depositors in the pool.")


if __name__ == "__main__":
    main()
