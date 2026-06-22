import { useEffect, useMemo, useState } from 'react';

const STORAGE_DEPOSITS = 'deposits';
const STORAGE_NULLIFIERS = 'nullifiers';

const shortHash = hash => hash ? `${hash.slice(0, 12)}...${hash.slice(-8)}` : '';

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomSecret() {
  return `${crypto.randomUUID()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function createPrivateNote({ secret, coin }) {
  const payload = JSON.stringify({ secret, coin });
  return `ZKP-NOTE:${btoa(payload)}`;
}

function parsePrivateNote(noteString) {
  if (!noteString) throw new Error('The private note is empty.');
  if (!noteString.startsWith('ZKP-NOTE:')) throw new Error('Invalid note format.');
  const payload = noteString.slice(9);
  try {
    return JSON.parse(atob(payload));
  } catch {
    throw new Error('Unable to parse the private note.');
  }
}

function useLocalStorageState(key, defaultValue) {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}

export default function App() {
  const [deposits, setDeposits] = useLocalStorageState(STORAGE_DEPOSITS, []);
  const [nullifiers, setNullifiers] = useLocalStorageState(STORAGE_NULLIFIERS, []);
  const [userName, setUserName] = useState('');
  const [coinValue, setCoinValue] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [leafIndex, setLeafIndex] = useState('');
  const [customRoot, setCustomRoot] = useState('');
  const [depositResult, setDepositResult] = useState('No deposit yet.');
  const [withdrawResult, setWithdrawResult] = useState('No withdrawal yet.');
  const [proofResult, setProofResult] = useState('No Merkle proof yet.');
  const [proofDetails, setProofDetails] = useState('');
  const [logs, setLogs] = useState(['System ready. Start by adding deposits.']);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [merkleRoot, setMerkleRoot] = useState('');

  const nullifierSet = useMemo(() => new Set(nullifiers), [nullifiers]);

  const poolStats = useMemo(() => {
    const total = deposits.length;
    const withdrawn = deposits.reduce((count, d) => count + (nullifierSet.has(d.nullifier) ? 1 : 0), 0);
    return { total, withdrawn, active: total - withdrawn };
  }, [deposits, nullifierSet]);

  useEffect(() => {
    async function updateRoot() {
      const root = await buildMerkleRoot(deposits.map(d => d.commitment));
      setMerkleRoot(root);
    }
    updateRoot();
  }, [deposits]);

  async function buildLevels(leaves) {
    if (leaves.length === 0) return [];
    let levels = [leaves];
    let current = leaves;
    while (current.length > 1) {
      const next = [];
      for (let i = 0; i < current.length; i += 2) {
        const left = current[i];
        const right = current[i + 1] || current[i];
        next.push(await sha256(left + right));
      }
      levels.push(next);
      current = next;
    }
    return levels;
  }

  async function buildMerkleRoot(leaves) {
    const levels = await buildLevels(leaves);
    return levels.length ? levels[levels.length - 1][0] : '';
  }

  async function generateMerkleProof(index) {
    const leaves = deposits.map(d => d.commitment);
    const levels = await buildLevels(leaves);
    const proof = [];
    let currentIndex = index;

    for (let level = 0; level < levels.length - 1; level++) {
      const layer = levels[level];
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
      const sibling = layer[siblingIndex] || layer[currentIndex];
      proof.push({ position: isRightNode ? 'left' : 'right', hash: sibling });
      currentIndex = Math.floor(currentIndex / 2);
    }
    return proof;
  }

  async function verifyMerkleProof(leaf, proof, root) {
    let hash = leaf;
    for (const step of proof) {
      hash = step.position === 'left'
        ? await sha256(step.hash + hash)
        : await sha256(hash + step.hash);
    }
    return hash === root;
  }

  function appendLog(message) {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }

  async function handleDeposit() {
    const user = userName.trim() || `User ${deposits.length + 1}`;
    const coin = coinValue.trim() || `coin_${deposits.length + 1}`;
    const secret = randomSecret();
    const commitment = await sha256(`${secret}|${coin}`);
    const nullifier = await sha256(`nullifier|${secret}`);
    const privateNote = createPrivateNote({ secret, coin });

    setDeposits(prev => [...prev, { user, coin, secret, commitment, nullifier }]);
    setDepositResult(
      <>
        <strong>Anonymous deposit successful.</strong><br />
        Private note generated locally. Copy it to withdraw later.<br />
        Public commitment: <code>{shortHash(commitment)}</code><br />
        <div className="note-block"><code>{privateNote}</code></div>
        <button className="small" onClick={() => navigator.clipboard.writeText(privateNote)}>
          Copy private note
        </button>
      </>
    );
    appendLog(`Deposit accepted for ${user}. Commitment: ${shortHash(commitment)}`);
    setUserName('');
    setCoinValue('');
  }

  async function handleWithdraw() {
    if (!deposits.length) {
      setWithdrawResult('Please make a deposit first.');
      return;
    }

    let secret;
    let coin;
    if (noteInput.trim()) {
      try {
        ({ secret, coin } = parsePrivateNote(noteInput.trim()));
      } catch (err) {
        setWithdrawResult(<><strong>Invalid private note.</strong><br />{err.message}</>);
        appendLog(`Withdrawal rejected: ${err.message}`);
        return;
      }
    } else {
      const note = deposits[selectedIndex];
      if (!note) {
        setWithdrawResult('Select a valid note or paste one into the box.');
        return;
      }
      secret = note.secret;
      coin = note.coin;
    }

    const calculatedCommitment = await sha256(`${secret}|${coin}`);
    const deposit = deposits.find(d => d.commitment === calculatedCommitment);
    if (!deposit) {
      setWithdrawResult(<><strong>Withdrawal failed.</strong><br />No matching commitment found in the pool.</>);
      appendLog('Withdrawal rejected: private note does not match any pool commitment.');
      return;
    }
    if (nullifierSet.has(deposit.nullifier)) {
      setWithdrawResult(<><strong>Double spending blocked.</strong><br />This private note has already been used.</>);
      appendLog('Withdrawal rejected: nullifier already exists, double spend attempt blocked.');
      return;
    }

    setNullifiers(prev => [...prev, deposit.nullifier]);
    setWithdrawResult(<>
      <strong>Withdrawal successful.</strong><br />
      Ownership verified without revealing the secret.<br />
      Nullifier used: <code>{shortHash(deposit.nullifier)}</code>
    </>);
    appendLog(`Withdrawal approved for ${deposit.user}. Nullifier: ${shortHash(deposit.nullifier)}`);
  }

  async function handleAttack() {
    const fakeSecret = randomSecret();
    const fakeCoin = `fake_coin_${Math.floor(Math.random() * 1_000)}`;
    const fakeCommitment = await sha256(`${fakeSecret}|${fakeCoin}`);
    const valid = deposits.some(d => d.commitment === fakeCommitment);
    setWithdrawResult(valid
      ? <><strong>Unexpected success.</strong><br />The fake proof matched a pool commitment.</>
      : <><strong>Attack failed.</strong><br />Fake note does not match any commitment in the pool.</>
    );
    appendLog(`Fake attack attempted. Result: ${valid ? 'unexpected success' : 'rejected'}.`);
  }

  async function handleProof() {
    const index = Number(leafIndex);
    if (Number.isNaN(index) || index < 0 || index >= deposits.length) {
      setProofResult(`Enter leaf index between 0 and ${deposits.length - 1}`);
      return;
    }

    const noteRoot = customRoot.trim() || merkleRoot;
    if (!noteRoot) {
      setProofResult('No Merkle root is available. Add a deposit first.');
      return;
    }

    const proof = await generateMerkleProof(index);
    const valid = await verifyMerkleProof(deposits[index].commitment, proof, noteRoot);

    setProofResult(<>
      <strong>Leaf {index} verification: {valid.toString()}</strong><br />
      Proof path length: {proof.length}<br />
      {customRoot.trim()
        ? `Compared against custom root: ${noteRoot}`
        : 'Compared against computed pool root.'}
    </>);
    setProofDetails(proof.map((step, idx) => (
      <div key={idx}><strong>Step {idx + 1}:</strong> {step.position} sibling<br /><code>{shortHash(step.hash)}</code></div>
    )));
    appendLog(`Merkle proof generated for leaf ${index}. Verification result: ${valid}`);
  }

  function handleReset() {
    setDeposits([]);
    setNullifiers([]);
    setDepositResult('No deposit yet.');
    setWithdrawResult('No withdrawal yet.');
    setProofResult('No Merkle proof yet.');
    setProofDetails('');
    setLogs(['System reset. Start again.']);
    setNoteInput('');
    setLeafIndex('');
    setSelectedIndex(0);
  }

  function handleCopyRoot() {
    if (!merkleRoot) {
      setProofResult('There is no root to copy yet.');
      return;
    }
    navigator.clipboard.writeText(merkleRoot);
    appendLog('Merkle root copied to clipboard.');
  }

  return (
    <div className="app-shell">
      <header>
        <div>
          <h1>Privacy Preserving Transactions</h1>
          <p>React-based demo of private deposits, anonymous withdrawals, and Merkle proof verification.</p>
        </div>
        <button onClick={handleReset}>Reset Demo</button>
      </header>

      <main className="grid">
        <section className="card intro-card wide">
          <h2>How this demo works</h2>
          <p className="hint">The system stores only hash commitments publicly. Private notes stay local, and withdrawals prove membership without revealing secrets.</p>
          <div className="intro-grid">
            <div><strong>Step 1:</strong> Make a deposit and generate a private note.</div>
            <div><strong>Step 2:</strong> The pool stores only commitments, not secret data.</div>
            <div><strong>Step 3:</strong> Withdraw with a note and nullifier to prevent double spends.</div>
            <div><strong>Step 4:</strong> Verify membership with a Merkle proof.</div>
          </div>
        </section>

        <section className="card">
          <h2>1. Create a private deposit</h2>
          <p className="hint">Enter a user label and coin identifier. The private note is generated locally and never stored in the public pool.</p>
          <label htmlFor="userName">User Name</label>
          <input id="userName" value={userName} onChange={e => setUserName(e.target.value)} placeholder="Example: Alice" />
          <label htmlFor="coinValue">Coin / Amount Label</label>
          <input id="coinValue" value={coinValue} onChange={e => setCoinValue(e.target.value)} placeholder="Example: coin_A" />
          <button onClick={handleDeposit}>Generate Secret & Deposit</button>
          <div className="result">{depositResult}</div>
        </section>

        <section className="card">
          <h2>2. Public mixing pool</h2>
          <p className="hint">Only commitments are visible here. A real privacy system would never expose private secrets.</p>
          <div className="stats-grid">
            <div><strong>Deposits:</strong> {poolStats.total}</div>
            <div><strong>Withdrawn:</strong> {poolStats.withdrawn}</div>
            <div><strong>Active notes:</strong> {poolStats.active}</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>User</th><th>Commitment</th><th>Status</th></tr>
              </thead>
              <tbody>
                {deposits.map((d, i) => (
                  <tr key={i}>
                    <td>{i}</td>
                    <td>{d.user}</td>
                    <td><code>{shortHash(d.commitment)}</code></td>
                    <td><span className={`badge ${nullifierSet.has(d.nullifier) ? 'used' : 'ok'}`}>
                      {nullifierSet.has(d.nullifier) ? 'Withdrawn' : 'In Pool'}
                    </span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2>3. Withdraw with private note</h2>
          <p className="hint">Use your private note to withdraw anonymously. You may also paste a saved note from another session.</p>
          <label htmlFor="noteSelect">Choose a private note</label>
          <select id="noteSelect" value={selectedIndex} onChange={e => setSelectedIndex(Number(e.target.value))}>
            {deposits.length ? deposits.map((d, i) => (
              <option key={i} value={i}>Private Note {i} - {d.user}</option>
            )) : <option>No private notes yet</option>}
          </select>
          <label htmlFor="noteInput">Or paste a private note</label>
          <textarea id="noteInput" rows="3" value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder="Paste your ZKP private note here" />
          <div className="button-row">
            <button onClick={handleWithdraw}>Withdraw Anonymously</button>
            <button className="danger" onClick={handleAttack}>Simulate Fake Attack</button>
          </div>
          <div className="result">{withdrawResult}</div>
          <div className="result note-details">
            {deposits.length ? (
              <>
                <strong>Selected note {selectedIndex}</strong><br />
                User: {deposits[selectedIndex]?.user || 'N/A'}<br />
                Coin label: {deposits[selectedIndex]?.coin || 'N/A'}<br />
                Status: <span className={`badge ${nullifierSet.has(deposits[selectedIndex]?.nullifier) ? 'used' : 'ok'}`}>
                  {nullifierSet.has(deposits[selectedIndex]?.nullifier) ? 'Withdrawn' : 'Available'}
                </span><br />
                Commitment: <code>{shortHash(deposits[selectedIndex]?.commitment)}</code>
              </>
            ) : 'Select a note to see its status.'}
          </div>
        </section>

        <section className="card">
          <h2>4. Merkle tree verification</h2>
          <p className="hint">The Merkle root summarizes the pool. A proof path confirms inclusion of a deposit.</p>
          <div className="result wide-result">
            <div>
              <strong>Merkle Root:</strong>
              <code>{merkleRoot || 'No root yet.'}</code>
            </div>
            <button className="small" onClick={handleCopyRoot}>Copy root</button>
          </div>
          <label htmlFor="customRoot">Custom Merkle Root (optional)</label>
          <input id="customRoot" value={customRoot} onChange={e => setCustomRoot(e.target.value)} placeholder="Paste a custom root here" />
          <label htmlFor="leafIndex">Leaf index to verify</label>
          <input id="leafIndex" type="number" min="0" value={leafIndex} onChange={e => setLeafIndex(e.target.value)} placeholder="Example: 0" />
          <button onClick={handleProof}>Generate & Verify Merkle Proof</button>
          <div className="result">{proofResult}</div>
          <div className="result">{proofDetails}</div>
        </section>

        <section className="card wide">
          <h2>5. Live console output</h2>
          <pre>{logs.join('\n')}</pre>
        </section>
      </main>
    </div>
  );
}
