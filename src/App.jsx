<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Client name entry - mockup</title>
<style>
:root{--teal:#0f766e;--navy:#0f172a;--gold:#d97706;--purple:#7c3aed;--text:#1f2937;--mid:#4b5563;--light:#9ca3af;--border:#e5e7eb;--surface:#f6f7f9;--danger:#dc2626;--ok:#15803d}
*{box-sizing:border-box}
body{margin:0;padding:22px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#eef1f4;color:var(--text)}
.wrap{max-width:980px;margin:0 auto}
h1{font-size:22px;margin:0 0 4px}
.sub{color:var(--mid);font-size:14px;margin-bottom:18px;line-height:1.5}
.pick{background:#fffbeb;border:1px solid #fcd34d;border-radius:14px;padding:14px 16px;margin-bottom:20px}
.pick b{font-size:14px}
.pick .opts{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
.pick label{flex:1 1 260px;display:flex;gap:9px;align-items:flex-start;background:white;border:2px solid var(--border);border-radius:10px;padding:10px 12px;cursor:pointer;font-size:13px;line-height:1.45}
.pick label.on{border-color:var(--teal);background:#f0fdfa}
.pick input{margin-top:3px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media(max-width:820px){.grid{grid-template-columns:1fr}}
.col h2{font-size:15px;margin:0 0 3px}
.col .where{font-size:12px;color:var(--mid);margin-bottom:8px}
.card{background:white;border:1px solid var(--border);border-radius:14px;padding:16px}
.tag{display:inline-block;font-size:11px;font-weight:800;border-radius:6px;padding:2px 7px;margin-left:6px;vertical-align:middle}
.tag.new{background:#dcfce7;color:var(--ok)}.tag.old{background:#f3f4f6;color:var(--mid)}
.ttl{font-size:12px;font-weight:700;color:var(--mid);margin-bottom:8px}
.row{display:grid;gap:8px;margin-bottom:8px}
.r2{grid-template-columns:1.4fr 1fr}.r2b{grid-template-columns:1fr 1fr}
label.f{font-size:12px;font-weight:700;color:var(--text);display:block}
input[type=text],input[type=number],input[type=date]{width:100%;margin-top:3px;padding:9px 10px;border-radius:8px;border:1px solid var(--border);font-size:14px;color:var(--text);font-family:inherit}
input:focus{outline:2px solid #99f6e4;border-color:var(--teal)}
.hint{font-size:11px;color:var(--light);margin-top:3px;font-weight:400}
.preview{background:#f0fdfa;border:1px dashed #5eead4;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;color:var(--mid)}
.preview b{color:var(--teal);font-size:15px}
.preview.empty b{color:var(--light);font-weight:500;font-size:13px}
.privacy{font-size:11.5px;color:var(--mid);background:var(--surface);border-radius:8px;padding:7px 10px;margin-bottom:10px;line-height:1.45}
button.go{padding:10px 18px;border:none;border-radius:9px;background:var(--teal);color:white;font-weight:700;font-size:14px;cursor:pointer}
button.go:disabled{background:#cbd5e1;cursor:not-allowed}
.types{display:flex;gap:8px;margin-bottom:10px}
.types div{flex:1;border:2px solid var(--border);border-radius:9px;padding:9px 10px;font-size:13px;font-weight:700}
.types div.on{border-color:var(--purple);background:#f5f3ff}
.list .it{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:14px}
.list .it:last-child{border-bottom:none}
.list .it small{color:var(--mid);font-size:12px}
.sec{margin-top:22px}
.notes{background:white;border:1px solid var(--border);border-radius:14px;padding:16px 18px;margin-top:22px;font-size:13.5px;line-height:1.6}
.notes h3{margin:0 0 6px;font-size:14px}
.notes ul{margin:4px 0 10px;padding-left:20px}
.err{color:var(--danger);font-size:11px;margin-top:3px;display:none}
</style></head>
<body><div class="wrap">
<h1>Client names: first name + 2 letters</h1>
<div class="sub">Mockup only - nothing here saves. Type in the forms to see how it works. Now shows all three places. Reps would enter a client's first name and just two letters of the last name, so the Hub never holds a full client name for anything new.</div>

<div class="pick">
  <b>Using the first two letters of the last name</b> (confirmed). Smith becomes <b>Sm</b>, so Maria Smith shows as <b>Maria Sm</b>.
  </div>

<div class="grid">
  <div class="col">
    <h2>1. Log New Life App <span class="tag new">NEW</span></h2>
    <div class="where">Production tab (My Production). Same box reps already use today.</div>
    <div class="card">
      <div class="ttl">Log New Life App</div>
      <div class="row r2">
        <label class="f">Client first name<input type="text" id="la_f" maxlength="30" placeholder="Maria" autocomplete="off"></label>
        <label class="f"><span class="lbl">Last name: first 2 letters</span><input type="text" id="la_l" maxlength="2" placeholder="Sm" autocomplete="off"><span class="hint">Just 2 letters, not the whole name</span></label>
      </div>
      <div class="preview empty" id="la_p">Will show as: <b>(enter a first name and 2 letters)</b></div>
      <div class="row r2b">
        <label class="f">Monthly premium $<input type="number" placeholder="Monthly Premium $" value="85"></label>
        <label class="f">Date<input type="date" value="2026-11-26"></label>
      </div>
      <div class="privacy">🔒 Please don't type a full last name. The Hub only needs enough to tell clients apart.</div>
      <button class="go" id="la_b" disabled>Add Life App</button>
    </div>
  </div>

  <div class="col">
    <h2>2. Log an Investment <span class="tag new">NEW</span></h2>
    <div class="where">Production tab, plus the investment log on a rep's profile. Same two boxes in both.</div>
    <div class="card">
      <div class="ttl">Log an Investment</div>
      <div class="row r2">
        <label class="f">Client first name<input type="text" id="in_f" maxlength="30" placeholder="Maria" autocomplete="off"></label>
        <label class="f"><span class="lbl">Last name: first 2 letters</span><input type="text" id="in_l" maxlength="2" placeholder="Sm" autocomplete="off"><span class="hint">Just 2 letters, not the whole name</span></label>
      </div>
      <div class="preview empty" id="in_p">Will show as: <b>(enter a first name and 2 letters)</b></div>
      <div class="types"><div class="on">Mutual Fund</div><div>Annuity</div></div>
      <div class="row r2b">
        <label class="f">PAC $/mo<input type="number" value="100"></label>
        <label class="f">Lump Sum $<input type="number" placeholder="0"></label>
      </div>
      <button class="go" id="in_b" disabled>Save Investment</button>
    </div>
  </div>
</div>

<div class="sec">
  <h2 style="font-size:15px;margin:0 0 3px">3. Rep checklist: Investment Observation Log <span class="tag new">NEW</span></h2>
  <div class="where" style="font-size:12px;color:var(--mid);margin-bottom:8px">On the rep's checklist, under the Investment Observation counter (tap <b>+ Log Name</b>). Today it's one "Prospect Name" box.</div>
  <div class="card" style="max-width:620px;border:1px solid #fcd34d;background:#fffdf5">
    <div class="ttl" style="font-size:13px;color:var(--text)">Investment Observation Log</div>
    <div style="font-size:13px;color:var(--mid);margin-bottom:10px">Log the prospect name of each person you observed getting an investment account opened during your training appointments. This builds your future AUM pipeline.</div>
    <div style="display:grid;grid-template-columns:1.3fr 1fr auto;gap:8px;align-items:end;margin-bottom:6px">
      <label class="f">Prospect first name<input type="text" id="ob_f" maxlength="30" placeholder="Maria" autocomplete="off"></label>
      <label class="f">Last name: first 2 letters<input type="text" id="ob_l" maxlength="2" placeholder="Sm" autocomplete="off"></label>
      <button class="go" id="ob_b" disabled style="background:var(--gold)">Add</button>
    </div>
    <div class="preview empty" id="ob_p">Will show as: <b>(enter a first name and 2 letters)</b></div>
    <div class="list">
      <div class="it"><span><b id="ob_new">Maria Sm</b> <span class="tag new">new format</span> <small>11/26/2026</small></span><span style="color:var(--danger)">x</span></div>
      <div class="it"><span><b>Tom Becker</b> <span class="tag old">entered before</span> <small>11/19/2026</small></span><span style="color:var(--danger)">x</span></div>
    </div>
  </div>
</div>

<div class="sec">
  <h2 style="font-size:15px;margin:0 0 3px">4. What the lists look like afterward</h2>
  <div class="where" style="font-size:12px;color:var(--mid);margin-bottom:8px">Everything already in the Hub stays exactly as entered. Only new entries use the short format.</div>
  <div class="card list" style="max-width:520px">
    <div class="it"><span><b id="ex_new">Maria Sm</b> <span class="tag new">new format</span><br><small>Life App - $85/mo - Nov 26</small></span></div>
    <div class="it"><span><b>Dana Whitfield</b> <span class="tag old">entered before</span><br><small>Life App - $120/mo - Nov 12</small></span></div>
    <div class="it"><span><b>Robert Alvarez</b> <span class="tag old">entered before</span><br><small>Mutual Fund - $200/mo PAC - Nov 3</small></span></div>
  </div>
</div>

<div class="notes">
  <h3>How it would work</h3>
  <ul>
    <li><b>Old entries are never touched.</b> Anything already logged keeps its full name, and it still shows, counts and exports the same.</li>
    <li><b>New entries only</b> use the two boxes. The name is saved as one short label (like "Maria Sm"), so lists, exports and the team views keep working with no other changes.</li>
    <li><b>The Add button stays gray</b> until there's a first name and exactly 2 letters.</li>
    <li><b>Editing an old entry</b> would leave it alone. Only new logs get the new boxes.</li>
  </ul>
  <h3>Things to know</h3>
  <ul>
    <li>Two clients could end up with the same short name (two Marias with the same letters). The date and dollar amount on each entry still tell them apart.</li>
    <li>The beneficiary and emergency-contact call scripts would use the <b>first name only</b>: "Did Maria mention I'd be reaching out?" This also applies to older entries, where the script would use just the first word of the full name.</li>
    <li>This covers all three places names are entered: life apps, investments, and the rep checklist's Investment Observation Log. The Observation Log is also in the downloadable spreadsheet and the admin Investment Observations page, so those would show the short names for new entries too.</li>
  </ul>
</div>
</div>
<script>
let mode="first";
const cut=s=>{s=(s||"").trim();return mode==="last"?s.slice(-2):s.slice(0,2)};
const cap=s=>{s=(s||"").trim();return s?s.charAt(0).toUpperCase()+s.slice(1):""};
function wire(pre){
  const f=document.getElementById(pre+"_f"),l=document.getElementById(pre+"_l"),p=document.getElementById(pre+"_p"),b=document.getElementById(pre+"_b");
  const upd=()=>{
    const fn=cap(f.value.replace(/[^A-Za-z.'-]/g,"")),ln=l.value.replace(/[^A-Za-z]/g,"").slice(0,2);
    const ok=fn.length>0&&ln.length===2;
    b.disabled=!ok;
    p.className="preview"+(ok?"":" empty");
    p.innerHTML="Will show as: <b>"+(ok?(fn+" "+ln):"(enter a first name and 2 letters)")+"</b>";
    if(ok&&pre==="la")document.getElementById("ex_new").textContent=fn+" "+ln;
  };
  f.addEventListener("input",upd);l.addEventListener("input",upd);return upd;
}
const ups=[wire("la"),wire("in"),wire("ob")];
document.getElementById("ob_f").addEventListener("input",()=>{const f=document.getElementById("ob_f").value,l=document.getElementById("ob_l").value;if(f.trim()&&l.length===2)document.getElementById("ob_new").textContent=cap(f.replace(/[^A-Za-z.'-]/g,""))+" "+l});
document.getElementById("ob_l").addEventListener("input",()=>document.getElementById("ob_f").dispatchEvent(new Event("input")));

</script></body></html>
