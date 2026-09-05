import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import AppTour, { useTour } from './AppTour';
import FinancialTipPopup from './FinancialTips';
import { db } from './firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { recordContactRequest, useLeadSync } from './LeadSync';


const GROUPS = {
  'Income':       { color:'#16a34a', bg:'rgba(22,163,74,0.12)', cats:['Paycheck','Freelance / side income','Tax refund','Other income'] },
  'Housing':      { color:'var(--green)', bg:'var(--green-light)', cats:['Mortgage / rent','Electric bill','Water bill','Gas / heat bill','Internet','Cable / streaming','Phone bill','HOA fee','Home repair','Other housing'] },
  'Insurance':    { color:'#7c3aed', bg:'rgba(124,58,237,0.1)', cats:['Auto insurance','Life insurance','Health insurance','Dental / vision','Home / renters ins.','Other insurance'] },
  'Transportation':{ color:'#d97706', bg:'rgba(217,119,6,0.1)', cats:['Car payment','Gas / fuel','Car repair / maintenance','Parking / tolls','Public transit','Rideshare','Registration / tags','Other transport'] },
  'Food':         { color:'#059669', bg:'rgba(5,150,105,0.1)', cats:['Groceries','Restaurants / dining out','Fast food','Coffee shops','Other food'] },
  'Health':       { color:'#db2777', bg:'rgba(219,39,119,0.1)', cats:['Doctor visit','Dentist','Prescription / pharmacy','Gym membership','Mental health','Other health'] },
  'Debt Payments':{ color:'#dc2626', bg:'rgba(220,38,38,0.1)', cats:['Credit card payment','Student loan','Personal loan','Medical debt','Other debt payment'] },
  'Kids & Family':{ color:'#16a34a', bg:'rgba(22,163,74,0.1)', cats:['Childcare / daycare','School tuition','School supplies','Kids activities','Baby supplies','Other family'] },
  'Personal':     { color:'#6b7280', bg:'rgba(107,114,128,0.1)', cats:['Clothing','Haircut / grooming','Subscriptions','Gifts','Charity / donations','Other personal'] },
  'Entertainment':{ color:'#ea580c', bg:'rgba(234,88,12,0.1)', cats:['Movies / events','Hobbies','Vacation / travel','Dining / nightlife','Books / games','Other entertainment'] },
  'Savings':      { color:'var(--green)', bg:'var(--green-light)', cats:['Emergency fund','Retirement (401k/IRA)','Investment','Savings account','Other savings'] },
  'Cash Spending':{ color:'#0ea5e9', bg:'rgba(14,165,233,0.1)', cats:['Cash - Groceries','Cash - Fast food','Cash - Restaurants','Cash - Gas / fuel','Cash - Coffee','Cash - Hair / grooming','Cash - Clothing','Cash - Entertainment','Cash - Kids','Cash - Household','Cash - Tips','Cash - Other'] },
  'Other':        { color:'#6b7280', bg:'rgba(107,114,128,0.1)', cats:['Miscellaneous','Cash withdrawal','Other'] }
};
const ALL_CATS = {};
Object.entries(GROUPS).forEach(([g,v]) => v.cats.forEach(c => { ALL_CATS[c] = { group:g, color:v.color, bg:v.bg }; }));

const WELCOME_VIDEO_ID = 'YOUR_YOUTUBE_VIDEO_ID';

function getYouTubeId(input) {
  if (!input || input === 'YOUR_YOUTUBE_VIDEO_ID') return null;
  const match = input.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : (input.length === 11 ? input : null);
}

