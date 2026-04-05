// guess-the-number.js – Number guessing game
// Embed this script in an HTML page for a playable demo,
// or read the logic here as a reference.

(function guessTheNumber() {
  const SECRET  = Math.floor(Math.random() * 100) + 1;
  let   attempts = 0;

  function check(guess) {
    attempts++;
    const n = parseInt(guess, 10);

    if (isNaN(n) || n < 1 || n > 100) {
      return '⚠️  Enter a whole number between 1 and 100.';
    }
    if (n < SECRET) return `📉 Too low!  (attempt ${attempts})`;
    if (n > SECRET) return `📈 Too high! (attempt ${attempts})`;
    return `🎉 Correct! The number was ${SECRET}. You got it in ${attempts} attempt${attempts === 1 ? '' : 's'}!`;
  }

  // If running in a browser with a DOM, wire up a simple UI.
  if (typeof document !== 'undefined') {
    document.body.innerHTML = `
      <style>
        body { font-family: system-ui, sans-serif; display:flex; flex-direction:column;
               align-items:center; justify-content:center; height:100vh; margin:0;
               background:#f0f4f8; color:#1e3a5f; }
        h1   { margin-bottom:8px; }
        p    { color:#5a7a9f; margin-bottom:20px; }
        .row { display:flex; gap:8px; }
        input  { padding:10px 14px; font-size:1rem; border:2px solid #c5d5e8;
                 border-radius:8px; outline:none; width:120px; }
        button { padding:10px 18px; font-size:1rem; background:#1e3a5f; color:#fff;
                 border:none; border-radius:8px; cursor:pointer; }
        button:hover { background:#2a4f80; }
        #msg { margin-top:16px; font-size:1.1rem; min-height:28px; }
      </style>
      <h1>🔢 Guess the Number</h1>
      <p>I'm thinking of a number between 1 and 100.</p>
      <div class="row">
        <input id="inp" type="number" min="1" max="100" placeholder="Your guess" />
        <button id="btn">Guess</button>
      </div>
      <div id="msg"></div>
    `;

    const inp = document.getElementById('inp');
    const btn = document.getElementById('btn');
    const msg = document.getElementById('msg');

    btn.addEventListener('click', () => {
      const result = check(inp.value);
      msg.textContent = result;
      if (result.startsWith('🎉')) {
        btn.disabled = true;
        inp.disabled = true;
      }
      inp.value = '';
      inp.focus();
    });

    inp.addEventListener('keydown', e => e.key === 'Enter' && btn.click());
    inp.focus();
  } else {
    // Node / console fallback
    console.log('Guess the Number – secret is', SECRET);
    console.log(check(42));
    console.log(check(SECRET));
  }
}());
