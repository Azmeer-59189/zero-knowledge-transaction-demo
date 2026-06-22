let deposits = JSON.parse(localStorage.getItem("deposits") || "[]");
let nullifiers = new Set(JSON.parse(localStorage.getItem("nullifiers") || "[]"));

const $ = id => document.getElementById(id);

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function randomSecret() {
  return `${crypto.randomUUID()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function saveState() {
  localStorage.setItem("deposits", JSON.stringify(deposits));
  localStorage.setItem("nullifiers", JSON.stringify([...nullifiers]));
}

function log(message) {
  $("logs").textContent += `[${new Date().toLocaleTimeString()}] ${message}\n`;
  $("logs").scrollTop = $("logs").scrollHeight;
}

function shortHash(hash) {
  return hash ? `${hash.slice(0, 12)}...${hash.slice(-8)}` : "";
}

function createPrivateNote({ secret, coin }) {
  const payload = JSON.stringify({ secret, coin });
  return `ZKP-NOTE:${btoa(payload)}`;
}

function parsePrivateNote(noteString) {
  if (!noteString) throw new Error("The private note is empty.");
  if (!noteString.startsWith("ZKP-NOTE:")) throw new Error("Invalid note format.");
  const payload = noteString.slice(9);
  try {
    return JSON.parse(atob(payload));
  } catch (error) {
    throw new Error("Unable to parse the private note.");
  }
}

function copyToClipboard(text, successMessage) {
  navigator.clipboard.writeText(text).then(() => {
    log(successMessage);
  }).catch(() => {
    alert("Copy failed. Please copy the note manually.");
  });
}

async function render() {
  const tbody = $("poolTable");
  tbody.innerHTML = "";
  deposits.forEach((d, i) => {
    const used = nullifiers.has(d.nullifier);
    tbody.innerHTML += `<tr>
      <td>${i}</td>
      <td>${d.user}</td>
      <td><code>${shortHash(d.commitment)}</code></td>
      <td><span class="badge ${used ? "used" : "ok"}">${used ? "Withdrawn" : "In Pool"}</span></td>
    </tr>`;
  });

  const select = $("noteSelect");
  select.innerHTML = "";
  if (deposits.length === 0) {
    select.innerHTML = `<option>No private notes yet</option>`;
  } else {
    deposits.forEach((d, i) => {
      select.innerHTML += `<option value="${i}">Private Note ${i} - ${d.user}</option>`;
    });
  }

  const total = deposits.length;
  const withdrawn = deposits.reduce((count, d) => count + (nullifiers.has(d.nullifier) ? 1 : 0), 0);
  const active = total - withdrawn;
  $("poolStats").innerHTML = `
    <div><strong>Deposits:</strong> ${total}</div>
    <div><strong>Withdrawn:</strong> ${withdrawn}</div>
    <div><strong>Active notes:</strong> ${active}</div>
  `;

  const root = await buildMerkleRoot(deposits.map(d => d.commitment));
  $("merkleRoot").textContent = root || "No root yet.";
  updateSelectedNoteDetails();
}

function updateSelectedNoteDetails() {
  const details = $("noteDetails");
  if (!details) return;
  if (deposits.length === 0) {
    details.innerHTML = "Select a note after adding a deposit.";
    return;
  }

  const index = Number($("noteSelect").value);
  if (Number.isNaN(index) || index < 0 || index >= deposits.length) {
    details.innerHTML = "Select a valid note to inspect its status.";
    return;
  }

  const note = deposits[index];
  const used = nullifiers.has(note.nullifier);
  details.innerHTML = `
    <b>Selected note ${index}</b><br>
    User: ${note.user}<br>
    Coin label: ${note.coin}<br>
    Status: <span class="badge ${used ? "used" : "ok"}">${used ? "Withdrawn" : "Available"}</span><br>
    Commitment: <code>${shortHash(note.commitment)}</code>
  `;
}

async function deposit() {
  const user = $("userName").value.trim() || `User ${deposits.length + 1}`;
  const coin = $("coinValue").value.trim() || `coin_${deposits.length + 1}`;
  const secret = randomSecret();
  const commitment = await sha256(`${secret}|${coin}`);
  const nullifier = await sha256(`nullifier|${secret}`);
  const privateNote = createPrivateNote({ secret, coin });

  deposits.push({ user, coin, secret, commitment, nullifier });
  saveState();

  $("depositResult").innerHTML = `
    <b>Anonymous deposit successful.</b><br>
    Private note generated locally. Copy it to withdraw later.<br>
    Public commitment: <code>${shortHash(commitment)}</code><br>
    <div class="note-block"><code>${privateNote}</code></div>
    <button id="copyNoteBtn" class="small">Copy private note</button>
  `;

  document.getElementById("copyNoteBtn").addEventListener("click", () => {
    copyToClipboard(privateNote, "Private note copied to clipboard.");
  });

  log(`Deposit accepted for ${user}. Commitment: ${shortHash(commitment)}`);
  await render();
}

async function withdraw() {
  if (deposits.length === 0) {
    alert("Please make a deposit first.");
    return;
  }

  const pastedNote = $("noteInput")?.value.trim();
  let secret;
  let coin;
  let selectedIndex = null;

  if (pastedNote) {
    try {
      ({ secret, coin } = parsePrivateNote(pastedNote));
    } catch (error) {
      $("withdrawResult").innerHTML = `<b>Invalid private note.</b><br>${error.message}`;
      log(`Withdrawal rejected: ${error.message}`);
      return;
    }
  } else {
    selectedIndex = Number($("noteSelect").value);
    if (Number.isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= deposits.length) {
      alert("Select a valid private note or paste one into the box.");
      return;
    }
    secret = deposits[selectedIndex].secret;
    coin = deposits[selectedIndex].coin;
  }

  const calculatedCommitment = await sha256(`${secret}|${coin}`);
  const deposit = deposits.find(d => d.commitment === calculatedCommitment);

  if (!deposit) {
    $("withdrawResult").innerHTML = `<b>Withdrawal failed.</b><br>No matching commitment found in the pool.`;
    log("Withdrawal rejected: private note does not match any pool commitment.");
    return;
  }

  if (nullifiers.has(deposit.nullifier)) {
    $("withdrawResult").innerHTML = `<b>Double spending blocked.</b><br>This private note has already been used.`;
    log("Withdrawal rejected: nullifier already exists, double spend attempt blocked.");
    return;
  }

  nullifiers.add(deposit.nullifier);
  saveState();
  $("withdrawResult").innerHTML = `
    <b>Withdrawal successful.</b><br>
    Ownership verified without revealing the secret.<br>
    Nullifier used: <code>${shortHash(deposit.nullifier)}</code>
  `;
  log(`Withdrawal approved for ${deposit.user}. Nullifier: ${shortHash(deposit.nullifier)}`);
  await render();
}

async function attack() {
  const fakeSecret = randomSecret();
  const fakeCoin = `fake_coin_${Math.floor(Math.random() * 1_000)}`;
  const fakeCommitment = await sha256(`${fakeSecret}|${fakeCoin}`);
  const valid = deposits.some(d => d.commitment === fakeCommitment);

  $("withdrawResult").innerHTML = valid
    ? `<b>Unexpected success.</b><br>The fake proof matched a pool commitment.`
    : `<b>Attack failed.</b><br>Fake note does not match any commitment in the pool.`;
  log(`Fake attack attempted with random note. Result: ${valid ? "unexpected success" : "rejected"}.`);
}

async function hashPair(a, b) {
  return sha256(a + b);
}

async function buildLevels(leaves) {
  if (leaves.length === 0) return [];
  let levels = [leaves];
  let current = leaves;
  while (current.length > 1) {
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = current[i + 1] || current[i];
      next.push(await hashPair(left, right));
    }
    levels.push(next);
    current = next;
  }
  return levels;
}

async function buildMerkleRoot(leaves) {
  const levels = await buildLevels(leaves);
  return levels.length ? levels[levels.length - 1][0] : "";
}

async function generateMerkleProof(index) {
  const leaves = deposits.map(d => d.commitment);
  const levels = await buildLevels(leaves);
  let proof = [];
  let currentIndex = index;

  for (let level = 0; level < levels.length - 1; level++) {
    const layer = levels[level];
    const isRightNode = currentIndex % 2 === 1;
    const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
    const sibling = layer[siblingIndex] || layer[currentIndex];
    proof.push({ position: isRightNode ? "left" : "right", hash: sibling });
    currentIndex = Math.floor(currentIndex / 2);
  }
  return proof;
}

async function verifyMerkleProof(leaf, proof, root) {
  let hash = leaf;
  for (const step of proof) {
    hash = step.position === "left"
      ? await hashPair(step.hash, hash)
      : await hashPair(hash, step.hash);
  }
  return hash === root;
}

async function runMerkleProof() {
  const index = Number($("leafIndex").value);
  if (Number.isNaN(index) || index < 0 || index >= deposits.length) {
    alert(`Enter leaf index between 0 and ${deposits.length - 1}`);
    return;
  }

  const root = await buildMerkleRoot(deposits.map(d => d.commitment));
  const proof = await generateMerkleProof(index);
  const valid = await verifyMerkleProof(deposits[index].commitment, proof, root);

  $("proofResult").innerHTML = `
    <b>Leaf ${index} verification: ${valid}</b><br>
    Proof path length: ${proof.length}<br>
    This proves the commitment exists in the tree.
  `;
  $("proofDetails").innerHTML = proof.map((step, idx) => `
    <div><strong>Step ${idx + 1}:</strong> ${step.position} sibling<br><code>${shortHash(step.hash)}</code></div>
  `).join("");
  log(`Merkle proof generated for leaf ${index}. Verification result: ${valid}`);
}

$("depositBtn").addEventListener("click", deposit);
$("withdrawBtn").addEventListener("click", withdraw);
$("attackBtn").addEventListener("click", attack);
$("proofBtn").addEventListener("click", runMerkleProof);
$("noteSelect").addEventListener("change", updateSelectedNoteDetails);
$("copyRootBtn").addEventListener("click", () => {
  const root = $("merkleRoot").textContent;
  if (root && root !== "No root yet.") {
    copyToClipboard(root, "Merkle root copied to clipboard.");
  } else {
    alert("There is no root to copy yet.");
  }
});
$("resetBtn").addEventListener("click", () => {
  deposits = [];
  nullifiers = new Set();
  localStorage.clear();
  $("depositResult").textContent = "No deposit yet.";
  $("withdrawResult").textContent = "No withdrawal yet.";
  $("proofResult").textContent = "No Merkle proof yet.";
  $("proofDetails").textContent = "";
  $("logs").textContent = "System reset. Start again.\n";
  $("noteInput").value = "";
  render();
});

render();