function WelcomeVideoModal({ lead, onClose }) {
  const videoId = getYouTubeId(WELCOME_VIDEO_ID);
  const firstName = lead?.name?.split(' ')[0] || 'there';
  if (!videoId) return null;
  return (
    <div className="modal-overlay" style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }} onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="slide-up" style={{ background:'#fff', border:'1px solid var(--navy-border)', borderRadius:'var(--radius-xl)', padding:'2rem', maxWidth:620, width:'100%' }}>
        <div style={{ textAlign:'center', marginBottom:'1.25rem' }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800, marginBottom:6, color:'var(--text-primary)' }}>A personal note for you, {firstName} 👋</h2>
          <p style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.6 }}>Before you dive in — take 2 minutes to watch this.</p>
        </div>
        <div style={{ position:'relative', paddingBottom:'56.25%', height:0, borderRadius:'var(--radius-lg)', overflow:'hidden', border:'1px solid var(--navy-border)', marginBottom:'1.25rem' }}>
          <iframe src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`} title="Welcome to MoneyMap" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', border:'none' }} />
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn-gold" style={{ flex:1, padding:'13px', fontSize:14 }} onClick={onClose}>I'm ready — take me to my dashboard 🚀</button>
          <button className="btn-outline" style={{ fontSize:12, padding:'13px 16px' }} onClick={onClose}>Skip</button>
        </div>
      </div>
    </div>
  );
}

function DeleteAccountModal({ lead, onConfirm, onCancel }) {
  const [confirmed, setConfirmed] = useState(false);
  const firstName = lead?.name?.split(' ')[0] || 'there';
  return (
    <div className="modal-overlay" style={{ position:"fixed", inset:0, zIndex:3000, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
      <div className="modal-box slide-up" style={{ maxWidth:460 }}>
        <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
          <div style={{ fontSize:44, marginBottom:12 }}>⚠️</div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, marginBottom:8, color:'var(--text-primary)' }}>Cancel your account?</h2>
          <p style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.7 }}>Are you sure you want to cancel, {firstName}? <strong style={{ color:'var(--text-primary)' }}>This cannot be undone.</strong></p>
        </div>
        <div style={{ background:'#fafaf8', borderRadius:'var(--radius-md)', padding:'12px 16px', marginBottom:'1.25rem' }}>
          <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer' }}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ width:16, height:16, flexShrink:0, marginTop:2, accentColor:'#dc2626' }} />
            <span style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.6 }}>Yes, I understand — permanently cancel my account and remove all my data.</span>
          </label>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn-outline" style={{ flex:1 }} onClick={onCancel}>Keep my account</button>
          <button onClick={onConfirm} disabled={!confirmed} style={{ flex:1, background: confirmed ? '#dc2626' : 'rgba(220,38,38,0.3)', color:'#fff', border:'none', borderRadius:'var(--radius-md)', padding:'12px', fontSize:13, fontWeight:700, cursor: confirmed ? 'pointer' : 'not-allowed', fontFamily:'var(--font-display)', transition:'all 0.2s' }}>
            Cancel my account
          </button>
        </div>
      </div>
    </div>
  );
}

function GoodbyeModal({ lead }) {
  const firstName = lead?.name?.split(' ')[0] || 'there';
  return (
    <div className="modal-overlay" style={{ position:"fixed", inset:0, zIndex:3000, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
      <div className="modal-box slide-up" style={{ maxWidth:460, textAlign:'center' }}>
        <div style={{ fontSize:52, marginBottom:16 }}>👋</div>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:24, marginBottom:10, color:'var(--text-primary)' }}>Take care, {firstName}!</h2>
        <p style={{ fontSize:14, color:'var(--text-muted)', lineHeight:1.7, marginBottom:16 }}>Your account has been cancelled.</p>
        <div style={{ background:'var(--green-light)', border:'1px solid var(--green-mid)', borderRadius:'var(--radius-md)', padding:'14px 16px', marginBottom:16 }}>
          <p style={{ fontSize:13, color:'var(--slate)', lineHeight:1.6 }}>💙 You're always welcome back. Just sign up again — it's always free.</p>
        </div>
        <p style={{ fontSize:12, color:'var(--text-muted)' }}>Redirecting you in a moment…</p>
      </div>
    </div>
  );
}

function PayBillModal({ bill, accounts, onConfirm, onCancel }) {
  const [selectedAccount, setSelectedAccount] = useState(Object.keys(accounts)[0] || 'main');
  const [deductFromAccount, setDeductFromAccount] = useState(true);
  return (
    <div className="modal-overlay" style={{ position:"fixed", inset:0, zIndex:3000, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
      <div className="modal-box slide-up" style={{ maxWidth:420 }}>
        <div style={{ textAlign:'center', marginBottom:'1.25rem' }}>
          <div style={{ fontSize:36, marginBottom:8 }}>💳</div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, marginBottom:6, color:'var(--text-primary)' }}>Mark "{bill.name}" as paid</h2>
          <p style={{ fontSize:13, color:'var(--text-muted)' }}>${bill.amount.toFixed(2)}</p>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:6, fontWeight:500 }}>Deduct from which account?</label>
          <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)} style={{ marginBottom:10 }}>
            {Object.entries(accounts).map(([key, acct]) => (
              <option key={key} value={key}>{acct.name}</option>
            ))}
          </select>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:'var(--slate)' }}>
            <input type="checkbox" checked={deductFromAccount} onChange={e => setDeductFromAccount(e.target.checked)} style={{ width:15, height:15, accentColor:'var(--green)' }} />
            Automatically add debit transaction to this account
          </label>
        </div>
        <div style={{ background:'var(--bg)', borderRadius:'var(--radius-md)', padding:'10px 14px', marginBottom:16, fontSize:12, color:'var(--slate)' }}>
          {deductFromAccount ? `A debit of $${bill.amount.toFixed(2)} will be added to "${accounts[selectedAccount]?.name}" register.` : 'Bill will be marked paid without affecting any account balance.'}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn-outline" style={{ flex:1 }} onClick={onCancel}>Cancel</button>
          <button className="btn-gold" style={{ flex:1 }} onClick={() => onConfirm(selectedAccount, deductFromAccount)}>✓ Mark as Paid</button>
        </div>
      </div>
    </div>
  );
}

// ── Split Transaction Modal ──────────────────────────────────────
function SplitModal({ form, onConfirm, onCancel }) {
  const [splits, setSplits] = useState([
    { grp: form.grp || '', cat: form.cat || '', amt: form.amt || '', note: '' },
    { grp: '', cat: '', amt: '', note: '' },
  ]);
  const total = splits.reduce((s, sp) => s + (parseFloat(sp.amt) || 0), 0);
  const original = parseFloat(form.amt) || 0;
  const remaining = parseFloat((original - total).toFixed(2));

  const addSplit = () => setSplits([...splits, { grp: '', cat: '', amt: '', note: '' }]);
  const removeSplit = i => setSplits(splits.filter((_, idx) => idx !== i));
  const updateSplit = (i, field, val) => {
    const updated = splits.map((s, idx) => idx === i ? { ...s, [field]: val } : s);
    setSplits(updated);
  };

  const handleConfirm = () => {
    const valid = splits.filter(s => s.cat && parseFloat(s.amt) > 0);
    if (valid.length < 2) { alert('Add at least 2 valid split amounts.'); return; }
    if (Math.abs(remaining) > 0.01) { alert(`Split total ($${total.toFixed(2)}) must equal original amount ($${original.toFixed(2)}). Remaining: $${remaining.toFixed(2)}`); return; }
    onConfirm(valid);
  };

  return (
    <div className="modal-overlay" style={{ position:"fixed", inset:0, zIndex:3000, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
      <div className="modal-box slide-up" style={{ maxWidth:520 }}>
        <div style={{ textAlign:'center', marginBottom:'1.25rem' }}>
          <div style={{ fontSize:32, marginBottom:8 }}>✂️</div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, marginBottom:4, color:'var(--text-primary)' }}>Split Transaction</h2>
          <p style={{ fontSize:13, color:'var(--text-muted)' }}>Total: ${original.toFixed(2)} — Remaining: <strong style={{ color: Math.abs(remaining) < 0.01 ? '#16a34a' : '#dc2626' }}>${remaining.toFixed(2)}</strong></p>
        </div>
        {splits.map((sp, i) => (
          <div key={i} style={{ background:'#fafaf8', borderRadius:'var(--radius-md)', padding:'12px', marginBottom:8, border:'1px solid var(--border)' }}>
            <div style={{ display:'flex', gap:8, marginBottom:6, flexWrap:'wrap' }}>
              <select value={sp.grp} onChange={e => updateSplit(i, 'grp', e.target.value)} style={{ flex:1, minWidth:120 }}>
                <option value="">-- Group --</option>
                {Object.keys(GROUPS).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <select value={sp.cat} onChange={e => updateSplit(i, 'cat', e.target.value)} style={{ flex:1, minWidth:120 }}>
                <option value="">-- Category --</option>
                {(sp.grp ? GROUPS[sp.grp]?.cats || [] : Object.values(GROUPS).flatMap(v => v.cats)).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" placeholder="Amount" min="0" step="0.01" value={sp.amt} onChange={e => updateSplit(i, 'amt', e.target.value)} style={{ width:90 }} />
              {splits.length > 2 && <button className="btn-danger" onClick={() => removeSplit(i)}>✕</button>}
            </div>
            <input placeholder="Note (optional)" value={sp.note} onChange={e => updateSplit(i, 'note', e.target.value)} style={{ fontSize:12 }} />
          </div>
        ))}
        <button className="btn-outline" style={{ width:'100%', marginBottom:12, fontSize:12 }} onClick={addSplit}>+ Add another split</button>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn-outline" style={{ flex:1 }} onClick={onCancel}>Cancel</button>
          <button className="btn-gold" style={{ flex:1 }} onClick={handleConfirm}>Save splits</button>
        </div>
      </div>
    </div>
  );
}


function AutocompleteInput({value,onChange,transactions,onSelect,style}){
  const [suggestions,setSuggestions]=useState([]);
  const [showSugg,setShowSugg]=useState(false);
  const [focused,setFocused]=useState(false);
  const ref=useRef(null);

  useEffect(()=>{
    if(!value||value.length<2){setSuggestions([]);setShowSugg(false);return;}
    const lower=value.toLowerCase();
    const seen=new Set();
    const matches=transactions
      .filter(t=>t.desc&&t.desc.toLowerCase().includes(lower))
      .filter(t=>{if(seen.has(t.desc))return false;seen.add(t.desc);return true;})
      .slice(0,6)
      .map(t=>({desc:t.desc,grp:t.grp,cat:t.cat}));
    setSuggestions(matches);
    setShowSugg(matches.length>0&&focused);
  },[value,transactions,focused]);

  useEffect(()=>{
    const handleClick=e=>{if(ref.current&&!ref.current.contains(e.target))setShowSugg(false);};
    document.addEventListener('mousedown',handleClick);
    return()=>document.removeEventListener('mousedown',handleClick);
  },[]);

  return(
    <div ref={ref} style={{position:'relative',flex:1}}>
      <input
        type="text"
        placeholder="Description"
        value={value}
        onChange={e=>onChange(e.target.value)}
        onFocus={()=>setFocused(true)}
        onBlur={()=>setTimeout(()=>setFocused(false),150)}
        style={{width:'100%',...(style||{})}}
      />
      {showSugg&&suggestions.length>0&&(
        <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',boxShadow:'0 4px 16px var(--green-light)',zIndex:999,overflow:'hidden',marginTop:2}}>
          {suggestions.map((s,i)=>(
            <div key={i} onMouseDown={()=>{onSelect(s);setShowSugg(false);}} style={{padding:'9px 14px',cursor:'pointer',borderBottom:i<suggestions.length-1?'1px solid var(--border-light)':'none',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:13,color:'var(--text-primary)',fontWeight:500}}>{s.desc}</span>
              {s.cat&&<span style={{fontSize:10,color:'var(--text-muted)',background:'var(--bg)',padding:'2px 8px',borderRadius:8}}>{s.cat}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ── Known Subscription Services Database ─────────────────────
const KNOWN_SUBSCRIPTIONS = [
  // Streaming
  {keywords:['netflix'],name:'Netflix',category:'Streaming'},
  {keywords:['hulu'],name:'Hulu',category:'Streaming'},
  {keywords:['disney','disneyplus','disney+'],name:'Disney+',category:'Streaming'},
  {keywords:['hbo','max','hbomax'],name:'HBO Max',category:'Streaming'},
  {keywords:['peacock'],name:'Peacock',category:'Streaming'},
  {keywords:['paramount','paramount+'],name:'Paramount+',category:'Streaming'},
  {keywords:['appletv','apple tv'],name:'Apple TV+',category:'Streaming'},
  {keywords:['youtube premium','youtubepremium'],name:'YouTube Premium',category:'Streaming'},
  {keywords:['espn','espn+'],name:'ESPN+',category:'Streaming'},
  {keywords:['fubo','fubotv'],name:'FuboTV',category:'Streaming'},
  {keywords:['sling'],name:'Sling TV',category:'Streaming'},
  {keywords:['discovery+','discoveryplus'],name:'Discovery+',category:'Streaming'},
  {keywords:['showtime'],name:'Showtime',category:'Streaming'},
  {keywords:['starz'],name:'Starz',category:'Streaming'},
  // Music
  {keywords:['spotify'],name:'Spotify',category:'Music'},
  {keywords:['apple music','applemusic'],name:'Apple Music',category:'Music'},
  {keywords:['tidal'],name:'Tidal',category:'Music'},
  {keywords:['pandora'],name:'Pandora',category:'Music'},
  {keywords:['amazon music','amazonmusic'],name:'Amazon Music',category:'Music'},
  {keywords:['siriusxm','sirius xm'],name:'SiriusXM',category:'Music'},
  {keywords:['deezer'],name:'Deezer',category:'Music'},
  {keywords:['soundcloud'],name:'SoundCloud',category:'Music'},
  // Gaming
  {keywords:['xbox','xboxgamepass','xbox game pass'],name:'Xbox Game Pass',category:'Gaming'},
  {keywords:['playstation','psplus','ps plus','playstation plus'],name:'PlayStation Plus',category:'Gaming'},
  {keywords:['nintendo','nintendo online'],name:'Nintendo Online',category:'Gaming'},
  {keywords:['ea play','eaplay'],name:'EA Play',category:'Gaming'},
  {keywords:['steam'],name:'Steam',category:'Gaming'},
  {keywords:['twitch'],name:'Twitch',category:'Gaming'},
  // Fitness
  {keywords:['peloton'],name:'Peloton',category:'Fitness'},
  {keywords:['planet fitness','planetfitness'],name:'Planet Fitness',category:'Fitness'},
  {keywords:["gold's gym",'golds gym','goldsgym'],name:"Gold's Gym",category:'Fitness'},
  {keywords:['anytime fitness','anytimefitness'],name:'Anytime Fitness',category:'Fitness'},
  {keywords:['beachbody'],name:'Beachbody',category:'Fitness'},
  {keywords:['myfitnesspal'],name:'MyFitnessPal',category:'Fitness'},
  {keywords:['noom'],name:'Noom',category:'Fitness'},
  {keywords:['fitbit'],name:'Fitbit Premium',category:'Fitness'},
  {keywords:['crunch'],name:'Crunch Fitness',category:'Fitness'},
  {keywords:['la fitness','lafitness'],name:'LA Fitness',category:'Fitness'},
  {keywords:['equinox'],name:'Equinox',category:'Fitness'},
  // Software & Productivity
  {keywords:['adobe','adobe creative','adobe cc'],name:'Adobe Creative Cloud',category:'Software'},
  {keywords:['microsoft 365','microsoft365','office 365','office365'],name:'Microsoft 365',category:'Software'},
  {keywords:['dropbox'],name:'Dropbox',category:'Software'},
  {keywords:['google one','googleone'],name:'Google One',category:'Software'},
  {keywords:['icloud'],name:'iCloud Storage',category:'Software'},
  {keywords:['canva'],name:'Canva',category:'Software'},
  {keywords:['zoom'],name:'Zoom',category:'Software'},
  {keywords:['slack'],name:'Slack',category:'Software'},
  {keywords:['notion'],name:'Notion',category:'Software'},
  {keywords:['grammarly'],name:'Grammarly',category:'Software'},
  {keywords:['lastpass'],name:'LastPass',category:'Software'},
  {keywords:['1password'],name:'1Password',category:'Software'},
  {keywords:['nordvpn','nord vpn'],name:'NordVPN',category:'Software'},
  {keywords:['expressvpn','express vpn'],name:'ExpressVPN',category:'Software'},
  {keywords:['quickbooks'],name:'QuickBooks',category:'Software'},
  // Food & Delivery
  {keywords:['doordash','door dash'],name:'DoorDash',category:'Food / Delivery'},
  {keywords:['hellofresh','hello fresh'],name:'HelloFresh',category:'Food / Delivery'},
  {keywords:['instacart'],name:'Instacart',category:'Food / Delivery'},
  {keywords:['factor','factor75'],name:'Factor Meals',category:'Food / Delivery'},
  {keywords:['every plate','everyplate'],name:'Every Plate',category:'Food / Delivery'},
  {keywords:['blue apron','blueapron'],name:'Blue Apron',category:'Food / Delivery'},
  {keywords:['freshly'],name:'Freshly',category:'Food / Delivery'},
  {keywords:['grubhub'],name:'Grubhub',category:'Food / Delivery'},
  {keywords:['ubereats','uber eats'],name:'Uber Eats',category:'Food / Delivery'},
  // News & Education
  {keywords:['new york times','nytimes','nyt'],name:'New York Times',category:'News'},
  {keywords:['washington post','washpost'],name:'Washington Post',category:'News'},
  {keywords:['wall street journal','wsj'],name:'Wall Street Journal',category:'News'},
  {keywords:['duolingo'],name:'Duolingo',category:'Education'},
  {keywords:['masterclass'],name:'MasterClass',category:'Education'},
  {keywords:['skillshare'],name:'Skillshare',category:'Education'},
  {keywords:['coursera'],name:'Coursera',category:'Education'},
  {keywords:['audible'],name:'Audible',category:'Education'},
  {keywords:['scribd'],name:'Scribd',category:'Education'},
  {keywords:['headspace'],name:'Headspace',category:'Education'},
  {keywords:['calm'],name:'Calm',category:'Education'},
  {keywords:['babbel'],name:'Babbel',category:'Education'},
  // Identity & Security
  {keywords:['lifelock','life lock'],name:'LifeLock',category:'Other'},
  {keywords:['identity guard','identityguard'],name:'Identity Guard',category:'Other'},
  {keywords:['aura'],name:'Aura',category:'Other'},
  {keywords:['norton'],name:'Norton Security',category:'Other'},
  {keywords:['mcafee'],name:'McAfee',category:'Other'},
  {keywords:['experian'],name:'Experian',category:'Other'},
  // Shopping & Other
  {keywords:['amazon prime','amazon.com','amazonprime'],name:'Amazon Prime',category:'Other'},
  {keywords:['linkedin','linkedin premium'],name:'LinkedIn Premium',category:'Other'},
  {keywords:['chatgpt','openai'],name:'ChatGPT Plus',category:'Software'},
  {keywords:['midjourney'],name:'Midjourney',category:'Software'},
  {keywords:['claude','anthropic'],name:'Claude AI',category:'Software'},
  {keywords:['patreon'],name:'Patreon',category:'Other'},
  {keywords:['onlyfans'],name:'OnlyFans',category:'Other'},
  {keywords:['bumble','tinder','match.com','eharmony'],name:'Dating App',category:'Other'},
  {keywords:['stitch fix','stitchfix'],name:'Stitch Fix',category:'Other'},
  {keywords:['birchbox'],name:'Birchbox',category:'Other'},
  {keywords:['ipsy'],name:'IPSY',category:'Other'},
  // Hurdlr
  {keywords:['hurdlr'],name:'Hurdlr',category:'Software'},
  // AI Tools
  {keywords:['gemini','gemini advanced'],name:'Gemini Advanced',category:'Software'},
  {keywords:['copilot pro','copilot'],name:'Copilot Pro',category:'Software'},
  {keywords:['jasper','jasper ai'],name:'Jasper AI',category:'Software'},
  {keywords:['copy.ai','copyai'],name:'Copy.ai',category:'Software'},
  {keywords:['perplexity'],name:'Perplexity AI',category:'Software'},
  {keywords:['runway','runwayml'],name:'Runway ML',category:'Software'},
  {keywords:['elevenlabs'],name:'ElevenLabs',category:'Software'},
  {keywords:['synthesia'],name:'Synthesia',category:'Software'},
  // Social & Content
  {keywords:['youtubetv','youtube tv'],name:'YouTube TV',category:'Streaming'},
  {keywords:['substack'],name:'Substack',category:'News'},
  {keywords:['medium'],name:'Medium',category:'News'},
  {keywords:['beehiiv'],name:'Beehiiv',category:'Software'},
  {keywords:['x premium','twitter blue','twitter'],name:'X Premium',category:'Software'},
  // Business Tools
  {keywords:['hubspot'],name:'HubSpot',category:'Software'},
  {keywords:['mailchimp'],name:'Mailchimp',category:'Software'},
  {keywords:['activecampaign'],name:'ActiveCampaign',category:'Software'},
  {keywords:['gohighlevel','highlevel','go high level'],name:'GoHighLevel',category:'Software'},
  {keywords:['constant contact','constantcontact'],name:'Constant Contact',category:'Software'},
  {keywords:['convertkit'],name:'ConvertKit',category:'Software'},
  {keywords:['klaviyo'],name:'Klaviyo',category:'Software'},
  {keywords:['calendly'],name:'Calendly',category:'Software'},
  {keywords:['hootsuite'],name:'Hootsuite',category:'Software'},
  {keywords:['buffer'],name:'Buffer',category:'Software'},
  {keywords:['zapier'],name:'Zapier',category:'Software'},
  {keywords:['monday.com','monday com'],name:'Monday.com',category:'Software'},
  {keywords:['asana'],name:'Asana',category:'Software'},
  {keywords:['clickup'],name:'ClickUp',category:'Software'},
  {keywords:['freshbooks'],name:'FreshBooks',category:'Software'},
  {keywords:['gusto'],name:'Gusto',category:'Software'},
  {keywords:['docusign'],name:'DocuSign',category:'Software'},
  // Photo & Design
  {keywords:['lightroom','adobe lightroom'],name:'Adobe Lightroom',category:'Software'},
  {keywords:['shutterstock'],name:'Shutterstock',category:'Software'},
  {keywords:['envato'],name:'Envato',category:'Software'},
  {keywords:['picmonkey'],name:'PicMonkey',category:'Software'},
  {keywords:['visme'],name:'Visme',category:'Software'},
  // Education
  {keywords:['udemy'],name:'Udemy',category:'Education'},
  {keywords:['linkedin learning'],name:'LinkedIn Learning',category:'Education'},
  {keywords:['rosetta stone','rosettastone'],name:'Rosetta Stone',category:'Education'},
  {keywords:['chegg'],name:'Chegg',category:'Education'},
  {keywords:['italki'],name:'iTalki',category:'Education'},
  // Health & Wellness
  {keywords:['teladoc'],name:'Teladoc',category:'Fitness'},
  {keywords:['mdlive'],name:'MDLive',category:'Fitness'},
  {keywords:['weight watchers','weightwatchers','ww.com'],name:'WW (Weight Watchers)',category:'Fitness'},
  {keywords:['daily burn','dailyburn'],name:'Daily Burn',category:'Fitness'},
  // Shopping & Boxes
  {keywords:['walmart plus','walmart+'],name:'Walmart+',category:'Other'},
  {keywords:['sams club',"sam's club"],name:"Sam's Club",category:'Other'},
  {keywords:['fabfitfun'],name:'FabFitFun',category:'Other'},
  {keywords:['thrive market','thrivemarket'],name:'Thrive Market',category:'Other'},
  {keywords:['sunbasket'],name:'Sunbasket',category:'Food / Delivery'},
  {keywords:['green chef','greenchef'],name:'Green Chef',category:'Food / Delivery'},
  {keywords:['gobble'],name:'Gobble',category:'Food / Delivery'},
  // Entertainment
  {keywords:['crunchyroll'],name:'Crunchyroll',category:'Streaming'},
  {keywords:['shudder'],name:'Shudder',category:'Streaming'},
  {keywords:['britbox'],name:'BritBox',category:'Streaming'},
  {keywords:['acorn tv','acorntv'],name:'Acorn TV',category:'Streaming'},
  {keywords:['amc+','amc plus'],name:'AMC+',category:'Streaming'},
  {keywords:['mubi'],name:'Mubi',category:'Streaming'},
  // Finance
  {keywords:['ynab','you need a budget'],name:'YNAB',category:'Software'},
  {keywords:['acorns'],name:'Acorns',category:'Software'},
  {keywords:['robinhood gold'],name:'Robinhood Gold',category:'Software'},
  // Communication
  {keywords:['google workspace','gsuite','g suite'],name:'Google Workspace',category:'Software'},
  {keywords:['grasshopper'],name:'Grasshopper',category:'Software'},
  {keywords:['ringcentral'],name:'RingCentral',category:'Software'},
  {keywords:['openphone'],name:'OpenPhone',category:'Software'},
  {keywords:['nextiva'],name:'Nextiva',category:'Software'},
  {keywords:['magicjack'],name:'MagicJack',category:'Software'},
  {keywords:['ooma'],name:'Ooma',category:'Software'},
  // Security & Privacy
  {keywords:['bitdefender'],name:'Bitdefender',category:'Software'},
  {keywords:['malwarebytes'],name:'Malwarebytes',category:'Software'},
  // Auto & Travel
  {keywords:['onstar'],name:'OnStar',category:'Other'},
  {keywords:['aaa'],name:'AAA',category:'Other'},
  {keywords:['clear'],name:'CLEAR',category:'Other'},
  {keywords:['tripit'],name:'TripIt Pro',category:'Other'},
];

// ── Known Fixed Bills Database ────────────────────────────────
const KNOWN_FIXED_BILLS = [
  // Mortgage
  {keywords:['us bank mortgage','usbank mortgage','us bank home'],name:'US Bank Mortgage',category:'Mortgage / rent'},
  {keywords:['rocket mortgage','quicken loans'],name:'Rocket Mortgage',category:'Mortgage / rent'},
  {keywords:['mr cooper','nationstar'],name:'Mr. Cooper Mortgage',category:'Mortgage / rent'},
  {keywords:['wells fargo home','wells fargo mortgage'],name:'Wells Fargo Mortgage',category:'Mortgage / rent'},
  {keywords:['chase mortgage','jpmorgan mortgage'],name:'Chase Mortgage',category:'Mortgage / rent'},
  {keywords:['loandepot'],name:'LoanDepot',category:'Mortgage / rent'},
  {keywords:['freedom mortgage'],name:'Freedom Mortgage',category:'Mortgage / rent'},
  {keywords:['pennymac'],name:'PennyMac',category:'Mortgage / rent'},
  {keywords:['caliber home'],name:'Caliber Home Loans',category:'Mortgage / rent'},
  {keywords:['newrez'],name:'NewRez Mortgage',category:'Mortgage / rent'},
  {keywords:['phh mortgage'],name:'PHH Mortgage',category:'Mortgage / rent'},
  // Electric
  {keywords:['evergy'],name:'Evergy Electric',category:'Electric bill'},
  {keywords:['duke energy'],name:'Duke Energy',category:'Electric bill'},
  {keywords:['comed'],name:'ComEd Electric',category:'Electric bill'},
  {keywords:['georgia power'],name:'Georgia Power',category:'Electric bill'},
  {keywords:['dominion energy'],name:'Dominion Energy',category:'Electric bill'},
  {keywords:['xcel energy'],name:'Xcel Energy',category:'Electric bill'},
  {keywords:['fpl','florida power'],name:'FPL Electric',category:'Electric bill'},
  {keywords:['entergy'],name:'Entergy',category:'Electric bill'},
  {keywords:['aep','american electric power'],name:'AEP Electric',category:'Electric bill'},
  {keywords:['ameren'],name:'Ameren Electric',category:'Electric bill'},
  {keywords:['eversource'],name:'Eversource Energy',category:'Electric bill'},
  {keywords:['national grid'],name:'National Grid',category:'Electric bill'},
  {keywords:['pge','pg&e','pacific gas'],name:'PG&E',category:'Electric bill'},
  {keywords:['puget sound energy'],name:'Puget Sound Energy',category:'Electric bill'},
  {keywords:['srp','salt river project'],name:'SRP Electric',category:'Electric bill'},
  // Gas/Heat
  {keywords:['atmos energy','atmos'],name:'Atmos Energy',category:'Gas / heat bill'},
  {keywords:['spire gas','spire mo'],name:'Spire Gas',category:'Gas / heat bill'},
  {keywords:['centerpoint','center point'],name:'CenterPoint Energy',category:'Gas / heat bill'},
  {keywords:['peoples gas','peoples natural'],name:'Peoples Gas',category:'Gas / heat bill'},
  {keywords:['nicor gas','nicor'],name:'Nicor Gas',category:'Gas / heat bill'},
  {keywords:['laclede gas'],name:'Laclede Gas',category:'Gas / heat bill'},
  {keywords:['southwest gas'],name:'Southwest Gas',category:'Gas / heat bill'},
  // Internet
  {keywords:['google fiber','googlefiber'],name:'Google Fiber',category:'Internet'},
  {keywords:['xfinity','comcast'],name:'Xfinity/Comcast',category:'Internet'},
  {keywords:['spectrum','charter'],name:'Spectrum Internet',category:'Internet'},
  {keywords:['att fiber','at&t fiber','att internet'],name:'AT&T Fiber',category:'Internet'},
  {keywords:['cox communications','cox cable'],name:'Cox Internet',category:'Internet'},
  {keywords:['centurylink','lumen'],name:'CenturyLink',category:'Internet'},
  {keywords:['wow internet','wowway'],name:'WOW Internet',category:'Internet'},
  {keywords:['mediacom'],name:'Mediacom',category:'Internet'},
  {keywords:['starlink'],name:'Starlink',category:'Internet'},
  {keywords:['earthlink'],name:'EarthLink',category:'Internet'},
  {keywords:['hughesnet'],name:'HughesNet',category:'Internet'},
  // Phone
  {keywords:['at&t','att wireless','att mobility'],name:'AT&T Wireless',category:'Phone bill'},
  {keywords:['verizon wireless','verizon'],name:'Verizon Wireless',category:'Phone bill'},
  {keywords:['t-mobile','tmobile'],name:'T-Mobile',category:'Phone bill'},
  {keywords:['metro pcs','metropcs','metro by t'],name:'Metro PCS',category:'Phone bill'},
  {keywords:['cricket wireless','cricket'],name:'Cricket Wireless',category:'Phone bill'},
  {keywords:['boost mobile','boostmobile'],name:'Boost Mobile',category:'Phone bill'},
  {keywords:['us cellular','uscellular'],name:'US Cellular',category:'Phone bill'},
  {keywords:['consumer cellular'],name:'Consumer Cellular',category:'Phone bill'},
  {keywords:['mint mobile','mintmobile'],name:'Mint Mobile',category:'Phone bill'},
  // Auto Loans
  {keywords:['toyota financial','toyota motor credit'],name:'Toyota Financial',category:'Car payment'},
  {keywords:['honda financial','american honda finance'],name:'Honda Financial',category:'Car payment'},
  {keywords:['ford credit','ford motor credit'],name:'Ford Motor Credit',category:'Car payment'},
  {keywords:['gm financial','gmfinancial'],name:'GM Financial',category:'Car payment'},
  {keywords:['ally auto','ally financial'],name:'Ally Auto',category:'Car payment'},
  {keywords:['capital one auto'],name:'Capital One Auto',category:'Car payment'},
  {keywords:['chrysler capital'],name:'Chrysler Capital',category:'Car payment'},
  {keywords:['hyundai motor finance'],name:'Hyundai Motor Finance',category:'Car payment'},
  {keywords:['kia motors finance','kia finance'],name:'Kia Motors Finance',category:'Car payment'},
  {keywords:['nissan motor','nmac'],name:'Nissan Motor Finance',category:'Car payment'},
  {keywords:['subaru motors','subaru finance'],name:'Subaru Motors Finance',category:'Car payment'},
  {keywords:['carmax auto'],name:'CarMax Auto Finance',category:'Car payment'},
  {keywords:['community america','communityamerica'],name:'Community America Auto',category:'Car payment'},
  // Student Loans
  {keywords:['navient'],name:'Navient Student Loan',category:'Student loan'},
  {keywords:['sallie mae','salliemae'],name:'Sallie Mae',category:'Student loan'},
  {keywords:['nelnet'],name:'Nelnet Student Loan',category:'Student loan'},
  {keywords:['fedloan','fed loan'],name:'FedLoan Servicing',category:'Student loan'},
  {keywords:['mohela'],name:'MOHELA Student Loan',category:'Student loan'},
  {keywords:['edfinancial'],name:'EdFinancial',category:'Student loan'},
  {keywords:['great lakes','greatlakes'],name:'Great Lakes Loans',category:'Student loan'},
  // Credit Cards
  {keywords:['chase card','chase sapphire','chase freedom'],name:'Chase Credit Card',category:'Credit card payment'},
  {keywords:['bank of america card','bofa card'],name:'Bank of America Card',category:'Credit card payment'},
  {keywords:['citi card','citibank card','citicard'],name:'Citi Credit Card',category:'Credit card payment'},
  {keywords:['capital one card','capital one payment'],name:'Capital One Card',category:'Credit card payment'},
  {keywords:['discover card','discover payment'],name:'Discover Card',category:'Credit card payment'},
  {keywords:['american express','amex'],name:'American Express',category:'Credit card payment'},
  {keywords:['synchrony','synchrony bank'],name:'Synchrony Bank',category:'Credit card payment'},
  {keywords:['barclays'],name:'Barclays Card',category:'Credit card payment'},
  {keywords:['wells fargo card','wells fargo visa'],name:'Wells Fargo Card',category:'Credit card payment'},
  {keywords:['community america credit','communityamerica credit'],name:'Community America Credit Card',category:'Credit card payment'},
  // Insurance
  {keywords:['primerica life','primerica insurance'],name:'Primerica Life Insurance',category:'Life insurance'},
  {keywords:['primerica invest','primerica financial'],name:'Primerica Investments',category:'Other insurance'},
  {keywords:['state farm'],name:'State Farm Insurance',category:'Auto insurance'},
  {keywords:['allstate'],name:'Allstate Insurance',category:'Auto insurance'},
  {keywords:['geico'],name:'Geico Insurance',category:'Auto insurance'},
  {keywords:['progressive'],name:'Progressive Insurance',category:'Auto insurance'},
  {keywords:['usaa'],name:'USAA Insurance',category:'Auto insurance'},
  {keywords:['farmers insurance','farmers'],name:'Farmers Insurance',category:'Auto insurance'},
  {keywords:['liberty mutual'],name:'Liberty Mutual',category:'Auto insurance'},
  {keywords:['nationwide'],name:'Nationwide Insurance',category:'Auto insurance'},
  {keywords:['travelers'],name:'Travelers Insurance',category:'Auto insurance'},
  {keywords:['erie insurance'],name:'Erie Insurance',category:'Auto insurance'},
  {keywords:['metlife'],name:'MetLife Insurance',category:'Life insurance'},
  {keywords:['new york life','newyorklife'],name:'New York Life',category:'Life insurance'},
  {keywords:['northwestern mutual'],name:'Northwestern Mutual',category:'Life insurance'},
  {keywords:['aflac'],name:'Aflac Insurance',category:'Health insurance'},
  {keywords:['cigna'],name:'Cigna Health',category:'Health insurance'},
  {keywords:['unitedhealth','united health','uhc'],name:'UnitedHealth',category:'Health insurance'},
  {keywords:['anthem'],name:'Anthem Health',category:'Health insurance'},
  {keywords:['blue cross','bluecross','bcbs'],name:'Blue Cross Blue Shield',category:'Health insurance'},
  {keywords:['humana'],name:'Humana',category:'Health insurance'},
  {keywords:['aetna'],name:'Aetna Health',category:'Health insurance'},
  // Government/Tax
  {keywords:['irs','internal revenue'],name:'IRS Payment',category:'Other'},
  {keywords:['state tax','dept of revenue','department of revenue'],name:'State Tax Payment',category:'Other'},
  {keywords:['county tax','property tax'],name:'Property Tax',category:'Other'},
  // Water
  {keywords:['kansas city water','kc water'],name:'Kansas City Water',category:'Water bill'},
  {keywords:['city utilities','city water','municipal water'],name:'City Water Utility',category:'Water bill'},
  {keywords:['water department','water dept'],name:'Water Department',category:'Water bill'},
  // HOA
  {keywords:['hoa','homeowners association','community management','property management'],name:'HOA Payment',category:'HOA fee'},
  // Childcare
  {keywords:['kindercare','kinder care'],name:'KinderCare',category:'Childcare / daycare'},
  {keywords:['bright horizons','brighthorizons'],name:'Bright Horizons',category:'Childcare / daycare'},
  {keywords:['la petite','lapetite'],name:'La Petite Academy',category:'Childcare / daycare'},
  {keywords:['primrose school','primrose'],name:'Primrose Schools',category:'Childcare / daycare'},
  // Gym/Fitness memberships (fixed)
  {keywords:['ymca','the y'],name:'YMCA',category:'Gym membership'},
  {keywords:['lifetime fitness','life time'],name:'Life Time Fitness',category:'Gym membership'},
];

function detectFixedBills(transactions){
  const found=[];
  const seen=new Set();
  transactions.forEach(tx=>{
    if(tx.type!=='debit')return;
    const desc=(tx.desc||'').toLowerCase();
    KNOWN_FIXED_BILLS.forEach(bill=>{
      const match=bill.keywords.some(kw=>desc.includes(kw.toLowerCase()));
      if(match&&!seen.has(bill.name)){
        seen.add(bill.name);
        found.push({
          id:Date.now()+Math.random(),
          name:bill.name,
          amount:tx.amt,
          dueDay:new Date(tx.date+'T00:00:00').getDate()||1,
          category:bill.category,
          autopay:false,
          createdAt:new Date().toISOString(),
          detected:true,
        });
      }
    });
  });
  return found;
}


function detectSubscriptions(transactions){
  const found=[];
  const seen=new Set();
  transactions.forEach(tx=>{
    if(tx.type!=='debit')return;
    const desc=(tx.desc||'').toLowerCase();
    KNOWN_SUBSCRIPTIONS.forEach(sub=>{
      const match=sub.keywords.some(kw=>desc.includes(kw.toLowerCase()));
      if(match&&!seen.has(sub.name)){
        seen.add(sub.name);
        found.push({
          id:Date.now()+Math.random(),
          name:sub.name,
          amount:tx.amt,
          cycle:'monthly',
          category:sub.category,
          dueDay:new Date(tx.date+'T00:00:00').getDate()||1,
          autopay:true,
          subsPaid:{},
          detected:true,
        });
      }
    });
  });
  return found;
}


function DropZone({onFile}){
  const [dragging,setDragging]=useState(false);
  const id='csv-file-input-'+Math.random().toString(36).slice(2);

  const handleDrop=e=>{
    e.preventDefault();
    setDragging(false);
    const file=e.dataTransfer.files[0];
    if(file&&(file.name.endsWith('.csv')||file.type==='text/csv')){
      const event={target:{files:[file]}};
      onFile(event);
    } else {
      alert('Please drop a CSV file.');
    }
  };

  const handleDragOver=e=>{e.preventDefault();e.stopPropagation();setDragging(true);};
  const handleDragLeave=e=>{e.preventDefault();setDragging(false);};

  return(
    <label
      htmlFor="csv-upload"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        display:'block',
        background:dragging?'var(--green-light)':'#f8faff',
        border:`2px dashed ${dragging?'var(--green)':'var(--border)'}`,
        borderRadius:'var(--radius-lg)',
        padding:'2.5rem 2rem',
        textAlign:'center',
        marginBottom:'1.25rem',
        cursor:'pointer',
        transition:'all 0.2s',
        transform:dragging?'scale(1.01)':'scale(1)',
      }}
    >
      <div style={{fontSize:40,marginBottom:10}}>{dragging?'📂':'⬆️'}</div>
      <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:15,color:'var(--green)',marginBottom:6}}>
        {dragging?'Drop your CSV file here!':'Drag & drop your CSV file here'}
      </div>
      <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:10}}>or</div>
      <div style={{display:'inline-block',background:'var(--green)',color:'#fff',fontFamily:'var(--font-display)',fontWeight:700,fontSize:12,padding:'8px 20px',borderRadius:'var(--radius-md)',pointerEvents:'none'}}>
        Browse files
      </div>
      <div style={{fontSize:11,color:'var(--text-muted)',marginTop:10}}>Supports CSV files from any bank</div>
      <input id="csv-upload" type="file" accept=".csv,text/csv" onChange={onFile} style={{display:'none'}}/>
    </label>
  );
}


function CSVImportModal({onImport,onCancel,existingTransactions,accounts,defaultAccount,onAddSubscriptions,onAddFixedBills}){
  const [step,setStep]=useState('upload'); // upload | map | preview | subs | bills | done
  const [rawRows,setRawRows]=useState([]);
  const [headers,setHeaders]=useState([]);
  const [mapping,setMapping]=useState({date:'',description:'',amount:'',debit:'',credit:''});
  const [mappingType,setMappingType]=useState('single'); // single=one amount col, split=debit+credit cols
  const [preview,setPreview]=useState([]);
  const [duplicates,setDuplicates]=useState(0);
  const [importing,setImporting]=useState(false);
  const [fileName,setFileName]=useState('');
  const [selectedAccount,setSelectedAccount]=useState(defaultAccount||Object.keys(accounts||{})[0]||'main');
  const [detectedSubs,setDetectedSubs]=useState([]);
  const [selectedSubIds,setSelectedSubIds]=useState([]);
  const [subTargetAccount,setSubTargetAccount]=useState(defaultAccount||'main');
  const [detectedBills,setDetectedBills]=useState([]);
  const [selectedBillIds,setSelectedBillIds]=useState([]);
  const [billTargetAccount,setBillTargetAccount]=useState(defaultAccount||'main');

  const parseCSV=(text)=>{
    const lines=text.split(/\r?\n/).filter(l=>l.trim());
    const headers=lines[0].split(',').map(h=>h.replace(/"/g,'').trim());
    const rows=lines.slice(1).map(line=>{
      const cols=[];let cur='';let inQ=false;
      for(let i=0;i<line.length;i++){
        if(line[i]==='"'){inQ=!inQ;}
        else if(line[i]===','&&!inQ){cols.push(cur.trim());cur='';}
        else cur+=line[i];
      }
      cols.push(cur.trim());
      return cols;
    }).filter(r=>r.length>1&&r.some(c=>c.trim()));
    return{headers,rows};
  };

  const handleFile=(e)=>{
    const file=e.target.files[0];
    if(!file)return;
    setFileName(file.name);
    const reader=new FileReader();
    reader.onload=(ev)=>{
      const{headers,rows}=parseCSV(ev.target.result);
      setHeaders(headers);
      setRawRows(rows);
      // Auto-detect common column names
      const lower=headers.map(h=>h.toLowerCase());
      const autoMap={date:'',description:'',amount:'',debit:'',credit:''};
      headers.forEach((h,i)=>{
        const l=h.toLowerCase();
        if(l.includes('date'))autoMap.date=h;
        if(l.includes('desc')||l.includes('memo')||l.includes('narr')||l.includes('payee')||l.includes('transaction'))autoMap.description=h;
        if(l.includes('amount')&&!l.includes('debit')&&!l.includes('credit'))autoMap.amount=h;
        if(l.includes('debit')||l.includes('withdrawal'))autoMap.debit=h;
        if(l.includes('credit')||l.includes('deposit'))autoMap.credit=h;
      });
      // Detect if split debit/credit
      if(autoMap.debit&&autoMap.credit){setMappingType('split');}
      setMapping(autoMap);
      setStep('map');
    };
    reader.readAsText(file);
  };

  const buildPreview=()=>{
    const results=[];
    rawRows.forEach((row,idx)=>{
      const getValue=(col)=>{
        const i=headers.indexOf(col);
        return i>=0?(row[i]||'').replace(/"/g,'').trim():'';
      };
      const dateStr=getValue(mapping.date);
      const desc=getValue(mapping.description);
      if(!dateStr||!desc)return;
      // Parse date
      let date='';
      const d=new Date(dateStr);
      if(!isNaN(d.getTime())){
        date=d.toISOString().split('T')[0];
      } else {
        // Try MM/DD/YYYY
        const parts=dateStr.split(/[\/\-\.]/);
        if(parts.length===3){
          const yr=parts[2].length===4?parts[2]:'20'+parts[2];
          date=`${yr}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
        }
      }
      if(!date)return;
      let amt=0;let type='debit';
      if(mappingType==='split'){
        const deb=parseFloat(getValue(mapping.debit).replace(/[$,]/g,''))||0;
        const cred=parseFloat(getValue(mapping.credit).replace(/[$,]/g,''))||0;
        if(cred>0){amt=cred;type='credit';}
        else if(deb>0){amt=deb;type='debit';}
        else return;
      } else {
        const raw=parseFloat(getValue(mapping.amount).replace(/[$,]/g,''))||0;
        if(raw===0)return;
        if(raw<0){amt=Math.abs(raw);type='debit';}
        else{amt=raw;type='credit';}
      }
      // Duplicate check
      const isDup=existingTransactions.some(t=>t.date===date&&Math.abs(t.amt-amt)<0.01&&t.desc.toLowerCase()===desc.toLowerCase());
      results.push({id:Date.now()+idx,date,desc,amt,type,grp:'',cat:'',note:'',refNum:'',recurring:'none',isDup});
    });
    const dups=results.filter(r=>r.isDup).length;
    setDuplicates(dups);
    setPreview(results);
    setStep('preview');
  };

  const handleImport=()=>{
    setImporting(true);
    const toImport=preview.filter(r=>!r.isDup).map(({isDup,...r})=>r);
    setTimeout(()=>{
      onImport(toImport,selectedAccount);
      // Detect subscriptions from imported transactions
      const detectedS=detectSubscriptions(toImport);
      const detectedB=detectFixedBills(toImport);
      if(detectedS.length>0){
        setDetectedSubs(detectedS);
        setSelectedSubIds(detectedS.map(s=>s.id));
        setSubTargetAccount(selectedAccount||defaultAccount||'main');
        setDetectedBills(detectedB);
        setSelectedBillIds(detectedB.map(b=>b.id));
        setBillTargetAccount(selectedAccount||defaultAccount||'main');
        setImporting(false);
        setStep('subs');
      } else if(detectedB.length>0){
        setDetectedBills(detectedB);
        setSelectedBillIds(detectedB.map(b=>b.id));
        setBillTargetAccount(selectedAccount||defaultAccount||'main');
        setImporting(false);
        setStep('bills');
      } else {
        setStep('done');
        setImporting(false);
      }
    },500);
  };

  return(
    <div className="modal-overlay" style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}} onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div className="modal-box slide-up" style={{maxWidth:580,maxHeight:'85vh',overflow:'auto'}}>
        
        {step==='upload'&&(
          <>
            <div style={{textAlign:'center',marginBottom:'1.5rem'}}>
              <div style={{fontSize:40,marginBottom:10}}>📂</div>
              <h2 style={{fontFamily:'var(--font-display)',fontSize:22,marginBottom:8,color:'var(--text-primary)'}}>Import Bank Statement</h2>
              <p style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.6}}>Download your bank statement as a CSV file and upload it here. MoneyMap will automatically read your transactions.</p>
            </div>
            <DropZone onFile={handleFile} />
            <div style={{background:'var(--green-light)',border:'1px solid var(--green-mid)',borderRadius:'var(--radius-md)',padding:'12px 14px',marginBottom:'1.25rem'}}>
              <div style={{fontSize:12,fontWeight:600,color:'var(--green)',marginBottom:6}}>💡 How to get your CSV file:</div>
              <div style={{fontSize:12,color:'var(--slate)',lineHeight:1.8}}>
                Log into your bank → Statements or Transaction History → Download → Choose CSV format
              </div>
            </div>
            <button className="btn-outline" style={{width:'100%'}} onClick={onCancel}>Cancel</button>
          </>
        )}

        {step==='map'&&(
          <>
            <div style={{marginBottom:'1.25rem'}}>
              <h2 style={{fontFamily:'var(--font-display)',fontSize:20,marginBottom:6,color:'var(--text-primary)'}}>Map Your Columns</h2>
              <p style={{fontSize:13,color:'var(--text-muted)'}}>File: <strong>{fileName}</strong> — {rawRows.length} rows found. Tell us which columns contain your data.</p>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:500}}>Amount format</label>
              <div style={{display:'flex',gap:10,marginBottom:12}}>
                <button onClick={()=>setMappingType('single')} style={{flex:1,padding:'8px',fontSize:12,fontWeight:600,borderRadius:'var(--radius-md)',border:`1px solid ${mappingType==='single'?'var(--green)':'var(--border)'}`,background:mappingType==='single'?'var(--green-light)':'transparent',color:mappingType==='single'?'var(--green)':'var(--text-muted)',cursor:'pointer'}}>
                  Single amount column
                </button>
                <button onClick={()=>setMappingType('split')} style={{flex:1,padding:'8px',fontSize:12,fontWeight:600,borderRadius:'var(--radius-md)',border:`1px solid ${mappingType==='split'?'var(--green)':'var(--border)'}`,background:mappingType==='split'?'var(--green-light)':'transparent',color:mappingType==='split'?'var(--green)':'var(--text-muted)',cursor:'pointer'}}>
                  Separate debit/credit columns
                </button>
              </div>
            </div>
            {[
              {key:'date',label:'Date column'},
              {key:'description',label:'Description column'},
              ...(mappingType==='single'?[{key:'amount',label:'Amount column'}]:[{key:'debit',label:'Debit / Withdrawal column'},{key:'credit',label:'Credit / Deposit column'}])
            ].map(({key,label})=>(
              <div key={key} style={{marginBottom:10}}>
                <label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:500}}>{label}</label>
                <select value={mapping[key]} onChange={e=>setMapping(m=>({...m,[key]:e.target.value}))}>
                  <option value="">-- Select column --</option>
                  {headers.map(h=><option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
            <div style={{display:'flex',gap:10,marginTop:'1.25rem'}}>
              <button className="btn-outline" style={{flex:1}} onClick={()=>setStep('upload')}>← Back</button>
              <button className="btn-gold" style={{flex:1}} onClick={buildPreview} disabled={!mapping.date||!mapping.description}>
                Preview Transactions →
              </button>
            </div>
          </>
        )}

        {step==='preview'&&(
          <>
            <div style={{marginBottom:'1rem'}}>
              <h2 style={{fontFamily:'var(--font-display)',fontSize:20,marginBottom:6,color:'var(--text-primary)'}}>Preview Import</h2>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <span style={{background:'rgba(22,163,74,0.1)',color:'#16a34a',fontSize:12,fontWeight:600,padding:'3px 10px',borderRadius:10}}>{preview.filter(r=>!r.isDup).length} to import</span>
                {duplicates>0&&<span style={{background:'rgba(217,119,6,0.1)',color:'#d97706',fontSize:12,fontWeight:600,padding:'3px 10px',borderRadius:10}}>{duplicates} duplicates skipped</span>}
              </div>
            </div>
            <div style={{maxHeight:300,overflow:'auto',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',marginBottom:'1rem'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{position:'sticky',top:0,background:'#fafaf8'}}>
                  <th style={{padding:'8px 10px',textAlign:'left',color:'var(--text-muted)',fontWeight:600}}>Date</th>
                  <th style={{padding:'8px 10px',textAlign:'left',color:'var(--text-muted)',fontWeight:600}}>Description</th>
                  <th style={{padding:'8px 10px',textAlign:'right',color:'var(--text-muted)',fontWeight:600}}>Amount</th>
                  <th style={{padding:'8px 10px',textAlign:'center',color:'var(--text-muted)',fontWeight:600}}>Type</th>
                  <th style={{padding:'8px 10px',textAlign:'center',color:'var(--text-muted)',fontWeight:600}}>Status</th>
                </tr></thead>
                <tbody>
                  {preview.map((row,i)=>(
                    <tr key={i} style={{opacity:row.isDup?0.4:1,background:row.isDup?'#fff8f0':'transparent'}}>
                      <td style={{padding:'7px 10px',color:'var(--slate)'}}>{new Date(row.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</td>
                      <td style={{padding:'7px 10px',color:'var(--text-primary)',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.desc}</td>
                      <td style={{padding:'7px 10px',textAlign:'right',fontWeight:600,color:row.type==='credit'?'#16a34a':'#dc2626'}}>${row.amt.toFixed(2)}</td>
                      <td style={{padding:'7px 10px',textAlign:'center'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:8,background:row.type==='credit'?'rgba(22,163,74,0.1)':'rgba(220,38,38,0.1)',color:row.type==='credit'?'#16a34a':'#dc2626'}}>{row.type}</span></td>
                      <td style={{padding:'7px 10px',textAlign:'center'}}>{row.isDup?<span style={{fontSize:10,color:'#d97706',fontWeight:600}}>DUPLICATE</span>:<span style={{fontSize:10,color:'#16a34a',fontWeight:600}}>NEW</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {accounts&&Object.keys(accounts).length>1&&(
              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:6,fontWeight:500}}>Import into which account?</label>
                <select value={selectedAccount} onChange={e=>setSelectedAccount(e.target.value)}>
                  {Object.entries(accounts).map(([key,acct])=>(
                    <option key={key} value={key}>{acct.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{display:'flex',gap:10}}>
              <button className="btn-outline" style={{flex:1}} onClick={()=>setStep('map')}>← Back</button>
              <button className="btn-gold" style={{flex:1}} onClick={handleImport} disabled={importing||preview.filter(r=>!r.isDup).length===0}>
                {importing?'Importing…':'Import '+preview.filter(r=>!r.isDup).length+' Transactions'}
              </button>
            </div>
          </>
        )}

        {step==='subs'&&(
          <>
            <div style={{textAlign:'center',marginBottom:'1.25rem'}}>
              <div style={{fontSize:40,marginBottom:10}}>📱</div>
              <h2 style={{fontFamily:'var(--font-display)',fontSize:20,marginBottom:6,color:'var(--text-primary)'}}>Subscriptions Detected!</h2>
              <p style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.6}}>We found <strong style={{color:'#7c3aed'}}>{detectedSubs.length} possible subscription{detectedSubs.length!==1?'s':''}</strong> in your import. Select which ones to add to your Subscriptions tab.</p>
            </div>
            <div style={{maxHeight:280,overflow:'auto',marginBottom:'1rem'}}>
              {detectedSubs.map(sub=>(
                <div key={sub.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:selectedSubIds.includes(sub.id)?'rgba(124,58,237,0.06)':'#f8faff',border:`1px solid ${selectedSubIds.includes(sub.id)?'rgba(124,58,237,0.2)':'var(--border)'}`,borderRadius:'var(--radius-md)',marginBottom:6,cursor:'pointer'}} onClick={()=>setSelectedSubIds(s=>s.includes(sub.id)?s.filter(i=>i!==sub.id):[...s,sub.id])}>
                  <input type="checkbox" checked={selectedSubIds.includes(sub.id)} onChange={()=>{}} style={{width:15,height:15,accentColor:'#7c3aed',flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:'var(--font-display)',fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>{sub.name}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>{sub.category} · due {sub.dueDay}{['th','st','nd','rd'][sub.dueDay%10]||'th'} · ⚡ Autopay</div>
                  </div>
                  <div style={{fontWeight:700,fontSize:13,color:'#7c3aed',flexShrink:0}}>${sub.amount.toFixed(2)}/mo</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              <button className="btn-outline" style={{fontSize:11,flex:1}} onClick={()=>{setSelectedSubIds(detectedSubs.map(s=>s.id));}}>Select all</button>
              <button className="btn-outline" style={{fontSize:11,flex:1}} onClick={()=>setSelectedSubIds([])}>Deselect all</button>
            </div>
            {accounts&&Object.keys(accounts).length>1&&(
              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:6,fontWeight:500}}>Add subscriptions to which account?</label>
                <select value={subTargetAccount} onChange={e=>setSubTargetAccount(e.target.value)}>
                  {Object.entries(accounts).map(([key,acct])=>(
                    <option key={key} value={key}>{acct.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{display:'flex',gap:10}}>
              <button className="btn-outline" style={{flex:1}} onClick={()=>{if(detectedBills.length>0)setStep('bills');else setStep('done');}}>Skip</button>
              <button className="btn-gold" style={{flex:1,background:'linear-gradient(135deg,#7c3aed,#a78bfa)'}} onClick={()=>{
                const toAdd=detectedSubs.filter(s=>selectedSubIds.includes(s.id)).map(({detected,...s})=>s);
                onAddSubscriptions&&onAddSubscriptions(toAdd,subTargetAccount||selectedAccount);
                if(detectedBills.length>0) setStep('bills');
                else setStep('done');
              }}>
                Add {selectedSubIds.length} Subscription{selectedSubIds.length!==1?'s':''}
              </button>
            </div>
          </>
        )}
        {step==='bills'&&(
          <>
            <div style={{textAlign:'center',marginBottom:'1.25rem'}}>
              <div style={{fontSize:40,marginBottom:10}}>🗓</div>
              <h2 style={{fontFamily:'var(--font-display)',fontSize:20,marginBottom:6,color:'var(--text-primary)'}}>Fixed Bills Detected!</h2>
              <p style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.6}}>We found <strong style={{color:'var(--green)'}}>{detectedBills.length} possible fixed bill{detectedBills.length!==1?'s':''}</strong> in your import. Select which ones to add to your Bills tab.</p>
            </div>
            <div style={{maxHeight:280,overflow:'auto',marginBottom:'1rem'}}>
              {detectedBills.map(bill=>(
                <div key={bill.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:selectedBillIds.includes(bill.id)?'var(--green-light)':'#f8faff',border:`1px solid ${selectedBillIds.includes(bill.id)?'var(--green-mid)':'var(--border)'}`,borderRadius:'var(--radius-md)',marginBottom:6,cursor:'pointer'}} onClick={()=>setSelectedBillIds(s=>s.includes(bill.id)?s.filter(i=>i!==bill.id):[...s,bill.id])}>
                  <input type="checkbox" checked={selectedBillIds.includes(bill.id)} onChange={()=>{}} style={{width:15,height:15,accentColor:'var(--green)',flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:'var(--font-display)',fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>{bill.name}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>{bill.category} · due {bill.dueDay}{['th','st','nd','rd'][bill.dueDay%10]||'th'}</div>
                  </div>
                  <div style={{fontWeight:700,fontSize:13,color:'var(--green)',flexShrink:0}}>${bill.amount.toFixed(2)}/mo</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              <button className="btn-outline" style={{fontSize:11,flex:1}} onClick={()=>setSelectedBillIds(detectedBills.map(b=>b.id))}>Select all</button>
              <button className="btn-outline" style={{fontSize:11,flex:1}} onClick={()=>setSelectedBillIds([])}>Deselect all</button>
            </div>
            {accounts&&Object.keys(accounts).length>1&&(
              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:6,fontWeight:500}}>Add bills to which account?</label>
                <select value={billTargetAccount} onChange={e=>setBillTargetAccount(e.target.value)}>
                  {Object.entries(accounts).map(([key,acct])=>(
                    <option key={key} value={key}>{acct.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{display:'flex',gap:10}}>
              <button className="btn-outline" style={{flex:1}} onClick={()=>setStep('done')}>Skip</button>
              <button className="btn-gold" style={{flex:1}} onClick={()=>{
                const toAdd=detectedBills.filter(b=>selectedBillIds.includes(b.id)).map(({detected,...b})=>b);
                onAddFixedBills&&onAddFixedBills(toAdd,billTargetAccount||selectedAccount);
                setStep('done');
              }}>
                Add {selectedBillIds.length} Bill{selectedBillIds.length!==1?'s':''}
              </button>
            </div>
          </>
        )}
        {step==='done'&&(
          <div style={{textAlign:'center',padding:'1rem 0'}}>
            <div style={{fontSize:52,marginBottom:16}}>🎉</div>
            <h2 style={{fontFamily:'var(--font-display)',fontSize:24,marginBottom:10,color:'var(--text-primary)'}}>Import Complete!</h2>
            <p style={{fontSize:14,color:'var(--text-muted)',lineHeight:1.7,marginBottom:'1.5rem'}}>Your transactions have been imported successfully. Head to the Register tab to assign categories.</p>
            <button className="btn-gold" style={{width:'100%'}} onClick={onCancel}>Go to my Register 📒</button>
          </div>
        )}
      </div>
    </div>
  );
}


function AddToHomeScreenModal({onClose}){
  return(
    <div className="modal-overlay" style={{position:"fixed",inset:0,zIndex:2500,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box slide-up" style={{maxWidth:460}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:28}}>📱</span>
            <h2 style={{fontFamily:'var(--font-display)',fontSize:19,color:'var(--text-primary)'}}>Add App to Your Phone</h2>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:18,cursor:'pointer'}}>✕</button>
        </div>

        <div style={{marginBottom:'1.25rem'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <span style={{fontSize:18}}>🍎</span>
            <span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:14,color:'var(--text-primary)'}}>iPhone / Safari</span>
          </div>
          <ol style={{paddingLeft:20,margin:0}}>
            <li style={{fontSize:13,color:'var(--slate)',lineHeight:1.8,marginBottom:4}}>Open this app in <strong>Safari</strong></li>
            <li style={{fontSize:13,color:'var(--slate)',lineHeight:1.8,marginBottom:4}}>Tap the <strong>Share button</strong> (box with arrow ⬆️)</li>
            <li style={{fontSize:13,color:'var(--slate)',lineHeight:1.8,marginBottom:4}}>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
            <li style={{fontSize:13,color:'var(--slate)',lineHeight:1.8}}>Tap <strong>"Add"</strong> in the top right</li>
          </ol>
        </div>

        <div style={{borderTop:'1px solid var(--border-light)',paddingTop:'1.25rem'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <span style={{fontSize:18}}>🤖</span>
            <span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:14,color:'var(--text-primary)'}}>Android / Chrome</span>
          </div>
          <ol style={{paddingLeft:20,margin:0}}>
            <li style={{fontSize:13,color:'var(--slate)',lineHeight:1.8,marginBottom:4}}>Open this app in <strong>Chrome</strong></li>
            <li style={{fontSize:13,color:'var(--slate)',lineHeight:1.8,marginBottom:4}}>Tap the <strong>three dots menu</strong> (top right ⋮)</li>
            <li style={{fontSize:13,color:'var(--slate)',lineHeight:1.8,marginBottom:4}}>Tap <strong>"Add to Home screen"</strong></li>
            <li style={{fontSize:13,color:'var(--slate)',lineHeight:1.8}}>Tap <strong>"Add"</strong></li>
          </ol>
        </div>

        <button className="btn-gold" style={{width:'100%',marginTop:'1.5rem'}} onClick={onClose}>Got it! 👍</button>
      </div>
    </div>
  );
}

function ClearBtn({label,onClear,title,message}){
  const [show,setShow]=useState(false);
  return(
    <>
      {show&&<ClearConfirmModal title={title} message={message} onConfirm={()=>{onClear();setShow(false);}} onCancel={()=>setShow(false)}/>}
      <button onClick={()=>setShow(true)} style={{background:'rgba(220,38,38,0.08)',color:'#dc2626',border:'1px solid rgba(220,38,38,0.2)',borderRadius:'var(--radius-sm)',padding:'4px 10px',fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
        🗑 {label}
      </button>
    </>
  );
}


function ClearConfirmModal({title,message,onConfirm,onCancel}){
  const [checked,setChecked]=useState(false);
  return(
    <div className="modal-overlay" style={{position:"fixed",inset:0,zIndex:4000,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div className="modal-box slide-up" style={{maxWidth:420}}>
        <div style={{textAlign:'center',marginBottom:'1.5rem'}}>
          <div style={{fontSize:40,marginBottom:10}}>⚠️</div>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:20,marginBottom:8,color:'var(--text-primary)'}}>{title}</h2>
          <p style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.6}}>{message}</p>
        </div>
        <div style={{background:'#fafaf8',borderRadius:'var(--radius-md)',padding:'12px 16px',marginBottom:'1.25rem',border:'1px solid var(--border)'}}>
          <label style={{display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer'}}>
            <input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} style={{width:16,height:16,flexShrink:0,marginTop:2,accentColor:'#dc2626'}}/>
            <span style={{fontSize:12,color:'var(--slate)',lineHeight:1.6}}>Yes, I understand — this cannot be undone.</span>
          </label>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn-outline" style={{flex:1}} onClick={onCancel}>Cancel</button>
          <button onClick={onConfirm} disabled={!checked} style={{flex:1,background:checked?'#dc2626':'rgba(220,38,38,0.3)',color:'#fff',border:'none',borderRadius:'var(--radius-md)',padding:'12px',fontSize:13,fontWeight:700,cursor:checked?'pointer':'not-allowed',fontFamily:'var(--font-display)',transition:'all 0.2s'}}>
            Yes, clear it
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BudgetApp({ lead, firebaseUser, onSignOut, onDeleteAccount }) {
  const uid = firebaseUser?.uid;
  // Sync lead to Firestore on every load so Hub pipeline stays current
  useLeadSync(lead, uid);
  const [activeAccount, setActiveAccount] = useState('main');
  const [accounts, setAccounts] = useState({ main: { name:'Main Account', transactions:[], debts:[], budgets:{}, beginBal:{amount:0,date:'',set:false}, goals:[], bills:[], billsPaid:{}, extraPayment:'', payoffTargetId:'', subscriptions:[], assets:[], liabilities:[], savingsRateGoal:20, networthHistory:[], varBills:[], varBillsPaid:{} } });
  const [activeTab, setActiveTab] = useState('register');
  const [periodMode, setPeriodMode] = useState('monthly');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [savedMsg, setSavedMsg] = useState('');
  const [showVideo, setShowVideo] = useState(false);
  const [showCashPopup, setShowCashPopup] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showGoodbye, setShowGoodbye] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [loading, setLoading] = useState(true);
  const [payBillModal, setPayBillModal] = useState(null);
  const [showResetAccount, setShowResetAccount] = useState(false);
  const [showAddToHome, setShowAddToHome] = useState(false);
  const [showMortgageTip, setShowMortgageTip] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [milestone, setMilestone] = useState(null);
  const [editingAccountKey, setEditingAccountKey] = useState(null);
  const [editingAccountName, setEditingAccountName] = useState('');
  const [deleteAccountKey, setDeleteAccountKey] = useState(null);
  const [splitModal, setSplitModal] = useState(null);
  const [budgetResetBanner, setBudgetResetBanner] = useState(false); // kept for legacy, replaced by showRolloverModal
  const [dismissedBillAlerts, setDismissedBillAlerts] = useState({});
  const [showBillToasts, setShowBillToasts] = useState(false);

  // Sync dismissed bill alerts to/from Firestore so all devices stay in sync
  useEffect(() => {
    if (!uid) return;
    const alertsRef = doc(db, 'users', uid, 'data', 'billAlerts');
    const unsubscribe = onSnapshot(alertsRef, (snap) => {
      if (snap.exists()) setDismissedBillAlerts(snap.data().dismissed || {});
    });
    return () => unsubscribe();
  }, [uid]);

  const dismissBillAlert = async (key) => {
    const next = { ...dismissedBillAlerts, [key]: 'sidebar' };
    setDismissedBillAlerts(next);
    setShowBillToasts(false);
    try {
      const alertsRef = doc(db, 'users', uid, 'data', 'billAlerts');
      await setDoc(alertsRef, { dismissed: next }, { merge: true });
    } catch(e) { console.error('Bill alert sync error:', e); }
  };
  const { showTour, completeTour, resetTour } = useTour();

  useEffect(() => {
    if (!uid) return;
    const timeout = setTimeout(() => { setLoading(false); }, 4000);
    const docRef = doc(db, 'users', uid, 'data', 'budgetData');
    const unsubscribe = onSnapshot(docRef, (snap) => {
      clearTimeout(timeout);
      if (snap.exists()) {
        const data = snap.data();
        if (data.accounts) {
          // Normalize accounts — fill in any fields added after the account was created
          const normalized = {};
          Object.entries(data.accounts).forEach(([key, acct]) => {
            normalized[key] = {
              transactions: [],
              debts: [],
              budgets: {},
              beginBal: {amount:0,date:'',set:false},
              goals: [],
              bills: [],
              billsPaid: {},
              extraPayment: '',
              payoffTargetId: '',
              subscriptions: [],
              assets: [],
              liabilities: [],
              savingsRateGoal: 20,
              networthHistory: [],
              varBills: [],
              varBillsPaid: {},
              ...acct, // overlay saved data on top of defaults
            };
          });
          setAccounts(normalized);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error('Firestore error:', error);
      clearTimeout(timeout);
      setLoading(false);
    });
    return () => { clearTimeout(timeout); unsubscribe(); };
  }, [uid]);

  // Month rollover modal — synced to Firestore
  const [showRolloverModal, setShowRolloverModal] = useState(false);
  const [rolloverSettings, setRolloverSettings] = useState({
    fixedExpenses: true,
    variableExpenses: true,
    subscriptions: true,
    clearTransactions: true,
    carryUnspent: false,
  });

  // Load rollover settings and seen flag from Firestore
  useEffect(() => {
    if (!uid) return;
    const prefsRef = doc(db, 'users', uid, 'data', 'userPrefs');
    const unsubscribe = onSnapshot(prefsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.rolloverSettings) setRolloverSettings(s => ({ ...s, ...data.rolloverSettings }));
        const today = new Date();
        const monthKey = `${today.getFullYear()}_${today.getMonth()}`;
        if (today.getDate() === 1 && !data.rolloverSeenMonths?.[monthKey]) {
          setShowRolloverModal(true);
        }
      } else {
        const today = new Date();
        if (today.getDate() === 1) setShowRolloverModal(true);
      }
    });
    return () => unsubscribe();
  }, [uid]);

  const saveUserPrefs = async (updates) => {
    if (!uid) return;
    try {
      const prefsRef = doc(db, 'users', uid, 'data', 'userPrefs');
      await setDoc(prefsRef, updates, { merge: true });
    } catch(e) { console.error('Prefs save error:', e); }
  };

  const toggleRollover = (key) => {
    setRolloverSettings(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveUserPrefs({ rolloverSettings: next });
      return next;
    });
  };

  const markRolloverSeen = async () => {
    const today = new Date();
    const monthKey = `${today.getFullYear()}_${today.getMonth()}`;
    await saveUserPrefs({ rolloverSeenMonths: { [monthKey]: true } });
  };

  const applyRollover = async () => {
    await markRolloverSeen();

    const acct = accounts[activeAccount];
    let updated = { ...acct };

    if (rolloverSettings.clearTransactions) {
      updated.transactions = [];
      updated.billsPaid = {};
      updated.varBillsPaid = {};
    }

    if (rolloverSettings.carryUnspent) {
      const income = acct.transactions.filter(t => parseFloat(t.amount) > 0).reduce((s, t) => s + parseFloat(t.amount), 0);
      const spent = acct.transactions.filter(t => parseFloat(t.amount) < 0).reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0);
      const surplus = income - spent;
      if (surplus > 0) {
        const carryTx = { id: Date.now(), date: today.toISOString().slice(0, 10), desc: 'Carried over from last month', amount: surplus.toFixed(2), category: 'Other income', note: '' };
        updated.transactions = [carryTx, ...(updated.transactions || [])];
      }
    }

    if (!rolloverSettings.fixedExpenses) updated.bills = [];
    if (!rolloverSettings.subscriptions) updated.subscriptions = [];
    if (!rolloverSettings.variableExpenses) updated.budgets = {};

    setAccounts(prev => ({ ...prev, [activeAccount]: updated }));
    setShowRolloverModal(false);
  };

  const saveToFirebase = async (updatedAccounts) => {
    if (!uid) return;
    try {
      const docRef = doc(db, 'users', uid, 'data', 'budgetData');
      await setDoc(docRef, { accounts: updatedAccounts }, { merge: true });
      setSavedMsg('Saved');
      setTimeout(() => setSavedMsg(''), 1800);
    } catch (err) { console.error('Save error:', err); }
  };

  const updateAccount = (field, value, accountKey) => {
    const key = accountKey || activeAccount;
    const updated = { ...accounts, [key]: { ...accounts[key], [field]: value } };
    setAccounts(updated);
    saveToFirebase(updated);
  };

  const acct = accounts[activeAccount] || accounts.main;
  const { transactions, debts, budgets, beginBal, goals, bills, billsPaid, extraPayment, payoffTargetId, subscriptions, assets, liabilities, savingsRateGoal, networthHistory, varBills, varBillsPaid } = acct;

  const txs = v => updateAccount('transactions', v);
  const dbs = v => updateAccount('debts', v);
  const bgs = v => updateAccount('budgets', v);
  const bbs = v => updateAccount('beginBal', v);
  const gls = v => updateAccount('goals', v);
  const bls = v => updateAccount('bills', v);
  const bps = v => updateAccount('billsPaid', v);
  const eps = v => updateAccount('extraPayment', v);
  const setPtid = v => updateAccount('payoffTargetId', v);
  const subs = v => updateAccount('subscriptions', v);
  const setAssets = v => updateAccount('assets', v);
  const setVarBills = v => updateAccount('varBills', v);
  const setVarBillsPaid = v => updateAccount('varBillsPaid', v);
  const setLiabilities = v => updateAccount('liabilities', v);
  const setSavingsRateGoal = v => updateAccount('savingsRateGoal', v);
  const setNetworthHistory = v => updateAccount('networthHistory', v);

  useEffect(() => {
    const videoId = getYouTubeId(WELCOME_VIDEO_ID);
    if (!videoId) return;
    const watched = localStorage.getItem(`mm_video_${uid}`);
    if (!watched) { const t = setTimeout(() => setShowVideo(true), 800); return () => clearTimeout(t); }
  }, [uid]);

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    if (tab === 'cash' && !localStorage.getItem(`mm_cash_${uid}`)) setShowCashPopup(true);
  };

  const closeCashPopup = () => { localStorage.setItem(`mm_cash_${uid}`, 'true'); setShowCashPopup(false); };
  const closeVideo = () => { localStorage.setItem(`mm_video_${uid}`, 'true'); setShowVideo(false); };

  const handleDeleteAccount = async () => {
    setShowDeleteModal(false);
    setShowGoodbye(true);
    setTimeout(async () => { await onDeleteAccount(); }, 2000);
  };

  const addNewAccount = () => {
    if (!newAccountName.trim()) return;
    const key = `account_${Date.now()}`;
    const updated = { ...accounts, [key]: { name:newAccountName.trim(), transactions:[], debts:[], budgets:{}, beginBal:{amount:0,date:'',set:false}, goals:[], bills:[], billsPaid:{}, extraPayment:'', payoffTargetId:'', subscriptions:[], assets:[], liabilities:[], savingsRateGoal:20, networthHistory:[], varBills:[], varBillsPaid:{} } };
    setAccounts(updated);
    saveToFirebase(updated);
    setActiveAccount(key);
    setNewAccountName('');
    setShowAddAccount(false);
  };

  const saveAccountRename = () => {
    if (!editingAccountName.trim()) return;
    const updated = { ...accounts, [editingAccountKey]: { ...accounts[editingAccountKey], name: editingAccountName.trim() } };
    setAccounts(updated);
    saveToFirebase(updated);
    setEditingAccountKey(null);
    setEditingAccountName('');
  };

  const handlePayBill = (bill) => setPayBillModal(bill);

  const handlePayBillConfirm = (selectedAccountKey, deductFromAccount) => {
    const bill = payBillModal;
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const key = `${monthKey}_${bill.id}`;
    const updatedBillsPaid = { ...billsPaid, [key]: { paidAt: now.toISOString() } };
    if (deductFromAccount) {
      const targetAcct = accounts[selectedAccountKey];
      const newTx = { id: Date.now(), date: now.toISOString().split('T')[0], desc: bill.name, type: 'debit', grp: 'Housing', cat: bill.category || 'Other', amt: bill.amount, note: '', refNum: '' };
      const updatedTxs = [newTx, ...(targetAcct.transactions || [])];
      updatedTxs.sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id);
      let updated = { ...accounts, [activeAccount]: { ...accounts[activeAccount], billsPaid: updatedBillsPaid } };
      // Merge the transaction into whichever account is the deduction target — same object if it's
      // the active account (so billsPaid isn't lost), a different one if the bill lives elsewhere.
      updated = { ...updated, [selectedAccountKey]: { ...updated[selectedAccountKey], transactions: updatedTxs } };
      setAccounts(updated);
      saveToFirebase(updated);
    } else {
      updateAccount('billsPaid', updatedBillsPaid);
    }
    setPayBillModal(null);
  };

  const handleUnpayBill = (billId) => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const key = `${monthKey}_${billId}`;
    const updated = { ...billsPaid };
    delete updated[key];
    updateAccount('billsPaid', updated);
  };

  const firstName = lead?.name?.split(' ')[0] || firebaseUser?.displayName?.split(' ')[0] || 'there';

  const tabs = [
    {id:'register',label:'Register',icon:'📒'},
    {id:'bills',label:'Bills',icon:'🗓'},
    {id:'calendar',label:'Calendar',icon:'📅'},
    {id:'budgets',label:'Budgets',icon:'🎯'},
    {id:'debts',label:'Debt Stack',icon:'📉'},
    {id:'savings',label:'Savings',icon:'🐷'},
    {id:'cash',label:'Cash',icon:'💵'},
    {id:'timeline',label:'Payoff',icon:'⏱'},
    {id:'spending',label:'Spending',icon:'📊'},
    {id:'networth',label:'Net Worth',icon:'💎'},
  ];

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:24, fontWeight:800, color:'var(--green)', marginBottom:8 }}>MoneyMap</div>
        <div style={{ fontSize:13, color:'var(--text-muted)' }}>Loading your data…</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex' }}>
      {showTour && <AppTour onComplete={completeTour} />}
      <FinancialTipPopup uid={uid} lead={lead} onTabSwitch={handleTabSwitch} showTour={showTour} />
      {showVideo && <WelcomeVideoModal lead={lead} onClose={closeVideo} />}
      {showCashPopup && <CashPopup onClose={closeCashPopup} />}
      {showDeleteModal && <DeleteAccountModal lead={lead} onConfirm={handleDeleteAccount} onCancel={() => setShowDeleteModal(false)} />}
      {showGoodbye && <GoodbyeModal lead={lead} />}
      {showCSVImport && <CSVImportModal
        existingTransactions={accounts[activeAccount]?.transactions||[]}
        accounts={accounts}
        defaultAccount={activeAccount}
        onImport={(newTxs, targetAccountKey)=>{
          const targetAcct=accounts[targetAccountKey]||accounts[activeAccount];
          const existing=targetAcct.transactions||[];
          const updated=[...newTxs,...existing];
          updated.sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
          const updatedAccounts={...accounts,[targetAccountKey]:{...targetAcct,transactions:updated}};
          setAccounts(updatedAccounts);
          saveToFirebase(updatedAccounts);
        }}
        onCancel={()=>setShowCSVImport(false)}
        onAddSubscriptions={(newSubs, targetAccountKey)=>{
          const targetAcct=accounts[targetAccountKey]||accounts[activeAccount];
          const existingSubs=targetAcct.subscriptions||[];
          const updated={...accounts,[targetAccountKey]:{...targetAcct,subscriptions:[...existingSubs,...newSubs]}};
          setAccounts(updated);
          saveToFirebase(updated);
        }}
        onAddFixedBills={(newBills, targetAccountKey)=>{
          const targetAcct=accounts[targetAccountKey]||accounts[activeAccount];
          const existingBills=targetAcct.bills||[];
          const updated={...accounts,[targetAccountKey]:{...targetAcct,bills:[...existingBills,...newBills]}};
          setAccounts(updated);
          saveToFirebase(updated);
        }}
      />}
      {showAddToHome && <AddToHomeScreenModal onClose={() => setShowAddToHome(false)} />}
      {showMortgageTip && (
        <div className="modal-overlay" style={{position:"fixed",inset:0,zIndex:2500,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}} onClick={e=>e.target===e.currentTarget&&setShowMortgageTip(false)}>
          <div className="modal-box slide-up" style={{maxWidth:460}}>
            <div style={{height:4,background:'linear-gradient(90deg,#059669,#34d399)',borderRadius:'4px 4px 0 0',margin:'-2rem -2rem 1.25rem'}}/>
            <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:'1rem'}}>
              <span style={{fontSize:32,flexShrink:0}}>🏠</span>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:'#059669',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Mortgage Tip</div>
                <h2 style={{fontFamily:'var(--font-display)',fontSize:18,color:'var(--text-primary)',lineHeight:1.3}}>Pay extra toward your mortgage principal</h2>
              </div>
            </div>
            <p style={{fontSize:13,color:'var(--slate)',lineHeight:1.7,marginBottom:'1rem'}}>
              Even an extra <strong style={{color:'#059669'}}>$100/month</strong> on a 30-year mortgage can cut <strong style={{color:'#059669'}}>4-6 years</strong> off your payoff timeline and save tens of thousands in interest.
            </p>
            <div style={{background:'rgba(5,150,105,0.06)',border:'1px solid rgba(5,150,105,0.2)',borderRadius:'var(--radius-md)',padding:'12px 14px',marginBottom:'1.25rem'}}>
              <div style={{fontSize:12,color:'#059669',fontWeight:600,marginBottom:4}}>💡 Pro tip</div>
              <div style={{fontSize:12,color:'var(--slate)',lineHeight:1.6}}>Make sure extra payments go toward <strong>principal</strong> — not next month's payment. Check with your lender to confirm how to designate extra payments correctly.</div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className="btn-gold" style={{flex:1,background:'linear-gradient(135deg,#059669,#34d399)'}} onClick={()=>{setShowMortgageTip(false);setActiveTab('timeline');}}>
                📊 See my payoff timeline
              </button>
              <button className="btn-outline" style={{fontSize:12}} onClick={()=>setShowMortgageTip(false)}>Got it 👍</button>
            </div>
          </div>
        </div>
      )}
      {payBillModal && <PayBillModal bill={payBillModal} accounts={accounts} onConfirm={handlePayBillConfirm} onCancel={() => setPayBillModal(null)} />}
      {showResetAccount && (
        <ClearConfirmModal
          title={"Reset " + (acct.name || 'Account') + "?"}
          message="This will wipe ALL transactions, bills, debts, goals, subscriptions, and beginning balance in this account. Other accounts are not affected."
          onConfirm={() => {
            const reset = { name: acct.name, transactions:[], debts:[], budgets:{}, beginBal:{amount:0,date:'',set:false}, goals:[], bills:[], billsPaid:{}, extraPayment:'', payoffTargetId:'', subscriptions:[] };
            const updated = { ...accounts, [activeAccount]: reset };
            setAccounts(updated);
            saveToFirebase(updated);
            setShowResetAccount(false);
          }}
          onCancel={() => setShowResetAccount(false)}
        />
      )}
      {showTransfer && <TransferModal accounts={accounts} onTransfer={(fromKey,toKey,amt,desc)=>{
        const now=new Date();
        const date=now.toISOString().split('T')[0];
        const fromTx={id:Date.now(),date,desc:`Transfer to ${accounts[toKey].name}: ${desc}`,type:'debit',grp:'Other',cat:'Other',amt,note:'Transfer',refNum:''};
        const toTx={id:Date.now()+1,date,desc:`Transfer from ${accounts[fromKey].name}: ${desc}`,type:'credit',grp:'Other',cat:'Other',amt,note:'Transfer',refNum:''};
        const fromTxs=[fromTx,...(accounts[fromKey].transactions||[])];
        const toTxs=[toTx,...(accounts[toKey].transactions||[])];
        fromTxs.sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
        toTxs.sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
        const updated={...accounts,[fromKey]:{...accounts[fromKey],transactions:fromTxs},[toKey]:{...accounts[toKey],transactions:toTxs}};
        setAccounts(updated);saveToFirebase(updated);setShowTransfer(false);
      }} onCancel={()=>setShowTransfer(false)} />}
      {milestone && <MilestoneModal milestone={milestone} onClose={()=>setMilestone(null)} />}
      {splitModal && <SplitModal form={splitModal.form} onConfirm={(splits) => { splitModal.onConfirm(splits); setSplitModal(null); }} onCancel={() => setSplitModal(null)} />}

      {/* Bill due reminders — fixed overlay bottom-right, never affects layout */}
      {(() => {
        const today = new Date();
        const todayDay = today.getDate();
        const monthKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
        const upcomingBills = bills.filter(b => {
          const daysUntil = b.dueDay - todayDay;
          if (daysUntil < 0 || daysUntil > 7) return false;
          const alertKey = `${monthKey}_${b.id}`;
          const dismissed = dismissedBillAlerts[alertKey];
          const paid = Object.keys(billsPaid||{}).some(k=>k.includes(`${monthKey}_${b.id}`));
          if (paid) return false;
          if (!dismissed) return true;
          if (dismissed === 'sidebar' && showBillToasts) return true;
          return false;
        });
        if (upcomingBills.length === 0) return null;
        return (
          <div style={{ position:'fixed', bottom:24, right:24, zIndex:2000, display:'flex', flexDirection:'column', gap:6, maxWidth:320, width:'calc(100vw - 48px)', pointerEvents:'none' }}>\n            {upcomingBills.map(b => {
              const daysUntil = b.dueDay - todayDay;
              const alertKey = `${monthKey}_${b.id}`;
              const isOverdue = daysUntil < 0;
              const isUrgent = daysUntil <= 2;
              const color = isOverdue ? '#dc2626' : isUrgent ? '#d97706' : '#2a6b4a';
              const bg = isOverdue ? '#fff5f5' : isUrgent ? '#fffbeb' : '#f0faf5';
              const border = isOverdue ? 'rgba(220,38,38,0.3)' : isUrgent ? 'rgba(217,119,6,0.3)' : 'rgba(42,107,74,0.25)';
              const label = isOverdue ? 'Overdue' : daysUntil === 0 ? 'Due today' : daysUntil === 1 ? 'Due tomorrow' : `Due in ${daysUntil} days`;
              return (
                <div key={b.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:bg, border:`1px solid ${border}`, borderRadius:10, boxShadow:'0 2px 12px rgba(0,0,0,0.10)', pointerEvents:'auto' }}>
                  <span style={{ fontSize:15, flexShrink:0 }}>{isOverdue ? '⚠️' : isUrgent ? '🔔' : '📅'}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.name}</div>
                    <div style={{ fontSize:11, color, opacity:0.85 }}>${parseFloat(b.amount).toFixed(2)} — {label}</div>
                  </div>
                  <button onClick={() => dismissBillAlert(alertKey)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:17, color, opacity:0.5, padding:'0 2px', lineHeight:1, flexShrink:0 }}>✕</button>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Budget Reset Banner */}
      {showRolloverModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div style={{ background:'#fff', borderRadius:16, padding:'1.5rem', width:'100%', maxWidth:420, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <div style={{ fontSize:28 }}>🗓</div>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)' }}>New month — {new Date().toLocaleString('default',{month:'long',year:'numeric'})}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>Choose what carries over from last month</div>
              </div>
            </div>

            <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:8 }}>Budget categories</div>
            <div style={{ background:'#fafaf8', border:'1px solid #eee', borderRadius:10, marginBottom:14, overflow:'hidden' }}>
              {[
                { key:'fixedExpenses', label:'Fixed expenses', sub:'Rent, car payment, insurance' },
                { key:'variableExpenses', label:'Variable budgets', sub:'Groceries, gas, dining targets' },
                { key:'subscriptions', label:'Subscriptions', sub:'Netflix, Spotify, recurring apps' },
              ].map((item, i, arr) => (
                <div key={item.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom: i < arr.length-1 ? '1px solid #eee' : 'none' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>{item.label}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{item.sub}</div>
                  </div>
                  <div onClick={() => toggleRollover(item.key)} style={{ width:36, height:20, borderRadius:20, background: rolloverSettings[item.key] ? 'var(--green)' : '#ccc', position:'relative', cursor:'pointer', transition:'background 0.2s', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:3, left: rolloverSettings[item.key] ? 19 : 3, width:14, height:14, borderRadius:'50%', background:'#fff', transition:'left 0.2s' }}/>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:8 }}>Transactions</div>
            <div style={{ background:'#fafaf8', border:'1px solid #eee', borderRadius:10, marginBottom:14, overflow:'hidden' }}>
              {[
                { key:'clearTransactions', label:'Clear transaction register', sub:'Start fresh — history stays viewable' },
                { key:'carryUnspent', label:'Carry over unspent balance', sub:"Add last month's surplus to income" },
              ].map((item, i, arr) => (
                <div key={item.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom: i < arr.length-1 ? '1px solid #eee' : 'none' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>{item.label}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{item.sub}</div>
                  </div>
                  <div onClick={() => toggleRollover(item.key)} style={{ width:36, height:20, borderRadius:20, background: rolloverSettings[item.key] ? 'var(--green)' : '#ccc', position:'relative', cursor:'pointer', transition:'background 0.2s', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:3, left: rolloverSettings[item.key] ? 19 : 3, width:14, height:14, borderRadius:'50%', background:'#fff', transition:'left 0.2s' }}/>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:8 }}>Goals — always carry forward</div>
            <div style={{ background:'#fafaf8', border:'1px solid #eee', borderRadius:10, marginBottom:20, overflow:'hidden' }}>
              {[
                { label:'Debt payoff progress', sub:'Tracks across all months' },
                { label:'Savings progress', sub:'Tracks across all months' },
              ].map((item, i, arr) => (
                <div key={item.label} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom: i < arr.length-1 ? '1px solid #eee' : 'none', opacity:0.6 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>{item.label}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{item.sub}</div>
                  </div>
                  <div style={{ width:36, height:20, borderRadius:20, background:'var(--green)', position:'relative', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:3, left:19, width:14, height:14, borderRadius:'50%', background:'#fff' }}/>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={applyRollover} style={{ width:'100%', background:'var(--green)', color:'#fff', border:'none', borderRadius:10, padding:'13px', fontSize:14, fontWeight:700, cursor:'pointer', marginBottom:8 }}>
              Start {new Date().toLocaleString('default',{month:'long'})} →
            </button>
            <button onClick={async () => { await markRolloverSeen(); setShowRolloverModal(false); }} style={{ width:'100%', background:'none', border:'none', color:'var(--text-muted)', fontSize:12, cursor:'pointer', textDecoration:'underline' }}>
              Decide later
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sidebar">
        <div className="sidebar-logo">Money<span>Map</span></div>
        <div className="sidebar-section-label">Main</div>
        {[{id:'register',label:'Register',icon:'📒'},{id:'bills',label:'Bills',icon:'🗓'},{id:'calendar',label:'Calendar',icon:'📅'},{id:'budgets',label:'Budgets',icon:'🎯'},{id:'spending',label:'Spending',icon:'📊'}].map(t=>(
          <button key={t.id} className={`nav-item${activeTab===t.id?' active':''}`} onClick={()=>handleTabSwitch(t.id)}>
            <span className="nav-icon">{t.icon}</span>{t.label}
          </button>
        ))}
        <div className="sidebar-divider"/>
        <div className="sidebar-section-label">Plan</div>
        {[{id:'debts',label:'Debt Stack',icon:'📉'},{id:'timeline',label:'Payoff',icon:'⏱'},{id:'savings',label:'Savings',icon:'🐷'},{id:'networth',label:'Net Worth',icon:'💎'}].map(t=>(
          <button key={t.id} className={`nav-item${activeTab===t.id?' active':''}`} onClick={()=>handleTabSwitch(t.id)}>
            <span className="nav-icon">{t.icon}</span>{t.label}
          </button>
        ))}
        <div className="sidebar-divider"/>
        <div className="sidebar-section-label">Other</div>
        {[{id:'cash',label:'Cash',icon:'💵'}].map(t=>(
          <button key={t.id} className={`nav-item${activeTab===t.id?' active':''}`} onClick={()=>handleTabSwitch(t.id)}>
            <span className="nav-icon">{t.icon}</span>{t.label}
          </button>
        ))}
        {(()=>{
          const today = new Date();
          const todayDay = today.getDate();
          const monthKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
          const sidebarBills = bills.filter(b=>{
            const daysUntil = b.dueDay - todayDay;
            if(daysUntil < 0 || daysUntil > 7) return false;
            const alertKey = `${monthKey}_${b.id}`;
            return dismissedBillAlerts[alertKey]==='sidebar' && !Object.keys(billsPaid||{}).some(k=>k.includes(`${monthKey}_${b.id}`));
          });
          if(sidebarBills.length===0) return null;
          return(
            <button className="nav-item" onClick={()=>setShowBillToasts(s=>!s)} style={{color:showBillToasts?'#2a6b4a':'#b45309',background:showBillToasts?'rgba(42,107,74,0.08)':'rgba(217,119,6,0.08)',fontWeight:500}}>
              <span className="nav-icon">🔔</span>
              Coming due
              <span style={{marginLeft:'auto',background:'#d97706',color:'#fff',fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:20}}>{sidebarBills.length}</span>
            </button>
          );
        })()}
        <div className="sidebar-spacer"/>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={()=>setShowAddToHome(true)}><span className="nav-icon">📱</span>Add to phone</button>
          <button className="nav-item" onClick={resetTour}><span className="nav-icon">🗺</span>Tour</button>
          <button className="nav-item" style={{color:'var(--text-muted)',fontSize:12}}><span className="nav-icon">👤</span>{firstName}</button>
        </div>
      </div>
      <div className="main-content">
      <div className="topbar">
        <div className="topbar-left">
          {savedMsg && <span style={{fontSize:12,color:'var(--green)',fontWeight:500}}>✓ {savedMsg}</span>}
        </div>
        <div className="topbar-right">
          <button className="btn-outline" style={{fontSize:11}} onClick={()=>setShowCSVImport(true)}>📂 Import CSV</button>
          {Object.keys(accounts).length>1 && <button className="btn-outline" style={{fontSize:11}} onClick={()=>setShowTransfer(true)}>🔄 Transfer</button>}
          <button className="btn-outline" style={{fontSize:11}} onClick={()=>exportCSV(transactions,beginBal)}>⬇ CSV</button>
          <button className="btn-outline" style={{fontSize:11}} onClick={onSignOut}>Sign out</button>
          <button onClick={()=>setShowDeleteModal(true)} style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:11,cursor:'pointer',textDecoration:'underline'}}>Cancel account</button>
        </div>
      </div>

      {/* Account tabs */}
      <div style={{ background:'#fff', borderBottom:'1px solid var(--border)', padding:'8px 20px', display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
        {Object.entries(accounts).map(([key, acctData]) => (
          <div key={key} style={{ display:'flex', alignItems:'center', gap:2 }}>
            {editingAccountKey===key ? (
              <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                <input value={editingAccountName} onChange={e=>setEditingAccountName(e.target.value)} style={{ padding:'3px 8px', fontSize:12, width:130, borderRadius:20 }} onKeyDown={e=>{if(e.key==='Enter')saveAccountRename();if(e.key==='Escape'){setEditingAccountKey(null);}}} autoFocus />
                <button className="btn-gold" style={{ padding:'3px 10px', fontSize:11 }} onClick={saveAccountRename}>Save</button>
                <button className="btn-outline" style={{ padding:'3px 8px', fontSize:11 }} onClick={()=>setEditingAccountKey(null)}>✕</button>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:2 }}>
                <button onClick={() => setActiveAccount(key)} style={{ padding:'5px 12px', fontSize:12, fontWeight:600, borderRadius:20, cursor:'pointer', border:`1px solid ${activeAccount===key?'var(--green)':'var(--border)'}`, background:activeAccount===key?'var(--green-light)':'transparent', color:activeAccount===key?'var(--green)':'var(--text-muted)', transition:'all 0.2s' }}>
                  {acctData.name}
                </button>
                {activeAccount===key && (
                  <div style={{ display:'flex', gap:2 }}>
                    <button onClick={()=>{setEditingAccountKey(key);setEditingAccountName(acctData.name);}} title="Rename account" style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:12, cursor:'pointer', padding:'2px 4px' }}>✏️</button>
                    {key!=='main' && <button onClick={()=>setDeleteAccountKey(key)} title="Delete account" style={{ background:'none', border:'none', color:'rgba(220,38,38,0.5)', fontSize:12, cursor:'pointer', padding:'2px 4px' }}>🗑</button>}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {showAddAccount ? (
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <input value={newAccountName} onChange={e => setNewAccountName(e.target.value)} placeholder="Account name" style={{ padding:'4px 10px', fontSize:12, width:150, borderRadius:20 }} onKeyDown={e => e.key==='Enter'&&addNewAccount()} autoFocus />
            <button className="btn-gold" style={{ padding:'5px 12px', fontSize:12 }} onClick={addNewAccount}>Add</button>
            <button className="btn-outline" style={{ padding:'5px 10px', fontSize:12 }} onClick={() => setShowAddAccount(false)}>✕</button>
          </div>
        ) : (
          <>
            <button onClick={() => setShowAddAccount(true)} style={{ padding:'5px 12px', fontSize:11, borderRadius:20, cursor:'pointer', border:'1px dashed var(--border)', background:'transparent', color:'var(--text-muted)' }}>+ Add account</button>
            <button onClick={() => setShowResetAccount(true)} style={{ padding:'5px 12px', fontSize:11, borderRadius:20, cursor:'pointer', background:'transparent', border:'1px solid rgba(184,48,48,0.25)', color:'var(--red)', marginLeft:'auto' }}>↺ Reset account</button>
          </>
        )}
      </div>
      {deleteAccountKey && (
        <ClearConfirmModal
          title={`Delete "${accounts[deleteAccountKey]?.name}"?`}
          message="This will permanently delete this account and ALL its transactions, bills, debts, goals, and subscriptions. This cannot be undone."
          onConfirm={()=>{
            const updated={...accounts};
            delete updated[deleteAccountKey];
            setAccounts(updated);
            saveToFirebase(updated);
            setActiveAccount('main');
            setDeleteAccountKey(null);
          }}
          onCancel={()=>setDeleteAccountKey(null)}
        />
      )}

      <div className="page-content">
        <MetricsBar transactions={transactions} debts={debts} beginBal={beginBal} />
        <AlertsBar transactions={transactions} budgets={budgets} />
        <div className="mobile-bottom-nav">
          {[{id:'register',label:'Register',icon:'📒'},{id:'bills',label:'Bills',icon:'🗓'},{id:'budgets',label:'Budgets',icon:'🎯'},{id:'debts',label:'Debt Stack',icon:'📉'},{id:'savings',label:'Savings',icon:'🐷'}].map(t=>(
            <button key={t.id} className={`mobile-nav-btn${activeTab===t.id?' active':''}`} onClick={()=>handleTabSwitch(t.id)}>
              <span className="ico">{t.icon}</span>{t.label}
            </button>
          ))}
          <button className={`mobile-nav-btn${['calendar','spending','cash','timeline','networth'].includes(activeTab)?' active':''}`} onClick={()=>setShowMobileMore(s=>!s)}>
            <span className="ico">⋯</span>More
          </button>
        </div>
        {showMobileMore&&(
          <div className="mobile-more-menu">
            {[{id:'calendar',label:'Calendar',icon:'📅'},{id:'spending',label:'Spending',icon:'📊'},{id:'cash',label:'Cash',icon:'💵'},{id:'timeline',label:'Payoff',icon:'⏱'},{id:'networth',label:'Net Worth',icon:'💎'},{id:'tour',label:'Tour',icon:'🗺'}].map(t=>(
              <button key={t.id} className={`mobile-more-btn${activeTab===t.id?' active':''}`} onClick={()=>{if(t.id==='tour'){resetTour();}else{handleTabSwitch(t.id);}setShowMobileMore(false);}}>
                <span className="ico">{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        )}
        {activeTab==='register' && <RegisterTab transactions={transactions||[]} setTransactions={txs} beginBal={beginBal} setBeginBal={bbs} onSplitRequest={(form, onConfirm) => setSplitModal({ form, onConfirm })} onMortgageDetected={() => { const seen = localStorage.getItem('mm_mortgage_tip_' + uid); if(!seen) { setShowMortgageTip(true); localStorage.setItem('mm_mortgage_tip_' + uid, 'true'); }}} accounts={accounts} activeAccount={activeAccount} onMoveTransactions={(txIds, targetKey)=>{ const toMove=transactions.filter(t=>txIds.includes(t.id)); const remaining=transactions.filter(t=>!txIds.includes(t.id)); const targetTxs=[...(accounts[targetKey].transactions||[]),...toMove]; targetTxs.sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id); const updated={...accounts,[activeAccount]:{...accounts[activeAccount],transactions:remaining},[targetKey]:{...accounts[targetKey],transactions:targetTxs}}; setAccounts(updated); saveToFirebase(updated); }} />}
        {activeTab==='bills' && <BillsTab bills={bills||[]} setBills={bls} billsPaid={billsPaid||{}} onPayBill={handlePayBill} onUnpayBill={handleUnpayBill} subscriptions={subscriptions} setSubscriptions={subs} transactions={transactions} goals={goals} accounts={accounts} activeAccount={activeAccount} setAccounts={setAccounts} saveToFirebase={saveToFirebase} varBills={varBills||[]} setVarBills={setVarBills} varBillsPaid={varBillsPaid||{}} setVarBillsPaid={setVarBillsPaid} onMoveBill={(bill,targetKey)=>{ if(!targetKey)return; const srcUpdated=bills.filter(b=>b.id!==bill.id); const tgtUpdated=[...(accounts[targetKey].bills||[]),bill]; const updated={...accounts,[activeAccount]:{...accounts[activeAccount],bills:srcUpdated},[targetKey]:{...accounts[targetKey],bills:tgtUpdated}}; setAccounts(updated); saveToFirebase(updated); }} onMoveSubscription={(sub,targetKey)=>{ if(!targetKey)return; const srcUpdated=subscriptions.filter(s=>s.id!==sub.id); const tgtUpdated=[...(accounts[targetKey].subscriptions||[]),sub]; const updated={...accounts,[activeAccount]:{...accounts[activeAccount],subscriptions:srcUpdated},[targetKey]:{...accounts[targetKey],subscriptions:tgtUpdated}}; setAccounts(updated); saveToFirebase(updated); }} />}
        {activeTab==='budgets' && <BudgetsTab transactions={transactions} budgets={budgets} setBudgets={bgs} />}
        {activeTab==='debts' && <DebtsTab debts={debts||[]} setDebts={dbs} onRepContact={async(topic)=>{
          await recordContactRequest(lead,uid,{icon:'📉',label:topic||'Debt Help',detail:'Requested via debt payoff review',source:'debt'});
        }}/>}
        {activeTab==='savings' && <SavingsTab transactions={transactions||[]} goals={goals||[]} setGoals={gls} onMilestone={setMilestone} uid={uid} lead={lead} onLeadEngagement={async(topic)=>{
          const iconMap={'Emergency Account setup':'🚨','Short-Term Account setup':'📆','Wealth Building Account setup':'📈','Savings':'🐷'};
          await recordContactRequest(lead,uid,{icon:iconMap[topic]||'🐷',label:topic,detail:'Requested via savings account setup',source:'savings'});
        }}/> }
        {activeTab==='cash' && <CashTab transactions={transactions} setTransactions={txs} />}
        {activeTab==='timeline' && <TimelineTab debts={debts} extraPayment={extraPayment} setExtraPayment={eps} payoffTargetId={payoffTargetId} setPayoffTargetId={setPtid} />}
        {activeTab==='calendar' && <CalendarTab bills={bills||[]} billsPaid={billsPaid||{}} subscriptions={subscriptions||[]} varBills={varBills||[]} varBillsPaid={varBillsPaid||{}} />}
        {activeTab==='networth' && <NetWorthTab assets={assets||[]} setAssets={setAssets} liabilities={liabilities||[]} setLiabilities={setLiabilities} transactions={transactions||[]} networthHistory={networthHistory||[]} setNetworthHistory={setNetworthHistory} savingsRateGoal={savingsRateGoal||20} setSavingsRateGoal={setSavingsRateGoal} goals={goals} />}
        {activeTab==='spending' && <SpendingTab transactions={transactions} periodMode={periodMode} setPeriodMode={setPeriodMode} periodOffset={periodOffset} setPeriodOffset={setPeriodOffset} budgets={budgets} bills={bills} />}
      </div>
      </div>
    </div>
  );
}

function MetricsBar({transactions,debts,beginBal}){
  const n=new Date();const m=n.getMonth();const y=n.getFullYear();
  // Transactions dated before the beginning balance are already reflected in that number —
  // counting them again on top of it is what was inflating the balance.
  const bbDateStr=beginBal.set?beginBal.date:null;
  const sinceReset=bbDateStr?transactions.filter(t=>t.date>=bbDateStr):transactions;
  const debits=sinceReset.filter(t=>t.type==='debit').reduce((s,t)=>s+t.amt,0);
  const credits=sinceReset.filter(t=>t.type==='credit').reduce((s,t)=>s+t.amt,0);
  const bal=(beginBal.amount||0)+credits-debits;
  const totalDebt=debts.reduce((s,d)=>s+d.bal,0);
  const monthIncome=transactions.filter(t=>{const d=new Date(t.date+'T00:00:00');return t.type==='credit'&&d.getMonth()===m&&d.getFullYear()===y;}).reduce((s,t)=>s+t.amt,0);
  const monthSpend=transactions.filter(t=>{const d=new Date(t.date+'T00:00:00');return t.type==='debit'&&d.getMonth()===m&&d.getFullYear()===y;}).reduce((s,t)=>s+t.amt,0);
  const net=monthIncome-monthSpend;
  return(
    <div className="metric-grid">
      <div className="metric-card"><div className="lbl">Account balance</div><div className={`val ${bal>=0?'val-green':'val-red'}`}>${Math.abs(bal).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
      <div className="metric-card"><div className="lbl">Total debt</div><div className="val val-red">${totalDebt.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
      <div className="metric-card"><div className="lbl">Month income</div><div className={`val ${monthIncome>0?'val-green':'val-red'}`}>${monthIncome.toFixed(2)}</div></div>
      <div className="metric-card"><div className="lbl">Month net</div><div className={`val ${net>=0?'val-teal':'val-red'}`}>{net<0?'-':''}${Math.abs(net).toFixed(2)}</div></div>
    </div>
  );
}

function AlertsBar({transactions,budgets}){
  const n=new Date();const m=n.getMonth();const y=n.getFullYear();
  const getM=type=>transactions.filter(t=>{const d=new Date(t.date+'T00:00:00');return t.type===type&&d.getMonth()===m&&d.getFullYear()===y;});
  const monthSpend=getM('debit').reduce((s,t)=>s+t.amt,0);
  const monthIncome=getM('credit').reduce((s,t)=>s+t.amt,0);
  const monthSavings=getM('debit').filter(t=>t.grp==='Savings').reduce((s,t)=>s+t.amt,0);
  const net=monthIncome-monthSpend;
  const alerts=[];
  if(monthIncome>0&&net<0) alerts.push({type:'danger',msg:`Spending exceeds income — you're running a <strong>$${Math.abs(net).toFixed(2)} deficit</strong> this month.`});
  else if(monthIncome===0&&monthSpend>0) alerts.push({type:'warning',msg:'No income recorded this month. Add your paycheck so your net is accurate.'});
  if(monthIncome>0&&monthSavings===0) alerts.push({type:'warning',msg:'No savings recorded this month. Log a savings transaction under the Savings group.'});
  const catTotals={};
  getM('debit').forEach(t=>{catTotals[t.cat]=(catTotals[t.cat]||0)+t.amt;});
  Object.keys(budgets).filter(c=>budgets[c]>0&&(catTotals[c]||0)>budgets[c]).forEach(c=>alerts.push({type:'danger',msg:`<strong>${c}</strong> over budget — $${(catTotals[c]||0).toFixed(2)} of $${budgets[c].toFixed(2)} limit`}));
  if(!alerts.length) return null;
  return <div style={{marginBottom:'1rem'}}>{alerts.map((a,i)=><div key={i} className={`alert-box alert-${a.type}`} dangerouslySetInnerHTML={{__html:a.msg}}/>)}</div>;
}

function RegisterTab({transactions,setTransactions,beginBal,setBeginBal,onSplitRequest,onMortgageDetected,accounts,activeAccount,onMoveTransactions}){
  const emptyForm = {date:new Date().toISOString().split('T')[0],desc:'',type:'debit',grp:'',cat:'',amt:'',note:'',refNum:'',recurring:'none'};
  const [form,setForm]=useState(emptyForm);
  const [bbEdit,setBbEdit]=useState(false);
  const [bbForm,setBbForm]=useState({date:beginBal.date||new Date().toISOString().split('T')[0],amount:beginBal.amount||''});
  const [filterGrp,setFilterGrp]=useState('');
  const [filterCat,setFilterCat]=useState('');
  const [search,setSearch]=useState('');
  const [showExtra,setShowExtra]=useState(false);
  const [selectedTxIds,setSelectedTxIds]=useState([]);
  const [moveToAccount,setMoveToAccount]=useState('');
  const [err,setErr]=useState({});
  const nowForMonth=new Date();
  const [viewMonth,setViewMonth]=useState({y:nowForMonth.getFullYear(),m:nowForMonth.getMonth()});
  const isCurrentMonth=viewMonth.y===nowForMonth.getFullYear()&&viewMonth.m===nowForMonth.getMonth();
  const monthLabel=new Date(viewMonth.y,viewMonth.m,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const goPrevMonth=()=>setViewMonth(v=>v.m===0?{y:v.y-1,m:11}:{y:v.y,m:v.m-1});
  const goNextMonth=()=>setViewMonth(v=>{if(v.y===nowForMonth.getFullYear()&&v.m===nowForMonth.getMonth())return v;return v.m===11?{y:v.y+1,m:0}:{y:v.y,m:v.m+1};});
  const grpCats=form.grp?GROUPS[form.grp]?.cats||[]:[];

  const addTx=()=>{
    const e={};
    if(!form.date)e.date=true;
    if(!form.desc.trim())e.desc=true;
    if(!form.cat)e.cat=true;
    if(!form.amt||isNaN(parseFloat(form.amt))||parseFloat(form.amt)<=0)e.amt=true;
    if(Object.keys(e).length){setErr(e);return;}
    const newTx={id:Date.now(),date:form.date,desc:form.desc.trim(),type:form.type,grp:form.grp,cat:form.cat,amt:parseFloat(form.amt),note:form.note||'',refNum:form.refNum||'',recurring:form.recurring||'none'};
    const updated=[newTx,...transactions];
    updated.sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
    setTransactions(updated);
    setForm(f=>({...f,desc:'',amt:'',note:'',refNum:'',type:'debit'}));
    setErr({});
    const txDate=new Date(newTx.date+'T00:00:00');
    setViewMonth({y:txDate.getFullYear(),m:txDate.getMonth()});
  };

  const handleSplit=()=>{
    if(!form.amt||isNaN(parseFloat(form.amt))||parseFloat(form.amt)<=0){alert('Enter an amount first.');return;}
    onSplitRequest(form,(splits)=>{
      const newTxs=splits.map((sp,i)=>({id:Date.now()+i,date:form.date,desc:form.desc.trim()||'Split transaction',type:form.type,grp:sp.grp||'Other',cat:sp.cat,amt:parseFloat(sp.amt),note:sp.note||'Split',refNum:form.refNum||'',recurring:'none'}));
      const updated=[...newTxs,...transactions];
      updated.sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
      setTransactions(updated);
      setForm(emptyForm);
      setErr({});
      const txDate=new Date(form.date+'T00:00:00');
      setViewMonth({y:txDate.getFullYear(),m:txDate.getMonth()});
    });
  };

  const saveBB=()=>{
    const amt=parseFloat(bbForm.amount);
    if(isNaN(amt))return;
    setBeginBal({amount:amt,date:bbForm.date,set:true});
    setBbEdit(false);
  };

  const sorted=[...transactions].sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
  // Same fix as the top Account Balance metric: transactions dated before the beginning
  // balance are already baked into that number, so they're excluded from the running chain —
  // otherwise re-adding old history on top of a freshly-set balance inflates every row after it.
  const bbDateStr=beginBal.set?beginBal.date:null;
  let runBal=beginBal.amount||0;
  const bals={};
  sorted.forEach(t=>{
    if(bbDateStr&&t.date<bbDateStr)return;
    runBal+=t.type==='credit'?t.amt:-t.amt;
    bals[t.id]=runBal;
  });

  let filtered=transactions.filter(t=>{
    const d=new Date(t.date+'T00:00:00');
    return d.getFullYear()===viewMonth.y&&d.getMonth()===viewMonth.m;
  });
  if(filterGrp)filtered=filtered.filter(t=>t.grp===filterGrp);
  if(filterCat)filtered=filtered.filter(t=>t.cat===filterCat);
  if(search)filtered=filtered.filter(t=>`${t.desc} ${t.cat} ${t.grp} ${t.amt} ${t.refNum||''}`.toLowerCase().includes(search.toLowerCase()));
  const grpFilterCats=filterGrp?GROUPS[filterGrp]?.cats||[]:Object.values(GROUPS).flatMap(v=>v.cats);

  return(
    <>
      <div className="card">
        {!beginBal.set?(
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,padding:'4px 0'}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:'var(--green)'}}>💰 Set beginning balance</div>
              <div style={{fontSize:12,color:'var(--text-muted)'}}>Enter your account balance before tracking starts</div>
            </div>
            <button className="btn-gold" style={{fontSize:12,padding:'8px 16px'}} onClick={()=>setBbEdit(true)}>Set balance</button>
          </div>
        ):(
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
            <div>
              <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:2}}>Beginning balance</div>
              <div style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:700,color:'var(--green)'}}>
                ${beginBal.amount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
                <span style={{fontSize:12,color:'var(--text-muted)',fontWeight:400,marginLeft:8}}>as of {new Date(beginBal.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
              </div>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button className="btn-outline" style={{fontSize:12}} onClick={()=>setBbEdit(true)}>Edit</button>
              <ClearBtn label="Clear" onClear={()=>setBeginBal({amount:0,date:'',set:false})} title="Clear beginning balance?" message="This will reset your beginning balance to zero." />
            </div>
          </div>
        )}
        {bbEdit&&(
          <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid var(--border)'}}>
            <div className="form-row r3">
              <input type="date" value={bbForm.date} onChange={e=>setBbForm(f=>({...f,date:e.target.value}))}/>
              <input type="number" value={bbForm.amount} placeholder="Starting balance ($)" step="0.01" onChange={e=>setBbForm(f=>({...f,amount:e.target.value}))}/>
              <button className="btn-gold" onClick={saveBB}>Save</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Add transaction</div>
        <div className="form-row r2">
          <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={err.date?{borderColor:'#dc2626'}:{}}/>
          <AutocompleteInput
            value={form.desc}
            onChange={val=>setForm(f=>({...f,desc:val}))}
            transactions={transactions}
            onSelect={suggestion=>{
              setForm(f=>({...f,desc:suggestion.desc,grp:suggestion.grp||f.grp,cat:suggestion.cat||f.cat}));
            }}
            style={err.desc?{borderColor:'#dc2626'}:{}}
          />
        </div>
        <div className="form-row r4" style={{marginBottom:10}}>
          <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}><option value="debit">Debit</option><option value="credit">Credit</option></select>
          <select value={form.grp} onChange={e=>setForm(f=>({...f,grp:e.target.value,cat:''}))}>
            <option value="">-- Group --</option>
            {Object.keys(GROUPS).map(g=><option key={g} value={g}>{g}</option>)}
          </select>
          <select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))} style={err.cat?{borderColor:'#dc2626'}:{}}>
            <option value="">-- Category --</option>
            {grpCats.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" placeholder="Amount" min="0" step="0.01" value={form.amt} onChange={e=>setForm(f=>({...f,amt:e.target.value}))} style={err.amt?{borderColor:'#dc2626'}:{}} onKeyDown={e=>e.key==='Enter'&&addTx()}/>
        </div>

        <button className="btn-outline" style={{fontSize:11,marginBottom:10}} onClick={()=>setShowExtra(x=>!x)}>
          {showExtra?'▲ Hide extras':'▼ Add note, ref #, recurring'}
        </button>

        {showExtra&&(
          <div style={{background:'#fafaf8',borderRadius:'var(--radius-md)',padding:'12px',marginBottom:10,border:'1px solid var(--border)'}}>
            <div className="form-row r2" style={{marginBottom:8}}>
              <div>
                <label style={{fontSize:11,color:'var(--text-muted)',display:'block',marginBottom:3}}>Note (optional)</label>
                <input placeholder="e.g. split with spouse, reimbursable..." value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/>
              </div>
              <div>
                <label style={{fontSize:11,color:'var(--text-muted)',display:'block',marginBottom:3}}>Confirmation / Ref #</label>
                <input placeholder="e.g. TXN123456" value={form.refNum} onChange={e=>setForm(f=>({...f,refNum:e.target.value}))}/>
              </div>
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--text-muted)',display:'block',marginBottom:3}}>Recurring</label>
              <select value={form.recurring} onChange={e=>setForm(f=>({...f,recurring:e.target.value}))} style={{maxWidth:200}}>
                <option value="none">Not recurring</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
        )}

        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className="btn-gold" onClick={addTx}>+ Add entry</button>
          <button className="btn-outline" onClick={handleSplit} style={{fontSize:12}}>✂️ Split</button>
        </div>
      </div>

      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem',flexWrap:'wrap',gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <button className="btn-outline" style={{fontSize:13,padding:'3px 9px',fontWeight:700}} onClick={goPrevMonth} aria-label="Previous month">‹</button>
              <div className="card-title" style={{marginBottom:0,minWidth:150,textAlign:'center'}}>{monthLabel} Register</div>
              <button className="btn-outline" style={{fontSize:13,padding:'3px 9px',fontWeight:700,opacity:isCurrentMonth?0.35:1,cursor:isCurrentMonth?'default':'pointer'}} onClick={goNextMonth} disabled={isCurrentMonth} aria-label="Next month">›</button>
              {!isCurrentMonth&&<button className="btn-outline" style={{fontSize:11,padding:'3px 8px'}} onClick={()=>setViewMonth({y:nowForMonth.getFullYear(),m:nowForMonth.getMonth()})}>Today</button>}
            </div>
            {transactions.length>0&&<ClearBtn label="Clear all" onClear={()=>setTransactions([])} title="Clear all transactions?" message="This will permanently delete all transactions in this account." />}
            {selectedTxIds.length>0&&accounts&&Object.keys(accounts).length>1&&(
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:11,color:'var(--green)',fontWeight:600}}>{selectedTxIds.length} selected</span>
                <select value={moveToAccount} onChange={e=>setMoveToAccount(e.target.value)} style={{fontSize:11,padding:'3px 8px',width:'auto'}}>
                  <option value="">Move to...</option>
                  {Object.entries(accounts).filter(([k])=>k!==activeAccount).map(([k,a])=><option key={k} value={k}>{a.name}</option>)}
                </select>
                {moveToAccount&&<button className="btn-gold" style={{fontSize:11,padding:'4px 10px'}} onClick={()=>{onMoveTransactions(selectedTxIds,moveToAccount);setSelectedTxIds([]);setMoveToAccount('');}}>Move</button>}
                <button className="btn-outline" style={{fontSize:11,padding:'4px 8px'}} onClick={()=>{setSelectedTxIds([]);setMoveToAccount('');}}>Cancel</button>
              </div>
            )}
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
            <input placeholder="🔍 Search transactions..." value={search} onChange={e=>setSearch(e.target.value)} style={{fontSize:12,padding:'5px 10px',width:180}}/>
            <select value={filterGrp} onChange={e=>{setFilterGrp(e.target.value);setFilterCat('');}} style={{width:'auto',fontSize:12,padding:'4px 8px'}}>
              <option value="">All groups</option>
              {Object.keys(GROUPS).map(g=><option key={g} value={g}>{g}</option>)}
            </select>
            <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{width:'auto',fontSize:12,padding:'4px 8px'}}>
              <option value="">All categories</option>
              {grpFilterCats.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <table>
          <thead><tr>
            <th style={{width:28}}><input type="checkbox" onChange={e=>{if(e.target.checked)setSelectedTxIds(filtered.map(t=>t.id));else setSelectedTxIds([]);}} style={{accentColor:'var(--green)',width:13,height:13}}/></th>
            <th style={{width:64}}>Date</th>
            <th>Description</th>
            <th style={{width:100}}>Category</th>
            <th style={{width:66}}>Debit</th>
            <th style={{width:66}}>Credit</th>
            <th style={{width:72}}>Balance</th>
            <th style={{width:28}}></th>
          </tr></thead>
          <tbody>
            {beginBal.set&&!filterGrp&&!filterCat&&!search&&(()=>{
              const bbDate=new Date(beginBal.date+'T00:00:00');
              return bbDate.getFullYear()===viewMonth.y&&bbDate.getMonth()===viewMonth.m;
            })()&&(
              <tr className="bb-row">
                <td style={{fontSize:11}}>{new Date(beginBal.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</td>
                <td colSpan={4} style={{color:'var(--text-muted)'}}>💰 Beginning balance</td>
                <td className="fw credit-color">${beginBal.amount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                <td></td>
              </tr>
            )}
            {filtered.map(t=>{
              const bal=bals[t.id];
              const ci=ALL_CATS[t.cat]||{color:'#6b7280',bg:'rgba(107,114,128,0.1)'};
              return(
                <tr key={t.id} style={{background:selectedTxIds.includes(t.id)?'var(--green-light)':''}}>
                  <td style={{width:28,textAlign:'center'}}>
                    <input type="checkbox" checked={selectedTxIds.includes(t.id)} onChange={e=>{if(e.target.checked)setSelectedTxIds(s=>[...s,t.id]);else setSelectedTxIds(s=>s.filter(id=>id!==t.id));}} style={{accentColor:'var(--green)',width:13,height:13}}/>
                  </td>
                  <td style={{fontSize:11,whiteSpace:'nowrap'}}>{new Date(t.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</td>
                  <td>
                    <div style={{fontSize:12}}>{t.desc}</div>
                    {t.note&&<div style={{fontSize:10,color:'var(--text-muted)',fontStyle:'italic'}}>📝 {t.note}</div>}
                    {t.refNum&&<div style={{fontSize:10,color:'var(--green)'}}>Ref: {t.refNum}</div>}
                    {t.recurring&&t.recurring!=='none'&&<div style={{fontSize:10,color:'#7c3aed'}}>🔁 {t.recurring}</div>}
                  </td>
                  <td><span className="grp-badge" style={{background:ci.bg,color:ci.color}}>{t.grp||'?'}</span></td>
                  <td className="debit-color">{t.type==='debit'?'$'+t.amt.toFixed(2):''}</td>
                  <td className="credit-color">{t.type==='credit'?'$'+t.amt.toFixed(2):''}</td>
                  <td className={bal!==undefined?`fw ${bal>=0?'credit-color':'debit-color'}`:''} style={{fontSize:12,color:bal===undefined?'var(--text-muted)':undefined}}>{bal!==undefined?'$'+Math.abs(bal).toFixed(2):'—'}</td>
                  <td><button className="btn-danger" onClick={()=>setTransactions(transactions.filter(x=>x.id!==t.id))}>✕</button></td>
                </tr>
              );
            })}
            {filtered.length===0&&<tr><td colSpan={7} className="empty-state">No transactions in {monthLabel}.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function BillsTab({bills=[],setBills,billsPaid={},onPayBill,onUnpayBill,subscriptions=[],setSubscriptions,transactions=[],goals=[],accounts,activeAccount,setAccounts,saveToFirebase,onMoveBill,onMoveSubscription,varBills=[],setVarBills,varBillsPaid={},setVarBillsPaid}){
  const now=new Date();
  const monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const todayDay=now.getDate();
  const BILL_CATS=['Mortgage / rent','Electric bill','Water bill','Gas / heat bill','Internet','Cable / streaming','Phone bill','HOA fee','Auto insurance','Life insurance','Health insurance','Dental / vision','Home / renters ins.','Car payment','Student loan','Credit card payment','Personal loan','Gym membership','Subscriptions','Childcare / daycare','School tuition','Other fixed bill'];
  const [form,setForm]=useState({name:'',amount:'',dueDay:'1',category:'Electric bill',autopay:false});
  const [showForm,setShowForm]=useState(false);
  const [err,setErr]=useState({});
  const [editingBill,setEditingBill]=useState(null);
  const addBill=()=>{
    const e={};
    if(!form.name.trim())e.name=true;
    if(!form.amount||isNaN(parseFloat(form.amount))||parseFloat(form.amount)<=0)e.amount=true;
    if(Object.keys(e).length){setErr(e);return;}
    const updated=[...bills,{id:Date.now(),name:form.name.trim(),amount:parseFloat(form.amount),dueDay:parseInt(form.dueDay),category:form.category,autopay:form.autopay,createdAt:new Date().toISOString()}];
    updated.sort((a,b)=>a.dueDay-b.dueDay);
    setBills(updated);
    setForm({name:'',amount:'',dueDay:'1',category:'Electric bill',autopay:false});
    setErr({});setShowForm(false);
  };
  const isPaid=billId=>!!billsPaid[`${monthKey}_${billId}`];
  const paidAt=billId=>{const p=billsPaid[`${monthKey}_${billId}`];return p?new Date(p.paidAt).toLocaleDateString('en-US',{month:'short',day:'numeric'}):null;};
  const getDueStatus=dueDay=>{if(dueDay<todayDay)return'overdue';if(dueDay-todayDay<=3)return'due-soon';return'upcoming';};
  const totalBills=bills.reduce((s,b)=>s+b.amount,0);
  const totalPaid=bills.filter(b=>isPaid(b.id)).reduce((s,b)=>s+b.amount,0);
  const totalUnpaid=totalBills-totalPaid;
  const paidCount=bills.filter(b=>isPaid(b.id)).length;
  const daySuffix=d=>{if(d>=11&&d<=13)return`${d}th`;const s=['th','st','nd','rd'];return`${d}${s[d%10]||'th'}`;};
  return(
    <>
      <div style={{background:'rgba(42,107,74,0.06)',border:'1px solid rgba(42,107,74,0.18)',borderRadius:'var(--radius-lg)',padding:'14px 18px',marginBottom:14,display:'flex',gap:14,alignItems:'flex-start'}}>
        <span style={{fontSize:26,flexShrink:0}}>⭐</span>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:'var(--green)',marginBottom:4,fontFamily:'var(--font-display)'}}>Pay yourself first</div>
          <div style={{fontSize:12.5,color:'#3a5a4a',lineHeight:1.65}}>Before any bill, before any spending — save first. Financial professionals recommend setting aside <strong>10–20% of every paycheck</strong> the moment it hits your account. Add a goal below and start building your future today.</div>
        </div>
      </div>
      <div className="metric-grid" style={{gridTemplateColumns:'repeat(4,minmax(0,1fr))'}}>
        <div className="metric-card"><div className="lbl">Total monthly bills</div><div className="val val-gold">${totalBills.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
        <div className="metric-card"><div className="lbl">Paid this month</div><div className="val val-green">${totalPaid.toFixed(2)}</div></div>
        <div className="metric-card"><div className="lbl">Still owed</div><div className={`val ${totalUnpaid>0?'val-red':'val-green'}`}>${totalUnpaid.toFixed(2)}</div></div>
        <div className="metric-card"><div className="lbl">Bills paid</div><div className="val val-teal">{paidCount} / {bills.length}</div></div>
      </div>
      <div style={{background:'var(--green-light)',border:'1px solid var(--green-mid)',borderRadius:'var(--radius-md)',padding:'10px 14px',marginBottom:10,display:'flex',alignItems:'center',gap:10}}>
        <span style={{fontSize:18,flexShrink:0}}>💡</span>
        <div style={{fontSize:12,color:'var(--slate)',lineHeight:1.5}}>
          <strong>Did you know?</strong> You can import your bank statement to automatically detect your fixed bills and subscriptions. Click <strong>📂 Import CSV</strong> in the header to get started!
        </div>
      </div>
      {bills.filter(b=>!isPaid(b.id)&&getDueStatus(b.dueDay)==='overdue').length>0&&<div className="alert-box alert-danger" style={{marginBottom:8}}>⚠️ <strong>{bills.filter(b=>!isPaid(b.id)&&getDueStatus(b.dueDay)==='overdue').length} bill(s) past due</strong></div>}
      {bills.filter(b=>!isPaid(b.id)&&getDueStatus(b.dueDay)==='due-soon').length>0&&<div className="alert-box alert-warning" style={{marginBottom:8}}>🔔 <strong>{bills.filter(b=>!isPaid(b.id)&&getDueStatus(b.dueDay)==='due-soon').length} bill(s) due within 3 days</strong></div>}
      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:showForm?'1rem':0}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div className="card-title" style={{marginBottom:0}}>Fixed bills</div>
            {bills.length>0&&<ClearBtn label="Clear all" onClear={()=>setBills([])} title="Clear all bills?" message="This will permanently delete all fixed bills." />}
          </div>
          <button className="btn-gold" style={{fontSize:12,padding:'6px 14px'}} onClick={()=>setShowForm(f=>!f)}>{showForm?'✕ Cancel':'+ Add bill'}</button>
        </div>
        {showForm&&(
          <div style={{borderTop:'1px solid var(--border)',paddingTop:'1rem'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Bill name</label><input placeholder="e.g. Car payment" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={err.name?{borderColor:'#dc2626'}:{}}/></div>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Monthly amount</label><input type="number" placeholder="$0.00" min="0" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={err.amount?{borderColor:'#dc2626'}:{}}/></div>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Due day</label><select value={form.dueDay} onChange={e=>setForm(f=>({...f,dueDay:e.target.value}))}>{Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={d}>{daySuffix(d)} of the month</option>)}</select></div>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Category</label><select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{BILL_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            </div>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',marginBottom:14,fontSize:13,color:'var(--slate)'}}>
              <input type="checkbox" checked={form.autopay} onChange={e=>setForm(f=>({...f,autopay:e.target.checked}))} style={{width:15,height:15,accentColor:'var(--green)'}}/>
              This bill is on autopay
            </label>
            <button className="btn-gold" onClick={addBill}>Save bill</button>
          </div>
        )}
      </div>
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        {bills.length===0?(
          <div className="empty-state" style={{padding:'3rem'}}>No fixed bills yet. Add your first bill above.</div>
        ):(
          <table>
            <thead><tr>
              <th style={{padding:'12px 16px',width:180}}>Bill</th>
              <th style={{width:90}}>Category</th>
              <th style={{width:70,textAlign:'center'}}>Due</th>
              <th style={{width:80,textAlign:'right'}}>Amount</th>
              <th style={{width:120,textAlign:'center'}}>Status</th>
              <th style={{width:90,textAlign:'center'}}>Paid on</th>
              <th style={{width:40}}></th>
            </tr></thead>
            <tbody>
              {[...bills].sort((a,b)=>(a.dueDay||1)-(b.dueDay||1)).map(bill=>{
                const paid=isPaid(bill.id);
                const status=paid?'paid':getDueStatus(bill.dueDay);
                const statusColors={paid:{bg:'rgba(22,163,74,0.1)',color:'#16a34a',label:'✓ Paid'},overdue:{bg:'rgba(220,38,38,0.1)',color:'#dc2626',label:'Overdue'},'due-soon':{bg:'rgba(217,119,6,0.1)',color:'#d97706',label:'Due soon'},upcoming:{bg:'rgba(107,114,128,0.08)',color:'#6b7280',label:'Upcoming'}};
                const sc=statusColors[status]||statusColors['upcoming'];
                return(
                  <tr key={bill.id} style={{opacity:paid?0.75:1}}>
                    <td style={{padding:'10px 16px'}}>
                      <div style={{fontWeight:600,fontSize:13,color:paid?'var(--text-muted)':'var(--text-primary)',textDecoration:paid?'line-through':'none'}}>{bill.name}</div>
                      {bill.autopay&&<div style={{fontSize:10,color:'#0ea5e9',fontWeight:600,marginTop:1}}>⚡ AUTOPAY</div>}
                    </td>
                    <td style={{fontSize:11,color:'var(--text-muted)'}}>{bill.category}</td>
                    <td style={{textAlign:'center'}}><span style={{fontSize:12,fontWeight:600,color:paid?'var(--text-muted)':status==='overdue'?'#dc2626':status==='due-soon'?'#d97706':'var(--slate)'}}>{daySuffix(bill.dueDay)}</span></td>
                    <td style={{textAlign:'right',fontWeight:700,fontSize:13,color:paid?'var(--text-muted)':'var(--text-primary)'}}>${bill.amount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                    <td style={{textAlign:'center'}}>
                      {paid?(
                        <button onClick={()=>onUnpayBill(bill.id)} style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.color}40`,borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>{sc.label}</button>
                      ):(
                        <button onClick={()=>onPayBill(bill)} style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.color}40`,borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>{sc.label}</button>
                      )}
                    </td>
                    <td style={{textAlign:'center',fontSize:11,color:'var(--text-muted)'}}>{paidAt(bill.id)||'—'}</td>
                    <td style={{textAlign:'center'}}>
                      <div style={{display:'flex',gap:4,justifyContent:'center'}}>
                        <button onClick={()=>setEditingBill(bill)} style={{background:'var(--green-light)',color:'var(--green)',border:'1px solid var(--green-mid)',borderRadius:'var(--radius-sm)',padding:'3px 7px',fontSize:11,cursor:'pointer'}}>✏️</button>
                        {accounts&&Object.keys(accounts).filter(k=>k!==activeAccount).length>0&&<MovePicker accounts={accounts} currentAccount={activeAccount} onMove={(targetKey)=>onMoveBill&&onMoveBill(bill,targetKey)} />}
                        <button className="btn-danger" onClick={()=>setBills(bills.filter(b=>b.id!==bill.id))}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {editingBill&&(
        <div className="modal-overlay" style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
          <div className="modal-box slide-up" style={{maxWidth:480}}>
            <h2 style={{fontFamily:'var(--font-display)',fontSize:20,marginBottom:'1.25rem',color:'var(--text-primary)'}}>✏️ Edit Bill</h2>
            <EditBillForm bill={editingBill} billCats={BILL_CATS} onSave={(updated)=>{setBills(bills.map(b=>b.id===updated.id?updated:b));setEditingBill(null);}} onCancel={()=>setEditingBill(null)} />
          </div>
        </div>
      )}
      {bills.length>0&&(
        <div className="card">
          <div className="card-title">Monthly bill progress</div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--text-muted)',marginBottom:6}}><span>{paidCount} of {bills.length} bills paid</span><span>${totalPaid.toFixed(2)} of ${totalBills.toFixed(2)}</span></div>
          <div style={{background:'var(--border-light)',borderRadius:6,height:10,overflow:'hidden'}}>
            <div style={{height:10,borderRadius:6,width:`${totalBills>0?Math.round((totalPaid/totalBills)*100):0}%`,background:paidCount===bills.length?'#16a34a':'linear-gradient(90deg, var(--green), #5ba3f5)',transition:'width 0.4s ease'}}/>
          </div>
          {paidCount===bills.length&&bills.length>0&&<div style={{textAlign:'center',fontSize:12,color:'#16a34a',marginTop:8,fontWeight:600}}>🎉 All bills paid for {now.toLocaleDateString('en-US',{month:'long'})}!</div>}
        </div>
      )}
      <VarBillsSection varBills={varBills||[]} setVarBills={setVarBills} varBillsPaid={varBillsPaid||{}} setVarBillsPaid={setVarBillsPaid} accounts={accounts} activeAccount={activeAccount} setAccounts={setAccounts} saveToFirebase={saveToFirebase} />
      <SubscriptionsSection subscriptions={subscriptions||[]} setSubscriptions={setSubscriptions} transactions={transactions} goals={goals} accounts={accounts} activeAccount={activeAccount} setAccounts={setAccounts} saveToFirebase={saveToFirebase} onMoveSubscription={onMoveSubscription} />
    </>
  );
}

function BudgetsTab({transactions,budgets,setBudgets}){
  const [localBudgets,setLocalBudgets]=useState({...budgets});
  const n=new Date();const m=n.getMonth();const y=n.getFullYear();
  const catTotals={};
  transactions.filter(t=>{const d=new Date(t.date+'T00:00:00');return t.type==='debit'&&d.getMonth()===m&&d.getFullYear()===y;}).forEach(t=>{catTotals[t.cat]=(catTotals[t.cat]||0)+t.amt;});
  const active=Object.keys({...catTotals,...localBudgets}).filter(c=>((catTotals[c]||0)>0||(localBudgets[c]||0)>0)&&ALL_CATS[c]);
  const maxVal=Math.max(...active.map(c=>Math.max(catTotals[c]||0,localBudgets[c]||0)),1);
  const byGrp={};active.forEach(c=>{const g=ALL_CATS[c]?.group||'Other';if(!byGrp[g])byGrp[g]=[];byGrp[g].push(c);});
  return(
    <>
      <div style={{background:'rgba(42,107,74,0.06)',borderLeft:'3px solid var(--green)',borderRadius:'0 var(--radius-md) var(--radius-md) 0',padding:'10px 14px',marginBottom:14,display:'flex',gap:10,alignItems:'center'}}>
        <span style={{fontSize:18,flexShrink:0}}>💡</span>
        <div style={{fontSize:12.5,color:'#1a4d30',lineHeight:1.6}}>Budget tip: make <strong>Savings</strong> your very first budget category — before food, housing, or anything else. What gets budgeted first gets funded first.</div>
      </div>
      <div className="card">
        <div className="card-title">Monthly budget limits</div>
        <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:12}}>Set $0 to skip. You'll get an alert when you exceed a limit.</div>
        {Object.entries(GROUPS).filter(([g])=>g!=='Income'&&g!=='Savings').map(([g,v])=>(
          <div key={g} style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:600,color:v.color,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8,paddingBottom:4,borderBottom:'1px solid var(--border-light)'}}>{g}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {v.cats.map(c=>(
                <div key={c} style={{display:'flex',alignItems:'center',gap:6}}>
                  <label style={{fontSize:12,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--slate)'}} title={c}>{c}</label>
                  <input type="number" value={localBudgets[c]||''} placeholder="$0" min="0" step="5" style={{width:80,flexShrink:0}} onChange={e=>setLocalBudgets(b=>({...b,[c]:parseFloat(e.target.value)||0}))}/>
                </div>
              ))}
            </div>
          </div>
        ))}
        <button className="btn-gold" onClick={()=>setBudgets(localBudgets)}>Save all limits</button>
      </div>
      <div className="card">
        <div className="card-title">Budget vs. actual — this month</div>
        {active.length===0?<div className="empty-state">Add transactions and budget limits to see tracking.</div>:(
          Object.entries(byGrp).map(([g,cats])=>{
            const gv=GROUPS[g];
            return(
              <div key={g} style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:600,color:gv?.color||'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>{g}</div>
                {cats.map(c=>{
                  const spent=catTotals[c]||0;const limit=localBudgets[c]||0;const over=limit>0&&spent>limit;
                  return(
                    <div key={c} className="cat-row">
                      <div className="cat-label" title={c}>{c}</div>
                      <div className="cat-track">
                        <div className="cat-fill" style={{width:`${Math.round((spent/maxVal)*100)}%`,background:over?'#dc2626':ALL_CATS[c]?.color||'#6b7280'}}/>
                        {limit>0&&<div style={{position:'absolute',top:0,left:`${Math.round((limit/maxVal)*100)}%`,width:2,height:'100%',background:'rgba(0,0,0,0.2)'}}/>}
                      </div>
                      <div className="cat-val" style={over?{color:'#dc2626'}:{}}>${spent.toFixed(0)}{limit>0&&<span style={{color:'var(--text-muted)'}}>/{limit.toFixed(0)}</span>}</div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

// ── Debt Payoff Celebration (Option A — full screen) ──────────
function DebtPayoffModal({paidDebt, nextDebt, allDebtFree, onClose, onRepContact}){
  const [contacted, setContacted] = useState(false);

  // Calculate months faster and interest saved with rolled payment
  const rolledPayment = paidDebt.min;
  const calcSavings = (debt, extra) => {
    if(!debt) return {months:0, interest:0};
    const r = debt.rate / 100 / 12;
    const min = debt.min;
    const bal = debt.bal;
    if(r === 0) return {months: Math.ceil(bal/(min+extra)), interest: 0};
    const mOrig = r > 0 ? Math.ceil(-Math.log(1 - (r*bal)/min) / Math.log(1+r)) : Math.ceil(bal/min);
    const mNew = Math.ceil(-Math.log(1 - (r*bal)/(min+extra)) / Math.log(1+r));
    const iOrig = mOrig * min - bal;
    const iNew = mNew * (min+extra) - bal;
    return {months: Math.max(0, mOrig - mNew), interest: Math.max(0, iOrig - iNew)};
  };

  const savings = nextDebt ? calcSavings(nextDebt, rolledPayment) : null;
  const yearlySaved = (paidDebt.min * 12 * 30 / 1000).toFixed(0);

  return (
    <div className="modal-overlay" style={{position:"fixed",inset:0,zIndex:4000,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div className="modal-box slide-up" style={{maxWidth:480, textAlign:'center'}}>
        <div style={{fontSize:56, marginBottom:12}}>🎉</div>
        <h2 style={{fontFamily:'var(--font-display)', fontSize:24, fontWeight:800, marginBottom:4, color:'var(--text-primary)'}}>
          You paid off {paidDebt.name}!
        </h2>
        <div style={{fontSize:14, color:'#16a34a', fontWeight:700, marginBottom:20}}>
          ${paidDebt.min.toFixed(0)}/month just freed up
        </div>

        {allDebtFree ? (
          <>
            <div style={{background:'rgba(22,163,74,0.08)', border:'1px solid rgba(22,163,74,0.2)', borderRadius:'var(--radius-lg)', padding:'16px', marginBottom:16, textAlign:'left'}}>
              <div style={{fontSize:14, fontWeight:700, color:'#16a34a', marginBottom:8}}>
                🏆 You are completely debt free!
              </div>
              <div style={{fontSize:13, color:'#1a4d30', lineHeight:1.7}}>
                Every dollar you were sending to debt is now yours to build with. This is the moment most people waste — lifestyle creep quietly steals it. Don’t let that happen.
              </div>
            </div>
            <div style={{background:'rgba(42,107,74,0.06)', border:'1px solid rgba(42,107,74,0.2)', borderRadius:'var(--radius-lg)', padding:'16px', marginBottom:20, textAlign:'left'}}>
              <div style={{fontSize:13, color:'#1a4d30', lineHeight:1.7}}>
                <strong style={{color:'#2a6b4a'}}>This is exactly when you need a plan.</strong> A free financial review with your rep will show you where that ${paidDebt.min.toFixed(0)}/month should go — retirement, life insurance, savings — so the freedom you just earned starts building real wealth.
              </div>
            </div>
            {contacted ? (
              <div style={{background:'rgba(22,163,74,0.08)', border:'1px solid rgba(22,163,74,0.2)', borderRadius:'var(--radius-md)', padding:'12px 14px', marginBottom:16, display:'flex', gap:10, alignItems:'flex-start'}}>
                <span style={{fontSize:20}}>✅</span>
                <div style={{textAlign:'left'}}>
                  <div style={{fontSize:13, fontWeight:700, color:'#16a34a', marginBottom:3}}>Your rep will be in touch soon!</div>
                  <div style={{fontSize:12, color:'#16a34a', lineHeight:1.5}}>We've let your financial rep know you're debt free and ready for a complimentary financial review. They'll reach out within 24 hours.</div>
                </div>
              </div>
            ) : (
              <button onClick={()=>{setContacted(true); onRepContact&&onRepContact();}}
                style={{width:'100%', background:'var(--green)', color:'#fff', border:'none', borderRadius:'var(--radius-md)', padding:'13px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-display)', marginBottom:10}}>
                Connect me with my rep for a free financial review
              </button>
            )}
            <button onClick={onClose} style={{width:'100%', background:'none', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'11px', fontSize:13, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-display)'}}>
              {contacted ? 'Back to my dashboard' : "Dismiss — I'll figure it out on my own"}
            </button>
          </>
        ) : (
          <>
            <div style={{background:'rgba(217,119,6,0.08)', border:'1px solid rgba(217,119,6,0.2)', borderRadius:'var(--radius-lg)', padding:'14px 16px', marginBottom:14, textAlign:'left'}}>
              <div style={{fontSize:13, fontWeight:700, color:'#92610a', marginBottom:6}}>That ${paidDebt.min.toFixed(0)} is not free — yet</div>
              <div style={{fontSize:12, color:'#92610a', lineHeight:1.7}}>Roll your ${paidDebt.min.toFixed(0)}/month straight into your next debt. Every dollar you freed up is now your most powerful weapon. Don’t let lifestyle creep steal this win.</div>
            </div>
            {nextDebt && savings && (
              <div style={{background:'rgba(22,163,74,0.08)', border:'1px solid rgba(22,163,74,0.2)', borderRadius:'var(--radius-lg)', padding:'14px 16px', marginBottom:20, textAlign:'left', display:'flex', gap:12, alignItems:'flex-start'}}>
                <span style={{fontSize:22, flexShrink:0}}>→</span>
                <div>
                  <div style={{fontSize:13, fontWeight:700, color:'#16a34a', marginBottom:5}}>Next target: {nextDebt.name} at {nextDebt.rate}% APR</div>
                  <div style={{fontSize:12, color:'#1a4d30', lineHeight:1.7}}>
                    Add ${paidDebt.min.toFixed(0)} to your current ${nextDebt.min.toFixed(0)}/month payment and pay ${(nextDebt.min + paidDebt.min).toFixed(0)}/month.
                    {savings.months > 0 && <> You'll pay it off <strong>{savings.months} months faster</strong></>}
                    {savings.interest > 0 && <> and save <strong>${savings.interest.toFixed(0)} in interest</strong></>}.
                  </div>
                </div>
              </div>
            )}
            <div style={{display:'flex', gap:10}}>
              <button onClick={onClose} style={{flex:1, background:'none', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'11px', fontSize:13, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-display)'}}>
                View debt stack
              </button>
              <button onClick={onClose} style={{flex:1, background:'var(--green)', color:'#fff', border:'none', borderRadius:'var(--radius-md)', padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-display)'}}>
                I'm rolling it over!
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


function DebtsTab({debts,setDebts,onRepContact}){
  const [form,setForm]=useState({name:'',bal:'',rate:'',min:''});
  const [payoffModal,setPayoffModal]=useState(null); // {paidDebt, nextDebt, allDebtFree}
  const [inlinePayoff,setInlinePayoff]=useState(null); // same shape, persists in tab

  const handleMarkPaidOff = (debt) => {
    const remaining = debts.filter(d=>d.id!==debt.id);
    const sorted = [...remaining].sort((a,b)=>b.rate-a.rate);
    const nextDebt = sorted[0]||null;
    const allDebtFree = remaining.length===0;
    const info = {paidDebt:debt, nextDebt, allDebtFree};
    setDebts(remaining);
    setPayoffModal(info);
    setInlinePayoff(info);
  };

  const addDebt=()=>{
    const {name,bal,rate,min}=form;
    if(!name.trim()||isNaN(parseFloat(bal))||isNaN(parseFloat(rate))||isNaN(parseFloat(min))){alert('Fill in all debt fields.');return;}
    setDebts([...debts,{id:Date.now(),name:name.trim(),bal:parseFloat(bal),rate:parseFloat(rate),min:parseFloat(min)}]);
    setForm({name:'',bal:'',rate:'',min:''});
  };
  const sorted=[...debts].sort((a,b)=>b.rate-a.rate);
  const maxBal=Math.max(...sorted.map(d=>d.bal),1);
  const totalMin=debts.reduce((s,d)=>s+d.min,0);
  return(
    <>
      {payoffModal&&<DebtPayoffModal
        paidDebt={payoffModal.paidDebt}
        nextDebt={payoffModal.nextDebt}
        allDebtFree={payoffModal.allDebtFree}
        onClose={()=>setPayoffModal(null)}
        onRepContact={onRepContact}
      />}
      {inlinePayoff&&(
        <div style={{background:'rgba(22,163,74,0.06)',border:'1px solid rgba(22,163,74,0.2)',borderRadius:'var(--radius-lg)',padding:'16px 18px',marginBottom:14}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:10}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:24}}>🏆</span>
              <div>
                <div style={{fontFamily:'var(--font-display)',fontSize:14,fontWeight:700,color:'#16a34a'}}>{inlinePayoff.paidDebt.name} paid off!</div>
                <div style={{fontSize:12,color:'#16a34a',opacity:0.8}}>${inlinePayoff.paidDebt.min.toFixed(0)}/month freed up</div>
              </div>
            </div>
            <button onClick={()=>setInlinePayoff(null)} style={{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:16,padding:0,lineHeight:1}}>✕</button>
          </div>
          {inlinePayoff.allDebtFree ? (
            <div style={{fontSize:12,color:'#1a4d30',lineHeight:1.7,marginBottom:12}}>
              You are completely debt free! Every dollar you were sending to debt is now yours to build with. Don’t let lifestyle creep take it — get a plan in place.
            </div>
          ) : (
            <div style={{fontSize:12,color:'#1a4d30',lineHeight:1.7,marginBottom:12}}>
              That ${inlinePayoff.paidDebt.min.toFixed(0)} is not free money — it's your rollover payment. Add it to your {inlinePayoff.nextDebt?.name} payment and you'll pay it off faster and save money in interest. Once all debt is gone, that same ${inlinePayoff.paidDebt.min.toFixed(0)}/month goes straight toward your future. Your future self is counting on this decision.
            </div>
          )}
          <button
            onClick={()=>setPayoffModal(inlinePayoff)}
            style={{width:'100%',background:'var(--green)',color:'#fff',border:'none',borderRadius:'var(--radius-md)',padding:'10px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'var(--font-display)'}}>
            {inlinePayoff.allDebtFree ? 'Connect me with my rep for a free financial review' : 'See my rollover plan'}
          </button>
        </div>
      )}
      <div className="card">
        <div className="card-title">Add debt</div>
        <div className="form-row r2">
          <input placeholder="Debt name (e.g. Visa, Car loan)" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
          <input type="number" placeholder="Balance owed ($)" min="0" step="0.01" value={form.bal} onChange={e=>setForm(f=>({...f,bal:e.target.value}))}/>
        </div>
        <div className="form-row r3">
          <input type="number" placeholder="Interest rate (%)" min="0" step="0.01" value={form.rate} onChange={e=>setForm(f=>({...f,rate:e.target.value}))}/>
          <input type="number" placeholder="Min. payment ($/mo)" min="0" step="0.01" value={form.min} onChange={e=>setForm(f=>({...f,min:e.target.value}))}/>
          <button className="btn-gold" style={{alignSelf:'end'}} onClick={addDebt}>+ Add debt</button>
        </div>
      </div>
      {sorted.length>0&&(
        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <span style={{fontSize:20}}>📋</span>
            <div>
              <div style={{fontFamily:'var(--font-display)',fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>Avalanche strategy</div>
              <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>Pay minimums on all debts. Put every extra dollar toward <strong style={{color:'var(--text-primary)'}}>{sorted[0].name}</strong> ({sorted[0].rate.toFixed(2)}% APR) — the highest interest rate first. This saves the most money over time. Total minimums: <strong style={{color:'var(--text-primary)'}}>${totalMin.toFixed(2)}/mo</strong>.</div>
            </div>
          </div>
        </div>
      )}
      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
          <div className="card-title" style={{marginBottom:0}}>Debt stacking order — avalanche method</div>
          {sorted.length>0&&<ClearBtn label="Clear all" onClear={()=>setDebts([])} title="Clear all debts?" message="This will permanently delete all debts from your debt stack." />}
        </div>
        {sorted.length===0?<div className="empty-state">Add your debts above to see the payoff strategy.</div>:(
          <>
            {sorted.map((d,i)=>{
              const labels=['Attack first','Attack next','Hold minimum'];
              const colors=['#dc2626','#d97706','#16a34a'];
              const bgs=['rgba(220,38,38,0.1)','rgba(217,119,6,0.1)','rgba(22,163,74,0.1)'];
              const label=i<2?labels[i]:labels[2];
              const color=i<2?colors[i]:colors[2];
              const bg=i<2?bgs[i]:bgs[2];
              return(
                <div key={d.id} style={{display:'flex',alignItems:'flex-start',gap:14,padding:'12px 0',borderBottom:'1px solid var(--border-light)'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                      <span style={{fontFamily:'var(--font-display)',fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>{d.name}</span>
                      <span style={{background:bg,color,fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:10}}>{label}</span>
                    </div>
                    <div style={{fontSize:12,color:'var(--text-muted)'}}>Min: ${d.min.toFixed(2)}/mo · {d.rate.toFixed(2)}% APR</div>
                    <div className="debt-bar-track"><div className="debt-bar-fill" style={{width:`${Math.round((d.bal/maxBal)*100)}%`,background:color}}/></div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontFamily:'var(--font-display)',fontSize:16,fontWeight:700,color:'var(--text-primary)'}}>${d.bal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                    <button className="btn-gold" style={{marginTop:6,fontSize:11,padding:'4px 10px'}} onClick={()=>handleMarkPaidOff(d)}>✓ Paid off!</button>
                    <button className="btn-danger" style={{marginTop:4}} onClick={()=>setDebts(debts.filter(x=>x.id!==d.id))}>✕ Remove</button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}

function SavingsTab({transactions,goals,setGoals,onMilestone,uid,lead,onLeadEngagement}){
  const [form,setForm]=useState({name:'',target:'',saved:''});
  const [showIncomePrompt,setShowIncomePrompt]=useState(false);
  const [incomeInput,setIncomeInput]=useState('');
  const [monthlyIncome,setMonthlyIncome]=useState(()=>{
    try{return parseFloat(localStorage.getItem('mm_declared_income_'+uid)||'0');}catch{return 0;}
  });
  const [setupModal,setSetupModal]=useState(null);
  const [setupDone,setSetupDone]=useState(false);
  const n=new Date();const m=n.getMonth();const y=n.getFullYear();
  const savTxs=transactions.filter(t=>{const d=new Date(t.date+'T00:00:00');return t.grp==='Savings'&&t.type==='debit'&&d.getMonth()===m&&d.getFullYear()===y;});
  const monthSavings=savTxs.reduce((s,t)=>s+t.amt,0);
  const calcIncome=transactions.filter(t=>{const d=new Date(t.date+'T00:00:00');return t.type==='credit'&&d.getMonth()===m&&d.getFullYear()===y;}).reduce((s,t)=>s+t.amt,0);
  const effectiveIncome=monthlyIncome>0?monthlyIncome:calcIncome;
  const savRate=effectiveIncome>0?(monthSavings/effectiveIncome*100):0;
  const totalGoalTarget=goals.reduce((s,g)=>s+g.target,0);
  const totalGoalSaved=goals.reduce((s,g)=>s+g.saved,0);
  const THREE_ACCOUNTS=[
    {type:'emergency',icon:'🚨',name:'Emergency Account',subtitle:'Up to 3 months of income',color:'#c2410c',bg:'#fff8f0',border:'rgba(234,88,12,0.2)',calcTarget:inc=>Math.round(inc*3),desc:'Your first line of defense. Keep this liquid and separate — only touch it for true emergencies.',tags:['Medical bills','Car repairs','Home repairs','Emergency travel'],tip:"Keep this in a separate bank account so you're not tempted to use it for everyday expenses.",repMsg:'Would you like your financial professional to help you figure out the best place to keep your emergency fund?'},
    {type:'shortterm',icon:'📆',name:'Short-Term Account',subtitle:'Up to 6 months of income',color:'#15803d',bg:'#f0faf5',border:'rgba(22,163,74,0.2)',calcTarget:inc=>Math.round(inc*6),desc:'For planned and unplanned life events. Build toward bigger goals while keeping funds accessible.',tags:['Job loss buffer','Vacation','Holidays','Down payment','New car'],tip:'A dedicated account for short-term goals keeps you from accidentally spending money earmarked for something important.',repMsg:'Would you like your financial professional to help you build a plan to reach this goal faster?'},
    {type:'wealth',icon:'📈',name:'Wealth Building Account',subtitle:'Pay yourself first — long-term',color:'#4338ca',bg:'#f0f4ff',border:'rgba(99,102,241,0.2)',calcTarget:()=>null,desc:'Pay your future self first. No matter where you are financially, setting aside something every month builds a habit that compounds over time. Your future self will thank you.',tags:['Retirement','Future planning','Long-term goals'],tip:'Even a small amount set aside consistently every month makes a massive difference over time. Start now, not later.',repMsg:'Would you like your financial professional to reach out and help you create a long-term plan?'}
  ];
  const saveIncome=(val)=>{
    const parsed=parseFloat(val);
    if(!parsed||parsed<=0){alert('Please enter a valid monthly income.');return;}
    setMonthlyIncome(parsed);
    localStorage.setItem('mm_declared_income_'+uid,String(parsed));
    setShowIncomePrompt(false);
  };
  const openSetup=(acct)=>{
    const suggested=acct.calcTarget(effectiveIncome)||0;
    const wealthTarget=acct.type==='wealth'?String(Math.round((effectiveIncome||0)*12*25)):'';
    setSetupDone(false);
    setSetupModal({acct,repChoice:null,targetInput:suggested>0?String(suggested):wealthTarget,savedInput:'',finIncome:acct.type==='wealth'?(effectiveIncome||0):undefined});
  };
  const confirmSetup=()=>{
    const {acct,repChoice,targetInput,savedInput}=setupModal;
    const target=parseFloat(targetInput)||0;
    const saved=parseFloat(savedInput)||0;
    if(target<=0){alert('Please enter a goal amount.');return;}
    setGoals([...goals,{id:Date.now(),name:acct.name,target,saved}]);
    if(repChoice==='yes'&&onLeadEngagement) onLeadEngagement(acct.name+' setup','savings');
    setSetupDone(true);
  };
  const addGoal=()=>{
    const name=form.name.trim();const target=parseFloat(form.target);const saved=parseFloat(form.saved)||0;
    if(!name||isNaN(target)||target<=0){alert('Enter a goal name and target.');return;}
    setGoals([...goals,{id:Date.now(),name,target,saved}]);
    setForm({name:'',target:'',saved:''});
  };
  const alreadySetup=(type)=>goals.some(g=>g.name.toLowerCase().includes(type==='emergency'?'emergency':type==='shortterm'?'short':'wealth'));
  return(
    <>
      <div className="metric-grid" style={{gridTemplateColumns:'repeat(4,minmax(0,1fr))'}}>
        <div className="metric-card"><div className="lbl">Saved this month</div><div className={`val ${monthSavings>0?'val-teal':'val-red'}`}>${monthSavings.toFixed(2)}</div></div>
        <div className="metric-card"><div className="lbl">Savings rate</div><div className={`val ${savRate>=20?'val-green':savRate>=5?'val-amber':'val-red'}`}>{savRate.toFixed(1)}%</div></div>
        <div className="metric-card"><div className="lbl">Goals funded</div><div className="val val-gold">${totalGoalSaved.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
        <div className="metric-card"><div className="lbl">Total targets</div><div className="val val-teal">${totalGoalTarget.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
      </div>
      {monthSavings===0&&<div className="alert-box alert-warning" style={{marginBottom:12}}>No savings logged this month. Add transactions under the <strong>Savings</strong> group.</div>}
      {savRate>=20&&<div className="alert-box alert-success" style={{marginBottom:12}}>Excellent! You're saving {savRate.toFixed(1)}% of income this month 🎉</div>}
      {savRate>0&&savRate<5&&<div className="alert-box alert-warning" style={{marginBottom:12}}>Savings rate is {savRate.toFixed(1)}% — try to reach at least 10–20% of income.</div>}
      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <div className="card-title" style={{marginBottom:0}}>💡 The 3 fundamental accounts</div>
          <button onClick={()=>setShowIncomePrompt(true)} style={{fontSize:11,color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>
            {effectiveIncome>0?`Based on $${effectiveIncome.toLocaleString()}/mo ✎`:'Set income'}
          </button>
        </div>
        <div style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.6,marginBottom:12}}>
          A solid financial foundation starts with three savings accounts — each with a specific purpose.
          {effectiveIncome>0?<span> Based on your <strong style={{color:'var(--text-primary)'}}>${effectiveIncome.toLocaleString()}/mo income</strong>:</span>:<span> <button onClick={()=>setShowIncomePrompt(true)} style={{color:'var(--green)',background:'none',border:'none',cursor:'pointer',textDecoration:'underline',fontSize:12}}>Add your income</button> to see personalized targets.</span>}
        </div>
        {THREE_ACCOUNTS.map(acct=>{
          const target=acct.calcTarget(effectiveIncome);
          const done=alreadySetup(acct.type);
          return(
            <div key={acct.type} style={{background:acct.bg,border:`1px solid ${acct.border}`,borderRadius:10,padding:'13px 14px',marginBottom:8}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                <span style={{fontSize:22,flexShrink:0}}>{acct.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:acct.color}}>{acct.name}</div>
                  <div style={{fontSize:10,color:acct.color,opacity:0.8}}>{acct.subtitle}</div>
                </div>
                {target&&effectiveIncome>0&&<span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,background:acct.color+'20',color:acct.color,whiteSpace:'nowrap'}}>${target.toLocaleString()} target</span>}
              </div>
              <div style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.6,marginBottom:8}}>{acct.desc}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:10}}>
                {acct.tags.map(tag=><span key={tag} style={{fontSize:10,padding:'2px 7px',borderRadius:10,fontWeight:500,background:acct.color+'14',color:acct.color}}>{tag}</span>)}
              </div>
              {done?(
                <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,color:acct.color}}>✓ Goal added to your savings tracker</div>
              ):(
                <button onClick={()=>openSetup(acct)} style={{width:'100%',padding:8,border:'none',borderRadius:7,fontSize:12,fontWeight:700,cursor:'pointer',background:acct.color,color:'#fff'}}>+ Set up {acct.name}</button>
              )}
            </div>
          );
        })}
      </div>
      {showIncomePrompt&&(
        <div style={{position:'fixed',inset:0,zIndex:3000,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
          <div style={{background:'#fff',borderRadius:14,padding:'1.5rem',width:'100%',maxWidth:360}}>
            <div style={{fontSize:16,fontWeight:700,color:'var(--text-primary)',marginBottom:8}}>What's your monthly take-home income?</div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:16,lineHeight:1.5}}>This helps us calculate personalized savings targets. We never share this information.</div>
            <input type="number" placeholder="e.g. 4200" min="0" value={incomeInput} onChange={e=>setIncomeInput(e.target.value)} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:15,marginBottom:12}}/>
            <button onClick={()=>saveIncome(incomeInput)} style={{width:'100%',padding:10,background:'var(--green)',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',marginBottom:8}}>Save</button>
            <button onClick={()=>setShowIncomePrompt(false)} style={{width:'100%',padding:8,background:'none',border:'none',color:'var(--text-muted)',fontSize:12,cursor:'pointer',textDecoration:'underline'}}>Cancel</button>
          </div>
        </div>
      )}
      {setupModal&&(
        <div style={{position:'fixed',inset:0,zIndex:3000,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
          <div style={{background:'#fff',borderRadius:14,padding:'1.5rem',width:'100%',maxWidth:400,maxHeight:'90vh',overflowY:'auto'}}>
            {setupDone?(
              <div style={{textAlign:'center',padding:'0.5rem 0'}}>
                <div style={{fontSize:36,marginBottom:10}}>🎉</div>
                <div style={{fontSize:16,fontWeight:700,color:'var(--text-primary)',marginBottom:6}}>{setupModal.acct.name} created!</div>
                <div style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.6,marginBottom:20}}>
                  Your goal is set and showing in your savings tracker.{' '}
                  {setupModal.repChoice==='yes'?'Your financial professional has been notified and will reach out to you soon.':"You're all set — start contributing whenever you're ready."}
                </div>
                <button onClick={()=>setSetupModal(null)} style={{width:'100%',padding:11,background:setupModal.acct.color,color:'#fff',border:'none',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer'}}>Done</button>
              </div>
            ):(
              <>
                <div style={{textAlign:'center',marginBottom:14}}>
                  <div style={{fontSize:30,marginBottom:6}}>{setupModal.acct.icon}</div>
                  <div style={{fontSize:16,fontWeight:700,color:'var(--text-primary)',marginBottom:4}}>{setupModal.acct.name}</div>
                  <div style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.5}}>{setupModal.acct.type==='wealth'?'Building wealth doesn\'t happen by accident. It starts with knowing your number.':'Set your savings goal and track your progress.'}</div>
                </div>
                {setupModal.acct.type==='wealth'?(
                  <>
                    <div style={{background:'#f0f4ff',border:'1px solid rgba(99,102,241,0.2)',borderRadius:8,padding:'10px 12px',marginBottom:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#4338ca',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>💡 Your Financial Independence Number (FIN)</div>
                      <div style={{fontSize:11,color:'#4338ca',lineHeight:1.6,marginBottom:8}}>The amount you need saved to live off your investments indefinitely — calculated as <strong>25× your annual expenses</strong>.</div>
                      <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:6}}>Adjust your monthly income to calculate your FIN:</div>
                      <div style={{display:'flex',alignItems:'center',gap:8,background:'#fff',border:'1px solid rgba(99,102,241,0.2)',borderRadius:8,padding:'8px 12px',marginBottom:8}}>
                        <span style={{fontSize:13,color:'var(--text-muted)'}}>$</span>
                        <input type="number" min="0" step="100" placeholder="Monthly income"
                          value={setupModal.finIncome!==undefined?setupModal.finIncome:effectiveIncome||''}
                          onChange={e=>setSetupModal(s=>({...s,finIncome:parseFloat(e.target.value)||0,targetInput:String(Math.round((parseFloat(e.target.value)||0)*12*25))}))}
                          style={{border:'none',background:'none',fontSize:15,fontWeight:700,color:'#111',width:'100%',outline:'none'}}/>
                        <span style={{fontSize:11,color:'var(--text-muted)',whiteSpace:'nowrap'}}>/mo</span>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-muted)',marginBottom:3}}>
                        <span>Annual expenses (est.)</span>
                        <span style={{fontWeight:600,color:'var(--text-primary)'}}>${((setupModal.finIncome!==undefined?setupModal.finIncome:effectiveIncome||0)*12).toLocaleString()}</span>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-muted)'}}>
                        <span>Multiplier</span><span style={{fontWeight:600,color:'var(--text-primary)'}}>× 25</span>
                      </div>
                    </div>
                    <div style={{background:'#4338ca',borderRadius:8,padding:'10px 12px',textAlign:'center',marginBottom:12}}>
                      <div style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.8)',marginBottom:2}}>Your Financial Independence Number</div>
                      <div style={{fontSize:22,fontWeight:800,color:'#fff'}}>${Math.round((setupModal.finIncome!==undefined?setupModal.finIncome:effectiveIncome||0)*12*25).toLocaleString()}</div>
                      <div style={{fontSize:11,color:'rgba(255,255,255,0.7)',marginTop:2}}>Your long-term wealth building target</div>
                    </div>
                    <div style={{background:'#fff8f0',border:'1px solid rgba(234,88,12,0.2)',borderRadius:8,padding:'10px 12px',fontSize:11,color:'#9a3412',lineHeight:1.6,marginBottom:12}}>
                      ⚠️ <strong>This doesn't happen by just saving.</strong> Building true wealth requires a strategy — the right habits and a plan tailored to your life. That's where a financial professional comes in.
                    </div>
                    <div style={{marginBottom:12}}>
                      <label style={{fontSize:12,fontWeight:600,color:'var(--text-primary)',display:'block',marginBottom:5}}>Already saving toward this? <span style={{fontWeight:400,color:'var(--text-muted)'}}>(optional)</span></label>
                      <div style={{display:'flex',alignItems:'center',gap:8,background:'#f9f9f7',border:'1px solid #e5e7eb',borderRadius:8,padding:'8px 12px'}}>
                        <span style={{fontSize:14,color:'var(--text-muted)',fontWeight:500}}>$</span>
                        <input type="number" min="0" step="1" placeholder="0" value={setupModal.savedInput} onChange={e=>setSetupModal(s=>({...s,savedInput:e.target.value}))} style={{border:'none',background:'none',fontSize:15,fontWeight:700,color:'#111',width:'100%',outline:'none'}}/>
                      </div>
                    </div>
                  </>
                ):(
                  <>
                    <div style={{background:setupModal.acct.bg,border:`1px solid ${setupModal.acct.border}`,borderRadius:8,padding:'10px 12px',fontSize:12,color:setupModal.acct.color,lineHeight:1.6,marginBottom:16}}>
                      💡 {setupModal.acct.tip}
                    </div>
                    <div style={{marginBottom:12}}>
                      <label style={{fontSize:12,fontWeight:600,color:'var(--text-primary)',display:'block',marginBottom:5}}>Goal amount</label>
                      <div style={{display:'flex',alignItems:'center',gap:8,background:'#f9f9f7',border:'1px solid #e5e7eb',borderRadius:8,padding:'8px 12px'}}>
                        <span style={{fontSize:14,color:'var(--text-muted)',fontWeight:500}}>$</span>
                        <input type="number" min="0" step="100" placeholder={setupModal.acct.calcTarget(effectiveIncome)>0?`Suggested: $${setupModal.acct.calcTarget(effectiveIncome).toLocaleString()}`:'Enter your goal'} value={setupModal.targetInput} onChange={e=>setSetupModal(s=>({...s,targetInput:e.target.value}))} style={{border:'none',background:'none',fontSize:15,fontWeight:700,color:'#111',width:'100%',outline:'none'}}/>
                      </div>
                      {setupModal.acct.calcTarget(effectiveIncome)>0&&effectiveIncome>0&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>Suggested based on your ${effectiveIncome.toLocaleString()}/mo income</div>}
                    </div>
                    <div style={{marginBottom:16}}>
                      <label style={{fontSize:12,fontWeight:600,color:'var(--text-primary)',display:'block',marginBottom:5}}>Already saved toward this? <span style={{fontWeight:400,color:'var(--text-muted)'}}>(optional)</span></label>
                      <div style={{display:'flex',alignItems:'center',gap:8,background:'#f9f9f7',border:'1px solid #e5e7eb',borderRadius:8,padding:'8px 12px'}}>
                        <span style={{fontSize:14,color:'var(--text-muted)',fontWeight:500}}>$</span>
                        <input type="number" min="0" step="1" placeholder="0" value={setupModal.savedInput} onChange={e=>setSetupModal(s=>({...s,savedInput:e.target.value}))} style={{border:'none',background:'none',fontSize:15,fontWeight:700,color:'#111',width:'100%',outline:'none'}}/>
                      </div>
                    </div>
                  </>
                )}
                <div style={{height:1,background:'#f3f4f6',margin:'14px 0'}}/>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-primary)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Want help from your financial professional?</div>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:10,lineHeight:1.5}}>{setupModal.acct.repMsg}</div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>setSetupModal(s=>({...s,repChoice:'yes'}))} style={{flex:1,padding:9,borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',border:setupModal.repChoice==='yes'?`2px solid ${setupModal.acct.color}`:'1.5px solid #e5e7eb',background:setupModal.repChoice==='yes'?setupModal.acct.bg:'#fff',color:setupModal.repChoice==='yes'?setupModal.acct.color:'#6b7280'}}>
                      👋 Yes, reach out to me
                    </button>
                    <button onClick={()=>setSetupModal(s=>({...s,repChoice:'no'}))} style={{flex:1,padding:9,borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',border:setupModal.repChoice==='no'?'2px solid #e5e7eb':'1.5px solid #e5e7eb',background:setupModal.repChoice==='no'?'#f9f9f7':'#fff',color:'#6b7280'}}>
                      Not right now
                    </button>
                  </div>
                  {setupModal.repChoice==='yes'&&<div style={{fontSize:11,color:setupModal.acct.color,marginTop:8}}>✅ Your financial professional will be notified and reach out soon.</div>}
                  {setupModal.repChoice==='no'&&<div style={{fontSize:11,color:'#9ca3af',marginTop:8}}>No problem — you can always reach out to them whenever you are ready.</div>}
                </div>
                <button onClick={confirmSetup} style={{width:'100%',padding:11,background:setupModal.acct.color,color:'#fff',border:'none',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer',marginBottom:8}}>Create Goal</button>
                <button onClick={()=>setSetupModal(null)} style={{width:'100%',padding:8,background:'none',border:'none',color:'var(--text-muted)',fontSize:12,cursor:'pointer',textDecoration:'underline'}}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}
      <div className="card">
        <div className="card-title">Add savings goal</div>
        <div className="form-row r4">
          <input placeholder="Goal name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
          <input type="number" placeholder="Target ($)" min="0" step="100" value={form.target} onChange={e=>setForm(f=>({...f,target:e.target.value}))}/>
          <input type="number" placeholder="Already saved ($)" min="0" step="1" value={form.saved} onChange={e=>setForm(f=>({...f,saved:e.target.value}))}/>
          <button className="btn-gold" style={{alignSelf:'end'}} onClick={addGoal}>+ Add goal</button>
        </div>
      </div>
      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
          <div className="card-title" style={{marginBottom:0}}>Your savings goals</div>
          {goals.length>0&&<ClearBtn label="Clear all" onClear={()=>setGoals([])} title="Clear all goals?" message="This will permanently delete all your savings goals." />}
        </div>
        {goals.length===0?<div className="empty-state">Add a goal above — emergency fund, vacation, down payment…</div>:goals.map(g=>{
          const pct=Math.min(100,Math.round(g.saved/g.target*100));
          const barC=pct>=100?'#16a34a':pct>=50?'var(--green)':'#0ea5e9';
          return(
            <div key={g.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderBottom:'1px solid var(--border-light)'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontFamily:'var(--font-display)',fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>{g.name}</span>
                  <span style={{fontSize:12,color:'var(--text-muted)'}}>${Math.max(0,g.target-g.saved).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})} to go</span>
                </div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:5}}>${g.saved.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})} of ${g.target.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}</div>
                <div className="goal-bar-track"><div className="goal-bar-fill" style={{width:`${pct}%`,background:barC}}/></div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:16,fontWeight:700,color:barC}}>{pct}%</div>
                <div style={{display:'flex',gap:4,marginTop:6,alignItems:'center'}}>
                  <input
                    type="number" min="0" step="1"
                    placeholder="Add amount"
                    id={`savings-add-${g.id}`}
                    style={{width:90,fontSize:12,padding:'4px 8px',borderRadius:6,border:'1px solid #e5e7eb'}}
                  />
                  <button
                    style={{fontSize:11,fontWeight:700,padding:'4px 10px',background:'var(--green)',color:'#fff',border:'none',borderRadius:6,cursor:'pointer'}}
                    onClick={()=>{
                      const input=document.getElementById(`savings-add-${g.id}`);
                      const addAmt=Math.max(0,parseFloat(input.value)||0);
                      if(!addAmt){alert('Enter an amount to add.');return;}
                      const newSaved=g.saved+addAmt;
                      const updated=goals.map(x=>x.id===g.id?{...x,saved:newSaved}:x);
                      setGoals(updated);
                      input.value='';
                      if(newSaved>=g.target&&g.saved<g.target&&onMilestone){
                        onMilestone({icon:'🏆',title:`${g.name} Complete!`,message:`Amazing! You hit your $${g.target.toLocaleString()} goal. Your future self thanks you! 🎉`});
                      }
                    }}
                  >Add</button>
                </div>
                <button className="btn-danger" style={{display:'block',marginTop:4,width:'100%'}} onClick={()=>setGoals(goals.filter(x=>x.id!==g.id))}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="card">
        <div className="card-title">Savings transactions — this month</div>
        {savTxs.length===0?<div className="empty-state">No savings transactions this month.</div>:(
          <table>
            <thead><tr><th style={{width:70}}>Date</th><th>Description</th><th style={{width:130}}>Category</th><th style={{width:90,textAlign:'right'}}>Amount</th></tr></thead>
            <tbody>
              {savTxs.map(t=>{
                const ci=ALL_CATS[t.cat]||{color:'var(--green)',bg:'var(--green-light)'};
                return(<tr key={t.id}><td style={{fontSize:11}}>{new Date(t.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</td><td>{t.desc}</td><td><span className="badge" style={{background:ci.bg,color:ci.color}}>{t.cat}</span></td><td style={{textAlign:'right',fontWeight:600,color:'var(--green)'}}>+${t.amt.toFixed(2)}</td></tr>);
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
function CashPopup({onClose}){
  return(
    <div className="modal-overlay" style={{zIndex:2000}}>
      <div className="modal-box slide-up" style={{maxWidth:500}}>
        <div style={{textAlign:'center',marginBottom:'1.5rem'}}>
          <div style={{fontSize:48,marginBottom:12}}>💵</div>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:24,marginBottom:10,color:'var(--text-primary)'}}>Cash Spending Tracker</h2>
          <p style={{fontSize:14,color:'var(--text-muted)',lineHeight:1.7}}>Cash feels simple — but it's actually the <strong style={{color:'var(--text-primary)'}}>hardest money to track.</strong></p>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:'1.75rem'}}>
          <div style={{background:'rgba(14,165,233,0.06)',border:'1px solid rgba(14,165,233,0.2)',borderRadius:'var(--radius-md)',padding:'12px 16px',display:'flex',gap:12}}>
            <span style={{fontSize:20,flexShrink:0}}>🤔</span>
            <div style={{fontSize:13,color:'var(--slate)',lineHeight:1.6}}>You pull $200 from the ATM. A week later it's gone. <strong style={{color:'var(--text-primary)'}}>Where did it go?</strong></div>
          </div>
          <div style={{background:'rgba(22,163,74,0.06)',border:'1px solid rgba(22,163,74,0.15)',borderRadius:'var(--radius-md)',padding:'12px 16px',display:'flex',gap:12}}>
            <span style={{fontSize:20,flexShrink:0}}>✅</span>
            <div style={{fontSize:13,color:'var(--slate)',lineHeight:1.6}}>This tab fixes that. <strong style={{color:'#16a34a'}}>Log every cash purchase here.</strong></div>
          </div>
          <div style={{background:'var(--green-light)',border:'1px solid var(--green-mid)',borderRadius:'var(--radius-md)',padding:'12px 16px',display:'flex',gap:12}}>
            <span style={{fontSize:20,flexShrink:0}}>💡</span>
            <div style={{fontSize:13,color:'var(--slate)',lineHeight:1.6}}><strong style={{color:'var(--green)'}}>Pro tip:</strong> Log cash right when you spend it. $3 coffee = $90/month.</div>
          </div>
        </div>
        <button className="btn-gold" style={{width:'100%',padding:'13px',fontSize:14}} onClick={onClose}>Got it — let me start tracking my cash 💪</button>
      </div>
    </div>
  );
}

function CashTab({transactions,setTransactions}){
  const CASH_CATS=GROUPS['Cash Spending'].cats;
  const [form,setForm]=useState({date:new Date().toISOString().split('T')[0],desc:'',cat:CASH_CATS[0],amt:''});
  const [err,setErr]=useState({});
  const n=new Date();const m=n.getMonth();const y=n.getFullYear();
  const cashTxs=transactions.filter(t=>t.grp==='Cash Spending'&&t.type==='debit');
  const monthCash=cashTxs.filter(t=>{const d=new Date(t.date+'T00:00:00');return d.getMonth()===m&&d.getFullYear()===y;});
  const totalMonth=monthCash.reduce((s,t)=>s+t.amt,0);
  const totalAll=cashTxs.reduce((s,t)=>s+t.amt,0);
  const catTotals={};monthCash.forEach(t=>{catTotals[t.cat]=(catTotals[t.cat]||0)+t.amt;});
  const catList=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
  const maxVal=catList[0]?.[1]||1;
  const addCash=()=>{
    const e={};
    if(!form.date)e.date=true;
    if(!form.desc.trim())e.desc=true;
    if(!form.amt||isNaN(parseFloat(form.amt))||parseFloat(form.amt)<=0)e.amt=true;
    if(Object.keys(e).length){setErr(e);return;}
    const updated=[{id:Date.now(),date:form.date,desc:form.desc.trim(),type:'debit',grp:'Cash Spending',cat:form.cat,amt:parseFloat(form.amt),note:'',refNum:''},...transactions];
    updated.sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
    setTransactions(updated);
    setForm(f=>({...f,desc:'',amt:''}));setErr({});
  };
  return(
    <>
      <div className="metric-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
        <div className="metric-card"><div className="lbl">Cash spent this month</div><div className="val" style={{color:'#0ea5e9'}}>${totalMonth.toFixed(2)}</div></div>
        <div className="metric-card"><div className="lbl">Transactions (month)</div><div className="val val-gold">{monthCash.length}</div></div>
        <div className="metric-card"><div className="lbl">Total cash tracked</div><div className="val val-teal">${totalAll.toFixed(2)}</div></div>
      </div>
      <div className="card">
        <div className="card-title">Log a cash purchase</div>
        <div className="form-row r3">
          <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={err.date?{borderColor:'#dc2626'}:{}}/>
          <input type="text" placeholder="What did you buy?" value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} style={err.desc?{borderColor:'#dc2626'}:{}} onKeyDown={e=>e.key==='Enter'&&addCash()}/>
          <select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))}>
            {CASH_CATS.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <input type="number" placeholder="Amount ($)" min="0" step="0.01" value={form.amt} onChange={e=>setForm(f=>({...f,amt:e.target.value}))} style={{maxWidth:180,...(err.amt?{borderColor:'#dc2626'}:{})}} onKeyDown={e=>e.key==='Enter'&&addCash()}/>
          <button className="btn-gold" onClick={addCash}>+ Log cash</button>
        </div>
      </div>
      {catList.length>0&&(
        <div className="card">
          <div className="card-title">Where your cash went this month</div>
          {catList.map(([cat,val])=>(
            <div key={cat} className="cat-row">
              <div className="cat-label" title={cat}>{cat.replace('Cash - ','')}</div>
              <div className="cat-track"><div className="cat-fill" style={{width:`${Math.round((val/maxVal)*100)}%`,background:'#0ea5e9'}}/></div>
              <div className="cat-val" style={{color:'#0ea5e9'}}>${val.toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
          <div className="card-title" style={{marginBottom:0}}>Cash purchase history</div>
          {cashTxs.length>0&&<ClearBtn label="Clear all" onClear={()=>setTransactions(transactions.filter(t=>t.grp!=='Cash Spending'))} title="Clear all cash transactions?" message="This will permanently delete all cash purchase history." />}
        </div>
        {cashTxs.length===0?<div className="empty-state">No cash purchases logged yet!</div>:(
          <table>
            <thead><tr><th style={{width:70}}>Date</th><th>Description</th><th style={{width:140}}>Category</th><th style={{width:80,textAlign:'right'}}>Amount</th><th style={{width:28}}></th></tr></thead>
            <tbody>
              {cashTxs.map(t=>(
                <tr key={t.id}>
                  <td style={{fontSize:11}}>{new Date(t.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</td>
                  <td>{t.desc}</td>
                  <td><span className="badge" style={{background:'rgba(14,165,233,0.1)',color:'#0ea5e9'}}>{t.cat.replace('Cash - ','')}</span></td>
                  <td style={{textAlign:'right',fontWeight:600,color:'#0ea5e9'}}>${t.amt.toFixed(2)}</td>
                  <td><button className="btn-danger" onClick={()=>setTransactions(transactions.filter(x=>x.id!==t.id))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function TimelineTab({debts, extraPayment, setExtraPayment, payoffTargetId, setPayoffTargetId}){
  const extra = extraPayment || '';
  const setExtra = setExtraPayment;
  const extraAmt=parseFloat(extra)||0;
  const avalanche=[...debts].sort((a,b)=>b.rate-a.rate);
  // If the user picked a specific debt to target, that one goes first (gets the extra payment);
  // everything else stays in avalanche (highest-rate-first) order behind it.
  const targeted = debts.find(d=>String(d.id)===String(payoffTargetId));
  const sorted = targeted ? [targeted, ...avalanche.filter(d=>d.id!==targeted.id)] : avalanche;
  let freed=0;
  const results=sorted.map((d,i)=>{
    const mr=d.rate/100/12;const pmt=d.min+(i===0?extraAmt:0)+freed;
    let bal=d.bal,months=0,totalPaid=0;
    if(mr===0){months=Math.ceil(bal/pmt);totalPaid=months*pmt;}
    else{while(bal>0&&months<600){const int=bal*mr;const prin=Math.min(pmt-int,bal);if(prin<=0){months=9999;break;}bal-=prin;totalPaid+=pmt;months++;}}
    freed+=d.min;
    return{name:d.name,months,interest:Math.max(0,totalPaid-d.bal),rate:d.rate,min:d.min};
  });
  const tm=results[results.length-1]?.months||0;
  const ti=results.reduce((s,r)=>s+r.interest,0);
  const fmtMo=m=>m>=9999?'Never':m>12?`${Math.floor(m/12)}y ${m%12}mo`:`${m}mo`;
  return(
    <>
      <div className="card">
        <div className="card-title">Extra monthly payment toward chosen debt</div>
        <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <input type="number" placeholder="Extra payment ($/mo)" min="0" step="10" value={extra} style={{maxWidth:220}} onChange={e=>setExtra(e.target.value)}/>
          <span style={{fontSize:13,color:'var(--text-muted)'}}>beyond minimums</span>
        </div>
        {debts.length>0&&<div style={{marginTop:12}}>
          <label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Apply extra payment to</label>
          <select value={payoffTargetId||''} onChange={e=>setPayoffTargetId(e.target.value)} style={{maxWidth:280}}>
            <option value="">Highest interest rate first (default)</option>
            {debts.map(d=><option key={d.id} value={d.id}>{d.name} ({d.rate.toFixed(2)}%)</option>)}
          </select>
        </div>}
      </div>
      <div className="card">
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
          <span style={{fontSize:20}}>💡</span>
          <div style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.6}}>Add an extra payment above to accelerate payoff and see how much interest you save. Even <strong style={{color:'var(--text-primary)'}}>$50/month extra</strong> can cut years off your debt and save thousands in interest.</div>
        </div>
      </div>
      {debts.length===0?<div className="card"><div className="empty-state">Add debts in the Debt Stack tab first.</div></div>:(
        <div className="card">
          <div className="card-title">Payoff timeline</div>
          <div className="metric-grid" style={{gridTemplateColumns:'1fr 1fr',marginBottom:'1.25rem'}}>
            <div className="metric-card"><div className="lbl">Debt-free in</div><div className={`val ${tm>=9999?'val-red':'val-green'}`}>{fmtMo(tm)}</div></div>
            <div className="metric-card"><div className="lbl">Total interest paid</div><div className="val val-red">${ti.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
          </div>
          {results.map((r,i)=>(
            <div key={i} style={{display:'flex',alignItems:'baseline',gap:10,padding:'8px 0',borderBottom:'1px solid var(--border-light)'}}>
              <div style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:800,color:'var(--green)',minWidth:32}}>#{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>{r.name}</div>
                <div style={{fontSize:12,color:'var(--text-muted)'}}>{r.rate.toFixed(2)}% APR · min ${r.min.toFixed(2)}/mo</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:15,fontWeight:700,color:'var(--text-primary)'}}>{fmtMo(r.months)}</div>
                <div style={{fontSize:12,fontWeight:600,color:'#16a34a'}}>${r.interest.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})} interest</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function SpendingTab({transactions,periodMode,setPeriodMode,periodOffset,setPeriodOffset,budgets,bills}){
  const donutRef=useRef(null);
  const chartRef=useRef(null);
  const barRef=useRef(null);
  const barChartRef=useRef(null);
  const getPeriodBounds=(mode,offset)=>{
    const now=new Date();let start,end,label;
    if(mode==='monthly'){const d=new Date(now.getFullYear(),now.getMonth()+offset,1);start=new Date(d.getFullYear(),d.getMonth(),1);end=new Date(d.getFullYear(),d.getMonth()+1,0);label=start.toLocaleDateString('en-US',{month:'long',year:'numeric'});}
    else if(mode==='quarterly'){const bq=Math.floor(now.getMonth()/3)+offset;const yr=now.getFullYear()+Math.floor(bq/4);const q=((bq%4)+4)%4;start=new Date(yr,q*3,1);end=new Date(yr,q*3+3,0);label=`${'Q1Q2Q3Q4'.substr(q*2,2)} ${yr}`;}
    else{const yr=now.getFullYear()+offset;start=new Date(yr,0,1);end=new Date(yr,11,31);label=`${yr}`;}
    return{start,end,label};
  };
  const{start,end,label}=getPeriodBounds(periodMode,periodOffset);
  const txDebits=transactions.filter(t=>{const d=new Date(t.date+'T00:00:00');return t.type==='debit'&&d>=start&&d<=end;});
  const txCredits=transactions.filter(t=>{const d=new Date(t.date+'T00:00:00');return t.type==='credit'&&d>=start&&d<=end;});
  const curr={};const counts={};
  txDebits.forEach(t=>{curr[t.cat]=(curr[t.cat]||0)+t.amt;counts[t.cat]=(counts[t.cat]||0)+1;});
  const totalSpent=Object.values(curr).reduce((s,v)=>s+v,0);
  const totalIncome=txCredits.reduce((s,t)=>s+t.amt,0);
  const net=totalIncome-totalSpent;
  const cats=Object.entries(curr).sort((a,b)=>b[1]-a[1]);
  const byGrp={};cats.forEach(([cat,val])=>{const g=ALL_CATS[cat]?.group||'Other';if(!byGrp[g])byGrp[g]=[];byGrp[g].push([cat,val]);});
  const maxV=cats[0]?.[1]||1;
  const count=periodMode==='yearly'?5:6;
  const trendData=[];
  for(let i=-(count-1);i<=0;i++){
    const{start:s,end:e,label:l}=getPeriodBounds(periodMode,periodOffset+i);
    const tot=transactions.filter(t=>{const d=new Date(t.date+'T00:00:00');return t.type==='debit'&&d>=s&&d<=e;}).reduce((s,t)=>s+t.amt,0);
    trendData.push({label:l.replace(' 20',"'"),value:parseFloat(tot.toFixed(2)),current:i===0});
  }
  const maxTrend=Math.max(...trendData.map(d=>d.value),1);

  const CHART_COLORS=['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#4a3aa7','#e34948','#898781'];

  useEffect(()=>{
    if(!donutRef.current||cats.length===0) return;
    const loadChart=()=>{
      if(!window.Chart) return;
      if(chartRef.current) chartRef.current.destroy();
      const topCats=cats.slice(0,7);
      const otherVal=cats.slice(7).reduce((s,[,v])=>s+v,0);
      const labels=topCats.map(([c])=>c);
      const data=topCats.map(([,v])=>v);
      if(otherVal>0){labels.push('Other');data.push(otherVal);}
      chartRef.current=new window.Chart(donutRef.current,{
        type:'doughnut',
        data:{labels,datasets:[{data,backgroundColor:CHART_COLORS.slice(0,labels.length),borderWidth:2,borderColor:'#ffffff'}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.label}: $${ctx.raw.toFixed(2)} (${totalSpent>0?((ctx.raw/totalSpent)*100).toFixed(1):0}%)`}}},cutout:'65%'}
      });
    };
    if(window.Chart){loadChart();}
    else{
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
      s.onload=loadChart;
      document.head.appendChild(s);
    }
    return()=>{if(chartRef.current){chartRef.current.destroy();chartRef.current=null;}};
  },[cats,totalSpent]);

  useEffect(()=>{
    if(!barRef.current||trendData.every(d=>d.value===0)) return;
    const loadBar=()=>{
      if(!window.Chart) return;
      if(barChartRef.current) barChartRef.current.destroy();
      barChartRef.current=new window.Chart(barRef.current,{
        type:'bar',
        data:{
          labels:trendData.map(d=>d.label),
          datasets:[{
            data:trendData.map(d=>d.value),
            backgroundColor:trendData.map(d=>d.current?'#2a6b4a':'rgba(42,107,74,0.25)'),
            borderRadius:4,borderSkipped:false
          }]
        },
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>'$'+ctx.raw.toLocaleString()}}},scales:{x:{grid:{display:false},ticks:{color:'#898781',font:{size:11}}},y:{grid:{color:'rgba(0,0,0,0.06)'},ticks:{color:'#898781',font:{size:11},callback:v=>'$'+v.toLocaleString()}}}}
      });
    };
    if(window.Chart){loadBar();}
    else{
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
      s.onload=loadBar;
      document.head.appendChild(s);
    }
    return()=>{if(barChartRef.current){barChartRef.current.destroy();barChartRef.current=null;}};
  },[trendData]);

  const budgetVsActual=useMemo(()=>{
    if(!budgets) return[];
    return Object.entries(budgets).map(([cat,limit])=>{
      const spent=curr[cat]||0;
      const pct=limit>0?Math.min((spent/limit)*100,100):0;
      const over=spent>limit;
      return{cat,limit,spent,pct,over};
    }).filter(b=>b.limit>0).sort((a,b)=>b.spent-a.spent);
  },[budgets,curr]);

  const exportMonthlySummary=()=>{
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>MoneyMap Summary — ${label}</title><style>body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;color:var(--text-primary);background:#fff}h1{color:var(--green);border-bottom:2px solid var(--green);padding-bottom:10px}h2{color:var(--slate);margin-top:24px;font-size:16px}.metric{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px 20px;margin:6px;text-align:center}.metric .val{font-size:24px;font-weight:800;color:var(--green)}.metric .lbl{font-size:11px;color:var(--text-muted);text-transform:uppercase}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:var(--bg);padding:8px;text-align:left;font-size:12px;color:var(--text-muted);text-transform:uppercase}td{padding:8px;border-bottom:1px solid var(--border-light);font-size:13px}.green{color:#16a34a}.red{color:#dc2626}</style></head><body><h1>💰 MoneyMap Monthly Summary</h1><h2>${label}</h2><div><div class="metric"><div class="val">$${totalIncome.toFixed(2)}</div><div class="lbl">Income</div></div><div class="metric"><div class="val red">$${totalSpent.toFixed(2)}</div><div class="lbl">Spent</div></div><div class="metric"><div class="val ${net>=0?'green':'red'}">${net<0?'-':''}$${Math.abs(net).toFixed(2)}</div><div class="lbl">Net ${net>=0?'Surplus':'Deficit'}</div></div></div><h2>Spending by Category</h2><table><tr><th>Category</th><th>Group</th><th>Transactions</th><th>Total</th><th>% of Spending</th></tr>${cats.map(([cat,val])=>`<tr><td>${cat}</td><td>${ALL_CATS[cat]?.group||'Other'}</td><td>${counts[cat]||0}</td><td>$${val.toFixed(2)}</td><td>${totalSpent>0?((val/totalSpent)*100).toFixed(1):0}%</td></tr>`).join('')}</table><p style="margin-top:30px;font-size:11px;color:var(--text-muted);text-align:center">Generated by MoneyMap — ${new Date().toLocaleDateString()}</p></body></html>`;
    const blob=new Blob([html],{type:'text/html'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`MoneyMap_${label.replace(' ','_')}.html`;a.click();
  };

  return(
    <>
      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,marginBottom:'1rem'}}>
          <div className="card-title" style={{marginBottom:0}}>Spending report</div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <div className="pb-bar">
              {['monthly','quarterly','yearly'].map(mode=>(
                <button key={mode} className={`pb ${periodMode===mode?'active':''}`} onClick={()=>{setPeriodMode(mode);setPeriodOffset(0);}}>{mode.charAt(0).toUpperCase()+mode.slice(1)}</button>
              ))}
            </div>
            <button className="btn-outline" style={{fontSize:11}} onClick={exportMonthlySummary}>📤 Export Summary</button>
          </div>
        </div>
        <div className="period-nav">
          <button onClick={()=>setPeriodOffset(o=>o-1)}>‹</button>
          <div className="period-label">{label}</div>
          <button onClick={()=>setPeriodOffset(o=>o+1)}>›</button>
        </div>
      </div>
      <div className="metric-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
        <div className="metric-card"><div className="lbl">Total spent</div><div className="val val-red">${totalSpent.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
        <div className="metric-card"><div className="lbl">Income</div><div className={`val ${totalIncome>0?'val-green':'val-red'}`}>${totalIncome.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
        <div className="metric-card"><div className="lbl">Net {net>=0?'surplus':'deficit'}</div><div className={`val ${net>=0?'val-teal':'val-red'}`}>{net<0?'-':''}${Math.abs(net).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
      </div>
      {cats.length>0&&(
        <div className="card">
          <div className="card-title">Where your money went</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,alignItems:'start'}}>
            <div>
              <div style={{position:'relative',width:'100%',height:180}}>
                <canvas ref={donutRef} role="img" aria-label="Donut chart of spending by category"/>
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {cats.slice(0,7).map(([cat,val],i)=>(
                <div key={cat} style={{display:'flex',alignItems:'center',gap:6,fontSize:12}}>
                  <span style={{width:10,height:10,borderRadius:2,background:CHART_COLORS[i],flexShrink:0}}/>
                  <span style={{flex:1,color:'var(--text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cat}</span>
                  <span style={{fontWeight:500,color:'var(--text-primary)',flexShrink:0}}>{totalSpent>0?((val/totalSpent)*100).toFixed(0):0}%</span>
                </div>
              ))}
              {cats.length>7&&<div style={{fontSize:11,color:'var(--text-muted)'}}>{cats.length-7} more categories…</div>}
            </div>
          </div>
        </div>
      )}

      {budgetVsActual.length>0&&(
        <div className="card">
          <div className="card-title">Budget vs actual</div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {budgetVsActual.map(({cat,limit,spent,pct,over})=>(
              <div key={cat}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                  <span style={{color:'var(--text-secondary)'}}>{cat}</span>
                  <span style={{fontWeight:600,color:over?'#dc2626':'var(--text-primary)'}}>
                    ${spent.toFixed(2)} / ${limit.toFixed(2)}{over&&' — over'}
                  </span>
                </div>
                <div style={{height:6,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:3,background:over?'#dc2626':'#2a6b4a',width:`${pct}%`,transition:'width 0.4s ease'}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Spending by category — {label}</div>
        {cats.length===0?<div className="empty-state">No expenses in this period.</div>:(
          Object.entries(byGrp).map(([g,items])=>{
            const gv=GROUPS[g];
            return(
              <div key={g} style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:600,color:gv?.color||'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>{g}</div>
                {items.map(([cat,val])=>(
                  <div key={cat} className="cat-row">
                    <div className="cat-label" title={cat}>{cat}</div>
                    <div className="cat-track"><div className="cat-fill" style={{width:`${Math.round((val/maxV)*100)}%`,background:ALL_CATS[cat]?.color||'#6b7280'}}/></div>
                    <div className="cat-val">${val.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
      <div className="card">
        <div className="card-title">Category breakdown</div>
        <table>
          <thead><tr><th>Group</th><th>Category</th><th style={{width:50}}>Count</th><th style={{width:82,textAlign:'right'}}>Total</th><th style={{width:56,textAlign:'right'}}>%</th></tr></thead>
          <tbody>
            {cats.length===0?<tr><td colSpan={5} className="empty-state">No data for this period.</td></tr>:cats.map(([cat,val])=>{
              const g=ALL_CATS[cat]?.group||'Other';const gv=GROUPS[g];
              return(<tr key={cat}><td><span className="grp-badge" style={{background:gv?.bg||'rgba(107,114,128,0.1)',color:gv?.color||'#6b7280'}}>{g}</span></td><td style={{fontSize:12}}>{cat}</td><td>{counts[cat]||0}</td><td style={{textAlign:'right',fontWeight:600}}>${val.toFixed(2)}</td><td style={{textAlign:'right'}}>{totalSpent>0?((val/totalSpent)*100).toFixed(1):0}%</td></tr>);
            })}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="card-title">Spending trend</div>
        {trendData.every(d=>d.value===0)?(
          <div className="empty-state">Add transactions to see your spending trend.</div>
        ):(
          <div style={{position:'relative',width:'100%',height:180}}>
            <canvas ref={barRef} role="img" aria-label="Bar chart of spending trend over time"/>
          </div>
        )}
      </div>
    </>
  );
}

function MovePicker({accounts,currentAccount,onMove}){
  const [show,setShow]=useState(false);
  const [menuPos,setMenuPos]=useState({top:0,left:0,right:'auto'});
  const btnRef=useRef(null);
  const menuRef=useRef(null);
  const others=Object.entries(accounts).filter(([k])=>k!==currentAccount);

  useEffect(()=>{
    if(!show)return;
    const reposition=()=>{
      if(!btnRef.current)return;
      const rect=btnRef.current.getBoundingClientRect();
      const menuWidth=150;
      const menuHeight=others.length*36+30;
      const vw=window.innerWidth;
      const vh=window.innerHeight;
      let left=rect.left;
      let top=rect.bottom+4;
      // flip right if overflows right edge
      if(left+menuWidth>vw-8) left=rect.right-menuWidth;
      // clamp left edge
      if(left<8) left=8;
      // flip above if overflows bottom
      if(top+menuHeight>vh-8) top=rect.top-menuHeight-4;
      setMenuPos({top,left});
    };
    reposition();
    window.addEventListener('scroll',reposition,true);
    window.addEventListener('resize',reposition);
    return()=>{
      window.removeEventListener('scroll',reposition,true);
      window.removeEventListener('resize',reposition);
    };
  },[show,others.length]);

  useEffect(()=>{
    if(!show)return;
    const handleClick=e=>{
      if(btnRef.current&&btnRef.current.contains(e.target))return;
      if(menuRef.current&&menuRef.current.contains(e.target))return;
      setShow(false);
    };
    document.addEventListener('mousedown',handleClick);
    return()=>document.removeEventListener('mousedown',handleClick);
  },[show]);

  if(others.length===0)return null;

  if(others.length===1){
    return(
      <button onClick={()=>onMove(others[0][0])} style={{background:'rgba(124,58,237,0.1)',color:'#7c3aed',border:'1px solid rgba(124,58,237,0.2)',borderRadius:'var(--radius-sm)',padding:'3px 7px',fontSize:11,cursor:'pointer'}} title={`Move to ${others[0][1].name}`}>↗</button>
    );
  }

  return(
    <div style={{display:'inline-block'}}>
      <button ref={btnRef} onClick={()=>setShow(s=>!s)} style={{background:'rgba(124,58,237,0.1)',color:'#7c3aed',border:'1px solid rgba(124,58,237,0.2)',borderRadius:'var(--radius-sm)',padding:'3px 7px',fontSize:11,cursor:'pointer'}}>↗</button>
      {show&&(
        <div ref={menuRef} style={{position:'fixed',top:menuPos.top,left:menuPos.left,background:'#fff',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',boxShadow:'0 4px 20px var(--green-mid)',zIndex:9999,minWidth:150,marginTop:0}}>
          <div style={{fontSize:10,color:'var(--text-muted)',padding:'6px 10px 4px',fontWeight:600,textTransform:'uppercase',borderBottom:'1px solid var(--border-light)'}}>Move to</div>
          {others.map(([k,a])=>(
            <div key={k} onMouseDown={()=>{onMove(k);setShow(false);}} style={{padding:'9px 12px',fontSize:12,color:'var(--text-primary)',cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              {a.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ── Variable Bills Section ─────────────────────────────────────
const VAR_BILL_CATS = ['Electric','Gas / heat','Water','Internet (variable)','Other utility'];

function VarBillsSection({varBills=[],setVarBills,varBillsPaid={},setVarBillsPaid,accounts,activeAccount,setAccounts,saveToFirebase}){
  const [form,setForm]=useState({name:'',category:'Electric',dueDay:1});
  const [editingAmount,setEditingAmount]=useState(null); // bill id
  const [amountInput,setAmountInput]=useState('');
  const now=new Date();
  const monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const daySuffix=d=>{if(d>=11&&d<=13)return`${d}th`;const s=['th','st','nd','rd'];return`${d}${s[d%10]||'th'}`;};

  const addVarBill=()=>{
    if(!form.name.trim())return;
    setVarBills([...varBills,{id:Date.now(),name:form.name.trim(),category:form.category,dueDay:form.dueDay}]);
    setForm({name:'',category:'Electric',dueDay:1});
  };

  const isPaid=(id)=>!!varBillsPaid[`${monthKey}_${id}`];
  const getPaidAmount=(id)=>varBillsPaid[`${monthKey}_${id}`]?.amount||null;

  const markPaid=(bill,amount)=>{
    const amt=parseFloat(amount)||0;
    const key=`${monthKey}_${bill.id}`;
    const targetAcct=accounts[activeAccount];
    let updatedTxs=targetAcct.transactions||[];
    let txId=null;
    // Only create a transaction (and deduct from balance) when a real amount is entered —
    // "Mark paid" with amount still TBD just flags it paid, nothing to deduct yet.
    if(amt>0){
      const newTx={id:Date.now(),date:now.toISOString().split('T')[0],desc:bill.name,type:'debit',grp:'Housing',cat:bill.category||'Other',amt,note:'Variable bill',refNum:''};
      txId=newTx.id;
      updatedTxs=[newTx,...updatedTxs];
      updatedTxs.sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
    }
    const updatedVarBillsPaid={...varBillsPaid,[key]:{amount:amt,date:now.toISOString(),txId}};
    const updatedAccounts={...accounts,[activeAccount]:{...accounts[activeAccount],varBillsPaid:updatedVarBillsPaid,transactions:updatedTxs}};
    setAccounts(updatedAccounts);
    saveToFirebase(updatedAccounts);
    setEditingAmount(null);
    setAmountInput('');
  };

  const unmarkPaid=(bill)=>{
    const key=`${monthKey}_${bill.id}`;
    const paidRecord=varBillsPaid[key];
    const updatedVarBillsPaid={...varBillsPaid};
    delete updatedVarBillsPaid[key];
    let updatedTxs=accounts[activeAccount].transactions||[];
    if(paidRecord?.txId)updatedTxs=updatedTxs.filter(t=>t.id!==paidRecord.txId);
    const updatedAccounts={...accounts,[activeAccount]:{...accounts[activeAccount],varBillsPaid:updatedVarBillsPaid,transactions:updatedTxs}};
    setAccounts(updatedAccounts);
    saveToFirebase(updatedAccounts);
  };

  const catIcon={Electric:'⚡',['Gas / heat']:'🔥',Water:'💧',['Internet (variable)']:'🌐',['Other utility']:'🏠'};

  const getDueStatus=(dueDay)=>{
    const today=now.getDate();
    const diff=dueDay-today;
    if(diff<0)return'overdue';
    if(diff<=3)return'due-soon';
    return'upcoming';
  };

  return(
    <div className="card" style={{marginTop:14}}>
      <div className="card-title">Variable bills</div>
      <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:14,lineHeight:1.6}}>
        Bills that change every month — electric, gas, water. Set the due date and we'll remind you on the calendar. Enter the actual amount when the bill arrives.
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr auto',gap:8,marginBottom:14,alignItems:'end'}}>
        <div>
          <label style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:4}}>Bill name</label>
          <input placeholder="e.g. Evergy Electric" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addVarBill()}/>
        </div>
        <div>
          <label style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:4}}>Category</label>
          <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
            {VAR_BILL_CATS.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:4}}>Due day</label>
          <select value={form.dueDay} onChange={e=>setForm(f=>({...f,dueDay:parseInt(e.target.value)}))}>
            {Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={d}>{daySuffix(d)} of month</option>)}
          </select>
        </div>
        <button className="btn-gold" onClick={addVarBill}>+ Add</button>
      </div>

      {varBills.length===0 ? (
        <div className="empty-state">Add your variable bills — electric, gas, water — to track them on the calendar.</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {[...varBills].sort((a,b)=>a.dueDay-b.dueDay).map(bill=>{
            const paid=isPaid(bill.id);
            const paidAmt=getPaidAmount(bill.id);
            const status=paid?'paid':getDueStatus(bill.dueDay);
            const statusColors={paid:{bg:'rgba(22,163,74,0.08)',border:'rgba(22,163,74,0.2)',text:'#16a34a'},overdue:{bg:'rgba(184,48,48,0.08)',border:'rgba(184,48,48,0.2)',text:'#b83030'},'due-soon':{bg:'rgba(217,119,6,0.08)',border:'rgba(217,119,6,0.2)',text:'#d97706'},upcoming:{bg:'#fafaf8',border:'var(--border)',text:'var(--text-secondary)'}};
            const sc=statusColors[status]||statusColors['upcoming'];
            return(
              <div key={bill.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:sc.bg,border:`0.5px solid ${sc.border}`,borderRadius:'var(--radius-md)'}}>
                <span style={{fontSize:18,flexShrink:0}}>{catIcon[bill.category]||'🏠'}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--text-primary)'}}>{bill.name}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>Due {daySuffix(bill.dueDay)} · {bill.category}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>
                  {paid ? (
                    <>
                      <span style={{fontSize:13,fontWeight:600,color:'#16a34a'}}>${paidAmt?.toFixed(2)||'0.00'}</span>
                      <span style={{background:'rgba(22,163,74,0.12)',color:'#16a34a',border:'0.5px solid rgba(22,163,74,0.25)',borderRadius:20,fontSize:11,fontWeight:600,padding:'2px 10px'}}>Paid ✓</span>
                      <button className="btn-outline" style={{fontSize:11,padding:'3px 8px'}} onClick={()=>unmarkPaid(bill)}>Undo</button>
                    </>
                  ) : editingAmount===bill.id ? (
                    <>
                      <input type="number" placeholder="$0.00" min="0" step="0.01" value={amountInput} onChange={e=>setAmountInput(e.target.value)} style={{width:90,fontSize:12}} autoFocus onKeyDown={e=>e.key==='Enter'&&amountInput&&markPaid(bill,amountInput)}/>
                      <button className="btn-gold" style={{fontSize:11,padding:'5px 10px'}} onClick={()=>amountInput&&markPaid(bill,amountInput)}>Save & mark paid</button>
                      <button className="btn-outline" style={{fontSize:11,padding:'5px 8px'}} onClick={()=>{setEditingAmount(null);setAmountInput('');}}>✕</button>
                    </>
                  ) : (
                    <>
                      <span style={{fontSize:11,color:'var(--text-muted)',fontStyle:'italic'}}>Amount TBD</span>
                      <button className="btn-outline" style={{fontSize:11,padding:'4px 10px'}} onClick={()=>{setEditingAmount(bill.id);setAmountInput('');}}>Enter amount</button>
                      <button className="btn-gold" style={{fontSize:11,padding:'4px 10px'}} onClick={()=>markPaid(bill,0)}>Mark paid</button>
                    </>
                  )}
                  <button className="btn-danger" onClick={()=>setVarBills(varBills.filter(v=>v.id!==bill.id))}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function EditBillForm({bill,billCats,onSave,onCancel}){
  const [form,setForm]=useState({...bill});
  const daySuffix=d=>{if(d>=11&&d<=13)return`${d}th`;const s=['th','st','nd','rd'];return`${d}${s[d%10]||'th'}`;};
  return(
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
        <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Bill name</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
        <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Amount</label><input type="number" value={form.amount} min="0" step="0.01" onChange={e=>setForm(f=>({...f,amount:parseFloat(e.target.value)||0}))}/></div>
        <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Due day</label><select value={form.dueDay} onChange={e=>setForm(f=>({...f,dueDay:parseInt(e.target.value)}))}>{Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={d}>{daySuffix(d)} of the month</option>)}</select></div>
        <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Category</label><select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{billCats.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
      </div>
      <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',marginBottom:16,fontSize:13,color:'var(--slate)'}}>
        <input type="checkbox" checked={form.autopay||false} onChange={e=>setForm(f=>({...f,autopay:e.target.checked}))} style={{width:15,height:15,accentColor:'var(--green)'}}/>
        This bill is on autopay
      </label>
      <div style={{display:'flex',gap:10}}>
        <button className="btn-outline" style={{flex:1}} onClick={onCancel}>Cancel</button>
        <button className="btn-gold" style={{flex:1}} onClick={()=>onSave(form)}>Save changes</button>
      </div>
    </div>
  );
}

function EditSubForm({sub,categories,onSave,onCancel}){
  const [form,setForm]=useState({...sub});
  const daySuffix=d=>{if(d>=11&&d<=13)return`${d}th`;const s=['th','st','nd','rd'];return`${d}${s[d%10]||'th'}`;};
  return(
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
        <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Service name</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
        <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Amount</label><input type="number" value={form.amount} min="0" step="0.01" onChange={e=>setForm(f=>({...f,amount:parseFloat(e.target.value)||0}))}/></div>
        <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Billing cycle</label><select value={form.cycle} onChange={e=>setForm(f=>({...f,cycle:e.target.value}))}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
        <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Category</label><select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
        <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Due day</label><select value={form.dueDay||1} onChange={e=>setForm(f=>({...f,dueDay:parseInt(e.target.value)}))}>{Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={d}>{daySuffix(d)} of the month</option>)}</select></div>
        <div style={{display:'flex',alignItems:'flex-end',paddingBottom:4}}>
          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'var(--slate)'}}>
            <input type="checkbox" checked={form.autopay||false} onChange={e=>setForm(f=>({...f,autopay:e.target.checked}))} style={{width:15,height:15,accentColor:'var(--green)'}}/>
            Autopay
          </label>
        </div>
      </div>
      <div style={{display:'flex',gap:10}}>
        <button className="btn-outline" style={{flex:1}} onClick={onCancel}>Cancel</button>
        <button className="btn-gold" style={{flex:1}} onClick={()=>onSave(form)}>Save changes</button>
      </div>
    </div>
  );
}


function SubscriptionsSection({subscriptions=[],setSubscriptions,transactions=[],goals=[],accounts,activeAccount,setAccounts,saveToFirebase,onMoveSubscription}){
  const now=new Date();
  const monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const todayDay=now.getDate();
  const [form,setForm]=useState({name:'',amount:'',cycle:'monthly',category:'Streaming',dueDay:'1',autopay:false});
  const [showForm,setShowForm]=useState(false);
  const [err,setErr]=useState({});
  const [paySubModal,setPaySubModal]=useState(null);
  const [editingSub,setEditingSub]=useState(null);
  const CATEGORIES=['Streaming','Music','Gaming','Fitness','Software','News','Food / Delivery','Education','Other'];
  const daySuffix=d=>{if(d>=11&&d<=13)return`${d}th`;const s=['th','st','nd','rd'];return`${d}${s[d%10]||'th'}`;};

  const addSub=()=>{
    const e={};
    if(!form.name.trim())e.name=true;
    if(!form.amount||isNaN(parseFloat(form.amount))||parseFloat(form.amount)<=0)e.amount=true;
    if(Object.keys(e).length){setErr(e);return;}
    const updated=[...subscriptions,{id:Date.now(),name:form.name.trim(),amount:parseFloat(form.amount),cycle:form.cycle,category:form.category,dueDay:parseInt(form.dueDay),autopay:form.autopay,subsPaid:{}}];
    setSubscriptions(updated);
    setForm({name:'',amount:'',cycle:'monthly',category:'Streaming',dueDay:'1',autopay:false});
    setErr({});setShowForm(false);
  };

  const isPaid=sub=>!!(sub.subsPaid&&sub.subsPaid[monthKey]);
  const paidAt=sub=>{const p=sub.subsPaid&&sub.subsPaid[monthKey];return p?new Date(p.paidAt).toLocaleDateString('en-US',{month:'short',day:'numeric'}):null;};
  const getDueStatus=dueDay=>{if(dueDay<todayDay)return'overdue';if(dueDay-todayDay<=3)return'due-soon';return'upcoming';};

  const handlePaySub=(sub)=>setPaySubModal(sub);

  const handlePaySubConfirm=(selectedAccountKey,deduct)=>{
    const sub=paySubModal;
    const key=monthKey;
    const updated=subscriptions.map(s=>{
      if(s.id!==sub.id)return s;
      return{...s,subsPaid:{...(s.subsPaid||{}),[key]:{paidAt:new Date().toISOString()}}};
    });
    if(deduct&&accounts&&selectedAccountKey){
      const targetAcct=accounts[selectedAccountKey];
      const newTx={id:Date.now(),date:now.toISOString().split('T')[0],desc:sub.name,type:'debit',grp:'Personal',cat:'Subscriptions',amt:sub.amount,note:'Subscription',refNum:''};
      const updatedTxs=[newTx,...(targetAcct.transactions||[])];
      updatedTxs.sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
      let updatedAccounts={...accounts,[activeAccount]:{...accounts[activeAccount],subscriptions:updated}};
      // Merge into whichever account is the deduction target — same object if it's the active
      // account (so the subsPaid update isn't lost), a different one if paying from elsewhere.
      updatedAccounts={...updatedAccounts,[selectedAccountKey]:{...updatedAccounts[selectedAccountKey],transactions:updatedTxs}};
      setAccounts(updatedAccounts);
      saveToFirebase(updatedAccounts);
    } else {
      setSubscriptions(updated);
    }
    setPaySubModal(null);
  };

  const handleUnpaySub=subId=>{
    const updated=subscriptions.map(s=>{
      if(s.id!==subId)return s;
      const newPaid={...(s.subsPaid||{})};
      delete newPaid[monthKey];
      return{...s,subsPaid:newPaid};
    });
    setSubscriptions(updated);
  };

  const monthlyTotal=subscriptions.reduce((s,sub)=>s+(sub.cycle==='yearly'?sub.amount/12:sub.amount),0);
  const yearlyTotal=subscriptions.reduce((s,sub)=>s+(sub.cycle==='yearly'?sub.amount:sub.amount*12),0);
  const paidCount=subscriptions.filter(s=>isPaid(s)).length;
  const totalPaid=subscriptions.filter(s=>isPaid(s)).reduce((s,sub)=>s+(sub.cycle==='yearly'?sub.amount/12:sub.amount),0);
  // Yearly subscriptions aren't due most months, so they shouldn't block the "all paid"
  // celebration all year round — the progress bar and celebration below only consider
  // monthly-cycle subscriptions. A yearly one can still be marked paid any time (it just
  // isn't required to unlock the celebration).
  const monthlySubs=subscriptions.filter(s=>s.cycle!=='yearly');
  const monthlyDuePaidCount=monthlySubs.filter(s=>isPaid(s)).length;
  const monthlyDueTotal=monthlySubs.length;

  const warnings=[];
  if(subscriptions.length>=3&&subscriptions.length<5){
    warnings.push({type:'warning',msg:'You have '+subscriptions.length+' subscriptions totaling $'+monthlyTotal.toFixed(2)+'/month — that\'s $'+yearlyTotal.toFixed(0)+' per year! Small amounts add up fast.'});
  }
  if(subscriptions.length>=5){
    warnings.push({type:'danger',msg:'⚠️ '+subscriptions.length+' subscriptions at $'+monthlyTotal.toFixed(2)+'/month. What if you redirected even $30 of that to your emergency fund every month?'});
  }
  if(monthlyTotal>=50){
    const goal=goals&&goals.length>0?goals[0]:null;
    const goalMsg=goal?' That\'s enough to fund your '+goal.name+' goal in '+Math.ceil(Math.max(0,goal.target-goal.saved)/monthlyTotal)+' months!':'';
    warnings.push({type:'danger',msg:'🚨 You\'re spending $'+monthlyTotal.toFixed(2)+'/month on subscriptions. That same money earning compound interest over 20 years could grow significantly.'+goalMsg+' Your future self will thank you for redirecting even part of this!'});
  }

  const statusColors={
    paid:{bg:'rgba(22,163,74,0.1)',color:'#16a34a',label:'✓ Paid'},
    overdue:{bg:'rgba(220,38,38,0.1)',color:'#dc2626',label:'Overdue'},
    'due-soon':{bg:'rgba(217,119,6,0.1)',color:'#d97706',label:'Due soon'},
    upcoming:{bg:'rgba(107,114,128,0.08)',color:'#6b7280',label:'Upcoming'},
  };

  return(
    <>
      {editingSub&&(
        <div className="modal-overlay" style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
          <div className="modal-box slide-up" style={{maxWidth:480}}>
            <h2 style={{fontFamily:'var(--font-display)',fontSize:20,marginBottom:'1.25rem',color:'var(--text-primary)'}}>✏️ Edit Subscription</h2>
            <EditSubForm sub={editingSub} categories={['Streaming','Music','Gaming','Fitness','Software','News','Food / Delivery','Education','Other']} onSave={(updated)=>{setSubscriptions(subscriptions.map(s=>s.id===updated.id?updated:s));setEditingSub(null);}} onCancel={()=>setEditingSub(null)} />
          </div>
        </div>
      )}
      {paySubModal&&(
        <div className="modal-overlay" style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
          <div className="modal-box slide-up" style={{maxWidth:420}}>
            <div style={{textAlign:'center',marginBottom:'1.25rem'}}>
              <div style={{fontSize:36,marginBottom:8}}>📱</div>
              <h2 style={{fontFamily:'var(--font-display)',fontSize:20,marginBottom:6,color:'var(--text-primary)'}}>Mark "{paySubModal.name}" as paid</h2>
              <p style={{fontSize:13,color:'var(--text-muted)'}}>${paySubModal.amount.toFixed(2)}</p>
            </div>
            {accounts&&(
              <PaySubAccountSelector accounts={accounts} sub={paySubModal} onConfirm={handlePaySubConfirm} onCancel={()=>setPaySubModal(null)} />
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:showForm?'1rem':0,flexWrap:'wrap',gap:8}}>
          <div>
            <div className="card-title" style={{marginBottom:2}}>📱 Subscriptions</div>
            <div style={{fontSize:12,color:'var(--text-muted)'}}>Track recurring subscriptions separately from bills</div>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            {subscriptions.length>0&&<ClearBtn label="Clear all" onClear={()=>setSubscriptions([])} title="Clear all subscriptions?" message="This will permanently delete all subscriptions." />}
            <button className="btn-gold" style={{fontSize:12,padding:'6px 14px'}} onClick={()=>setShowForm(f=>!f)}>{showForm?'✕ Cancel':'+ Add subscription'}</button>
          </div>
        </div>
        {showForm&&(
          <div style={{borderTop:'1px solid var(--border)',paddingTop:'1rem'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Service name</label><input placeholder="e.g. Netflix, Spotify" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={err.name?{borderColor:'#dc2626'}:{}}/></div>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Amount</label><input type="number" placeholder="$0.00" min="0" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={err.amount?{borderColor:'#dc2626'}:{}}/></div>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Billing cycle</label><select value={form.cycle} onChange={e=>setForm(f=>({...f,cycle:e.target.value}))}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Category</label><select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Due day</label><select value={form.dueDay} onChange={e=>setForm(f=>({...f,dueDay:e.target.value}))}>{Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={d}>{daySuffix(d)} of the month</option>)}</select></div>
              <div style={{display:'flex',alignItems:'flex-end',paddingBottom:4}}>
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'var(--slate)'}}>
                  <input type="checkbox" checked={form.autopay} onChange={e=>setForm(f=>({...f,autopay:e.target.checked}))} style={{width:15,height:15,accentColor:'var(--green)'}}/>
                  Autopay
                </label>
              </div>
            </div>
            <button className="btn-gold" onClick={addSub}>Save subscription</button>
          </div>
        )}
      </div>

      {warnings.map((w,i)=>(
        <div key={i} className={'alert-box alert-'+w.type} style={{marginBottom:8}}>{w.msg}</div>
      ))}

      {subscriptions.filter(s=>!isPaid(s)&&getDueStatus(s.dueDay)==='overdue').length>0&&<div className="alert-box alert-danger" style={{marginBottom:8}}>⚠️ <strong>{subscriptions.filter(s=>!isPaid(s)&&getDueStatus(s.dueDay)==='overdue').length} subscription(s) past due</strong></div>}
      {subscriptions.filter(s=>!isPaid(s)&&getDueStatus(s.dueDay)==='due-soon').length>0&&<div className="alert-box alert-warning" style={{marginBottom:8}}>🔔 <strong>{subscriptions.filter(s=>!isPaid(s)&&getDueStatus(s.dueDay)==='due-soon').length} subscription(s) due within 3 days</strong></div>}

      {subscriptions.length>0&&(
        <>
          <div className="metric-grid" style={{gridTemplateColumns:'repeat(4,minmax(0,1fr))',marginBottom:'1rem'}}>
            <div className="metric-card"><div className="lbl">Monthly cost</div><div className="val val-red">${monthlyTotal.toFixed(2)}</div></div>
            <div className="metric-card"><div className="lbl">Yearly cost</div><div className="val" style={{color:'#dc2626'}}>${yearlyTotal.toFixed(0)}</div></div>
            <div className="metric-card"><div className="lbl">Paid this month</div><div className="val val-green">${totalPaid.toFixed(2)}</div></div>
            <div className="metric-card"><div className="lbl">Paid</div><div className="val val-teal">{paidCount} / {subscriptions.length}</div></div>
          </div>

          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <table>
              <thead><tr>
                <th style={{padding:'12px 16px'}}>Service</th>
                <th style={{width:90}}>Category</th>
                <th style={{width:70,textAlign:'center'}}>Due</th>
                <th style={{width:80,textAlign:'right'}}>Amount</th>
                <th style={{width:120,textAlign:'center'}}>Status</th>
                <th style={{width:90,textAlign:'center'}}>Paid on</th>
                <th style={{width:40}}></th>
              </tr></thead>
              <tbody>
                {[...subscriptions].sort((a,b)=>(a.dueDay||1)-(b.dueDay||1)).map(sub=>{
                  const paid=isPaid(sub);
                  const status=paid?'paid':getDueStatus(sub.dueDay);
                  const sc=statusColors[status]||statusColors['upcoming'];
                  return(
                    <tr key={sub.id} style={{opacity:paid?0.75:1}}>
                      <td style={{padding:'10px 16px'}}>
                        <div style={{fontWeight:600,fontSize:13,color:paid?'var(--text-muted)':'var(--text-primary)',textDecoration:paid?'line-through':'none'}}>{sub.name}</div>
                        <div style={{fontSize:10,color:'#7c3aed',fontWeight:600,marginTop:1}}>{sub.cycle==='yearly'?'📅 YEARLY':'🔄 MONTHLY'}{sub.autopay?' · ⚡ AUTOPAY':''}</div>
                      </td>
                      <td style={{fontSize:11,color:'var(--text-muted)'}}>{sub.category}</td>
                      <td style={{textAlign:'center'}}><span style={{fontSize:12,fontWeight:600,color:paid?'var(--text-muted)':status==='overdue'?'#dc2626':status==='due-soon'?'#d97706':'var(--slate)'}}>{daySuffix(sub.dueDay)}</span></td>
                      <td style={{textAlign:'right',fontWeight:700,fontSize:13,color:paid?'var(--text-muted)':'var(--text-primary)'}}>${sub.amount.toFixed(2)}</td>
                      <td style={{textAlign:'center'}}>
                        {paid?(
                          <button onClick={()=>handleUnpaySub(sub.id)} style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.color}40`,borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>{sc.label}</button>
                        ):(
                          <button onClick={()=>handlePaySub(sub)} style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.color}40`,borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>{sc.label}</button>
                        )}
                      </td>
                      <td style={{textAlign:'center',fontSize:11,color:'var(--text-muted)'}}>{paidAt(sub)||'—'}</td>
                      <td style={{textAlign:'center'}}>
                        <div style={{display:'flex',gap:4,justifyContent:'center'}}>
                          <button onClick={()=>setEditingSub(sub)} style={{background:'var(--green-light)',color:'var(--green)',border:'1px solid var(--green-mid)',borderRadius:'var(--radius-sm)',padding:'3px 7px',fontSize:11,cursor:'pointer'}}>✏️</button>
                          {accounts&&Object.keys(accounts).filter(k=>k!==activeAccount).length>0&&<MovePicker accounts={accounts} currentAccount={activeAccount} onMove={(targetKey)=>onMoveSubscription&&onMoveSubscription(sub,targetKey)} />}
                          <button className="btn-danger" onClick={()=>setSubscriptions(subscriptions.filter(s=>s.id!==sub.id))}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-title">Subscription progress — {now.toLocaleDateString('en-US',{month:'long'})}</div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--text-muted)',marginBottom:6}}><span>{monthlyDuePaidCount} of {monthlyDueTotal} due this month paid</span><span>${totalPaid.toFixed(2)} of ${monthlyTotal.toFixed(2)}</span></div>
            <div style={{background:'var(--border-light)',borderRadius:6,height:10,overflow:'hidden'}}>
              <div style={{height:10,borderRadius:6,width:`${monthlyDueTotal>0?Math.round((monthlyDuePaidCount/monthlyDueTotal)*100):0}%`,background:monthlyDuePaidCount===monthlyDueTotal?'#16a34a':'linear-gradient(90deg,#7c3aed,#a78bfa)',transition:'width 0.4s ease'}}/>
            </div>
            {monthlyDuePaidCount===monthlyDueTotal&&monthlyDueTotal>0&&<div style={{textAlign:'center',fontSize:12,color:'#16a34a',marginTop:8,fontWeight:600}}>🎉 All subscriptions paid for {now.toLocaleDateString('en-US',{month:'long'})}!</div>}
          </div>

          <div className="tip-box" style={{marginBottom:'1rem'}}>
            💡 <strong>Pay your future self first.</strong> Consider redirecting even one subscription toward your savings goals. Compound interest means money saved today is worth significantly more tomorrow.
          </div>
        </>
      )}
    </>
  );
}

function PaySubAccountSelector({accounts,sub,onConfirm,onCancel}){
  const [selectedAccount,setSelectedAccount]=useState(Object.keys(accounts)[0]||'main');
  const [deduct,setDeduct]=useState(true);
  return(
    <>
      <div style={{marginBottom:16}}>
        <label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:6,fontWeight:500}}>Deduct from which account?</label>
        <select value={selectedAccount} onChange={e=>setSelectedAccount(e.target.value)} style={{marginBottom:10}}>
          {Object.entries(accounts).map(([key,acct])=><option key={key} value={key}>{acct.name}</option>)}
        </select>
        <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'var(--slate)'}}>
          <input type="checkbox" checked={deduct} onChange={e=>setDeduct(e.target.checked)} style={{width:15,height:15,accentColor:'var(--green)'}}/>
          Automatically add debit transaction to this account
        </label>
      </div>
      <div style={{background:'var(--bg)',borderRadius:'var(--radius-md)',padding:'10px 14px',marginBottom:16,fontSize:12,color:'var(--slate)'}}>
        {deduct?`A debit of $${sub.amount.toFixed(2)} will be added to "${accounts[selectedAccount]?.name}" register.`:'Subscription will be marked paid without affecting any account balance.'}
      </div>
      <div style={{display:'flex',gap:10}}>
        <button className="btn-outline" style={{flex:1}} onClick={onCancel}>Cancel</button>
        <button className="btn-gold" style={{flex:1}} onClick={()=>onConfirm(selectedAccount,deduct)}>✓ Mark as Paid</button>
      </div>
    </>
  );
}


// ── Milestone Modal ───────────────────────────────────────────
function MilestoneModal({milestone,onClose}){
  useEffect(()=>{
    const t=setTimeout(onClose,5000);
    return()=>clearTimeout(t);
  },[]);
  return(
    <div className="modal-overlay" style={{zIndex:4000,background:'rgba(15,42,94,0.3)'}} onClick={onClose}>
      <div className="slide-up" style={{background:'var(--green)',borderRadius:'var(--radius-xl)',padding:'2.5rem 2rem',maxWidth:400,width:'100%',textAlign:'center',boxShadow:'0 20px 60px rgba(26,111,212,0.3)'}}>
        <div style={{fontSize:64,marginBottom:16}}>{milestone.icon}</div>
        <h2 style={{fontFamily:'var(--font-display)',fontSize:24,fontWeight:800,color:'#fff',marginBottom:10,lineHeight:1.2}}>{milestone.title}</h2>
        <p style={{fontSize:14,color:'rgba(255,255,255,0.85)',lineHeight:1.6,marginBottom:16}}>{milestone.message}</p>
        <button onClick={onClose} style={{background:'rgba(255,255,255,0.2)',color:'#fff',border:'1px solid rgba(255,255,255,0.4)',borderRadius:'var(--radius-md)',padding:'10px 24px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'var(--font-display)'}}>
          Keep going! 💪
        </button>
        <p style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:12}}>Auto-closes in 5 seconds</p>
      </div>
    </div>
  );
}

// ── Transfer Modal ─────────────────────────────────────────────
function TransferModal({accounts,onTransfer,onCancel}){
  const accountList=Object.entries(accounts);
  const [fromKey,setFromKey]=useState(accountList[0]?.[0]||'main');
  const [toKey,setToKey]=useState(accountList[1]?.[0]||'main');
  const [amt,setAmt]=useState('');
  const [desc,setDesc]=useState('Account transfer');
  const [err,setErr]=useState('');
  const handleTransfer=()=>{
    if(fromKey===toKey){setErr('Cannot transfer to the same account.');return;}
    if(!amt||isNaN(parseFloat(amt))||parseFloat(amt)<=0){setErr('Enter a valid amount.');return;}
    onTransfer(fromKey,toKey,parseFloat(amt),desc);
  };
  return(
    <div className="modal-overlay" style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div className="modal-box slide-up" style={{maxWidth:420}}>
        <div style={{textAlign:'center',marginBottom:'1.25rem'}}>
          <div style={{fontSize:36,marginBottom:8}}>🔄</div>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:20,marginBottom:6,color:'var(--text-primary)'}}>Transfer Between Accounts</h2>
          <p style={{fontSize:12,color:'var(--text-muted)'}}>This moves money between your accounts without affecting your income or expense totals.</p>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:500}}>From account</label>
          <select value={fromKey} onChange={e=>setFromKey(e.target.value)}>
            {accountList.map(([k,a])=><option key={k} value={k}>{a.name}</option>)}
          </select>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:500}}>To account</label>
          <select value={toKey} onChange={e=>setToKey(e.target.value)}>
            {accountList.map(([k,a])=><option key={k} value={k}>{a.name}</option>)}
          </select>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:500}}>Amount</label>
          <input type="number" placeholder="$0.00" min="0" step="0.01" value={amt} onChange={e=>{setAmt(e.target.value);setErr('');}}/>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4,fontWeight:500}}>Description (optional)</label>
          <input placeholder="Account transfer" value={desc} onChange={e=>setDesc(e.target.value)}/>
        </div>
        {err&&<div className="alert-box alert-danger" style={{marginBottom:12}}>{err}</div>}
        <div style={{background:'var(--bg)',borderRadius:'var(--radius-md)',padding:'10px 14px',marginBottom:16,fontSize:12,color:'var(--slate)'}}>
          A debit will be logged in <strong>{accounts[fromKey]?.name}</strong> and a credit in <strong>{accounts[toKey]?.name}</strong>.
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn-outline" style={{flex:1}} onClick={onCancel}>Cancel</button>
          <button className="btn-gold" style={{flex:1}} onClick={handleTransfer}>🔄 Transfer</button>
        </div>
      </div>
    </div>
  );
}

// ── Calendar Tab ───────────────────────────────────────────────
function CalendarTab({bills=[],billsPaid={},subscriptions=[],varBills=[],varBillsPaid={}}){
  const now=new Date();
  const year=now.getFullYear();
  const month=now.getMonth();
  const monthKey=`${year}-${String(month+1).padStart(2,'0')}`;
  const todayDay=now.getDate();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const firstDay=new Date(year,month,1).getDay();
  const monthName=now.toLocaleDateString('en-US',{month:'long',year:'numeric'});

  const isPaid=(id,type)=>{
    if(type==='bill') return !!(billsPaid||{})[`${monthKey}_${id}`];
    const sub=(subscriptions||[]).find(s=>s.id===id);
    return !!(sub&&sub.subsPaid&&sub.subsPaid[monthKey]);
  };

  // Build day map
  const dayMap={};
  (bills||[]).forEach(b=>{
    const d=b.dueDay;
    if(!dayMap[d])dayMap[d]=[];
    const paid=isPaid(b.id,'bill');
    const diff=d-todayDay;
    const status=paid?'paid':diff<0?'overdue':diff<=3?'due-soon':'upcoming';
    dayMap[d].push({name:b.name,amount:b.amount,status,type:'bill'});
  });
  (subscriptions||[]).forEach(s=>{
    const d=s.dueDay||1;
    if(!dayMap[d])dayMap[d]=[];
    const paid=isPaid(s.id,'sub');
    const diff=d-todayDay;
    const status=paid?'paid':diff<0?'overdue':diff<=3?'due-soon':'upcoming';
    dayMap[d].push({name:s.name,amount:s.amount,status,type:'sub'});
  });
  (varBills||[]).forEach(v=>{
    const d=v.dueDay||1;
    if(!dayMap[d])dayMap[d]=[];
    const paidEntry=(varBillsPaid||{})[`${monthKey}_${v.id}`];
    const paid=!!paidEntry;
    const diff=d-todayDay;
    const status=paid?'paid':diff<0?'overdue':diff<=3?'due-soon':'var-tbd';
    dayMap[d].push({name:v.name,amount:paidEntry?.amount||null,status,type:'var'});
  });

  const statusColors={paid:{bg:'rgba(22,163,74,0.15)',color:'#16a34a',dot:'#16a34a'},'due-soon':{bg:'rgba(217,119,6,0.15)',color:'#d97706',dot:'#d97706'},overdue:{bg:'rgba(220,38,38,0.15)',color:'#dc2626',dot:'#dc2626'},upcoming:{bg:'rgba(107,114,128,0.08)',color:'#6b7280',dot:'var(--border)'},'var-tbd':{bg:'rgba(124,58,237,0.1)',color:'#7c3aed',dot:'#7c3aed'}};

  const totalDue=(bills||[]).length+(subscriptions||[]).length+(varBills||[]).length;
  const varPaid=(varBills||[]).filter(v=>!!((varBillsPaid||{})[`${monthKey}_${v.id}`])).length;
  const totalPaid=(bills||[]).filter(b=>isPaid(b.id,'bill')).length+(subscriptions||[]).filter(s=>isPaid(s.id,'sub')).length+varPaid;

  return(
    <>
      <div className="metric-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
        <div className="metric-card"><div className="lbl">Total bills & subs</div><div className="val val-gold">{totalDue}</div></div>
        <div className="metric-card"><div className="lbl">Paid this month</div><div className="val val-green">{totalPaid}</div></div>
        <div className="metric-card"><div className="lbl">Still due</div><div className="val val-red">{totalDue-totalPaid}</div></div>
      </div>
      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
          <div className="card-title" style={{marginBottom:0}}>📅 {monthName}</div>
          <div style={{display:'flex',gap:10,fontSize:11,flexWrap:'wrap'}}>
            <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:8,height:8,borderRadius:'50%',background:'#16a34a',display:'inline-block'}}/>Paid</span>
            <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:8,height:8,borderRadius:'50%',background:'#d97706',display:'inline-block'}}/>Due soon</span>
            <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:8,height:8,borderRadius:'50%',background:'#dc2626',display:'inline-block'}}/>Overdue</span>
            <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:8,height:8,borderRadius:'50%',background:'#7c3aed',display:'inline-block'}}/>Variable — amount TBD</span>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:8}}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} style={{textAlign:'center',fontSize:10,color:'var(--text-muted)',fontWeight:600,padding:'4px 0'}}>{d}</div>)}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
          {Array.from({length:firstDay}).map((_,i)=><div key={`empty-${i}`}/>)}
          {Array.from({length:daysInMonth}).map((_,i)=>{
            const day=i+1;
            const items=dayMap[day]||[];
            const isToday=day===todayDay;
            const hasOverdue=items.some(it=>it.status==='overdue');
            const hasDueSoon=items.some(it=>it.status==='due-soon');
            const allPaid=items.length>0&&items.every(it=>it.status==='paid');
            const bgColor=items.length===0?'transparent':allPaid?'rgba(22,163,74,0.06)':hasOverdue?'rgba(220,38,38,0.06)':hasDueSoon?'rgba(217,119,6,0.06)':'rgba(26,111,212,0.04)';
            return(
              <div key={day} style={{minHeight:60,border:`1px solid ${isToday?'var(--green)':'var(--border-light)'}`,borderRadius:'var(--radius-sm)',padding:'4px',background:bgColor,position:'relative'}}>
                <div style={{fontSize:11,fontWeight:isToday?700:400,color:isToday?'var(--green)':'var(--text-muted)',marginBottom:2}}>{day}</div>
                {items.map((item,idx)=>{
                  const sc=statusColors[item.status]||statusColors['upcoming'];
                  return(
                    <div key={idx} style={{background:sc.bg,borderRadius:3,padding:'1px 4px',marginBottom:1,overflow:'hidden'}} title={`${item.name}${item.amount!=null?' - $'+item.amount.toFixed(2):''}`}>
                      <div style={{fontSize:9,color:sc.color,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.name}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <div className="card-title">All bills this month</div>
        {[...(bills||[]).map(b=>({...b,itemType:'bill'})),...(subscriptions||[]).map(s=>({...s,itemType:'sub'})),...(varBills||[]).map(v=>({...v,itemType:'var',amount:((varBillsPaid||{})[`${monthKey}_${v.id}`]?.amount)||0}))].sort((a,b)=>a.dueDay-b.dueDay).map((item,i)=>{
          const paid=item.itemType==='var'?!!((varBillsPaid||{})[`${monthKey}_${item.id}`]):isPaid(item.id,item.itemType);
          const diff=item.dueDay-todayDay;
          const status=paid?'paid':item.itemType==='var'&&diff>=0?'var-tbd':diff<0?'overdue':diff<=3?'due-soon':'upcoming';
          const sc=statusColors[status]||statusColors['upcoming'];
          const daySuffix=d=>{if(d>=11&&d<=13)return`${d}th`;const s=['th','st','nd','rd'];return`${d}${s[d%10]||'th'}`;};
          return(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--border-light)'}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:sc.dot,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--text-primary)'}}>{item.name}</div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>Due {daySuffix(item.dueDay)} · {item.itemType==='sub'?'Subscription':item.itemType==='var'?'Variable bill':'Fixed bill'}</div>
              </div>
              <div style={{fontWeight:700,color:'var(--text-primary)'}}>{item.amount!=null?`$${item.amount.toFixed(2)}`:'TBD'}</div>
              <span style={{background:sc.bg,color:sc.color,fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:10,whiteSpace:'nowrap'}}>{status==='due-soon'?'Due soon':status==='var-tbd'?'Amount TBD':status.charAt(0).toUpperCase()+status.slice(1)}</span>
            </div>
          );
        })}
        {(bills||[]).length===0&&(subscriptions||[]).length===0&&<div className="empty-state">No bills or subscriptions added yet.</div>}
      </div>
    </>
  );
}

// ── Net Worth Tab ──────────────────────────────────────────────
function NetWorthExplainer(){
  const [open,setOpen]=useState(false);
  return(
    <div className="card" style={{marginBottom:'1rem',overflow:'hidden'}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',background:'none',border:'none',cursor:'pointer',padding:0,textAlign:'left'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:20}}>💡</span>
          <div>
            <div style={{fontFamily:'var(--font-display)',fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>What counts toward my net worth?</div>
            <div style={{fontSize:11,color:'var(--text-muted)'}}>Tap to {open?'hide':'learn more'}</div>
          </div>
        </div>
        <span style={{fontSize:16,color:'var(--text-muted)',transform:open?'rotate(180deg)':'rotate(0deg)',transition:'transform 0.2s'}}>▼</span>
      </button>

      {open&&(
        <div style={{borderTop:'1px solid var(--border-light)',marginTop:'1rem',paddingTop:'1rem'}}>

          {/* Formula */}
          <div style={{background:'var(--green-light)',border:'1px solid var(--green-mid)',borderRadius:'var(--radius-md)',padding:'12px 14px',marginBottom:'1.25rem',textAlign:'center'}}>
            <div style={{fontFamily:'var(--font-display)',fontSize:15,fontWeight:700,color:'var(--text-primary)',marginBottom:4}}>
              Net Worth = Total Assets − Total Liabilities
            </div>
            <div style={{fontSize:12,color:'var(--slate)',lineHeight:1.6}}>
              A <strong style={{color:'#16a34a'}}>positive number</strong> means you own more than you owe ✅<br/>
              A <strong style={{color:'#dc2626'}}>negative number</strong> is common early in life — the goal is to grow it over time 📈
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>

            {/* Assets */}
            <div>
              <div style={{fontSize:12,fontWeight:700,color:'#16a34a',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:'#16a34a',display:'inline-block'}}/>
                Assets — Things You OWN
              </div>
              {[
                {icon:'🏠',label:'Home',desc:'Current market value — not what you paid'},
                {icon:'🚗',label:'Vehicles',desc:'Current value (check Kelley Blue Book)'},
                {icon:'💰',label:'Checking & Savings',desc:'Current account balances'},
                {icon:'📈',label:'Retirement Accounts',desc:'401k, IRA, Roth IRA — yes, these count even if you cannot touch them yet!'},
                {icon:'💼',label:'Investment Accounts',desc:'Stocks, mutual funds, brokerage accounts'},
                {icon:'🏢',label:'Other Real Estate',desc:'Rental properties, land'},
                {icon:'💍',label:'Valuables',desc:'Jewelry, art, or collectibles with real market value'},
              ].map((item,i)=>(
                <div key={i} style={{display:'flex',gap:8,marginBottom:8}}>
                  <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{item.icon}</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--text-primary)'}}>{item.label}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.4}}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Liabilities */}
            <div>
              <div style={{fontSize:12,fontWeight:700,color:'#dc2626',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:'#dc2626',display:'inline-block'}}/>
                Liabilities — Things You OWE
              </div>
              {[
                {icon:'🏠',label:'Mortgage Balance',desc:'What you still owe on your home — not the full value'},
                {icon:'🚗',label:'Auto Loans',desc:'Remaining balance on each vehicle loan'},
                {icon:'💳',label:'Credit Card Balances',desc:'Total owed across all cards'},
                {icon:'🎓',label:'Student Loans',desc:'Total remaining balance'},
                {icon:'🏥',label:'Medical Debt',desc:'Any outstanding medical bills'},
                {icon:'👤',label:'Personal Loans',desc:'Any money borrowed from lenders'},
                {icon:'📦',label:'Other Debts',desc:'Any other money you legally owe'},
              ].map((item,i)=>(
                <div key={i} style={{display:'flex',gap:8,marginBottom:8}}>
                  <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{item.icon}</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--text-primary)'}}>{item.label}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.4}}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div style={{background:'rgba(217,119,6,0.06)',border:'1px solid rgba(217,119,6,0.2)',borderRadius:'var(--radius-md)',padding:'12px 14px',marginTop:'1rem'}}>
            <div style={{fontSize:12,fontWeight:600,color:'#d97706',marginBottom:6}}>📌 Important reminders</div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {[
                'Only enter the NAME of your accounts — never enter account numbers, passwords, or routing numbers.',
                'Use estimated current market values for assets — not what you originally paid.',
                'Update your values monthly to track your net worth growth over time.',
                'A negative net worth early in life is normal — most people start there. The goal is a growing trend.',
              ].map((tip,i)=>(
                <div key={i} style={{fontSize:11,color:'var(--slate)',lineHeight:1.5,display:'flex',gap:6}}>
                  <span style={{color:'#d97706',flexShrink:0}}>•</span>{tip}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function NetWorthTab({assets,setAssets,liabilities,setLiabilities,transactions,networthHistory,setNetworthHistory,savingsRateGoal,setSavingsRateGoal,goals}){
  const [assetForm,setAssetForm]=useState({name:'',value:'',category:'Home'});
  const [liabForm,setLiabForm]=useState({name:'',balance:'',category:'Mortgage'});
  const [showAssetForm,setShowAssetForm]=useState(false);
  const [showLiabForm,setShowLiabForm]=useState(false);
  const ASSET_CATS=['Home','Vehicle','Savings Account','Checking Account','Retirement Account','Investment','Other Asset'];
  const LIAB_CATS=['Mortgage','Car Loan','Credit Card','Student Loan','Personal Loan','Medical Debt','Other Liability'];

  const totalAssets=assets.reduce((s,a)=>s+a.value,0);
  const totalLiabilities=liabilities.reduce((s,l)=>s+l.balance,0);
  const netWorth=totalAssets-totalLiabilities;

  const addAsset=()=>{
    if(!assetForm.name.trim()||!assetForm.value||isNaN(parseFloat(assetForm.value)))return;
    setAssets([...assets,{id:Date.now(),name:assetForm.name.trim(),value:parseFloat(assetForm.value),category:assetForm.category}]);
    setAssetForm({name:'',value:'',category:'Home'});
    setShowAssetForm(false);
  };

  const addLiability=()=>{
    if(!liabForm.name.trim()||!liabForm.balance||isNaN(parseFloat(liabForm.balance)))return;
    setLiabilities([...liabilities,{id:Date.now(),name:liabForm.name.trim(),balance:parseFloat(liabForm.balance),category:liabForm.category}]);
    setLiabForm({name:'',balance:'',category:'Mortgage'});
    setShowLiabForm(false);
  };

  // Savings rate
  const now=new Date();const m=now.getMonth();const y=now.getFullYear();
  const monthIncome=transactions.filter(t=>{const d=new Date(t.date+'T00:00:00');return t.type==='credit'&&d.getMonth()===m&&d.getFullYear()===y;}).reduce((s,t)=>s+t.amt,0);
  const monthSavings=transactions.filter(t=>{const d=new Date(t.date+'T00:00:00');return t.grp==='Savings'&&t.type==='debit'&&d.getMonth()===m&&d.getFullYear()===y;}).reduce((s,t)=>s+t.amt,0);
  const actualRate=monthIncome>0?Math.min(100,(monthSavings/monthIncome)*100):0;
  const progress=Math.min(100,(actualRate/savingsRateGoal)*100);
  const ringColor=progress>=100?'#16a34a':progress>=50?'var(--green)':'#d97706';
  const circumference=2*Math.PI*40;
  const dashOffset=circumference*(1-progress/100);

  // Financial milestones check
  const completedGoals=goals.filter(g=>g.saved>=g.target);

  const assetsByCategory={};
  assets.forEach(a=>{if(!assetsByCategory[a.category])assetsByCategory[a.category]=[];assetsByCategory[a.category].push(a);});
  const liabsByCategory={};
  liabilities.forEach(l=>{if(!liabsByCategory[l.category])liabsByCategory[l.category]=[];liabsByCategory[l.category].push(l);});

  return(
    <>
      {/* Net Worth Explainer */}
      <NetWorthExplainer />

      {/* Net Worth Summary */}
      <div className="card" style={{background:netWorth>=0?'linear-gradient(135deg,rgba(22,163,74,0.08),rgba(22,163,74,0.03))':'linear-gradient(135deg,rgba(220,38,38,0.08),rgba(220,38,38,0.03))'}}>
        <div style={{textAlign:'center',padding:'1rem 0'}}>
          <div style={{fontSize:13,color:'var(--text-muted)',fontWeight:500,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>Total Net Worth</div>
          <div style={{fontFamily:'var(--font-display)',fontSize:40,fontWeight:800,color:netWorth>=0?'#16a34a':'#dc2626'}}>
            {netWorth<0?'-':''}${Math.abs(netWorth).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}
          </div>
          <div style={{display:'flex',justifyContent:'center',gap:24,marginTop:12}}>
            <div style={{textAlign:'center'}}><div style={{fontSize:11,color:'var(--text-muted)'}}>Total Assets</div><div style={{fontFamily:'var(--font-display)',fontSize:18,fontWeight:700,color:'#16a34a'}}>${totalAssets.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
            <div style={{width:1,background:'var(--border-light)'}}/>
            <div style={{textAlign:'center'}}><div style={{fontSize:11,color:'var(--text-muted)'}}>Total Liabilities</div><div style={{fontFamily:'var(--font-display)',fontSize:18,fontWeight:700,color:'#dc2626'}}>${totalLiabilities.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>
          </div>
        </div>
      </div>

      {/* Savings Rate Goal Ring */}
      <div className="card">
        <div style={{display:'flex',alignItems:'center',gap:'1.5rem',flexWrap:'wrap'}}>
          <div style={{flexShrink:0}}>
            <svg width={100} height={100} viewBox="0 0 100 100">
              <circle cx={50} cy={50} r={40} fill="none" stroke="var(--border-light)" strokeWidth={10}/>
              <circle cx={50} cy={50} r={40} fill="none" stroke={ringColor} strokeWidth={10} strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" transform="rotate(-90 50 50)" style={{transition:'stroke-dashoffset 0.6s ease'}}/>
              <text x={50} y={46} textAnchor="middle" style={{fontSize:14,fontWeight:800,fill:ringColor,fontFamily:'var(--font-display)'}}>{actualRate.toFixed(0)}%</text>
              <text x={50} y={60} textAnchor="middle" style={{fontSize:9,fill:'var(--text-muted)'}}>of {savingsRateGoal}% goal</text>
            </svg>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div className="card-title" style={{marginBottom:4}}>💡 Savings Rate Goal</div>
            <p style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.6,marginBottom:10}}>
              {actualRate>=savingsRateGoal?`🎉 You hit your ${savingsRateGoal}% savings goal this month!`:actualRate>0?`You're saving ${actualRate.toFixed(1)}% of income. Keep going to reach your ${savingsRateGoal}% goal!`:'No savings logged this month yet.'}
            </p>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <label style={{fontSize:12,color:'var(--text-muted)',whiteSpace:'nowrap'}}>Goal:</label>
              <input type="number" value={savingsRateGoal} min="1" max="100" step="1" onChange={e=>setSavingsRateGoal(parseFloat(e.target.value)||20)} style={{width:70}}/>
              <span style={{fontSize:12,color:'var(--text-muted)'}}>% of income</span>
            </div>
          </div>
        </div>
      </div>

      {/* Assets */}
      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:showAssetForm?'1rem':0}}>
          <div className="card-title" style={{marginBottom:0}}>✅ Assets</div>
          <button className="btn-gold" style={{fontSize:12,padding:'6px 14px'}} onClick={()=>setShowAssetForm(f=>!f)}>{showAssetForm?'✕ Cancel':'+ Add asset'}</button>
        </div>
        {showAssetForm&&(
          <div style={{borderTop:'1px solid var(--border)',paddingTop:'1rem'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Asset name</label><input placeholder="e.g. Primary Home, Toyota Camry" value={assetForm.name} onChange={e=>setAssetForm(f=>({...f,name:e.target.value}))}/></div>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Estimated value</label><input type="number" placeholder="$0" min="0" step="100" value={assetForm.value} onChange={e=>setAssetForm(f=>({...f,value:e.target.value}))}/></div>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Category</label><select value={assetForm.category} onChange={e=>setAssetForm(f=>({...f,category:e.target.value}))}>{ASSET_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            </div>
            <div className="tip-box" style={{marginBottom:10,fontSize:11}}>💡 Only enter the asset name — never enter account numbers or sensitive details.</div>
            <button className="btn-gold" onClick={addAsset}>Save asset</button>
          </div>
        )}
        {assets.length>0&&(
          <div style={{marginTop:showAssetForm?0:'0.5rem'}}>
            {Object.entries(assetsByCategory).map(([cat,items])=>(
              <div key={cat} style={{marginBottom:10}}>
                <div style={{fontSize:11,color:'#16a34a',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>{cat}</div>
                {items.map(a=>(
                  <div key={a.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border-light)'}}>
                    <span style={{fontSize:13,color:'var(--text-primary)'}}>{a.name}</span>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <input type="number" defaultValue={a.value} min="0" step="100" style={{width:110,fontSize:12,textAlign:'right'}} onBlur={e=>setAssets(assets.map(x=>x.id===a.id?{...x,value:parseFloat(e.target.value)||0}:x))} title="Update value"/>
                      <button className="btn-danger" onClick={()=>setAssets(assets.filter(x=>x.id!==a.id))}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {assets.length===0&&!showAssetForm&&<div className="empty-state">Add your assets — home, vehicles, savings accounts, retirement funds.</div>}
      </div>

      {/* Liabilities */}
      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:showLiabForm?'1rem':0}}>
          <div className="card-title" style={{marginBottom:0}}>❌ Liabilities</div>
          <button className="btn-gold" style={{fontSize:12,padding:'6px 14px'}} onClick={()=>setShowLiabForm(f=>!f)}>{showLiabForm?'✕ Cancel':'+ Add liability'}</button>
        </div>
        {showLiabForm&&(
          <div style={{borderTop:'1px solid var(--border)',paddingTop:'1rem'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Liability name</label><input placeholder="e.g. Home Mortgage, Car Loan" value={liabForm.name} onChange={e=>setLiabForm(f=>({...f,name:e.target.value}))}/></div>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Current balance</label><input type="number" placeholder="$0" min="0" step="100" value={liabForm.balance} onChange={e=>setLiabForm(f=>({...f,balance:e.target.value}))}/></div>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Category</label><select value={liabForm.category} onChange={e=>setLiabForm(f=>({...f,category:e.target.value}))}>{LIAB_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            </div>
            <div className="tip-box" style={{marginBottom:10,fontSize:11}}>💡 Only enter the liability name and balance — never enter account numbers.</div>
            <button className="btn-gold" onClick={addLiability}>Save liability</button>
          </div>
        )}
        {liabilities.length>0&&(
          <div style={{marginTop:showLiabForm?0:'0.5rem'}}>
            {Object.entries(liabsByCategory).map(([cat,items])=>(
              <div key={cat} style={{marginBottom:10}}>
                <div style={{fontSize:11,color:'#dc2626',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>{cat}</div>
                {items.map(l=>(
                  <div key={l.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border-light)'}}>
                    <span style={{fontSize:13,color:'var(--text-primary)'}}>{l.name}</span>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <input type="number" defaultValue={l.balance} min="0" step="100" style={{width:110,fontSize:12,textAlign:'right'}} onBlur={e=>setLiabilities(liabilities.map(x=>x.id===l.id?{...x,balance:parseFloat(e.target.value)||0}:x))} title="Update balance"/>
                      <button className="btn-danger" onClick={()=>setLiabilities(liabilities.filter(x=>x.id!==l.id))}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {liabilities.length===0&&!showLiabForm&&<div className="empty-state">Add your liabilities — mortgage, car loans, credit card balances.</div>}
      </div>

      {/* Milestones */}
      {completedGoals.length>0&&(
        <div className="card" style={{background:'linear-gradient(135deg,var(--green-light),rgba(26,111,212,0.02))'}}>
          <div className="card-title">🎉 Financial Milestones Reached</div>
          {completedGoals.map(g=>(
            <div key={g.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--border-light)'}}>
              <span style={{fontSize:24}}>🏆</span>
              <div>
                <div style={{fontFamily:'var(--font-display)',fontSize:13,fontWeight:700,color:'var(--green)'}}>{g.name} — Complete!</div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>${g.saved.toLocaleString('en-US',{minimumFractionDigits:0})} saved · Goal reached 🎯</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}


function exportCSV(transactions,beginBal){
  const sorted=[...transactions].sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
  const rows=[['Date','Description','Group','Category','Type','Amount','Balance','Note','Ref #','Recurring']];
  let runBal=beginBal.amount||0;
  if(beginBal.set)rows.push([beginBal.date,'Beginning Balance','—','—','credit',beginBal.amount.toFixed(2),runBal.toFixed(2),'','','']);
  sorted.forEach(t=>{runBal+=t.type==='credit'?t.amt:-t.amt;rows.push([t.date,`"${t.desc}"`,t.grp||'',t.cat,t.type,t.amt.toFixed(2),runBal.toFixed(2),t.note||'',t.refNum||'',t.recurring||'none']);});
  const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='moneymap_register.csv';a.click();
}
