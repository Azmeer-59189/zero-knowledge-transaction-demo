"""Run all assignment parts in one command."""

import subprocess
import sys

files = [
    "Q1_privacy_transaction.py",
    "Q2_part1_zkp_pin.py",
    "Q2_part2_merkle_tree.py",
]

for file in files:
    print("\n" + "=" * 70)
    print(f"Running {file}")
    print("=" * 70)
    subprocess.run([sys.executable, file], check=True)
