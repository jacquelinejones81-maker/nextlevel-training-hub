import { useState, useCallback, useEffect, useRef, Fragment } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, onSnapshot, setDoc, deleteDoc, collection, getDocs, query, orderBy, runTransaction } from "firebase/firestore";


// ── FIREBASE ──
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: `${import.meta.env.VITE_FB_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FB_PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FB_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const DATA_DOC = "appdata/main";


// ── MONEYMAP FIREBASE ──
const mmConfig = {
  apiKey: "AIzaSyC2x67g3-vOvcPtRQqK5Nln4Er_CD26Ytc",
  authDomain: "moneymap-app-4da40.firebaseapp.com",
  projectId: "moneymap-app-4da40",
  storageBucket: "moneymap-app-4da40.firebasestorage.app",
  messagingSenderId: "273747664106",
  appId: "1:273747664106:web:40f852da95597ad06a4b93"
};
const mmApp = initializeApp(mmConfig, "moneymap");
const mmDb = getFirestore(mmApp);

const saveToFirebase = async (data) => {
  // reps now live in their own Firestore collection — never let them get re-embedded here
  const { reps: _omitReps, ...dataNoReps } = data;
  const size = new Blob([JSON.stringify(dataNoReps)]).size;
  if(size > 900000) {
    console.warn("Firebase document size warning:", Math.round(size/1024)+"KB — approaching 1MB limit");
  }
  try {
    await setDoc(doc(db, "appdata", "main"), { payload: JSON.stringify(dataNoReps) });
    return true;
  } catch(e) {
    console.error("Firebase save error", e);
    // If document too large, try saving without photos
    if(e.message&&(e.message.includes("maximum")||e.message.includes("size")||size>900000)){
      try {
        const stripped={...dataNoReps};
        // Remove large photo data to make room
        if(stripped.profilePhotos) stripped.profilePhotos={};
        if(stripped.wofPhotos) stripped.wofPhotos={};
        await setDoc(doc(db,"appdata","main"),{payload:JSON.stringify(stripped)});
        console.warn("Saved without photos due to size limit");
        return true;
      } catch(e2){ console.error("Emergency save also failed",e2); }
    }
    return false;
  }
};

// ── SAFE VERSIONED SAVE ──
// Prevents the "silent overwrite" bug: if two people (or two tabs/devices) save around
// the same time, whoever saves LAST used to win and wipe out the other person's changes
// (e.g. a newly-added rep vanishing). This wraps the save in a Firestore transaction that
// checks a version number (__v) hasn't moved since this browser last loaded the data.
// If it HAS moved, the save is rejected instead of silently clobbering the newer data.
const saveToFirebaseVersioned = async (newData, expectedVersion) => {
  // reps now live in their own Firestore collection — never let them get re-embedded here
  const { reps: _omitReps, ...newDataNoReps } = newData;
  const ref = doc(db, "appdata", "main");
  try {
    const outcome = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists() ? JSON.parse(snap.data().payload || "{}") : {};
      const currentVersion = current.__v || 0;
      if (currentVersion !== expectedVersion) {
        return { conflict: true, currentVersion };
      }
      const nextVersion = currentVersion + 1;
      const payload = { ...newDataNoReps, __v: nextVersion };
      const size = new Blob([JSON.stringify(payload)]).size;
      if (size > 900000) {
        console.warn("Firebase document size warning:", Math.round(size/1024)+"KB — approaching 1MB limit");
      }
      tx.set(ref, { payload: JSON.stringify(payload) });
      return { conflict: false, nextVersion };
    });
    return outcome;
  } catch (e) {
    console.error("Versioned save error, falling back to plain save", e);
    // Fallback so a transient transaction error (e.g. brief network hiccup) doesn't
    // block saving entirely — behaves like the old save-always behavior in that case.
    const ok = await saveToFirebase(newDataNoReps);
    return ok ? { conflict: false, nextVersion: (expectedVersion||0) + 1, fellBack: true } : { conflict: false, error: e };
  }
};

// ── DESIGN TOKENS ──
// Local date string helper (avoids UTC timezone issues for Central time users)
const localDate = (d=new Date()) => {
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};

const C = {
  navy:"#0d1b2e", navyMid:"#1a2d47", navyLight:"#243a55",
  teal:"#0ea5a0", tealFade:"rgba(14,165,160,0.12)",
  white:"#ffffff", surface:"#f4f6f9", surfaceCard:"#ffffff",
  border:"rgba(0,0,0,0.08)", borderLight:"rgba(255,255,255,0.08)",
  text:"#1e293b", textMid:"#64748b", textLight:"#94a3b8",
  success:"#10b981", warning:"#f59e0b", danger:"#ef4444",
  purple:"#8b5cf6", gold:"#f59e0b",
};


// ── PHONE CALL BUTTON ──
const PhoneLink = ({phone}) => {
  if(!phone) return null;
  return <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
    <span>{phone}</span>
    <a href={"tel:"+phone.replace(/\D/g,"")} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:22,height:22,borderRadius:5,background:C.success+"22",border:"1px solid "+C.success+"44",textDecoration:"none"}} title="Call">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.22 1.18 2 2 0 012.22 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.2 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14v2.92z"/></svg>
    </a>
  </span>;
};

// ── DESKTOP RESPONSIVE HELPER ──
const dv = (mobile, desktop) => typeof window!=="undefined"&&window.innerWidth>=900 ? desktop : mobile;
const REF_STAGES=[{k:"textSent",l:"Text Sent"},{k:"callScheduled",l:"Call Scheduled"},{k:"called",l:"Called Ref"},{k:"callComplete",l:"Reference Call Complete"},{k:"trainingApptSet",l:"Training Appt Set"}];

// ── PERSON LOOKUP HELPER ──
const findPerson = (id, data) => {
  if(!id||!data) return null;
  return [...(data.admins||[]),...(data.trainers||[]),...(data.reps||[])].find(p=>p.id===id)||null;
};

// ── ACTIVE REPS FILTER (excludes inactive) ──
const activeReps = (reps) => (reps||[]).filter(r=>!r.inactive);

const MOTIVATIONS = [
  "Success is not final, failure is not fatal — it is the courage to continue that counts.",
  "The secret of getting ahead is getting started.",
  "Don't watch the clock; do what it does. Keep going.",
  "Believe you can and you're halfway there.",
  "It always seems impossible until it's done.",
  "Your only limit is your mind.",
  "Push yourself because no one else is going to do it for you.",
  "Great things never come from comfort zones.",
  "Dream it. Wish it. Do it.",
  "Success doesn't just find you. You have to go out and get it.",
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "Don't stop when you're tired. Stop when you're done.",
  "Wake up with determination. Go to bed with satisfaction.",
  "Do something today that your future self will thank you for.",
  "Little things make big days.",
  "It's going to be hard, but hard is not impossible.",
  "Don't wait for opportunity. Create it.",
  "Sometimes we're tested not to show our weaknesses, but to discover our strengths.",
  "The key to success is to focus on goals, not obstacles.",
  "Dream bigger. Do bigger.",
];

const TRAINER_CHECKLIST = [
  {id:"t1",cat:"Getting Started",task:"Complete IBA and register for class or self online study",note:"Move within 48 hours"},
  {id:"t2",cat:"Apps & Access",task:"Confirm recruit downloaded Primerica app and logged in within 24 hrs",note:"$50 bonus opportunity"},
  {id:"t3",cat:"Apps & Access",task:"Confirm recruit downloaded Telegram and added to group",link:"https://t.me/+WjPWktwvOpVhZDlh",linkLabel:"Telegram Group"},
  {id:"t4",cat:"Apps & Access",task:"Share app URL with new rep and confirm they have saved it"},
  {id:"t6",cat:"References",task:"Get 5 character references (names and phone numbers - MACHO people)",note:"Character references can be found in the Refs tab"},
  {id:"t9",cat:"References",task:"Complete character reference calls and book 5 training appointments",link:"https://docs.google.com/document/d/1ju_kh_QbSc5whqLpm8r9190Jr7raYfcGoi2jdDxP49U/edit?usp=sharing",linkLabel:"Call Script"},
  {id:"t10",cat:"Appointments",task:"Share training appointment link with rep",link:"https://calendly.com/jacquelinejones81/trainingappointment",linkLabel:"Schedule Appointment",note:"The training appointment link is also available in the rep's Appt tab on their checklist — direct them there to schedule"},
  {id:"t11",cat:"Events",task:"Choose Digital Grand Opening (DGO) date",note:"DGO date can be scheduled in the Milestones tab"},
  {id:"t12",cat:"FNA & Personal Plan",task:"Ensure rep completes their personal plan including their Financial Needs Analysis, life insurance, and investments",note:"This should be completed early in training — rep needs their own plan before presenting to others"},
  {id:"t13",cat:"Events",task:"Follow up after DGO - debrief, next steps, pipeline review"},
  {id:"t15",cat:"Onboarding Videos",task:"Confirm rep has watched orientation video",note:"Rep can watch it anytime from the Watch Orientation item on their checklist"},
  {id:"t16",cat:"Appointments",task:"Complete rep's first training appointment (FTO #1)",note:"Log this in the rep's FTO counter on their checklist"},
  {id:"t17",cat:"Milestones",task:"Confirm rep has logged their first investment observation",note:"Rep logs prospect names in the Investment Observation section on their checklist"},
];

const FAST_START = [
  {id:"f1",cat:"Getting Started",task:"Download Primerica app, register and log in within 24 hrs (earn $50 bonus)"},
  {id:"f2",cat:"Apps & Access",task:"Download Telegram app (team communication)"},
  {id:"f3",cat:"References",task:"Provide 5 professional character references to your trainer",note:"Character references can be found in the Refs tab"},
  {id:"f4",cat:"Onboarding",task:"Watch Orientation",note:"Orientation video is in the Resources tab"},
  {id:"f5",cat:"Business Commitment",task:"Business Commitment - pay POL fee and set up business account"},
  {id:"f6",cat:"FNA",task:"Complete your financial needs analysis (Life Insurance and Roth IRA)"},
  {id:"f6b",cat:"Income Producing",task:"Get your auto and home quote",note:"Even if you don't save money, you'll know the process for your future clients"},
  {id:"f7",cat:"Events",task:"Schedule Digital Grand Opening (DGO)",note:"DGO date can be set in the Milestones tab"},
  {id:"f8",cat:"Events",task:"Attend DGO and debrief afterward"},
  {id:"f9",cat:"Pre-Licensing",task:"Complete Pre-Licensing class (In-Person, Zoom, or Online)",note:"Set your class type and access ExamFX study materials in the Milestones tab"},
  {id:"f11",cat:"Licensing",task:"Access Exam Simulator"},
  {id:"f14",cat:"Licensing",task:"Complete all chapter quizzes"},
  {id:"f15",cat:"Licensing",task:"Complete practice exam"},
  {id:"f16",cat:"Licensing",task:"Complete readiness exam"},
  {id:"f10",cat:"Licensing",task:"Schedule state exam within 5 days of completing class"},
  {id:"f17",cat:"Licensing",task:"Pass state exam"},
  {id:"f12",cat:"Licensing",task:"Upload pass notice and required docs in Primerica app"},
  {id:"f13",cat:"Licensing",task:"Request Licensed - Now What Checklist"},
];

const REGULAR_START = [
  {id:"r1",cat:"Getting Started",task:"Download Primerica app, register and log in within 24 hrs (earn $50 bonus)"},
  {id:"r2",cat:"Apps & Access",task:"Download Telegram app (team communication)"},
  {id:"r3",cat:"References",task:"Provide 5 character references to your trainer",note:"Character references can be found in the Refs tab"},
  {id:"r4",cat:"Onboarding",task:"Watch Orientation",note:"Orientation video is in the Resources tab"},
  {id:"r5",cat:"Business Commitment",task:"Business Commitment - build your financial and business house"},
  {id:"r6",cat:"FNA",task:"Complete your financial needs analysis (Life Insurance and Roth IRA)"},
  {id:"r6b",cat:"Income Producing",task:"Get your auto and home quote",note:"Even if you don't save money, you'll know the process for your future clients"},
  {id:"r7",cat:"Events",task:"Schedule Digital Grand Opening (DGO)",note:"DGO date can be set in the Milestones tab"},
  {id:"r8",cat:"Events",task:"Attend DGO and debrief afterward"},
  {id:"r9",cat:"Pre-Licensing",task:"Complete Pre-Licensing class (In-Person, Zoom, or Online)",note:"Set your class type and access ExamFX study materials in the Milestones tab"},
  {id:"r11",cat:"Licensing",task:"Access Exam Simulator"},
  {id:"r14",cat:"Licensing",task:"Complete all chapter quizzes"},
  {id:"r15",cat:"Licensing",task:"Complete practice exam"},
  {id:"r16",cat:"Licensing",task:"Complete readiness exam"},
  {id:"r10",cat:"Licensing",task:"Schedule state exam within 5 days of completing class"},
  {id:"r17",cat:"Licensing",task:"Pass state exam"},
  {id:"r12",cat:"Licensing",task:"Upload pass notice and required docs in Primerica app"},
  {id:"r12b",cat:"Licensing",task:"Request Licensed - Now What Checklist"},
];

const LICENSED_NOW_WHAT = [
  {id:"l0",cat:"Getting Started",task:"Watch Licensed Now What Video",note:"Your Licensed Now What video is available in your sidebar — tap Rewatch: Licensed Now What"},
  {id:"l1",cat:"Milestones",task:"Become Life Licensed"},
  {id:"l2",cat:"Securities License",task:"Pass SIE"},
  {id:"l2b",cat:"Securities License",task:"Pass Series 6"},
  {id:"l2c",cat:"Securities License",task:"Pass Series 63"},
  {id:"l2d",cat:"Securities License",task:"Pass Series 65"},
  {id:"l2e",cat:"Securities License",task:"Pass Series 26 (if RVP desired)"},
  {id:"l3",cat:"Learning Activity",task:"Complete Life Training Hub: POL > Products > Life Insurance > Life Training Hub"},
  {id:"l4",cat:"Learning Activity",task:"Get certified for Indexed and Fixed annuities"},
  {id:"l14",cat:"Learning Activity",task:"Complete 3 practice life apps in Primerica online",note:"Login at primericalife.com to complete practice apps"},
  {id:"l15",cat:"Learning Activity",task:"Complete 3 practice IBAs in Primerica app",note:"Login to the Primerica app to complete practice IBAs"},
  {id:"l5",cat:"Learning Activity",task:"Master the 7 Fundamentals - Prospecting",note:"Fundamentals link in Resources tab"},
  {id:"l6",cat:"Learning Activity",task:"Master the 7 Fundamentals - Setting Appointments",note:"Fundamentals link in Resources tab"},
  {id:"l7",cat:"Learning Activity",task:"Master the 7 Fundamentals - Giving a Winning Presentation",note:"Fundamentals link in Resources tab"},
  {id:"l8",cat:"Learning Activity",task:"Master the 7 Fundamentals - Overcoming Objections",note:"Fundamentals link in Resources tab"},
  {id:"l9",cat:"Learning Activity",task:"Master the 7 Fundamentals - Closing (Life Insurance)",note:"Fundamentals link in Resources tab"},
  {id:"l10",cat:"Learning Activity",task:"Master the 7 Fundamentals - Getting Referrals",note:"Fundamentals link in Resources tab"},
  {id:"l11",cat:"Learning Activity",task:"Master the 7 Fundamentals - Getting a New Rep Started",note:"Fundamentals link in Resources tab"},
  {id:"l12",cat:"Income Producing",task:"Add 30-60 qualified contacts to CRM weekly"},
  {id:"l13",cat:"Income Producing",task:"Set 15-30 qualified appointments weekly"},

];

const RVP_CHECKLIST = [
  {id:"rvp1",cat:"Licensing",task:"Become Life Licensed"},
  {id:"rvp2",cat:"Licensing",task:"Get Securities Licensed - SIE"},
  {id:"rvp3",cat:"Licensing",task:"Series 6"},
  {id:"rvp4",cat:"Licensing",task:"Series 63"},
  {id:"rvp4b",cat:"Licensing",task:"Series 65"},
  {id:"rvp5",cat:"Licensing",task:"Series 26"},
  {id:"rvp6",cat:"Licensed Agents",task:"License 1-3 agents"},
  {id:"rvp7",cat:"Licensed Agents",task:"License 4-6 agents"},
  {id:"rvp8",cat:"Licensed Agents",task:"License 7-9 agents"},
  {id:"rvp9",cat:"Licensed Agents",task:"License 10-12 agents"},
  {id:"rvp10",cat:"Licensed Agents",task:"License 13-16 agents"},
  {id:"rvp11",cat:"Licensed Agents",task:"License 17-20 agents"},
  {id:"rvp12",cat:"Production",task:"QBI at 75% minimum"},
  {id:"rvp13",cat:"Production",task:"Month 1: 10 recs x $10k in premium"},
  {id:"rvp14",cat:"Production",task:"Month 2: 10 recs x $10k in premium"},
  {id:"rvp15",cat:"Financial",task:"Rolling 12 income minimum of $20k"},
  {id:"rvp16",cat:"Financial",task:"Provide replacement (15 licenses or 3 District Legs)"},
  {id:"rvp17",cat:"Financial",task:"Receive $20k in company stock"},
  {id:"rvp18",cat:"Goal",task:"Regional Vice President Promotion"},
];

const SVP_CHECKLIST = [
  "Have 3 first-generation RVPs in place (each producing $10,000+ submitted bonusable premium, twice within 2 months before/after their promotion)",
  "At least 2 of those 3 RVPs are securities licensed",
  "Submit $50,000 through 1st in Production Credit",
  "$10,000 minimum Base Shop submitted bonusable premium",
  "Pre-qualify the month before at 75%+ of the above",
  "Acceptable persistency",
  "Securities principal licensed (Series 26)",
  "Execute SVP Agreement",
];

const CHECKLIST_DEFAULTS = {
  fastStart: FAST_START,
  regularStart: REGULAR_START,
  licensedNowWhat: LICENSED_NOW_WHAT,
  trainerChecklist: TRAINER_CHECKLIST,
  rvpChecklist: RVP_CHECKLIST,
  // SVP_CHECKLIST is historically a flat array of plain strings with index-based checked
  // tracking (rep.svpChecked[i]). Normalized here to the same {id,cat,task} shape as every
  // other checklist so it can use the same editor — id encodes the original index so
  // existing checked progress (keyed by that index) keeps working without migration.
  svpChecklist: SVP_CHECKLIST.map((task,i)=>({id:"svp"+i,cat:"Requirements",task})),
};
const CHECKLIST_LABELS = {
  fastStart: "Fast Start",
  regularStart: "Regular Start",
  licensedNowWhat: "Licensed Now What",
  trainerChecklist: "Trainer's Checklist",
  rvpChecklist: "RVP Checklist",
  svpChecklist: "SVP Checklist",
};
const TRACK_TO_CHECKLIST_KEY = { fast:"fastStart", regular:"regularStart", licensed:"licensedNowWhat" };
function getChecklistItems(data, key) {
  const custom = data?.checklists?.[key];
  if (custom && Array.isArray(custom.items)) return custom.items;
  return CHECKLIST_DEFAULTS[key] || [];
}
// Category order is always derived from first-appearance order in the items array itself
// (same as how the original hardcoded checklists always worked) — reordering a category
// means physically moving its block of items earlier/later in the array, so every existing
// piece of rendering code that just groups items in array order keeps working unchanged.
function getChecklistCategoryOrder(data, key) {
  const items = getChecklistItems(data, key);
  const seen = [];
  items.forEach(i => { const c=i.cat||"Uncategorized"; if (!seen.includes(c)) seen.push(c); });
  return seen;
}
function getGroupedChecklist(data, key) {
  const items = getChecklistItems(data, key);
  const order = getChecklistCategoryOrder(data, key);
  const grouped = {};
  items.forEach(i => { const c = i.cat||"Uncategorized"; if (!grouped[c]) grouped[c] = []; grouped[c].push(i); });
  return order.map(cat => ({cat, items: grouped[cat]}));
}

const TRACK_INFO = {
  fast:{label:"Fast Start",color:C.teal,days:"7-14 days",checklist:FAST_START},
  regular:{label:"Regular Start",color:C.purple,days:"30 days",checklist:REGULAR_START},
  licensed:{label:"Licensed Now What",color:C.gold,days:"Ongoing",checklist:LICENSED_NOW_WHAT},
};

const TEAM_SCHEDULE = [
  {day:"Monday",title:"Mindset Monday",time:"7:30 PM CST / 8:30 PM EST",dayIndex:1},
  {day:"Tuesday",title:"SIE Securities Exam Study Group",time:"9:00 PM CST / 10:00 PM EST",note:"Licensed Life Agents only",dayIndex:2},
  {day:"Wednesday",title:"Education Center",time:"9:00 PM CST / 10:00 PM EST",dayIndex:3},
  {day:"Thursday",title:"How Money Works Opportunity Night",time:"7:30 PM CST / 8:30 PM EST",dayIndex:4},
  {day:"Saturday",title:"Team Training",time:"10:10 AM CST / 11:10 AM EST",dayIndex:6},
];

const SCRIPTS = [
  {title:"Setting Appointments - Warm Market",content:"Hey [Name], this is [Your Name]. I am calling because I recently partnered with a financial services company and I am in training. I need to complete some practice appointments and I thought of you. It is completely educational - no pressure, no sales. I just need to practice presenting. Would you be willing to help me out? It only takes about 45 minutes. When works better for you?"},
  {title:"Setting Appointments - New Contact",content:"Hi [Name], my name is [Your Name]. We met [where you met]. I am a financial professional and I am building my practice. I make it a point to sit down with people I meet and just share some information about what I do. There is no obligation whatsoever. I would love to get together for about 45 minutes. Are you available [Day 1] or [Day 2]?"},
  {title:"Opportunity Night Invite",content:"Hey [Name], I am attending a financial education event this [day] and I think you would really get value from it. It is about how money works and strategies people use to build wealth. It is free and only about an hour. I would love for you to come as my guest. Can you make it at [time]?"},
  {title:"\"I Don't Have Time\" — Recruiting Opener",content:"[Name]! I know. That's exactly why we need to get together. I'm gonna sit down with you — ten to twenty minutes. I want to share with you exactly what I'm doing and what's taking me out of my job — or what's already taken me out of my job — so I can work less but still make the same amount of money working remote. [Name], you can't tell me you don't want to hear about that.\n\nI know you don't work 168 hours a week. When's the best time to get together — during the week or on the weekends? [Let them answer.] Morning or evening? [Let them answer.] Book the appointment.\n\nIMPORTANT: If they ask what it is before the meeting, say: \"That's exactly what I want to show you — that's why I want to sit down with you.\" Protect the curiosity. Never pitch before the meeting."},
  {title:"\"How Much Have You Made?\" — Honest Answer + Redirect",content:"Be honest. Tell them exactly what you've made. Then say:\n\n\"But here's what I want you to think about — how does what I made have any bearing on what YOU'RE going to do? It doesn't. I could go on to make a million dollars and that doesn't guarantee you will. And you could outwork me and make ten times what I've made in the same amount of time. Your results are going to be based on YOU.\"\n\nRemember: Honesty builds trust. Dodging the question kills it. Own your number, then redirect to their potential."},
];

const BONUS_GOALS = [
  {id:"b1",label:"3 x $3,000",desc:"$650 Bonus + District Manager Promotion",target:3,premium:3000},
  {id:"b2",label:"6 x $6,000",desc:"$1,250 Bonus + District Manager Promotion",target:6,premium:6000},
  {id:"b3",label:"10 x $10,000",desc:"$2,050 Bonus + District Manager Promotion",target:10,premium:10000},
];


const FIELD_TRAINER_REQS = [
  {id:"ft1",req:"Must Be Life Licensed",rvpApproval:false},
  {id:"ft2",req:"Must be a District Leader",rvpApproval:false},
  {id:"ft3",req:"Must do 3 x $3,000 or 3 x 6 life apps (2 months in a row)",rvpApproval:false},
  {id:"ft4",req:"Must be actively studying for securities license",rvpApproval:false},
  {id:"ft5",req:"Must know the KT presentation and Interview",rvpApproval:true},
  {id:"ft6",req:"Must know how to Fast Start a new rep (Fast start checklist provided)",rvpApproval:true},
  {id:"ft7",req:"Must know how to handle objections",rvpApproval:false},
  {id:"ft8",req:"Must attend weekly training, meeting, etc",rvpApproval:false},
];

const TOUR_STEPS = {
  admin:[
    {title:"Welcome to NextLevel Hub!",body:"You have full admin access — manage trainers, reps, announcements, scripts, resources, production, and the full team career journey all in one place."},
    {title:"Dashboard Alerts",body:"Your dashboard shows Field Trainer Review Requests, Activity Alerts for reps with no check-ins, Upcoming Birthdays, Top Recruiters, and the Team Leaderboard — everything you need at a glance."},
    {title:"Next Level & Field Trainer Requests",body:"When a rep finishes their checklist they request Licensed Now What access. When a licensed rep is ready they request Field Trainer review. Both show as banners on your dashboard — approve or deny with one click."},
    {title:"Add & Manage Reps",body:"Click 'Add New Rep' to add a recruit — assign their track, trainer, and who recruited them. Click any rep card to open their full profile, view as rep, log check-ins, or remove them."},
    {title:"Rep Profile",body:"Each rep profile shows their trainer and rep progress, DGO photo, t-shirt size, My Why, birthday, pre-licensing class type, bonus goal, and recruit log. Everything your trainer needs in one place."},
    {title:"Team Announcements",body:"Go to Team Mgmt to post announcements. Choose Info, Warning, Success, or Urgent. Set an expiry date and it auto-hides. All users see it instantly on every device."},
    {title:"Scripts & Resources",body:"Scripts are fully editable — add, edit, or delete anytime. Resources holds links to training docs and videos organized by category. Both update for everyone instantly."},
    {title:"Leaderboard & Top Recruiters",body:"The Team Leaderboard ranks everyone by Scorecard, Life Apps, Appointments, or Recruits. Top Recruiters shows who is building the team. Both are collapsible on the dashboard."},
    {title:"Scorecard",body:"Track weekly activity — Contacts Made (goal 100), Appointments Set (goal 20), Appointments Completed (goal 20). The admin view shows a team summary so you can coach based on real activity data."},
    {title:"Production & History",body:"Track annual premium, recruits, and licensed agents against your goals. Archive each month to build a production history and track trends over time."},
  ],
  trainer:[
    {title:"Welcome, Trainer!",body:"This is your field training hub. Manage your reps, track progress, log check-ins, track your own production and scorecard — all in one place synced across every device."},
    {title:"Dashboard",body:"See activity alerts for reps with no check-ins, upcoming birthdays, top recruiters, and the leaderboard. Rep cards show dual progress bars and a gold Upgrade Pending badge when a rep has finished their checklist."},
    {title:"Rep Profile",body:"Click any rep card to open their full profile. See their trainer and rep checklists, appointments, milestones, DGO photo, t-shirt size, My Why, birthday, pre-licensing class, bonus goal, and recruit log."},
    {title:"View as Rep",body:"Use 'View as Rep' at the top of any rep profile to see exactly what they see — great for troubleshooting or walking them through the app on a call."},
    {title:"Trainer Checklist",body:"Complete your trainer checklist for each rep — covers everything from Telegram to FNA and DGO. This is your onboarding roadmap."},
    {title:"Appointments & MACHO",body:"Track all 20 training appointments with gold star MACHO scoring. 3+ stars = qualified prospect. Tap each letter to score — turns green when qualified."},
    {title:"Milestones",body:"Reps fill out their Milestones tab — My Why, birthday, pre-licensing class, DGO date and photo, exam date, t-shirt size, and bonus goal. You see all of it in their Rep-Entered Data panel."},
    {title:"My Production & Scorecard",body:"Log your own life apps and investments. Use the running total calculator to track monthly and annual premium. Your scorecard tracks weekly contacts, appointments set, and completed."},
    {title:"Check-ins & Alerts",body:"Log check-in notes in each rep's Check-ins tab. Activity alerts on the dashboard flag reps with no check-ins after 3 days and stalled reps after 7 days."},
    {title:"Today's Events",body:"A banner at the top shows today's team events. You can cancel or restore events for the day — everyone sees the update instantly."},
  ],
  rep:[
    {title:"Welcome to Your Training Hub!",body:"This app is your home base from day one all the way to RVP. Your checklist, milestones, appointments, scripts, resources, scorecard, and career path are all right here."},
    {title:"Your Checklist",body:"Check off tasks as you complete them. FTO Observations, Life Apps, and Investment counters are at the top. Your progress percentage updates automatically."},
    {title:"Milestones Tab",body:"Fill out your My Why, birthday, pre-licensing class, DGO date and photo, exam date, t-shirt size, and bonus goal. Your trainer can see everything you enter here — fill it out early!"},
    {title:"Pre-Licensing Class",body:"In Milestones, choose In-Person, Zoom, or Online Course. If you choose Online Course it shows the ExamFX link and RVP ID options to copy. Schedule your exam within 5 days of finishing class."},
    {title:"Appointments Tab",body:"Log all 20 training appointments with MACHO gold star scoring. Tap M-A-C-H-O to score each contact — 3 or more stars means they are a great candidate. Remember your purpose — these are for YOUR development!"},
    {title:"Recruits Tab",body:"Log everyone you bring into the opportunity. This is your personal record — no approval needed. Track their name, phone, and date. Once they are officially in the system their progress bar shows here too."},
    {title:"Career Path Tab",body:"Licensed agents have a Career Path tab showing your full journey — New Rep, Licensed Agent, Field Trainer, and RVP. See the 8 Field Trainer requirements and request your review when you are ready."},
    {title:"Scorecard Tab",body:"Track your weekly contacts, appointments set, and appointments completed. Focus on the activity and the results will follow. Check your conversion rate and 4-week history."},
    {title:"Scripts & Resources",body:"Scripts has word-for-word scripts for every situation. Resources has training links and documents your admin adds. Both update in real time."},
    {title:"Request Licensed Now What",body:"Finish 100% of your checklist and a gold button appears to request Licensed Now What access. Your admin approves it and your track upgrades automatically. Add the app to your phone for quick access anytime!"},
  ],
};

// ── UTILS ──
function Badge({color,children,small}) {
  return <span style={{background:color+"22",color,fontSize:small?10:11,fontWeight:600,padding:small?"2px 6px":"3px 8px",borderRadius:20,whiteSpace:"nowrap"}}>{children}</span>;
}
function Bar({pct,color=C.teal,h=6}) {
  return <div style={{background:"rgba(0,0,0,0.07)",borderRadius:99,height:h,overflow:"hidden"}}><div style={{width:`${Math.min(100,pct)}%`,background:color,height:"100%",borderRadius:99,transition:"width 0.4s ease"}}/></div>;
}
function Card({children,style={}}) {
  return <div style={{background:C.surfaceCard,borderRadius:12,border:`1px solid ${C.border}`,padding:"14px 18px",...style}}>{children}</div>;
}
function SecHead({title,count,color=C.teal}) {
  const done=count&&count[0]===count[1];
  return <div style={{display:"flex",alignItems:"center",gap:8,margin:"14px 0 6px"}}><div style={{width:3,height:14,background:done?C.success:color,borderRadius:2}}/><span style={{fontSize:13,fontWeight:700,color:C.textMid,textTransform:"uppercase",letterSpacing:"0.7px",flex:1}}>{title}</span>{count&&<span style={{fontSize:12,color:done?C.success:C.textLight}}>{count[0]}/{count[1]}</span>}</div>;
}

// ── MACHO ──
function MachoQ({value={},onChange}) {
  const letters=["M","A","C","H","O"];
  const labels={M:"Married",A:"Age 25-55",C:"Children",H:"Homeowner",O:"Occupation"};
  const score=letters.filter(l=>value[l]).length;
  const qualified=score>=3;
  return <div style={{marginTop:8}}>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
      {letters.map(l=>{const active=!!value[l];return <button key={l} onClick={()=>onChange({...value,[l]:!active})} title={labels[l]} style={{width:44,height:44,borderRadius:10,border:`2px solid ${active?C.gold:"rgba(0,0,0,0.15)"}`,background:active?C.gold+"22":"white",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,transition:"all 0.15s"}}><span style={{fontSize:14}}>{active?"★":"☆"}</span><span style={{fontSize:10,fontWeight:700,color:active?C.gold:C.textLight}}>{l}</span></button>;})}
    </div>
    {score>0&&<div style={{background:qualified?C.success+"11":"rgba(0,0,0,0.04)",border:`1px solid ${qualified?C.success+"44":"rgba(0,0,0,0.08)"}`,borderRadius:8,padding:"6px 10px"}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}>{letters.filter(l=>value[l]).map(l=><span key={l} style={{background:C.gold+"22",color:C.gold,fontSize:13,fontWeight:700,padding:"2px 8px",borderRadius:12}}>★ {labels[l]}</span>)}</div>
      <div style={{fontSize:13,fontWeight:700,color:qualified?C.success:C.gold}}>{score} ★ {qualified?"— Qualified! Great candidate.":"— "+(3-score)+" more needed to qualify"}</div>
    </div>}
  </div>;
}

function CheckItem({item,checked,onToggle,readOnly,onPopup}) {
  return <div style={{display:"flex",gap:9,padding:"7px 0",borderBottom:`1px solid ${C.border}`}}><button onClick={!readOnly?onToggle:undefined} style={{width:20,height:20,borderRadius:5,border:`2px solid ${checked?C.teal:C.border}`,background:checked?C.teal:"white",flexShrink:0,marginTop:1,cursor:readOnly?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{checked&&<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}</button><div style={{flex:1}}><div style={{fontSize:14,color:checked?C.textLight:C.text,textDecoration:checked?"line-through":"none",lineHeight:1.4}}>{item.task}</div>{item.note&&<div style={{fontSize:13,color:C.textLight,marginTop:1}}>{item.note}</div>}{item.link&&<a href={item.link} target="_blank" rel="noreferrer" style={{fontSize:13,color:C.teal,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:2,marginTop:2}}>{item.linkLabel||"Open"} &rarr;</a>}{onPopup&&<button onClick={onPopup} style={{marginTop:4,display:"inline-flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:5,background:C.teal+"11",border:`1px solid ${C.teal}33`,color:C.teal,fontSize:12,fontWeight:600,cursor:"pointer"}}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>Watch Video</button>}</div></div>;
}

// ── APP TOUR ──
function AppTour({role,onClose}) {
  const [step,setStep]=useState(0);
  const steps=TOUR_STEPS[role]||TOUR_STEPS.rep;
  const isLast=step===steps.length-1;
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{background:"white",borderRadius:16,padding:28,maxWidth:400,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{display:"flex",gap:4}}>{steps.map((_,i)=><div key={i} style={{width:i===step?20:6,height:6,borderRadius:3,background:i===step?C.teal:C.border,transition:"width 0.2s"}}/>)}</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.textLight,cursor:"pointer",fontSize:18}}>x</button>
      </div>
      <div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:10}}>{steps[step].title}</div>
      <div style={{fontSize:14,color:C.textMid,lineHeight:1.6,marginBottom:20}}>{steps[step].body}</div>
      <div style={{display:"flex",gap:8}}>
        {step>0&&<button onClick={()=>setStep(step-1)} style={{flex:1,padding:"9px",borderRadius:8,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:14,color:C.textMid}}>Back</button>}
        <button onClick={()=>isLast?onClose():setStep(step+1)} style={{flex:2,padding:"9px",borderRadius:8,border:"none",background:isLast?C.success:C.teal,color:"white",cursor:"pointer",fontSize:14,fontWeight:600}}>{isLast?"Get Started!":"Next"}</button>
      </div>
    </div>
  </div>;
}

// ── ADD TO PHONE ──
function AddToPhoneModal({onClose}) {
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{background:"white",borderRadius:16,padding:24,maxWidth:400,width:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div style={{fontSize:15,fontWeight:700,color:C.text}}>Add App to Your Phone</div><button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.textMid}}>x</button></div>
      <div style={{marginBottom:14}}><div style={{fontSize:14,fontWeight:700,color:C.teal,marginBottom:8}}>iPhone / Safari</div><div style={{fontSize:13,color:C.text,lineHeight:1.7,background:C.surface,borderRadius:8,padding:"10px 12px"}}>1. Open this app in Safari<br/>2. Tap the Share button (box with arrow)<br/>3. Scroll down and tap "Add to Home Screen"<br/>4. Tap "Add" in the top right</div></div>
      <div><div style={{fontSize:14,fontWeight:700,color:C.purple,marginBottom:8}}>Android / Chrome</div><div style={{fontSize:13,color:C.text,lineHeight:1.7,background:C.surface,borderRadius:8,padding:"10px 12px"}}>Open this app in Chrome, tap the three dots menu (top right), then choose one of these:<br/><br/><strong>Option 1:</strong> Tap "Add to Home screen" → Tap "Add"<br/><br/><strong>Option 2:</strong> Tap "Install" → Tap "Create shortcut"</div></div>
      <button onClick={onClose} style={{marginTop:16,width:"100%",padding:"10px",borderRadius:8,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:14,fontWeight:600}}>Got it!</button>
    </div>
  </div>;
}

// ── DAILY EVENTS BANNER ──
function DailyEventsBanner({data,onUpdateData,userRole}) {
  const today=new Date().getDay();
  const schedule=data.teamSchedule||TEAM_SCHEDULE;
  const todayEvents=schedule.filter(s=>s.dayIndex===today);
  const cancelledEvents=data.cancelledEvents||{};
  const todayKey=new Date().toISOString().split("T")[0];
  if(todayEvents.length===0) return null;
  return <div style={{background:`linear-gradient(135deg,${C.navyMid} 0%,${C.navyLight} 100%)`,borderRadius:12,padding:"12px 16px",marginBottom:14,color:"white"}}>
    <div style={{fontSize:13,fontWeight:700,color:C.teal,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:6}}>Today's Events</div>
    {todayEvents.map((evt,i)=>{
      const key=`${todayKey}_${i}`;
      const cancelled=cancelledEvents[key];
      const zoomLinks=data.scheduleZoomLinks||{};
      const schedIdx=schedule.findIndex(s=>s.title===evt.title&&s.dayIndex===today);
      const zEntry=zoomLinks[schedIdx]||{};
      const zUrl=typeof zEntry==="string"?zEntry:zEntry.url||"";
      const zPass=typeof zEntry==="string"?"":zEntry.password||"";
      return <div key={i} style={{marginBottom:i<todayEvents.length-1?8:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:cancelled?"rgba(255,255,255,0.3)":"white",textDecoration:cancelled?"line-through":"none"}}>{evt.title}</div><div style={{fontSize:13,color:cancelled?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.55)"}}>{evt.time}{evt.note&&" - "+evt.note}</div></div>
          {cancelled&&<Badge color={C.danger} small>Cancelled</Badge>}
          {(userRole==="admin"||userRole==="superadmin"||userRole==="trainer")&&<button onClick={()=>{const ce={...cancelledEvents,[key]:!cancelled};onUpdateData({...data,cancelledEvents:ce});}} style={{fontSize:12,padding:"3px 8px",borderRadius:6,background:cancelled?"rgba(16,185,129,0.2)":"rgba(239,68,68,0.2)",border:`1px solid ${cancelled?"rgba(16,185,129,0.4)":"rgba(239,68,68,0.4)"}`,color:cancelled?"#6ee7b7":"#fca5a5",cursor:"pointer"}}>{cancelled?"Restore":"Cancel"}</button>}
        </div>
        {zUrl&&!cancelled&&<div style={{marginTop:6,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <a href={zUrl} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(45,140,255,0.25)",border:"1px solid rgba(45,140,255,0.5)",borderRadius:6,padding:"5px 12px",textDecoration:"none"}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#60a5fa"><path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/></svg>
            <span style={{fontSize:13,fontWeight:600,color:"#60a5fa"}}>Join Zoom</span>
          </a>
          {zPass&&<span style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>Password: <strong style={{color:"white",userSelect:"all"}}>{zPass}</strong></span>}
        </div>}
      </div>;
    })}
  </div>;
}

// ── APPOINTMENT TRACKER ──
function ApptTracker({appointments=[],onChange,readOnly,bookingLink,track}) {
  const [showPurpose,setShowPurpose]=useState(true);
  const isLicensed=track==="licensed";
  const slots=Array.from({length:20},(_,i)=>appointments[i]||{id:i,name:"",phone:"",email:"",date:"",notes:"",macho:{},status:""});
  const logged=slots.filter(a=>a.name).length;
  const done=slots.filter(a=>a.status==="Completed").length;
  const qualified=slots.filter(a=>a.name&&Object.values(a.macho||{}).filter(Boolean).length>=3).length;
  const fmt=v=>{const d=v.replace(/\D/g,"").slice(0,10);if(d.length>=7)return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;if(d.length>=4)return `${d.slice(0,3)}-${d.slice(3)}`;return d;};
  const upd=(i,field,val)=>{const arr=[...slots];arr[i]={...arr[i],[field]:field==="phone"?fmt(val):val};onChange(arr);};
  const updM=(i,macho)=>{const arr=[...slots];arr[i]={...arr[i],macho};onChange(arr);};
  return <div>
    {showPurpose&&<div style={{background:C.navyMid,borderRadius:12,padding:"16px 18px",marginBottom:14,position:"relative",border:`1px solid ${C.gold}44`}}>
      <button onClick={()=>setShowPurpose(false)} style={{position:"absolute",top:10,right:12,background:"none",border:"none",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:16}}>x</button>
      {isLicensed?<>
        <div style={{fontSize:16,fontWeight:700,color:C.gold,marginBottom:8}}>Complete 20 Appointments to Prepare for Field Trainer Promotion</div>
        <div style={{fontSize:14,color:"rgba(255,255,255,0.8)",lineHeight:1.6,marginBottom:10}}>These 20 appointments are your foundation to sharpen your presentation skills and put you in position to be a great field trainer. The more families you personally help, the easier it'll be when you're training someone to do that same. The reps who complete all 20 appointments walk into Field Trainer status <strong style={{color:"white"}}>ready to actually teach it</strong>, not just talk about it.</div>
      </>:<>
        <div style={{fontSize:16,fontWeight:700,color:C.gold,marginBottom:8}}>Remember Your Purpose!</div>
        <div style={{fontSize:14,color:"rgba(255,255,255,0.8)",lineHeight:1.6,marginBottom:10}}>This is a log of all your training appointments. Your training appointments are primarily for <strong style={{color:"white"}}>YOUR development</strong>, not to recruit or sell. Your <strong style={{color:"white"}}>#1 goal</strong> is to get in front of your trainer and sharpen your skills.</div>
      </>}
      <div style={{background:"rgba(255,255,255,0.07)",borderRadius:8,padding:"8px 12px",fontSize:13,color:"rgba(255,255,255,0.7)"}}>Need help? <strong style={{color:C.gold}}>Tap the Scripts tab</strong> — it has everything you need!</div>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
      {[["Logged",logged,"20",C.teal],["Completed",done,logged||"-",C.success],["Qualified",qualified,logged||"-",C.gold]].map(([l,v,t,c])=><div key={l} style={{background:c+"11",borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:c}}>{v}</div><div style={{fontSize:12,color:C.textMid}}>{l}</div><div style={{fontSize:12,color:C.textLight}}>of {t}</div></div>)}
    </div>
    <Bar pct={(logged/20)*100} h={4}/>
    {bookingLink&&!readOnly&&<div style={{background:C.gold+"11",border:`1px solid ${C.gold}33`,borderRadius:8,padding:"8px 12px",margin:"10px 0",fontSize:13}}><a href={bookingLink} target="_blank" rel="noreferrer" style={{color:C.gold,fontWeight:600}}>Schedule Training Appointment &rarr;</a><div style={{color:C.textMid,marginTop:2,fontSize:13}}>Add yourself as "guest" to receive notifications</div></div>}
    <div style={{marginTop:10}}>
      {slots.map((a,i)=><div key={i} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:10,marginBottom:6,background:a.status==="Completed"?C.success+"08":"white"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:12,fontWeight:700,color:C.textLight,textTransform:"uppercase"}}>Appt #{i+1}</span>
          {!readOnly&&<select value={a.status||""} onChange={e=>upd(i,"status",e.target.value)} style={{fontSize:13,padding:"2px 5px",borderRadius:5,border:`1px solid ${C.border}`,color:C.text}}><option value="">Set Status</option><option value="Completed">Completed</option><option value="Cancelled">Cancelled</option></select>}
          {readOnly&&a.status&&<Badge color={a.status==="Completed"?C.success:C.warning} small>{a.status}</Badge>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>{[["name","Name"],["phone","Phone"],["email","Email"],["date","Date"]].map(([f,ph])=><input key={f} type={f==="date"?"date":"text"} placeholder={ph} value={a[f]||""} readOnly={readOnly} onChange={e=>upd(i,f,e.target.value)} style={{padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,background:readOnly?C.surface:"white",color:C.text}}/>)}</div>
        <textarea placeholder="Notes / Follow-up" value={a.notes||""} readOnly={readOnly} onChange={e=>upd(i,"notes",e.target.value)} style={{width:"100%",marginTop:5,padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,resize:"vertical",minHeight:36,background:readOnly?C.surface:"white",color:C.text,boxSizing:"border-box"}}/>
        {!readOnly&&<MachoQ value={a.macho||{}} onChange={m=>updM(i,m)}/>}
        {readOnly&&a.macho&&(()=>{const score=Object.values(a.macho).filter(Boolean).length;const q=score>=3;return score>0?<div style={{marginTop:6,background:q?C.success+"11":"rgba(0,0,0,0.04)",borderRadius:6,padding:"4px 8px",fontSize:13,color:q?C.success:C.textLight}}>{score}/5 stars {q?"- Qualified":""}</div>:null;})()}
      </div>)}
    </div>
  </div>;
}

// ── REP EXTRAS ──
function RepExtras({rep,onUpdate,onUpdateData,readOnly,data={}}) {
  const repRef2=useRef(rep);
  useEffect(()=>{repRef2.current=rep;},[rep]);
  const [showWhyExample,setShowWhyExample]=useState(false);
  // Promotion level selector — licensed reps only
  const PROMO_LEVELS=[
    {key:"rep",label:"Rep",pct:25},
    {key:"sr_rep",label:"Senior Rep",pct:35},
    {key:"dl",label:"District Leader",pct:50},
    {key:"divl",label:"Division Leader",pct:60},
    {key:"rl",label:"Regional Leader",pct:70},
    {key:"srl",label:"Senior Regional Leader",pct:80},
    {key:"rvp",label:"RVP",pct:110},
  ];
  const currentPromo = PROMO_LEVELS.find(p=>p.key===(rep.promotionLevel||"rep"))||PROMO_LEVELS[0];

  const today=new Date();
  const motivation=MOTIVATIONS[today.getDate()%MOTIVATIONS.length];
  const [repIdDraft,setRepIdDraft]=useState(rep.primericaRepId||"");
  useEffect(()=>{setRepIdDraft(rep.primericaRepId||"");},[rep.primericaRepId]);
  const saveRepId=()=>{
    if(readOnly) return;
    onUpdate({...repRef2.current,primericaRepId:repIdDraft.trim()});
  };
  return <div>
    {!readOnly&&<div style={{border:`1px solid ${!rep.primericaRepId?C.danger:C.border}`,borderRadius:10,padding:12,marginBottom:12,background:!rep.primericaRepId?C.danger+"0a":"white"}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:2}}>Your Primerica Rep ID {!rep.primericaRepId&&<span style={{color:C.danger}}>(required)</span>}</div>
      <div style={{fontSize:12,color:C.textMid,marginBottom:8,lineHeight:1.4}}>The Rep ID Primerica issued you when you joined. This makes sure you get credit when you share your video links — required so teammates with the same name don't get mixed up.</div>
      <div style={{display:"flex",gap:6}}>
        <input value={repIdDraft} onChange={e=>setRepIdDraft(e.target.value)} placeholder="e.g. 12345678" style={{flex:1,padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
        <button onClick={saveRepId} style={{padding:"7px 14px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>Save</button>
      </div>
    </div>}
    {/* Daily Motivation + My Why side by side */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
      <div style={{background:`linear-gradient(135deg,${C.navyMid},${C.navyLight})`,borderRadius:12,padding:"14px 16px",color:"white",border:`1px solid ${C.teal}33`}}>
        <div style={{fontSize:12,fontWeight:700,color:C.teal,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:6}}>Daily Motivation</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",lineHeight:1.6,fontStyle:"italic"}}>"{motivation}"</div>
      </div>
      <Card style={{margin:0}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>My Why</div>
        <div style={{fontSize:12,color:C.textMid,marginBottom:6}}>Your personal reason for joining. What would you want to change in your life over the next 12 months, and why is that important to you?</div>
        {!readOnly&&<button onClick={()=>setShowWhyExample(!showWhyExample)} style={{fontSize:12,color:C.teal,background:"none",border:"none",fontWeight:600,cursor:"pointer",padding:0,marginBottom:8,display:"flex",alignItems:"center",gap:4}}>💡 {showWhyExample?"Hide Example":"See an Example"}</button>}
        {showWhyExample&&<div style={{background:C.purple+"0d",border:`1px solid ${C.purple}33`,borderRadius:8,padding:"10px 12px",marginBottom:10}}>
          <div style={{fontSize:10,fontWeight:700,color:C.purple,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:5}}>Example — for inspiration, not to copy</div>
          <div style={{fontSize:12,color:C.text,lineHeight:1.6,fontStyle:"italic"}}>"I joined because I want more control over my time and income instead of trading hours for a paycheck. Over the next 12 months, I want to pay off my car and start actually saving instead of living check to check. That matters to me because I'm tired of feeling stressed every time something unexpected comes up — I want to be the parent who can say yes without checking the bank account first."</div>
        </div>}
        {!readOnly?<textarea placeholder="I joined because..." value={rep.myWhy||""} onChange={e=>onUpdate({...rep,myWhy:e.target.value})} style={{width:"100%",padding:"7px 9px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text,resize:"vertical",minHeight:60,boxSizing:"border-box",lineHeight:1.5,fontFamily:"inherit"}}/>:
        <div style={{fontSize:13,lineHeight:1.5,background:C.surface,borderRadius:8,padding:"7px 9px",fontStyle:rep.myWhy?"italic":"normal",color:rep.myWhy?C.text:C.textLight}}>{rep.myWhy||"Not set yet"}</div>}
      </Card>
    </div>
    {/* Birthday */}
    <Card style={{marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>My Birthday</div>
      <div style={{fontSize:13,color:C.textMid,marginBottom:8}}>Your birthday helps us celebrate you!</div>
      {!readOnly?<input type="date" value={rep.birthday||""} onChange={e=>onUpdate({...rep,birthday:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,color:C.text,boxSizing:"border-box"}}/>:
      <div style={{fontSize:14,fontWeight:600,color:C.purple}}>{rep.birthday?new Date(rep.birthday+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}):"Not set"}</div>}
    </Card>
    {/* Promotion Level — licensed and field trainer reps */}
    {(rep.track==="licensed"||rep.fieldTrainerGranted)&&<Card style={{marginBottom:12,border:`1px solid ${C.gold}33`}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8}}>My Promotion Level</div>
      <div style={{fontSize:13,color:C.textMid,marginBottom:8}}>Select your current Primerica promotion level to see accurate commission calculations.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
        {PROMO_LEVELS.map(p=><button key={p.key} onClick={()=>!readOnly&&onUpdate({...repRef2.current,promotionLevel:p.key})} style={{padding:"6px 8px",borderRadius:7,border:`1px solid ${(rep.promotionLevel||"rep")===p.key?C.gold:C.border}`,background:(rep.promotionLevel||"rep")===p.key?C.gold+"11":"white",cursor:readOnly?"default":"pointer",textAlign:"left"}}>
          <div style={{fontSize:13,fontWeight:700,color:(rep.promotionLevel||"rep")===p.key?C.gold:C.text}}>{p.label}</div>
          <div style={{fontSize:12,color:C.textMid}}>{p.pct}%</div>
        </button>)}
      </div>
    </Card>}
    {/* Pre-Licensing Class — hidden for licensed reps */}
    {rep.track!=="licensed"&&<Card style={{marginBottom:12,border:`1px solid ${rep.preLicDone?C.success+"44":C.purple+"33"}`,background:rep.preLicDone?C.success+"06":"white"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text}}>Pre-Licensing Class</div>
        {!readOnly&&<button onClick={()=>onUpdate({...rep,preLicDone:!rep.preLicDone})}
          style={{fontSize:13,padding:"4px 10px",borderRadius:6,border:`1px solid ${rep.preLicDone?C.success:C.purple}`,background:rep.preLicDone?C.success+"11":C.purple+"11",color:rep.preLicDone?C.success:C.purple,cursor:"pointer",fontWeight:600}}>
          {rep.preLicDone?"Completed":"Mark Complete"}
        </button>}
        {rep.preLicDone&&readOnly&&<Badge color={C.success} small>Complete</Badge>}
      </div>

      {/* Class type selector */}
      {!readOnly&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
        {[["inperson","In-Person",""],["zoom","Zoom",""],["online","Online Course",""]].map(([val,label,icon])=>(
          <button key={val} onClick={()=>onUpdate({...rep,preLicType:val})}
            style={{padding:"10px 6px",borderRadius:8,border:`2px solid ${rep.preLicType===val?C.purple:C.border}`,background:rep.preLicType===val?C.purple+"11":"white",cursor:"pointer",textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:700,color:rep.preLicType===val?C.purple:C.textMid}}>{label}</div>
          </button>
        ))}
      </div>}
      {readOnly&&rep.preLicType&&<div style={{marginBottom:10}}><Badge color={C.purple} small>{rep.preLicType==="inperson"?"In-Person":rep.preLicType==="zoom"?"Zoom":"Online Course"}</Badge></div>}

      {/* Online course details - show for ALL types */}
      {rep.preLicType&&<div>
        <div style={{background:C.purple+"11",border:`1px solid ${C.purple}33`,borderRadius:8,padding:"10px 12px",marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:700,color:C.purple,marginBottom:4}}>Get your study materials here:</div>
          <a href="https://www-ucanpass.examfx.com" target="_blank" rel="noreferrer"
            style={{fontSize:14,fontWeight:700,color:C.teal,textDecoration:"none",display:"block",marginBottom:3}}>www-ucanpass.examfx.com &rarr;</a>
          <div style={{fontSize:13,color:C.textMid}}>Log in or create your account to begin your online licensing course.</div>
        </div>

        {/* RVP ID selector */}
        <div style={{marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:6}}>Select Your RVP ID</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {[{id:"BXKX9",name:"Tellis Bolton"},{id:"519KU",name:"Jacqueline Jones"},...((data&&data.customRVPs)||[]).filter(r=>r.id&&r.id.trim())].map((rvp,i)=>{
              const selected=rep.selectedRVP===rvp.id;
              return <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,border:`2px solid ${selected?C.gold:C.border}`,background:selected?C.gold+"11":"white",cursor:readOnly?"default":"pointer"}}
                onClick={()=>!readOnly&&onUpdate({...rep,selectedRVP:rvp.id})}>
                <div style={{width:18,height:18,borderRadius:9,border:`2px solid ${selected?C.gold:C.border}`,background:selected?C.gold:"white",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {selected&&<div style={{width:8,height:8,borderRadius:4,background:"white"}}/>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:selected?C.gold:C.text}}>{rvp.id}</div>
                  <div style={{fontSize:13,color:C.textMid}}>{rvp.name}</div>
                </div>
                {selected&&<button onClick={e=>{e.stopPropagation();navigator.clipboard?.writeText(rvp.id);}}
                  style={{fontSize:12,padding:"3px 8px",borderRadius:5,background:C.gold,color:"white",border:"none",cursor:"pointer",fontWeight:600}}>Copy</button>}
              </div>;
            })}
          </div>
        </div>
      </div>}

      {/* Dates */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:rep.preLicDone?8:0}}>
        <div>
          <div style={{fontSize:12,color:C.textMid,marginBottom:3}}>Start Date</div>
          {!readOnly?<input type="date" value={rep.preLicStart||""} onChange={e=>onUpdate({...rep,preLicStart:e.target.value})}
            style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box"}}/>:
          <div style={{fontSize:13,fontWeight:600,color:C.text}}>{rep.preLicStart||"Not set"}</div>}
        </div>
        {rep.preLicDone&&<div>
          <div style={{fontSize:12,color:C.textMid,marginBottom:3}}>Completion Date</div>
          {!readOnly?<input type="date" value={rep.preLicEnd||""} onChange={e=>onUpdate({...rep,preLicEnd:e.target.value})}
            style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box"}}/>:
          <div style={{fontSize:13,fontWeight:600,color:C.text}}>{rep.preLicEnd||"Not set"}</div>}
        </div>}
      </div>
    </Card>}
    {rep.track!=="licensed"&&<Card style={{marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>My Bonus Goal</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {BONUS_GOALS.map(g=>{const selected=rep.bonusGoal===g.id;return <button key={g.id} onClick={()=>!readOnly&&onUpdate({...rep,bonusGoal:g.id})} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,border:`2px solid ${selected?C.gold:C.border}`,background:selected?C.gold+"11":"white",cursor:readOnly?"default":"pointer",textAlign:"left"}}><div style={{width:18,height:18,borderRadius:9,border:`2px solid ${selected?C.gold:C.border}`,background:selected?C.gold:"white",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{selected&&<div style={{width:8,height:8,borderRadius:4,background:"white"}}/>}</div><div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:selected?C.gold:C.text}}>{g.label} done</div><div style={{fontSize:13,color:C.textMid}}>{g.desc}</div></div></button>;})}
      </div>
    </Card>}
    <Card style={{marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8}}>Business Commitment</div>
      <div style={{fontSize:13,color:C.textMid,marginBottom:8}}>Dollar amount committed to your business</div>
      {!readOnly?<div style={{display:"flex",gap:7,alignItems:"center"}}><span style={{color:C.textMid,fontSize:16}}>$</span><input type="number" placeholder="Enter amount" value={rep.businessCommitment||""} onChange={e=>onUpdate({...rep,businessCommitment:e.target.value})} style={{flex:1,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,color:C.text}}/></div>:
      <div style={{fontSize:16,fontWeight:700,color:C.gold}}>{rep.businessCommitment?`$${rep.businessCommitment}`:"Not set"}</div>}
    </Card>
    <Card style={{marginBottom:12,border:`1px solid ${rep.dgoDone?C.success+"44":C.teal+"33"}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text}}>Digital Grand Opening (DGO)</div>
        {!readOnly&&<button onClick={()=>onUpdate({...rep,dgoDone:!rep.dgoDone})} style={{fontSize:13,padding:"4px 10px",borderRadius:6,border:`1px solid ${rep.dgoDone?C.success:C.teal}`,background:rep.dgoDone?C.success+"11":C.teal+"11",color:rep.dgoDone?C.success:C.teal,cursor:"pointer",fontWeight:600}}>{rep.dgoDone?"Completed":"Mark Complete"}</button>}
      </div>
      {!readOnly?<input type="date" value={rep.dgoDate||""} onChange={e=>onUpdate({...rep,dgoDate:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,color:C.text,boxSizing:"border-box",marginBottom:10}}/>:
      <div style={{fontSize:14,fontWeight:700,color:C.teal,marginBottom:10}}>{rep.dgoDate||"Not set"}</div>}
      {/* Professional Photo */}
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
        <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:6}}>Professional Photo — DGO & Team Recognition</div>
        <div style={{fontSize:13,color:C.textLight,marginBottom:8}}>Upload a professional headshot — used for your DGO presentation and Wall of Fame recognition</div>
{(()=>{let p=rep.dgoPhoto;if(!p){try{p=localStorage.getItem("dgoPhoto_"+rep.id);}catch(ex){}}return p?<div style={{marginBottom:8,position:"relative",display:"inline-block"}}><img src={p} alt="DGO Photo" style={{width:80,height:80,borderRadius:10,objectFit:"cover",border:`2px solid ${C.teal}`}}/>{!readOnly&&<button onClick={()=>{try{localStorage.removeItem("dgoPhoto_"+rep.id);}catch(ex){}onUpdate({...rep,dgoPhoto:null});}} style={{position:"absolute",top:-6,right:-6,width:20,height:20,borderRadius:10,background:C.danger,color:"white",border:"none",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>x</button>}</div>:null;})()}
        {!readOnly&&<div>
          <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:8,background:C.teal+"11",border:`1px solid ${C.teal}33`,cursor:"pointer",fontSize:13,color:C.teal,fontWeight:600}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            {rep.dgoPhoto?"Change Photo":"Upload Profile Photo"}
            <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
              const file=e.target.files[0];
              if(!file) return;
              if(file.size>10*1024*1024){alert("Photo must be under 10MB");return;}
              const reader=new FileReader();
              reader.onload=ev=>{
                const img=new Image();
                img.onload=()=>{
                  const canvas=document.createElement("canvas");
                  let w=img.width,h=img.height;
                  const MAX=400;
                  if(w>h){if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}}
                  else{if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}}
                  canvas.width=w;canvas.height=h;
                  canvas.getContext("2d").drawImage(img,0,0,w,h);
                  const compressed=canvas.toDataURL("image/jpeg",0.7);
                  if(onUpdateData&&data){
                    onUpdateData({...data,
                      profilePhotos:{...(data.profilePhotos||{}),[rep.id]:compressed},
                      reps:(data.reps||[]).map(r=>r.id===rep.id?{...r,dgoPhoto:compressed}:r)
                    });
                  } else {
                    try{localStorage.setItem("dgoPhoto_"+rep.id,compressed);}catch(ex){}
                  onUpdate({...rep,dgoPhoto:compressed});
                  }
                };
                img.src=ev.target.result;
              };
              reader.readAsDataURL(file);
            }}/>
          </label>
        </div>}
        {readOnly&&!rep.dgoPhoto&&<div style={{fontSize:13,color:C.textLight}}>No photo uploaded yet</div>}
      </div>
    </Card>
    <Card style={{marginBottom:12,border:`1px solid ${rep.examPassed?C.success+"44":C.gold+"33"}`}}>
      {rep.track!=="licensed"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text}}>Exam Date</div>
        {!readOnly&&<button onClick={()=>onUpdate({...rep,examPassed:!rep.examPassed})} style={{fontSize:13,padding:"4px 10px",borderRadius:6,border:`1px solid ${rep.examPassed?C.success:C.gold}`,background:rep.examPassed?C.success+"11":C.gold+"11",color:rep.examPassed?C.success:C.gold,cursor:"pointer",fontWeight:600}}>{rep.examPassed?"Passed!":"Mark Passed"}</button>}
      </div>
      <div style={{fontSize:13,color:C.textLight,marginBottom:6}}>Schedule within 5 days of completing your class</div>
      {!readOnly?<input type="date" value={rep.examDate||""} onChange={e=>onUpdate({...rep,examDate:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,color:C.text,boxSizing:"border-box",marginBottom:12}}/>:
      <div style={{fontSize:14,fontWeight:700,color:C.gold,marginBottom:12}}>{rep.examDate||"Not set"}</div>}
      </div>}
      {/* T-Shirt Size */}
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
        <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:4}}>T-Shirt Size</div>
        <div style={{fontSize:13,color:C.textLight,marginBottom:8}}>You will receive a t-shirt after passing your life insurance exam!</div>
        {!readOnly?<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["XS","S","M","L","XL","2XL","3XL"].map(size=>{
            const selected=rep.tshirtSize===size;
            return <button key={size} onClick={()=>onUpdate({...rep,tshirtSize:size})}
              style={{padding:"6px 12px",borderRadius:8,border:`2px solid ${selected?C.gold:C.border}`,background:selected?C.gold:"white",color:selected?"white":C.textMid,fontSize:13,fontWeight:selected?700:400,cursor:"pointer",transition:"all 0.15s"}}>
              {size}
            </button>;
          })}
        </div>:
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {rep.tshirtSize?<><div style={{padding:"6px 16px",borderRadius:8,background:C.gold,color:"white",fontSize:14,fontWeight:700}}>{rep.tshirtSize}</div><span style={{fontSize:13,color:C.textMid}}>T-Shirt Size</span></>:
          <span style={{fontSize:13,color:C.textLight}}>No size selected yet</span>}
        </div>}
      </div>
    </Card>

  </div>;
}

// ── REP COUNTERS ──
function RepCounters({rep,onUpdate,readOnly}) {
  const [showInvLog,setShowInvLog]=useState(false);
  const [prospectName,setProspectName]=useState("");
  const invObservations=rep.investmentObservations||[];

  const addObservation=()=>{
    if(!prospectName.trim()) return;
    onUpdate({...rep,investmentObservations:[...invObservations,{name:prospectName.trim(),date:new Date().toLocaleDateString(),id:Date.now()}]});
    setProspectName("");
  };

  return <div style={{marginBottom:14}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:0}}>
      {[{label:"FTO Observations",key:"ftoCount",goal:20,color:C.purple,note:"Goal: 20 FTO"},{label:"Life Insurance Observation",key:"lifeAppCount",goal:10,color:C.teal,note:"Goal: 10 during training"},{label:"Investment Observation",key:"pacCount",goal:10,color:C.gold,note:"Builds your future AUM"}].map(c=><Card key={c.key} style={{padding:"10px 12px"}}>
        <div style={{fontSize:13,color:C.textMid,marginBottom:4}}>{c.label}</div>
        <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{fontSize:22,fontWeight:700,color:c.color}}>{c.key==="pacCount"?invObservations.length:(rep[c.key]||0)}</div><div style={{flex:1}}><Bar pct={((c.key==="pacCount"?invObservations.length:(rep[c.key]||0))/c.goal)*100} color={c.color}/></div><div style={{fontSize:12,color:C.textLight}}>/{c.goal}</div></div>
        {!readOnly&&c.key!=="pacCount"&&<div style={{display:"flex",gap:5,marginTop:6}}><button onClick={()=>onUpdate({...rep,[c.key]:Math.max(0,(rep[c.key]||0)-1)})} style={{flex:1,padding:"3px",borderRadius:6,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:15,color:C.textMid}}>-</button><button onClick={()=>onUpdate({...rep,[c.key]:(rep[c.key]||0)+1})} style={{flex:1,padding:"3px",borderRadius:6,border:"1px solid "+c.color,background:c.color+"11",cursor:"pointer",fontSize:15,color:c.color,fontWeight:700}}>+</button></div>}
        {!readOnly&&c.key==="pacCount"&&<button onClick={()=>setShowInvLog(!showInvLog)} style={{marginTop:6,width:"100%",padding:"3px",borderRadius:6,border:`1px solid ${C.gold}`,background:C.gold+"11",cursor:"pointer",fontSize:12,color:C.gold,fontWeight:600}}>
          {showInvLog?"Hide Log":"+ Log Name"}
        </button>}
        <div style={{fontSize:12,color:C.textLight,marginTop:3}}>{c.note}</div>
      </Card>)}
    </div>

    {/* Investment Observation Log — drops down under the counter */}
    {(showInvLog||invObservations.length>0)&&<Card style={{marginTop:8,border:`1px solid ${C.gold}33`,background:C.gold+"06"}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8}}>Investment Observation Log</div>
      <div style={{fontSize:13,color:C.textMid,marginBottom:8}}>Log the prospect name of each person you observed getting an investment account opened during your training appointments. This builds your future AUM pipeline.</div>
      {!readOnly&&<div style={{display:"flex",gap:6,marginBottom:10}}>
        <input
          placeholder="Prospect Name"
          value={prospectName}
          onChange={e=>setProspectName(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&addObservation()}
          style={{flex:1,padding:"6px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}
        />
        <button onClick={addObservation} style={{padding:"6px 12px",borderRadius:7,background:C.gold,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600}}>Add</button>
      </div>}
      {invObservations.length>0&&<div style={{maxHeight:160,overflowY:"auto"}}>
        {invObservations.slice().reverse().map((obs,i)=><div key={obs.id||i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${C.border}`,fontSize:13}}>
          <div>
            <span style={{color:C.text,fontWeight:600}}>{obs.name}</span>
            <span style={{color:C.textLight,marginLeft:8}}>{obs.date}</span>
          </div>
          {!readOnly&&<button onClick={()=>onUpdate({...rep,investmentObservations:invObservations.filter((_,j)=>j!==(invObservations.length-1-i))})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:13}}>x</button>}
        </div>)}
      </div>}
      {invObservations.length===0&&<div style={{fontSize:13,color:C.textLight,textAlign:"center",padding:"10px 0"}}>No observations logged yet</div>}
    </Card>}
  </div>;
}

// ── CAREER JOURNEY BANNER (sticky, collapsible) ──
function CareerJourneyBanner({rep,onUpdate}) {
  const [expanded,setExpanded] = useState(false);
  const stages = [
    {key:"new",label:"New Rep",color:C.teal},
    {key:"licensed",label:"Licensed",color:C.gold},
    {key:"trainer",label:"Trainer",color:C.purple},
  ];
  const currentStage = rep.fieldTrainerGranted?"trainer":rep.track==="licensed"?"licensed":"new";
  const stageIndex = stages.findIndex(s=>s.key===currentStage);
  const currentColor = stages[stageIndex]?.color||C.teal;
  const ftRequested = rep.fieldTrainerRequested&&!rep.fieldTrainerGranted;
  const rvpRequested = rep.rvpPathRequested&&!rep.rvpPathGranted;

  const nextGoal = currentStage==="new"?"Get Life Licensed":currentStage==="licensed"?"Become a Field Trainer":currentStage==="trainer"?"Become an RVP":"Regional Vice President";

  return <div style={{marginBottom:12,borderRadius:10,border:"1px solid "+currentColor+"33",overflow:"hidden"}}>
    {/* Collapsed header - always visible */}
    <button onClick={()=>setExpanded(!expanded)} style={{width:"100%",background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",border:"none",cursor:"pointer",padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
      {/* Mini roadmap */}
      <div style={{display:"flex",alignItems:"center",gap:0,flex:1}}>
        {stages.map((s,i)=>{
          const active=s.key===currentStage;
          const done=i<stageIndex;
          return <div key={s.key} style={{display:"flex",alignItems:"center",flex:i<stages.length-1?1:"none"}}>
            <div style={{width:18,height:18,borderRadius:9,background:active?s.color:done?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.08)",border:"2px solid "+(active?s.color:done?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.15)"),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {done&&<svg width="8" height="7" viewBox="0 0 8 7" fill="none"><path d="M1 3.5L3 5.5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
              {active&&<div style={{width:6,height:6,borderRadius:3,background:"white"}}/>}
            </div>
            {i<stages.length-1&&<div style={{flex:1,height:2,background:done?"rgba(255,255,255,0.25)":"rgba(255,255,255,0.08)",margin:"0 2px"}}/>}
          </div>;
        })}
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.5px"}}>Next Goal</div>
        <div style={{fontSize:13,fontWeight:700,color:currentColor}}>{nextGoal}</div>
      </div>
      <div style={{color:"rgba(255,255,255,0.4)",fontSize:13,transform:expanded?"rotate(180deg)":"none",transition:"transform 0.2s",flexShrink:0}}>v</div>
    </button>

    {/* Expanded detail */}
    {expanded&&<div style={{background:"white",padding:"12px 14px"}}>
      {currentStage==="new"&&<div>
        <div style={{fontSize:13,color:C.text,lineHeight:1.6,marginBottom:10}}>Getting your life insurance license is your first major milestone. Complete your checklist, finish your pre-licensing class, and pass your exam. Once licensed a whole new path opens up!</div>
        <div style={{fontSize:13,color:C.textLight,textAlign:"center"}}>Field Trainer and RVP paths unlock after you get licensed.</div>
      </div>}
      {currentStage==="licensed"&&<div>
        <div style={{fontSize:13,color:C.text,lineHeight:1.6,marginBottom:10}}>You are licensed! Now build your skills, production, and team. When you meet the Field Trainer requirements, request your review below.</div>
        {!ftRequested&&!rep.fieldTrainerDenied&&<button onClick={()=>{onUpdate(rep.id,{...rep,fieldTrainerRequested:true,fieldTrainerDenied:false,fieldTrainerRequestedAt:new Date().toISOString()});setExpanded(false);}}
          style={{width:"100%",padding:"9px",borderRadius:8,background:"linear-gradient(135deg,"+C.purple+",#7c3aed)",color:"white",border:"none",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          Request Field Trainer Review
        </button>}
        {ftRequested&&<div style={{background:C.gold+"11",border:"1px solid "+C.gold+"33",borderRadius:8,padding:"8px 12px",textAlign:"center",fontSize:13,color:C.gold,fontWeight:600}}>Review requested! Your RVP has been notified.</div>}
        {rep.fieldTrainerDenied&&!ftRequested&&<div>
          <div style={{background:C.danger+"11",border:"1px solid "+C.danger+"33",borderRadius:8,padding:"7px 12px",fontSize:13,color:C.danger,marginBottom:6,textAlign:"center"}}>Request was not approved — speak with your trainer for next steps</div>
          <button onClick={()=>{onUpdate(rep.id,{...rep,fieldTrainerRequested:true,fieldTrainerDenied:false,fieldTrainerRequestedAt:new Date().toISOString()});setExpanded(false);}}
            style={{width:"100%",padding:"9px",borderRadius:8,background:"linear-gradient(135deg,"+C.purple+",#7c3aed)",color:"white",border:"none",fontWeight:700,fontSize:13,cursor:"pointer"}}>
            Request Again
          </button>
        </div>}
      </div>}
      {currentStage==="trainer"&&<div>
        <div style={{fontSize:13,color:C.text,lineHeight:1.6,marginBottom:10}}>You are a Field Trainer! Now focus on consistently producing and building your team. When you are ready, request access to the RVP Path.</div>
        {!rvpRequested&&!rep.rvpPathDenied&&<button onClick={()=>{onUpdate(rep.id,{...rep,rvpPathRequested:true,rvpPathDenied:false,rvpPathRequestedAt:new Date().toISOString()});setExpanded(false);}}
          style={{width:"100%",padding:"9px",borderRadius:8,background:"linear-gradient(135deg,"+C.success+",#059669)",color:"white",border:"none",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          Request RVP Path Access
        </button>}
        {rvpRequested&&<div style={{background:C.gold+"11",border:"1px solid "+C.gold+"33",borderRadius:8,padding:"8px 12px",textAlign:"center",fontSize:13,color:C.gold,fontWeight:600}}>RVP Path request sent! Your admin will review soon.</div>}
        {rep.rvpPathDenied&&!rvpRequested&&<div>
          <div style={{background:C.danger+"11",border:"1px solid "+C.danger+"33",borderRadius:8,padding:"7px 12px",fontSize:13,color:C.danger,marginBottom:6,textAlign:"center"}}>Request was not approved — speak with your trainer for next steps</div>
          <button onClick={()=>{onUpdate(rep.id,{...rep,rvpPathRequested:true,rvpPathDenied:false,rvpPathRequestedAt:new Date().toISOString()});setExpanded(false);}}
            style={{width:"100%",padding:"9px",borderRadius:8,background:"linear-gradient(135deg,"+C.success+",#059669)",color:"white",border:"none",fontWeight:700,fontSize:13,cursor:"pointer"}}>
            Request Again
          </button>
        </div>}
      </div>}
      {currentStage==="rvp"&&<div>
        <div style={{fontSize:13,color:C.text,lineHeight:1.6,marginBottom:8}}>You have unlocked the RVP Path! Check the Career Path tab for your full RVP checklist.</div>
        <div style={{fontSize:13,color:C.success,fontWeight:600,textAlign:"center"}}>You are on your way to Regional Vice President!</div>
      </div>}
    </div>}
  </div>;
}

// ── REP VIEW ──


// ── SCHEDULE VIEW WITH ZOOM LINKS ──
const SCHEDULE_DAY_OPTIONS=[{l:"Sunday",i:0},{l:"Monday",i:1},{l:"Tuesday",i:2},{l:"Wednesday",i:3},{l:"Thursday",i:4},{l:"Friday",i:5},{l:"Saturday",i:6}];

function ScheduleView({data,onUpdate,userRole}) {
  const isAdmin = userRole==="admin"||userRole==="superadmin";
  const schedule = data.teamSchedule||TEAM_SCHEDULE;
  const zoomLinks = data.scheduleZoomLinks||{};
  const [editingIdx,setEditingIdx] = useState(null);
  const [editVal,setEditVal] = useState("");
  const [editPass,setEditPass] = useState("");
  const [editEvt,setEditEvt] = useState({day:"",title:"",time:"",note:""});
  const [showAdd,setShowAdd] = useState(false);
  const [newEvt,setNewEvt] = useState({day:"Monday",title:"",time:"",note:""});

  const saveZoom = (idx) => {
    const dayObj=SCHEDULE_DAY_OPTIONS.find(d=>d.l===editEvt.day);
    const updatedSchedule=schedule.map((s,i)=>i===idx?{...s,day:editEvt.day,title:editEvt.title,time:editEvt.time,note:editEvt.note,dayIndex:dayObj?dayObj.i:s.dayIndex}:s);
    onUpdate({...data,teamSchedule:updatedSchedule,scheduleZoomLinks:{...zoomLinks,[idx]:{url:editVal.trim(),password:editPass.trim()}}});
    setEditingIdx(null);
    setEditVal("");
    setEditPass("");
  };

  const removeEvent = (idx) => {
    if(!window.confirm("Remove this event entirely? This can't be undone.")) return;
    onUpdate({...data,teamSchedule:schedule.filter((_,i)=>i!==idx)});
    setEditingIdx(null);
  };

  const addEvent = () => {
    if(!newEvt.title.trim()||!newEvt.time.trim()) return;
    const dayObj=SCHEDULE_DAY_OPTIONS.find(d=>d.l===newEvt.day);
    onUpdate({...data,teamSchedule:[...schedule,{day:newEvt.day,title:newEvt.title.trim(),time:newEvt.time.trim(),note:newEvt.note.trim(),dayIndex:dayObj?dayObj.i:1}]});
    setNewEvt({day:"Monday",title:"",time:"",note:""});
    setShowAdd(false);
  };

  return <div>
    {isAdmin&&<div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
      <button onClick={()=>setShowAdd(!showAdd)} style={{fontSize:13,padding:"6px 12px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>{showAdd?"Cancel":"+ Add Event"}</button>
    </div>}
    {showAdd&&<Card style={{marginBottom:10,border:`1px solid ${C.teal}44`}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:10}}>New Event</div>
      <select value={newEvt.day} onChange={e=>setNewEvt({...newEvt,day:e.target.value})} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,marginBottom:8,background:"white"}}>
        {SCHEDULE_DAY_OPTIONS.map(d=><option key={d.l} value={d.l}>{d.l}</option>)}
      </select>
      <input placeholder="Event title" value={newEvt.title} onChange={e=>setNewEvt({...newEvt,title:e.target.value})} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,marginBottom:8,boxSizing:"border-box"}}/>
      <input placeholder="Time (e.g. 8:30 PM CST / 9:30 PM EST)" value={newEvt.time} onChange={e=>setNewEvt({...newEvt,time:e.target.value})} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,marginBottom:8,boxSizing:"border-box"}}/>
      <input placeholder="Note (optional, e.g. Licensed Life Agents only)" value={newEvt.note} onChange={e=>setNewEvt({...newEvt,note:e.target.value})} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,marginBottom:8,boxSizing:"border-box"}}/>
      <button onClick={addEvent} style={{width:"100%",padding:"8px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Save New Event</button>
    </Card>}
    {schedule.map((s,i)=>{
      const entry = zoomLinks[i]||{};
      const zoom = typeof entry==="string"?entry:entry.url||"";
      const zoomPass = typeof entry==="string"?"":entry.password||"";
      return <Card key={i} style={{marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text}}>{s.day} — {s.title}</div>
            <div style={{fontSize:13,color:C.textLight,marginTop:2}}>{s.time}{s.note&&" · "+s.note}</div>
            {zoom&&editingIdx!==i&&<div style={{marginTop:6,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <a href={zoom} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:5,background:"#2D8CFF22",border:"1px solid #2D8CFF55",borderRadius:6,padding:"4px 10px",textDecoration:"none"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#2D8CFF"><path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/></svg>
                <span style={{fontSize:13,fontWeight:600,color:"#2D8CFF"}}>Join Zoom</span>
              </a>
              {zoomPass&&<span style={{fontSize:13,color:C.textMid}}>Password: <strong style={{color:C.text,userSelect:"all"}}>{zoomPass}</strong></span>}
            </div>}
          </div>
          {isAdmin&&<button onClick={()=>{setEditingIdx(i);setEditVal(zoom);setEditPass(zoomPass);setEditEvt({day:s.day,title:s.title,time:s.time,note:s.note||""});}} style={{fontSize:12,padding:"3px 8px",borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid,flexShrink:0}}>Edit</button>}
        </div>
        {editingIdx===i&&<div style={{marginTop:8}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:6}}>Event Details</div>
          <select value={editEvt.day} onChange={e=>setEditEvt({...editEvt,day:e.target.value})} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:13,marginBottom:5,background:"white"}}>
            {SCHEDULE_DAY_OPTIONS.map(d=><option key={d.l} value={d.l}>{d.l}</option>)}
          </select>
          <input placeholder="Event title" value={editEvt.title} onChange={e=>setEditEvt({...editEvt,title:e.target.value})} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:13,marginBottom:5,boxSizing:"border-box"}}/>
          <input placeholder="Time" value={editEvt.time} onChange={e=>setEditEvt({...editEvt,time:e.target.value})} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:13,marginBottom:5,boxSizing:"border-box"}}/>
          <input placeholder="Note (optional)" value={editEvt.note} onChange={e=>setEditEvt({...editEvt,note:e.target.value})} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:13,marginBottom:8,boxSizing:"border-box"}}/>
          <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:6}}>Zoom Info</div>
          <input placeholder="Paste Zoom link..." value={editVal} onChange={e=>setEditVal(e.target.value)} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:13,color:C.text,marginBottom:5,boxSizing:"border-box"}}/>
          <input placeholder="Meeting password (optional)" value={editPass} onChange={e=>setEditPass(e.target.value)} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:13,color:C.text,marginBottom:6,boxSizing:"border-box"}}/>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>saveZoom(i)} style={{flex:2,padding:"5px 10px",borderRadius:6,border:"none",background:"#2D8CFF",color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Save</button>
            <button onClick={()=>{setEditingIdx(null);setEditVal("");setEditPass("");}} style={{flex:1,padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
            <button onClick={()=>removeEvent(i)} style={{flex:1,padding:"5px 8px",borderRadius:6,border:"1px solid "+C.danger+"33",background:C.danger+"11",cursor:"pointer",fontSize:13,color:C.danger}}>Remove</button>
          </div>
        </div>}
      </Card>;
    })}
  </div>;
}


// ── DEFAULT EMAIL TEMPLATES ──
const DEFAULT_EMAIL_TEMPLATES = [
  // Welcome & Onboarding
  {id:"e1",cat:"Welcome & Onboarding",subject:"Welcome to the Team!",body:"Hi [Name],\n\nWelcome to NextLevel! We are so excited to have you on the team. Your checklist is ready and waiting for you in the app.\n\nLog in daily, complete each step, and don't hesitate to reach out if you need anything. We are here to support you every step of the way!\n\nLet's build something great together.\n\n[Your Name]"},
  {id:"e2",cat:"Welcome & Onboarding",subject:"Getting Started — Your Checklist is Ready",body:"Hi [Name],\n\nJust checking in to make sure you got logged into the NextLevel app. Your checklist is waiting and it's the roadmap to getting licensed and building your business.\n\nIf you need help logging in or have any questions just reply to this email.\n\nLet's get started!\n\n[Your Name]"},
  {id:"e3",cat:"Welcome & Onboarding",subject:"How to Access the App",body:"Hi [Name],\n\nHere is how to access the NextLevel Field Training Hub:\n\n1. Go to: nextlevel-hub.vercel.app\n2. Select New Rep / Licensed Agent\n3. Enter your name and create your PIN\n\nYou can also add it to your phone home screen for quick access.\n\nReach out if you need help!\n\n[Your Name]"},
  {id:"e4",cat:"Welcome & Onboarding",subject:"First Week Check-In",body:"Hi [Name],\n\nYou have been with us for a week now — how is everything going? I wanted to check in and see how you are feeling about the process.\n\nHave you had a chance to log into the app and start your checklist? If you have any questions or need guidance I am here for you.\n\n[Your Name]"},
  // Accountability
  {id:"e5",cat:"Accountability",subject:"We Miss You — Come Back!",body:"Hi [Name],\n\nI noticed you haven't logged into the NextLevel app recently. Life gets busy — I understand! But your goals are still waiting for you.\n\nLog in today, pick up where you left off, and let's get your momentum back. Even 10 minutes makes a difference.\n\n[Your Name]"},
  {id:"e6",cat:"Accountability",subject:"Daily Activity Log Reminder",body:"Hi [Name],\n\nYour daily activity log hasn't been submitted this week. Consistency is everything in this business — even on slow days, logging your activity keeps you accountable and helps me support you better.\n\nLog in to the app and submit today's activity. It only takes 2 minutes!\n\n[Your Name]"},
  {id:"e7",cat:"Accountability",subject:"I've Been Trying to Reach You",body:"Hi [Name],\n\nI have reached out a few times and haven't heard back. I want to make sure you are okay and still committed to your goals.\n\nPlease reply to this email or give me a call when you get a chance. I am not giving up on you — I just want to make sure you have the support you need.\n\n[Your Name]"},
  {id:"e8",cat:"Accountability",subject:"Your Checklist Progress Has Stalled",body:"Hi [Name],\n\nI noticed your checklist progress hasn't moved in a while. I know life can get in the way but I don't want you to lose the ground you've already gained.\n\nLet's schedule some time to talk, figure out what's getting in the way, and make a plan to get you back on track. Reply to this email to set up a time.\n\n[Your Name]"},
  {id:"e9",cat:"Accountability",subject:"No Activity Logged This Week",body:"Hi [Name],\n\nI checked in on your activity this week and didn't see any logs submitted. Activity is the foundation of results — no activity means no pipeline, no appointments, no income.\n\nLet's reconnect and talk about what's going on. I am here to help, not judge. Reply when you can.\n\n[Your Name]"},
  {id:"e10",cat:"Accountability",subject:"Missed Training Appointment",body:"Hi [Name],\n\nI noticed you missed our scheduled training appointment. No worries — let's get it rescheduled.\n\nClick my booking link to find a new time: [Booking Link]\n\nLooking forward to connecting with you!\n\n[Your Name]"},
  // Encouragement
  {id:"e11",cat:"Encouragement",subject:"You Are Making Great Progress!",body:"Hi [Name],\n\nI just checked your checklist and wanted to say — you are doing amazing! Your progress shows real commitment and I am proud of the work you are putting in.\n\nKeep that momentum going. You are closer to your goal than you think!\n\n[Your Name]"},
  {id:"e12",cat:"Encouragement",subject:"Your Exam is Coming Up — You've Got This!",body:"Hi [Name],\n\nYour licensing exam is coming up and I want you to know I believe in you! Here are a few tips:\n\n1. Log into ExamFX daily and complete practice exams\n2. Review the sections you feel least confident about\n3. Get good sleep the night before\n4. You have prepared for this — trust yourself!\n\nYou've got this. Reach out if you need anything.\n\n[Your Name]"},
  {id:"e13",cat:"Encouragement",subject:"Halfway There — Keep Going!",body:"Hi [Name],\n\nYou are halfway through your checklist — that is a big deal! Half the battle is showing up and staying consistent, and you are doing exactly that.\n\nDon't stop now. The finish line is closer than the starting line. Let's keep building!\n\n[Your Name]"},
  {id:"e14",cat:"Encouragement",subject:"Almost Licensed — The Finish Line is Close!",body:"Hi [Name],\n\nYou are so close to getting licensed! This is the moment that separates those who dream from those who do.\n\nStay focused, keep studying, and remember why you started. Once you are licensed the real opportunity opens up.\n\nI am cheering for you every step of the way!\n\n[Your Name]"},
  {id:"e15",cat:"Encouragement",subject:"We Miss You — Your Comeback Starts Today",body:"Hi [Name],\n\nLife happens to all of us. Whatever has been going on I hope you are okay.\n\nWhenever you are ready to get back on track I am here. Your spot on the team is still yours and your goals are still achievable. No judgment — just support.\n\nReply when you are ready and we will pick up right where we left off.\n\n[Your Name]"},
  // Scheduling
  {id:"e16",cat:"Scheduling",subject:"Let's Schedule Your Training Appointment",body:"Hi [Name],\n\nI would love to schedule some one-on-one training time with you. Click the link below to find a time that works for your schedule:\n\n[Booking Link]\n\nCome prepared with your checklist open and any questions you have. Looking forward to it!\n\n[Your Name]"},
  {id:"e17",cat:"Scheduling",subject:"DGO Date Reminder",body:"Hi [Name],\n\nHave you set your Digital Grand Opening (DGO) date yet? Your DGO is one of the most important steps in launching your business.\n\nLog into the app → Milestones tab → and set your DGO date today. Once it's set we can start planning and promoting!\n\n[Your Name]"},
  {id:"e18",cat:"Scheduling",subject:"Upcoming Team Meeting — You're Invited",body:"Hi [Name],\n\nWe have an upcoming team meeting and I would love for you to be there!\n\nDate: [Date]\nTime: [Time]\nLocation/Zoom: [Link]\n\nThese meetings are where the real learning happens. Come ready to take notes and connect with the team!\n\n[Your Name]"},
  {id:"e19",cat:"Scheduling",subject:"One-on-One with Your RVP",body:"Hi [Name],\n\nI would love to connect with you one-on-one to talk about your goals, your progress, and how I can best support you.\n\nClick here to schedule a time: [Booking Link]\n\nThis is your time — bring your questions and let's make a plan!\n\n[Your Name]"},
  // Recognition
  {id:"e20",cat:"Recognition",subject:"Congratulations — You're Licensed!",body:"Hi [Name],\n\nCONGRATULATIONS! You passed your licensing exam and are now an official licensed agent!\n\nThis is just the beginning. The real work — and the real rewards — start now. I am so proud of you and excited to watch you build your business.\n\nWelcome to the next chapter!\n\n[Your Name]"},
  {id:"e21",cat:"Recognition",subject:"Congratulations on Your First Life App!",body:"Hi [Name],\n\nYou wrote your first life app — this is a HUGE milestone! You just protected a family and earned your first commission. That is something to be proud of.\n\nThis is just the first of many. Keep going — the momentum is everything now!\n\n[Your Name]"},
  {id:"e22",cat:"Recognition",subject:"Top Recruiter — Amazing Work!",body:"Hi [Name],\n\nI wanted to personally recognize you for your incredible recruiting effort. Bringing new people into this business and giving them an opportunity is one of the most impactful things you can do.\n\nYou are building a team and a legacy. Keep it up!\n\n[Your Name]"},
  {id:"e23",cat:"Recognition",subject:"Congratulations on Your Comma Check!",body:"Hi [Name],\n\nCOMMMA CHECK! You received a $1,000+ check this period and that is something to celebrate!\n\nThis is proof that the work you are putting in is paying off — literally. Keep building, keep protecting families, and the checks will keep coming.\n\nSo proud of you!\n\n[Your Name]"},
  {id:"e24",cat:"Recognition",subject:"Income Milestone Achievement!",body:"Hi [Name],\n\nYou have reached an incredible income milestone and I could not be more proud!\n\nThis did not happen by accident — it happened because of your consistency, your commitment, and your belief in what you are building. You are an inspiration to this entire team.\n\nCelebrate this moment. You earned it!\n\n[Your Name]"},
  // Business Building
  {id:"e25",cat:"Business Building",subject:"Follow Up on Your Prospects",body:"Hi [Name],\n\nHave you followed up with the prospects on your list recently? The fortune is in the follow-up!\n\nLog into the app → Prospects tab to review your list. Reach out to at least 3 people today. A simple check-in can turn into an appointment.\n\n[Your Name]"},
  {id:"e26",cat:"Business Building",subject:"Pipeline Check-In",body:"Hi [Name],\n\nI wanted to check in on your pipeline. How are your leads progressing? Are there any appointments you need help preparing for?\n\nLog into your pipeline in the app and update your lead statuses. Let me know if you need any support!\n\n[Your Name]"},
  {id:"e27",cat:"Business Building",subject:"Share Your Lead Link",body:"Hi [Name],\n\nAre you sharing your personal lead link? Every time someone completes a financial needs analysis through your link it comes directly to you as a lead.\n\nLog into the app → My Lead Link to find and share your personal link. Post it on social media, text it to people, add it to your email signature!\n\n[Your Name]"},
  {id:"e28",cat:"Business Building",subject:"Investment Conversation Starter",body:"Hi [Name],\n\nDon't forget — your clients need more than just life insurance. Many of them are looking for ways to save and invest for the future.\n\nAsk every client about their investment goals. A simple question can open the door to a PAC or lump sum conversation. Let me know if you need help with the script!\n\n[Your Name]"},
  {id:"e29",cat:"Business Building",subject:"Ask for Referrals",body:"Hi [Name],\n\nOne of the fastest ways to grow your business is through referrals. Every client you serve knows at least 3 people who could benefit from what you offer.\n\nAfter every appointment ask: 'Who do you know that could also benefit from protecting their family?' It is that simple.\n\nLet me know how it goes!\n\n[Your Name]"},
  // Team Communication
  {id:"e30",cat:"Team Communication",subject:"Team Announcement",body:"Hi Team,\n\n[Your announcement here]\n\nPlease reach out if you have any questions.\n\n[Your Name]"},
  {id:"e31",cat:"Team Communication",subject:"Important Update",body:"Hi Team,\n\nI wanted to share an important update with everyone:\n\n[Update details here]\n\nPlease read carefully and reach out if you have any questions.\n\n[Your Name]"},
  {id:"e32",cat:"Team Communication",subject:"Reminder — Upcoming Event",body:"Hi [Name],\n\nJust a reminder about our upcoming event:\n\nDate: [Date]\nTime: [Time]\nLocation/Zoom: [Link]\n\nMake sure this is on your calendar. These events are where the magic happens!\n\n[Your Name]"},
  {id:"e33",cat:"Team Communication",subject:"Study Group — You're Invited!",body:"Hi [Name],\n\nWe are hosting a study group for everyone working toward their license. This is a great opportunity to review material, ask questions, and connect with others on the same journey.\n\nDate: [Date]\nTime: [Time]\nZoom Link: [Link]\n\nHope to see you there!\n\n[Your Name]"},
];


// ── EMAIL TEMPLATES PAGE ──
const EMAIL_CATS = ["Welcome & Onboarding","Accountability","Encouragement","Scheduling","Recognition","Business Building","Team Communication"];

function EmailTemplatesPage({data,onUpdate,userRole,reps,trainers,admins}) {
  const isAdmin = userRole==="admin"||userRole==="superadmin";
  const templates = data.emailTemplates||DEFAULT_EMAIL_TEMPLATES;
  const [filter,setFilter] = useState("All");
  const [editing,setEditing] = useState(null);
  const [draft,setDraft] = useState({cat:"",subject:"",body:""});
  const [showAdd,setShowAdd] = useState(false);
  const [newTpl,setNewTpl] = useState({cat:"Welcome & Onboarding",subject:"",body:""});
  const [copied,setCopied] = useState(null);
  const [showEmailAll,setShowEmailAll] = useState(false);

  const copy = (id,text) => {navigator.clipboard.writeText(text);setCopied(id);setTimeout(()=>setCopied(null),2000);};
  const del = (id) => {if(window.confirm("Delete this template?"))onUpdate({...data,emailTemplates:templates.filter(t=>t.id!==id)});};
  const save = () => {
    if(!draft.subject||!draft.body) return;
    onUpdate({...data,emailTemplates:templates.map(t=>t.id===editing?{...t,...draft}:t)});
    setEditing(null);
  };
  const add = () => {
    if(!newTpl.subject||!newTpl.body) return;
    onUpdate({...data,emailTemplates:[...templates,{...newTpl,id:"e_"+Date.now()}]});
    setNewTpl({cat:"Welcome & Onboarding",subject:"",body:""});
    setShowAdd(false);
  };
  const reset = () => {if(window.confirm("Reset all email templates to defaults?"))onUpdate({...data,emailTemplates:DEFAULT_EMAIL_TEMPLATES});};

  const cats = ["All",...EMAIL_CATS.filter(c=>templates.some(t=>t.cat===c))];
  const filtered = filter==="All"?templates:templates.filter(t=>t.cat===filter);

  // Email all helpers
  const allEmails = (reps||[]).filter(r=>r.email&&!r.inactive).map(r=>r.email).join(",");
  const trackEmails = (track) => (reps||[]).filter(r=>r.email&&!r.inactive&&r.track===track).map(r=>r.email).join(",");

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
      <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text}}>Email Templates</div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setShowEmailAll(!showEmailAll)} style={{fontSize:13,padding:"5px 10px",borderRadius:7,border:`1px solid ${C.teal}`,background:C.teal+"11",cursor:"pointer",color:C.teal,fontWeight:600}}>Email All</button>
        {isAdmin&&<button onClick={()=>setShowAdd(!showAdd)} style={{fontSize:13,padding:"5px 10px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>+ Add</button>}
        {isAdmin&&<button onClick={reset} style={{fontSize:13,padding:"5px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>Reset</button>}
      </div>
    </div>
    <div style={{fontSize:13,color:C.textMid,marginBottom:12}}>Click Email to open in your email app with the template pre-filled. Edit [Name] and [Your Name] before sending.</div>

    {/* Email All section */}
    {showEmailAll&&<Card style={{marginBottom:14,border:`1px solid ${C.teal}44`}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:10}}>Email All</div>
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {allEmails&&<a href={"mailto:"+allEmails} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,background:C.teal+"11",border:`1px solid ${C.teal}33`,textDecoration:"none"}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
          <span style={{fontSize:13,color:C.teal,fontWeight:600}}>Email All Active Reps ({(reps||[]).filter(r=>r.email&&!r.inactive).length})</span>
        </a>}
        {trackEmails("fast")&&<a href={"mailto:"+trackEmails("fast")} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,background:C.navy+"11",border:`1px solid ${C.navy}33`,textDecoration:"none"}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
          <span style={{fontSize:13,color:C.navy,fontWeight:600}}>Email Fast Start Reps ({(reps||[]).filter(r=>r.email&&!r.inactive&&r.track==="fast").length})</span>
        </a>}
        {trackEmails("regular")&&<a href={"mailto:"+trackEmails("regular")} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,background:C.gold+"11",border:`1px solid ${C.gold}33`,textDecoration:"none"}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
          <span style={{fontSize:13,color:C.gold,fontWeight:600}}>Email Regular Start Reps ({(reps||[]).filter(r=>r.email&&!r.inactive&&r.track==="regular").length})</span>
        </a>}
        {trackEmails("licensed")&&<a href={"mailto:"+trackEmails("licensed")} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,background:C.success+"11",border:`1px solid ${C.success}33`,textDecoration:"none"}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
          <span style={{fontSize:13,color:C.success,fontWeight:600}}>Email Licensed Now What ({(reps||[]).filter(r=>r.email&&!r.inactive&&r.track==="licensed").length})</span>
        </a>}
        {!allEmails&&<div style={{fontSize:13,color:C.textLight,textAlign:"center",padding:8}}>No rep emails on file. Add emails to rep profiles to use this feature.</div>}
      </div>
    </Card>}

    {/* Add new template */}
    {showAdd&&<Card style={{marginBottom:14,border:`1px solid ${C.teal}44`}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:10}}>New Email Template</div>
      <select value={newTpl.cat} onChange={e=>setNewTpl({...newTpl,cat:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,marginBottom:7}}>
        {EMAIL_CATS.map(c=><option key={c}>{c}</option>)}
      </select>
      <input placeholder="Subject line" value={newTpl.subject} onChange={e=>setNewTpl({...newTpl,subject:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
      <textarea placeholder="Email body... Use [Name] for recipient name and [Your Name] for your name" value={newTpl.body} onChange={e=>setNewTpl({...newTpl,body:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,resize:"vertical",minHeight:120,boxSizing:"border-box",lineHeight:1.6,marginBottom:7}}/>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>setShowAdd(false)} style={{flex:1,padding:"7px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
        <button onClick={add} style={{flex:2,padding:"7px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Save Template</button>
      </div>
    </Card>}

    {/* Category filters */}
    <div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:12,paddingBottom:2}}>
      {cats.map(c=><button key={c} onClick={()=>setFilter(c)} style={{padding:"5px 10px",borderRadius:7,border:"none",cursor:"pointer",whiteSpace:"nowrap",fontSize:13,fontWeight:filter===c?600:400,background:filter===c?C.teal:C.surface,color:filter===c?"white":C.textMid}}>{c}</button>)}
    </div>

    {/* Templates */}
    {EMAIL_CATS.filter(cat=>filtered.some(t=>t.cat===cat)).map(cat=><div key={cat}>
      <SecHead title={cat}/>
      {filtered.filter(t=>t.cat===cat).map(t=><Card key={t.id} style={{marginBottom:8}}>
        {editing===t.id?(
          <div>
            <select value={draft.cat} onChange={e=>setDraft({...draft,cat:e.target.value})} style={{width:"100%",padding:"6px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,marginBottom:6}}>
              {EMAIL_CATS.map(c=><option key={c}>{c}</option>)}
            </select>
            <input value={draft.subject} onChange={e=>setDraft({...draft,subject:e.target.value})} style={{width:"100%",padding:"6px 9px",borderRadius:7,border:`1px solid ${C.teal}`,fontSize:13,color:C.text,marginBottom:6,boxSizing:"border-box",fontWeight:600}}/>
            <textarea value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.teal}`,fontSize:13,color:C.text,resize:"vertical",minHeight:120,boxSizing:"border-box",lineHeight:1.6,marginBottom:6}}/>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setEditing(null)} style={{flex:1,padding:"6px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
              <button onClick={save} style={{flex:2,padding:"6px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Save</button>
            </div>
          </div>
        ):(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{fontSize:dv(16,18),fontWeight:800,color:C.text,flex:1,paddingRight:8}}>{t.subject}</div>
              {isAdmin&&<div style={{display:"flex",gap:4,flexShrink:0}}>
                <button onClick={()=>{setEditing(t.id);setDraft({cat:t.cat,subject:t.subject,body:t.body});}} style={{fontSize:12,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>Edit</button>
                <button onClick={()=>del(t.id)} style={{fontSize:12,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.danger}33`,background:C.danger+"11",cursor:"pointer",color:C.danger}}>Del</button>
              </div>}
            </div>
            <div style={{background:C.surface,borderRadius:9,padding:"12px 14px",fontSize:dv(15,17),fontWeight:600,color:C.text,lineHeight:1.7,whiteSpace:"pre-wrap",marginBottom:10}}>{t.body}</div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>copy(t.id+"_body",t.body)} style={{flex:1,padding:"6px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:13,color:C.textMid,fontWeight:500}}>{copied===t.id+"_body"?"✓ Copied!":"Copy Body"}</button>
              <a href={"mailto:?subject="+encodeURIComponent(t.subject)+"&body="+encodeURIComponent(t.body)} style={{flex:1,padding:"6px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,textDecoration:"none",textAlign:"center",display:"block"}}>✉ Email</a>
            </div>
          </div>
        )}
      </Card>)}
    </div>)}
  </div>;
}

// ── ADVANCEMENT & PROMOTIONS LIBRARY ──
const ADVANCEMENT_CATEGORIES = ["RVP Path","Promotions","Licensing","Income Milestones","Recognition","Other"];

function AdvancementLibrary({data,onUpdate,userRole}) {
  const resources=data.advancementResources||[];
  const isAdmin=userRole==="admin"||userRole==="superadmin";
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({title:"",url:"",description:"",category:"Promotions"});
  const [editing,setEditing]=useState(null);
  const [filter,setFilter]=useState("All");

  const save=()=>{
    if(!form.title||!form.url) return;
    if(editing!==null){
      onUpdate({...data,advancementResources:resources.map((r,i)=>i===editing?{...form}:r)});
      setEditing(null);
    } else {
      onUpdate({...data,advancementResources:[...resources,{...form,id:Date.now()}]});
    }
    setForm({title:"",url:"",description:"",category:"Promotions"});
    setShowForm(false);
  };

  const del=(i)=>onUpdate({...data,advancementResources:resources.filter((_,idx)=>idx!==i)});
  const cats=["All",...ADVANCEMENT_CATEGORIES.filter(c=>resources.some(r=>r.category===c))];
  const filtered=filter==="All"?resources:resources.filter(r=>r.category===filter);
  const catColors={"RVP Path":C.gold,"Promotions":C.purple,"Licensing":C.teal,"Income Milestones":C.success,"Recognition":C.warning,"Other":C.textMid};

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div>
        <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text}}>Advancement & Promotions</div>
        <div style={{fontSize:13,color:C.textMid,marginTop:2}}>Promotion guidelines, income milestones, and advancement resources</div>
      </div>
      {isAdmin&&<button onClick={()=>{setShowForm(!showForm);setEditing(null);setForm({title:"",url:"",description:"",category:"Promotions"});}} style={{fontSize:13,padding:"5px 10px",borderRadius:7,border:"none",background:C.purple,color:"white",cursor:"pointer",fontWeight:600}}>+ Add Link</button>}
    </div>
    {showForm&&<Card style={{marginBottom:14,border:`1px solid ${C.purple}44`}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:10}}>{editing!==null?"Edit":"New"} Advancement Link</div>
      <input placeholder="Title (e.g. RVP Promotion Requirements)" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
      <input placeholder="URL (https://...)" value={form.url} onChange={e=>setForm({...form,url:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
      <input placeholder="Description (optional)" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
      <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,marginBottom:10}}>
        {ADVANCEMENT_CATEGORIES.map(c=><option key={c}>{c}</option>)}
      </select>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>{setShowForm(false);setEditing(null);}} style={{flex:1,padding:"7px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
        <button onClick={save} style={{flex:2,padding:"7px",borderRadius:7,border:"none",background:C.purple,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Save Link</button>
      </div>
    </Card>}
    {resources.length===0&&<div style={{textAlign:"center",padding:"32px 0",color:C.textLight}}>{isAdmin?"No advancement resources yet — add your first link above":"No advancement resources added yet — check back soon!"}</div>}
    {resources.length>0&&<div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:12,paddingBottom:2}}>
      {cats.map(c=><button key={c} onClick={()=>setFilter(c)} style={{padding:"5px 10px",borderRadius:7,border:"none",cursor:"pointer",whiteSpace:"nowrap",fontSize:13,fontWeight:filter===c?600:400,background:filter===c?C.purple:C.surface,color:filter===c?"white":C.textMid}}>{c}</button>)}
    </div>}
    {ADVANCEMENT_CATEGORIES.filter(cat=>filtered.some(r=>r.category===cat)).map(cat=><div key={cat}>
      <SecHead title={cat}/>
      {filtered.filter(r=>r.category===cat).map((r,i)=>{
        const realIdx=resources.indexOf(r);
        return <div key={i} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:"10px 12px",marginBottom:6,background:"white",display:"flex",gap:10,alignItems:"flex-start"}}>
          <div style={{width:32,height:32,borderRadius:8,background:(catColors[r.category]||C.purple)+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={catColors[r.category]||C.purple} strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:2}}>{r.title}</div>
            {r.description&&<div style={{fontSize:13,color:C.textMid,marginBottom:4}}>{r.description}</div>}
            <a href={r.url} target="_blank" rel="noreferrer" style={{fontSize:13,color:C.purple,textDecoration:"none",fontWeight:600}}>Open Link →</a>
          </div>
          {isAdmin&&<div style={{display:"flex",gap:4,flexShrink:0}}>
            <button onClick={()=>{setForm(r);setEditing(realIdx);setShowForm(true);}} style={{fontSize:12,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>Edit</button>
            <button onClick={()=>del(realIdx)} style={{fontSize:12,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.danger}33`,background:C.danger+"11",cursor:"pointer",color:C.danger}}>Del</button>
          </div>}
        </div>;
      })}
    </div>)}
  </div>;
}

// ── REFERENCES EDITOR (race-condition-proof: local state is the only source of truth while editing) ──
function RefsEditor({rep,data,onUpdate}) {
  // Initialize local state ONCE from the rep prop at mount. After this, local state
  // is the single source of truth for what's displayed — we never read back from
  // rep/data while the user is actively editing, which is what caused the scrambling.
  const [localRefs,setLocalRefs]=useState(()=>Array.from({length:5},(_,j)=>({...((rep.references||[])[j]||{})})));
  const initializedForRepId=useRef(rep.id);

  // Only re-initialize if we've switched to looking at a DIFFERENT rep entirely
  // (e.g. admin closes one rep's profile and opens another). Never resync on data changes.
  useEffect(()=>{
    if(initializedForRepId.current!==rep.id){
      setLocalRefs(Array.from({length:5},(_,j)=>({...((rep.references||[])[j]||{})})));
      initializedForRepId.current=rep.id;
    }
  },[rep.id]);

  const fmtRefPhone=v=>{const d=v.replace(/\D/g,"").slice(0,10);if(d.length>=7)return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;if(d.length>=4)return `${d.slice(0,3)}-${d.slice(3)}`;return d;};

  const updateField=(i,f,val)=>{
    setLocalRefs(prev=>{
      const newRefs=prev.map((r,j)=>{
        if(j!==i) return r;
        const updated={...r,[f]:f==="phone"?fmtRefPhone(val):val};
        if(f==="name"&&val.trim()&&!r.addedAt) updated.addedAt=Date.now();
        return updated;
      });
      // Save in the background using the LOCAL state as the base — never the stale rep prop
      onUpdate(rep.id,{...rep,references:newRefs});
      return newRefs;
    });
  };

  return <div>
    <div style={{background:C.teal+"0d",border:`1px solid ${C.teal}33`,borderRadius:9,padding:"9px 12px",fontSize:13,color:C.text,lineHeight:1.5,marginBottom:10}}>The reference you provide will be called to get information on your character, and asked whether they'd be willing to help you with your first few training appointments. For the best training experience, consider references who are married, between the ages of 25-55, have children, own a home, and have steady income — these tend to make for the strongest practice appointments.</div>
    {localRefs.map((r,i)=>{const status=r.status||{};const completedCount=REF_STAGES.filter(s=>status[s.k]).length;return <div key={i} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:10,marginBottom:6}}>
    <div style={{fontSize:12,fontWeight:700,color:C.textLight,marginBottom:5}}>Reference #{i+1}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
      {[["name","Name"],["phone","Phone"],["relationship","Relationship"]].map(([f,ph])=><input key={f} placeholder={ph} value={r[f]||""} onChange={e=>updateField(i,f,e.target.value)} style={{padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:"white",gridColumn:f==="relationship"?"span 2":"auto"}}/>)}
    </div>
    {r.name&&completedCount>0&&<div style={{borderTop:`1px solid ${C.border}`,paddingTop:7,marginTop:8,display:"flex",flexDirection:"column",gap:4}}>
      {REF_STAGES.map(s=><div key={s.k} style={{display:"flex",alignItems:"center",gap:6}}>
        <div style={{width:14,height:14,borderRadius:7,background:status[s.k]?C.success:C.border,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{status[s.k]&&<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}</div>
        <span style={{fontSize:13,color:status[s.k]?C.success:C.textLight,fontWeight:status[s.k]?600:400}}>{s.l}</span>
      </div>)}
    </div>}
  </div>;})}</div>;
}

function RepView({rep,data,onUpdate,onUpdateData,readOnly,isOwnView=false,onOpenCommitment}) {
  const [tab,setTab]=useState("checklist");
  const [showCelebration,setShowCelebration]=useState(false);

  // Phone back button — go back to checklist tab if on another tab
  useEffect(()=>{
    const handler=()=>{
      try {
        window.history.pushState({appNav:true},'',window.location.href);
        if(tab&&tab!=="checklist"){setTab("checklist");}
      } catch(e){}
    };
    window.addEventListener('popstate',handler);
    return()=>window.removeEventListener('popstate',handler);
  },[tab]);
  const track=TRACK_INFO[rep.track];
  const cl=TRACK_TO_CHECKLIST_KEY[rep.track]?getChecklistItems(data,TRACK_TO_CHECKLIST_KEY[rep.track]):[];
  const checked=rep.checked||{};
  const done=cl.filter(i=>checked[i.id]).length;
  const pct=cl.length>0?Math.round((done/cl.length)*100):0;
  const cats=cl.reduce((a,i)=>{if(!a[i.cat])a[i.cat]=[];a[i.cat].push(i);return a;},{});
  const trainer=[...(data.trainers||[]),...(data.admins||[])].find(t=>t.id===rep.trainerId);
  const bookingLink=trainer?.bookingLink||"https://calendly.com/jacquelinejones81/trainingappointment";
  const myRecruits=(data.reps||[]).filter(r=>r.recruitedBy===rep.id&&!r.excludeFromRecruitCount);
  const tabs=[
    {k:"checklist",l:"Checklist"},
    {k:"refs",l:"Refs"},
    {k:"milestones",l:"Milestones"},
    ...(rep.track==="licensed"?[{k:"production",l:"Production"},{k:"myactivity",l:"My Activity Report"}]:rep.fieldTrainerGranted?[{k:"production",l:"Production"}]:[]),
    {k:"appointments",l:"Appts ("+((rep.appointments||[]).length)+")"},
    {k:"scorecard",l:"Scorecard"},
    {k:"leadlink",l:"My Lead Link"},
    {k:"scripts",l:"Scripts"},
    {k:"objectiontraining",l:"Objection Training"},
    {k:"prospecting",l:"Prospecting Training"},
    {k:"planner",l:"Daily Planner"},
    {k:"prospects",l:"Prospects"},
    {k:"recruits",l:"Recruits ("+myRecruits.length+")"},
    ...(rep.track==="licensed"?[{k:"career",l:"Career Path"},{k:"pipeline",l:"My Pipeline"}]:[]),
    {k:"resources",l:"Resources"},{k:"advancement",l:"Advancement"},
    {k:"fame",l:"Wall of Fame"},
    {k:"schedule",l:"Schedule"},
  ];
  const [celebrationPct,setCelebrationPct]=useState(100);
  const [showAutoHomePopup,setShowAutoHomePopup]=useState(false);
  const [showProspectingReminder,setShowProspectingReminder]=useState(false);
  useEffect(()=>{
    if(!isOwnView) return;
    const weekKey=getWeekStart();
    if(rep.prospectingReminderDismissedWeek===weekKey) return;
    const seed=(rep.id||"")+weekKey;
    const seededRandom=s=>{let h=0;for(let i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))|0;}return Math.abs(h%10000)/10000;};
    const dayOffset=Math.floor(seededRandom(seed)*7);
    const hourOffset=8+Math.floor(seededRandom(seed+"h")*9); // sometime between 8am-5pm
    const revealDate=new Date(weekKey+"T00:00:00");
    revealDate.setDate(revealDate.getDate()+dayOffset);
    revealDate.setHours(hourOffset,0,0,0);
    if(Date.now()>=revealDate.getTime()) setShowProspectingReminder(true);
  },[isOwnView,rep.id]);
  const dismissProspectingReminder=()=>{
    onUpdate(rep.id,{...rep,prospectingReminderDismissedWeek:getWeekStart()});
    setShowProspectingReminder(false);
  };
  const goPracticeProspecting=()=>{
    dismissProspectingReminder();
    setTab("prospecting");
  };
  const goPracticeObjections=()=>{
    dismissProspectingReminder();
    setTab("objectiontraining");
  };
  const tog=(id)=>{
    if(!readOnly){
      const newChecked={...checked,[id]:!checked[id]};
      const newDone=cl.filter(i=>newChecked[i.id]).length;
      const newPct=cl.length>0?Math.round((newDone/cl.length)*100):0;
      const milestones=[25,50,75,100];
      const shownMilestones=rep.milestonesShown||[];
      const hitMilestone=milestones.find(m=>newPct>=m&&pct<m&&!shownMilestones.includes(m));
      // Show auto/home insurance popup the first time this specific item is checked
      if((id==="f6b"||id==="r6b")&&newChecked[id]&&!checked[id]){
        setShowAutoHomePopup(true);
      }
      if(hitMilestone){
        setCelebrationPct(hitMilestone);
        setShowCelebration(true);
        onUpdate(rep.id,{...rep,checked:newChecked,milestonesShown:[...shownMilestones,hitMilestone],...(hitMilestone===100?{celebrationShown:true}:{})});
      } else {
        onUpdate(rep.id,{...rep,checked:newChecked});
      }
    }
  };
  const [mobileOpen,setMobileOpen]=useState(false);
  const [rewatchVideo,setRewatchVideo]=useState(null);
  const [showOrientationVideo,setShowOrientationVideo]=useState(false);
  const [showLicensedRewatch,setShowLicensedRewatch]=useState(false);
  const [repWinWidth,setRepWinWidth]=useState(typeof window!=="undefined"?window.innerWidth:768);
  useEffect(()=>{const h=()=>setRepWinWidth(window.innerWidth);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);
  const isDesktop=repWinWidth>=768;
  const tabIcons={
    checklist:"M9 11L12 14L22 4M21 12V19C21 19.5 20.8 20 20.4 20.4C20 20.8 19.5 21 19 21H5C4.5 21 4 20.8 3.6 20.4C3.2 20 3 19.5 3 19V5C3 4.5 3.2 4 3.6 3.6C4 3.2 4.5 3 5 3H16",
    milestones:"M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z",
    career:"M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999",
    pipeline:"M9 17H7C5.9 17 5 16.1 5 15V5C5 3.9 5.9 3 7 3H17C18.1 3 19 3.9 19 5V15C19 16.1 18.1 17 17 17H15M9 17L12 21L15 17M9 17H15",
    prospects:"M17 21V19C17 17.9 16.1 17 15 17H9C7.9 17 7 17.9 7 19V21M12 11C9.8 11 8 9.2 8 7C8 4.8 9.8 3 12 3C14.2 3 16 4.8 16 7C16 9.2 14.2 11 12 11Z",
    appointments:"M19 4H5C3.9 4 3 4.9 3 6V20C3 21.1 3.9 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM16 2V6M8 2V6M3 10H21",
    scorecard:"M9 19V6L21 3V16M9 19C9 20.1 8.1 21 7 21C5.9 21 5 20.1 5 19C5 17.9 5.9 17 7 17C8.1 17 9 17.9 9 19Z",
    recruits:"M17 21V19C17 17.9 16.1 17 15 17H9C7.9 17 7 17.9 7 19V21M23 21V19C23 17.9 22.1 17 21 17H19M16 3.13C17.7 3.35 19 4.8 19 6.5C19 8.2 17.7 9.65 16 9.87M13 7C13 9.2 11.2 11 9 11C6.8 11 5 9.2 5 7C5 4.8 6.8 3 9 3C11.2 3 13 4.8 13 7Z",
    refs:"M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z",
    scripts:"M9 5H7C5.9 5 5 5.9 5 7V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V7C19 5.9 18.1 5 17 5H15M9 5C9 5.6 9.4 6 10 6H14C14.6 6 15 5.6 15 5M9 5C9 4.4 9.4 4 10 4H14C14.6 4 15 4.4 15 5",
    resources:"M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12",
    advancement:"M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z",
    fame:"M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z",
    schedule:"M8 2V5M16 2V5M3.5 9H20.5M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z",
  };

  const RepSidebar = ({onClose}) => <div style={{width:220,background:`linear-gradient(180deg,${C.navy} 0%,${C.navyMid} 100%)`,height:"100%",display:"flex",flexDirection:"column",flexShrink:0}}>
    {/* Header */}
    <div style={{padding:"16px 14px 12px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,borderRadius:9,background:C.teal+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:C.teal}}>{rep.name?.charAt(0)}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:"white",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rep.name}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>{track?.label}</div>
        </div>
        {onClose&&<button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:18,padding:0}}>×</button>}
      </div>
      <div style={{marginTop:10}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Progress</span>
          <span style={{fontSize:12,fontWeight:700,color:C.teal}}>{pct}%</span>
        </div>
        <div style={{height:4,background:"rgba(255,255,255,0.1)",borderRadius:2}}>
          <div style={{height:4,background:C.teal,borderRadius:2,width:pct+"%",transition:"width 0.3s"}}/>
        </div>
      </div>
      {/* Meet with RVP — from rvpBookingLinks in Team Management */}
      {(data.rvpBookingLinks||[]).filter(r=>r.link).length>0&&<div style={{marginTop:10,display:"flex",flexDirection:"column",gap:5}}>
        {(data.rvpBookingLinks||[]).filter(r=>r.link).map((rvp,i)=><a key={i} href={rvp.link} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"6px 8px",borderRadius:6,background:"rgba(251,191,36,0.12)",border:"1px solid rgba(251,191,36,0.4)",textDecoration:"none"}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2"><path d="M8 2V5M16 2V5M3.5 9H20.5M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z"/></svg>
          <span style={{fontSize:12,color:"#fbbf24",fontWeight:600}}>Meet with RVP — {rvp.name}</span>
        </a>)}
      </div>}
      {/* Rewatch milestone videos — only for granted access levels */}
      {(((rep.track==="fast"||rep.track==="regular"||!rep.track)&&data.welcomeVideoUrl)||(rep.nextLevelGranted&&data.licensedVideoUrl)||(rep.fieldTrainerGranted&&data.fieldTrainerVideoUrl)||(rep.rvpPathGranted&&data.rvpPathVideoUrl))&&<div style={{marginTop:6,display:"flex",flexDirection:"column",gap:4}}>
        {(rep.track==="fast"||rep.track==="regular"||!rep.track)&&data.welcomeVideoUrl&&<button onClick={()=>setRewatchVideo({url:data.welcomeVideoUrl,title:"Welcome!"})} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"5px 8px",borderRadius:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer"}}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.6)",fontWeight:500}}>Rewatch: Welcome Video</span>
        </button>}
        {rep.nextLevelGranted&&data.licensedVideoUrl&&<button onClick={()=>setRewatchVideo({url:data.licensedVideoUrl,title:"Licensed — Now What?"})} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"5px 8px",borderRadius:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer"}}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.6)",fontWeight:500}}>Rewatch: Licensed Now What</span>
        </button>}
        {rep.fieldTrainerGranted&&data.fieldTrainerVideoUrl&&<button onClick={()=>setRewatchVideo({url:data.fieldTrainerVideoUrl,title:"Welcome, Field Trainer!"})} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"5px 8px",borderRadius:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer"}}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.6)",fontWeight:500}}>Rewatch: Field Trainer</span>
        </button>}
        {rep.rvpPathGranted&&data.rvpPathVideoUrl&&<button onClick={()=>setRewatchVideo({url:data.rvpPathVideoUrl,title:"Welcome to the RVP Path!"})} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"5px 8px",borderRadius:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer"}}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.6)",fontWeight:500}}>Rewatch: RVP Path</span>
        </button>}
      </div>}
    </div>
    {/* Nav items */}
    <div style={{flex:1,overflowY:"auto",padding:"8px 8px"}}>
      {tabs.map(t=><button key={t.k} onClick={()=>{setTab(t.k);if(onClose)onClose();}} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"9px 10px",background:tab===t.k?"rgba(14,165,160,0.18)":"transparent",border:"none",borderRadius:8,cursor:"pointer",marginBottom:2,textAlign:"left"}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tab===t.k?C.teal:"rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={tabIcons[t.k]||tabIcons.resources}/>
        </svg>
        <span style={{fontSize:13,color:tab===t.k?C.teal:"rgba(255,255,255,0.7)",fontWeight:tab===t.k?600:400}}>{t.l}</span>
      </button>)}
    </div>
    {/* Footer */}
    <div style={{padding:"10px 12px",borderTop:"1px solid rgba(255,255,255,0.08)",fontSize:12,color:"rgba(255,255,255,0.3)",textAlign:"center"}}>NextLevel Field Training Hub</div>
  </div>;

  return <div style={{display:"flex",height:"100vh",background:C.surface,overflow:"hidden"}}>
    {/* Desktop sidebar */}
    {isDesktop&&<RepSidebar/>}
    {/* Mobile sidebar overlay */}
    {mobileOpen&&<div style={{position:"fixed",inset:0,zIndex:200,display:"flex"}}>
      <RepSidebar onClose={()=>setMobileOpen(false)}/>
      <div style={{flex:1,background:"rgba(0,0,0,0.5)"}} onClick={()=>setMobileOpen(false)}/>
    </div>}
    {/* Main content */}
    <div style={{flex:1,overflowY:"auto",minWidth:0,padding:"0 0 40px 0"}}>
      {/* Mobile header */}
      {!isDesktop&&<div style={{background:C.navy,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,zIndex:100}}>
        <button onClick={()=>setMobileOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",flexDirection:"column",gap:3}}>
          <div style={{width:18,height:2,background:"white",borderRadius:1}}/>
          <div style={{width:18,height:2,background:"white",borderRadius:1}}/>
          <div style={{width:18,height:2,background:"white",borderRadius:1}}/>
        </button>
        <span style={{fontSize:14,fontWeight:600,color:"white"}}>{tabs.find(t=>t.k===tab)?.l||"Checklist"}</span>
        <div style={{marginLeft:"auto",fontSize:13,fontWeight:700,color:C.teal}}>{pct}%</div>
      </div>}
      <div style={{padding:"14px 16px"}}>
    <div style={{background:`linear-gradient(135deg,${C.navy} 0%,${C.navyMid} 100%)`,borderRadius:12,padding:"14px 18px",marginBottom:14,color:"white"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div><div style={{fontSize:15,fontWeight:700}}>{rep.name}</div><div style={{fontSize:13,color:"rgba(255,255,255,0.55)",marginTop:2}}>{track?.label} - {track?.days}</div></div>
        <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:700,color:C.teal}}>{pct}%</div><div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>COMPLETE</div></div>
      </div>
      <Bar pct={pct} h={5}/>
      {pct===100&&<div style={{marginTop:8,background:C.success+"22",border:`1px solid ${C.success}44`,borderRadius:8,padding:"6px 10px",fontSize:13,color:C.success,textAlign:"center",fontWeight:600}}>All tasks complete!</div>}
      {pct===100&&(rep.track==="fast"||rep.track==="regular")&&!rep.nextLevelRequested&&!rep.nextLevelGranted&&(
        <button onClick={()=>{const lr=(data.reps||[]).find(r=>r.id===rep.id)||rep;onUpdate(rep.id,{...lr,nextLevelRequested:true,nextLevelRequestedAt:new Date().toISOString()});}}
          style={{width:"100%",marginTop:8,padding:"10px",borderRadius:8,background:`linear-gradient(135deg,${C.gold},#f97316)`,border:"none",color:"white",fontWeight:700,fontSize:14,cursor:"pointer"}}>
          Request Access to Licensed Now What
        </button>
      )}
      {rep.nextLevelRequested&&!rep.nextLevelGranted&&(
        <div style={{marginTop:8,background:C.gold+"22",border:`1px solid ${C.gold}44`,borderRadius:8,padding:"8px 12px",fontSize:13,color:C.gold,textAlign:"center"}}>
          Request sent! Waiting for admin approval...
        </div>
      )}
      {!rep.nextLevelRequested&&rep.nextLevelDenied&&!rep.nextLevelGranted&&(pct===100)&&(rep.track==="fast"||rep.track==="regular")&&(
        <div style={{marginTop:8}}>
          <div style={{background:C.danger+"22",border:`1px solid ${C.danger}44`,borderRadius:8,padding:"7px 12px",fontSize:13,color:C.danger,marginBottom:6,textAlign:"center"}}>
            Request was not approved — speak with your trainer for next steps
          </div>
          <button onClick={()=>onUpdate(rep.id,{...rep,nextLevelRequested:true,nextLevelDenied:false,nextLevelRequestedAt:new Date().toISOString()})}
            style={{width:"100%",padding:"9px",borderRadius:8,background:`linear-gradient(135deg,${C.gold},#f97316)`,border:"none",color:"white",fontWeight:700,fontSize:13,cursor:"pointer"}}>
            Request Again
          </button>
        </div>
      )}
      {rep.nextLevelGranted&&rep.track!=="licensed"&&(
        <div style={{marginTop:8,background:C.success+"22",border:`1px solid ${C.success}44`,borderRadius:8,padding:"8px 12px",fontSize:13,color:C.success,textAlign:"center",fontWeight:600}}>
          Access granted! Refresh to see your Licensed Now What checklist.
        </div>
      )}
    </div>
    {/* ── WALL OF FAME BANNER ── */}
    <WallOfFameBanner data={data}/>
    {!readOnly&&rep.track==="licensed"&&<DailyActivityLog rep={rep} data={data} onUpdate={(u)=>{if(onUpdateData)onUpdateData(u);}} isFirstTime={!(data.activityLogs||{})[rep.id]?.seenIntro}/>
    }{(rep.track==="licensed"||rep.fieldTrainerGranted)&&(()=>{
      const pm=getCurrentPrimerMonth(data?.primerMonthEnds||[]);
      const c=rep.commitments?.[pm.key];
      if(c) return <CommitmentCard rep={rep} primerMonth={pm} canUnlock={false} onUnlock={()=>{}} recruitsOverride={countPeriodRecruits(data,rep.id,pm.start)}/>;
      if(!onOpenCommitment) return null;
      return <div style={{marginBottom:12,borderRadius:12,border:`2px solid ${C.gold}`,background:C.gold+"11",padding:"12px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <span style={{fontSize:22}}>📋</span>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:C.gold}}>Set Your {pm.label} Commitment</div>
            <div style={{fontSize:11,color:C.textMid}}>{getDaysRemaining(pm.cutoff)} days remaining in this Primerica month.</div>
          </div>
        </div>
        <button onClick={()=>onOpenCommitment()} style={{width:"100%",padding:"10px",borderRadius:9,background:C.gold,border:"none",color:"white",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          🔒 Set My Monthly Commitment
        </button>
      </div>;
    })()}
    {!readOnly&&rep.track==="licensed"&&<MyLeads repName={rep.name}/>}
    {/* ── YOUR FOCUS BANNER (static reminder, unlicensed reps only) ── */}
    {!readOnly&&rep.track!=="licensed"&&<div style={{borderRadius:14,background:"linear-gradient(135deg,#0f172a 0%,#1e2a4a 50%,#3d2a5c 100%)",padding:"18px 18px 16px",marginBottom:12,position:"relative",overflow:"hidden",boxShadow:"0 8px 24px rgba(15,23,42,0.25)"}}>
      <div style={{position:"absolute",top:-40,right:-40,width:140,height:140,background:"radial-gradient(circle,rgba(212,160,23,0.35),transparent 70%)"}}/>
      <div style={{fontSize:11,fontWeight:800,color:C.gold,textTransform:"uppercase",letterSpacing:"1px",marginBottom:8,display:"flex",alignItems:"center",gap:6,position:"relative"}}>🔥 Your Focus Right Now</div>
      <div style={{fontSize:15,color:"white",lineHeight:1.5,fontWeight:700,marginBottom:14,position:"relative"}}>Get <span style={{color:C.gold}}>Trained</span>. Get <span style={{color:C.gold}}>Licensed</span>. Get <span style={{color:C.gold}}>Promoted</span> to District Leader.</div>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",position:"relative"}}>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:800,color:C.navy,background:"white",padding:"6px 12px",borderRadius:20,boxShadow:"0 2px 6px rgba(0,0,0,0.15)"}}>🎓 Trained</div>
        <span style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontWeight:700}}>&rarr;</span>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:800,color:C.navy,background:"white",padding:"6px 12px",borderRadius:20,boxShadow:"0 2px 6px rgba(0,0,0,0.15)"}}>📋 Licensed</div>
        <span style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontWeight:700}}>&rarr;</span>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:800,color:"white",background:"linear-gradient(135deg,#f0c14b,"+C.gold+")",padding:"6px 12px",borderRadius:20,boxShadow:"0 2px 6px rgba(0,0,0,0.15)"}}>📈 Promoted</div>
      </div>
    </div>}
    {/* ── CAREER JOURNEY STICKY BANNER ── */}
    {!readOnly&&<CareerJourneyBanner rep={rep} onUpdate={onUpdate}/>}

    {showCelebration&&<Confetti name={rep.name} pct={celebrationPct} onClose={()=>setShowCelebration(false)}/>}
    {showProspectingReminder&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:3400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"white",borderRadius:16,maxWidth:380,width:"100%",overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{background:`linear-gradient(135deg,${C.navy},${C.navyMid})`,padding:"26px 24px 20px",textAlign:"center",position:"relative"}}>
          <button onClick={dismissProspectingReminder} style={{position:"absolute",top:12,right:14,background:"none",border:"none",color:"rgba(255,255,255,0.4)",fontSize:18,cursor:"pointer"}}>✕</button>
          <div style={{fontSize:44,marginBottom:10}}>🎯</div>
          <div style={{color:"white",fontSize:19,fontWeight:800,marginBottom:6}}>Time to Sharpen Your Aim!</div>
          <div style={{color:"rgba(255,255,255,0.65)",fontSize:13,lineHeight:1.5}}>A quick weekly nudge to keep your prospecting skills fresh</div>
        </div>
        <div style={{padding:"20px 24px 24px"}}>
          <div style={{fontSize:13,color:C.text,lineHeight:1.6,marginBottom:16,textAlign:"center"}}>Which skill do you want to sharpen this week? Practice out loud — with your trainer, a teammate, or even just in the mirror. The reps who rehearse consistently are the ones who don't freeze up in the moment.</div>
          <button onClick={goPracticeProspecting} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:C.teal,color:"white",fontWeight:700,fontSize:14,marginBottom:8,cursor:"pointer"}}>🎯 Practice Prospecting</button>
          <button onClick={goPracticeObjections} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:C.gold,color:"white",fontWeight:700,fontSize:14,marginBottom:8,cursor:"pointer"}}>💡 Practice Objections</button>
          <button onClick={dismissProspectingReminder} style={{width:"100%",padding:"10px",borderRadius:10,border:"none",background:"none",color:C.textMid,fontSize:13,cursor:"pointer"}}>Maybe Later</button>
        </div>
      </div>
    </div>}
    {rewatchVideo&&<RewatchVideoModal videoUrl={rewatchVideo.url} title={rewatchVideo.title} onClose={()=>setRewatchVideo(null)}/>}
    {showOrientationVideo&&data?.orientationVideoUrl&&<RewatchVideoModal videoUrl={data.orientationVideoUrl} title="Orientation Video" onClose={()=>setShowOrientationVideo(false)}/>}
    {showLicensedRewatch&&data?.licensedVideoUrl&&<RewatchVideoModal videoUrl={data.licensedVideoUrl} title="Licensed Now What Video" onClose={()=>setShowLicensedRewatch(false)}/>}
    {showAutoHomePopup&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:3500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"white",borderRadius:18,padding:"28px 24px",maxWidth:380,width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
        <div style={{fontSize:48,marginBottom:10}}>🚗🏠</div>
        <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:10}}>Get Your Free Quote!</div>
        <div style={{fontSize:14,color:C.textMid,lineHeight:1.6,marginBottom:14}}>Call Answer Financial and get a free auto and home insurance quote on yourself. Even if you don't save money, you'll learn the exact process to use with your future clients!</div>
        <div style={{background:C.teal+"11",border:`1px solid ${C.teal}33`,borderRadius:10,padding:"12px 14px",marginBottom:16}}>
          <div style={{fontSize:13,color:C.textMid,marginBottom:4}}>Call</div>
          <a href="tel:18778558111" style={{fontSize:18,fontWeight:800,color:C.teal,textDecoration:"none"}}>📞 1-877-855-8111</a>
          <div style={{fontSize:13,color:C.textLight,marginTop:8}}>Provide your Rep ID and last name</div>
        </div>
        <div style={{fontSize:13,color:C.gold,fontWeight:600,marginBottom:16}}>💰 Earn commission if you switch to a full coverage plan!</div>
        <button onClick={()=>setShowAutoHomePopup(false)} style={{width:"100%",padding:"12px",borderRadius:10,background:`linear-gradient(135deg,${C.teal},#0891b2)`,border:"none",color:"white",fontSize:14,fontWeight:700,cursor:"pointer"}}>Got it!</button>
      </div>
    </div>}
    {tab==="checklist"&&<div>{rep.track!=="licensed"&&!rep.referencesNotRequired&&rep.createdAt&&(Date.now()-rep.createdAt)>=3*86400000&&(rep.references||[]).filter(r=>r&&r.name&&r.name.trim()).length<5&&isOwnView&&<div style={{background:C.gold+"11",border:`1px solid ${C.gold}44`,borderRadius:10,padding:"11px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <div style={{fontSize:13,color:"#92400e",fontWeight:600}}>📋 Don't forget to add your 5 references — they help us learn more about you and your goals.</div>
      <button onClick={()=>setTab("refs")} style={{fontSize:12,padding:"6px 12px",borderRadius:7,border:"none",background:C.gold,color:"white",cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}>Add References</button>
    </div>}{rep.track==="licensed"&&<GoalBoard data={data} onUpdate={()=>{}} userRole="rep"/>}<RepCounters rep={rep} onUpdate={(u)=>onUpdate(rep.id,u)} readOnly={readOnly}/>{Object.entries(cats).map(([cat,items])=>{const cd=items.filter(i=>checked[i.id]).length;return <div key={cat}><SecHead title={cat} count={[cd,items.length]}/>{items.map(item=><CheckItem key={item.id} item={item} checked={!!checked[item.id]} onToggle={()=>tog(item.id)} readOnly={readOnly} onPopup={(item.id==="f4"||item.id==="r4")&&data?.orientationVideoUrl&&!readOnly?()=>setShowOrientationVideo(true):item.id==="l0"&&data?.licensedVideoUrl&&!readOnly?()=>setShowLicensedRewatch(true):undefined}/>)}</div>;})}</div>}
    {tab==="production"&&(rep.track==="licensed"||rep.fieldTrainerGranted)&&<RepProductionTab rep={rep} data={data} onUpdate={onUpdate} onUpdateData={onUpdateData} readOnly={readOnly}/>}
    {tab==="myactivity"&&rep.track==="licensed"&&onUpdateData&&<MyActivityReport session={{id:rep.id}} data={data} onUpdate={onUpdateData}/>}
    {tab==="myactivity"&&rep.track==="licensed"&&!onUpdateData&&<div style={{fontSize:13,color:C.textLight,textAlign:"center",padding:"30px 0"}}>This report is only viewable from the rep's own login.</div>}
    {tab==="milestones"&&<RepExtras rep={rep} onUpdate={(u)=>onUpdate(rep.id,u)} onUpdateData={onUpdateData||null} readOnly={readOnly} data={data}/>}
    {tab==="leadlink"&&<div>
      <div style={{fontSize:13,color:C.textMid,marginBottom:14}}>Your personal MoneyMap link. Share it with anyone to start a financial conversation.</div>
      <MyLeadLink name={rep.name} data={data} onUpdate={onUpdate} personId={rep.id}/>
      {(data.repShareableLinks||[]).length>0&&<div style={{marginTop:16}}>
        <div style={{background:C.gold+"11",border:`2px solid ${C.gold}`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:800,color:"#92400e",lineHeight:1.5}}>YOUR JOB IS NOT TO EXPLAIN THE OPPORTUNITY.</div>
          <div style={{fontSize:12,color:"#92400e",lineHeight:1.5,marginTop:4}}>Your job is to identify interest, send the appropriate video, and make sure the person completes the form. The video provides the overview. The form identifies their interest. From there, a follow-up conversation — or an interview for recruiting opportunities — determines the fit.</div>
        </div>
        <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:8}}>Your Shareable Video Links</div>
        {(data.repShareableLinks||[]).map(link=><ShareableVideoLinkCard key={link.id} label={link.label||"Shareable Link"} url={buildPersonalShareLink(link.templateUrl,(rep.name||"")+(rep.primericaRepId?` (${rep.primericaRepId})`:""))} data={data} onUpdate={onUpdate} personId={rep.id} sendTo={link.sendTo} messages={link.messages}/>)}
      </div>}
      {(data.teamLinks||[]).length>0&&<div style={{marginTop:16}}>
        <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:8}}>Quick Links</div>
        {(data.teamLinks||[]).map(link=><QuickLinkCard key={link.id} label={link.label} url={link.url} data={data} onUpdate={onUpdate} personId={rep.id}/>)}
      </div>}
    </div>}
    {tab==="appointments"&&<ApptTracker appointments={rep.appointments||[]} onChange={a=>onUpdate(rep.id,{...rep,appointments:a})} readOnly={readOnly} bookingLink={bookingLink} track={rep.track}/>}
    {tab==="refs"&&<RefsEditor rep={rep} data={data} onUpdate={onUpdate}/>}
    {tab==="scripts"&&<RepScriptsView scripts={data.scripts||SCRIPTS}/>}
    {tab==="prospects"&&<ProspectsTab rep={rep} onUpdate={(u)=>onUpdate(rep.id,u)}/>}
    {tab==="pipeline"&&<LeadPipeline rep={rep} data={data} onUpdate={onUpdateData||((u)=>onUpdate(rep.id,u))}/>}
    {tab==="resources"&&<ResourceLibrary data={data} onUpdate={()=>{}} userRole="rep"/>}
    {tab==="advancement"&&<AdvancementLibrary data={data} onUpdate={()=>{}} userRole="rep"/>}
    {tab==="recruits"&&<RecruitsTab rep={rep} data={data} myRecruits={myRecruits} onUpdate={onUpdate}/>}
    {tab==="career"&&<CareerPath rep={rep} data={data} onUpdate={onUpdate}/>}
    {tab==="fame"&&<WallOfFame data={data} onUpdate={()=>{}} userRole="rep"/>}
    {tab==="scorecard"&&<ScorecardPage data={data} onUpdate={onUpdateData||(u=>onUpdate(rep.id,{...rep}))} userId={rep.id} userRole="rep" track={rep.track}/>}
    {tab==="schedule"&&<ScheduleView data={data} onUpdate={(u)=>onUpdate(rep.id,{...rep})} userRole="rep"/>}
    {tab==="objectiontraining"&&<ObjectionTrainingPage data={data} onUpdate={onUpdateData||(() => {})} userRole="rep"/>}
    {tab==="prospecting"&&<ProspectingPage data={data} onUpdate={onUpdateData||(() => {})} userRole="rep"/>}
    {tab==="planner"&&<DailyPlanner session={{id:rep.id,role:"rep"}} db={db}/>}
      </div>
    </div>
  </div>;
}

// ── REP PROFILE (trainer/admin view) ──
// ── ADMIN REFERENCES EDITOR — editable fields + outreach status (race-condition-proof) ──
function AdminRefsEditor({rep,data,onUpdate}) {
  const [localRefs,setLocalRefs]=useState(()=>Array.from({length:5},(_,j)=>({...((rep.references||[])[j]||{})})));
  const initializedForRepId=useRef(rep.id);

  useEffect(()=>{
    if(initializedForRepId.current!==rep.id){
      setLocalRefs(Array.from({length:5},(_,j)=>({...((rep.references||[])[j]||{})})));
      initializedForRepId.current=rep.id;
    }
  },[rep.id]);

  const fmtRefPhone=v=>{const d=v.replace(/\D/g,"").slice(0,10);if(d.length>=7)return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;if(d.length>=4)return `${d.slice(0,3)}-${d.slice(3)}`;return d;};

  const updateField=(i,f,val)=>{
    setLocalRefs(prev=>{
      const newRefs=prev.map((r,j)=>{
        if(j!==i) return r;
        const updated={...r,[f]:f==="phone"?fmtRefPhone(val):val};
        if(f==="name"&&val.trim()&&!r.addedAt) updated.addedAt=Date.now();
        return updated;
      });
      onUpdate(rep.id,{...rep,references:newRefs});
      return newRefs;
    });
  };

  const toggleStatus=(i,stageKey)=>{
    setLocalRefs(prev=>{
      const curStatus=prev[i].status||{};
      const newRefs=prev.map((r,j)=>j===i?{...r,status:{...curStatus,[stageKey]:!curStatus[stageKey]},lastActivityAt:Date.now()}:r);
      onUpdate(rep.id,{...rep,references:newRefs});
      return newRefs;
    });
  };

  const toggleNotRequired=()=>{
    onUpdate(rep.id,{...rep,referencesNotRequired:!rep.referencesNotRequired});
  };

  return <div>
    <div style={{background:C.teal+"0d",border:`1px solid ${C.teal}33`,borderRadius:9,padding:"9px 12px",fontSize:13,color:C.text,lineHeight:1.5,marginBottom:10}}>The reference you provide will be called to get information on your character, and asked whether they'd be willing to help you with your first few training appointments. For the best training experience, consider references who are married, between the ages of 25-55, have children, own a home, and have steady income — these tend to make for the strongest practice appointments.</div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.surface||"#f8fafc",border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 12px",marginBottom:10}}>
      <div>
        <div style={{fontSize:13,fontWeight:600,color:C.text}}>References Not Required</div>
        <div style={{fontSize:11,color:C.textMid,marginTop:1}}>Turn on for established reps — excludes them from the stalled-reference alert</div>
      </div>
      <div onClick={toggleNotRequired} style={{width:38,height:22,borderRadius:12,background:rep.referencesNotRequired?C.teal:"#cbd5e1",position:"relative",cursor:"pointer",flexShrink:0}}>
        <div style={{position:"absolute",top:2,left:rep.referencesNotRequired?18:2,width:18,height:18,borderRadius:9,background:"white",transition:"left 0.15s"}}/>
      </div>
    </div>
    {localRefs.map((r,i)=>{const status=r.status||{};return <div key={i} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:10,marginBottom:6}}>
    <div style={{fontSize:12,fontWeight:700,color:C.textLight,marginBottom:5}}>Reference #{i+1}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:r.name?8:0}}>
      {[["name","Name"],["phone","Phone"],["relationship","Relationship"]].map(([f,ph])=><input key={f} placeholder={ph} value={r[f]||""} onChange={e=>updateField(i,f,e.target.value)} style={{padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:"white",gridColumn:f==="relationship"?"span 2":"auto"}}/>)}
    </div>
    {r.name&&<div style={{borderTop:`1px solid ${C.border}`,paddingTop:8}}>
      <div style={{fontSize:10,fontWeight:700,color:C.textLight,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.5px"}}>Outreach Status</div>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {REF_STAGES.map(s=><label key={s.k} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer"}}>
          <input type="checkbox" checked={!!status[s.k]} onChange={()=>toggleStatus(i,s.k)} style={{width:15,height:15,accentColor:C.teal,cursor:"pointer"}}/>
          <span style={{fontSize:13,color:status[s.k]?C.success:C.textMid,fontWeight:status[s.k]?600:400,textDecoration:status[s.k]?"line-through":"none"}}>{s.l}</span>
        </label>)}
      </div>
    </div>}
  </div>;})}</div>;
}

function RepProfile({rep,data,onUpdate,onUpdateData,onBack,onDelete}) {
  const [tab,setTab]=useState("trainer");
  const [viewAsRep,setViewAsRep]=useState(false);
  const track=TRACK_INFO[rep.track];
  const tc=rep.trainerChecked||{};
  const trDone=getChecklistItems(data,"trainerChecklist").filter(i=>tc[i.id]).length;
  const cl=TRACK_TO_CHECKLIST_KEY[rep.track]?getChecklistItems(data,TRACK_TO_CHECKLIST_KEY[rep.track]):[];
  const repDone=cl.filter(i=>(rep.checked||{})[i.id]).length;
  const [ciNote,setCiNote]=useState("");
  const [editContact,setEditContact]=useState(false);
  const [contactForm,setContactForm]=useState({phone:rep.phone||"",email:rep.email||""});
  const saveContact=()=>{onUpdate(rep.id,{...rep,phone:contactForm.phone,email:contactForm.email});setEditContact(false);};
  const liveRepData=(data.reps||[]).find(r=>r.id===rep.id)||rep;
  const tabs=[{k:"trainer",l:"Trainer"},{k:"rep",l:track?.label||"Rep"},{k:"appointments",l:`Appts (${(rep.appointments||[]).length})`},{k:"refs",l:"Refs"},{k:"milestones",l:"Milestones"},{k:"checkins",l:"Check-ins"},{k:"career",l:"Career Path"},{k:"schedule",l:"Schedule"}];
  const togT=(id)=>{const lr=(data.reps||[]).find(r=>r.id===rep.id)||rep;const tc2=lr.trainerChecked||{};onUpdate(rep.id,{...lr,trainerChecked:{...tc2,[id]:!tc2[id]}});};
  const addCI=()=>{
    if(!ciNote.trim())return;
    const latestRep=(data.reps||[]).find(r=>r.id===rep.id)||rep;
    const updated={...latestRep,checkIns:[...(latestRep.checkIns||[]),{date:new Date().toISOString(),note:ciNote}]};
    try{localStorage.setItem("checkins_"+rep.id,JSON.stringify(updated.checkIns));}catch(e){}
    onUpdate(rep.id,updated);
    setCiNote("");
  };

  if(viewAsRep) return <div>
    <div style={{background:C.gold+"11",border:`1px solid ${C.gold}33`,borderRadius:8,padding:"8px 12px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{fontSize:13,color:C.gold,fontWeight:600}}>Viewing as: {rep.name}</span>
      <button onClick={()=>setViewAsRep(false)} style={{fontSize:13,padding:"4px 10px",borderRadius:6,background:C.gold,color:"white",border:"none",cursor:"pointer",fontWeight:600}}>Exit Preview</button>

    </div>
    <RepView rep={rep} data={data} onUpdate={onUpdate} onUpdateData={null} readOnly={true}/>
  </div>;

  return <div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button onClick={onBack} style={{background:C.surface,border:"none",padding:"6px 10px",borderRadius:8,cursor:"pointer",fontSize:13,color:C.textMid}}>&larr; Back</button>
      <div style={{flex:1}}>
        <div style={{fontSize:15,fontWeight:700,color:C.text}}>{rep.name}</div>
        {!editContact&&<div style={{fontSize:13,color:C.textMid,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
          <PhoneLink phone={rep.phone}/>
          {rep.email&&<a href={"mailto:"+rep.email} style={{fontSize:13,color:C.teal,textDecoration:"none"}}>✉ {rep.email}</a>}
          <Badge color={track?.color||C.teal} small>{track?.label||"No track yet"}</Badge>
          {rep.trackChosenAt&&<span style={{fontSize:12,color:C.textLight}}>Self-selected on {rep.trackChosenAt}</span>}
          {(rep.track==="licensed"||rep.fieldTrainerGranted)&&(()=>{
            const pm=getCurrentPrimerMonth(data?.primerMonthEnds||[]);
            const c=rep.commitments?.[pm.key];
            return c?<span style={{fontSize:12,background:C.gold+"22",color:"#b45309",padding:"2px 7px",borderRadius:5,fontWeight:700}}>{c.tierEmoji} {c.tierLabel} · {pm.label}</span>:<span style={{fontSize:12,color:C.textLight}}>⏳ No commitment set for {pm.label}</span>;
          })()}
          {!rep.track&&<span style={{fontSize:12,color:C.gold,fontWeight:600}}>⏳ Pending path selection</span>}
          <button onClick={()=>{setContactForm({phone:rep.phone||"",email:rep.email||""});setEditContact(true);}} style={{fontSize:12,padding:"1px 6px",borderRadius:4,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>Edit</button>
        </div>}
        {editContact&&<div style={{marginTop:4,display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
          <input placeholder="Phone" value={contactForm.phone} onChange={e=>setContactForm({...contactForm,phone:e.target.value})} style={{width:120,padding:"3px 6px",borderRadius:5,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
          <input placeholder="Email" value={contactForm.email} onChange={e=>setContactForm({...contactForm,email:e.target.value})} style={{width:160,padding:"3px 6px",borderRadius:5,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
          <button onClick={saveContact} style={{padding:"3px 8px",borderRadius:5,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:12,fontWeight:600}}>Save</button>
          <button onClick={()=>setEditContact(false)} style={{padding:"3px 8px",borderRadius:5,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:12,color:C.textMid}}>Cancel</button>
        </div>}
      </div>
      <button onClick={()=>setViewAsRep(true)} style={{fontSize:13,padding:"5px 10px",borderRadius:7,background:C.teal+"11",border:`1px solid ${C.teal}44`,color:C.teal,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>View as Rep</button>
      <ReassignTrainer rep={rep} data={data} onUpdate={onUpdate} />
      <RecruitedByEditor rep={rep} data={data} onUpdate={onUpdate}/>
      <ResetPinButton person={rep} personType="rep" data={data} onUpdate={onUpdate||upd}/>
      <button onClick={()=>{if(window.confirm(`Remove ${rep.name} from the app? This cannot be undone.`))onDelete(rep.id);}} style={{fontSize:13,padding:"5px 10px",borderRadius:7,background:C.danger+"11",border:`1px solid ${C.danger}33`,color:C.danger,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>Remove Rep</button>
    </div>
    {/* Assign RVP/Admin */}
    <div style={{marginBottom:10,padding:"10px 12px",background:C.gold+"08",borderRadius:8,border:`1px solid ${C.gold}33`}}>
      <div style={{fontSize:13,fontWeight:600,color:"#b45309",marginBottom:8}}>Assigned RVP / Admin</div>
      {[{id:"",name:"Not assigned"},...(data.admins||[])].map(a=><button key={a.id||"none"} onClick={()=>onUpdate(rep.id,{...rep,adminId:a.id})} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,border:`1px solid ${rep.adminId===(a.id||"")?"" :C.border}`,background:(rep.adminId===a.id||(a.id===""&&!rep.adminId))?"white":"white",cursor:"pointer",marginBottom:5,textAlign:"left"}}>
        <div style={{width:18,height:18,borderRadius:9,border:`2px solid ${(rep.adminId===a.id||(a.id===""&&!rep.adminId))?C.gold:C.border}`,background:(rep.adminId===a.id||(a.id===""&&!rep.adminId))?C.gold:"white",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {(rep.adminId===a.id||(a.id===""&&!rep.adminId))&&<div style={{width:8,height:8,borderRadius:4,background:"white"}}/>}
        </div>
        <span style={{fontSize:13,color:a.id?C.text:C.textMid,fontWeight:(rep.adminId===a.id||(a.id===""&&!rep.adminId))?700:400}}>{a.name}</span>
      </button>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
      <Card style={{padding:"10px 12px"}}><div style={{fontSize:12,color:C.textMid,marginBottom:3}}>Trainer</div><div style={{fontSize:18,fontWeight:700,color:C.teal}}>{Math.round((trDone/(getChecklistItems(data,"trainerChecklist").length||1))*100)}%</div><Bar pct={(trDone/(getChecklistItems(data,"trainerChecklist").length||1))*100}/><div style={{fontSize:12,color:C.textLight,marginTop:3}}>{trDone}/{getChecklistItems(data,"trainerChecklist").length}</div></Card>
      <Card style={{padding:"10px 12px"}}><div style={{fontSize:12,color:C.textMid,marginBottom:3}}>Rep</div><div style={{fontSize:18,fontWeight:700,color:track?.color||C.purple}}>{Math.round((repDone/(cl.length||1))*100)}%</div><Bar pct={(repDone/(cl.length||1))*100} color={track?.color||C.purple}/><div style={{fontSize:12,color:C.textLight,marginTop:3}}>{repDone}/{cl.length}</div></Card>
    </div>
    <Card style={{marginBottom:12,padding:"10px 14px"}}>
      <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:8}}>Rep-Entered Data</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        {[{l:"DGO Date",v:rep.dgoDate||(rep.dgoDone?"Done":"Not set"),c:C.teal},{l:"Business Commit",v:rep.businessCommitment?`$${rep.businessCommitment}`:"Not set",c:C.gold},{l:"Exam Date",v:rep.examDate||(rep.examPassed?"Passed":"Not set"),c:C.purple},{l:"Bonus Goal",v:BONUS_GOALS.find(g=>g.id===rep.bonusGoal)?.label||"Not set",c:C.danger}].map(d=><div key={d.l} style={{textAlign:"center",padding:"7px",background:C.surface,borderRadius:8}}><div style={{fontSize:13,fontWeight:700,color:d.c,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.v}</div><div style={{fontSize:10,color:C.textLight}}>{d.l}</div></div>)}
      {rep.myWhy&&<div style={{marginTop:8,background:C.purple+"11",border:`1px solid ${C.purple}22`,borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:10,fontWeight:700,color:C.purple,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:3}}>My Why</div><div style={{fontSize:13,color:C.text,fontStyle:"italic",lineHeight:1.5}}>"{rep.myWhy}"</div></div>}
      {rep.preLicType&&<div style={{marginTop:6,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}><Badge color={C.purple} small>Pre-Lic: {rep.preLicType==="inperson"?"In-Person":rep.preLicType==="zoom"?"Zoom":"Online"}</Badge>{rep.preLicDone&&<Badge color={C.success} small>Complete</Badge>}{rep.selectedRVP&&<Badge color={C.gold} small>RVP: {rep.selectedRVP}</Badge>}</div>}
      {rep.dgoPhoto&&<DgoPhotoPanel photo={rep.dgoPhoto} name={rep.name}/>}
      {rep.tshirtSize&&<div style={{display:"flex",alignItems:"center",gap:6,marginTop:8}}><div style={{padding:"4px 12px",borderRadius:6,background:C.gold,color:"white",fontSize:13,fontWeight:700}}>{rep.tshirtSize}</div><span style={{fontSize:13,color:C.textMid}}>T-Shirt Size</span></div>}
      </div>
    </Card>
    <div style={{display:"flex",gap:3,overflowX:"auto",marginBottom:10}}>
      {tabs.map(t=><button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"5px 9px",borderRadius:8,border:"none",cursor:"pointer",whiteSpace:"nowrap",fontSize:13,fontWeight:tab===t.k?600:400,background:tab===t.k?C.navy:C.surface,color:tab===t.k?"white":C.textMid}}>{t.l}</button>)}
    </div>
    {tab==="trainer"&&<div>{Object.entries(getChecklistItems(data,"trainerChecklist").reduce((a,i)=>{if(!a[i.cat])a[i.cat]=[];a[i.cat].push(i);return a;},{})).map(([cat,items])=>{const cd=items.filter(i=>tc[i.id]).length;return <div key={cat}><SecHead title={cat} count={[cd,items.length]}/>{items.map(item=><CheckItem key={item.id} item={item} checked={!!tc[item.id]} onToggle={()=>togT(item.id)}/>)}</div>;})}</div>}
    {tab==="rep"&&<RepView rep={liveRepData} data={data} onUpdate={onUpdate} onUpdateData={null} readOnly={false}/>}
    {tab==="appointments"&&<ApptTracker appointments={rep.appointments||[]} onChange={a=>onUpdate(rep.id,{...rep,appointments:a})} track={rep.track}/>}
    {tab==="refs"&&<AdminRefsEditor rep={rep} data={data} onUpdate={onUpdate}/>}
    {tab==="milestones"&&<RepExtras rep={rep} onUpdate={(u)=>onUpdate(rep.id,u)} onUpdateData={null} readOnly={false} data={data}/>}
    {tab==="checkins"&&<div>
      {(()=>{const cis=rep.checkIns||[];const last=cis.length>0?new Date(cis[cis.length-1].date):null;const ds=last?Math.floor((Date.now()-last)/(86400000)):null;const stalled=ds!==null&&ds>=7;return <div style={{background:stalled?C.danger+"11":C.success+"11",border:`1px solid ${stalled?C.danger+"33":C.success+"33"}`,borderRadius:8,padding:"7px 10px",marginBottom:10,fontSize:13,color:stalled?C.danger:C.success}}>{ds===null?"No check-ins yet - log one below":ds===0?"Checked in today":`Last check-in ${ds} day${ds!==1?"s":""} ago${stalled?" - consider reaching out!":""}`}</div>;})()}
      <div style={{display:"flex",gap:7,marginBottom:12}}><input placeholder="Log a check-in note..." value={ciNote} onChange={e=>setCiNote(e.target.value)} style={{flex:1,padding:"7px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/><button onClick={addCI} style={{padding:"7px 12px",borderRadius:8,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600}}>Log</button></div>
      {(()=>{const liveRep=(data.reps||[]).find(r=>r.id===rep.id)||rep;return(liveRep.checkIns||[]).slice().reverse().map((ci,i)=><div key={i} style={{padding:"7px 0",borderBottom:`1px solid ${C.border}`}}><div style={{fontSize:13,color:C.text}}>{ci.note}</div><div style={{fontSize:12,color:C.textLight,marginTop:1}}>{new Date(ci.date).toLocaleDateString()}</div></div>);})()}
    </div>}
    {tab==="career"&&<CareerPath rep={rep} data={data} onUpdate={onUpdate}/>}
    {tab==="schedule"&&<ScheduleView data={data} onUpdate={onUpdateData||((u)=>{})} userRole="rep"/>}
    {tab==="rvp"&&<div>{Object.entries(getChecklistItems(data,"rvpChecklist").reduce((a,i)=>{if(!a[i.cat])a[i.cat]=[];a[i.cat].push(i);return a;},{})).map(([cat,items])=><div key={cat}><SecHead title={cat} color={C.gold}/>{items.map(item=><CheckItem key={item.id} item={item} checked={!!(rep.rvpChecked||{})[item.id]} onToggle={()=>onUpdate(rep.id,{...rep,rvpChecked:{...(rep.rvpChecked||{}),[item.id]:!(rep.rvpChecked||{})[item.id]}})}/>)}</div>)}</div>}
  </div>;
}

// ── MY PRODUCTION ──
function MyProd({myProd,onUpdate,investmentsOnly=false}) {
  const [open,setOpen]=useState(true);
  const [tab,setTab]=useState(investmentsOnly?"investments":"lifeapps");
  const [na,setNa]=useState({clientName:"",premium:"",date:localDateStr()});
  const [ni,setNi]=useState({clientName:"",pac:"",lumpSum:"",type:"Mutual Fund"});
  const [addPrem,setAddPrem]=useState("");
  const apps=myProd.lifeApps||[];
  const invs=myProd.investments||[];
  const totPrem=apps.reduce((s,a)=>s+(Number(a.premium)||0),0);
  const totPAC=invs.reduce((s,i)=>s+(Number(i.pac)||0),0);
  const parseLump=v=>Number(String(v||"").replace(/[$,]/g,""))||0;
  const totLump=invs.reduce((s,i)=>s+parseLump(i.lumpSum),0);
  return <Card style={{marginBottom:14}}>
    <div onClick={()=>setOpen(!open)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
      <div><div style={{fontSize:14,fontWeight:700,color:C.text}}>{investmentsOnly?"My Investments":"My Production"}</div><div style={{fontSize:13,color:C.textMid,marginTop:1}}>{investmentsOnly?`${invs.length} investment${invs.length!==1?"s":""} · $${totPAC.toLocaleString()}/mo PAC · $${totLump.toLocaleString()} lump`:`${apps.length} apps · $${totPrem.toFixed(0)}/mo · $${(totPrem*12).toFixed(0)}/yr`}</div></div>
      <span style={{color:C.textLight,fontSize:18,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>v</span>
    </div>
    {open&&<div style={{marginTop:12}}>
      <div style={{display:"flex",gap:3,marginBottom:10}}>{[["lifeapps","Life Apps"],["investments","Investments"]].filter(([k])=>!investmentsOnly||k==="investments").map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:"4px 10px",borderRadius:7,border:"none",cursor:"pointer",fontSize:13,fontWeight:tab===k?600:400,background:tab===k?C.teal:"transparent",color:tab===k?"white":C.textMid}}>{l}</button>)}</div>
      {tab==="lifeapps"&&<div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:10}}>
          <div style={{background:C.teal+"11",borderRadius:8,padding:"7px 10px",textAlign:"center"}}><div style={{fontSize:17,fontWeight:700,color:C.teal}}>{apps.length}</div><div style={{fontSize:12,color:C.textMid}}>Life Apps</div></div>
          <div style={{background:C.gold+"11",borderRadius:8,padding:"7px 10px",textAlign:"center"}}><div style={{fontSize:17,fontWeight:700,color:C.gold}}>${totPrem.toFixed(0)}/mo</div><div style={{fontSize:12,color:C.textMid}}>Monthly</div></div>
          <div style={{background:C.purple+"11",borderRadius:8,padding:"7px 10px",textAlign:"center"}}><div style={{fontSize:17,fontWeight:700,color:C.purple}}>${(totPrem*12).toFixed(0)}/yr</div><div style={{fontSize:12,color:C.textMid}}>Annual</div></div>
        </div>
        <div style={{background:C.surface,borderRadius:8,padding:9,marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:700,color:C.textMid,marginBottom:6}}>Log New Life App</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
            <input placeholder="Client Name" value={na.clientName} onChange={e=>setNa({...na,clientName:e.target.value})} style={{gridColumn:"span 2",padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
            <input placeholder="Monthly Premium $ (per month)" value={na.premium} onChange={e=>setNa({...na,premium:e.target.value})} style={{padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
            <input type="date" value={na.date} onChange={e=>setNa({...na,date:e.target.value})} style={{padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
          </div>
          <button onClick={()=>{if(!na.clientName)return;onUpdate({...myProd,lifeApps:[...apps,{...na,date:na.date||localDateStr(),id:Date.now()}]});setNa({clientName:"",premium:"",date:localDateStr()}); }} style={{marginTop:7,width:"100%",padding:"6px",borderRadius:7,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600}}>+ Log Life App</button>
        </div>
        {apps.length>0&&<div style={{background:C.gold+"11",border:`1px solid ${C.gold}33`,borderRadius:8,padding:"10px 12px",marginBottom:8}}>
          <div style={{fontSize:13,fontWeight:700,color:C.gold,marginBottom:8}}>Add Premium to Running Total</div>
          <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:6}}>
            <input type="number" placeholder="New amount $/mo" value={addPrem} onChange={e=>setAddPrem(e.target.value)} style={{flex:1,padding:"6px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
            <button onClick={()=>{if(!addPrem)return;onUpdate({...myProd,lifeApps:[...apps,{clientName:"Additional Premium",premium:addPrem,date:localDateStr(),id:Date.now()}]});setAddPrem("");}} style={{padding:"6px 12px",borderRadius:6,background:C.gold,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600}}>Add</button>
          </div>
          <div style={{fontSize:13,color:C.textMid}}>Current: <strong style={{color:C.gold}}>${totPrem.toFixed(0)}/mo</strong>{addPrem&&<span> + ${addPrem} = <strong style={{color:C.success}}>${(totPrem+Number(addPrem)).toFixed(0)}/mo (${((totPrem+Number(addPrem))*12).toFixed(0)}/yr)</strong></span>}</div>
        </div>}
        {apps.map((a,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${C.border}`,fontSize:13}}><span style={{color:C.text}}>{a.clientName}</span><div style={{display:"flex",gap:7,alignItems:"center"}}>{a.premium&&<span style={{color:C.gold}}>${a.premium}/mo</span>}<button onClick={()=>onUpdate({...myProd,lifeApps:apps.filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:14}}>x</button></div></div>)}
      </div>}
      {tab==="investments"&&<div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:10}}>{[[invs.length,"Investments",C.teal],[invs.filter(i=>Number(i.pac)>0).length,"PAC Accounts",C.purple],[`$${totPAC.toLocaleString()}/mo`,"PAC Total",C.gold],[`$${totLump.toLocaleString()}`,"Lump Sum",C.purple]].map(([v,l,c])=><div key={l} style={{background:c+"11",borderRadius:8,padding:"7px 6px",textAlign:"center"}}><div style={{fontSize:14,fontWeight:700,color:c}}>{v}</div><div style={{fontSize:9,color:C.textMid}}>{l}</div></div>)}</div>
        {investmentsOnly&&<div style={{background:C.purple+"08",border:`1px solid ${C.purple}33`,borderRadius:8,padding:"10px 12px",marginBottom:10}}>
          <div style={{fontSize:12,fontWeight:700,color:C.purple,marginBottom:8}}>Monthly Investment Goals</div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:600,color:C.text,marginBottom:3}}>PAC Goal — # of Accounts</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" placeholder="e.g. 10" value={myProd.monthlyPACCountGoal||""} onChange={e=>onUpdate({...myProd,monthlyPACCountGoal:e.target.value})} style={{flex:1,padding:"6px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
              <span style={{fontSize:13,color:C.textMid}}>PAC accounts</span>
            </div>
            {myProd.monthlyPACCountGoal&&Number(myProd.monthlyPACCountGoal)>0&&<div style={{marginTop:6}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.textMid,marginBottom:3}}>
                <span>PAC Count Progress</span>
                <span style={{fontWeight:700,color:C.purple}}>{invs.filter(i=>Number(i.pac)>0).length} / {Number(myProd.monthlyPACCountGoal)}</span>
              </div>
              <div style={{height:6,background:"rgba(0,0,0,0.08)",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:3,background:C.purple,width:Math.min(100,Math.round((invs.filter(i=>Number(i.pac)>0).length/Number(myProd.monthlyPACCountGoal))*100))+"%"}}/>
              </div>
            </div>}
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:600,color:C.text,marginBottom:3}}>PAC Goal — $/mo Total</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" placeholder="e.g. 5000" value={myProd.monthlyPACGoal||""} onChange={e=>onUpdate({...myProd,monthlyPACGoal:e.target.value})} style={{flex:1,padding:"6px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
              <span style={{fontSize:13,color:C.textMid}}>/mo</span>
            </div>
            {myProd.monthlyPACGoal&&Number(myProd.monthlyPACGoal)>0&&<div style={{marginTop:6}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.textMid,marginBottom:3}}>
                <span>PAC Progress</span>
                <span style={{fontWeight:700,color:C.gold}}>${Math.round(totPAC).toLocaleString()}/mo / ${Number(myProd.monthlyPACGoal).toLocaleString()}/mo</span>
              </div>
              <div style={{height:6,background:"rgba(0,0,0,0.08)",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:3,background:C.gold,width:Math.min(100,Math.round((totPAC/Number(myProd.monthlyPACGoal))*100))+"%"}}/>
              </div>
            </div>}
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:C.text,marginBottom:3}}>Lump Sum Goal ($ this month)</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" placeholder="e.g. 250000" value={myProd.monthlyLumpGoal||""} onChange={e=>onUpdate({...myProd,monthlyLumpGoal:e.target.value})} style={{flex:1,padding:"6px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
              <span style={{fontSize:13,color:C.textMid}}>this month</span>
            </div>
            {myProd.monthlyLumpGoal&&Number(myProd.monthlyLumpGoal)>0&&<div style={{marginTop:6}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.textMid,marginBottom:3}}>
                <span>Lump Sum Progress</span>
                <span style={{fontWeight:700,color:C.purple}}>${Math.round(totLump).toLocaleString()} / ${Number(myProd.monthlyLumpGoal).toLocaleString()}</span>
              </div>
              <div style={{height:6,background:"rgba(0,0,0,0.08)",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:3,background:C.purple,width:Math.min(100,Math.round((totLump/Number(myProd.monthlyLumpGoal))*100))+"%"}}/>
              </div>
            </div>}
          </div>
        </div>}
        <div style={{background:C.surface,borderRadius:8,padding:9,marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:700,color:C.textMid,marginBottom:6}}>Log New Investment</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
            <input placeholder="Client Name" value={ni.clientName} onChange={e=>setNi({...ni,clientName:e.target.value})} style={{gridColumn:"span 2",padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
            <input placeholder="PAC $/mo" value={ni.pac} onChange={e=>setNi({...ni,pac:e.target.value})} style={{padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
            <input type="number" placeholder="Lump Sum $" value={ni.lumpSum} onChange={e=>setNi({...ni,lumpSum:e.target.value})} style={{padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
            <select value={ni.type} onChange={e=>setNi({...ni,type:e.target.value})} style={{gridColumn:"span 2",padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}><option>Mutual Fund</option><option>Annuity</option></select>
          </div>
          <button onClick={()=>{if(!ni.clientName)return;onUpdate({...myProd,investments:[...invs,{...ni,id:Date.now(),date:localDateStr()}]});setNi({clientName:"",pac:"",lumpSum:"",type:"Mutual Fund"});}} style={{marginTop:7,width:"100%",padding:"6px",borderRadius:7,background:C.gold,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600}}>+ Log New Investment</button>
        </div>
        {invs.map((inv,i)=><div key={i} style={{padding:"6px 0",borderBottom:`1px solid ${C.border}`,fontSize:13}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:C.text,fontWeight:600}}>{inv.clientName}</span><button onClick={()=>onUpdate({...myProd,investments:invs.filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer"}}>x</button></div><div style={{color:C.textMid,display:"flex",gap:6,marginTop:1}}><Badge color={C.teal} small>{inv.type}</Badge>{inv.pac&&<span>PAC: ${inv.pac}/mo</span>}{inv.lumpSum&&<span>Lump: ${inv.lumpSum}</span>}</div></div>)}
      </div>}
    </div>}
  </Card>;
}


// ── QUICK RECRUIT LOG (reusable in Production tabs) ──
// Feeds directly into the Recruits auto-actual on Scorecard/Coaching Report.
function QuickRecruitLog({person,onSave}) {
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({name:"",phone:"",date:localDateStr()});
  const log=person?.myRecruitLog||[];
  const addRecruit=()=>{
    if(!form.name.trim()) return;
    const updated=[...log,{...form,id:Date.now(),addedAt:new Date().toISOString()}];
    onSave(updated);
    setForm({name:"",phone:"",date:localDateStr()});
    setShowForm(false);
  };
  const removeRecruit=(id)=>onSave(log.filter(r=>r.id!==id));
  const recentLog=[...log].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  return <Card style={{marginBottom:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <div>
        <div style={{fontSize:13,fontWeight:700,color:C.text}}>Log a Recruit</div>
        <div style={{fontSize:12,color:C.textMid}}>{log.length} logged total — feeds your daily commitment automatically</div>
      </div>
      <button onClick={()=>setShowForm(!showForm)} style={{fontSize:12,padding:"5px 10px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>{showForm?"Cancel":"+ Add"}</button>
    </div>
    {showForm&&<div style={{border:`1px solid ${C.border}`,borderRadius:8,padding:10,marginBottom:8}}>
      <input placeholder="Recruit's name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={{width:"100%",padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,boxSizing:"border-box"}}/>
      <div style={{fontSize:11,color:C.textLight,marginBottom:6,marginTop:3}}>Use their exact name — if you add them as a full rep later, spell it the same way (e.g. "Mike" here and "Michael" later won't match).</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
        <input placeholder="Phone (optional)" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} style={{padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13}}/>
        <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={{padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13}}/>
      </div>
      <button onClick={addRecruit} style={{width:"100%",padding:"7px",borderRadius:7,border:"none",background:C.gold,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Save Recruit</button>
    </div>}
    {recentLog.map(r=><div key={r.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderTop:`1px solid ${C.border}`}}>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:600,color:C.text}}>{r.name}</div>
        <div style={{fontSize:11,color:C.textLight}}>{r.date&&new Date(r.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
      </div>
      <button onClick={()=>removeRecruit(r.id)} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:14}}>x</button>
    </div>)}
  </Card>;
}

// ── REP PRODUCTION TAB (licensed reps / field-trainer-granted) ──
// Mirrors the field trainer/admin "Production" page exactly: promotion level, life apps
// with income goal, and investments with PAC/Lump goal tracking.
function RepProductionTab({rep,data,onUpdate,onUpdateData,readOnly}) {
  const PROMO_LEVELS=[{key:"rep",label:"Rep",pct:25},{key:"sr_rep",label:"Senior Rep",pct:35},{key:"dl",label:"District Leader",pct:50},{key:"divl",label:"Division Leader",pct:60},{key:"rl",label:"Regional Leader",pct:70},{key:"srl",label:"Senior Regional Leader",pct:80},{key:"rvp",label:"RVP",pct:110}];
  const myProdRaw=(data.myProduction||{})[rep.id]||{};
  // One-time migration safety net: if this rep already logged investments the old way
  // (stored directly on the rep record) and hasn't logged any here yet, show those so
  // nothing already entered is lost. New entries go through the shared myProduction store.
  const hasNewInvestments=(myProdRaw.investments||[]).length>0;
  const hasLegacyInvestments=(rep.investments||[]).length>0;
  const myProd=(!hasNewInvestments&&hasLegacyInvestments)?{...myProdRaw,investments:rep.investments}:myProdRaw;

  const updateMyProd=(patch)=>{
    if(typeof onUpdateData!=="function") return;
    onUpdateData({...data,myProduction:{...(data.myProduction||{}),[rep.id]:patch}});
  };

  return <div>
    <Card style={{marginBottom:12,border:`1px solid ${C.gold}33`}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8}}>My Contract Level</div>
      <div style={{fontSize:13,color:C.textMid,marginBottom:8}}>Select your current Primerica promotion level. Updates commission calculations automatically.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
        {PROMO_LEVELS.map(p=><button key={p.key} disabled={readOnly} onClick={()=>onUpdate(rep.id,{...rep,promotionLevel:p.key})} style={{padding:"6px 8px",borderRadius:7,border:`1px solid ${(rep.promotionLevel||"rep")===p.key?C.gold:C.border}`,background:(rep.promotionLevel||"rep")===p.key?C.gold+"11":"white",cursor:readOnly?"default":"pointer",textAlign:"left"}}>
          <div style={{fontSize:13,fontWeight:700,color:(rep.promotionLevel||"rep")===p.key?C.gold:C.text}}>{p.label}</div>
          <div style={{fontSize:12,color:C.textMid}}>{p.pct}%</div>
        </button>)}
      </div>
    </Card>
    <LicensedPremiumEntry rep={rep} onUpdate={(u)=>onUpdate(rep.id,u)} readOnly={readOnly}/>
    {!readOnly&&<QuickRecruitLog person={rep} onSave={(log)=>onUpdate(rep.id,{...rep,myRecruitLog:log})}/>}
    <MyProd myProd={myProd} onUpdate={updateMyProd} investmentsOnly={true}/>
  </div>;
}


function InvestmentBreakdown({data,reps,allStaff,totPAC,totLump}) {
  const [open,setOpen] = useState(false);

  // Build per-person breakdown
  const breakdown = [];
  reps.forEach(r=>{
    const inv = r.investments||[];
    const pac = inv.reduce((s,i)=>s+(Number(i.pac)||0),0);
    const lump = inv.reduce((s,i)=>s+(Number(String(i.lumpSum||"").replace(/[$,]/g,""))||0),0);
    if(pac>0||lump>0) breakdown.push({name:r.name,role:"Rep",pac,lump,entries:inv});
  });
  allStaff.forEach(t=>{
    const inv = (data.myProduction||{})[t.id]?.investments||[];
    const inv2 = t.investments||[];
    const allInv = [...inv,...inv2.filter(i=>!inv.find(j=>j.id===i.id))];
    const pac = allInv.reduce((s,i)=>s+(Number(i.pac)||0),0);
    const lump = allInv.reduce((s,i)=>s+(Number(String(i.lumpSum||"").replace(/[$,]/g,""))||0),0);
    if(pac>0||lump>0) breakdown.push({name:t.name,role:t.isSuperAdmin?"Super Admin":"Admin/Trainer",pac,lump,entries:allInv});
  });

  return <div style={{marginTop:4,marginBottom:10}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:6}}>
      <div style={{background:C.surface,borderRadius:8,padding:"8px 10px"}}>
        <div style={{fontSize:12,color:C.textMid,marginBottom:2}}>Total Monthly PAC</div>
        <div style={{fontSize:16,fontWeight:700,color:C.teal}}>${totPAC.toLocaleString()}</div>
      </div>
      <div style={{background:C.surface,borderRadius:8,padding:"8px 10px"}}>
        <div style={{fontSize:12,color:C.textMid,marginBottom:2}}>Total Lump Sum</div>
        <div style={{fontSize:16,fontWeight:700,color:C.purple}}>${totLump.toLocaleString()}</div>
      </div>
    </div>
    {breakdown.length>0&&<button onClick={()=>setOpen(!open)} style={{fontSize:12,color:C.teal,background:"none",border:"none",cursor:"pointer",padding:0,textDecoration:"underline"}}>
      {open?"Hide":"Show"} breakdown ({breakdown.length} contributor{breakdown.length!==1?"s":""})
    </button>}
    {open&&<div style={{marginTop:6,background:C.surface,borderRadius:8,padding:"8px 10px"}}>
      {breakdown.map((b,i)=><div key={i} style={{marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
          <div>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>{b.name}</span>
            <span style={{fontSize:12,color:C.textLight,marginLeft:6}}>{b.role}</span>
          </div>
          <div style={{display:"flex",gap:10}}>
            {b.pac>0&&<span style={{fontSize:13,color:C.teal,fontWeight:600}}>${b.pac}/mo PAC</span>}
            {b.lump>0&&<span style={{fontSize:13,color:C.purple,fontWeight:600}}>${b.lump.toLocaleString()} Lump</span>}
          </div>
        </div>
        {b.entries.map((e,ei)=><div key={ei} style={{fontSize:12,color:C.textMid,paddingLeft:10,borderLeft:"2px solid "+C.border,marginBottom:2}}>
          {e.clientName} — {e.type}{e.pac?` · $${e.pac}/mo`:""}{e.lumpSum?` · $${Number(e.lumpSum).toLocaleString()} lump`:""}
        </div>)}
      </div>)}
    </div>}
  </div>;
}

// ── PRODUCTION DASHBOARD ──
function ProdDash({data,onUpdateData}) {
  const reps=data.reps||[];
  const trainers=data.trainers||[];
  const goals=data.goals||{premium:10000,recruits:10,licensed:100};
  const [editG,setEditG]=useState(false);
  const [gd,setGd]=useState(goals);
  const allStaff=[...(data.trainers||[]),...(data.admins||[])];
  const totPremMo=reps.reduce((s,r)=>s+(Number(r.premiumSubmitted)||0)+(r.selfPremium||[]).reduce((ss,e)=>ss+(Number(e.premium)||0),0),0)+allStaff.reduce((s,t)=>{const a=(data.myProduction?.[t.id]?.lifeApps)||[];return s+a.reduce((ss,a)=>ss+(Number(a.premium)||0),0);},0);
  const totRecs = data.prodOverride?.recruits!==undefined ? data.prodOverride.recruits : reps.filter(r=>!r.inactive).length;
  const totLic=reps.filter(r=>r.isLicensed).length;
  // PAC and lump sum totals from investment logs
  const allInvLogs = [
    ...reps.reduce((a,r)=>([...a,...(r.investments||[])]),[]),
    ...allStaff.reduce((a,t)=>([...a,...((data.myProduction?.[t.id]?.investments)||[])]),[]),
  ];
  const totPAC = allInvLogs.reduce((s,i)=>s+(Number(i.pac)||0),0);
  const totLump = allInvLogs.reduce((s,i)=>s+(Number(String(i.lumpSum||"").replace(/[$,]/g,""))||0),0);
  return <Card style={{marginBottom:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:14,fontWeight:700,color:C.text}}>Team Production</div><div style={{display:"flex",gap:6}}><button onClick={()=>{if(window.confirm("Clear Annual Premium, New Recruits display, Licensed Agents, and all investment entries? This resets all production counters."))onUpdateData({...data,reps:(data.reps||[]).map(r=>({...r,selfPremium:[],isLicensed:false,premiumSubmitted:0,investments:[]})),myProduction:{},prodOverride:{recruits:0},admins:(data.admins||[]).map(a=>({...a,investments:[]})),trainers:(data.trainers||[]).map(t=>({...t,investments:[]}))});}} style={{fontSize:12,padding:"3px 8px",borderRadius:6,border:"1px solid "+C.danger+"33",background:C.danger+"11",cursor:"pointer",color:C.danger,fontWeight:600}}>Clear Counters</button><button onClick={()=>setEditG(!editG)} style={{fontSize:13,padding:"3px 9px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>{editG?"Cancel":"Edit Goals"}</button></div></div>
    {editG&&<div style={{background:C.surface,borderRadius:8,padding:9,marginBottom:10}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}>{[["premium","Annual Premium $",gd.premium],["recruits","Recruits",gd.recruits],["licensed","Licensed Agents",gd.licensed]].map(([k,l,v])=><div key={k}><div style={{fontSize:12,color:C.textMid,marginBottom:3}}>{l}</div><input type="number" value={v} onChange={e=>setGd({...gd,[k]:Number(e.target.value)})} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,boxSizing:"border-box",color:C.text}}/></div>)}</div>
      <button onClick={()=>{onUpdateData({...data,goals:gd});setEditG(false);}} style={{marginTop:7,width:"100%",padding:"6px",borderRadius:7,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600}}>Save Goals</button>
    </div>}
    {[{l:"Annual Premium",v:totPremMo*12,goal:goals.premium,fmt:v=>`$${Math.round(v).toLocaleString()}`,c:C.teal,sub:`$${totPremMo.toFixed(0)}/mo`},{l:"New Recruits",v:totRecs,goal:goals.recruits,fmt:v=>v,c:C.purple},{l:"Licensed Agents",v:totLic,goal:goals.licensed,fmt:v=>v,c:C.gold}].map(g=><div key={g.l} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:13,color:C.textMid}}>{g.l}</span><span style={{fontSize:13,fontWeight:600,color:g.v>=g.goal?C.success:C.text}}>{g.fmt(g.v)} / {g.fmt(g.goal)}</span></div>{g.sub&&<div style={{fontSize:12,color:C.textLight,marginBottom:3}}>{g.sub}</div>}<Bar pct={(g.v/g.goal)*100} color={g.v>=g.goal?C.success:g.c}/></div>)}
    {(totPAC>0||totLump>0)&&<InvestmentBreakdown data={data} reps={reps} allStaff={allStaff} totPAC={totPAC} totLump={totLump}/>}
    <CollapsibleRepList reps={reps} data={data} onUpdateData={onUpdateData}/>
  </Card>;
}

// ── ADD REP ──
function AddRep({onAdd,onClose,trainers,allPeople=[]}) {
  const [f,setF]=useState({name:"",phone:"",email:"",track:"",trainerId:"",startDate:new Date().toISOString().split("T")[0]});
  const fmtP=v=>{const d=v.replace(/\D/g,"").slice(0,10);if(d.length>=7)return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;if(d.length>=4)return `${d.slice(0,3)}-${d.slice(3)}`;return d;};
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
    <div style={{background:"white",borderRadius:16,padding:22,width:"100%",maxWidth:420,maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div style={{fontSize:15,fontWeight:700,color:C.text}}>Add New Rep</div><button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.textMid}}>x</button></div>
      {[{fld:"name",l:"Full Name",t:"text"},{fld:"phone",l:"Phone",t:"text"},{fld:"email",l:"Email",t:"email"},{fld:"startDate",l:"Start Date",t:"date"},].map(({fld,l,t})=><div key={fld} style={{marginBottom:9}}><label style={{fontSize:13,color:C.textMid,display:"block",marginBottom:3}}>{l}</label><input type={t} value={f[fld]} onChange={e=>setF({...f,[fld]:fld==="phone"?fmtP(e.target.value):e.target.value})} style={{width:"100%",padding:"8px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,color:C.text,boxSizing:"border-box"}}/></div>)}
      <div style={{marginBottom:9}}>
        <label style={{fontSize:13,color:C.textMid,display:"block",marginBottom:5}}>Track</label>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          <button onClick={()=>setF({...f,track:""})} style={{padding:"10px 12px",borderRadius:8,border:`2px solid ${!f.track?C.teal:C.border}`,background:!f.track?C.teal+"11":"white",cursor:"pointer",textAlign:"left"}}>
            <div style={{fontSize:13,fontWeight:700,color:!f.track?C.teal:C.text,marginBottom:2}}>🎯 Rep Chooses — Unlicensed New Rep</div>
            <div style={{fontSize:12,color:C.textMid,lineHeight:1.4}}>Rep will watch the welcome video first, then choose Fast Start (7-14 days) or Regular Start (30 days) for themselves. Best for all new unlicensed reps.</div>
          </button>
          <button onClick={()=>setF({...f,track:"licensed"})} style={{padding:"10px 12px",borderRadius:8,border:`2px solid ${f.track==="licensed"?C.gold:C.border}`,background:f.track==="licensed"?C.gold+"11":"white",cursor:"pointer",textAlign:"left"}}>
            <div style={{fontSize:13,fontWeight:700,color:f.track==="licensed"?C.gold:C.text,marginBottom:2}}>🎓 Already Licensed — Skip to Licensed Now What</div>
            <div style={{fontSize:12,color:C.textMid,lineHeight:1.4}}>Rep already holds a life insurance license. Skips Fast/Regular Start entirely and goes straight to the Licensed Now What checklist.</div>
          </button>
        </div>
      </div>
      <div style={{marginBottom:9}}><label style={{fontSize:13,color:C.textMid,display:"block",marginBottom:3}}>Assign Trainer</label><select value={f.trainerId} onChange={e=>setF({...f,trainerId:e.target.value})} style={{width:"100%",padding:"8px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,color:C.text}}><option value="">No trainer</option>{trainers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}{(allPeople||[]).filter(p=>p.role==="Admin"&&(p.alsoRecruits||p.isSuperAdmin)).map(a=><option key={a.id} value={a.id}>{a.name} (Admin)</option>)}</select></div>
      <div style={{marginBottom:9}}><label style={{fontSize:13,color:C.textMid,display:"block",marginBottom:3}}>Assign RVP / Admin <span style={{fontSize:11,color:C.textLight,fontWeight:400}}>— determines whose My Reps filter they appear under</span></label><select value={f.adminId||""} onChange={e=>setF({...f,adminId:e.target.value})} style={{width:"100%",padding:"8px 11px",borderRadius:8,border:`1px solid ${C.gold}`,fontSize:14,color:C.text}}><option value="">Not assigned</option>{(allPeople||[]).filter(p=>p.role==="Admin").map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
      <div style={{marginBottom:9}}><label style={{fontSize:13,color:C.textMid,display:"block",marginBottom:3}}>Recruited By</label><select value={f.recruitedBy||""} onChange={e=>setF({...f,recruitedBy:e.target.value})} style={{width:"100%",padding:"8px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,color:C.text}}><option value="">Select recruiter...</option>{allPeople.map(p=><option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}</select></div>
      <label style={{display:"flex",alignItems:"flex-start",gap:8,padding:"10px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:C.surface,marginBottom:14,cursor:"pointer"}}>
        <input type="checkbox" checked={!!f.excludeFromRecruitCount} onChange={e=>setF({...f,excludeFromRecruitCount:e.target.checked})} style={{width:17,height:17,marginTop:1,accentColor:C.teal,cursor:"pointer",flexShrink:0}}/>
        <span style={{fontSize:12,color:C.textMid,lineHeight:1.5}}>This person is already a rep. <strong style={{color:C.text}}>Don't count them toward new recruit numbers.</strong></span>
      </label>
      <button onClick={()=>{if(f.name){onAdd(f);onClose();}}} style={{width:"100%",padding:"10px",borderRadius:8,background:C.teal,color:"white",border:"none",fontWeight:600,fontSize:14,cursor:"pointer",marginTop:4}}>Add Rep</button>
    </div>
  </div>;
}

// ── MANAGE TEAM ──
// ── MANAGE TEAM PAGE (inline sidebar version) ──
function ManageTeamPage({data,onUpdate}) {
  // Reuse all ManageTeam logic but render inline instead of as a modal
  const [nt,setNt]=useState({name:"",pin:"",bookingLink:""});
  const [na,setNa]=useState({name:"",pin:""});
  const [localData,setLocalData]=useState(data);
  const [hasChanges,setHasChanges]=useState(false);
  const [confirm,setConfirm]=useState(null);
  const trainers=localData.trainers||[];
  const admins=localData.admins||[{id:"superadmin",name:"Jacqueline Jones",pin:"1234",isSuperAdmin:true,alsoRecruits:true}];
  const updateLocal=(updated)=>{setLocalData(updated);setHasChanges(true);};
  const saveChanges=()=>setConfirm({msg:"Save these changes to Team Management?\nThis will update settings for your entire team.",onYes:()=>{
    onUpdate({...data,
      trainers:localData.trainers,
      admins:localData.admins,
      welcomeVideoUrl:localData.welcomeVideoUrl,
      licensedVideoUrl:localData.licensedVideoUrl,
      fieldTrainerVideoUrl:localData.fieldTrainerVideoUrl,
      rvpPathVideoUrl:localData.rvpPathVideoUrl,
      orientationVideoUrl:localData.orientationVideoUrl,
      customRVPs:localData.customRVPs,
      primerMonthEnds:localData.primerMonthEnds,
      rvpBookingLinks:localData.rvpBookingLinks,
      announcements:localData.announcements,
      teamBrands:localData.teamBrands,
      repShareableLinks:localData.repShareableLinks,
      moneyMapContent:localData.moneyMapContent,
      teamLinks:localData.teamLinks,
    });
    setHasChanges(false);setConfirm(null);}});

  // Sync localData when data prop changes (e.g. another device saves)
  useEffect(()=>{if(!hasChanges) setLocalData(data);},[data]);

  return <div style={{maxWidth:560}}>
    {confirm&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"white",borderRadius:16,padding:24,width:"100%",maxWidth:340,textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
        <div style={{fontSize:14,color:C.text,lineHeight:1.6,marginBottom:20,whiteSpace:"pre-line"}}>{confirm.msg}</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setConfirm(null)} style={{flex:1,padding:"11px",borderRadius:10,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:13,color:C.textMid,fontWeight:600}}>Cancel</button>
          <button onClick={confirm.onYes} style={{flex:1,padding:"11px",borderRadius:10,background:C.teal,border:"none",color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>Yes, Save</button>
        </div>
      </div>
    </div>}

    {/* Team Branding */}
    <Card style={{marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:4}}>Login Screen Branding</div>
      <div style={{fontSize:11,color:C.textLight,marginBottom:10}}>Add team names and logos shown on the login screen. As you promote more RVPs, just add a new team here.</div>
      <div style={{background:C.teal+"11",border:`1px solid ${C.teal}33`,borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:11,color:C.text,lineHeight:1.7}}>
        <div style={{fontWeight:700,color:C.teal,marginBottom:6}}>📸 How to add a team logo — step by step:</div>
        <div style={{marginBottom:3}}><strong>Step 1:</strong> Upload your logo image to Google Drive</div>
        <div style={{marginBottom:3}}><strong>Step 2:</strong> Right-click the file → <strong>Share</strong> → change access to <strong>"Anyone with the link"</strong> → click Done</div>
        <div style={{marginBottom:3}}><strong>Step 3:</strong> Click <strong>Copy link</strong> — you'll get a link like:<br/><span style={{fontFamily:"monospace",fontSize:10,background:"rgba(0,0,0,0.06)",padding:"1px 4px",borderRadius:3}}>https://drive.google.com/file/d/<strong style={{color:C.teal}}>YOUR_FILE_ID</strong>/view?usp=sharing</span></div>
        <div style={{marginBottom:3}}><strong>Step 4:</strong> Copy just the ID part (the long text between <strong>/d/</strong> and <strong>/view</strong>)</div>
        <div style={{marginBottom:6}}><strong>Step 5:</strong> Build your image URL like this:<br/><span style={{fontFamily:"monospace",fontSize:10,background:"rgba(14,165,160,0.1)",padding:"1px 4px",borderRadius:3,color:C.teal}}>https://lh3.googleusercontent.com/d/<strong>YOUR_FILE_ID</strong></span></div>
        <div style={{background:"rgba(0,0,0,0.04)",borderRadius:6,padding:"6px 8px",fontSize:10,color:C.textMid}}>
          <strong>Example:</strong> If your Google Drive link is<br/>
          <span style={{fontFamily:"monospace"}}>drive.google.com/file/d/<strong>1ABC123xyz</strong>/view</span><br/>
          Then your logo URL is<br/>
          <span style={{fontFamily:"monospace",color:C.teal}}>https://lh3.googleusercontent.com/d/<strong>1ABC123xyz</strong></span>
        </div>
      </div>
      {(localData.teamBrands||[{name:"Team PrimeTime",logo:"",emoji:"⚡"},{name:"Wealth Creators",logo:"",emoji:"🏆"}]).map((team,i)=>{
        const brands=localData.teamBrands||[{name:"Team PrimeTime",logo:"",emoji:"⚡"},{name:"Wealth Creators",logo:"",emoji:"🏆"}];
        return <div key={i} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:"8px 10px",marginBottom:8}}>
          <div style={{display:"grid",gridTemplateColumns:"40px 1fr auto",gap:6,alignItems:"center",marginBottom:6}}>
            <input placeholder="⭐" value={team.emoji||""} onChange={e=>{const u=brands.map((b,j)=>j===i?{...b,emoji:e.target.value}:b);updateLocal({...localData,teamBrands:u});}} style={{padding:"4px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:16,textAlign:"center"}}/>
            <input placeholder="Team name (e.g. Wealth Creators)" value={team.name||""} onChange={e=>{const u=brands.map((b,j)=>j===i?{...b,name:e.target.value}:b);updateLocal({...localData,teamBrands:u});}} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
            <button onClick={()=>{const u=brands.filter((_,j)=>j!==i);updateLocal({...localData,teamBrands:u});}} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:16}}>x</button>
          </div>
          <input placeholder="Logo image URL (optional — paste public image URL)" value={team.logo||""} onChange={e=>{const u=brands.map((b,j)=>j===i?{...b,logo:e.target.value.trim()}:b);updateLocal({...localData,teamBrands:u});}} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text,boxSizing:"border-box"}}/>
          {team.logo&&<img src={team.logo} alt="preview" style={{height:36,marginTop:5,borderRadius:5,objectFit:"contain"}} onError={e=>e.target.style.display="none"}/>}
        </div>;
      })}
      <button onClick={()=>{const brands=localData.teamBrands||[{name:"Team PrimeTime",logo:"",emoji:"⚡"},{name:"Wealth Creators",logo:"",emoji:"🏆"}];updateLocal({...localData,teamBrands:[...brands,{name:"",logo:"",emoji:"⭐"}]});}} style={{width:"100%",padding:"7px",borderRadius:8,border:`1px solid ${C.teal}`,background:C.teal+"11",color:C.teal,fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Add Team</button>
    </Card>

    {/* Announcements */}
    <AnnouncementsManager data={data} onUpdate={onUpdate}/>

    {hasChanges&&<div style={{background:C.gold+"11",border:`1px solid ${C.gold}33`,borderRadius:8,padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
      <div style={{fontSize:13,color:"#b45309",fontWeight:600}}>⚠️ Unsaved changes</div>
      <button onClick={saveChanges} style={{padding:"8px 16px",borderRadius:7,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:700}}>💾 Save Changes</button>
    </div>}

    {/* Admins */}
    <Card style={{marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:4}}>Admins</div>
      <div style={{fontSize:11,color:C.textLight,marginBottom:8}}>Add your booking link below — it shows in the Appts tab for any reps assigned directly to you.</div>
      {admins.map((a,i)=><div key={a.id} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:"8px 10px",marginBottom:6}}>
        <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:4}}>
          <input value={a.name} onChange={e=>{const u=admins.map((ad,j)=>j===i?{...ad,name:e.target.value}:ad);updateLocal({...localData,admins:u});}} style={{flex:1,padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,fontWeight:600}} placeholder="Admin name"/>
          {a.isSuperAdmin&&<span style={{fontSize:12,color:C.gold,whiteSpace:"nowrap"}}>Super Admin</span>}
          <input placeholder="PIN" maxLength={6} value={a.pin} onChange={e=>{const u=admins.map((ad,j)=>j===i?{...ad,pin:e.target.value.replace(/\D/,"")}:ad);updateLocal({...localData,admins:u});}} style={{width:65,padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,textAlign:"center",letterSpacing:"2px",color:C.text}}/>
          {!a.isSuperAdmin&&<button onClick={()=>updateLocal({...localData,admins:admins.filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer"}}>x</button>}
        </div>
        <input placeholder="Booking link (shows in Appts tab for your assigned reps)" value={a.bookingLink||""} onChange={e=>{const u=admins.map((ad,j)=>j===i?{...ad,bookingLink:e.target.value}:ad);updateLocal({...localData,admins:u});}} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,boxSizing:"border-box",marginBottom:4}}/>
        <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",marginTop:4}}>
          <input type="checkbox" checked={!!a.alsoRecruits} onChange={e=>{const u=admins.map((ad,j)=>j===i?{...ad,alsoRecruits:e.target.checked}:ad);updateLocal({...localData,admins:u});}}/>
          <span style={{fontSize:13,color:C.textMid}}>Also actively recruits and trains</span>
        </label>
      </div>)}
      <div style={{display:"flex",gap:6,marginTop:6}}>
        <input placeholder="Name" value={na.name} onChange={e=>setNa({...na,name:e.target.value})} style={{flex:1,padding:"5px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
        <input placeholder="PIN" maxLength={6} value={na.pin} onChange={e=>setNa({...na,pin:e.target.value.replace(/\D/,"")})} style={{width:70,padding:"5px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,textAlign:"center",letterSpacing:"2px",color:C.text}}/>
        <button onClick={()=>{if(!na.name||!na.pin)return;updateLocal({...localData,admins:[...admins,{id:"admin_"+Date.now(),name:na.name,pin:na.pin,alsoRecruits:false}]});setNa({name:"",pin:""}); }} style={{padding:"5px 10px",borderRadius:7,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600}}>Add</button>
      </div>
    </Card>

    {/* Field Trainers */}
    <Card style={{marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:4}}>Field Trainers</div>
      <div style={{fontSize:11,color:C.textLight,marginBottom:8}}>Each trainer's booking link shows in their assigned rep's Appts tab so reps can schedule directly with their trainer.</div>
      {trainers.map((t,i)=><div key={t.id} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:"8px 10px",marginBottom:6}}>
        <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:4}}>
          <input value={t.name} onChange={e=>{const u=trainers.map((tr,j)=>j===i?{...tr,name:e.target.value}:tr);updateLocal({...localData,trainers:u});}} style={{flex:1,padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,fontWeight:600}} placeholder="Trainer name"/>
          <input placeholder="PIN" maxLength={6} value={t.pin||""} onChange={e=>{const u=trainers.map((tr,j)=>j===i?{...tr,pin:e.target.value.replace(/\D/,"")}:tr);updateLocal({...localData,trainers:u});}} style={{width:65,padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,textAlign:"center",letterSpacing:"2px",color:C.text}}/>
          <button onClick={()=>updateLocal({...localData,trainers:trainers.filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer"}}>x</button>
        </div>
        <input placeholder="Booking link (optional)" value={t.bookingLink||""} onChange={e=>{const u=trainers.map((tr,j)=>j===i?{...tr,bookingLink:e.target.value}:tr);updateLocal({...localData,trainers:u});}} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,boxSizing:"border-box"}}/>
      </div>)}
      <div style={{display:"flex",gap:6,marginTop:6}}>
        <input placeholder="Name" value={nt.name} onChange={e=>setNt({...nt,name:e.target.value})} style={{flex:1,padding:"5px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
        <input placeholder="PIN" maxLength={6} value={nt.pin} onChange={e=>setNt({...nt,pin:e.target.value.replace(/\D/,"")})} style={{width:70,padding:"5px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,textAlign:"center",letterSpacing:"2px",color:C.text}}/>
        <button onClick={()=>{if(!nt.name||!nt.pin)return;updateLocal({...localData,trainers:[...trainers,{id:"trainer_"+Date.now(),name:nt.name,pin:nt.pin,bookingLink:nt.bookingLink}]});setNt({name:"",pin:"",bookingLink:""});}} style={{padding:"5px 10px",borderRadius:7,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600}}>Add</button>
      </div>
    </Card>

    {/* RVP IDs */}
    <Card style={{marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:7}}>RVP IDs</div>
      {(localData.customRVPs||[]).map((r,i)=><div key={i} style={{display:"flex",gap:6,marginBottom:5}}>
        <input placeholder="Name" value={r.name} onChange={e=>{const u=(localData.customRVPs||[]).map((rv,j)=>j===i?{...rv,name:e.target.value}:rv);updateLocal({...localData,customRVPs:u});}} style={{flex:1,padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
        <input placeholder="RVP ID" value={r.rvpId} onChange={e=>{const u=(localData.customRVPs||[]).map((rv,j)=>j===i?{...rv,rvpId:e.target.value}:rv);updateLocal({...localData,customRVPs:u});}} style={{width:90,padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
        <button onClick={()=>updateLocal({...localData,customRVPs:(localData.customRVPs||[]).filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer"}}>x</button>
      </div>)}
      <button onClick={()=>updateLocal({...localData,customRVPs:[...(localData.customRVPs||[]),{name:"",rvpId:""}]})} style={{fontSize:13,color:C.teal,background:"none",border:`1px solid ${C.teal}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",marginTop:4}}>+ Add RVP</button>
    </Card>

    {/* RVP Booking Links */}
    <Card style={{marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:4}}>RVP Booking Links</div>
      <div style={{fontSize:11,color:C.textLight,marginBottom:8}}>These show as "Meet with RVP" buttons in every rep's sidebar. Add one per RVP.</div>
      {(localData.rvpBookingLinks||[]).map((rvp,i)=><div key={i} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:8,marginBottom:6}}>
        <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:5}}>
          <input value={rvp.name||""} onChange={e=>{const u=(localData.rvpBookingLinks||[]).map((r,j)=>j===i?{...r,name:e.target.value}:r);updateLocal({...localData,rvpBookingLinks:u});}} placeholder="RVP Name" style={{flex:1,padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,fontWeight:600}}/>
          <button onClick={()=>updateLocal({...localData,rvpBookingLinks:(localData.rvpBookingLinks||[]).filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:14}}>x</button>
        </div>
        <input value={rvp.link||""} onChange={e=>{const u=(localData.rvpBookingLinks||[]).map((r,j)=>j===i?{...r,link:e.target.value}:r);updateLocal({...localData,rvpBookingLinks:u});}} placeholder="Calendly or booking link" style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,boxSizing:"border-box"}}/>
      </div>)}
      <button onClick={()=>updateLocal({...localData,rvpBookingLinks:[...(localData.rvpBookingLinks||[]),{name:"",link:""}]})} style={{width:"100%",padding:"6px",borderRadius:7,border:`1px solid ${C.teal}`,background:C.teal+"11",color:C.teal,fontSize:13,fontWeight:600,cursor:"pointer",marginTop:4}}>+ Add RVP</button>
    </Card>

    {/* Primerica Month End Dates */}
    <Card style={{marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:4}}>Primerica Month End Dates</div>
      <div style={{fontSize:12,color:C.textLight,marginBottom:8,lineHeight:1.5}}>Enter the date apps must be received by for each Primerica month.</div>
      {(localData.primerMonthEnds||[]).map((me,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:5,marginBottom:5}}>
        <input placeholder="Month (e.g. June 2026)" value={me.label} onChange={e=>{const u=(localData.primerMonthEnds||[]).map((m,j)=>j===i?{...m,label:e.target.value}:m);updateLocal({...localData,primerMonthEnds:u});}} style={{padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
        <input type="date" value={me.cutoff} onChange={e=>{const u=(localData.primerMonthEnds||[]).map((m,j)=>j===i?{...m,cutoff:e.target.value}:m);updateLocal({...localData,primerMonthEnds:u});}} style={{padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
        <button onClick={()=>updateLocal({...localData,primerMonthEnds:(localData.primerMonthEnds||[]).filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:14}}>x</button>
      </div>)}
      <button onClick={()=>updateLocal({...localData,primerMonthEnds:[...(localData.primerMonthEnds||[]),{label:"",cutoff:""}]})} style={{width:"100%",padding:"6px",borderRadius:7,border:`1px solid ${C.teal}`,background:C.teal+"11",color:C.teal,fontSize:13,fontWeight:600,cursor:"pointer",marginTop:4}}>+ Add Month End Date</button>
    </Card>

    {/* Checklist Videos */}
    <Card style={{marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:4}}>Checklist Videos</div>
      <div style={{background:C.gold+"11",border:`1px solid ${C.gold}33`,borderRadius:8,padding:"8px 10px",marginBottom:10,fontSize:12,color:"#b45309"}}>
        📹 For Google Drive: change <strong>/view</strong> to <strong>/preview</strong> in the URL before pasting.
      </div>
      {[
        ["orientationVideoUrl","Orientation Video (pops up when rep clicks 'Watch Orientation')"],
        ["welcomeVideoUrl","Welcome Video (Fast Start / Regular Start — first login)"],
        ["licensedVideoUrl","Licensed Now What Video (fires on first login as licensed)"],
        ["fieldTrainerVideoUrl","Field Trainer Video (fires on first login as field trainer)"],
        ["rvpPathVideoUrl","RVP Path Video (fires on first login to RVP path)"],
      ].map(([k,l])=><div key={k} style={{marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:3}}>{l}</div>
        <input placeholder="YouTube embed URL or Google Drive /preview URL" value={localData[k]||""} onChange={e=>updateLocal({...localData,[k]:e.target.value.trim()})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,boxSizing:"border-box"}}/>
        {localData[k]&&<div style={{fontSize:11,color:C.success,marginTop:2}}>✓ URL saved</div>}
      </div>)}
    </Card>

    {/* MoneyMap Link — the first, built-in link every rep/trainer/admin already has */}
    <div style={{border:`1px solid ${C.gold}44`,borderRadius:10,padding:12,marginBottom:14}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>MoneyMap Link</div>
      <div style={{fontSize:12,color:C.textMid,marginBottom:10,lineHeight:1.5}}>The built-in personal MoneyMap link everyone already has — this just adds guidance and message templates to it. No URL to set here, that's automatic per person.</div>
      <div style={{fontSize:11,fontWeight:700,color:C.textMid,marginBottom:3}}>Why It's Important</div>
      <textarea placeholder="Why sending this matters..." value={localData.moneyMapContent?.whyImportant||""} onChange={e=>{
        updateLocal({...localData,moneyMapContent:{...(localData.moneyMapContent||{}),whyImportant:e.target.value}});
      }} style={{width:"100%",padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box",minHeight:44,resize:"vertical",fontFamily:"inherit",marginBottom:8}}/>
      <div style={{fontSize:11,fontWeight:700,color:C.textMid,marginBottom:3}}>Who Should I Send This To?</div>
      <textarea placeholder="e.g. Anyone who's mentioned money stress, wanting to save more..." value={localData.moneyMapContent?.sendTo||""} onChange={e=>{
        updateLocal({...localData,moneyMapContent:{...(localData.moneyMapContent||{}),sendTo:e.target.value}});
      }} style={{width:"100%",padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box",minHeight:44,resize:"vertical",fontFamily:"inherit",marginBottom:8}}/>
      <div style={{fontSize:11,fontWeight:700,color:C.textMid,marginBottom:4}}>Message Stages (shown as a dropdown if you add more than one — use <code style={{background:C.surface||"#f1f5f9",padding:"1px 4px",borderRadius:4}}>[share MoneyMap link]</code> where the link should go)</div>
      {(localData.moneyMapContent?.messages||[]).map((msg,mi)=><div key={mi} style={{border:`1px solid ${C.border}`,borderRadius:7,padding:8,marginBottom:6,background:C.surface}}>
        <div style={{display:"flex",gap:5,marginBottom:5}}>
          <input placeholder="Stage label (e.g. Initial Approach A)" value={msg.label||""} onChange={e=>{
            const updatedMsgs=(localData.moneyMapContent?.messages||[]).map((m,j)=>j===mi?{...m,label:e.target.value}:m);
            updateLocal({...localData,moneyMapContent:{...(localData.moneyMapContent||{}),messages:updatedMsgs}});
          }} style={{flex:1,padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text}}/>
          <button onClick={()=>{
            const updatedMsgs=(localData.moneyMapContent?.messages||[]).filter((m,j)=>j!==mi);
            updateLocal({...localData,moneyMapContent:{...(localData.moneyMapContent||{}),messages:updatedMsgs}});
          }} style={{padding:"5px 9px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textLight,cursor:"pointer",fontSize:12}}>✕</button>
        </div>
        <textarea placeholder="Message text..." value={msg.content||""} onChange={e=>{
          const updatedMsgs=(localData.moneyMapContent?.messages||[]).map((m,j)=>j===mi?{...m,content:e.target.value}:m);
          updateLocal({...localData,moneyMapContent:{...(localData.moneyMapContent||{}),messages:updatedMsgs}});
        }} style={{width:"100%",padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,boxSizing:"border-box",minHeight:70,resize:"vertical",fontFamily:"inherit"}}/>
      </div>)}
      <button onClick={()=>{
        const updatedMsgs=[...(localData.moneyMapContent?.messages||[]),{label:"",content:""}];
        updateLocal({...localData,moneyMapContent:{...(localData.moneyMapContent||{}),messages:updatedMsgs}});
      }} style={{fontSize:13,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.teal}`,background:C.teal+"11",color:C.teal,cursor:"pointer",fontWeight:600}}>+ Add Message Stage</button>
    </div>

    {/* Rep-Shareable Links (video + survey links every rep can personalize and share) */}
    <div style={{border:`1px solid ${C.border}`,borderRadius:10,padding:12,marginBottom:14}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>Rep-Shareable Links</div>
      <div style={{fontSize:12,color:C.textMid,marginBottom:10,lineHeight:1.5}}>Links every rep can personalize and share (e.g. "How Money Works" video, recruiting video). Each rep's name — and Primerica Rep ID if they've entered one — gets inserted wherever <code style={{background:C.surface||"#f1f5f9",padding:"1px 4px",borderRadius:4}}>{"{REP}"}</code> appears in the URL below. If you leave that out, it gets added automatically as a "ref=" parameter at the end.</div>
      {(localData.repShareableLinks||[]).map((link,i)=><div key={link.id} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:10,marginBottom:8}}>
        <div style={{display:"flex",gap:6,marginBottom:6}}>
          <input placeholder="Label (e.g. How Money Works Video)" value={link.label||""} onChange={e=>{
            const updated=(localData.repShareableLinks||[]).map((l,j)=>j===i?{...l,label:e.target.value}:l);
            updateLocal({...localData,repShareableLinks:updated});
          }} style={{flex:1,padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
          <button onClick={()=>{
            if(!window.confirm("Remove this shareable link for everyone?")) return;
            updateLocal({...localData,repShareableLinks:(localData.repShareableLinks||[]).filter((l,j)=>j!==i)});
          }} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textLight,cursor:"pointer",fontSize:13}}>✕</button>
        </div>
        <input placeholder="Survey URL — include {REP} where the name/ID should go, e.g. https://form.jotform.com/xxxx?whoSentThis={REP}" value={link.templateUrl||""} onChange={e=>{
          const updated=(localData.repShareableLinks||[]).map((l,j)=>j===i?{...l,templateUrl:e.target.value.trim()}:l);
          updateLocal({...localData,repShareableLinks:updated});
        }} style={{width:"100%",padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box",marginBottom:8}}/>
        <div style={{fontSize:11,fontWeight:700,color:C.textMid,marginBottom:3}}>Who Should I Send This To?</div>
        <textarea placeholder="e.g. Someone who may be open to additional part-time income, a career change, getting licensed..." value={link.sendTo||""} onChange={e=>{
          const updated=(localData.repShareableLinks||[]).map((l,j)=>j===i?{...l,sendTo:e.target.value}:l);
          updateLocal({...localData,repShareableLinks:updated});
        }} style={{width:"100%",padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box",minHeight:44,resize:"vertical",fontFamily:"inherit",marginBottom:8}}/>
        <div style={{fontSize:11,fontWeight:700,color:C.textMid,marginBottom:4}}>Message Stages (shown as a dropdown to reps if you add more than one)</div>
        {(link.messages||[]).map((msg,mi)=><div key={mi} style={{border:`1px solid ${C.border}`,borderRadius:7,padding:8,marginBottom:6,background:C.surface}}>
          <div style={{display:"flex",gap:5,marginBottom:5}}>
            <input placeholder="Stage label (e.g. Initial Message, If They Say Yes...)" value={msg.label||""} onChange={e=>{
              const updatedMsgs=(link.messages||[]).map((m,j)=>j===mi?{...m,label:e.target.value}:m);
              const updated=(localData.repShareableLinks||[]).map((l,j)=>j===i?{...l,messages:updatedMsgs}:l);
              updateLocal({...localData,repShareableLinks:updated});
            }} style={{flex:1,padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text}}/>
            <button onClick={()=>{
              const updatedMsgs=(link.messages||[]).filter((m,j)=>j!==mi);
              const updated=(localData.repShareableLinks||[]).map((l,j)=>j===i?{...l,messages:updatedMsgs}:l);
              updateLocal({...localData,repShareableLinks:updated});
            }} style={{padding:"5px 9px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textLight,cursor:"pointer",fontSize:12}}>✕</button>
          </div>
          <textarea placeholder="Message text..." value={msg.content||""} onChange={e=>{
            const updatedMsgs=(link.messages||[]).map((m,j)=>j===mi?{...m,content:e.target.value}:m);
            const updated=(localData.repShareableLinks||[]).map((l,j)=>j===i?{...l,messages:updatedMsgs}:l);
            updateLocal({...localData,repShareableLinks:updated});
          }} style={{width:"100%",padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,boxSizing:"border-box",minHeight:70,resize:"vertical",fontFamily:"inherit"}}/>
        </div>)}
        <button onClick={()=>{
          const updatedMsgs=[...(link.messages||[]),{label:"",content:""}];
          const updated=(localData.repShareableLinks||[]).map((l,j)=>j===i?{...l,messages:updatedMsgs}:l);
          updateLocal({...localData,repShareableLinks:updated});
        }} style={{fontSize:12,padding:"5px 10px",borderRadius:6,border:`1px solid ${C.gold}`,background:C.gold+"11",color:C.gold,cursor:"pointer",fontWeight:600}}>+ Add Message Stage</button>
      </div>)}
      <button onClick={()=>{
        const updated=[...(localData.repShareableLinks||[]),{id:Date.now(),label:"",templateUrl:"",sendTo:"",messages:[]}];
        updateLocal({...localData,repShareableLinks:updated});
      }} style={{fontSize:13,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.teal}`,background:C.teal+"11",color:C.teal,cursor:"pointer",fontWeight:600}}>+ Add Link</button>
    </div>

    {/* Quick Links — simple links visible to everyone on My Lead Link, no personalization */}
    <div style={{border:`1px solid ${C.border}`,borderRadius:10,padding:12,marginBottom:14}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>Quick Links</div>
      <div style={{fontSize:12,color:C.textMid,marginBottom:10,lineHeight:1.5}}>Plain links everyone can see on their My Lead Link page — new reps, licensed reps, field trainers, and admins. Same link for everyone, no personalization.</div>
      {(localData.teamLinks||[]).map((link,i)=><div key={link.id} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:10,marginBottom:8}}>
        <div style={{display:"flex",gap:6,marginBottom:6}}>
          <input placeholder="Label (e.g. Team Facebook Group)" value={link.label||""} onChange={e=>{
            const updated=(localData.teamLinks||[]).map((l,j)=>j===i?{...l,label:e.target.value}:l);
            updateLocal({...localData,teamLinks:updated});
          }} style={{flex:1,padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
          <button onClick={()=>{
            if(!window.confirm("Remove this link for everyone?")) return;
            updateLocal({...localData,teamLinks:(localData.teamLinks||[]).filter((l,j)=>j!==i)});
          }} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textLight,cursor:"pointer",fontSize:13}}>✕</button>
        </div>
        <input placeholder="URL — e.g. https://facebook.com/groups/yourteam" value={link.url||""} onChange={e=>{
          const updated=(localData.teamLinks||[]).map((l,j)=>j===i?{...l,url:e.target.value.trim()}:l);
          updateLocal({...localData,teamLinks:updated});
        }} style={{width:"100%",padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
      </div>)}
      <button onClick={()=>{
        const updated=[...(localData.teamLinks||[]),{id:Date.now(),label:"",url:""}];
        updateLocal({...localData,teamLinks:updated});
      }} style={{fontSize:13,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.teal}`,background:C.teal+"11",color:C.teal,cursor:"pointer",fontWeight:600}}>+ Add Link</button>
    </div>

    <button onClick={saveChanges} disabled={!hasChanges} style={{width:"100%",padding:"12px",borderRadius:10,background:hasChanges?C.teal:C.textLight,color:"white",border:"none",cursor:hasChanges?"pointer":"default",fontSize:14,fontWeight:700,marginBottom:20}}>
      💾 {hasChanges?"Save All Changes":"No Changes to Save"}
    </button>
  </div>;
}

function ManageTeam({data,onUpdate,onClose}) {
  const [nt,setNt]=useState({name:"",pin:"",bookingLink:""});
  const [na,setNa]=useState({name:"",pin:""});
  const [localData,setLocalData]=useState(data);
  const [hasChanges,setHasChanges]=useState(false);
  const trainers=localData.trainers||[];
  const admins=localData.admins||[{id:"superadmin",name:"Jacqueline Jones",pin:"1234",isSuperAdmin:true,alsoRecruits:true}];
  const updateLocal=(updated)=>{setLocalData(updated);setHasChanges(true);};
  const [confirm,setConfirm]=useState(null);
  const saveChanges=()=>setConfirm({msg:"Save these changes to Manage Team?\nThis will update settings for your entire team.",onYes:()=>{
    // CRITICAL: Only save Manage Team fields — never overwrite reps array
    // Merge localData settings into the CURRENT live data to preserve any reps added while Manage Team was open
    onUpdate({...data,
      trainers:localData.trainers,
      admins:localData.admins,
      welcomeVideoUrl:localData.welcomeVideoUrl,
      licensedVideoUrl:localData.licensedVideoUrl,
      fieldTrainerVideoUrl:localData.fieldTrainerVideoUrl,
      rvpPathVideoUrl:localData.rvpPathVideoUrl,
      orientationVideoUrl:localData.orientationVideoUrl,
      customRVPs:localData.customRVPs,
      primerMonthEnds:localData.primerMonthEnds,
      rvpBookingLinks:localData.rvpBookingLinks,
      announcements:localData.announcements,
      teamBrands:localData.teamBrands,
    });
    setHasChanges(false);setConfirm(null);}});
  const handleClose=()=>hasChanges?setConfirm({msg:"You have unsaved changes. Close without saving?",onYes:()=>{setConfirm(null);onClose();}}):onClose();
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
    {confirm&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"white",borderRadius:16,padding:24,width:"100%",maxWidth:340,textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
        <div style={{fontSize:14,color:C.text,lineHeight:1.6,marginBottom:20,whiteSpace:"pre-line"}}>{confirm.msg}</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setConfirm(null)} style={{flex:1,padding:"11px",borderRadius:10,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:13,color:C.textMid,fontWeight:600}}>Cancel</button>
          <button onClick={confirm.onYes} style={{flex:1,padding:"11px",borderRadius:10,background:C.teal,border:"none",color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>Yes, Continue</button>
        </div>
      </div>
    </div>}
    <div style={{background:"white",borderRadius:16,padding:22,width:"100%",maxWidth:460,maxHeight:"80vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}><div style={{fontSize:15,fontWeight:700,color:C.text}}>Manage Team</div><button onClick={handleClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.textMid}}>x</button></div>
      {hasChanges&&<div style={{background:C.gold+"11",border:`1px solid ${C.gold}33`,borderRadius:8,padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
        <div style={{fontSize:12,color:"#b45309",fontWeight:600}}>⚠️ Unsaved changes</div>
        <button onClick={saveChanges} style={{padding:"8px 16px",borderRadius:7,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:700}}>💾 Save</button>
      </div>}
      <div style={{marginBottom:14}}><div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:7}}>Admins</div>
        {admins.map((a,i)=><div key={a.id} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:"8px 10px",marginBottom:6}}>
          <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:4}}>
            <input value={a.name} onChange={e=>{const u=admins.map((ad,j)=>j===i?{...ad,name:e.target.value}:ad);updateLocal({...localData,admins:u});}} style={{flex:1,padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,fontWeight:600}} placeholder="Admin name"/>
            {a.isSuperAdmin&&<span style={{fontSize:12,color:C.gold,whiteSpace:"nowrap"}}>Super Admin</span>}
            <input placeholder="PIN" maxLength={6} value={a.pin} onChange={e=>{const u=admins.map((ad,j)=>j===i?{...ad,pin:e.target.value.replace(/\D/,"")}:ad);updateLocal({...localData,admins:u});}} style={{width:65,padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,textAlign:"center",letterSpacing:"2px",color:C.text}}/>
            {!a.isSuperAdmin&&<button onClick={()=>updateLocal({...localData,admins:admins.filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer"}}>x</button>}
          </div>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",marginTop:4}}>
            <input type="checkbox" checked={!!a.alsoRecruits} onChange={e=>{const u=admins.map((ad,j)=>j===i?{...ad,alsoRecruits:e.target.checked}:ad);updateLocal({...localData,admins:u});}}/>
            <span style={{fontSize:13,color:C.textMid}}>Also actively recruits and trains</span>
            {a.alsoRecruits&&<span style={{fontSize:12,background:C.purple+"22",color:C.purple,padding:"1px 6px",borderRadius:4,fontWeight:600}}>Active</span>}
          </label>
          {a.alsoRecruits&&<div style={{marginTop:4,display:"flex",flexDirection:"column",gap:4}}>
            <input placeholder="Phone (for rep call/text button)" value={a.phone||""} onChange={e=>{const u=admins.map((ad,j)=>j===i?{...ad,phone:e.target.value}:ad);updateLocal({...localData,admins:u});}} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,boxSizing:"border-box"}}/>
            <input placeholder="MoneyMap link name (e.g. jackie)" value={a.linkName||""} onChange={e=>{const u=admins.map((ad,j)=>j===i?{...ad,linkName:e.target.value.toLowerCase().replace(/[^a-z0-9]/g,"")}:ad);updateLocal({...localData,admins:u});}} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,boxSizing:"border-box"}}/>
            <input placeholder="Calendar/booking link (optional)" value={a.bookingLink||""} onChange={e=>{const u=admins.map((ad,j)=>j===i?{...ad,bookingLink:e.target.value}:ad);updateLocal({...localData,admins:u});}} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,boxSizing:"border-box"}}/>
          </div>}
        </div>)}
        <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:5,marginTop:6}}><input placeholder="Admin name" value={na.name} onChange={e=>setNa({...na,name:e.target.value})} style={{padding:"5px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/><input placeholder="PIN" maxLength={6} value={na.pin} onChange={e=>setNa({...na,pin:e.target.value.replace(/\D/,"")})} style={{width:60,padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,textAlign:"center",letterSpacing:"2px",color:C.text}}/><button onClick={()=>{if(na.name&&na.pin){updateLocal({...localData,admins:[...admins,{...na,id:"admin_"+Date.now()}]});setNa({name:"",pin:""});}}} style={{padding:"5px 10px",borderRadius:6,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:13}}>Add</button></div>
      </div>
      <div><div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:7}}>Field Trainers</div>
        {trainers.map((t,i)=><div key={t.id} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:9,marginBottom:7}}><div style={{display:"flex",gap:7,alignItems:"center",marginBottom:5}}><span style={{fontSize:13,flex:1,fontWeight:600,color:C.text}}>{t.name}</span><input placeholder="PIN" maxLength={6} value={t.pin} onChange={e=>{const u=trainers.map((tr,j)=>j===i?{...tr,pin:e.target.value.replace(/\D/,"")}:tr);updateLocal({...localData,trainers:u});}} style={{width:65,padding:"3px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,textAlign:"center",letterSpacing:"2px",color:C.text}}/><button onClick={()=>updateLocal({...localData,trainers:trainers.filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer"}}>x</button></div><input placeholder="Phone (for rep call/text button)" value={t.phone||""} onChange={e=>{const u=trainers.map((tr,j)=>j===i?{...tr,phone:e.target.value}:tr);updateLocal({...localData,trainers:u});}} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,boxSizing:"border-box",marginBottom:5}}/><input placeholder="Booking link" value={t.bookingLink||""} onChange={e=>{const u=trainers.map((tr,j)=>j===i?{...tr,bookingLink:e.target.value}:tr);updateLocal({...localData,trainers:u});}} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,boxSizing:"border-box"}}/></div>)}
        <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:5,marginTop:6}}><input placeholder="Trainer name" value={nt.name} onChange={e=>setNt({...nt,name:e.target.value})} style={{padding:"5px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/><input placeholder="PIN" maxLength={6} value={nt.pin} onChange={e=>setNt({...nt,pin:e.target.value.replace(/\D/,"")})} style={{width:60,padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,textAlign:"center",letterSpacing:"2px",color:C.text}}/><button onClick={()=>{if(nt.name&&nt.pin){updateLocal({...localData,trainers:[...trainers,{...nt,id:"trainer_"+Date.now()}]});setNt({name:"",pin:"",bookingLink:""});}}} style={{padding:"5px 10px",borderRadius:6,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:13}}>Add</button></div>
      </div>

      {/* RVP IDs */}
      <div style={{marginTop:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:7}}>RVP IDs (Online Pre-Licensing)</div>
        <div style={{marginBottom:8}}>
          {[{id:"BXKX9",name:"Tellis Bolton"},{id:"519KU",name:"Jacqueline Jones"},...(data.customRVPs||[])].map((rvp,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:7,background:C.surface,marginBottom:5}}>
              <div style={{flex:1}}><span style={{fontSize:13,fontWeight:700,color:C.gold}}>{rvp.id}</span><span style={{fontSize:13,color:C.textMid,marginLeft:8}}>{rvp.name}</span></div>
              {i>=2&&<button onClick={()=>updateLocal({...localData,customRVPs:(data.customRVPs||[]).filter((_,j)=>j!==i-2)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:14}}>x</button>}
              {i<2&&<Badge color={C.teal} small>Default</Badge>}
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:5}}>
          <input placeholder="RVP ID" value={(data._newRVP||{}).id||""} onChange={e=>updateLocal({...localData,_newRVP:{...(data._newRVP||{}),id:e.target.value.toUpperCase()}})}
            style={{width:80,padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,letterSpacing:"1px",fontWeight:700}}/>
          <input placeholder="RVP Name" value={(data._newRVP||{}).name||""} onChange={e=>updateLocal({...localData,_newRVP:{...(data._newRVP||{}),name:e.target.value}})}
            style={{padding:"5px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
          <button onClick={()=>{
            const nr=data._newRVP||{};
            if(nr.id&&nr.name){updateLocal({...localData,customRVPs:[...(data.customRVPs||[]),{id:nr.id,name:nr.name}],_newRVP:{}});}
          }} style={{padding:"5px 10px",borderRadius:6,background:C.gold,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600}}>Add</button>
        </div>
      </div>


      {/* Primerica Month End Dates */}
      <div style={{marginTop:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:4}}>Primerica Month End Dates</div>
        <div style={{fontSize:12,color:C.textLight,marginBottom:8,lineHeight:1.5}}>Enter the date apps must be received by for each Primerica month. This drives commitment tracking and resets.</div>
        {(data.primerMonthEnds||[]).map((me,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:5,marginBottom:5}}>
          <input placeholder="Month (e.g. June 2026)" value={me.label} onChange={e=>{const u=(data.primerMonthEnds||[]).map((m,j)=>j===i?{...m,label:e.target.value}:m);updateLocal({...localData,primerMonthEnds:u});}} style={{padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
          <input type="date" value={me.cutoff} onChange={e=>{const u=(data.primerMonthEnds||[]).map((m,j)=>j===i?{...m,cutoff:e.target.value}:m);updateLocal({...localData,primerMonthEnds:u});}} style={{padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
          <button onClick={()=>updateLocal({...localData,primerMonthEnds:(data.primerMonthEnds||[]).filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:14}}>x</button>
        </div>)}
        <button onClick={()=>updateLocal({...localData,primerMonthEnds:[...(data.primerMonthEnds||[]),{label:"",cutoff:""}]})} style={{width:"100%",padding:"6px",borderRadius:7,border:`1px solid ${C.teal}`,background:C.teal+"11",color:C.teal,fontSize:13,fontWeight:600,cursor:"pointer",marginTop:4}}>+ Add Month End Date</button>
      </div>

      {/* RVP Booking Links — for "Meet with your RVP" button */}
      <div style={{marginTop:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:7}}>RVP Booking Links</div>
        <div style={{fontSize:12,color:C.textLight,marginBottom:8}}>These show as "Meet with your RVP" buttons for all reps. Add multiple RVPs if needed.</div>
        <div style={{marginBottom:8}}>
          {(data.rvpBookingLinks||[]).map((rvp,i)=>(
            <div key={i} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:8,marginBottom:6}}>
              <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:5}}>
                <input value={rvp.name} onChange={e=>{const u=(data.rvpBookingLinks||[]).map((r,j)=>j===i?{...r,name:e.target.value}:r);updateLocal({...localData,rvpBookingLinks:u});}} placeholder="RVP Name" style={{flex:1,padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,fontWeight:600}}/>
                <button onClick={()=>updateLocal({...localData,rvpBookingLinks:(data.rvpBookingLinks||[]).filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:14}}>x</button>
              </div>
              <input value={rvp.link} onChange={e=>{const u=(data.rvpBookingLinks||[]).map((r,j)=>j===i?{...r,link:e.target.value}:r);updateLocal({...localData,rvpBookingLinks:u});}} placeholder="Booking link (Calendly, etc.)" style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,boxSizing:"border-box"}}/>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:5}}>
          <input placeholder="New RVP name" value={(data._newRVPBooking||{}).name||""} onChange={e=>updateLocal({...localData,_newRVPBooking:{...(data._newRVPBooking||{}),name:e.target.value}})} style={{padding:"5px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
          <button onClick={()=>{
            const nrb=data._newRVPBooking||{};
            if(nrb.name){updateLocal({...localData,rvpBookingLinks:[...(data.rvpBookingLinks||[]),{name:nrb.name,link:""}],_newRVPBooking:{}});}
          }} style={{padding:"5px 10px",borderRadius:6,background:C.purple,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600}}>+ Add RVP</button>
        </div>
      </div>

      {/* Checklist Welcome Videos */}
      <div style={{marginTop:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:8}}>Checklist Videos</div>
        <div style={{fontSize:12,color:C.textLight,marginBottom:8}}>Each video plays once for a rep, right when they reach that milestone. Paste a YouTube embed URL or Google Drive link.</div>
        <div style={{background:C.gold+"11",border:`1px solid ${C.gold}33`,borderRadius:8,padding:"8px 10px",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:C.gold,marginBottom:3}}>📌 Using Google Drive?</div>
          <div style={{fontSize:12,color:C.textMid,lineHeight:1.5}}>Upload the video → Share → Get link → copy it, then change the ending from <strong>/view</strong> to <strong>/preview</strong> before pasting it below. Example: .../d/FILE_ID/<strong>preview</strong></div>
        </div>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:3}}>Orientation Video (pops up when rep clicks "Watch Orientation" on their checklist)</div>
          <input placeholder="YouTube embed URL or Google Drive /preview URL" value={data.orientationVideoUrl||""} onChange={e=>updateLocal({...localData,orientationVideoUrl:e.target.value.trim()})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
          {data.orientationVideoUrl&&<div style={{fontSize:12,color:C.success,marginTop:3}}>✓ Saved — also stays available in Resources tab</div>}
        </div>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:3}}>Welcome Video (Fast Start / Regular Start — first login)</div>
          <input placeholder="YouTube embed URL or Google Drive /preview URL" value={data.welcomeVideoUrl||""} onChange={e=>updateLocal({...localData,welcomeVideoUrl:e.target.value.trim()})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
          {data.welcomeVideoUrl&&<div style={{fontSize:12,color:C.success,marginTop:3}}>✓ Saved</div>}
        </div>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:3}}>Licensed Now What Video (shown once access granted, rewatchable in their sidebar)</div>
          <input placeholder="YouTube embed URL or Google Drive /preview URL" value={data.licensedVideoUrl||""} onChange={e=>updateLocal({...localData,licensedVideoUrl:e.target.value.trim()})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
          {data.licensedVideoUrl&&<div style={{fontSize:12,color:C.success,marginTop:3}}>✓ Saved</div>}
        </div>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:3}}>Field Trainer Video (shown once access granted, rewatchable in their sidebar)</div>
          <input placeholder="YouTube embed URL or Google Drive /preview URL" value={data.fieldTrainerVideoUrl||""} onChange={e=>updateLocal({...localData,fieldTrainerVideoUrl:e.target.value.trim()})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
          {data.fieldTrainerVideoUrl&&<div style={{fontSize:12,color:C.success,marginTop:3}}>✓ Saved</div>}
        </div>

        <div>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:3}}>RVP Path Video (shown once access granted, rewatchable in their sidebar)</div>
          <input placeholder="YouTube embed URL or Google Drive /preview URL" value={data.rvpPathVideoUrl||""} onChange={e=>updateLocal({...localData,rvpPathVideoUrl:e.target.value.trim()})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
          {data.rvpPathVideoUrl&&<div style={{fontSize:12,color:C.success,marginTop:3}}>✓ Saved</div>}
        </div>
      </div>

      {hasChanges&&<div style={{position:"sticky",bottom:0,background:"white",paddingTop:12,borderTop:`1px solid ${C.border}`,marginTop:12}}><button onClick={saveChanges} style={{width:"100%",padding:"11px",borderRadius:10,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:14,fontWeight:700}}>💾 Save All Changes</button></div>}
    </div>
  </div>;
}

// ── TRAINER PROFILE PAGE (viewed from My Reps) ──
function TrainerProfilePage({trainer,data,onUpdate,onBack}) {
  const [ciNote,setCiNote]=useState("");
  const [tab,setTab]=useState("overview");
  const isAdmin=true;
  const prod=(data.myProduction||{})[trainer.id]||{};
  const lifeApps=prod.lifeApps||[];
  const investments=prod.investments||[];
  const totPremium=lifeApps.reduce((s,a)=>s+(Number(a.premium)||0),0);
  const totPAC=investments.reduce((s,i)=>s+(Number(i.pac)||0),0);
  const totLump=investments.reduce((s,i)=>s+(Number(String(i.lumpSum||"").replace(/[$,]/g,""))||0),0);
  const activityLogs=(data.activityLogs||{})[trainer.id]||{};
  const pm=getCurrentPrimerMonth(data.primerMonthEnds||[]);
  const commitment=(trainer.commitments||{})[pm.key];
  const daysLeft=getDaysRemaining(pm.cutoff);
  const PROMO_LEVELS=[{key:"rep",label:"Rep",pct:25},{key:"sr_rep",label:"Senior Rep",pct:35},{key:"dl",label:"District Leader",pct:50},{key:"divl",label:"Division Leader",pct:60},{key:"rl",label:"Regional Leader",pct:70},{key:"srl",label:"Senior Regional Leader",pct:80},{key:"rvp",label:"RVP",pct:110}];
  const promo=PROMO_LEVELS.find(p=>p.key===(trainer.promotionLevel||"rep"))||PROMO_LEVELS[0];

  const addCI=()=>{
    if(!ciNote.trim()) return;
    const updated={...trainer,checkIns:[...(trainer.checkIns||[]),{date:new Date().toISOString(),note:ciNote}]};
    onUpdate({...data,trainers:(data.trainers||[]).map(t=>t.id===trainer.id?updated:t)});
    setCiNote("");
  };


  return <div>
    {/* Header */}
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
      <button onClick={onBack} style={{background:C.surface,border:"none",padding:"6px 10px",borderRadius:8,cursor:"pointer",fontSize:13,color:C.textMid}}>← Back</button>
      <div style={{flex:1}}>
        <div style={{fontSize:15,fontWeight:700,color:C.text}}>{trainer.name}</div>
        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:2}}>
          {trainer.phone&&<PhoneLink phone={trainer.phone}/>}
          <Badge color={C.purple} small>Field Trainer</Badge>
          <Badge color={C.gold} small>{promo.label} ({promo.pct}%)</Badge>
          {commitment?<span style={{fontSize:12,background:C.gold+"22",color:"#b45309",padding:"2px 7px",borderRadius:5,fontWeight:700}}>{commitment.tierEmoji} {commitment.tierLabel} · {pm.label}</span>:<span style={{fontSize:12,color:C.gold,fontWeight:600}}>⏳ No commitment set for {pm.label}</span>}
        </div>
      </div>
    </div>

    {/* Tabs */}
    <div style={{display:"flex",gap:4,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
      {[["overview","Overview"],["production","Production"],["checkins","Check-ins"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:"5px 11px",borderRadius:7,border:"none",cursor:"pointer",fontSize:12,fontWeight:tab===k?700:400,background:tab===k?C.navy:"transparent",color:tab===k?"white":C.textMid,whiteSpace:"nowrap"}}>{l}</button>)}
    </div>

    {/* OVERVIEW TAB */}
    {tab==="overview"&&<div>
      {/* Commitment Card */}
      {commitment?<CommitmentCard rep={trainer} primerMonth={pm} canUnlock={true} recruitsOverride={countPeriodRecruits(data,trainer.id,pm.start)} premiumOverride={(data.myProduction||{})[trainer.id]?.lifeApps?.filter(a=>a.date&&a.date>=pm.start&&(!a.cod||a.codAccepted)).reduce((s,a)=>s+(Number(a.premium)||0)*12,0)||0} onUnlock={()=>{
        const updated={...trainer,commitments:{...(trainer.commitments||{}),[pm.key]:undefined}};
        onUpdate({...data,trainers:(data.trainers||[]).map(t=>t.id===trainer.id?updated:t)});
      }}/>:<Card style={{marginBottom:12,border:`1px solid ${C.gold}33`,background:C.gold+"06"}}>
        <div style={{fontSize:12,fontWeight:700,color:C.gold,marginBottom:4}}>⏳ No Commitment Set — {pm.label}</div>
        <div style={{fontSize:11,color:C.textMid}}>{trainer.name} hasn't set their monthly commitment yet. {daysLeft} days remaining in this Primerica month.</div>
      </Card>}

      {/* Production Summary */}
      <Card style={{marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>Production Summary</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
          {[[lifeApps.length,"Life Apps",C.teal],[`$${totPremium.toFixed(0)}/mo`,"Premium",C.gold],[investments.length,"Investments",C.purple]].map(([v,l,c])=><div key={l} style={{background:c+"11",borderRadius:8,padding:"7px 8px",textAlign:"center"}}><div style={{fontSize:15,fontWeight:700,color:c}}>{v}</div><div style={{fontSize:9,color:C.textMid}}>{l}</div></div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:6}}>
          <div style={{background:C.teal+"08",borderRadius:8,padding:"7px 8px",textAlign:"center"}}><div style={{fontSize:13,fontWeight:700,color:C.teal}}>${totPAC.toLocaleString()}/mo</div><div style={{fontSize:9,color:C.textMid}}>PAC Total</div></div>
          <div style={{background:C.purple+"08",borderRadius:8,padding:"7px 8px",textAlign:"center"}}><div style={{fontSize:13,fontWeight:700,color:C.purple}}>${totLump.toLocaleString()}</div><div style={{fontSize:9,color:C.textMid}}>Lump Sum</div></div>
        </div>
      </Card>

      {/* Activity Last 7 Days */}
      <Card style={{marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>Activity Last 7 Days</div>
        <div style={{display:"flex",gap:4}}>
          {[...Array(7)].map((_,i)=>{
            const d=new Date(); d.setDate(d.getDate()-(6-i));
            const key=d.toISOString().split("T")[0];
            const log=activityLogs[key];
            const isToday=i===6;
            return <div key={i} style={{flex:1,textAlign:"center",padding:"6px 2px",borderRadius:6,background:log?.submittedAt?C.success+"22":"rgba(0,0,0,0.04)",border:isToday?`2px solid ${C.teal}`:"1px solid transparent"}}>
              <div style={{fontSize:11,fontWeight:700,color:log?.submittedAt?C.success:C.textLight}}>{log?.talked||0}</div>
              <div style={{fontSize:9,color:C.textLight}}>{d.toLocaleDateString("en-US",{weekday:"short"})}</div>
            </div>;
          })}
        </div>
      </Card>

      {/* Recruits This Month */}
      {(()=>{
        const pm4=getCurrentPrimerMonth(data.primerMonthEnds||[]);
        const allAssigned=(data.reps||[]).filter(r=>r.trainerId===trainer.id);
        const thisMonthRecruits=allAssigned.filter(r=>r.createdAt&&new Date(r.createdAt).toISOString().split("T")[0]>=pm4.start);
        return <Card style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:700,color:C.text}}>Recruits This Month ({pm4.label})</div>
            <Badge color={C.success} small>{thisMonthRecruits.length} recruit{thisMonthRecruits.length!==1?"s":""}</Badge>
          </div>
          {thisMonthRecruits.length===0
            ?<div style={{fontSize:11,color:C.textLight}}>No recruits added this Primerica month yet</div>
            :thisMonthRecruits.map((r,i)=>{
              const tr=TRACK_INFO[r.track];
              return <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                <div style={{width:24,height:24,borderRadius:6,background:(tr?.color||C.teal)+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:tr?.color||C.teal}}>{r.name?.charAt(0)}</div>
                <div style={{flex:1}}>
                  <div style={{color:C.text,fontWeight:600}}>{r.name}</div>
                  <div style={{fontSize:10,color:C.textMid}}>{r.startDate?new Date(r.startDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}):"No date"}</div>
                </div>
                <Badge color={tr?.color||C.teal} small>{tr?.label||"No track"}</Badge>
              </div>;
            })
          }
          {allAssigned.length>thisMonthRecruits.length&&<div style={{fontSize:10,color:C.textLight,marginTop:6}}>{allAssigned.length-thisMonthRecruits.length} more rep{allAssigned.length-thisMonthRecruits.length!==1?"s":""} from previous months</div>}
        </Card>;
      })()}

      {/* Reps they're training */}
      <Card>
        <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>Reps Assigned to {trainer.name}</div>
        {(data.reps||[]).filter(r=>r.trainerId===trainer.id).length===0?<div style={{fontSize:11,color:C.textLight}}>No reps assigned yet</div>:
        (data.reps||[]).filter(r=>r.trainerId===trainer.id).map((r,i)=>{
          const tr=TRACK_INFO[r.track];
          return <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
            <div style={{width:24,height:24,borderRadius:6,background:(tr?.color||C.teal)+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:tr?.color||C.teal}}>{r.name?.charAt(0)}</div>
            <div style={{flex:1,color:C.text,fontWeight:600}}>{r.name}</div>
            <Badge color={tr?.color||C.teal} small>{tr?.label||"No track"}</Badge>
          </div>;
        })}
      </Card>
    </div>}

    {/* PRODUCTION TAB */}
    {tab==="production"&&<div>
      <Card style={{marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>Life Apps</div>
        {lifeApps.length===0?<div style={{fontSize:11,color:C.textLight}}>No life apps logged yet</div>:
        lifeApps.slice().reverse().map((a,i)=><div key={i} style={{padding:"5px 0",borderBottom:`1px solid ${C.border}`,fontSize:12,display:"flex",justifyContent:"space-between"}}>
          <span style={{color:C.text,fontWeight:600}}>{a.clientName}</span>
          <span style={{color:C.teal}}>${a.premium}/mo</span>
        </div>)}
      </Card>
      <Card>
        <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>Investments</div>
        {investments.length===0?<div style={{fontSize:11,color:C.textLight}}>No investments logged yet</div>:
        investments.map((inv,i)=><div key={i} style={{padding:"5px 0",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
          <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:C.text,fontWeight:600}}>{inv.clientName}</span><Badge color={C.teal} small>{inv.type}</Badge></div>
          <div style={{color:C.textMid,fontSize:11}}>{inv.pac&&`PAC: $${inv.pac}/mo`}{inv.pac&&inv.lumpSum&&" · "}{inv.lumpSum&&`Lump: $${inv.lumpSum}`}</div>
        </div>)}
      </Card>
    </div>}



    {/* CHECK-INS TAB */}
    {tab==="checkins"&&<div>
      <Card style={{marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>Add Coaching Note</div>
        <textarea value={ciNote} onChange={e=>setCiNote(e.target.value)} placeholder="Note for this coaching session..." rows={3} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,resize:"vertical",boxSizing:"border-box",marginBottom:8}}/>
        <button onClick={addCI} disabled={!ciNote.trim()} style={{width:"100%",padding:"8px",borderRadius:8,background:ciNote.trim()?C.teal:C.textLight,color:"white",border:"none",cursor:ciNote.trim()?"pointer":"default",fontSize:12,fontWeight:700}}>Save Note</button>
      </Card>
      {(trainer.checkIns||[]).length===0?<div style={{textAlign:"center",padding:20,color:C.textLight,fontSize:12}}>No check-in notes yet</div>:
      [...(trainer.checkIns||[])].reverse().map((ci,i)=><Card key={i} style={{marginBottom:8}}>
        <div style={{fontSize:10,color:C.textLight,marginBottom:4}}>{new Date(ci.date).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
        <div style={{fontSize:12,color:C.text,lineHeight:1.5}}>{ci.note}</div>
      </Card>)}
    </div>}
  </div>;
}

// ── MY RECRUITS THIS MONTH (admin/trainer, own scope only, auto-clears each Primer month) ──
// ── INLINE ADD RECRUIT (minimal, just the add form — no duplicate count/list) ──
function InlineAddRecruit({person,onSave}) {
  const [showForm,setShowForm] = useState(false);
  const [form,setForm] = useState({name:"",phone:"",date:localDateStr()});
  const log = person?.myRecruitLog||[];
  const add = () => {
    if(!form.name.trim()) return;
    onSave([...log,{...form,id:Date.now(),addedAt:new Date().toISOString()}]);
    setForm({name:"",phone:"",date:localDateStr()});
    setShowForm(false);
  };
  if(!showForm) return <button onClick={()=>setShowForm(true)} style={{fontSize:12,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.teal}`,background:C.teal+"11",color:C.teal,cursor:"pointer",fontWeight:600,marginBottom:10}}>+ Add Recruit</button>;
  return <div style={{border:`1px solid ${C.border}`,borderRadius:8,padding:10,marginBottom:10}}>
    <div style={{fontSize:12,color:C.textMid,marginBottom:6}}>Don't see someone you recruited? Add them here so the list stays accurate.</div>
    <input placeholder="Recruit's name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={{width:"100%",padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,marginBottom:6,boxSizing:"border-box"}}/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
      <input placeholder="Phone (optional)" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} style={{padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13}}/>
      <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={{padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13}}/>
    </div>
    <div style={{display:"flex",gap:6}}>
      <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"6px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:12,color:C.textMid}}>Cancel</button>
      <button onClick={add} style={{flex:2,padding:"6px",borderRadius:6,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:12,fontWeight:600}}>Save Recruit</button>
    </div>
  </div>;
}

function MyRecruitsThisMonth({data,userId,userRole,onUpdate}) {
  const pm = getCurrentPrimerMonth(data.primerMonthEnds||[]);
  const [showList,setShowList] = useState(false);
  const [viewingLastMonth,setViewingLastMonth] = useState(false);
  const isMine = r => (r.adminId===userId || r.trainerId===userId) && !r.excludeFromRecruitCount;
  const person = findPersonRecord(data,userId);
  const saveRecruitLog = (log) => {
    if(typeof onUpdate!=="function") return;
    if((data.trainers||[]).some(t=>t.id===userId)){
      const updated=(data.trainers||[]).map(t=>t.id===userId?{...t,myRecruitLog:log}:t);
      onUpdate({...data,trainers:updated});
    } else if((data.admins||[]).some(a=>a.id===userId)){
      const updated=(data.admins||[]).map(a=>a.id===userId?{...a,myRecruitLog:log}:a);
      onUpdate({...data,admins:updated});
    }
  };

  const getRecruitsForPeriod = (periodStart,periodEnd) => {
    const realAccounts = (data.reps||[]).filter(r=>{
      if(!isMine(r)||!r.createdAt) return false;
      let d; try{ d=localDateStr(new Date(r.createdAt)); }catch(e){ return false; }
      return d>=periodStart && (!periodEnd||d<periodEnd);
    }).map(r=>({name:r.name,phone:r.phone,date:localDateStr(new Date(r.createdAt)),type:"account"}));
    const person = findPersonRecord(data,userId);
    const realNames = new Set((data.reps||[]).filter(isMine).map(r=>(r.name||"").trim().toLowerCase()));
    const logged = ((person?.myRecruitLog)||[]).filter(r=>{
      if(!r.date||r.date<periodStart) return false;
      if(periodEnd&&r.date>=periodEnd) return false;
      return !realNames.has((r.name||"").trim().toLowerCase());
    }).map(r=>({name:r.name,phone:r.phone,date:r.date,type:"logged"}));
    return [...realAccounts,...logged].sort((a,b)=>b.date.localeCompare(a.date));
  };

  const thisMonthList = getRecruitsForPeriod(pm.start,null);

  const sortedCutoffs = [...(data.primerMonthEnds||[])].filter(m=>m.cutoff&&m.label).sort((a,b)=>a.cutoff.localeCompare(b.cutoff));
  const curStartIdx = sortedCutoffs.findIndex(m=>m.cutoff===pm.start);
  const lastMonthDef = curStartIdx>=0?sortedCutoffs[curStartIdx]:null;
  const lastMonthStart = curStartIdx>0?sortedCutoffs[curStartIdx-1].cutoff:"2020-01-01";
  const lastMonthList = lastMonthDef?getRecruitsForPeriod(lastMonthStart,lastMonthDef.cutoff):[];

  const displayList = viewingLastMonth?lastMonthList:thisMonthList;

  return <Card style={{marginBottom:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text}}>My Recruits — {viewingLastMonth?(lastMonthDef?.label||"Last Month"):pm.label}</div>
      <div style={{fontSize:20,fontWeight:800,color:C.teal}}>{displayList.length}</div>
    </div>
    <div style={{fontSize:12,color:C.textMid,marginBottom:10}}>Only recruits you personally added — resets automatically each new Primerica month</div>
    <div style={{display:"flex",gap:6,marginBottom:10}}>
      <button onClick={()=>setShowList(!showList)} style={{fontSize:12,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textMid,cursor:"pointer",fontWeight:600}}>{showList?"Hide List":"View List"}</button>
      {lastMonthDef&&<button onClick={()=>{setViewingLastMonth(!viewingLastMonth);setShowList(true);}} style={{fontSize:12,padding:"4px 10px",borderRadius:6,border:`1px solid ${viewingLastMonth?C.teal:C.border}`,background:viewingLastMonth?C.teal+"11":"white",color:viewingLastMonth?C.teal:C.textMid,cursor:"pointer",fontWeight:600}}>{viewingLastMonth?"Viewing Last Month":"View Last Month"}</button>}
    </div>
    {!viewingLastMonth&&onUpdate&&<InlineAddRecruit person={person} onSave={saveRecruitLog}/>}
    {showList&&(displayList.length===0?
      <div style={{fontSize:13,color:C.textLight,textAlign:"center",padding:"10px 0"}}>No recruits {viewingLastMonth?"last month":"yet this month"}</div>
      :
      displayList.map((r,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderTop:i>0?`1px solid ${C.border}`:"none"}}>
        <div style={{width:26,height:26,borderRadius:7,background:C.teal+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:C.teal,flexShrink:0}}>{r.name?.charAt(0)?.toUpperCase()}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text}}>{r.name}</div>
          <div style={{fontSize:11,color:C.textLight}}>{r.phone||"No phone"} · {new Date(r.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
        </div>
        <span style={{fontSize:10,fontWeight:700,color:r.type==="account"?C.success:C.gold,background:(r.type==="account"?C.success:C.gold)+"11",padding:"2px 7px",borderRadius:5}}>{r.type==="account"?"Account":"Logged"}</span>
      </div>)
    )}
    {showList&&<div style={{fontSize:11,color:C.textLight,marginTop:10,paddingTop:8,borderTop:`1px solid ${C.border}`,lineHeight:1.6}}>
      <span style={{fontWeight:700,color:C.success}}>Account</span> = they have a full rep record in the Hub (login, checklist, everything). <span style={{fontWeight:700,color:C.gold}}>Logged</span> = you noted them as a recruit but haven't created their account yet — once you do, it switches to Account automatically.
    </div>}
  </Card>;
}

function MyRepsPage({data,onUpdate,userRole,userId,onSelectRep}) {
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("all");
  const [showAdd,setShowAdd]=useState(false);
  const [showInactive,setShowInactive]=useState(false);
  const [selectedTrainer,setSelectedTrainer]=useState(null);
  const [myRepsOnly,setMyRepsOnly]=useState(false);
  const isAdmin=userRole==="admin"||userRole==="superadmin";
  const isSuperAdmin=userRole==="superadmin";
  const allReps=data.reps||[];
  const activeR=allReps.filter(r=>!r.inactive&&(userRole==="trainer"?r.trainerId===userId:true));
  const inactiveR=allReps.filter(r=>r.inactive&&(userRole==="trainer"?r.trainerId===userId:true));
  const displayR=showInactive?inactiveR:activeR;
  const filtered=displayR.filter(r=>{
    if(myRepsOnly&&r.adminId!==userId) return false;
    return (r.name.toLowerCase().includes(search.toLowerCase())||r.phone?.includes(search))&&(filter==="all"||r.track===filter);
  });
  const addRep=f=>onUpdate({...data,reps:[...allReps,{...f,id:"rep_"+Date.now(),checked:{},trainerChecked:{},appointments:[],references:[],checkIns:[],repPin:null,createdAt:Date.now()}]});
  const trainers=data.trainers||[];
  // Include trainers in search if admin and search is active
  const filteredTrainers=isAdmin&&!showInactive&&search?trainers.filter(t=>t.name.toLowerCase().includes(search.toLowerCase())):[];
  
  // Trainer profile view
  if(selectedTrainer) return <TrainerProfilePage trainer={selectedTrainer} data={data} onUpdate={onUpdate} onBack={()=>setSelectedTrainer(null)}/>;

  const restoreRep=(id)=>onUpdate({...data,reps:allReps.map(r=>r.id===id?{...r,inactive:false}:r)});
  const deleteRep=(id,name)=>{
    if(!window.confirm("PERMANENTLY DELETE "+name+"? This cannot be undone.")) return;
    if(!window.confirm("Are you absolutely sure?")) return;
    onUpdate({...data,reps:allReps.filter(r=>r.id!==id)});
  };

  return <div>
    {(isAdmin||userRole==="trainer")&&!showInactive&&<MyRecruitsThisMonth data={data} userId={userId} userRole={userRole} onUpdate={onUpdate}/>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text}}>My Reps {showInactive&&<span style={{fontSize:13,color:C.danger,fontWeight:400}}>(Inactive)</span>}</div>
      <div style={{display:"flex",gap:6}}>
        {isAdmin&&!showInactive&&<button onClick={()=>setMyRepsOnly(m=>!m)} style={{fontSize:12,padding:"4px 9px",borderRadius:6,border:`1px solid ${myRepsOnly?C.gold:C.border}`,background:myRepsOnly?C.gold+"11":"white",cursor:"pointer",color:myRepsOnly?C.gold:C.textMid,fontWeight:600}}>{myRepsOnly?"My Reps Only ✓":"My Reps Only"}</button>}
        {inactiveR.length>0&&<button onClick={()=>setShowInactive(!showInactive)} style={{fontSize:12,padding:"4px 9px",borderRadius:6,border:"1px solid "+(showInactive?C.danger:C.border),background:showInactive?C.danger+"11":"white",cursor:"pointer",color:showInactive?C.danger:C.textMid,fontWeight:600}}>{showInactive?"View Active":"Inactive ("+inactiveR.length+")"}</button>}
        
        {isAdmin&&!showInactive&&<button onClick={()=>setShowAdd(true)} style={{fontSize:13,padding:"5px 12px",borderRadius:8,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>+ Add Rep</button>}
      </div>
    </div>
    <div style={{display:"flex",gap:7,marginBottom:10,flexWrap:"wrap"}}>
      <input placeholder="Search reps..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,minWidth:140,padding:"7px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
      {["all","fast","regular","licensed"].map(f=><button key={f} onClick={()=>setFilter(f)} style={{padding:"5px 9px",borderRadius:7,border:"none",cursor:"pointer",fontSize:13,fontWeight:filter===f?600:400,background:filter===f?C.navy:C.surface,color:filter===f?"white":C.textMid,whiteSpace:"nowrap"}}>{f==="all"?"All":f==="fast"?"Fast Start":f==="regular"?"Regular Start":f==="licensed"?"Licensed Now What":f}</button>)}
    </div>
    {filteredTrainers.length>0&&<div style={{marginBottom:8}}>
      <div style={{fontSize:11,fontWeight:700,color:C.textMid,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.5px"}}>Field Trainers</div>
      {filteredTrainers.map(t=><div key={t.id} onClick={()=>setSelectedTrainer(t)} style={{borderRadius:10,background:"white",border:`1px solid ${C.purple}44`,marginBottom:6,overflow:"hidden",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px"}}>
          <div style={{width:32,height:32,borderRadius:8,background:C.purple+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:C.purple,flexShrink:0}}>{t.name?.charAt(0)?.toUpperCase()}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:C.text}}>{t.name}</div>
            <div style={{fontSize:11,color:C.textMid}}>Field Trainer · {t.phone||"No phone"}</div>
          </div>
          <Badge color={C.purple} small>Trainer</Badge>
          <div style={{fontSize:13,color:C.textLight}}>›</div>
        </div>
      </div>)}
      {filtered.length>0&&<div style={{fontSize:11,fontWeight:700,color:C.textMid,marginTop:8,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.5px"}}>Reps</div>}
    </div>}
    {filtered.length===0&&filteredTrainers.length===0&&<div style={{textAlign:"center",padding:"24px",color:C.textLight,fontSize:13}}>No reps found</div>}
    {filtered.map(r=>{
      const track=TRACK_INFO[r.track];
      const cl=TRACK_TO_CHECKLIST_KEY[r.track]?getChecklistItems(data,TRACK_TO_CHECKLIST_KEY[r.track]):[];
      const done=cl.filter(i=>(r.checked||{})[i.id]).length;
      const pct=cl.length>0?Math.round((done/cl.length)*100):0;
      return <div key={r.id} style={{borderRadius:10,background:"white",border:`1px solid ${showInactive?C.danger+"33":C.border}`,marginBottom:7,overflow:"hidden"}}>
        <div onClick={()=>!showInactive&&onSelectRep(r.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:showInactive?"default":"pointer"}}>
          <div style={{width:32,height:32,borderRadius:8,background:(track?.color||C.teal)+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:track?.color||C.teal,flexShrink:0}}>{r.name?.charAt(0)?.toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:dv(13,16),fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
            <div style={{fontSize:12,color:C.textMid}}>{track?.label||r.track}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:1}}>
              <span style={{fontSize:12,color:C.textMid}}>Trainer: <strong style={{color:([...(data.trainers||[]),...(data.admins||[])]).find(t=>t.id===r.trainerId)?C.teal:C.textLight}}>{([...(data.trainers||[]),...(data.admins||[])]).find(t=>t.id===r.trainerId)?.name||"Not assigned"}</strong></span>
              <span style={{fontSize:12,color:C.textMid}}>Rec: <strong style={{color:findPerson(r.recruitedBy,data)?C.purple:C.textLight}}>{findPerson(r.recruitedBy,data)?.name||"Not specified"}</strong></span>
            </div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:13,fontWeight:700,color:track?.color||C.teal}}>{pct}%</div>
            <div style={{fontSize:12,color:C.textLight}}>{done}/{cl.length}</div>
          </div>
          {!showInactive&&<div style={{fontSize:13,color:C.textLight}}>›</div>}
        </div>
        {showInactive&&isAdmin&&<div style={{display:"flex",gap:6,padding:"8px 12px",borderTop:`1px solid ${C.danger}22`,background:C.danger+"05"}}>
          <button onClick={()=>restoreRep(r.id)} style={{flex:1,padding:"6px",borderRadius:7,border:"none",background:C.success,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Restore</button>
          <button onClick={()=>deleteRep(r.id,r.name)} style={{flex:1,padding:"6px",borderRadius:7,border:"none",background:C.danger,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Delete Forever</button>
        </div>}
      </div>;
    })}
    {showAdd&&<AddRep onAdd={f=>{addRep(f);setShowAdd(false);}} onClose={()=>setShowAdd(false)} trainers={trainers} allPeople={[(data.admins||[]).map(a=>({...a,role:"Admin"})),trainers.map(t=>({...t,role:"Trainer"})),(data.reps||[]).map(r=>({...r,role:"Rep"}))].flat()}/>}
  </div>;
}

// ── DASHBOARD ──
// ── LINK SHARING ACTIVITY (admin-only, tracks link-share adoption across the team) ──
function LinkSharingActivity({data}) {
  const [view,setView] = useState("byLink");
  const [period,setPeriod] = useState("week");
  const [expandedLink,setExpandedLink] = useState(null);

  const periodStart = period==="week" ? localDateStr(new Date(Date.now()-6*86400000)) : period==="month" ? localDateStr(new Date(Date.now()-29*86400000)) : null;

  const roster = [
    ...(data.reps||[]).filter(r=>!r.inactive).map(r=>({id:r.id,name:r.name,role:"Rep"})),
    ...(data.trainers||[]).map(t=>({id:t.id,name:t.name,role:"Trainer"})),
    ...(data.admins||[]).map(a=>({id:a.id,name:a.name,role:"Admin"})),
  ];

  const shares = [];
  const collect = (arr,role) => (arr||[]).forEach(p=>{
    (p.linkShareLog||[]).forEach(s=>{
      if(!periodStart||s.date>=periodStart) shares.push({personId:p.id,personName:p.name,role,linkLabel:s.linkLabel||"Link",date:s.date});
    });
  });
  collect(data.reps,"Rep"); collect(data.trainers,"Trainer"); collect(data.admins,"Admin");

  // By Person — everyone on the roster, zeros included, sorted lowest first
  const personCounts = roster.map(p=>({...p,count:shares.filter(s=>s.personId===p.id).length})).filter(p=>p.count>0).sort((a,b)=>b.count-a.count);

  // By Link — every configured link, zeros included, sorted highest first
  const configuredLinks=["My Lead Link",...(data.repShareableLinks||[]).map(l=>l.label||"Shareable Link"),...(data.teamLinks||[]).map(l=>l.label||"Link")];
  const linkTotals={};
  shares.forEach(s=>{ linkTotals[s.linkLabel]=(linkTotals[s.linkLabel]||0)+1; });
  const linkList=[...new Set(configuredLinks)].map(label=>({label,count:linkTotals[label]||0})).sort((a,b)=>b.count-a.count);
  const maxCount=Math.max(1,...linkList.map(l=>l.count));

  const getBreakdownForLink=(label)=>{
    const counts={};
    shares.filter(s=>s.linkLabel===label).forEach(s=>{ counts[s.personId]=(counts[s.personId]||0)+1; });
    return Object.keys(counts).map(id=>{
      const p=roster.find(r=>r.id===id);
      return {name:p?.name||"Unknown",count:counts[id]};
    }).sort((a,b)=>b.count-a.count);
  };

  return <Card style={{marginBottom:14}}>
    <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:2}}>Link Sharing Activity</div>
    <div style={{fontSize:12,color:C.textMid,marginBottom:12}}>{view==="byLink"?"Tap any link to see who's sharing it":"See who's actually sharing links"}</div>
    <div style={{display:"flex",gap:6,marginBottom:12}}>
      <button onClick={()=>{setView("byPerson");setExpandedLink(null);}} style={{fontSize:12,padding:"5px 12px",borderRadius:7,border:`1px solid ${view==="byPerson"?C.teal:C.border}`,background:view==="byPerson"?C.teal+"11":"white",color:view==="byPerson"?C.teal:C.textMid,cursor:"pointer",fontWeight:600}}>By Person</button>
      <button onClick={()=>setView("byLink")} style={{fontSize:12,padding:"5px 12px",borderRadius:7,border:`1px solid ${view==="byLink"?C.teal:C.border}`,background:view==="byLink"?C.teal+"11":"white",color:view==="byLink"?C.teal:C.textMid,cursor:"pointer",fontWeight:600}}>By Link</button>
    </div>
    <div style={{display:"flex",gap:5,marginBottom:14}}>
      {[["week","This Week"],["month","This Month"],["all","All Time"]].map(([k,l])=>
        <button key={k} onClick={()=>setPeriod(k)} style={{fontSize:11,padding:"3px 9px",borderRadius:6,border:`1px solid ${period===k?C.navy:C.border}`,background:period===k?C.navy:"white",color:period===k?"white":C.textMid,cursor:"pointer"}}>{l}</button>
      )}
    </div>

    {view==="byPerson"&&(personCounts.length===0?
      <div style={{fontSize:13,color:C.textLight,textAlign:"center",padding:"10px 0"}}>No one has shared a link yet</div>
      :
      personCounts.map((p,i)=><div key={p.id} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderTop:i>0?`1px solid ${C.border}`:"none"}}>
        <div style={{width:28,height:28,borderRadius:7,background:C.teal+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:C.teal,flexShrink:0}}>{p.name?.charAt(0)?.toUpperCase()}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text}}>{p.name}</div>
          <div style={{fontSize:10,color:C.textLight}}>{p.role}</div>
        </div>
        <span style={{fontSize:16,fontWeight:800,color:C.success}}>{p.count}</span>
      </div>)
    )}

    {view==="byLink"&&linkList.map((l,i)=><div key={l.label} style={{borderTop:i>0?`1px solid ${C.border}`:"none",padding:"10px 0"}}>
      <div onClick={()=>setExpandedLink(expandedLink===l.label?null:l.label)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:10,color:C.textLight,transform:expandedLink===l.label?"rotate(90deg)":"none",display:"inline-block"}}>▶</span>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>{l.label}</span>
        </div>
        <span style={{fontSize:16,fontWeight:800,color:C.teal}}>{l.count}</span>
      </div>
      <div style={{height:5,background:C.surface,borderRadius:3,overflow:"hidden",marginTop:6}}>
        <div style={{height:"100%",width:(l.count/maxCount*100)+"%",background:l.count===0?C.border:C.teal,borderRadius:3}}/>
      </div>
      {expandedLink===l.label&&<div style={{marginTop:10,background:C.surface,borderRadius:8,padding:"10px 12px"}}>
        <div style={{fontSize:10,fontWeight:700,color:C.textLight,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:8}}>Shared By</div>
        {getBreakdownForLink(l.label).length===0?
          <div style={{fontSize:12,color:C.textLight}}>No one has shared this yet</div>
          :
          getBreakdownForLink(l.label).map((p,j)=><div key={j} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0"}}>
            <div style={{width:22,height:22,borderRadius:6,background:C.teal+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:C.teal,flexShrink:0}}>{p.name?.charAt(0)?.toUpperCase()}</div>
            <div style={{flex:1,fontSize:12,fontWeight:600,color:C.text}}>{p.name}</div>
            <div style={{fontSize:13,fontWeight:700,color:C.teal}}>{p.count}</div>
          </div>)
        }
      </div>}
    </div>)}
  </Card>;
}

const TEAM_NUMBER_CATS = [
  {key:"calls",label:"Calls",manual:true},
  {key:"contacts",label:"Contacts",manual:true},
  {key:"apptSet",label:"Appts Set",manual:true},
  {key:"apptDone",label:"Appts Done",manual:true},
  {key:"recruits",label:"Recruits",manual:false},
  {key:"lifeApps",label:"Life Apps",manual:false},
  {key:"premium",label:"Premium",manual:false,isMoney:true},
  {key:"pacInvestment",label:"PAC",manual:false,isMoney:true},
  {key:"lumpInvestment",label:"Lump Sum",manual:false,isMoney:true},
  {key:"linksShared",label:"Links Shared",manual:false},
];

// Sums a rep's activity across a date range (inclusive). Manual categories live in daily
// scorecard buckets (iterated day by day); auto categories are summed directly from their
// source data, filtered by date — no need to walk day by day for those.
function sumRepMetricsForRange(data,repId,startDate,endDate){
  const result={}; TEAM_NUMBER_CATS.forEach(c=>result[c.key]=0);
  const repScores=(data.scorecards||{})[repId]||{};
  let d=new Date(startDate+"T12:00:00");
  const end=new Date(endDate+"T12:00:00");
  let guard=0;
  while(d<=end&&guard<400){
    const dStr=localDateStr(d);
    const wk=getWeekStart(d);
    const dayEntry=(repScores[wk]?.days||{})[dStr];
    if(dayEntry){
      TEAM_NUMBER_CATS.forEach(c=>{ if(c.manual) result[c.key]+=Number(dayEntry.actual?.[c.key])||0; });
    }
    d.setDate(d.getDate()+1);
    guard++;
  }
  const myProd=(data.myProduction||{})[repId]||{};
  const person=findPersonRecord(data,repId);
  const combinedLifeApps=[...(myProd.lifeApps||[]),...(person?.selfPremium||[])];
  const lifeAppsArr=combinedLifeApps.filter(a=>a.date&&a.date>=startDate&&a.date<=endDate&&(!a.cod||a.codAccepted));
  result.lifeApps=lifeAppsArr.length;
  result.premium=lifeAppsArr.reduce((s,a)=>s+(Number(a.premium)||0),0);
  const parseLump=v=>Number(String(v||"").replace(/[$,]/g,""))||0;
  const investmentsArr=[...(myProd.investments||[]),...(person?.investments||[])].filter(i=>i.date&&i.date>=startDate&&i.date<=endDate);
  result.pacInvestment=investmentsArr.reduce((s,i)=>s+(Number(i.pac)||0),0);
  result.lumpInvestment=investmentsArr.reduce((s,i)=>s+parseLump(i.lumpSum),0);
  const realNames=new Set((data.reps||[]).filter(r=>r.trainerId===repId).map(r=>(r.name||"").trim().toLowerCase()));
  const loggedRecruits=((person?.myRecruitLog)||[]).filter(r=>r.date&&r.date>=startDate&&r.date<=endDate&&!realNames.has((r.name||"").trim().toLowerCase())).length;
  const realRecruits=(data.reps||[]).filter(r=>{
    if(r.trainerId!==repId||!r.createdAt) return false;
    let dd; try{ dd=localDateStr(new Date(r.createdAt)); }catch(e){ return false; }
    return dd>=startDate&&dd<=endDate;
  }).length;
  result.recruits=realRecruits+loggedRecruits;
  result.linksShared=((person?.linkShareLog)||[]).filter(s=>s.date&&s.date>=startDate&&s.date<=endDate).length;
  return result;
}

function TeamNumbersCard({data,userId}) {
  const [scope,setScope]=useState("everyone");
  const [range,setRange]=useState("week");
  const [expanded,setExpanded]=useState(false);
  const [search,setSearch]=useState("");
  const [sortKey,setSortKey]=useState(null);
  const [sortDir,setSortDir]=useState("desc");

  const today=localDateStr();
  const pm=getCurrentPrimerMonth(data.primerMonthEnds||[]);

  let periodStart,periodEnd,prevStart,prevEnd;
  if(range==="week"){
    periodStart=getWeekStart(); periodEnd=today;
    const daysSoFar=Math.floor((new Date(today+"T12:00:00")-new Date(periodStart+"T12:00:00"))/86400000)+1;
    const pwEnd=new Date(periodStart+"T12:00:00"); pwEnd.setDate(pwEnd.getDate()-1);
    prevEnd=localDateStr(pwEnd);
    const pwStart=new Date(pwEnd); pwStart.setDate(pwStart.getDate()-daysSoFar+1);
    prevStart=localDateStr(pwStart);
  } else if(range==="month"){
    const now=new Date();
    periodStart=localDateStr(new Date(now.getFullYear(),now.getMonth(),1));
    periodEnd=today;
    const daysSoFar=Math.floor((new Date(today+"T12:00:00")-new Date(periodStart+"T12:00:00"))/86400000)+1;
    const pmEnd=new Date(periodStart+"T12:00:00"); pmEnd.setDate(pmEnd.getDate()-1);
    prevEnd=localDateStr(pmEnd);
    const pmStart=new Date(pmEnd); pmStart.setDate(pmStart.getDate()-daysSoFar+1);
    prevStart=localDateStr(pmStart);
  } else {
    periodStart=pm.start; periodEnd=today;
    const daysSoFar=Math.floor((new Date(today+"T12:00:00")-new Date(periodStart+"T12:00:00"))/86400000)+1;
    const pEnd=new Date(periodStart+"T12:00:00"); pEnd.setDate(pEnd.getDate()-1);
    prevEnd=localDateStr(pEnd);
    const pStart=new Date(pEnd); pStart.setDate(pStart.getDate()-daysSoFar+1);
    prevStart=localDateStr(pStart);
  }

  const allReps=(data.reps||[]).filter(r=>!r.inactive).map(r=>({...r,personType:"rep"}));
  const allTrainers=(data.trainers||[]).filter(t=>!t.inactive).map(t=>({...t,personType:"trainer"}));
  const allPeople=[...allReps,...allTrainers];
  const isMine = p => p.personType==="trainer" ? p.adminId===userId : (p.adminId===userId||p.trainerId===userId);
  const scopedReps = scope==="mine" ? allPeople.filter(isMine) : allPeople;

  const perRep = scopedReps.map(r=>({id:r.id,name:r.name,personType:r.personType,...sumRepMetricsForRange(data,r.id,periodStart,periodEnd)}));
  const perRepPrev = scopedReps.map(r=>sumRepMetricsForRange(data,r.id,prevStart,prevEnd));

  const totals={}; TEAM_NUMBER_CATS.forEach(c=>totals[c.key]=perRep.reduce((s,r)=>s+(r[c.key]||0),0));
  const prevTotals={}; TEAM_NUMBER_CATS.forEach(c=>prevTotals[c.key]=perRepPrev.reduce((s,r)=>s+(r[c.key]||0),0));
  const trendPct=(cur,prev)=> prev>0 ? Math.round(((cur-prev)/prev)*100) : (cur>0?100:0);

  const filteredRows = perRep.filter(r=>(r.name||"").toLowerCase().includes(search.trim().toLowerCase()));
  const sortedRows = sortKey ? [...filteredRows].sort((a,b)=>sortDir==="desc"?(b[sortKey]-a[sortKey]):(a[sortKey]-b[sortKey])) : filteredRows;
  const toggleSort=(key)=>{ if(sortKey===key) setSortDir(sortDir==="desc"?"asc":"desc"); else { setSortKey(key); setSortDir("desc"); } };

  return <Card style={{marginBottom:16}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:2,flexWrap:"wrap",gap:8}}>
      <div>
        <div style={{fontSize:16,fontWeight:800,color:C.text}}>Team Numbers</div>
        <div style={{fontSize:12,color:C.textMid}}>{scope==="mine"?"Only reps you're responsible for":"Whole organization — click \"My Team\" to see just your own downline"}</div>
      </div>
      <div style={{display:"flex",gap:4,background:C.surface,borderRadius:8,padding:3}}>
        <button onClick={()=>setScope("everyone")} style={{fontSize:12,padding:"6px 12px",borderRadius:6,border:"none",background:scope==="everyone"?"white":"none",color:scope==="everyone"?C.teal:C.textMid,fontWeight:600,cursor:"pointer",boxShadow:scope==="everyone"?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>Everyone</button>
        <button onClick={()=>setScope("mine")} style={{fontSize:12,padding:"6px 12px",borderRadius:6,border:"none",background:scope==="mine"?"white":"none",color:scope==="mine"?C.teal:C.textMid,fontWeight:600,cursor:"pointer",boxShadow:scope==="mine"?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>My Team</button>
      </div>
    </div>
    <div style={{display:"flex",gap:6,margin:"12px 0"}}>
      {[["week","This Week"],["month","This Month"],["primer",pm.label]].map(([k,l])=><button key={k} onClick={()=>setRange(k)} style={{fontSize:12,padding:"6px 12px",borderRadius:7,border:`1px solid ${range===k?C.teal:C.border}`,background:range===k?C.teal+"11":"white",color:range===k?C.teal:C.textMid,cursor:"pointer",fontWeight:600}}>{l}</button>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:8,marginBottom:16}}>
      {TEAM_NUMBER_CATS.map(c=>{
        const val=totals[c.key]||0;
        const pct=trendPct(val,prevTotals[c.key]||0);
        return <div key={c.key} style={{border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
          <div style={{fontSize:19,fontWeight:800,color:C.teal}}>{c.isMoney?"$"+val.toLocaleString():val.toLocaleString()}</div>
          <div style={{fontSize:9,color:C.textMid,textTransform:"uppercase",letterSpacing:"0.3px",marginTop:2}}>{c.label}</div>
          {(val>0||prevTotals[c.key]>0)&&<div style={{fontSize:9,fontWeight:700,marginTop:2,color:pct>=0?C.success:C.danger}}>{pct>=0?"▲":"▼"} {Math.abs(pct)}%</div>}
        </div>;
      })}
    </div>
    <button onClick={()=>setExpanded(!expanded)} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,fontWeight:700,color:C.textMid,background:"none",border:"none",cursor:"pointer",padding:0}}>
      <span style={{display:"inline-block",transform:expanded?"rotate(90deg)":"none",fontSize:11}}>▶</span> By Rep ({scopedReps.length} people)
    </button>
    {expanded&&<div style={{marginTop:10}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search reps by name..." style={{width:"100%",padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,marginBottom:10,boxSizing:"border-box"}}/>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
            <th style={{textAlign:"left",padding:"6px 8px",color:C.textLight,textTransform:"uppercase",fontSize:10}}>Rep</th>
            {TEAM_NUMBER_CATS.map(c=><th key={c.key} onClick={()=>toggleSort(c.key)} style={{textAlign:"center",padding:"6px 8px",color:sortKey===c.key?C.teal:C.textLight,textTransform:"uppercase",fontSize:10,cursor:"pointer",whiteSpace:"nowrap"}}>{c.label}{sortKey===c.key?(sortDir==="desc"?" ▼":" ▲"):""}</th>)}
          </tr></thead>
          <tbody>
            {sortedRows.length===0?<tr><td colSpan={TEAM_NUMBER_CATS.length+1} style={{textAlign:"center",padding:"14px",color:C.textLight}}>No matching reps</td></tr>:
            sortedRows.map(r=><tr key={r.id} style={{borderBottom:`1px solid ${C.border}`}}>
              <td style={{padding:"7px 8px",fontWeight:600,color:C.text,whiteSpace:"nowrap"}}>{r.name}{r.personType==="trainer"&&<span style={{fontSize:9,fontWeight:700,color:C.gold,background:C.gold+"11",padding:"1px 6px",borderRadius:4,marginLeft:6}}>TRAINER</span>}</td>
              {TEAM_NUMBER_CATS.map(c=><td key={c.key} style={{textAlign:"center",padding:"7px 8px",color:C.text,fontWeight:600}}>{c.isMoney?"$"+(r[c.key]||0).toLocaleString():(r[c.key]||0)}</td>)}
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>}
  </Card>;
}

function Dashboard({data,onUpdate,userRole,userId,onSelectRep}) {
  const isAdmin=userRole==="admin"||userRole==="superadmin";
  const [showTrainerCommitment,setShowTrainerCommitment]=useState(false);
  const isTrainer=userRole==="trainer";
  const trainerRecord=isTrainer?(data.trainers||[]).find(t=>t.id===userId):null;
  useEffect(()=>{
    if(isTrainer&&trainerRecord){
      const pm=getCurrentPrimerMonth(data.primerMonthEnds||[]);
      const hasCommitted=(trainerRecord.commitments||{})[pm.key];
      const seenKey=`commitment_seen_${userId}_${pm.key}`;
      if(!hasCommitted&&!localStorage.getItem(seenKey)){
        setShowTrainerCommitment(true);
      }
    }
  },[userId]);
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("all");
  const [showAdd,setShowAdd]=useState(false);
  const reps=(data.reps||[]).filter(r=>userRole==="trainer"?r.trainerId===userId:true);
  const filtered=reps.filter(r=>(r.name.toLowerCase().includes(search.toLowerCase())||r.phone?.includes(search))&&(filter==="all"||r.track===filter));
  const addRep=f=>onUpdate({...data,reps:[...(data.reps||[]),{...f,id:"rep_"+Date.now(),checked:{},trainerChecked:{},appointments:[],references:[],checkIns:[],repPin:null,createdAt:Date.now()}]});
  const trainers=data.trainers||[];
  const stats=[{l:"Total Reps",v:reps.length,c:C.teal},{l:"Fast Start",v:reps.filter(r=>r.track==="fast").length,c:C.teal},{l:"Licensed",v:reps.filter(r=>r.track==="licensed").length,c:C.gold},{l:"Graduated",v:reps.filter(r=>{const cl=TRACK_TO_CHECKLIST_KEY[r.track]?getChecklistItems(data,TRACK_TO_CHECKLIST_KEY[r.track]):[];return cl.length>0&&cl.every(i=>(r.checked||{})[i.id])}).length,c:C.success}];
  const pm=getCurrentPrimerMonth(data.primerMonthEnds||[]);
  return <div>
    {isAdmin&&<TeamNumbersCard data={data} userId={userId}/>}
    {showTrainerCommitment&&isTrainer&&trainerRecord&&<CommitmentPopup rep={trainerRecord} primerMonth={pm} onSave={(commitment)=>{
      localStorage.setItem(`commitment_seen_${userId}_${pm.key}`,"true");
      onUpdate({...data,trainers:(data.trainers||[]).map(t=>t.id===userId?{...t,commitments:{...(t.commitments||{}),[pm.key]:commitment}}:t)});
      setShowTrainerCommitment(false);
    }} onClose={()=>{localStorage.setItem(`commitment_seen_${userId}_${pm.key}`,"true");setShowTrainerCommitment(false);}}/>}
    {/* Next Level Access Requests */}
    {(()=>{
      const pending=(data.reps||[]).filter(r=>r.nextLevelRequested&&!r.nextLevelGranted&&(r.track==="fast"||r.track==="regular"));
      if(pending.length===0||(userRole!=="admin"&&userRole!=="superadmin"&&userRole!=="trainer")) return null;
      return <div style={{background:C.gold+"15",border:`2px solid ${C.gold}55`,borderRadius:12,padding:"12px 16px",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <div style={{width:8,height:8,borderRadius:4,background:C.gold,animation:"pulse 1.5s infinite"}}/>
          <div style={{fontSize:14,fontWeight:700,color:C.gold}}>Next Level Access Requests ({pending.length})</div>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
        {pending.map(rep=>{
          const track=TRACK_INFO[rep.track];
          return <div key={rep.id} style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600,color:C.text}}>{rep.name}</div>
              <div style={{fontSize:13,color:C.textMid}}>Completed {track?.label} — requesting Licensed Now What access</div>
              {rep.nextLevelRequestedAt&&<div style={{fontSize:12,color:C.textLight}}>Requested: {new Date(rep.nextLevelRequestedAt).toLocaleDateString()}</div>}
            </div>
            <button onClick={()=>{
              const updated={...rep,track:"licensed",nextLevelGranted:true,nextLevelGrantedAt:new Date().toISOString(),checked:{},celebrationShown:false};
              onUpdate({...data,reps:(data.reps||[]).map(r=>r.id===rep.id?updated:r)});
            }} style={{padding:"7px 14px",borderRadius:8,background:C.success,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,whiteSpace:"nowrap"}}>
              Grant Access
            </button>
            <button onClick={()=>{
              const updated={...rep,nextLevelRequested:false,nextLevelRequestedAt:null};
              onUpdate({...data,reps:(data.reps||[]).map(r=>r.id===rep.id?updated:r)});
            }} style={{padding:"7px 10px",borderRadius:8,background:C.danger+"11",color:C.danger,border:`1px solid ${C.danger}33`,cursor:"pointer",fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>
              Deny
            </button>
          </div>;
        })}
      </div>;
    })()}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:14}}>
      {stats.map(s=><Card key={s.l} style={{padding:dv("14px 16px","20px 24px"),textAlign:"center"}}><div style={{fontSize:dv(28,36),fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:dv(11,13),color:C.textMid,textTransform:"uppercase",letterSpacing:"0.5px",marginTop:2}}>{s.l}</div></Card>)}
    </div>
    <RvpPathRequests data={data} onUpdate={onUpdate} userRole={userRole}/>
    {(userRole==="admin"||userRole==="superadmin")&&<MonthEndReport data={data}/>}
    <HelpRequestsBanner data={data} onUpdate={onUpdate} userRole={userRole} userId={userId}/>
    <GoalBoard data={data} onUpdate={onUpdate} userRole={userRole} showEdit={true}/>
    <FieldTrainerRequests data={data} onUpdate={onUpdate} userRole={userRole}/>
    <StalledReferencesAlert data={data} onUpdate={onUpdate} userRole={userRole} userId={userId}/>

    <BirthdayAnniversaryWidget data={data}/>
    {(userRole==="admin"||userRole==="superadmin")&&<LinkSharingActivity data={data}/>}
    {(userRole==="admin"||userRole==="superadmin")&&<TopRecruiters data={data} onUpdate={onUpdate} userRole={userRole}/>}
    {(userRole==="admin"||userRole==="superadmin")&&<Leaderboard data={data} userId={userId}/>}
    {(userRole==="admin"||userRole==="superadmin")&&<ProdDash data={data} onUpdateData={onUpdate}/>}

    {userRole==="trainer"&&<WallOfFameBanner data={data}/>}
    {userRole==="trainer"&&(()=>{
      const trRec=(data.trainers||[]).find(t=>t.id===userId);
      const pm3=getCurrentPrimerMonth(data.primerMonthEnds||[]);
      const c3=trRec?.commitments?.[pm3.key];
      if(c3){
        const trRecruits=countPeriodRecruits(data,userId,pm3.start);
        const trPremium=(data.myProduction||{})[userId]?.lifeApps?.filter(a=>a.date&&a.date>=pm3.start&&(!a.cod||a.codAccepted)).reduce((s,a)=>s+(Number(a.premium)||0)*12,0)||0;
        return <CommitmentCard rep={trRec} primerMonth={pm3} canUnlock={false} onUnlock={()=>{}} recruitsOverride={trRecruits} premiumOverride={trPremium}/>;
      }
      // No commitment set — show reminder card
      return <Card style={{marginBottom:12,border:`2px solid ${C.gold}55`,background:C.gold+"06",cursor:"pointer"}} onClick={()=>setShowTrainerCommitment(true)}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{fontSize:24}}>📋</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:C.gold}}>Set Your {pm3.label} Commitment</div>
            <div style={{fontSize:11,color:C.textMid,marginTop:2}}>You haven't set your monthly goal yet. {getDaysRemaining(pm3.cutoff)} days left in this Primerica month.</div>
          </div>
          <div style={{fontSize:13,color:C.gold,fontWeight:700}}>Tap →</div>
        </div>
      </Card>;
    })()}
    {userRole==="trainer"&&<DailyActivityLog rep={{id:userId,name:""}} data={data} onUpdate={onUpdate} isFirstTime={!(data.activityLogs||{})[userId]?.seenIntro}/>}

    <div style={{display:"flex",gap:7,marginBottom:10,flexWrap:"wrap"}}>
      <input placeholder="Search reps..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,minWidth:140,padding:"7px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
      <select value={filter} onChange={e=>setFilter(e.target.value)} style={{padding:"7px 9px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}><option value="all">All Tracks</option>{Object.entries(TRACK_INFO).map(([k,t])=><option key={k} value={k}>{t.label}</option>)}</select>
    </div>
    <div style={{display:"flex",gap:7,marginBottom:14}}>
      <button onClick={()=>setShowAdd(true)} style={{flex:1,padding:"8px",borderRadius:8,background:C.teal,color:"white",border:"none",cursor:"pointer",fontWeight:600,fontSize:13}}>+ Add New Rep</button>
      
    </div>
    {filtered.length===0&&<div style={{textAlign:"center",padding:"28px 0",color:C.textLight}}>{reps.length===0?"No reps yet - add your first rep":"No results found"}</div>}
    {filtered.map(rep=>{
      const track=TRACK_INFO[rep.track];
      const cl=TRACK_TO_CHECKLIST_KEY[rep.track]?getChecklistItems(data,TRACK_TO_CHECKLIST_KEY[rep.track]):[];
      const done=cl.filter(i=>(rep.checked||{})[i.id]).length;
      const pct=cl.length>0?Math.round((done/cl.length)*100):0;
      const trDone=getChecklistItems(data,"trainerChecklist").filter(i=>(rep.trainerChecked||{})[i.id]).length;
      const trPct=Math.round((trDone/(getChecklistItems(data,"trainerChecklist").length||1))*100);
      const lastCI=rep.checkIns?.length>0?new Date(rep.checkIns[rep.checkIns.length-1].date):null;
      const ds=lastCI?Math.floor((Date.now()-lastCI)/(86400000)):null;
      // Stalled = only if they have at least one check-in AND it's been 7+ days
      const stalled=lastCI!==null&&ds>=7;
      const grad=cl.length>0&&cl.every(i=>(rep.checked||{})[i.id]);
      const trainer=[...trainers,...(data.admins||[])].find(t=>t.id===rep.trainerId);
      return <div key={rep.id} onClick={()=>onSelectRep(rep.id)} style={{background:"white",borderRadius:12,border:`1px solid ${stalled&&!grad?C.danger+"44":C.border}`,padding:"12px 14px",marginBottom:7,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.borderColor=grad?C.success:C.teal} onMouseLeave={e=>e.currentTarget.style.borderColor=stalled&&!grad?C.danger+"44":C.border}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:7}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
              <span style={{fontSize:14,fontWeight:700,color:C.text}}>{rep.name}</span>
              {grad&&<Badge color={C.success} small>Graduated</Badge>}
              {stalled&&!grad&&<Badge color={C.danger} small>Stalled</Badge>}
              {rep.nextLevelRequested&&!rep.nextLevelGranted&&<Badge color={C.gold} small>Upgrade Pending</Badge>}
            </div>
            <div style={{fontSize:dv(11,13),color:C.textMid,marginTop:1,display:"flex",alignItems:"center",gap:8}}><PhoneLink phone={rep.phone}/>{rep.email&&<a href={"mailto:"+rep.email} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:22,height:22,borderRadius:5,background:C.teal+"22",border:"1px solid "+C.teal+"44",textDecoration:"none"}} title="Email"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg></a>}</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:2}}>
              <span style={{fontSize:dv(10,12),color:C.textMid}}>Trainer: <strong style={{color:trainer?C.teal:C.textLight}}>{trainer?.name||"Not assigned"}</strong></span>
              <span style={{fontSize:12,color:C.textMid}}>Recruited by: <strong style={{color:(()=>{const r=findPerson(rep.recruitedBy,data);return r?C.purple:C.textLight;})()}}>{findPerson(rep.recruitedBy,data)?.name||"Not specified"}</strong></span>
            </div>
          </div>
          <Badge color={track?.color||C.teal} small>{track?.label}</Badge>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:5}}>
          <div><div style={{fontSize:10,color:C.textMid,marginBottom:2}}>Trainer {trPct}%</div><Bar pct={trPct} h={3}/></div>
          <div><div style={{fontSize:10,color:C.textMid,marginBottom:2}}>Rep {pct}%</div><Bar pct={pct} color={track?.color||C.purple} h={3}/></div>
        </div>
        <div style={{fontSize:12,color:C.textLight}}>{ds===null?"No check-ins yet":ds===0?"Checked in today":`${ds}d since check-in`}{rep.dgoDate&&<span> - DGO: {rep.dgoDate}</span>}</div>
      </div>;
    })}
    {showAdd&&<AddRep onAdd={addRep} onClose={()=>setShowAdd(false)} trainers={trainers} allPeople={[(data.admins||[]).map(a=>({...a,role:"Admin"})),trainers.map(t=>({...t,role:"Trainer"})),(data.reps||[]).map(r=>({...r,role:"Rep"}))].flat()}/>}
  </div>;
}

// ── LOGIN ──
function LoginScreen({data,onLogin}) {
  const [mode,setMode]=useState("select");
  const [pin,setPin]=useState("");
  const [search,setSearch]=useState("");
  const [selRep,setSelRep]=useState(null);
  const [rPin,setRPin]=useState("");
  const [rPinC,setRPinC]=useState("");
  const [step,setStep]=useState("find");
  const [err,setErr]=useState("");
  const admins=data.admins||[{id:"superadmin",name:"Jacqueline Jones",pin:"1234",isSuperAdmin:true,alsoRecruits:true}];
  const trainers=data.trainers||[];
  const reps=data.reps||[];
  const doAdminLogin=()=>{const f=admins.find(a=>a.pin===pin);if(f){setErr("");onLogin("admin",f.id,f);}else setErr("Incorrect PIN");};
  const doTrainerLogin=()=>{const f=trainers.find(t=>t.pin===pin);if(f){setErr("");onLogin("trainer",f.id,f);}else setErr("Incorrect PIN");};
  const doRepLogin=()=>{
    if(step==="create"){if(rPin.length!==4){setErr("PIN must be 4 digits");return;}if(rPin!==rPinC){setErr("PINs do not match");return;}onLogin("rep",selRep.id,selRep,rPin);}
    else{if(rPin===selRep.repPin){setErr("");onLogin("rep",selRep.id,selRep);}else{setErr("Incorrect PIN");setRPin("");}}
  };
  const filtReps=search.length>0?reps.filter(r=>r.name.toLowerCase().includes(search.toLowerCase())):[];
  const inp={width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid rgba(0,0,0,0.12)`,fontSize:14,outline:"none",background:"white",boxSizing:"border-box",color:C.text};
  return <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${C.navy} 0%,${C.navyMid} 60%,${C.navyLight} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{width:"100%",maxWidth:420}}>
      <div style={{textAlign:"center",marginBottom:28}}>

        {/* Welcome banner */}
        <div style={{background:"linear-gradient(90deg,rgba(245,158,11,0.15),rgba(14,165,160,0.15),rgba(245,158,11,0.15))",border:"1px solid rgba(245,158,11,0.3)",borderRadius:30,padding:"6px 20px",display:"inline-block",marginBottom:12}}>
          <span style={{fontSize:13,fontWeight:700,color:"#f59e0b",letterSpacing:"2px",textTransform:"uppercase"}}>✦ Welcome to the Team ✦</span>
        </div>
        <div style={{color:"white",fontSize:22,fontWeight:800,letterSpacing:"0.5px",lineHeight:1.2}}>NextLevel</div>
        <div style={{color:C.teal,fontSize:14,fontWeight:600,letterSpacing:"3px",textTransform:"uppercase",marginBottom:14}}>Field Training Hub</div>
        {/* Team logos / badges — dynamic */}
        <div style={{display:"flex",gap:10,justifyContent:"center",alignItems:"center",flexWrap:"wrap"}}>
          {((data.teamBrands&&data.teamBrands.length>0)?data.teamBrands:[{name:"Team PrimeTime",logo:"",emoji:"⚡"},{name:"Wealth Creators",logo:"",emoji:"🏆"}]).map((team,i)=>
            team.logo
              ?<img key={i} src={team.logo} alt={team.name}
                  style={{height:80,maxWidth:160,borderRadius:10,objectFit:"contain"}}
                  onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="inline-block";}}
                />
              :null
          )}
          {((data.teamBrands&&data.teamBrands.length>0)?data.teamBrands:[{name:"Team PrimeTime",logo:"",emoji:"⚡"},{name:"Wealth Creators",logo:"",emoji:"🏆"}]).map((team,i)=>
            <div key={"badge"+i} style={{padding:"5px 16px",borderRadius:20,background:"rgba(14,165,160,0.15)",border:"1px solid rgba(14,165,160,0.5)",fontSize:13,fontWeight:700,color:C.teal,letterSpacing:"0.5px",display:team.logo?"none":"inline-block"}}>{team.emoji||"⭐"} {team.name}</div>
          )}
        </div>
      </div>
      <div style={{background:"white",borderRadius:16,padding:24,boxShadow:"0 20px 50px rgba(0,0,0,0.3)"}}>
        {mode==="select"&&<div>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:4}}>Welcome back</div>
          <div style={{fontSize:13,color:C.textMid,marginBottom:16}}>How are you accessing the app?</div>
          {[{k:"admin",l:"Admin / Super Admin",s:"Full system access"},{k:"trainer",l:"Field Trainer",s:"Manage your reps"},{k:"rep",l:"New Rep / Licensed Agent",s:"View your checklist and tools"}].map(o=><button key={o.k} onClick={()=>{setMode(o.k);setPin("");setErr("");}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:10,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",marginBottom:7,textAlign:"left"}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.teal} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:C.text}}>{o.l}</div><div style={{fontSize:13,color:C.textMid}}>{o.s}</div></div><span style={{color:C.textLight,fontSize:16}}>›</span></button>)}
        </div>}
        {(mode==="admin"||mode==="trainer")&&<div>
          <button onClick={()=>{setMode("select");setErr("");setPin("");}} style={{background:"none",border:"none",color:C.teal,cursor:"pointer",fontSize:13,marginBottom:14,padding:0}}>&larr; Back</button>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:14}}>{mode==="admin"?"Admin Login":"Trainer Login"}</div>
          <input type="password" maxLength={6} placeholder="Enter PIN" value={pin} onChange={e=>{setPin(e.target.value.replace(/\D/,""));setErr("");}} onKeyDown={e=>e.key==="Enter"&&(mode==="admin"?doAdminLogin():doTrainerLogin())} style={{...inp,marginBottom:6,letterSpacing:"6px",textAlign:"center"}}/>
          <button onClick={()=>alert("Contact the Super Admin to reset your PIN. They can set a temporary PIN from the Team Management section.")} style={{background:"none",border:"none",color:C.teal,fontSize:13,cursor:"pointer",marginBottom:10,padding:0,textDecoration:"underline"}}>Forgot PIN?</button>
          {err&&<div style={{color:C.danger,fontSize:13,marginBottom:8}}>{err}</div>}
          <button onClick={mode==="admin"?doAdminLogin:doTrainerLogin} style={{width:"100%",padding:"10px",borderRadius:8,background:C.teal,color:"white",border:"none",fontWeight:600,fontSize:14,cursor:"pointer"}}>Sign In</button>
        </div>}
        {mode==="rep"&&step==="find"&&<div>
          <button onClick={()=>{setMode("select");setErr("");setSearch("");}} style={{background:"none",border:"none",color:C.teal,cursor:"pointer",fontSize:13,marginBottom:14,padding:0}}>&larr; Back</button>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:14}}>Find your name</div>
          <input placeholder="Search your name..." value={search} onChange={e=>{setSearch(e.target.value);setErr("");}} style={{...inp,marginBottom:10}} autoFocus/>
          {!search&&<div style={{color:C.textLight,fontSize:13,textAlign:"center",padding:"8px 0"}}>Start typing to find yourself</div>}
          {search&&filtReps.length===0&&<div style={{color:C.textMid,fontSize:13,textAlign:"center",padding:"10px 0"}}>No results - ask your trainer to add you</div>}
          {filtReps.map(r=><button key={r.id} onClick={()=>{setSelRep(r);setRPin("");setRPinC("");setErr("");setStep(r.repPin?"enter":"create");}} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",textAlign:"left",marginBottom:5,fontSize:14,color:C.text}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.teal} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>{r.name}<span style={{float:"right",fontSize:12,color:C.textLight}}>{TRACK_INFO[r.track]?.label}</span></button>)}
        </div>}
        {mode==="rep"&&(step==="create"||step==="enter")&&selRep&&<div>
          <button onClick={()=>{setStep("find");setErr("");}} style={{background:"none",border:"none",color:C.teal,cursor:"pointer",fontSize:13,marginBottom:14,padding:0}}>&larr; Back</button>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:4}}>{step==="create"?"Create Your PIN":`Welcome, ${selRep.name}`}</div>
          <div style={{fontSize:13,color:C.textMid,marginBottom:14}}>{step==="create"?"Choose a 4-digit PIN":"Enter your 4-digit PIN"}</div>
          <input type="password" maxLength={4} placeholder="4-digit PIN" value={rPin} onChange={e=>{setRPin(e.target.value.replace(/\D/,""));setErr("");}} style={{...inp,marginBottom:step==="create"?9:6,textAlign:"center",fontSize:22,letterSpacing:"10px"}} autoFocus/>
          {step==="enter"&&<button onClick={()=>alert("Contact your trainer or admin to reset your PIN. They can set a temporary PIN from your profile.")} style={{background:"none",border:"none",color:C.teal,fontSize:13,cursor:"pointer",marginBottom:9,padding:0,textDecoration:"underline"}}>Forgot PIN?</button>}
          {step==="create"&&<input type="password" maxLength={4} placeholder="Confirm PIN" value={rPinC} onChange={e=>{setRPinC(e.target.value.replace(/\D/,""));setErr("");}} onKeyDown={e=>e.key==="Enter"&&doRepLogin()} style={{...inp,marginBottom:9,textAlign:"center",fontSize:22,letterSpacing:"10px"}}/>}
          {err&&<div style={{color:C.danger,fontSize:13,marginBottom:8}}>{err}</div>}
          <button onClick={doRepLogin} style={{width:"100%",padding:"10px",borderRadius:8,background:C.teal,color:"white",border:"none",fontWeight:600,fontSize:14,cursor:"pointer"}}>{step==="create"?"Create PIN and Continue":"Sign In"}</button>
        </div>}
      </div>
      <div style={{textAlign:"center",color:"rgba(255,255,255,0.25)",fontSize:12,marginTop:14}}>NextLevel Field Training Hub 2025</div>
    </div>
  </div>;
}



// ── CONFETTI CELEBRATION ──
function Confetti({name,onClose,pct=100,customMsg}) {
  const colors=[C.teal,C.gold,C.purple,C.success,"#f43f5e","#3b82f6"];
  const pieces=Array.from({length:60},(_,i)=>({
    id:i, color:colors[i%colors.length],
    left:Math.random()*100, delay:Math.random()*1.2,
    size:6+Math.random()*8, duration:2+Math.random()*2,
    rotate:Math.random()*360
  }));
  const messages={
    25:{emoji:"🌱",title:"Great Start!",msg:"You have completed 25% of your checklist! Keep up the momentum."},
    50:{emoji:"⭐",title:"Halfway There!",msg:"You have completed 50% of your checklist! You are crushing it."},
    75:{emoji:"🔥",title:"Almost There!",msg:"You have completed 75% of your checklist! The finish line is in sight."},
    100:{emoji:"🏆",title:"Congratulations!",msg:"You have completed every task in your training checklist. Your trainer has been notified. Keep pushing forward!"},
  };
  const m=customMsg||messages[pct]||messages[100];
  return <div style={{position:"fixed",inset:0,zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.7)"}}>
    <style>{`
      @keyframes confettiFall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
      @keyframes popIn{0%{transform:scale(0.5);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
    `}</style>
    {pieces.map(p=><div key={p.id} style={{position:"fixed",left:`${p.left}%`,top:"-10px",width:p.size,height:p.size,background:p.color,borderRadius:Math.random()>0.5?"50%":"2px",animation:`confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,transform:`rotate(${p.rotate}deg)`}}/>)}
    <div style={{background:"white",borderRadius:20,padding:"32px 28px",maxWidth:360,width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.4)",animation:"popIn 0.5s ease-out",position:"relative",zIndex:1}}>
      <div style={{fontSize:52,marginBottom:8}}>{m.emoji}</div>
      <div style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:6}}>{m.title}</div>
      <div style={{fontSize:15,color:C.textMid,marginBottom:4}}>{name}</div>
      <div style={{fontSize:14,color:C.success,fontWeight:600,marginBottom:16}}>{pct}% Complete</div>
      <div style={{fontSize:13,color:C.textLight,marginBottom:20,lineHeight:1.5}}>{m.msg}</div>
      <button onClick={onClose} style={{width:"100%",padding:"12px",borderRadius:10,background:`linear-gradient(135deg,${C.teal},${C.tealFade.replace("rgba(14,165,160,0.12)","#0891b2")})`,border:"none",color:"white",fontSize:14,fontWeight:700,cursor:"pointer"}}>Let's Keep Going!</button>
    </div>
  </div>;
}


// ── ANNOUNCEMENTS BANNER ──
function AnnouncementsBanner({data,onUpdate,userRole}) {
  const announcements=(data.announcements||[]).filter(a=>{
    if(!a.active) return false;
    if(a.expiresAt&&new Date(a.expiresAt)<new Date()) return false;
    return true;
  });
  if(announcements.length===0) return null;
  const colors={info:C.teal,warning:C.gold,success:C.success,urgent:C.danger};
  return <div style={{marginBottom:14}}>
    {announcements.map((ann,i)=><div key={i} style={{background:colors[ann.type||"info"]+"18",border:`1px solid ${colors[ann.type||"info"]}44`,borderRadius:10,padding:"10px 14px",marginBottom:6,display:"flex",gap:10,alignItems:"flex-start"}}>
      <div style={{flex:1}}>
        <div style={{fontSize:14,fontWeight:700,color:colors[ann.type||"info"],marginBottom:2}}>{ann.title}</div>
        <div style={{fontSize:13,color:C.text,lineHeight:1.5}}>{ann.message}</div>
        {ann.expiresAt&&<div style={{fontSize:12,color:C.textLight,marginTop:3}}>Expires: {new Date(ann.expiresAt).toLocaleDateString()}</div>}
      </div>
    </div>)}
  </div>;
}

// ── ANNOUNCEMENTS MANAGER (admin only) ──
function AnnouncementsManager({data,onUpdate}) {
  const announcements=data.announcements||[];
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({title:"",message:"",type:"info",expiresAt:"",active:true});
  const [editing,setEditing]=useState(null);

  const save=()=>{
    if(!form.title||!form.message) return;
    if(editing!==null){
      onUpdate({...data,announcements:announcements.map((a,i)=>i===editing?{...form}:a)});
      setEditing(null);
    } else {
      onUpdate({...data,announcements:[...announcements,{...form,id:Date.now()}]});
    }
    setForm({title:"",message:"",type:"info",expiresAt:"",active:true});
    setShowForm(false);
  };

  const toggle=(i)=>{
    onUpdate({...data,announcements:announcements.map((a,idx)=>idx===i?{...a,active:!a.active}:a)});
  };

  const del=(i)=>{
    onUpdate({...data,announcements:announcements.filter((_,idx)=>idx!==i)});
  };

  const typeColors={info:C.teal,warning:C.gold,success:C.success,urgent:C.danger};

  return <Card style={{marginBottom:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text}}>Team Announcements</div>
      <button onClick={()=>{setShowForm(!showForm);setEditing(null);setForm({title:"",message:"",type:"info",expiresAt:"",active:true});}} style={{fontSize:13,padding:"5px 10px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>+ New Announcement</button>
    </div>
    {showForm&&<div style={{background:C.surface,borderRadius:10,padding:12,marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:8}}>{editing!==null?"Edit":"New"} Announcement</div>
      <input placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
      <textarea placeholder="Message..." value={form.message} onChange={e=>setForm({...form,message:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,resize:"vertical",minHeight:70,boxSizing:"border-box",marginBottom:7,lineHeight:1.5}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
        <div>
          <div style={{fontSize:12,color:C.textMid,marginBottom:3}}>Type</div>
          <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}>
            <option value="info">Info (Teal)</option>
            <option value="warning">Warning (Gold)</option>
            <option value="success">Success (Green)</option>
            <option value="urgent">Urgent (Red)</option>
          </select>
        </div>
        <div>
          <div style={{fontSize:12,color:C.textMid,marginBottom:3}}>Expires (optional)</div>
          <input type="date" value={form.expiresAt} onChange={e=>setForm({...form,expiresAt:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
        </div>
      </div>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>{setShowForm(false);setEditing(null);}} style={{flex:1,padding:"7px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
        <button onClick={save} style={{flex:2,padding:"7px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Save Announcement</button>
      </div>
    </div>}
    {announcements.length===0&&<div style={{color:C.textLight,fontSize:13,textAlign:"center",padding:"12px 0"}}>No announcements yet</div>}
    {announcements.map((ann,i)=><div key={i} style={{borderRadius:8,border:`1px solid ${typeColors[ann.type||"info"]}33`,padding:"10px 12px",marginBottom:7,background:ann.active?"white":C.surface,opacity:ann.active?1:0.6}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
            <span style={{fontSize:13,fontWeight:700,color:typeColors[ann.type||"info"]}}>{ann.title}</span>
            <Badge color={ann.active?C.success:C.textLight} small>{ann.active?"Live":"Off"}</Badge>
          </div>
          <div style={{fontSize:13,color:C.textMid,lineHeight:1.4}}>{ann.message}</div>
          {ann.expiresAt&&<div style={{fontSize:12,color:C.textLight,marginTop:2}}>Expires: {new Date(ann.expiresAt).toLocaleDateString()}</div>}
        </div>
        <div style={{display:"flex",gap:5,marginLeft:8,flexShrink:0}}>
          <button onClick={()=>toggle(i)} style={{fontSize:12,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>{ann.active?"Pause":"Activate"}</button>
          <button onClick={()=>{setEditing(i);setForm({...ann});setShowForm(true);}} style={{fontSize:12,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>Edit</button>
          <button onClick={()=>del(i)} style={{fontSize:12,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.danger}33`,background:C.danger+"11",cursor:"pointer",color:C.danger}}>Del</button>
        </div>
      </div>
    </div>)}
  </Card>;
}


// ── RESOURCE LIBRARY ──
const RESOURCE_CATEGORIES=["Training","Licensing","Tools","Company","Other"];

function ResourceLibrary({data,onUpdate,userRole}) {
  const resources=data.resources||[];
  const isAdmin=userRole==="admin"||userRole==="superadmin";
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({title:"",url:"",description:"",category:"Training"});
  const [editing,setEditing]=useState(null);
  const [filter,setFilter]=useState("All");

  const save=()=>{
    if(!form.title||!form.url) return;
    if(editing!==null){
      onUpdate({...data,resources:resources.map((r,i)=>i===editing?{...form}:r)});
      setEditing(null);
    } else {
      onUpdate({...data,resources:[...resources,{...form,id:Date.now()}]});
    }
    setForm({title:"",url:"",description:"",category:"Training"});
    setShowForm(false);
  };

  const del=(i)=>onUpdate({...data,resources:resources.filter((_,idx)=>idx!==i)});

  const cats=["All",...RESOURCE_CATEGORIES.filter(c=>resources.some(r=>r.category===c))];
  const filtered=filter==="All"?resources:resources.filter(r=>r.category===filter);
  const catColors={Training:C.teal,Licensing:C.gold,Tools:C.purple,Company:C.success,Other:C.textMid};

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text}}>Resource Library</div>
      {isAdmin&&<button onClick={()=>{setShowForm(!showForm);setEditing(null);setForm({title:"",url:"",description:"",category:"Training"});}} style={{fontSize:13,padding:"5px 10px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>+ Add Resource</button>}
    </div>
    {isAdmin&&<div style={{background:C.teal+"11",border:`1px solid ${C.teal}33`,borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:13,color:C.teal}}>Add links to documents, training videos, and company materials for your team. <strong>Tip:</strong> Upload files to Google Drive, set sharing to "Anyone with the link", and paste the link here.</div>}
    {showForm&&<Card style={{marginBottom:14,border:`1px solid ${C.teal}44`}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:10}}>{editing!==null?"Edit":"New"} Resource</div>
      <input placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
      <input placeholder="URL (https://...)" value={form.url} onChange={e=>setForm({...form,url:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
      <input placeholder="Description (optional)" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
      <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,marginBottom:10}}>
        {RESOURCE_CATEGORIES.map(c=><option key={c}>{c}</option>)}
      </select>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>{setShowForm(false);setEditing(null);}} style={{flex:1,padding:"7px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
        <button onClick={save} style={{flex:2,padding:"7px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Save Resource</button>
      </div>
    </Card>}
    {resources.length===0&&<div style={{textAlign:"center",padding:"32px 0",color:C.textLight}}>{isAdmin?"No resources yet — add your first one above":"No resources added yet — ask your admin to add some"}</div>}
    {resources.length>0&&<div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:12,paddingBottom:2}}>
      {cats.map(c=><button key={c} onClick={()=>setFilter(c)} style={{padding:"5px 10px",borderRadius:7,border:"none",cursor:"pointer",whiteSpace:"nowrap",fontSize:13,fontWeight:filter===c?600:400,background:filter===c?C.navy:C.surface,color:filter===c?"white":C.textMid}}>{c}</button>)}
    </div>}
    {RESOURCE_CATEGORIES.filter(cat=>filtered.some(r=>r.category===cat)).map(cat=><div key={cat}>
      <SecHead title={cat} color={catColors[cat]||C.teal}/>
      {filtered.filter(r=>r.category===cat).map((r,i)=>{
        const realIdx=resources.indexOf(r);
        return <div key={i} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:"10px 12px",marginBottom:6,background:"white",display:"flex",gap:10,alignItems:"flex-start"}}>
          <div style={{width:32,height:32,borderRadius:8,background:catColors[r.category]+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={catColors[r.category]||C.teal} strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <a href={r.url} target="_blank" rel="noreferrer" style={{fontSize:14,fontWeight:600,color:C.teal,textDecoration:"none",display:"block",marginBottom:2}}>{r.title} &rarr;</a>
            {r.description&&<div style={{fontSize:13,color:C.textMid}}>{r.description}</div>}
          </div>
          {isAdmin&&<div style={{display:"flex",gap:4,flexShrink:0}}>
            <button onClick={()=>{setEditing(realIdx);setForm({...r});setShowForm(true);}} style={{fontSize:12,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>Edit</button>
            <button onClick={()=>del(realIdx)} style={{fontSize:12,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.danger}33`,background:C.danger+"11",cursor:"pointer",color:C.danger}}>Del</button>
          </div>}
        </div>;
      })}
    </div>)}
    {filtered.length>0&&filtered.every(r=>!RESOURCE_CATEGORIES.includes(r.category))&&filtered.map((r,i)=>{
      const realIdx=resources.indexOf(r);
      return <div key={i} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:"10px 12px",marginBottom:6}}>
        <a href={r.url} target="_blank" rel="noreferrer" style={{fontSize:14,fontWeight:600,color:C.teal,textDecoration:"none"}}>{r.title} &rarr;</a>
        {r.description&&<div style={{fontSize:13,color:C.textMid,marginTop:2}}>{r.description}</div>}
      </div>;
    })}
  </div>;
}


// ── SCORECARD ──
// Local calendar date as YYYY-MM-DD — NOT toISOString(), which converts to UTC and can
// silently roll a date over to "tomorrow" for anyone west of UTC in the evening.
function localDateStr(d=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function getWeekStart(date=new Date()) {
  const d=new Date(date);
  const day=d.getDay();
  const diff=d.getDate()-day+(day===0?-6:1);
  d.setDate(diff);
  d.setHours(0,0,0,0);
  return localDateStr(d);
}

// ── DAILY COMMITMENT TRACKING (Scorecard) ──
// "manual" categories have no other data source in the app — logged by hand each day.
// Non-manual categories are auto-pulled from existing production/recruiting data so nobody double-enters them.
const COMMITMENT_CATEGORIES = [
  {key:"calls",label:"Calls",icon:"📱",manual:true},
  {key:"contacts",label:"Contacts",icon:"📞",manual:true},
  {key:"apptSet",label:"Appts Set",icon:"📅",manual:true},
  {key:"apptDone",label:"Appts Completed",icon:"✅",manual:true},
  {key:"hmwInvitees",label:"How Money Works Thurs. Invitees",icon:"💰",manual:true},
  {key:"recruits",label:"Recruits",icon:"🤝",manual:false},
  {key:"lifeApps",label:"Life Apps",icon:"📝",manual:false},
  {key:"premium",label:"Premium",icon:"💵",manual:false,isMoney:true},
  {key:"pacInvestment",label:"PAC Investment",icon:"🔁",manual:false,isMoney:true},
  {key:"lumpInvestment",label:"Lump Sum Investment",icon:"📈",manual:false,isMoney:true},
  {key:"testActivity",label:"Test Scheduled/Taken (Team)",icon:"🎓",manual:true},
  {key:"linksShared",label:"Links Shared",icon:"🔗",manual:false},
];
// Admin-editable version of the list above — renaming (any category) and adding/deleting
// (manual only; the 6 auto-calculated ones are protected from deletion since Team Numbers
// and the Coaching Report are wired directly to those specific keys) all live here so every
// place that reads categories automatically reflects admin changes.
function getEffectiveCommitmentCategories(data){
  const overrides=data?.commitmentCategoryOverrides||{};
  const deleted=new Set(data?.deletedCommitmentCategories||[]);
  const custom=data?.customCommitmentCategories||[];
  const base=COMMITMENT_CATEGORIES.filter(c=>!(c.manual&&deleted.has(c.key)));
  const withOverrides=base.map(c=>overrides[c.key]?{...c,label:overrides[c.key].label||c.label}:c);
  const customActive=custom.filter(c=>!deleted.has(c.key));
  return [...withOverrides,...customActive];
}

function findPersonRecord(data,userId){
  return (data.reps||[]).find(r=>r.id===userId) || (data.trainers||[]).find(t=>t.id===userId) || (data.admins||[]).find(a=>a.id===userId) || null;
}

// Logs one "share" action against whichever array this person actually lives in (reps,
// trainers, or admins) and saves it via the correct save path for that context. Returns
// nothing — just fires the update. Every call adds a new entry, so sharing the same link
// multiple times in a day counts each time.
function logLinkShare(data,onUpdate,userId,linkLabel){
  const entry={id:Date.now(),date:localDateStr(),linkLabel:linkLabel||"Link"};
  if((data.reps||[]).some(r=>r.id===userId)){
    const rep=(data.reps||[]).find(r=>r.id===userId);
    onUpdate(userId,{...rep,linkShareLog:[...(rep.linkShareLog||[]),entry]});
    return;
  }
  if((data.trainers||[]).some(t=>t.id===userId)){
    const updated=(data.trainers||[]).map(t=>t.id===userId?{...t,linkShareLog:[...(t.linkShareLog||[]),entry]}:t);
    onUpdate({...data,trainers:updated});
    return;
  }
  if((data.admins||[]).some(a=>a.id===userId)){
    const updated=(data.admins||[]).map(a=>a.id===userId?{...a,linkShareLog:[...(a.linkShareLog||[]),entry]}:a);
    onUpdate({...data,admins:updated});
  }
}

// Counts recruits within a period two ways combined: real rep accounts created under this
// person, AND quick-logged recruits (name/phone, no account needed yet) — so someone doesn't
// have to wait for a prospect's full onboarding before it counts toward their commitment.
// A quick-logged entry is excluded once that same name shows up as a real account under this
// person (any time, not just this period) so the same recruit is never counted twice.
function countPeriodRecruits(data,personId,periodStart){
  const allMyRealReps=(data.reps||[]).filter(r=>r.trainerId===personId&&!r.excludeFromRecruitCount);
  const realNames=new Set(allMyRealReps.map(r=>(r.name||"").trim().toLowerCase()).filter(Boolean));
  const realAccounts=allMyRealReps.filter(r=>{
    if(!r.createdAt) return false;
    try{ return localDateStr(new Date(r.createdAt))>=periodStart; }catch(e){ return false; }
  }).length;
  const person=findPersonRecord(data,personId);
  const loggedRecruits=((person?.myRecruitLog)||[]).filter(r=>{
    if(!r.date||r.date<periodStart) return false;
    return !realNames.has((r.name||"").trim().toLowerCase()); // already has a real account — don't double count
  }).length;
  return realAccounts+loggedRecruits;
}

// Auto-computed actuals for a given user on a given date (YYYY-MM-DD), pulled from
// existing production/recruiting data — never stored, always computed fresh.
function getAutoActuals(data,userId,dateStr){
  const myProd=(data.myProduction||{})[userId]||{};
  const person=findPersonRecord(data,userId);
  const lifeAppsArr=[...(myProd.lifeApps||[]),...(person?.selfPremium||[])];
  const investmentsArr=[...(myProd.investments||[]),...(person?.investments||[])];
  const parseLump=v=>Number(String(v||"").replace(/[$,]/g,""))||0;
  const dayLifeApps=lifeAppsArr.filter(a=>a.date===dateStr&&(!a.cod||a.codAccepted));
  const dayInvestments=investmentsArr.filter(i=>i.date===dateStr);
  const dayRecruits=(data.reps||[]).filter(r=>{
    if(r.trainerId!==userId||!r.createdAt||r.excludeFromRecruitCount) return false;
    try{ return localDateStr(new Date(r.createdAt))===dateStr; }catch(e){ return false; }
  });
  // Also count recruits logged through the "Recruits"/quick-log form (a person doesn't
  // need a full account in the system yet for the day you recruited them to count) —
  // excluding anyone who already has a real account under this person, so the same
  // recruit is never counted twice on the day they're both logged and onboarded.
  const myRealNames=new Set((data.reps||[]).filter(r=>r.trainerId===userId).map(r=>(r.name||"").trim().toLowerCase()).filter(Boolean));
  const loggedRecruitsToday=((person?.myRecruitLog)||[]).filter(r=>r.date===dateStr&&!myRealNames.has((r.name||"").trim().toLowerCase())).length;
  // Every "Mark as Shared" tap logs its own entry — sharing the same link twice counts twice.
  const linksSharedToday=((person?.linkShareLog)||[]).filter(s=>s.date===dateStr).length;
  return {
    recruits:dayRecruits.length+loggedRecruitsToday,
    lifeApps:dayLifeApps.length,
    premium:dayLifeApps.reduce((s,a)=>s+(Number(a.premium)||0),0),
    pacInvestment:dayInvestments.reduce((s,i)=>s+(Number(i.pac)||0),0),
    lumpInvestment:dayInvestments.reduce((s,i)=>s+parseLump(i.lumpSum),0),
    linksShared:linksSharedToday,
  };
}

function getScorecardActual(data,userId,dateStr,catKey,dayEntry){
  const cat=getEffectiveCommitmentCategories(data).find(c=>c.key===catKey);
  if(!cat) return 0;
  if(!cat.manual) return getAutoActuals(data,userId,dateStr)[catKey]||0;
  return (dayEntry?.actual||{})[catKey]||0;
}

function ScorecardPage({data,onUpdate,userId,userRole,track}) {

  const weekKey=getWeekStart();
  const todayStr=localDateStr();
  const allScores=data.scorecards||{};
  const myScores=allScores[userId]||{};
  const week=myScores[weekKey]||{contacts:0,apptSet:0,apptDone:0,days:{}};
  const weekDays=week.days||{};
  const todayEntry=weekDays[todayStr]||{committed:{},actual:{}};
  const isAdmin=userRole==="admin"||userRole==="superadmin";
  const isTrainer=userRole==="trainer";
  const canCommit=userRole==="rep"||isTrainer||isAdmin;

  const goals={contacts:100,apptSet:20,apptDone:20};

  // Weekly totals: sum daily entries when present, otherwise fall back to the old flat
  // weekly fields (for weeks logged before this daily system existed — nothing is lost).
  const weeklyTotal=(key)=>{
    const dayList=Object.values(weekDays);
    if(dayList.length>0){
      const cat=getEffectiveCommitmentCategories(data).find(c=>c.key===key);
      if(cat&&!cat.manual){
        return Object.keys(weekDays).reduce((s,d)=>s+(getAutoActuals(data,userId,d)[key]||0),0);
      }
      return dayList.reduce((s,d)=>s+(Number(d.actual?.[key])||0),0);
    }
    return Number(week[key])||0;
  };

  const updateCommitted=(key,val)=>{
    const newDays={...weekDays,[todayStr]:{...todayEntry,committed:{...todayEntry.committed,[key]:Math.max(0,val)}}};
    onUpdate({...data,scorecards:{...allScores,[userId]:{...myScores,[weekKey]:{...week,days:newDays}}}});
  };
  const updateActual=(key,val)=>{
    const newDays={...weekDays,[todayStr]:{...todayEntry,actual:{...todayEntry.actual,[key]:Math.max(0,val)}}};
    onUpdate({...data,scorecards:{...allScores,[userId]:{...myScores,[weekKey]:{...week,days:newDays}}}});
  };

  const totalPct=Math.round(((weeklyTotal("contacts")/goals.contacts)+(weeklyTotal("apptSet")/goals.apptSet)+(weeklyTotal("apptDone")/goals.apptDone))/3*100);
  const getMessage=()=>{
    if(totalPct>=80) return {msg:"Outstanding week! You are on fire!",color:C.success};
    if(totalPct>=50) return {msg:"You are building momentum! Keep going!",color:C.teal};
    if(totalPct>0) return {msg:"Keep pushing! Every contact counts.",color:C.gold};
    return {msg:"Start logging your activity — small actions add up!",color:C.textMid};
  };
  const {msg,color}=getMessage();

  const wkContacts=weeklyTotal("contacts"), wkApptSet=weeklyTotal("apptSet"), wkApptDone=weeklyTotal("apptDone");
  const contactRate=wkContacts>0?Math.round((wkApptSet/wkContacts)*100):0;
  const showRate=wkApptSet>0?Math.round((wkApptDone/wkApptSet)*100):0;

  // Get week history (last 4 weeks)
  const weekHistory=Array.from({length:4},(_,i)=>{
    const d=new Date();
    d.setDate(d.getDate()-(i*7));
    const wk=getWeekStart(d);
    const wkData=myScores[wk]||{contacts:0,apptSet:0,apptDone:0,days:{}};
    const wkDayList=Object.values(wkData.days||{});
    const tot=(key)=>wkDayList.length>0?wkDayList.reduce((s,dd)=>s+(Number(dd.actual?.[key])||0),0):(Number(wkData[key])||0);
    const c=tot("contacts"),s=tot("apptSet"),dn=tot("apptDone");
    const pct=Math.round(((c/goals.contacts)+(s/goals.apptSet)+(dn/goals.apptDone))/3*100);
    return {week:wk,label:i===0?"This Week":i===1?"Last Week":`${i} Weeks Ago`,pct,c,s,dn};
  });

  // Team Today dashboard — admins see everyone who can commit, trainers see their own reps + themselves
  const licensedReps=(data.reps||[]).filter(r=>r.track==="licensed"&&!r.inactive);
  const trainers=data.trainers||[];
  const allAdmins=data.admins||[];
  const [teamScope,setTeamScope]=useState("mine");
  const [teamSearch,setTeamSearch]=useState("");
  const [teamExpanded,setTeamExpanded]=useState(false);

  let teamMembers=[];
  if(isAdmin){
    if(teamScope==="all") teamMembers=[...trainers,...licensedReps];
    else if(teamScope==="mine") teamMembers=[...trainers.filter(t=>t.adminId===userId),...licensedReps.filter(r=>r.adminId===userId)];
    else teamMembers=[...trainers.filter(t=>t.adminId===teamScope),...licensedReps.filter(r=>r.adminId===teamScope)];
  }
  else if(isTrainer) teamMembers=[{id:userId,name:(trainers.find(t=>t.id===userId)||{}).name||"Me"},...licensedReps.filter(r=>r.trainerId===userId)];

  const teamTodayAll=teamMembers.map(m=>{
    const mScores=(data.scorecards||{})[m.id]||{};
    const mWeek=mScores[weekKey]||{days:{}};
    const mToday=(mWeek.days||{})[todayStr]||{committed:{},actual:{}};
    const committedTotal=getEffectiveCommitmentCategories(data).reduce((s,c)=>s+(Number(mToday.committed?.[c.key])||0),0);
    const actualTotal=getEffectiveCommitmentCategories(data).reduce((s,c)=>s+getScorecardActual(data,m.id,todayStr,c.key,mToday),0);
    const pct=committedTotal>0?Math.round((actualTotal/committedTotal)*100):(actualTotal>0?100:0);
    return {...m,committedTotal,actualTotal,pct};
  });
  // Only show people actually using it today — no point reviewing someone with nothing logged
  const teamActive=teamTodayAll.filter(m=>m.committedTotal>0||m.actualTotal>0);
  const teamFiltered=teamSearch.trim()?teamActive.filter(m=>m.name?.toLowerCase().includes(teamSearch.trim().toLowerCase())):teamActive;
  const teamToday=[...teamFiltered].sort((a,b)=>a.pct-b.pct);
  const onPaceCount=teamActive.filter(m=>m.pct>=80).length;
  const behindCount=teamActive.length-onPaceCount;

  return <div>
    <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:4}}>Scorecard</div>
    <div style={{fontSize:13,color:C.textMid,marginBottom:16}}>Today — {new Date(todayStr+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})} · Week of {new Date(weekKey+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>

    {/* Why this matters banner */}
    <div style={{background:`linear-gradient(135deg,${C.navyMid},${C.navyLight})`,borderRadius:12,padding:"14px 16px",marginBottom:16,color:"white"}}>
      <div style={{fontSize:13,fontWeight:700,color:C.teal,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:6}}>Why This Matters</div>
      <div style={{fontSize:14,color:"rgba(255,255,255,0.85)",lineHeight:1.6}}>Production tracks your <strong style={{color:"white"}}>results</strong>. The scorecard tracks your <strong style={{color:"white"}}>activity</strong> — the daily work that creates results. You can't control whether someone buys, but you can control how many calls you make. <strong style={{color:C.teal}}>Focus on the activity and the results will follow.</strong></div>
    </div>

    {/* Today's Commitment vs Actual */}
    {canCommit&&<Card style={{marginBottom:16}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:2}}>Today's Commitment</div>
      <div style={{fontSize:12,color:C.textMid,marginBottom:12}}>Set what you're committing to this morning. Recruits, Life Apps, Premium, and Investment fill in automatically from your production — everything else, log as you go.</div>
      {getEffectiveCommitmentCategories(data).map(cat=>{
        const committed=Number(todayEntry.committed?.[cat.key])||0;
        const actual=getScorecardActual(data,userId,todayStr,cat.key,todayEntry);
        const hitGoal=committed>0&&actual>=committed;
        return <div key={cat.key} style={{border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 11px",marginBottom:7}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
            <span style={{fontSize:14}}>{cat.icon}</span>
            <span style={{fontSize:13,fontWeight:600,color:C.text,flex:1}}>{cat.label}</span>
            {hitGoal&&<span style={{fontSize:11,fontWeight:700,color:C.success}}>✓ Hit</span>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div>
              <div style={{fontSize:10,color:C.textLight,marginBottom:2,textTransform:"uppercase",letterSpacing:"0.4px"}}>Committed</div>
              <input type="number" min="0" value={committed||""} onChange={e=>updateCommitted(cat.key,Number(e.target.value))} placeholder="0" style={{width:"100%",padding:"6px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:14,color:C.text,boxSizing:"border-box"}}/>
            </div>
            <div>
              <div style={{fontSize:10,color:C.textLight,marginBottom:2,textTransform:"uppercase",letterSpacing:"0.4px"}}>Actual{!cat.manual&&" (auto)"}</div>
              {cat.manual?
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <button onClick={()=>updateActual(cat.key,actual-1)} style={{width:28,height:28,borderRadius:6,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:15,color:C.textMid,flexShrink:0}}>-</button>
                  <div style={{flex:1,textAlign:"center",fontSize:14,fontWeight:700,color:hitGoal?C.success:C.text}}>{cat.isMoney?"$":""}{actual}</div>
                  <button onClick={()=>updateActual(cat.key,actual+1)} style={{width:28,height:28,borderRadius:6,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:15,flexShrink:0}}>+</button>
                </div>
                :
                <div style={{padding:"6px 8px",borderRadius:6,background:C.surface||"#f1f5f9",fontSize:14,fontWeight:700,color:hitGoal?C.success:C.text,textAlign:"center"}}>{cat.isMoney?"$":""}{actual.toLocaleString()}</div>
              }
            </div>
          </div>
        </div>;
      })}
    </Card>}

    {/* Simple daily activity log for reps who aren't on the full commitment system yet (new/unlicensed reps) */}
    {!canCommit&&<Card style={{marginBottom:16}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:2}}>Log Today's Activity</div>
      <div style={{fontSize:12,color:C.textMid,marginBottom:12}}>Log your contacts and appointments each day — it adds up to your weekly score below.</div>
      {[["contacts","Contacts Made","📞"],["apptSet","Appointments Set","📅"],["apptDone","Appointments Completed","✅"]].map(([key,label,icon])=>{
        const actual=Number(todayEntry.actual?.[key])||0;
        return <div key={key} style={{border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 11px",marginBottom:7,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:14}}>{icon}</span>
          <span style={{fontSize:13,fontWeight:600,color:C.text,flex:1}}>{label}</span>
          <button onClick={()=>updateActual(key,actual-1)} style={{width:28,height:28,borderRadius:6,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:15,color:C.textMid,flexShrink:0}}>-</button>
          <div style={{width:32,textAlign:"center",fontSize:14,fontWeight:700,color:C.text}}>{actual}</div>
          <button onClick={()=>updateActual(key,actual+1)} style={{width:28,height:28,borderRadius:6,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:15,flexShrink:0}}>+</button>
        </div>;
      })}
    </Card>}

    {/* Weekly score */}
    <Card style={{marginBottom:16,background:`linear-gradient(135deg,${C.navy},${C.navyMid})`,border:"none"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div><div style={{fontSize:14,fontWeight:700,color:"white"}}>Weekly Score</div><div style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>Contacts / Appts Set / Appts Completed vs. weekly goals</div></div>
        <div style={{textAlign:"center"}}><div style={{fontSize:32,fontWeight:800,color:totalPct>=80?C.success:totalPct>=50?C.teal:C.gold}}>{totalPct}%</div></div>
      </div>
      <Bar pct={totalPct} color={totalPct>=80?C.success:totalPct>=50?C.teal:C.gold} h={8}/>
      <div style={{marginTop:8,fontSize:13,color:color,fontWeight:600}}>{msg}</div>
    </Card>

    {/* Conversion rates */}
    {(wkContacts>0||wkApptSet>0)&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
      <Card style={{padding:"10px 12px",textAlign:"center"}}>
        <div style={{fontSize:20,fontWeight:700,color:C.purple}}>{contactRate}%</div>
        <div style={{fontSize:13,color:C.textMid}}>Contact-to-Appt Rate</div>
        <div style={{fontSize:12,color:C.textLight}}>Industry target: 20%</div>
      </Card>
      <Card style={{padding:"10px 12px",textAlign:"center"}}>
        <div style={{fontSize:20,fontWeight:700,color:C.success}}>{showRate}%</div>
        <div style={{fontSize:13,color:C.textMid}}>Appointment Show Rate</div>
        <div style={{fontSize:12,color:C.textLight}}>Target: 80%+</div>
      </Card>
    </div>}

    {/* History */}
    <Card style={{marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>Recent History</div>
      {weekHistory.map((wh,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        <div style={{width:80,fontSize:13,color:i===0?C.text:C.textMid,fontWeight:i===0?700:400}}>{wh.label}</div>
        <div style={{flex:1}}><Bar pct={wh.pct} color={wh.pct>=80?C.success:wh.pct>=50?C.teal:C.gold} h={5}/></div>
        <div style={{fontSize:13,fontWeight:600,color:wh.pct>=80?C.success:wh.pct>=50?C.teal:C.gold,width:36,textAlign:"right"}}>{wh.pct}%</div>
        <div style={{fontSize:12,color:C.textLight,width:80,textAlign:"right"}}>{wh.c}c / {wh.s}s / {wh.dn}d</div>
      </div>)}
    </Card>

    {/* Team Today dashboard — admins see the whole team, trainers see their own */}
    {(isAdmin||isTrainer)&&<Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text}}>Team Today</div>
        {teamActive.length>0&&<button onClick={()=>setTeamExpanded(!teamExpanded)} style={{fontSize:12,color:C.teal,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>{teamExpanded?"Collapse":"Expand"}</button>}
      </div>
      <div style={{fontSize:12,color:C.textMid,marginBottom:10}}>Only shows people with something logged today — no news from someone means nothing to review yet</div>

      {isAdmin&&allAdmins.length>1&&<div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
        <button onClick={()=>setTeamScope("mine")} style={{fontSize:12,padding:"4px 10px",borderRadius:6,border:`1px solid ${teamScope==="mine"?C.teal:C.border}`,background:teamScope==="mine"?C.teal+"11":"white",color:teamScope==="mine"?C.teal:C.textMid,cursor:"pointer",fontWeight:teamScope==="mine"?700:500}}>My Team</button>
        {allAdmins.filter(a=>a.id!==userId).map(a=><button key={a.id} onClick={()=>setTeamScope(a.id)} style={{fontSize:12,padding:"4px 10px",borderRadius:6,border:`1px solid ${teamScope===a.id?C.teal:C.border}`,background:teamScope===a.id?C.teal+"11":"white",color:teamScope===a.id?C.teal:C.textMid,cursor:"pointer",fontWeight:teamScope===a.id?700:500}}>{a.name}'s Team</button>)}
        <button onClick={()=>setTeamScope("all")} style={{fontSize:12,padding:"4px 10px",borderRadius:6,border:`1px solid ${teamScope==="all"?C.teal:C.border}`,background:teamScope==="all"?C.teal+"11":"white",color:teamScope==="all"?C.teal:C.textMid,cursor:"pointer",fontWeight:teamScope==="all"?700:500}}>Everyone</button>
      </div>}

      {teamActive.length===0?
        <div style={{fontSize:13,color:C.textLight,textAlign:"center",padding:"10px 0"}}>No one's logged a commitment yet today</div>
        :
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 11px",background:C.surface,borderRadius:8,marginBottom:teamExpanded?10:0}}>
          <div style={{fontSize:13,color:C.text}}><b style={{color:C.success}}>{onPaceCount}</b> of <b>{teamActive.length}</b> on pace{behindCount>0&&<span>, <b style={{color:C.gold}}>{behindCount}</b> falling behind</span>}</div>
        </div>
      }

      {teamExpanded&&teamActive.length>0&&<>
        <input value={teamSearch} onChange={e=>setTeamSearch(e.target.value)} placeholder="Search by name..." style={{width:"100%",padding:"6px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,marginBottom:8,boxSizing:"border-box"}}/>
        {teamToday.map((u,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"8px 10px",background:C.surface,borderRadius:8}}>
          <div style={{width:28,height:28,borderRadius:7,background:C.teal+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.teal,flexShrink:0}}>{u.name?.charAt(0)?.toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}</div>
            <div style={{fontSize:12,color:C.textLight}}>{u.actualTotal} actual / {u.committedTotal} committed</div>
          </div>
          <div style={{flex:1}}><Bar pct={u.pct} color={u.pct>=80?C.success:u.pct>=50?C.teal:C.gold} h={4}/></div>
          <div style={{fontSize:13,fontWeight:700,color:u.pct>=80?C.success:u.pct>=50?C.teal:C.gold,width:36,textAlign:"right"}}>{u.pct}%</div>
        </div>)}
        {teamToday.length===0&&<div style={{fontSize:13,color:C.textLight,textAlign:"center",padding:"10px 0"}}>No match for "{teamSearch}"</div>}
      </>}
    </Card>}
  </div>;
}




// ── PROFILE PHOTO UPLOAD ──
function ProfilePhotoUpload({userId,data,onUpdate,compact=false}) {
  const [showLightbox,setShowLightbox] = useState(false);
  // For sidebar compact mode, use localStorage to store photo
  const storageKey = "profilePhoto_"+userId;
  const [photo,setPhoto] = useState(()=>{
    try{return localStorage.getItem(storageKey)||null;}catch(e){return null;}
  });

  const handleUpload = (e) => {
    const file=e.target.files[0];
    if(!file) return;
    if(file.size>5*1024*1024){alert("Photo must be under 5MB");return;}
    const reader=new FileReader();
    reader.onload=ev=>{
      const result=ev.target.result;
      setPhoto(result);
      try{localStorage.setItem(storageKey,result);}catch(e){}
      if(onUpdate) onUpdate(result);
    };
    reader.readAsDataURL(file);
  };

  if(compact) return <div style={{position:"relative",flexShrink:0}}>
    {photo?<img src={photo} alt="Profile" style={{width:32,height:32,borderRadius:9,objectFit:"cover",border:"2px solid "+C.teal+"66",cursor:"pointer"}} onClick={()=>setShowLightbox(true)}/>:
    <label style={{width:32,height:32,borderRadius:9,background:C.teal+"33",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",border:"1px dashed "+C.teal+"44"}}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
      <input type="file" accept="image/*" style={{display:"none"}} onChange={handleUpload}/>
    </label>}
    {showLightbox&&photo&&<div onClick={()=>setShowLightbox(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{maxWidth:300,width:"100%",textAlign:"center"}}>
        <img src={photo} alt="Profile" style={{width:"100%",borderRadius:12,marginBottom:12}}/>
        <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:8,background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,marginRight:8}}>
          Change Photo<input type="file" accept="image/*" style={{display:"none"}} onChange={handleUpload}/>
        </label>
        <button onClick={()=>setShowLightbox(false)} style={{padding:"8px 16px",borderRadius:8,background:"rgba(255,255,255,0.1)",color:"white",border:"1px solid rgba(255,255,255,0.2)",cursor:"pointer",fontSize:13}}>Close</button>
      </div>
    </div>}
  </div>;

  return <div>
    {photo?<div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
      <img src={photo} alt="Profile" onClick={()=>setShowLightbox(true)} style={{width:80,height:80,borderRadius:10,objectFit:"cover",border:"2px solid "+C.teal,cursor:"pointer"}}/>
      <div>
        <div style={{fontSize:13,color:C.textMid,marginBottom:6,lineHeight:1.4}}>Click photo to view full size. Used for DGO and Wall of Fame recognition.</div>
        <label style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:7,background:C.teal+"11",border:"1px solid "+C.teal+"33",cursor:"pointer",fontSize:13,color:C.teal,fontWeight:600}}>
          Change Photo<input type="file" accept="image/*" style={{display:"none"}} onChange={handleUpload}/>
        </label>
      </div>
    </div>:
    <label style={{display:"flex",alignItems:"center",gap:6,padding:"9px 14px",borderRadius:9,background:C.teal+"11",border:"1px dashed "+C.teal+"44",cursor:"pointer",fontSize:13,color:C.teal,fontWeight:600,marginBottom:10}}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
      Upload Profile Photo
      <input type="file" accept="image/*" style={{display:"none"}} onChange={handleUpload}/>
    </label>}
    {showLightbox&&photo&&<PhotoLightbox src={photo} name="Profile Photo" onClose={()=>setShowLightbox(false)}/>}
  </div>;
}

// ── DGO PHOTO PANEL ──
function DgoPhotoPanel({photo,name}) {
  const [showLightbox,setShowLightbox] = useState(false);
  const download = () => {
    const a = document.createElement("a");
    a.href = photo;
    a.download = `${(name||"rep").replace(/\s+/g,"-")}-DGO-Photo.jpg`;
    a.click();
  };
  return <div style={{marginTop:10,background:C.surface,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`}}>
    {showLightbox&&<PhotoLightbox src={photo} name={name||"Rep"} onClose={()=>setShowLightbox(false)}/>}
    <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:8}}>Profile Photo</div>
    <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
      <img src={photo} alt="DGO" onClick={()=>setShowLightbox(true)} style={{width:100,height:100,borderRadius:10,objectFit:"cover",border:`2px solid ${C.teal}`,cursor:"pointer",flexShrink:0,transition:"transform 0.15s"}} onMouseEnter={e=>e.target.style.transform="scale(1.03)"} onMouseLeave={e=>e.target.style.transform="scale(1)"}/>
      <div style={{flex:1}}>
        <div style={{fontSize:13,color:C.textMid,marginBottom:10,lineHeight:1.5}}>Click the photo to view full size. Right-click to copy. Use the buttons below to download for your presentation.</div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          <button onClick={()=>setShowLightbox(true)} style={{padding:"7px 14px",borderRadius:8,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View Full Size
          </button>
          <button onClick={download} style={{padding:"7px 14px",borderRadius:8,background:C.navy,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Download
          </button>
        </div>
      </div>
    </div>
  </div>;
}

// ── PHOTO LIGHTBOX ──
function PhotoLightbox({src,name,onClose}) {
  const download = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = `${name.replace(/\s+/g,"-")}-DGO-Photo.jpg`;
    a.click();
  };
  return <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:3000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
    <div onClick={e=>e.stopPropagation()} style={{maxWidth:600,width:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{color:"white",fontSize:15,fontWeight:700}}>{name} — DGO Photo</div>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"white",width:32,height:32,borderRadius:8,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>x</button>
      </div>
      <img src={src} alt={name} style={{width:"100%",maxHeight:"70vh",objectFit:"contain",borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}/>
      <div style={{display:"flex",gap:10,marginTop:14,justifyContent:"center"}}>
        <button onClick={download} style={{padding:"10px 24px",borderRadius:10,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:14,fontWeight:700,display:"flex",alignItems:"center",gap:8}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          Download Photo
        </button>
        <button onClick={onClose} style={{padding:"10px 24px",borderRadius:10,background:"rgba(255,255,255,0.1)",color:"white",border:"1px solid rgba(255,255,255,0.2)",cursor:"pointer",fontSize:14,fontWeight:600}}>Close</button>
      </div>
      <div style={{textAlign:"center",marginTop:10,fontSize:13,color:"rgba(255,255,255,0.4)"}}>Right-click the photo to save or copy image</div>
    </div>
  </div>;
}






// ── RVP PATH REQUESTS ──
function RvpPathRequests({data,onUpdate,userRole}) {
  if(userRole!=="admin"&&userRole!=="superadmin") return null;
  const repPending=(data.reps||[]).filter(r=>r.rvpPathRequested&&!r.rvpPathGranted);
  const trainerCareer=data.trainerCareer||{};
  const allTrainers=[...(data.trainers||[]),...(data.admins||[])];
  const trainerPending=allTrainers.filter(t=>{const td=trainerCareer[t.id]||{};return td.rvpPathRequested&&!td.rvpPathGranted;}).map(t=>({...t,...(trainerCareer[t.id]||{}),isTrainer:true}));
  const pending=[...repPending,...trainerPending];
  if(pending.length===0) return null;
  return <div style={{background:"white",borderRadius:12,border:"2px solid "+C.success+"44",padding:"12px 16px",marginBottom:14}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <div style={{width:8,height:8,borderRadius:4,background:C.success}}/>
      <div style={{fontSize:14,fontWeight:700,color:C.text}}>RVP Path Access Requests ({pending.length})</div>
    </div>
    {pending.map(rep=><div key={rep.id} style={{background:C.surface,borderRadius:8,padding:"10px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
      <div style={{flex:1}}>
        <div style={{fontSize:14,fontWeight:600,color:C.text}}>{rep.name}</div>
        <div style={{fontSize:13,color:C.textMid}}>Requesting RVP Path access — {rep.rvpPathRequestedAt?new Date(rep.rvpPathRequestedAt).toLocaleDateString():""}</div>
      </div>
      <button onClick={()=>onUpdate({...data,reps:(data.reps||[]).map(r=>r.id===rep.id?{...r,rvpPathGranted:true,rvpPathGrantedAt:new Date().toISOString()}:r)})}
        style={{padding:"6px 12px",borderRadius:7,background:C.success,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,whiteSpace:"nowrap"}}>Grant Access</button>
      <button onClick={()=>onUpdate({...data,reps:(data.reps||[]).map(r=>r.id===rep.id?{...r,rvpPathRequested:false}:r)})}
        style={{padding:"6px 10px",borderRadius:7,background:C.danger+"11",color:C.danger,border:"1px solid "+C.danger+"33",cursor:"pointer",fontSize:13,fontWeight:600}}>Deny</button>
    </div>)}
  </div>;
}

// ── FIELD TRAINER REQUESTS ──
function FieldTrainerRequests({data,onUpdate,userRole}) {
  if(userRole!=="admin"&&userRole!=="superadmin") return null;
  const pending=(data.reps||[]).filter(r=>r.fieldTrainerRequested&&!r.fieldTrainerGranted);
  if(pending.length===0) return null;
  return <div style={{background:"white",borderRadius:12,border:"2px solid "+C.purple+"44",padding:"12px 16px",marginBottom:14}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <div style={{width:8,height:8,borderRadius:4,background:C.purple}}/>
      <div style={{fontSize:14,fontWeight:700,color:C.text}}>Field Trainer Review Requests ({pending.length})</div>
    </div>
    {pending.map(rep=><div key={rep.id} style={{background:C.surface,borderRadius:8,padding:"10px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
      <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:C.text}}>{rep.name}</div><div style={{fontSize:13,color:C.textMid}}>Requesting Field Trainer review - {rep.fieldTrainerRequestedAt?new Date(rep.fieldTrainerRequestedAt).toLocaleDateString():""}</div></div>
      <button onClick={()=>onUpdate({...data,reps:(data.reps||[]).map(r=>r.id===rep.id?{...r,fieldTrainerGranted:true,fieldTrainerGrantedAt:new Date().toISOString()}:r)})} style={{padding:"6px 12px",borderRadius:7,background:C.success,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,whiteSpace:"nowrap"}}>Approve</button>
      <button onClick={()=>onUpdate({...data,reps:(data.reps||[]).map(r=>r.id===rep.id?{...r,fieldTrainerRequested:false,fieldTrainerDenied:true}:r)})} style={{padding:"6px 10px",borderRadius:7,background:C.danger+"11",color:C.danger,border:"1px solid "+C.danger+"33",cursor:"pointer",fontSize:13,fontWeight:600}}>Deny</button>
    </div>)}
  </div>;
}

// ── PENDING RECRUITS ──
function PendingRecruits({data,onUpdate,userRole}) {
  if(userRole!=="admin"&&userRole!=="superadmin"&&userRole!=="trainer") return null;
  const allPending=(data.reps||[]).filter(r=>(r.pendingRecruits||[]).length>0).flatMap(r=>(r.pendingRecruits||[]).map(p=>({...p,recruitedBy:r.name,recruitedById:r.id})));
  if(allPending.length===0) return null;
  return <div style={{background:"white",borderRadius:12,border:"2px solid "+C.teal+"44",padding:"12px 16px",marginBottom:14}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <div style={{width:8,height:8,borderRadius:4,background:C.teal}}/>
      <div style={{fontSize:14,fontWeight:700,color:C.text}}>Pending Recruit Submissions ({allPending.length})</div>
    </div>
    {allPending.map((p,i)=><div key={i} style={{background:C.surface,borderRadius:8,padding:"9px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:C.text}}>{p.name}{p.phone&&<span style={{color:C.textMid,fontWeight:400}}> - {p.phone}</span>}</div><div style={{fontSize:12,color:C.textMid}}>Submitted by {p.recruitedBy} on {new Date(p.submittedAt).toLocaleDateString()}</div></div>
      <button onClick={()=>{
        const recruiterRep=(data.reps||[]).find(r=>r.id===p.recruitedById);
        const updatedPending=(recruiterRep?.pendingRecruits||[]).filter(pr=>pr.id!==p.id);
        const newRep={name:p.name,phone:p.phone||"",track:"fast",trainerId:"",startDate:new Date().toISOString().split("T")[0],graduationDate:"",recruitedBy:p.recruitedById,id:"rep_"+Date.now(),checked:{},trainerChecked:{},appointments:[],references:[],checkIns:[],repPin:null,createdAt:Date.now()};
        onUpdate({...data,reps:[...(data.reps||[]).map(r=>r.id===p.recruitedById?{...r,pendingRecruits:updatedPending}:r),newRep]});
      }} style={{padding:"5px 10px",borderRadius:7,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>Add to System</button>
      <button onClick={()=>{
        const recruiterRep=(data.reps||[]).find(r=>r.id===p.recruitedById);
        const updatedPending=(recruiterRep?.pendingRecruits||[]).filter(pr=>pr.id!==p.id);
        onUpdate({...data,reps:(data.reps||[]).map(r=>r.id===p.recruitedById?{...r,pendingRecruits:updatedPending}:r)});
      }} style={{padding:"5px 8px",borderRadius:7,background:C.danger+"11",color:C.danger,border:"1px solid "+C.danger+"33",cursor:"pointer",fontSize:12}}>Dismiss</button>
    </div>)}
  </div>;
}


// ── TRAINER CAREER PATH ──
function TrainerCareerPath({data,onUpdate,session}) {
  const trainer = [...(data.trainers||[]),(data.admins||[])].flat().find(t=>t.id===session.id)||{};
  const trainerData = data.trainerCareer||{};
  const myData = trainerData[session.id]||{};
  const [showCelebration,setShowCelebration] = useState(false);
  const [showRequest,setShowRequest] = useState(false);
  const [targetDate,setTargetDate] = useState(myData.rvpTargetDate||"");
  const [goals,setGoals] = useState(myData.rvpGoals||{premium:10000,agents:20,teamSize:30});
  const [editGoals,setEditGoals] = useState(false);
  const [weeklyCommit,setWeeklyCommit] = useState("");
  const [svpTargetDate,setSvpTargetDate] = useState(myData.svpTargetDate||"");
  const [aalcTargetDate,setAalcTargetDate] = useState(myData.aalcTargetDate||"");

  const rvpRequested = myData.rvpPathRequested&&!myData.rvpPathGranted;
  const rvpDenied = myData.rvpPathDenied&&!myData.rvpPathRequested;
  const rvpGranted = myData.rvpPathGranted;

  const save = (updates) => {
    onUpdate({...data,trainerCareer:{...trainerData,[session.id]:{...myData,...updates}}});
  };

  if(session.role==="admin"||session.role==="superadmin"){
    const svpChecked = myData.svpChecked||{};
    const svpDone = Object.values(svpChecked).filter(Boolean).length;
    const svpTotal = getChecklistItems(data,"svpChecklist").length;
    const toggleSvp = (i) => save({svpChecked:{...svpChecked,[i]:!svpChecked[i]}});
    const svpDaysLeft = myData.svpTargetDate ? Math.ceil((new Date(myData.svpTargetDate+"T12:00:00")-new Date())/(86400000)) : null;
    const svpCountdownMsg = svpDaysLeft===null?"Set your target promotion date":svpDaysLeft<=0?"Your target date has passed — keep pushing!":svpDaysLeft<=30?"You are almost there! Final push!":svpDaysLeft<=90?"You are in the home stretch!":svpDaysLeft<=180?"Great progress — stay consistent!":"Keep building every day!";
    const svpCountdownColor = svpDaysLeft===null?C.textMid:svpDaysLeft<=0?C.danger:svpDaysLeft<=30?C.gold:C.success;
    const adminStages=[{key:"rvp",label:"RVP",sub:"Achieved"},{key:"aalc",label:"AALC",sub:"Next Milestone"},{key:"svp",label:"SVP",sub:"Future Goal"}];

    return <div>
      <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:14}}>My Career Path</div>

      {/* 3-stage roadmap: RVP (done) -> AALC (next) -> SVP (future) */}
      <div style={{background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",borderRadius:12,padding:"16px",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.teal,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:12}}>Your Career Journey</div>
        <div style={{display:"flex",alignItems:"center",gap:0}}>
          {adminStages.map((s,i)=>{
            const isDone=i===0;
            const isNext=i===1;
            return <div key={s.key} style={{flex:1,textAlign:"center",position:"relative"}}>
              {i>0&&<div style={{position:"absolute",top:14,left:0,right:"50%",height:2,background:C.success}}/>}
              {i<adminStages.length-1&&<div style={{position:"absolute",top:14,left:"50%",right:0,height:2,background:isDone?C.success:"rgba(255,255,255,0.15)"}}/>}
              <div style={{width:28,height:28,borderRadius:14,background:isDone?C.success:isNext?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.05)",border:"2px solid "+(isDone?C.success:isNext?C.gold+"88":"rgba(255,255,255,0.15)"),margin:"0 auto 6px",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:1}}>
                {isDone&&<svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                {isNext&&<span style={{color:C.gold,fontSize:13}}>★</span>}
              </div>
              <div style={{fontSize:10,fontWeight:isDone||isNext?700:400,color:isDone?"white":isNext?C.gold:"rgba(255,255,255,0.4)",lineHeight:1.2}}>{s.label}</div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.4)"}}>{s.sub}</div>
            </div>;
          })}
        </div>
      </div>

      {/* Achievement banner */}
      <div style={{background:"linear-gradient(135deg,"+C.gold+"22,"+C.gold+"08)",border:"1px solid "+C.gold+"44",borderRadius:12,padding:"18px 20px",marginBottom:14,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:6}}>🏆</div>
        <div style={{fontSize:17,fontWeight:800,color:C.text,marginBottom:6}}>You're a Regional Vice President!</div>
        <div style={{fontSize:14,color:C.textMid,lineHeight:1.6}}>That's one of the most important roles in this business — you've built a team, and now it's time to build a legacy. Here's what's ahead on your path forward.</div>
      </div>

      {/* AALC — informational only, not tracked */}
      <Card style={{marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text}}>🎖️ AALC — African American Leadership Council</div>
          <span style={{fontSize:10,fontWeight:700,color:C.purple,background:C.purple+"11",padding:"2px 8px",borderRadius:6}}>Milestone</span>
        </div>
        <div style={{fontSize:13,color:C.textMid,lineHeight:1.6}}>To be considered for AALC membership, hit <strong style={{color:C.text}}>$200,000 in income within any 12-month period</strong>. This is shown here as a heads up on the path ahead — not something tracked or logged in the Hub.</div>
      </Card>

      {/* AALC Target Date */}
      <Card style={{marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>AALC Target Date</div>
        <div style={{fontSize:13,color:C.textMid,marginBottom:8}}>When are you aiming to hit your $200k rolling 12-month income goal?</div>
        <input type="date" value={aalcTargetDate} onChange={e=>{setAalcTargetDate(e.target.value);save({aalcTargetDate:e.target.value});}} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:14,color:C.text,boxSizing:"border-box"}}/>
      </Card>

      {/* SVP Target Date */}
      <Card style={{marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>SVP Target Date</div>
        <div style={{fontSize:13,color:C.textMid,marginBottom:8}}>When are you aiming to be promoted to Senior Vice President?</div>
        <input type="date" value={svpTargetDate} onChange={e=>{setSvpTargetDate(e.target.value);save({svpTargetDate:e.target.value});}} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:14,color:C.text,boxSizing:"border-box"}}/>
        {myData.svpTargetDate&&<div style={{marginTop:10,textAlign:"center"}}>
          <div style={{fontSize:24,fontWeight:800,color:svpCountdownColor}}>{svpDaysLeft<=0?"Time to push harder!":svpDaysLeft+" days"}</div>
          <div style={{fontSize:13,color:svpCountdownColor,fontWeight:600,marginTop:4}}>{svpCountdownMsg}</div>
        </div>}
      </Card>

      {/* SVP Requirements checklist */}
      <Card style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text}}>SVP Requirements</div>
          <div style={{fontSize:13,color:C.textMid}}>{svpDone}/{svpTotal} complete</div>
        </div>
        <Bar pct={svpTotal>0?(svpDone/svpTotal)*100:0} color={C.success} h={6}/>
        <div style={{marginTop:10}}>
          {getChecklistItems(data,"svpChecklist").map((item,i)=><label key={item.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 0",borderTop:i>0?"1px solid "+C.border:"none",cursor:"pointer"}}>
            <input type="checkbox" checked={!!(svpChecked[item.id]??svpChecked[i])} onChange={()=>toggleSvp(item.id)} style={{width:18,height:18,marginTop:1,accentColor:C.success,cursor:"pointer",flexShrink:0}}/>
            <span style={{fontSize:13,color:C.text,lineHeight:1.5,textDecoration:(svpChecked[item.id]??svpChecked[i])?"line-through":"none",opacity:(svpChecked[item.id]??svpChecked[i])?0.6:1}}>{item.task}</span>
          </label>)}
        </div>
      </Card>
    </div>;
  }

  // Countdown
  const daysLeft = myData.rvpTargetDate ? Math.ceil((new Date(myData.rvpTargetDate+"T12:00:00")-new Date())/(86400000)) : null;
  const countdownMsg = daysLeft===null?"Set your target promotion date":daysLeft<=0?"Your target date has passed — keep pushing!":daysLeft<=30?"You are almost there! Final push!":daysLeft<=90?"You are in the home stretch!":daysLeft<=180?"Great progress — stay consistent!":"Keep building every day!";
  const countdownColor = daysLeft===null?C.textMid:daysLeft<=0?C.danger:daysLeft<=30?C.gold:C.success;

  // My team stats
  const myReps = (data.reps||[]).filter(r=>r.trainerId===session.id);
  const licensed = myReps.filter(r=>r.isLicensed).length;
  const totalPrem = myReps.reduce((s,r)=>s+(Number(r.premiumSubmitted)||0),0);

  // RVP checklist progress
  const rvpDone = Object.values(myData.rvpChecked||{}).filter(Boolean).length;
  const rvpTotal = getChecklistItems(data,"rvpChecklist").length;
  const rvpPct = rvpTotal>0?Math.round((rvpDone/rvpTotal)*100):0;

  // Stages roadmap
  const stages=[{key:"trainer",label:"Field Trainer",color:C.purple},{key:"rvp",label:"RVP",color:C.success}];
  const currentStage = rvpGranted?"rvp":"trainer";

  return <div>
    {showCelebration&&<Confetti name={session.name} onClose={()=>setShowCelebration(false)}/>}

    <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:14}}>My Career Path</div>

    {/* Roadmap */}
    <div style={{background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",borderRadius:12,padding:"16px",marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.teal,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:12}}>Your Career Journey</div>
      <div style={{display:"flex",alignItems:"center",gap:0}}>
        {[{key:"new",label:"New Rep",color:C.teal},{key:"licensed",label:"Licensed",color:C.gold},{key:"trainer",label:"Field Trainer",color:C.purple},{key:"rvp",label:"RVP",color:C.success}].map((s,i)=>{
          const active=s.key===currentStage||(s.key==="trainer"&&!rvpGranted);
          const done=i<(rvpGranted?3:2);
          return <div key={s.key} style={{flex:1,textAlign:"center",position:"relative"}}>
            {i>0&&<div style={{position:"absolute",top:14,left:0,right:"50%",height:2,background:done||active?s.color:"rgba(255,255,255,0.1)"}}/>}
            {i<3&&<div style={{position:"absolute",top:14,left:"50%",right:0,height:2,background:done?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.1)"}}/>}
            <div style={{width:28,height:28,borderRadius:14,background:active?s.color:done?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.05)",border:"2px solid "+(active?s.color:done?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.1)"),margin:"0 auto 6px",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:1}}>
              {done&&<svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
              {active&&<div style={{width:10,height:10,borderRadius:5,background:"white"}}/>}
            </div>
            <div style={{fontSize:10,fontWeight:active?700:400,color:active?"white":"rgba(255,255,255,0.4)",lineHeight:1.2}}>{s.label}</div>
          </div>;
        })}
      </div>
    </div>

    {/* Recognition banner */}
    {!rvpGranted&&<div style={{background:"linear-gradient(135deg,"+C.purple+"22,"+C.gold+"11)",border:"1px solid "+C.purple+"33",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
      <div style={{fontSize:14,fontWeight:700,color:C.purple,marginBottom:6}}>You Are a Field Trainer!</div>
      <div style={{fontSize:13,color:C.text,lineHeight:1.7}}>You have earned one of the most important roles in this organization. You are not just building a business — you are changing lives and creating leaders. Your next milestone is becoming a <strong>Regional Vice President</strong>. You have what it takes!</div>
    </div>}

    {/* RVP Countdown */}
    {rvpGranted&&<div style={{background:"linear-gradient(135deg,"+C.success+"22,"+C.teal+"11)",border:"1px solid "+C.success+"33",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:14,fontWeight:700,color:C.success}}>RVP Path Unlocked!</div>
        <div style={{fontSize:13,color:C.textMid}}>Checklist {rvpPct}% complete</div>
      </div>
      <Bar pct={rvpPct} color={C.success} h={6}/>
      {myData.rvpTargetDate&&<div style={{marginTop:10,textAlign:"center"}}>
        <div style={{fontSize:28,fontWeight:800,color:countdownColor}}>{daysLeft<=0?"Time to push harder!":daysLeft+" days"}</div>
        <div style={{fontSize:13,color:C.textMid}}>until your target promotion date — {new Date(myData.rvpTargetDate+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>
        <div style={{fontSize:13,color:countdownColor,fontWeight:600,marginTop:4}}>{countdownMsg}</div>
      </div>}
    </div>}

    {/* RVP Request / Target Date */}
    {!rvpGranted&&<Card style={{marginBottom:14,border:"1px solid "+(rvpRequested?C.gold+"44":rvpDenied?C.danger+"44":C.purple+"33")}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>Request RVP Path Access</div>
      <div style={{fontSize:13,color:C.textMid,marginBottom:10,lineHeight:1.5}}>When you are consistently producing and ready to build a region, request access to the full RVP checklist. Enter your target promotion date so your team knows your commitment.</div>
      {rvpDenied&&<div style={{background:C.danger+"11",border:"1px solid "+C.danger+"33",borderRadius:8,padding:"7px 12px",fontSize:13,color:C.danger,marginBottom:10,textAlign:"center"}}>Request was not approved — speak with your RVP for next steps</div>}
      {!rvpRequested&&<div>
        <div style={{marginBottom:8}}>
          <div style={{fontSize:13,color:C.textMid,marginBottom:4}}>Target RVP Promotion Date</div>
          <input type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:14,color:C.text,boxSizing:"border-box"}}/>
        </div>
        <button onClick={()=>{
          if(!targetDate){alert("Please enter your target promotion date first");return;}
          save({rvpPathRequested:true,rvpPathDenied:false,rvpPathRequestedAt:new Date().toISOString(),rvpTargetDate:targetDate});
          setShowCelebration(true);
        }} style={{width:"100%",padding:"11px",borderRadius:9,background:"linear-gradient(135deg,"+C.purple+","+C.success+")",color:"white",border:"none",fontWeight:700,fontSize:14,cursor:"pointer"}}>
          Request RVP Path Access
        </button>
      </div>}
      {rvpRequested&&<div style={{background:C.gold+"11",border:"1px solid "+C.gold+"33",borderRadius:8,padding:"10px 12px",textAlign:"center",fontSize:13,color:C.gold,fontWeight:600}}>
        RVP Path request sent! Your target date: {myData.rvpTargetDate?new Date(myData.rvpTargetDate+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}):"Not set"}. Your RVP has been notified!
      </div>}
    </Card>}

    {/* Target date for granted */}
    {rvpGranted&&!myData.rvpTargetDate&&<Card style={{marginBottom:14,border:"1px solid "+C.gold+"33"}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>Set Your Target Promotion Date</div>
      <input type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:14,color:C.text,boxSizing:"border-box",marginBottom:8}}/>
      <button onClick={()=>save({rvpTargetDate:targetDate})} style={{width:"100%",padding:"8px",borderRadius:8,background:C.gold,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600}}>Save Date</button>
    </Card>}

    {/* RVP Goal Tracker */}
    {rvpGranted&&<Card style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:14,fontWeight:700,color:C.text}}>RVP Goals</div>
        <button onClick={()=>setEditGoals(!editGoals)} style={{fontSize:13,padding:"3px 9px",borderRadius:6,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>{editGoals?"Done":"Edit"}</button>
      </div>
      {editGoals&&<div style={{background:C.surface,borderRadius:8,padding:9,marginBottom:10}}>
        {[["premium","Monthly Premium Target $",goals.premium],["agents","Licensed Agents Goal",goals.agents],["teamSize","Team Size Goal",goals.teamSize]].map(([k,l,v])=><div key={k} style={{marginBottom:7}}>
          <div style={{fontSize:12,color:C.textMid,marginBottom:3}}>{l}</div>
          <input type="number" value={v} onChange={e=>setGoals({...goals,[k]:Number(e.target.value)})} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
        </div>)}
        <button onClick={()=>{save({rvpGoals:goals});setEditGoals(false);}} style={{width:"100%",padding:"6px",borderRadius:7,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600}}>Save Goals</button>
      </div>}
      {[
        {l:"Monthly Premium",val:"$"+totalPrem.toFixed(0),goal:"$"+(myData.rvpGoals?.premium||10000),pct:(totalPrem/(myData.rvpGoals?.premium||10000))*100,color:C.teal},
        {l:"Licensed Agents",val:licensed,goal:myData.rvpGoals?.agents||20,pct:(licensed/(myData.rvpGoals?.agents||20))*100,color:C.gold},
        {l:"Team Size",val:myReps.length,goal:myData.rvpGoals?.teamSize||30,pct:(myReps.length/(myData.rvpGoals?.teamSize||30))*100,color:C.purple},
      ].map(g=><div key={g.l} style={{marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
          <span style={{fontSize:13,color:C.textMid}}>{g.l}</span>
          <span style={{fontSize:13,fontWeight:600,color:g.pct>=100?C.success:C.text}}>{g.val} / {g.goal}</span>
        </div>
        <Bar pct={g.pct} color={g.pct>=100?C.success:g.color} h={5}/>
      </div>)}
    </Card>}

    {/* Weekly Accountability */}
    {rvpGranted&&<Card style={{marginBottom:14}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>Weekly Accountability</div>
      <div style={{fontSize:13,color:C.textMid,marginBottom:8}}>What do you commit to doing this week toward your RVP goal?</div>
      <textarea placeholder="This week I will..." value={weeklyCommit} onChange={e=>setWeeklyCommit(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:13,color:C.text,resize:"vertical",minHeight:70,boxSizing:"border-box",lineHeight:1.6,fontFamily:"inherit",marginBottom:8}}/>
      <button onClick={()=>{
        const commits=[...(myData.weeklyCommits||[]),{text:weeklyCommit,date:new Date().toISOString()}];
        save({weeklyCommits:commits});
        setWeeklyCommit("");
      }} style={{width:"100%",padding:"8px",borderRadius:8,background:C.navy,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600}}>Save Commitment</button>
      {(myData.weeklyCommits||[]).slice(-3).reverse().map((c,i)=><div key={i} style={{padding:"7px 0",borderTop:"1px solid "+C.border,marginTop:6}}>
        <div style={{fontSize:13,color:C.text}}>{c.text}</div>
        <div style={{fontSize:12,color:C.textLight,marginTop:2}}>{new Date(c.date).toLocaleDateString()}</div>
      </div>)}
    </Card>}

    {/* RVP Checklist */}
    {rvpGranted&&<div>
      <SecHead title={"RVP Checklist ("+rvpDone+"/"+rvpTotal+")"} color={C.gold}/>
      {Object.entries(getChecklistItems(data,"rvpChecklist").reduce((a,i)=>{if(!a[i.cat])a[i.cat]=[];a[i.cat].push(i);return a;},{})).map(([cat,items])=><div key={cat}>
        <SecHead title={cat} color={C.gold}/>
        {items.map(item=><CheckItem key={item.id} item={item}
          checked={!!(myData.rvpChecked||{})[item.id]}
          onToggle={()=>save({rvpChecked:{...(myData.rvpChecked||{}),[item.id]:!(myData.rvpChecked||{})[item.id]}})}/>)}
      </div>)}
    </div>}

    {/* Team overview */}
    {rvpGranted&&myReps.length>0&&<Card style={{marginTop:14}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:10}}>My Team</div>
      {myReps.map((r,i)=>{
        const cl=TRACK_TO_CHECKLIST_KEY[r.track]?getChecklistItems(data,TRACK_TO_CHECKLIST_KEY[r.track]):[];
        const done=cl.filter(item=>(r.checked||{})[item.id]).length;
        const pct=cl.length>0?Math.round((done/cl.length)*100):0;
        return <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7,padding:"7px 0",borderBottom:i<myReps.length-1?"1px solid "+C.border:"none"}}>
          <div style={{width:28,height:28,borderRadius:7,background:C.teal+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.teal,flexShrink:0}}>{r.name?.charAt(0)?.toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
            <Bar pct={pct} color={TRACK_INFO[r.track]?.color||C.teal} h={3}/>
          </div>
          <div style={{fontSize:13,fontWeight:600,color:pct===100?C.success:C.textMid}}>{pct}%</div>
        </div>;
      })}
    </Card>}
  </div>;
}



// ── SIDEBAR PHOTO UPLOAD ──
function SidebarPhotoUpload({userId,data,onUpdateData}) {
  const profilePhotos = (data&&data.profilePhotos)||{};
  const photo = profilePhotos[userId]||null;
  const [showLightbox,setShowLightbox] = useState(false);
  const handle = (e) => {
    const file=e.target.files[0]; if(!file) return;
    if(file.size>5*1024*1024){alert("Photo must be under 5MB");return;}
    const reader=new FileReader();
    reader.onload=ev=>{
      if(onUpdateData&&data) onUpdateData({...data,profilePhotos:{...profilePhotos,[userId]:ev.target.result}});
    };
    reader.readAsDataURL(file);
  };
  const remove = () => {
    if(onUpdateData&&data){
      const updated=Object.assign({},profilePhotos);
      delete updated[userId];
      onUpdateData({...data,profilePhotos:updated});
    }
  };
  return <div style={{position:"relative",flexShrink:0}}>
    {showLightbox&&photo&&<div onClick={()=>setShowLightbox(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{maxWidth:280,width:"100%",textAlign:"center"}}>
        <img src={photo} style={{width:"100%",borderRadius:12,marginBottom:12}}/>
        <div style={{display:"flex",gap:8,justifyContent:"center"}}>
          <label style={{padding:"7px 14px",borderRadius:8,background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>
            Change<input type="file" accept="image/*" style={{display:"none"}} onChange={handle}/>
          </label>
          <button onClick={remove} style={{padding:"7px 14px",borderRadius:8,background:C.danger+"22",color:C.danger,border:"none",cursor:"pointer",fontSize:13}}>Remove</button>
          <button onClick={()=>setShowLightbox(false)} style={{padding:"7px 14px",borderRadius:8,background:"rgba(255,255,255,0.1)",color:"white",border:"none",cursor:"pointer",fontSize:13}}>Close</button>
        </div>
      </div>
    </div>}
    {photo
      ?<img src={photo} onClick={()=>setShowLightbox(true)} style={{width:32,height:32,borderRadius:9,objectFit:"cover",border:"2px solid "+C.teal+"66",cursor:"pointer"}}/>
      :<label style={{width:32,height:32,borderRadius:9,background:C.teal+"33",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",border:"1px dashed "+C.teal+"55",flexShrink:0}}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
        <input type="file" accept="image/*" style={{display:"none"}} onChange={handle}/>
      </label>}
  </div>;
}


// ── MY PROFILE PAGE ──
// ── MY ACTIVITY REPORT (for admins/trainers to view their own production + coaching) ──
function MyActivityReport({session,data,onUpdate}) {
  const userId = session?.id;
  const isTrainerRole = (data.trainers||[]).some(t=>t.id===userId);
  const staffRecord = (data.trainers||[]).find(t=>t.id===userId) || (data.admins||[]).find(a=>a.id===userId) || (data.reps||[]).find(r=>r.id===userId) || {};
  const myProd = (data.myProduction||{})[userId] || {};
  const lifeApps = myProd.lifeApps || [];
  const investments = myProd.investments || [];
  const parseLump = v => Number(String(v||"").replace(/[$,]/g,""))||0;

  // ── This month boundaries ──
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartStr = monthStart.toISOString().split("T")[0];
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const dayOfMonth = now.getDate();
  const monthPct = Math.round((dayOfMonth/daysInMonth)*100);

  // ── Recruits this month ──
  const myRecruits = (data.reps||[]).filter(r => r.trainerId===userId&&!r.excludeFromRecruitCount);
  const recruitsThisMonth = myRecruits.filter(r => r.createdAt && new Date(r.createdAt) >= monthStart);

  // ── Life apps / premium this month ──
  const lifeAppsThisMonth = lifeApps.filter(a => a.date && a.date >= monthStartStr);
  const totalPremiumMonth = lifeAppsThisMonth.reduce((s,a)=>s+(Number(a.premium)||0),0);
  const annualPremiumMonth = totalPremiumMonth * 12;

  // ── Investments this month ──
  const investmentsThisMonth = investments.filter(i => i.date && (()=>{
    try{ return new Date(i.date) >= monthStart; }catch(e){ return false; }
  })());
  const pacMonth = investments.reduce((s,i)=>s+(Number(i.pac)||0),0); // running total (not date filtered — PAC is ongoing)
  const pacCount = investments.filter(i=>Number(i.pac)>0).length; // total # of PAC accounts
  const lumpMonth = investmentsThisMonth.reduce((s,i)=>s+parseLump(i.lumpSum),0);

  // ── Scorecard — this week + this month ──
  const scorecardAll = (data.scorecards||{})[userId] || {};
  const currentWeekKey = getWeekStart();
  // Sums a week's scorecard total for a category — new daily-bucketed weeks get summed
  // from their days, older weeks (before the daily system existed) fall back to the flat
  // field they were originally saved with, so nothing from before the rewrite is lost.
  const legacyAwareWeekTotal=(weekData,key)=>{
    const dayList=Object.values((weekData&&weekData.days)||{});
    if(dayList.length>0) return dayList.reduce((s,d)=>s+(Number(d.actual?.[key])||0),0);
    return Number(weekData?.[key])||0;
  };
  const scorecardWeek = {
    contacts: legacyAwareWeekTotal(scorecardAll[currentWeekKey],"contacts"),
    apptSet: legacyAwareWeekTotal(scorecardAll[currentWeekKey],"apptSet"),
    apptDone: legacyAwareWeekTotal(scorecardAll[currentWeekKey],"apptDone"),
  };
  const scorecardMonth = Object.entries(scorecardAll).reduce((s,[wk,d])=>{
    try {
      const wkDate = new Date(wk+"T12:00:00");
      if(wkDate.getMonth()===now.getMonth() && wkDate.getFullYear()===now.getFullYear()){
        s.contacts += legacyAwareWeekTotal(d,"contacts");
        s.apptSet += legacyAwareWeekTotal(d,"apptSet");
        s.apptDone += legacyAwareWeekTotal(d,"apptDone");
      }
    } catch(e){}
    return s;
  },{contacts:0,apptSet:0,apptDone:0});
  // ── Yesterday ──
  const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate()-1);
  const yesterdayStr = localDateStr(yesterdayDate);
  const yesterdayWeekKey = getWeekStart(yesterdayDate);
  const yesterdayEntry = (scorecardAll[yesterdayWeekKey]?.days||{})[yesterdayStr] || {committed:{},actual:{}};
  const scorecardYesterday = {
    contacts: getScorecardActual(data,userId,yesterdayStr,"contacts",yesterdayEntry),
    apptSet: getScorecardActual(data,userId,yesterdayStr,"apptSet",yesterdayEntry),
    apptDone: getScorecardActual(data,userId,yesterdayStr,"apptDone",yesterdayEntry),
  };
  const yesterdayLabel = yesterdayDate.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});

  // ── Goals ──
  const incomeGoal = Number(staffRecord.monthlyIncomeGoal)||0;
  const pacGoal = Number(myProd.monthlyPACGoal)||0;
  const pacCountGoal = Number(myProd.monthlyPACCountGoal)||0;
  const lumpGoal = Number(myProd.monthlyLumpGoal)||0;
  const PROMO_LEVELS = [{key:"rep",pct:25},{key:"sr_rep",pct:35},{key:"dl",pct:50},{key:"divl",pct:60},{key:"rl",pct:70},{key:"srl",pct:80},{key:"rvp",pct:110}];
  const promo = PROMO_LEVELS.find(p=>p.key===(staffRecord.promotionLevel||"rep")) || PROMO_LEVELS[0];
  const annualEarned = ((totalPremiumMonth*12) - 65) * (promo.pct/100);
  const upfrontEarned = annualEarned > 0 ? annualEarned * (9/12) : 0;

  // ── Monthly Production Archive — snapshots the numbers above so admins can look back ──
  const monthlyArchive = ((data.monthlyProductionArchive||{})[userId])||[];
  const [showMonthlyArchive,setShowMonthlyArchive]=useState(false);
  const currentMonthLabel = now.toLocaleDateString("en-US",{month:"long",year:"numeric"});
  const alreadyArchivedThisMonth = monthlyArchive.some(m=>m.monthLabel===currentMonthLabel);
  const archiveThisMonth = () => {
    if(typeof onUpdate!=="function") return;
    if(alreadyArchivedThisMonth&&!window.confirm(`You already archived ${currentMonthLabel}. Save another snapshot with today's numbers anyway?`)) return;
    const snapshot = {
      id:Date.now(),
      archivedAt:Date.now(),
      monthLabel:currentMonthLabel,
      incomeGoal, incomeEarned:Math.round(upfrontEarned),
      pacGoal, pacActual:Math.round(pacMonth),
      pacCountGoal, pacCountActual:pacCount,
      lumpGoal, lumpActual:Math.round(lumpMonth),
      premiumThisMonth:Math.round(totalPremiumMonth),
      recruitsThisMonth:recruitsThisMonth.length,
    };
    onUpdate({...data,monthlyProductionArchive:{...(data.monthlyProductionArchive||{}),[userId]:[snapshot,...monthlyArchive]}});
  };
  const deleteMonthlySnapshot=(id)=>{
    if(!window.confirm("Delete this archived month? This cannot be undone.")) return;
    onUpdate({...data,monthlyProductionArchive:{...(data.monthlyProductionArchive||{}),[userId]:monthlyArchive.filter(m=>m.id!==id)}});
  };

  // ── Conversion ratios (from this month's scorecard) ──
  const contactToApptRate = scorecardMonth.contacts>0 ? (scorecardMonth.apptSet/scorecardMonth.contacts) : 0;
  const apptToShowRate = scorecardMonth.apptSet>0 ? (scorecardMonth.apptDone/scorecardMonth.apptSet) : 0;

  // ── Coaching engine — rule based ──
  const coaching = [];

  // Income goal coaching
  if (incomeGoal > 0) {
    const incomePct = Math.round((upfrontEarned/incomeGoal)*100);
    const expectedPct = monthPct;
    if (incomePct < expectedPct - 10) {
      const gap = incomeGoal - upfrontEarned;
      const avgPerApp = lifeAppsThisMonth.length>0 ? totalPremiumMonth/lifeAppsThisMonth.length : 0;
      const appsNeeded = avgPerApp>0 ? Math.ceil((gap/(promo.pct/100)/12*(12/9))/avgPerApp) : null;
      coaching.push({
        type:"income",
        severity: incomePct < expectedPct - 25 ? "high" : "medium",
        title: "Income Goal Behind Pace",
        detail: `You've earned $${Math.round(upfrontEarned).toLocaleString()} of your $${incomeGoal.toLocaleString()} goal (${incomePct}%) with ${monthPct}% of the month gone.`,
        action: appsNeeded
          ? `Based on your average premium per app this month, you'd need approximately ${appsNeeded} more life ${appsNeeded===1?"app":"apps"} to close the gap.`
          : `Log a few more life apps this month to start building toward your goal.`
      });
    }
  }

  // PAC count goal coaching
  if (pacCountGoal > 0) {
    const pacCountPct = Math.round((pacCount/pacCountGoal)*100);
    if (pacCountPct < monthPct - 10) {
      const gap = pacCountGoal - pacCount;
      coaching.push({
        type:"paccount",
        severity: pacCountPct < monthPct - 25 ? "high" : "medium",
        title:"PAC Count Behind Pace",
        detail:`Your goal is ${pacCountGoal} PAC accounts this month — you've opened ${pacCount} (${pacCountPct}%) with ${monthPct}% of the month gone.`,
        action: `You need ${gap} more PAC ${gap===1?"account":"accounts"} this month. Focus conversations on setting up automatic monthly contributions with clients, even at smaller amounts — count matters as much as dollar size for this goal.`
      });
    }
  }

  // PAC goal coaching
  if (pacGoal > 0) {
    const pacPct = Math.round((pacMonth/pacGoal)*100);
    if (pacPct < monthPct - 10) {
      const gap = pacGoal - pacMonth;
      const avgPACPerClient = investmentsThisMonth.length>0 ? investmentsThisMonth.reduce((s,i)=>s+(Number(i.pac)||0),0)/investmentsThisMonth.length : 0;
      const clientsNeeded = avgPACPerClient>0 ? Math.ceil(gap/avgPACPerClient) : null;
      coaching.push({
        type:"pac",
        severity: pacPct < monthPct - 25 ? "high" : "medium",
        title:"PAC $ Goal Behind Pace",
        detail:`Your PAC dollar goal is $${pacGoal.toLocaleString()}/mo — you're at $${Math.round(pacMonth).toLocaleString()}/mo (${pacPct}%). You're $${Math.round(gap).toLocaleString()}/mo behind your goal.`,
        action: clientsNeeded
          ? `At your average of $${Math.round(avgPACPerClient).toLocaleString()}/mo PAC per new client this month, you'd need about ${clientsNeeded} more ${clientsNeeded===1?"client":"clients"} on PAC to hit your goal.`
          : `Focus on setting up new PAC accounts with clients — no new PAC clients logged yet this month.`
      });
    }
  }

  // Lump Sum goal coaching
  if (lumpGoal > 0) {
    const lumpPct = Math.round((lumpMonth/lumpGoal)*100);
    if (lumpPct < monthPct - 10) {
      const gap = lumpGoal - lumpMonth;
      const lumpClients = investmentsThisMonth.filter(i=>parseLump(i.lumpSum)>0);
      const avgLumpPerClient = lumpClients.length>0 ? lumpMonth/lumpClients.length : 0;
      const clientsNeeded = avgLumpPerClient>0 ? Math.ceil(gap/avgLumpPerClient) : null;
      coaching.push({
        type:"lump",
        severity: lumpPct < monthPct - 25 ? "high" : "medium",
        title:"Lump Sum Goal Behind Pace",
        detail:`Your Lump Sum goal is $${lumpGoal.toLocaleString()} this month — you're at $${Math.round(lumpMonth).toLocaleString()} (${lumpPct}%) with ${monthPct}% of the month gone. You're $${Math.round(gap).toLocaleString()} behind pace.`,
        action: clientsNeeded
          ? `At your average of $${Math.round(avgLumpPerClient).toLocaleString()} per lump sum client this month, you'd need about ${clientsNeeded} more ${clientsNeeded===1?"client":"clients"} to hit your goal.`
          : `Focus on rollover and lump sum conversations — no lump sum deposits logged yet this month.`
      });
    }
  }

  // Scorecard coaching — contacts
  const weeksElapsedThisMonth = Math.ceil(dayOfMonth/7);
  const expectedContacts = 100 * weeksElapsedThisMonth;
  if (scorecardMonth.contacts < expectedContacts * 0.7 && weeksElapsedThisMonth > 0) {
    coaching.push({
      type:"contacts",
      severity:"medium",
      title:"Contacts Below Weekly Pace",
      detail:`Your scorecard goal is 100 contacts/week. This month you've logged ${scorecardMonth.contacts} contacts across ${weeksElapsedThisMonth} week${weeksElapsedThisMonth!==1?"s":""} (expected ~${expectedContacts}).`,
      action:`Increasing contacts directly drives your pipeline — every other number on this report starts here. Block dedicated prospecting time on your Daily Planner.`
    });
  }

  // Scorecard coaching — appt set rate
  if (scorecardMonth.contacts >= 20 && contactToApptRate < 0.15) {
    coaching.push({
      type:"conversion",
      severity:"medium",
      title:"Contact-to-Appointment Rate Low",
      detail:`Out of ${scorecardMonth.contacts} contacts this month, only ${scorecardMonth.apptSet} became appointments (${Math.round(contactToApptRate*100)}%). A healthy rate is typically 1 appointment per 5 contacts (20%).`,
      action:`Review your prospecting approach — consider practicing your opener in Prospecting Training or your closes in Objection Training to improve this conversion.`
    });
  }

  // Scorecard coaching — show rate
  if (scorecardMonth.apptSet >= 5 && apptToShowRate < 0.6) {
    coaching.push({
      type:"showrate",
      severity:"medium",
      title:"Appointment Show Rate Needs Attention",
      detail:`Of ${scorecardMonth.apptSet} appointments set this month, only ${scorecardMonth.apptDone} were completed (${Math.round(apptToShowRate*100)}% show rate).`,
      action:`Consider confirming appointments 24 hours in advance and anchoring the appointment time clearly when booking — this typically improves show rate.`
    });
  }

  // Recruiting coaching
  if (recruitsThisMonth.length === 0 && dayOfMonth > 10) {
    coaching.push({
      type:"recruiting",
      severity:"low",
      title:"No Recruits Logged This Month Yet",
      detail:`It's day ${dayOfMonth} of the month and no new recruits have been added under your name.`,
      action:`If recruiting is part of your goals this month, revisit your warm market list or use the Prospecting Training scripts to restart conversations.`
    });
  }

  const hasGoalsSet = incomeGoal>0 || pacGoal>0 || pacCountGoal>0 || lumpGoal>0;
  const hasCoaching = coaching.length>0;

  return <div style={{ maxWidth:700, margin:"0 auto" }}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap",marginBottom:4}}>
      <div style={{ fontSize:dv(19,24), fontWeight:800, color:C.text }}>📊 My Activity Report</div>
      <button onClick={archiveThisMonth} style={{fontSize:12,padding:"5px 11px",borderRadius:8,border:`1px solid ${C.teal}`,background:C.teal+"11",color:C.teal,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>{alreadyArchivedThisMonth?"Save Another Snapshot":"Archive This Month"}</button>
    </div>
    <div style={{ fontSize:13, color:C.textMid, marginBottom:16 }}>
      {now.toLocaleDateString("en-US",{month:"long",year:"numeric"})} — Day {dayOfMonth} of {daysInMonth} ({monthPct}% of month elapsed)
    </div>

    {/* Monthly Production Archive viewer */}
    {monthlyArchive.length>0&&<div style={{marginBottom:16}}>
      <button onClick={()=>setShowMonthlyArchive(!showMonthlyArchive)} style={{fontSize:13,fontWeight:700,color:C.text,background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:6,marginBottom:showMonthlyArchive?10:0}}>
        <span style={{transform:showMonthlyArchive?"rotate(90deg)":"none",display:"inline-block",fontSize:11}}>▶</span>
        Archived Months ({monthlyArchive.length})
      </button>
      {showMonthlyArchive&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
        {monthlyArchive.map(m=><div key={m.id} style={{border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",background:C.surface||"#f8fafc"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text}}>{m.monthLabel}</div>
            <button onClick={()=>deleteMonthlySnapshot(m.id)} style={{fontSize:11,padding:"3px 8px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textLight,cursor:"pointer",flexShrink:0}}>Delete</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:6,marginTop:6,fontSize:12,color:C.textMid}}>
            {m.incomeGoal>0&&<div>Income: <b style={{color:C.text}}>${m.incomeEarned.toLocaleString()}</b> / ${m.incomeGoal.toLocaleString()}</div>}
            {m.pacGoal>0&&<div>PAC $: <b style={{color:C.text}}>${m.pacActual.toLocaleString()}</b> / ${m.pacGoal.toLocaleString()}</div>}
            {m.pacCountGoal>0&&<div>PAC Accounts: <b style={{color:C.text}}>{m.pacCountActual}</b> / {m.pacCountGoal}</div>}
            {m.lumpGoal>0&&<div>Lump Sum: <b style={{color:C.text}}>${m.lumpActual.toLocaleString()}</b> / ${m.lumpGoal.toLocaleString()}</div>}
            <div>Premium: <b style={{color:C.text}}>${m.premiumThisMonth.toLocaleString()}</b></div>
            <div>New Recruits: <b style={{color:C.text}}>{m.recruitsThisMonth}</b></div>
          </div>
        </div>)}
      </div>}
    </div>}

    {/* Coaching Section — shown first if there's anything to flag */}
    {hasCoaching && <Card style={{ marginBottom:16, border:`2px solid ${C.gold}55` }}>
      <div style={{ fontSize:14, fontWeight:800, color:"#b45309", marginBottom:10 }}>🎯 Where You May Be Lagging</div>
      {coaching.map((c,i) => <div key={i} style={{ marginBottom: i<coaching.length-1?12:0, paddingBottom: i<coaching.length-1?12:0, borderBottom: i<coaching.length-1?`1px solid ${C.border}`:"none" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
          <span style={{ fontSize:14 }}>{c.severity==="high"?"🔴":c.severity==="medium"?"🟡":"🔵"}</span>
          <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{c.title}</div>
        </div>
        <div style={{ fontSize:12, color:C.textMid, lineHeight:1.6, marginBottom:5 }}>{c.detail}</div>
        <div style={{ fontSize:12, color:C.teal, lineHeight:1.6, background:C.teal+"0c", borderRadius:7, padding:"7px 10px" }}>💡 {c.action}</div>
      </div>)}
    </Card>}

    {!hasCoaching && hasGoalsSet && <Card style={{ marginBottom:16, border:`2px solid ${C.success}55`, background:C.success+"08" }}>
      <div style={{ fontSize:14, fontWeight:800, color:C.success }}>✅ On Pace</div>
      <div style={{ fontSize:12, color:C.textMid, marginTop:4 }}>You're tracking well against your goals this month. Keep up the consistency.</div>
    </Card>}

    {!hasGoalsSet && <Card style={{ marginBottom:16, border:`1px solid ${C.gold}33`, background:C.gold+"06" }}>
      <div style={{ fontSize:13, fontWeight:700, color:"#b45309" }}>⏳ No Goals Set Yet</div>
      <div style={{ fontSize:12, color:C.textMid, marginTop:4 }}>Set a Monthly Income Goal and Monthly Investment Goal in your Production tab to unlock personalized coaching here.</div>
    </Card>}

    {/* Income */}
    <Card style={{ marginBottom:12 }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:8 }}>💰 Income & Life Apps</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        <div style={{ background:C.teal+"11", borderRadius:8, padding:"8px 10px" }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.teal }}>{lifeAppsThisMonth.length}</div>
          <div style={{ fontSize:11, color:C.textMid }}>Life Apps This Month</div>
        </div>
        <div style={{ background:C.gold+"11", borderRadius:8, padding:"8px 10px" }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.gold }}>${Math.round(totalPremiumMonth).toLocaleString()}/mo</div>
          <div style={{ fontSize:11, color:C.textMid }}>Premium Written</div>
        </div>
        <div style={{ background:C.purple+"11", borderRadius:8, padding:"8px 10px" }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.purple }}>${Math.round(upfrontEarned).toLocaleString()}</div>
          <div style={{ fontSize:11, color:C.textMid }}>Earned This Month (Upfront)</div>
        </div>
        <div style={{ background:C.success+"11", borderRadius:8, padding:"8px 10px" }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.success }}>{incomeGoal>0?Math.round((upfrontEarned/incomeGoal)*100)+"%":"—"}</div>
          <div style={{ fontSize:11, color:C.textMid }}>Income Goal Progress{incomeGoal>0?` ($${incomeGoal.toLocaleString()})`:""}</div>
        </div>
      </div>
    </Card>

    {/* Investments */}
    <Card style={{ marginBottom:12 }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:8 }}>📈 Investments</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
        <div style={{ background:C.teal+"11", borderRadius:8, padding:"8px 10px" }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.teal }}>{investmentsThisMonth.length}</div>
          <div style={{ fontSize:11, color:C.textMid }}>New Clients This Month</div>
        </div>
        <div style={{ background:C.purple+"11", borderRadius:8, padding:"8px 10px" }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.purple }}>{pacCount}</div>
          <div style={{ fontSize:11, color:C.textMid }}>PAC Accounts (Total)</div>
        </div>
        <div style={{ background:C.gold+"11", borderRadius:8, padding:"8px 10px" }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.gold }}>${Math.round(pacMonth).toLocaleString()}/mo</div>
          <div style={{ fontSize:11, color:C.textMid }}>Total PAC $ (Running)</div>
        </div>
        <div style={{ background:C.purple+"11", borderRadius:8, padding:"8px 10px" }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.purple }}>${Math.round(lumpMonth).toLocaleString()}</div>
          <div style={{ fontSize:11, color:C.textMid }}>Lump Sum This Month</div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {pacCountGoal>0&&<div style={{ background:C.success+"11", borderRadius:8, padding:"8px 10px" }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.success }}>{Math.round((pacCount/pacCountGoal)*100)}%</div>
          <div style={{ fontSize:11, color:C.textMid }}>PAC Count Goal ({pacCount}/{pacCountGoal})</div>
        </div>}
        {pacGoal>0&&<div style={{ background:C.success+"11", borderRadius:8, padding:"8px 10px" }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.success }}>{Math.round((pacMonth/pacGoal)*100)}%</div>
          <div style={{ fontSize:11, color:C.textMid }}>PAC $ Goal Progress (${pacGoal.toLocaleString()}/mo)</div>
        </div>}
        {lumpGoal>0&&<div style={{ background:C.success+"11", borderRadius:8, padding:"8px 10px" }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.success }}>{Math.round((lumpMonth/lumpGoal)*100)}%</div>
          <div style={{ fontSize:11, color:C.textMid }}>Lump Sum Goal Progress (${lumpGoal.toLocaleString()})</div>
        </div>}
      </div>
    </Card>

    {/* Scorecard */}
    <Card style={{ marginBottom:12 }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:8 }}>📋 Scorecard</div>
      <div style={{ fontSize:11, fontWeight:700, color:C.textMid, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px" }}>Yesterday <span style={{textTransform:"none",fontWeight:400,color:C.textLight}}>({yesterdayLabel})</span></div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:12 }}>
        <div style={{ background:C.gold+"11", borderRadius:8, padding:"7px 8px", textAlign:"center" }}><div style={{ fontSize:14, fontWeight:700, color:C.gold }}>{scorecardYesterday.contacts}</div><div style={{ fontSize:10, color:C.textMid }}>Contacts</div></div>
        <div style={{ background:C.gold+"11", borderRadius:8, padding:"7px 8px", textAlign:"center" }}><div style={{ fontSize:14, fontWeight:700, color:C.gold }}>{scorecardYesterday.apptSet}</div><div style={{ fontSize:10, color:C.textMid }}>Appts Set</div></div>
        <div style={{ background:C.gold+"11", borderRadius:8, padding:"7px 8px", textAlign:"center" }}><div style={{ fontSize:14, fontWeight:700, color:C.gold }}>{scorecardYesterday.apptDone}</div><div style={{ fontSize:10, color:C.textMid }}>Appts Done</div></div>
      </div>
      <div style={{ fontSize:11, fontWeight:700, color:C.textMid, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px" }}>This Week</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:12 }}>
        <div style={{ background:C.surface, borderRadius:8, padding:"7px 8px", textAlign:"center" }}><div style={{ fontSize:14, fontWeight:700, color:C.text }}>{scorecardWeek.contacts}<span style={{fontSize:11,color:C.textLight}}>/100</span></div><div style={{ fontSize:10, color:C.textMid }}>Contacts</div></div>
        <div style={{ background:C.surface, borderRadius:8, padding:"7px 8px", textAlign:"center" }}><div style={{ fontSize:14, fontWeight:700, color:C.text }}>{scorecardWeek.apptSet}<span style={{fontSize:11,color:C.textLight}}>/20</span></div><div style={{ fontSize:10, color:C.textMid }}>Appts Set</div></div>
        <div style={{ background:C.surface, borderRadius:8, padding:"7px 8px", textAlign:"center" }}><div style={{ fontSize:14, fontWeight:700, color:C.text }}>{scorecardWeek.apptDone}<span style={{fontSize:11,color:C.textLight}}>/20</span></div><div style={{ fontSize:10, color:C.textMid }}>Appts Done</div></div>
      </div>
      <div style={{ fontSize:11, fontWeight:700, color:C.textMid, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px" }}>This Month (Total)</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
        <div style={{ background:C.purple+"11", borderRadius:8, padding:"7px 8px", textAlign:"center" }}><div style={{ fontSize:14, fontWeight:700, color:C.purple }}>{scorecardMonth.contacts}</div><div style={{ fontSize:10, color:C.textMid }}>Contacts</div></div>
        <div style={{ background:C.purple+"11", borderRadius:8, padding:"7px 8px", textAlign:"center" }}><div style={{ fontSize:14, fontWeight:700, color:C.purple }}>{scorecardMonth.apptSet}</div><div style={{ fontSize:10, color:C.textMid }}>Appts Set</div></div>
        <div style={{ background:C.purple+"11", borderRadius:8, padding:"7px 8px", textAlign:"center" }}><div style={{ fontSize:14, fontWeight:700, color:C.purple }}>{scorecardMonth.apptDone}</div><div style={{ fontSize:10, color:C.textMid }}>Appts Done</div></div>
      </div>
    </Card>

    {/* Recruiting */}
    <Card style={{ marginBottom:12 }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:8 }}>🤝 Recruiting</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        <div style={{ background:C.teal+"11", borderRadius:8, padding:"8px 10px" }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.teal }}>{recruitsThisMonth.length}</div>
          <div style={{ fontSize:11, color:C.textMid }}>Recruits This Month</div>
        </div>
        <div style={{ background:C.gold+"11", borderRadius:8, padding:"8px 10px" }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.gold }}>{myRecruits.length}</div>
          <div style={{ fontSize:11, color:C.textMid }}>Total Active Recruits</div>
        </div>
      </div>
    </Card>
  </div>;
}

function MyProfilePage({session,data,onUpdate}) {
  const profilePhotos = data.profilePhotos||{};
  const photo = (()=>{
    try{const ls=localStorage.getItem("profilePhoto_"+session.id);if(ls)return ls;}catch(e){}
    return profilePhotos[session.id]||null;
  })();
  const [showLightbox,setShowLightbox] = useState(false);

  const handleUpload = (e) => {
    const file=e.target.files[0]; if(!file) return;
    if(file.size>10*1024*1024){alert("Photo must be under 10MB");return;}
    const reader=new FileReader();
    reader.onload=ev=>{
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement("canvas");
        const MAX=200;
        let w=img.width,h=img.height;
        if(w>h){if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}}
        else{if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}}
        canvas.width=w;canvas.height=h;
        canvas.getContext("2d").drawImage(img,0,0,w,h);
        const compressed=canvas.toDataURL("image/jpeg",0.4);
        try{localStorage.setItem("profilePhoto_"+session.id,compressed);}catch(ex){}
        onUpdate({...data,profilePhotos:{...profilePhotos,[session.id]:compressed}});
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const remove = () => {
    const updated = Object.assign({},profilePhotos);
    delete updated[session.id];
    try{localStorage.removeItem("profilePhoto_"+session.id);}catch(e){}
    onUpdate({...data,profilePhotos:updated});
  };

  return <div>
    {showLightbox&&photo&&<div onClick={()=>setShowLightbox(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{maxWidth:340,width:"100%",textAlign:"center"}}>
        <img src={photo} alt="Profile" style={{width:"100%",borderRadius:14,marginBottom:14,boxShadow:"0 10px 40px rgba(0,0,0,0.5)"}}/>
        <div style={{display:"flex",gap:8,justifyContent:"center"}}>
          <label style={{padding:"8px 16px",borderRadius:8,background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>
            Change Photo<input type="file" accept="image/*" style={{display:"none"}} onChange={handleUpload}/>
          </label>
          <button onClick={remove} style={{padding:"8px 16px",borderRadius:8,background:C.danger+"22",color:C.danger,border:"none",cursor:"pointer",fontSize:13,fontWeight:600}}>Remove</button>
          <button onClick={()=>setShowLightbox(false)} style={{padding:"8px 16px",borderRadius:8,background:"rgba(255,255,255,0.1)",color:"white",border:"none",cursor:"pointer",fontSize:13}}>Close</button>
        </div>
      </div>
    </div>}

    <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:4}}>My Profile</div>
    <div style={{fontSize:13,color:C.textMid,marginBottom:20}}>Your profile photo is used for Wall of Fame recognition and team displays.</div>

    <Card style={{marginBottom:14}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>Profile Photo</div>
      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
        {photo
          ?<img src={photo} onClick={()=>setShowLightbox(true)} style={{width:80,height:80,borderRadius:12,objectFit:"cover",border:"2px solid "+C.teal,cursor:"pointer",flexShrink:0}}/>
          :<div style={{width:80,height:80,borderRadius:12,background:C.teal+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:800,color:C.teal,border:"2px dashed "+C.teal+"44",flexShrink:0}}>
            {session.name?.charAt(0)?.toUpperCase()}
          </div>}
        <div style={{flex:1}}>
          <div style={{fontSize:13,color:C.textMid,marginBottom:10,lineHeight:1.6}}>{photo?"Click your photo to view full size, or use the buttons below to update it.":"Upload a professional headshot. This photo will be used when you are recognized on the Wall of Fame."}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              {photo?"Change Photo":"Upload Photo"}
              <input type="file" accept="image/*" style={{display:"none"}} onChange={handleUpload}/>
            </label>
            {photo&&<button onClick={remove} style={{padding:"7px 14px",borderRadius:8,background:C.danger+"11",color:C.danger,border:"1px solid "+C.danger+"33",cursor:"pointer",fontSize:13,fontWeight:600}}>Remove</button>}
            {photo&&<button onClick={()=>setShowLightbox(true)} style={{padding:"7px 14px",borderRadius:8,background:C.surface,color:C.textMid,border:"1px solid "+C.border,cursor:"pointer",fontSize:13}}>View Full Size</button>}
          </div>
        </div>
      </div>
    </Card>

    <ProfileRepIdCard session={session} data={data} onUpdate={onUpdate}/>

    <Card>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:10}}>Account Info</div>
      {[{l:"Name",v:session.name},{l:"Role",v:session.role?.charAt(0)?.toUpperCase()+session.role?.slice(1)},{l:"App",v:"NextLevel Field Training Hub"}].map((item,i)=><div key={i} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:i<2?"1px solid "+C.border:"none"}}>
        <span style={{fontSize:13,color:C.textMid,width:60,flexShrink:0}}>{item.l}</span>
        <span style={{fontSize:13,fontWeight:600,color:C.text}}>{item.v}</span>
      </div>)}
    </Card>
  </div>;
}

function ProfileRepIdCard({session,data,onUpdate}) {
  const {arr,rec:myRecord} = findMyRecordForLinks(data,session);
  const savedRepId = myRecord?.primericaRepId||"";
  const [repIdDraft,setRepIdDraft] = useState(savedRepId);
  useEffect(()=>{ setRepIdDraft(savedRepId); },[savedRepId]);
  const saveRepId = () => {
    if(!myRecord||typeof onUpdate!=="function") return;
    const updatedArr = (data[arr]||[]).map(x=>x.id===myRecord.id?{...x,primericaRepId:repIdDraft.trim()}:x);
    onUpdate({...data,[arr]:updatedArr});
  };
  return <Card style={{marginBottom:14,border:!savedRepId?`1px solid ${C.danger}`:undefined,background:!savedRepId?C.danger+"0a":undefined}}>
    <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:2}}>Your Primerica Rep ID {!savedRepId&&<span style={{color:C.danger,fontSize:13}}>(required)</span>}</div>
    <div style={{fontSize:12,color:C.textMid,marginBottom:8,lineHeight:1.4}}>The Rep ID Primerica issued you when you joined. This makes sure you get credit when you share your video links — required so teammates with the same name don't get mixed up.</div>
    <div style={{display:"flex",gap:6}}>
      <input value={repIdDraft} onChange={e=>setRepIdDraft(e.target.value)} placeholder="e.g. 12345678" style={{flex:1,padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}/>
      <button onClick={saveRepId} style={{padding:"7px 14px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>Save</button>
    </div>
  </Card>;
}


// ── WALL OF FAME BANNER (scrollable strip) ──
function WallOfFameBanner({data}) {
  const pm=getCurrentPrimerMonth(data.primerMonthEnds||[]);
  const recognitions = (data.wallOfFame||[]).filter(r=>r.postedAt&&r.postedAt>=pm.start);
  if(recognitions.length===0) return null;
  const FAME_COLORS_B = {"First Life App":C.teal,"Licensed!":C.gold,"Top Producer":C.success,"Field Trainer Approved":C.purple,"Recruiter of the Month":C.teal,"Most Improved":C.gold,"Going Above and Beyond":C.success,"Custom":C.textMid};

  const getPhotoB = (r) => {
    if(r.customPhoto) return r.customPhoto;
    const wofPhotos = data.wofPhotos||{};
    if(wofPhotos[r.personId]) return wofPhotos[r.personId];
    const profilePhotos2 = data.profilePhotos||{};
    if(profilePhotos2[r.personId]) return profilePhotos2[r.personId];
    try{const ls=localStorage.getItem("profilePhoto_"+r.personId);if(ls)return ls;}catch(e){}
    const rep = (data.reps||[]).find(rp=>rp.id===r.personId);
    if(rep?.dgoPhoto) return rep.dgoPhoto;
    try{const ls=localStorage.getItem("dgoPhoto_"+r.personId);if(ls)return ls;}catch(e){}
    const trainer = (data.trainers||[]).find(t=>t.id===r.personId);
    if(trainer?.photo) return trainer.photo;
    const admin = (data.admins||[]).find(a=>a.id===r.personId);
    if(admin?.photo) return admin.photo;
    return null;
  };

  return <div style={{marginBottom:12}}>
    <div style={{fontSize:12,fontWeight:700,color:C.textMid,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:8,paddingLeft:2}}>{pm.label} Wall of Fame</div>
    <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:6,WebkitOverflowScrolling:"touch"}}>
      {recognitions.map((r,i)=>{
        const photo = getPhotoB(r);
        const catColor = FAME_COLORS_B[r.category]||C.gold;
        return <div key={i} style={{flexShrink:0,width:130,borderRadius:12,border:"2px solid "+catColor+"44",background:"white",overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
          <div style={{background:"linear-gradient(135deg,"+catColor+"22,"+catColor+"11)",padding:"10px 10px 6px",textAlign:"center"}}>
            {photo
              ?<img src={photo} alt={r.personName} style={{width:48,height:48,borderRadius:24,objectFit:"cover",border:"2px solid "+catColor,margin:"0 auto",display:"block"}}/>
              :<div style={{width:48,height:48,borderRadius:24,background:catColor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"white",margin:"0 auto",border:"2px solid "+catColor+"66"}}>{r.personName?.charAt(0)?.toUpperCase()}</div>}
          </div>
          <div style={{padding:"6px 8px 10px",textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.personName}</div>
            <div style={{fontSize:10,fontWeight:700,color:catColor,background:catColor+"15",borderRadius:4,padding:"2px 6px",display:"inline-block",marginBottom:4}}>{r.category}</div>
            <div style={{fontSize:12,color:C.textMid,lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{r.message}</div>
          </div>
        </div>;
      })}
    </div>
  </div>;
}


// ── IMAGE COMPRESSION HELPER ──
function compressImage(file, callback, maxSize=400, quality=0.7) {
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w=img.width, h=img.height;
      if(w>h){if(w>maxSize){h=Math.round(h*maxSize/w);w=maxSize;}}
      else{if(h>maxSize){w=Math.round(w*maxSize/h);h=maxSize;}}
      canvas.width=w; canvas.height=h;
      canvas.getContext("2d").drawImage(img,0,0,w,h);
      callback(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}


// ── MY LEAD LINK ──
function MyLeadLink({name,data,onUpdate,personId}) {
  const [copied,setCopied] = useState(false);
  const [shared,setShared] = useState(false);
  const [msgIdx,setMsgIdx] = useState(0);
  const [msgCopied,setMsgCopied] = useState(false);
  // Check if this admin has a custom link name set
  const adminRecord = (typeof data!=="undefined")&&(data.admins||[]).find(a=>a.name===name);
  const safeName = adminRecord?.linkName||(name||"").trim().split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g,"");
  const link = "https://moneymap-app-two.vercel.app?rep="+safeName;
  const mmContent = data?.moneyMapContent||{};
  const sendTo = mmContent.sendTo||"";
  const whyImportant = mmContent.whyImportant||"";
  const msgList = mmContent.messages||[];

  const copy = () => {
    navigator.clipboard?.writeText(link).then(()=>{
      setCopied(true);
      setTimeout(()=>setCopied(false),2500);
    });
  };

  const share = () => {
    if(navigator.share){
      navigator.share({title:"My MoneyMap Link",text:"Check out your personalized MoneyMap!",url:link});
    } else {
      copy();
    }
  };

  const markShared = () => {
    if(typeof onUpdate!=="function"||!personId) return;
    logLinkShare(data,onUpdate,personId,"My Lead Link");
    setShared(true);
    setTimeout(()=>setShared(false),2000);
  };

  const copyMsg = () => {
    const text = (msgList[msgIdx]?.content||"").replace(/\[share MoneyMap link\]/gi,link);
    navigator.clipboard?.writeText(text).then(()=>{
      setMsgCopied(true);
      setTimeout(()=>setMsgCopied(false),2500);
    });
  };

  return <div style={{background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",borderRadius:14,padding:"18px 20px",marginBottom:14,border:"1px solid "+C.teal+"33"}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <div style={{width:9,height:9,borderRadius:5,background:C.teal}}/>
      <div style={{fontSize:16,fontWeight:800,color:C.teal,textTransform:"uppercase",letterSpacing:"0.7px"}}>My Lead Link</div>
    </div>
    <div style={{fontSize:16,color:"rgba(255,255,255,0.75)",marginBottom:12,lineHeight:1.6}}>Share this personal link with prospects to start their MoneyMap conversation.</div>
    {whyImportant&&<div style={{background:"rgba(212,160,23,0.12)",border:"1px solid rgba(212,160,23,0.35)",borderRadius:10,padding:"12px 14px",marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:800,color:C.gold,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>Why It's Important</div>
      <div style={{fontSize:15,color:"rgba(255,255,255,0.9)",lineHeight:1.6}}>{whyImportant}</div>
    </div>}
    {sendTo&&<div style={{background:"rgba(255,255,255,0.07)",borderRadius:10,padding:"12px 14px",marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:800,color:C.teal,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>Who Should I Send This To?</div>
      <div style={{fontSize:15,color:"rgba(255,255,255,0.85)",lineHeight:1.6}}>{sendTo}</div>
    </div>}
    <div style={{background:"rgba(255,255,255,0.08)",borderRadius:9,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
      <div style={{flex:1,fontSize:15,color:"white",wordBreak:"break-all",fontFamily:"monospace"}}>{link}</div>
    </div>
    <div style={{display:"flex",gap:8}}>
      <button onClick={copy} style={{flex:1,padding:"12px",borderRadius:9,border:"none",background:copied?C.success:"linear-gradient(135deg,"+C.teal+",#0891b2)",color:"white",cursor:"pointer",fontSize:15,fontWeight:700,transition:"background 0.2s"}}>
        {copied?"Copied!":"Copy Link"}
      </button>
      <button onClick={share} style={{flex:1,padding:"12px",borderRadius:9,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.08)",color:"white",cursor:"pointer",fontSize:15,fontWeight:600}}>
        Share
      </button>
    </div>
    {onUpdate&&personId&&<button onClick={markShared} style={{width:"100%",marginTop:10,padding:"11px",borderRadius:9,border:shared?"1px solid "+C.success:"1px solid rgba(255,255,255,0.2)",background:shared?"rgba(22,163,74,0.15)":"rgba(255,255,255,0.05)",color:shared?C.success:"rgba(255,255,255,0.8)",cursor:"pointer",fontSize:14,fontWeight:600}}>
      {shared?"✓ Logged!":"Mark as Shared"}
    </button>}
    {msgList.length>0&&<div style={{marginTop:12,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.12)"}}>
      <div style={{fontSize:13,fontWeight:800,color:C.teal,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Message to Send</div>
      {msgList.length>1&&<select value={msgIdx} onChange={e=>setMsgIdx(Number(e.target.value))} style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1px solid rgba(255,255,255,0.2)",background:C.navyMid,color:"white",fontSize:14,marginBottom:10}}>
        {msgList.map((m,i)=><option key={i} value={i} style={{background:C.navy}}>{m.label}</option>)}
      </select>}
      <div style={{background:"rgba(255,255,255,0.07)",borderRadius:9,padding:"12px 14px",marginBottom:10,fontSize:15,color:"rgba(255,255,255,0.9)",lineHeight:1.7,whiteSpace:"pre-wrap",maxHeight:180,overflowY:"auto"}}>{(msgList[msgIdx]?.content||"").replace(/\[share MoneyMap link\]/gi,link)}</div>
      <button onClick={copyMsg} style={{width:"100%",padding:"10px",borderRadius:9,border:"none",background:msgCopied?C.success:"rgba(255,255,255,0.1)",color:"white",cursor:"pointer",fontSize:14,fontWeight:600}}>
        {msgCopied?"Copied!":"📋 Copy Message"}
      </button>
    </div>}
  </div>;
}


// ══════════════════════════════════════════════════
// PROMPT 4 — LEAD TASK CHECKLIST
// ══════════════════════════════════════════════════
const LEAD_TASKS = [
  {id:"call",label:"Call within 24 hours"},
  {id:"book",label:"Send How Money Works book"},
  {id:"fna",label:"Schedule FNA appointment"},
  {id:"status",label:"Update lead status"},
];

function LeadTaskPopup({rep,data,onUpdate,leads,onClose}) {
  const taskData = data.leadTasks||{};
  const repTasks = taskData[rep.id]||{};
  const newLeads = leads.filter(l=>{
    const lt = repTasks[l.docId]||{};
    return LEAD_TASKS.some(t=>!lt[t.id]);
  });
  if(newLeads.length===0){onClose();return null;}

  const toggleTask = (docId,taskId) => {
    const updated = {
      ...taskData,
      [rep.id]:{
        ...repTasks,
        [docId]:{
          ...(repTasks[docId]||{}),
          [taskId]:!(repTasks[docId]||{})[taskId],
          updatedAt:new Date().toISOString(),
        }
      }
    };
    onUpdate({...data,leadTasks:updated});
  };

  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:"white",borderRadius:16,padding:"20px",maxWidth:400,width:"100%",maxHeight:"80vh",overflowY:"auto"}}>
      <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:4}}>Action Required</div>
      <div style={{fontSize:13,color:C.textMid,marginBottom:14}}>You have uncompleted tasks on {newLeads.length} lead{newLeads.length!==1?"s":""}. Check off tasks as you complete them.</div>
      {newLeads.map((lead,i)=>{
        const lt = repTasks[lead.docId]||{};
        const done = LEAD_TASKS.filter(t=>lt[t.id]).length;
        return <div key={i} style={{borderRadius:10,border:"1px solid "+C.border,padding:"12px",marginBottom:10}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:2}}>{lead.name||"Unknown"}</div>
          <div style={{fontSize:13,color:C.textMid,marginBottom:8}}>{lead.phone} • {done}/{LEAD_TASKS.length} tasks done</div>
          {LEAD_TASKS.map(task=><label key={task.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid "+C.border,cursor:"pointer"}}>
            <input type="checkbox" checked={!!lt[task.id]} onChange={()=>toggleTask(lead.docId,task.id)} style={{width:16,height:16,cursor:"pointer"}}/>
            <span style={{fontSize:13,color:lt[task.id]?C.textLight:C.text,textDecoration:lt[task.id]?"line-through":"none"}}>{task.label}</span>
          </label>)}
        </div>;
      })}
      <button onClick={onClose} style={{width:"100%",padding:"10px",borderRadius:9,background:C.navy,color:"white",border:"none",cursor:"pointer",fontSize:14,fontWeight:600,marginTop:6}}>Done for Now</button>
    </div>
  </div>;
}

// ══════════════════════════════════════════════════
// PROMPT 5 — DAILY ACTIVITY LOG
// ══════════════════════════════════════════════════
const DAILY_QUESTIONS = [
  {id:"talked",label:"How many people did you talk to today about the business or finances?"},
  {id:"followup",label:"How many follow up calls did you make?"},
  {id:"apptSet",label:"How many appointments did you set?"},
  {id:"apptRan",label:"How many appointments did you run?"},
  {id:"recruited",label:"How many new reps did you prospect for recruiting?"},
];

function DailyActivityLog({rep,data,onUpdate,isFirstTime=false}) {
  const today = localDate();
  const activityLog = data.activityLogs||{};
  const repLog = activityLog[rep.id]||{};
  const todayLog = repLog[today];
  const [form,setForm] = useState({
    talked:todayLog?.talked||0,
    followup:todayLog?.followup||0,
    apptSet:todayLog?.apptSet||0,
    apptRan:todayLog?.apptRan||0,
    recruited:todayLog?.recruited||0
  });
  const [submitted,setSubmitted] = useState(!!todayLog);
  const [showFirst,setShowFirst] = useState(isFirstTime&&!repLog.seenIntro);

  // Calculate streak
  const streak = (()=>{
    let count=0;
    const d=new Date();
    d.setDate(d.getDate()-1);
    while(true){
      const key=d.toISOString().split("T")[0];
      if(repLog[key]) count++;
      else break;
      d.setDate(d.getDate()-1);
      if(count>365) break;
    }
    if(todayLog) count++;
    return count;
  })();

  const submit = () => {
    const updated = {
      ...activityLog,
      [rep.id]:{
        ...repLog,
        seenIntro:true,
        [today]:{...form,submittedAt:new Date().toISOString(),date:today}
      }
    };
    onUpdate({...data,activityLogs:updated});
    setSubmitted(true);
  };

  if(submitted) return <Card style={{marginBottom:12,border:`1px solid ${C.success}44`,background:C.success+"08"}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:36,height:36,borderRadius:18,background:C.success+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:700,color:C.success}}>Today's activity submitted! ✅</div>
        <div style={{fontSize:11,color:C.textMid,marginTop:1}}>You're showing up and that matters. Come back tomorrow to keep your streak going 🔥</div>
      </div>
      <button onClick={()=>{
        setForm({talked:todayLog?.talked||0,followup:todayLog?.followup||0,apptSet:todayLog?.apptSet||0,apptRan:todayLog?.apptRan||0,recruited:todayLog?.recruited||0});
        setSubmitted(false);
      }} style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:11,color:C.textMid,fontWeight:600,whiteSpace:"nowrap"}}>
        Edit
      </button>
    </div>
  </Card>;

  if(showFirst) return <div style={{background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",borderRadius:12,padding:"16px",marginBottom:14,border:"1px solid "+C.teal+"33"}}>
    <div style={{fontSize:14,fontWeight:700,color:C.teal,marginBottom:8}}>Welcome to Your Daily Activity Log</div>
    <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",lineHeight:1.7,marginBottom:12}}>Each day you will be asked to log a quick summary of your activity. This log helps your RVP track your progress and provide the right support. It only takes 30 seconds — <strong style={{color:"white"}}>your consistency here directly reflects your commitment to your goals.</strong></div>
    <button onClick={()=>{setShowFirst(false);const u={...activityLog,[rep.id]:{...(activityLog[rep.id]||{}),seenIntro:true}};onUpdate({...data,activityLogs:u});}} style={{width:"100%",padding:"9px",borderRadius:8,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>Got It — Let me Log Today</button>
  </div>;

  return <div style={{background:"white",borderRadius:12,border:"2px solid "+C.gold+"44",padding:"14px 16px",marginBottom:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text}}>Today's Activity Log</div>
      {streak>0&&<div style={{fontSize:13,fontWeight:700,color:C.gold}}>🔥 {streak} day streak</div>}
    </div>
    <div style={{fontSize:13,color:C.textMid,marginBottom:12}}>Log your activity for today. Submit even if all your numbers are zero — showing up and logging counts!</div>
    {DAILY_QUESTIONS.map(q=><div key={q.id} style={{marginBottom:10}}>
      <div style={{fontSize:13,color:C.text,marginBottom:4,lineHeight:1.4}}>{q.label}</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <button onClick={()=>setForm(f=>({...f,[q.id]:Math.max(0,f[q.id]-1)}))} style={{width:30,height:30,borderRadius:7,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:16,color:C.textMid,fontWeight:700}}>-</button>
        <div style={{fontSize:18,fontWeight:700,color:C.teal,minWidth:30,textAlign:"center"}}>{form[q.id]}</div>
        <button onClick={()=>setForm(f=>({...f,[q.id]:f[q.id]+1}))} style={{width:30,height:30,borderRadius:7,border:"none",background:C.teal,cursor:"pointer",fontSize:16,color:"white",fontWeight:700}}>+</button>
      </div>
    </div>)}
    <div style={{background:C.teal+"11",border:`1px solid ${C.teal}33`,borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:C.text,lineHeight:1.5}}>
      💡 <strong>Had a slow day? That's okay — still submit!</strong> Zero is a valid entry. Submitting every day keeps your streak alive and shows your trainer you're engaged even on tough days.
    </div>
    <button onClick={submit} style={{width:"100%",padding:"10px",borderRadius:9,background:"linear-gradient(135deg,"+C.gold+",#f97316)",border:"none",color:"white",cursor:"pointer",fontSize:14,fontWeight:700,marginTop:4}}>Submit Today's Log</button>
    <div style={{fontSize:12,color:C.textMid,textAlign:"center",marginTop:6,lineHeight:1.4}}>Your trainer reviews your activity log to support your growth and celebrate your wins!</div>
  </div>;
}

// ══════════════════════════════════════════════════
// PROMPT 6 — ACCOUNTABILITY DASHBOARD
// ══════════════════════════════════════════════════
function AccountabilityDashboard({data,onUpdate,userRole,userId}) {
  const isAdmin = userRole==="admin"||userRole==="superadmin";
  const [myRepsOnlyAcct,setMyRepsOnlyAcct]=useState(false);
  const allReps = data.reps||[];
  const trainers = data.trainers||[];
  const allTrainers = [...trainers,...(data.admins||[])];
  const allRepsAndTrainers = isAdmin 
    ? [...allReps, ...trainers.map(t=>({...t,isTrainer:true,track:"licensed"}))]
    : allReps.filter(r=>r.trainerId===userId);
  const reps = (isAdmin&&myRepsOnlyAcct)
    ? allRepsAndTrainers.filter(r=>r.adminId===userId)
    : allRepsAndTrainers;
  const activityLogs = data.activityLogs||{};
  const leadTasks = data.leadTasks||{};
  const today = localDate();
  const yesterday = localDate(new Date(Date.now()-86400000));
  const [search,setSearch] = useState("");
  const [statusFilter,setStatusFilter] = useState("all");
  const [expandedRep,setExpandedRep] = useState(null);
  const [checkInNote,setCheckInNote] = useState("");
  const [statusNote,setStatusNote] = useState({});
  const [showGuide,setShowGuide] = useState(false);

  const repStats = reps.map(rep=>{
    const repLog = activityLogs[rep.id]||{};
    // submittedToday is true even for zero logs — any entry with submittedAt counts
    const submittedToday = !!(repLog[today]&&(repLog[today].submittedAt||Object.keys(repLog[today]).length>0));
    const submittedYesterday = !!(repLog[yesterday]&&(repLog[yesterday].submittedAt||Object.keys(repLog[yesterday]).length>0));
    let streak=0;
    const d=new Date();
    if(submittedToday){streak=1;d.setDate(d.getDate()-1);while(repLog[d.toISOString().split("T")[0]]){streak++;d.setDate(d.getDate()-1);if(streak>365)break;}}
    // Auto at-risk flags
    const loginHistory2 = (data.loginHistory||{})[rep.id]||[];
    const lastLoginDate = loginHistory2.length>0?new Date(loginHistory2[loginHistory2.length-1].ts):null;
    const daysSinceLogin = lastLoginDate?Math.floor((Date.now()-lastLoginDate)/86400000):999;
    const loggedInToday = daysSinceLogin===0;
    const daysSinceChecklist = rep.lastChecklistActivity?Math.floor((Date.now()-new Date(rep.lastChecklistActivity))/86400000):999;
    const isNewRep = rep.track==="fast"||rep.track==="regular"||!rep.track;
    const isLicensed = rep.track==="licensed";
    // At risk logic differs by track:
    // New reps (Fast/Regular): flagged by no login in 7+ days OR checklist stalled 7+ days
    // Licensed/Field Trainers: also flagged by missing daily activity
    const isAtRisk = isNewRep
      ? (daysSinceLogin>=7||(daysSinceChecklist>=7&&loginHistory2.length>0))
      : (!loggedInToday&&daysSinceLogin>=30||daysSinceChecklist>=30||(!submittedToday&&!submittedYesterday&&!loggedInToday&&streak===0&&loginHistory2.length>0));
    // Status label also differs by track:
    // New reps don't submit daily activity — judge by login recency instead
    const status = isNewRep
      ? (daysSinceLogin<=1?"green":daysSinceLogin<=3?"yellow":"red")
      : ((submittedToday||loggedInToday)?"green":submittedYesterday?"yellow":"red");
    const repTaskData = leadTasks[rep.id]||{};
    const openTasks = Object.values(repTaskData).reduce((c,lt)=>c+LEAD_TASKS.filter(t=>!lt[t.id]).length,0);
    const cl = rep.track==="licensed"?19:13;
    const done = Object.values(rep.checked||{}).filter(Boolean).length;
    const progress = Math.round((done/cl)*100);
    const allPeople2 = [...allReps,...(data.trainers||[]),...(data.admins||[])];
    const recruiter = allPeople2.find(r=>r.id===rep.recruitedBy)||{name:"Not specified"};
    // 7-day calendar — Sun to Sat of current week
    const last7 = Array.from({length:7},(_,i)=>{
      const dd=new Date();
      const day=dd.getDay(); // 0=Sun
      dd.setDate(dd.getDate()-day+i); // start from Sunday of this week
      const key=dd.toISOString().split("T")[0];
      return {key,submitted:!!repLog[key],isToday:key===today};
    });
    const todayLog = repLog[today];

    // Weekly activity totals (Sun-Sat)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate()-weekStart.getDay());
    const weekTotals = {talked:0,followup:0,apptSet:0,apptRan:0,recruited:0,daysLogged:0};
    Array.from({length:7},(_,i)=>{
      const dd=new Date(weekStart); dd.setDate(dd.getDate()+i);
      const key=dd.toISOString().split("T")[0];
      const log=repLog[key];
      if(log){
        weekTotals.daysLogged++;
        weekTotals.talked+=(Number(log.talked)||0);
        weekTotals.followup+=(Number(log.followup)||0);
        weekTotals.apptSet+=(Number(log.apptSet)||0);
        weekTotals.apptRan+=(Number(log.apptRan)||0);
        weekTotals.recruited+=(Number(log.recruited)||0);
      }
    });

    // Scorecard
    const scorecardAll = (data.scorecards||{})[rep.id]||{};
    const currentWeekKey = getWeekStart();
    const legacyAwareWeekTotal2=(weekData,key)=>{
      const dayList=Object.values((weekData&&weekData.days)||{});
      if(dayList.length>0) return dayList.reduce((s,d)=>s+(Number(d.actual?.[key])||0),0);
      return Number(weekData?.[key])||0;
    };
    const scorecard = {
      contacts: legacyAwareWeekTotal2(scorecardAll[currentWeekKey],"contacts"),
      apptSet: legacyAwareWeekTotal2(scorecardAll[currentWeekKey],"apptSet"),
      apptDone: legacyAwareWeekTotal2(scorecardAll[currentWeekKey],"apptDone"),
    };
    // Monthly totals — sum all weeks whose Monday falls in current month
    const now = new Date();
    const scorecardMonth = Object.entries(scorecardAll).reduce((s,[wk,d])=>{
      const wkDate = new Date(wk+"T12:00:00");
      if(wkDate.getMonth()===now.getMonth()&&wkDate.getFullYear()===now.getFullYear()){
        s.contacts+=legacyAwareWeekTotal2(d,"contacts");
        s.apptSet+=legacyAwareWeekTotal2(d,"apptSet");
        s.apptDone+=legacyAwareWeekTotal2(d,"apptDone");
      }
      return s;
    },{contacts:0,apptSet:0,apptDone:0});

    // Login history
    const loginHistory = (data.loginHistory||{})[rep.id]||[];
    const lastLogin = loginHistory.length>0?loginHistory[loginHistory.length-1].ts:null;
    const loginsThisWeek = loginHistory.filter(l=>{
      const dd=new Date(l.ts); return dd>=weekStart;
    }).length;
    const loginsThisMonth = loginHistory.filter(l=>{
      const dd=new Date(l.ts);
      return dd.getMonth()===new Date().getMonth()&&dd.getFullYear()===new Date().getFullYear();
    }).length;

    return {...rep,submittedToday,streak,status,isAtRisk,openTasks,progress,recruiter,last7,todayLog,weekTotals,scorecard,scorecardMonth,lastLogin,loginsThisWeek,loginsThisMonth};
  });

  const filtered = repStats.filter(r=>{
    const matchSearch = !search||(r.name||"").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter==="all"||r.status===statusFilter;
    return matchSearch&&matchStatus;
  }).sort((a,b)=>{
    const order={red:0,yellow:1,green:2};
    return order[a.status]-order[b.status];
  });

  const statusColors={green:C.success,yellow:C.gold,red:C.danger};
  const getStatusLabel=(rep,status)=>{
    const isNewRep=rep.track==="fast"||rep.track==="regular"||!rep.track;
    if(isNewRep) return {green:"Active",yellow:"2-3 Days",red:"7+ Days No Login"}[status];
    return {green:"Active Today",yellow:"1 Day Idle",red:"3+ Days Silent"}[status];
  };

  const addCheckIn = (repId,isTrainerRec) => {
    if(!checkInNote.trim()) return;
    const note={text:checkInNote,date:new Date().toISOString(),by:userId};
    if(isTrainerRec){
      const updated=(data.trainers||[]).map(t=>t.id===repId?{...t,checkIns:[...(t.checkIns||[]),note]}:t);
      onUpdate({...data,trainers:updated});
    } else {
      const updated=(data.reps||[]).map(r=>r.id===repId?{...r,checkIns:[...(r.checkIns||[]),note]}:r);
      onUpdate({...data,reps:updated});
    }
    setCheckInNote("");
  };

  const setRepStatus = (repId,status) => {
    const updated=(data.reps||[]).map(r=>r.id===repId?{...r,accountabilityStatus:status}:r);
    onUpdate({...data,reps:updated});
  };

  const removeRep = (repId,repName) => {
    if(!isAdmin) return;
    if(!window.confirm("Mark "+repName+" as inactive? Their data will be preserved but they will be removed from active views.")) return;
    const updated=(data.reps||[]).map(r=>r.id===repId?{...r,inactive:true}:r);
    onUpdate({...data,reps:updated});
  };

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
      <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text}}>Accountability Dashboard</div>
      {isAdmin&&<button onClick={()=>setMyRepsOnlyAcct(m=>!m)} style={{fontSize:12,padding:"5px 12px",borderRadius:7,border:`1px solid ${myRepsOnlyAcct?C.gold:C.border}`,background:myRepsOnlyAcct?C.gold+"11":"white",cursor:"pointer",color:myRepsOnlyAcct?C.gold:C.textMid,fontWeight:600}}>{myRepsOnlyAcct?"My Reps Only ✓":"My Reps Only"}</button>}
    </div>
    <div style={{fontSize:13,color:C.textMid,marginBottom:10,lineHeight:1.5}}>Track rep activity, daily log submissions, checklist progress, and coaching notes — all in one place.</div>

    {/* How to Read This Dashboard */}
    <div style={{marginBottom:14}}>
      <button onClick={()=>setShowGuide(g=>!g)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:showGuide?C.teal+"11":"white",cursor:"pointer",fontSize:13,color:showGuide?C.teal:C.textMid,fontWeight:600,width:"100%",textAlign:"left"}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        How to Read This Dashboard
        <svg style={{marginLeft:"auto",transform:showGuide?"rotate(180deg)":"none",transition:"transform 0.2s"}} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {showGuide&&<div style={{border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 8px 8px",padding:"12px 14px",background:"white"}}>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[
            {emoji:"🟢",label:"Active (new reps) / Active Today (licensed)",desc:"New reps: logged in within the last 24 hours. Licensed reps and field trainers: submitted their daily activity log today. This is what you want to see."},
            {emoji:"🟡",label:"2-3 Days (new reps) / 1 Day Idle (licensed)",desc:"New reps: last login was 2-3 days ago — worth a check-in text. Licensed reps: submitted activity yesterday but not today — may just need a reminder."},
            {emoji:"🔴",label:"7+ Days No Login (new reps) / 3+ Days Silent (licensed)",desc:"New reps: haven't logged into the app in 7 or more days — this needs your attention. Licensed reps: no daily activity log submitted in 3+ days — reach out now before momentum is lost."},
            {emoji:"⚠️",label:"At Risk",desc:"A rep is flagged At Risk when they've gone too long without logging in or submitting activity. New reps: 7+ days no login or 7+ days no checklist progress. Licensed reps: 30+ days no login, or missing activity logs with no streak. These are the people who need a personal call, not just a text."},
            {emoji:"🔥",label:"Streak",desc:"How many consecutive days a licensed rep or field trainer has submitted their daily activity log without a gap. A streak of 5 means they've logged 5 days in a row. Streaks build habits — celebrate them."},
            {emoji:"📋",label:"Open Tasks",desc:"The number of incomplete items on a rep's checklist. A high open task count with low checklist progress after several days means they may be stuck or disengaged. Use this to guide your coaching conversation."},
          ].map((item,i)=><div key={i} style={{display:"flex",gap:10,paddingBottom:i<5?10:0,borderBottom:i<5?`1px solid ${C.border}`:"none"}}>
            <div style={{fontSize:20,flexShrink:0,marginTop:1}}>{item.emoji}</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:2}}>{item.label}</div>
              <div style={{fontSize:13,color:C.textMid,lineHeight:1.5}}>{item.desc}</div>
            </div>
          </div>)}
        </div>
      </div>}
    </div>

    {/* Summary stats */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
      {[{l:"Active Today",v:repStats.filter(r=>r.status==="green").length,c:C.success},{l:"Needs Attention",v:repStats.filter(r=>r.status==="yellow").length,c:C.gold},{l:"Going Silent",v:repStats.filter(r=>r.status==="red").length,c:C.danger}].map(s=><Card key={s.l} style={{padding:"9px 11px",textAlign:"center"}}>
        <div style={{fontSize:20,fontWeight:700,color:s.c}}>{s.v}</div>
        <div style={{fontSize:12,color:C.textMid}}>{s.l}</div>
      </Card>)}
    </div>

    {/* Search + filter */}
    <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      <input placeholder="Search rep name..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,padding:"7px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:13,color:C.text}}/>
      <div style={{display:"flex",gap:4}}>
        {[["all","All"],["red","Silent"],["yellow","Idle"],["green","Active"]].map(([k,l])=>(
          <button key={k} onClick={()=>setStatusFilter(k)} style={{fontSize:12,padding:"5px 9px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:statusFilter===k?700:400,background:statusFilter===k?(k==="all"?C.navy:statusColors[k]):C.surface,color:statusFilter===k?"white":C.textMid}}>{l}</button>
        ))}
      </div>
    </div>

    {/* Rep cards */}
    {filtered.length===0&&<div style={{textAlign:"center",padding:"24px",color:C.textLight,fontSize:13}}>No reps match your filter</div>}
    {filtered.map((rep,i)=>{
      const isExpanded = expandedRep===rep.id;
      return <div key={i} style={{borderRadius:10,border:"1px solid "+C.border,marginBottom:10,overflow:"hidden",borderLeft:"4px solid "+statusColors[rep.status]}}>
        {/* Rep header — clickable */}
        <div onClick={()=>setExpandedRep(isExpanded?null:rep.id)} style={{padding:"10px 14px",background:isExpanded?C.navy:"white",cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <div style={{width:8,height:8,borderRadius:4,background:statusColors[rep.status],flexShrink:0}}/>
                <span style={{fontSize:dv(13,16),fontWeight:700,color:isExpanded?"white":C.text}}>{rep.name}</span>
                {rep.isTrainer&&<Badge color={C.purple} small>Trainer</Badge>}
                <Badge color={statusColors[rep.status]} small>{getStatusLabel(rep,rep.status)}</Badge>
                {rep.isAtRisk&&!rep.inactive&&<Badge color={"#f97316"} small>At Risk</Badge>}
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <span style={{fontSize:13,color:isExpanded?"rgba(255,255,255,0.5)":C.textMid}}>Streak: <strong style={{color:rep.streak>0?C.gold:(isExpanded?"rgba(255,255,255,0.5)":C.textLight)}}>{rep.streak}d</strong></span>
                <span style={{fontSize:13,color:isExpanded?"rgba(255,255,255,0.5)":C.textMid}}>Progress: <strong style={{color:isExpanded?"white":C.teal}}>{rep.progress}%</strong></span>
                <span style={{fontSize:13,color:isExpanded?"rgba(255,255,255,0.5)":C.textMid}}>Tasks: <strong style={{color:rep.openTasks>0?C.danger:(isExpanded?"white":C.success)}}>{rep.openTasks} open</strong></span>
                <span style={{fontSize:13,color:isExpanded?"rgba(255,255,255,0.5)":C.textMid}}>Recruited by: <strong style={{color:isExpanded?"white":C.purple}}>{rep.recruiter?.name||"Direct"}</strong></span>
              </div>
            </div>
            <span style={{color:isExpanded?"rgba(255,255,255,0.5)":C.textLight,fontSize:14,transform:isExpanded?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block",flexShrink:0}}>v</span>
          </div>
        </div>

        {/* Expanded details */}
        {isExpanded&&<div style={{padding:"14px",background:C.surface}}>

          {/* 7-day calendar */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>Last 7 Days</div>
            <div style={{display:"flex",gap:4}}>
              {rep.last7.map((day,di)=><div key={di} style={{flex:1,textAlign:"center"}}>
                <div style={{width:"100%",aspectRatio:"1",borderRadius:6,background:day.submitted?C.success:C.danger+"22",border:"2px solid "+(day.isToday?C.teal:(day.submitted?C.success:C.danger+"33")),display:"flex",alignItems:"center",justifyContent:"center",marginBottom:3}}>
                  <span style={{fontSize:14}}>{day.submitted?"✓":"·"}</span>
                </div>
                <div style={{fontSize:10,color:C.textLight}}>{["S","M","T","W","T","F","S"][new Date(day.key).getDay()]}</div>
              </div>)}
            </div>
          </div>

          {/* Today's log answers */}
          {rep.todayLog&&<div style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8}}>Today's Activity Log</div>
            {DAILY_QUESTIONS.map(q=><div key={q.id} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid "+C.border}}>
              <span style={{fontSize:13,color:C.textMid,flex:1,paddingRight:8}}>{q.label.replace("How many ","").replace("?","")}</span>
              <span style={{fontSize:13,fontWeight:700,color:C.teal}}>{rep.todayLog[q.id]||0}</span>
            </div>)}
          </div>}
          {!rep.todayLog&&<div style={{background:C.danger+"11",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:13,color:C.danger,fontWeight:600}}>No activity log submitted today</div>}

          {/* Checklist progress */}
          <div style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>Checklist Progress</div>
              <div style={{fontSize:13,fontWeight:700,color:C.teal}}>{rep.progress}%</div>
            </div>
            <Bar pct={rep.progress} color={rep.progress>=100?C.success:C.teal} h={6}/>
          </div>

          {/* Status note */}
          <div style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>Status</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {["On Track","Needs Attention","At Risk","Inactive"].map(s=><button key={s} onClick={()=>setRepStatus(rep.id,rep.accountabilityStatus===s?null:s)} style={{fontSize:12,padding:"4px 9px",borderRadius:6,border:"1px solid "+C.border,cursor:"pointer",fontWeight:rep.accountabilityStatus===s?700:400,background:rep.accountabilityStatus===s?C.navy:"white",color:rep.accountabilityStatus===s?"white":C.textMid}}>{s}</button>)}
            </div>
          </div>

          {/* Weekly Activity Totals */}
          <div style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8}}>Weekly Activity Totals ({rep.weekTotals.daysLogged}/7 days logged)</div>
            {rep.weekTotals.daysLogged===0?<div style={{fontSize:13,color:C.textLight}}>No activity logged this week</div>:
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {[{l:"People Talked To",v:rep.weekTotals.talked},{l:"Follow-up Calls",v:rep.weekTotals.followup},{l:"Appointments Set",v:rep.weekTotals.apptSet},{l:"Appointments Ran",v:rep.weekTotals.apptRan},{l:"Recruits Prospected",v:rep.weekTotals.recruited}].map(item=><div key={item.l} style={{background:C.surface,borderRadius:6,padding:"6px 9px"}}>
                <div style={{fontSize:18,fontWeight:700,color:C.teal}}>{item.v}</div>
                <div style={{fontSize:10,color:C.textMid}}>{item.l}</div>
              </div>)}
            </div>}
          </div>

          {/* Scorecard */}
          {rep.scorecard&&Object.keys(rep.scorecard).length>0&&<div style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8}}>Scorecard This Week</div>
            {[{l:"Contacts Made",v:rep.scorecard.contacts||0,goal:100},{l:"Appointments Set",v:rep.scorecard.apptSet||0,goal:20},{l:"Appointments Done",v:rep.scorecard.apptDone||0,goal:20}].map(item=><div key={item.l} style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:13,color:C.textMid}}>{item.l}</span>
                <span style={{fontSize:13,fontWeight:700,color:C.teal}}>{item.v}/{item.goal}</span>
              </div>
              <Bar pct={Math.min(Math.round((item.v/item.goal)*100),100)} color={C.teal} h={4}/>
            </div>)}
          </div>}

          {/* App Engagement */}
          <div style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8}}>App Engagement</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              <div style={{background:C.surface,borderRadius:6,padding:"6px 9px",textAlign:"center"}}>
                <div style={{fontSize:16,fontWeight:700,color:C.purple}}>{rep.loginsThisWeek}</div>
                <div style={{fontSize:10,color:C.textMid}}>Logins This Week</div>
              </div>
              <div style={{background:C.surface,borderRadius:6,padding:"6px 9px",textAlign:"center"}}>
                <div style={{fontSize:16,fontWeight:700,color:C.purple}}>{rep.loginsThisMonth}</div>
                <div style={{fontSize:10,color:C.textMid}}>Logins This Month</div>
              </div>
              <div style={{background:C.surface,borderRadius:6,padding:"6px 9px",textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:C.purple}}>{rep.lastLogin?new Date(rep.lastLogin).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"Never"}</div>
                <div style={{fontSize:10,color:C.textMid}}>Last Login</div>
              </div>
            </div>
          </div>

          {/* Editable Recruited By */}
          <div style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>Recruited By</div>
            <select value={rep.recruitedBy||""} onChange={e=>{
              const val=e.target.value;
              if(rep.isTrainer){
                const updated=(data.trainers||[]).map(t=>t.id===rep.id?{...t,recruitedBy:val}:t);
                onUpdate({...data,trainers:updated});
              } else {
                const updated=(data.reps||[]).map(r=>r.id===rep.id?{...r,recruitedBy:val}:r);
                onUpdate({...data,reps:updated});
              }
            }} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text}}>
              <option value="">Not specified</option>
              {[...(data.reps||[]),...(data.trainers||[]),...(data.admins||[])].map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Assign RVP/Admin */}
          <div style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:3}}>Assigned RVP / Admin</div>
            <div style={{fontSize:11,color:C.textMid,marginBottom:6}}>Determines whose "My Reps" filter this rep appears under.</div>
            <select value={rep.adminId||""} onChange={e=>{
              const val=e.target.value;
              if(rep.isTrainer){
                const updated=(data.trainers||[]).map(t=>t.id===rep.id?{...t,adminId:val}:t);
                onUpdate({...data,trainers:updated});
              } else {
                const updated=(data.reps||[]).map(r=>r.id===rep.id?{...r,adminId:val}:r);
                onUpdate({...data,reps:updated});
              }
            }} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.gold}`,fontSize:13,color:C.text}}>
              <option value="">Not assigned</option>
              {(data.admins||[]).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* Check-in log */}
          <div style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8}}>Coaching Notes</div>
            {(rep.checkIns||[]).length===0&&<div style={{fontSize:13,color:C.textLight,marginBottom:8}}>No coaching notes yet</div>}
            {(rep.checkIns||[]).slice(-3).reverse().map((ci,ci_i)=><div key={ci_i} style={{padding:"6px 0",borderBottom:"1px solid "+C.border,marginBottom:6}}>
              <div style={{fontSize:13,color:C.text}}>{ci.text}</div>
              <div style={{fontSize:12,color:C.textLight,marginTop:2}}>{new Date(ci.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
            </div>)}
            <div style={{display:"flex",gap:6,marginTop:6}}>
              <input placeholder="Add a coaching note..." value={checkInNote} onChange={e=>setCheckInNote(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCheckIn(rep.id,rep.isTrainer)} style={{flex:1,padding:"6px 9px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text}}/>
              <button onClick={()=>addCheckIn(rep.id,rep.isTrainer)} style={{padding:"6px 12px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Add</button>
            </div>
          </div>

          {/* Generate Report */}
          <button onClick={()=>{
            const w=window.open("","_blank");
            const weekDays=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
            // For field trainers, production lives in myProduction; for reps, in selfPremium
            const trainerProd=rep.isTrainer?(data.myProduction||{})[rep.id]||{}:{};
            const selfPremiumEntries=rep.isTrainer?(trainerProd.lifeApps||[]):(rep.selfPremium||[]);
            const totalPremium=selfPremiumEntries.reduce((s,e)=>s+(Number(e.premium)||0),0);
            const premiumEntries=selfPremiumEntries.length;
            // Investments moved from rep.investments (legacy) to data.myProduction[id].investments —
            // prefer the new location, fall back to legacy only if nothing's been logged there yet.
            const repProdEntry=(data.myProduction||{})[rep.id]||{};
            const investmentEntriesForReport=(repProdEntry.investments&&repProdEntry.investments.length>0)?repProdEntry.investments:(rep.investments||[]);
            const recruitsCount=(data.reps||[]).filter(r=>r.recruitedBy===rep.id&&!r.excludeFromRecruitCount).length;
            w.document.write(`<!DOCTYPE html><html><head><title>Coaching Report — ${rep.name}</title><style>
              body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#1a1a2e;}
              h1{color:#0d1b2a;border-bottom:3px solid #0ea5c9;padding-bottom:10px;}
              h2{color:#0ea5c9;font-size:14px;margin-top:24px;margin-bottom:4px;}
              .note{font-size:11px;color:#666;font-style:italic;margin-bottom:10px;}
              .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0;}
              .grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:10px 0;}
              .card{background:#f8f9fa;border-radius:8px;padding:10px;text-align:center;}
              .big{font-size:24px;font-weight:700;color:#0ea5c9;}
              .label{font-size:10px;color:#666;}
              .cal{display:flex;gap:6px;margin:10px 0;}
              .day{flex:1;text-align:center;padding:8px 4px;border-radius:6px;}
              .day-label{font-size:10px;color:#666;margin-top:3px;}
              .submitted{background:#10b981;color:white;}
              .missed{background:#fee2e2;color:#dc2626;}
              .today-border{border:2px solid #0ea5c9;}
              .note-item{background:#f8f9fa;border-radius:6px;padding:8px;margin:4px 0;font-size:12px;}
              .note-date{font-size:10px;color:#999;}
              .status{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;}
              @media print{body{margin:10px;}.no-print{display:none;}}
            </style></head><body>
            <button class="no-print" onclick="window.print()" style="background:#0ea5c9;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;margin-bottom:16px;">Print / Save as PDF</button>
            <h1>Coaching Report</h1>
            <p><strong>${rep.name}</strong> &nbsp;|&nbsp; ${new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
            <p>Track: <strong>${rep.isTrainer?"Field Trainer":(rep.track==="licensed"?"Licensed Now What":rep.track==="fast"?"Fast Start":"Regular Start")}</strong> &nbsp;|&nbsp; Recruited By: <strong>${rep.recruiter?.name||"Not specified"}</strong></p>
            ${rep.accountabilityStatus?`<p>Status: <span class="status" style="background:${rep.accountabilityStatus==="On Track"?"#10b981":rep.accountabilityStatus==="Needs Attention"?"#f59e0b":rep.accountabilityStatus==="At Risk"?"#f97316":"#dc2626"};color:white">${rep.accountabilityStatus}</span></p>`:""}

            <h2>APP ENGAGEMENT</h2>
            <p class="note">Login frequency shows how actively ${rep.name} is using their training tools. Daily logins indicate someone who is working the system.</p>
            <div class="grid">
              <div class="card"><div class="big">${rep.loginsThisWeek}</div><div class="label">Logins This Week</div></div>
              <div class="card"><div class="big">${rep.loginsThisMonth}</div><div class="label">Logins This Month</div></div>
              <div class="card"><div class="big">${rep.lastLogin?new Date(rep.lastLogin).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"Never"}</div><div class="label">Last Login</div></div>
            </div>

            ${rep.isTrainer?(()=>{
              const tLogs=(data.activityLogs||{})[rep.id]||{};
              const tDates=Object.keys(tLogs).filter(k=>k.match(/^\d{4}-\d{2}-\d{2}$/)).sort().slice(-14);
              if(tDates.length===0) return "<h2>ACTIVITY CONSISTENCY</h2><p class='note'>No daily activity logs submitted yet.</p>";
              let tCells=tDates.map(d=>{const log=tLogs[d];const today2=new Date().toISOString().split('T')[0];return "<div class='day "+(log?.submittedAt?"submitted":"missed")+(d===today2?" today-border":"")+"'><div style='font-size:13px;font-weight:700'>"+(log?.talked||0)+"</div><div class='day-label'>"+d.slice(5)+"</div></div>";}).join("");
              return "<h2>ACTIVITY CONSISTENCY (Last 14 Days)</h2><div class='cal'>"+tCells+"</div>";
            })():""}
            <h2>ACTIVITY CONSISTENCY</h2>
            <p class="note">This section shows how consistently ${rep.name} is logging daily activity. Consistency is the foundation of results.</p>
            <div class="cal">
              ${rep.last7.map(day=>`<div class="day ${day.submitted?"submitted":"missed"}${day.isToday?" today-border":""}">
                <div>${day.submitted?"✓":"·"}</div>
                <div class="day-label">${weekDays[new Date(day.key).getDay()]}</div>
              </div>`).join("")}
            </div>
            <p>Streak: <strong>${rep.streak} day${rep.streak!==1?"s":""}</strong> &nbsp;|&nbsp; Submitted ${rep.weekTotals.daysLogged} of 7 days this week</p>

            <h2>WEEKLY ACTIVITY TOTALS</h2>
            <p class="note">These are the numbers ${rep.name} reported doing this week. High activity with low results points to a skills gap, not an effort gap.</p>
            <div class="grid2">
              <div class="card"><div class="big">${rep.weekTotals.talked}</div><div class="label">People Talked To</div></div>
              <div class="card"><div class="big">${rep.weekTotals.followup}</div><div class="label">Follow-up Calls</div></div>
              <div class="card"><div class="big">${rep.weekTotals.apptSet}</div><div class="label">Appointments Set</div></div>
              <div class="card"><div class="big">${rep.weekTotals.apptRan}</div><div class="label">Appointments Ran</div></div>
              <div class="card"><div class="big">${rep.weekTotals.recruited}</div><div class="label">Recruits Prospected</div></div>
            </div>

            <h2>SCORECARD — WEEKLY PRODUCTION</h2>
            <p class="note">The scorecard tracks formal weekly production goals. Compare these numbers against the activity totals above to identify where the process is breaking down.</p>
            <div class="grid">
              <div class="card"><div class="big">${rep.scorecard?.contacts||0}<span style="font-size:14px;color:#999">/100</span></div><div class="label">Contacts Made (This Week)</div></div>
              <div class="card"><div class="big">${rep.scorecard?.apptSet||0}<span style="font-size:14px;color:#999">/20</span></div><div class="label">Appointments Set (This Week)</div></div>
              <div class="card"><div class="big">${rep.scorecard?.apptDone||0}<span style="font-size:14px;color:#999">/20</span></div><div class="label">Appointments Done (This Week)</div></div>
            </div>
            <h2>SCORECARD — MONTHLY TOTALS</h2>
            <p class="note">Running totals for all weeks in ${new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"})}. This shows consistency over the full month, not just this week.</p>
            <div class="grid">
              <div class="card"><div class="big">${rep.scorecardMonth?.contacts||0}</div><div class="label">Total Contacts This Month</div></div>
              <div class="card"><div class="big">${rep.scorecardMonth?.apptSet||0}</div><div class="label">Total Appts Set This Month</div></div>
              <div class="card"><div class="big">${rep.scorecardMonth?.apptDone||0}</div><div class="label">Total Appts Done This Month</div></div>
            </div>

            <h2>PRODUCTION</h2>
            <p class="note">Production numbers show the real-world results ${rep.name} is generating. Life apps and premium are the ultimate measure of activity translating into results.</p>
            <div class="grid">
              <div class="card"><div class="big">${premiumEntries}</div><div class="label">Premium Entries Logged</div></div>
              <div class="card"><div class="big">$${totalPremium.toLocaleString()}</div><div class="label">Total Monthly Premium</div></div>
              <div class="card"><div class="big">$${investmentEntriesForReport.reduce((s,i)=>s+(Number(i.pac)||0),0).toLocaleString()}</div><div class="label">Monthly PAC</div></div>
              <div class="card"><div class="big">$${investmentEntriesForReport.reduce((s,i)=>s+(Number(String(i.lumpSum||"").replace(/[$,]/g,""))||0),0).toLocaleString()}</div><div class="label">Lump Sum</div></div>
              <div class="card"><div class="big">${recruitsCount}</div><div class="label">Reps Recruited</div></div>
            </div>

            ${(rep.track==="licensed"||rep.fieldTrainerGranted)?(()=>{
              const pm2=getCurrentPrimerMonth(data?.primerMonthEnds||[]);
              const c2=rep.commitments?.[pm2.key];
              if(!c2) return "<h2>MONTHLY COMMITMENT</h2><p class='note'>"+rep.name+" has not set a commitment for "+pm2.label+" yet.</p>";
              const mStart2=pm2.start;
              const recs2=countPeriodRecruits(data,rep.id,mStart2);
              const prem2=(rep.selfPremium||[]).filter(e=>e.date&&e.date>=mStart2&&(!e.cod||e.codAccepted)).reduce((s,e)=>s+(Number(e.premium)||0)*12,0);
              const rPct2=c2.recruits>0?Math.min(100,Math.round((recs2/c2.recruits)*100)):0;
              const pPct2=c2.premium>0?Math.min(100,Math.round((prem2/c2.premium)*100)):0;
              const days2=getDaysRemaining(pm2.cutoff);
              return "<h2>MONTHLY COMMITMENT — "+pm2.label+"</h2><p class='note'>"+rep.name+" committed to "+c2.tierEmoji+" "+c2.tierLabel+" this month. "+days2+" days remaining. Closes "+new Date(pm2.cutoff+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric"})+".</p><div class='grid2'><div class='card'><div class='big'>"+c2.tierEmoji+" "+c2.tierLabel+"</div><div class='label'>Commitment Tier</div></div><div class='card'><div class='big'>"+recs2+"/"+c2.recruits+"</div><div class='label'>Recruits ("+rPct2+"%)</div></div><div class='card'><div class='big'>$"+Math.round(prem2).toLocaleString()+"/$"+c2.premium.toLocaleString()+"</div><div class='label'>Annual Premium ("+pPct2+"%)</div></div><div class='card'><div class='big'>"+days2+"</div><div class='label'>Days Remaining</div></div></div>";
            })():""}
            ${(rep.track==="licensed"||rep.fieldTrainerGranted)?(()=>{
              const PL=[{key:"rep",label:"Rep",pct:25},{key:"sr_rep",label:"Senior Rep",pct:35},{key:"dl",label:"District Leader",pct:50},{key:"divl",label:"Division Leader",pct:60},{key:"rl",label:"Regional Leader",pct:70},{key:"srl",label:"Senior Regional Leader",pct:80},{key:"rvp",label:"RVP",pct:110}];
              const promo=PL.find(p=>p.key===(rep.promotionLevel||"rep"))||PL[0];
              const pct2=promo.pct/100;
              const calcC2=(mp)=>{const comm=(mp*12)-65;const tot=comm*pct2;return{tot,up:(tot/12)*9,ae:(tot/12)*3};};
              const now2=new Date();
              const ms=new Date(now2.getFullYear(),now2.getMonth(),1).toISOString().split("T")[0];
              const ents=rep.isTrainer?((data.myProduction||{})[rep.id]?.lifeApps||[]):(rep.selfPremium||[]);
              const me=ents.filter(e=>e.date>=ms);
              const mEarned=me.filter(e=>!e.cod||e.codAccepted).reduce((s,e)=>{const c=calcC2(Number(e.premium)||0);return s+c.up;},0);
              const goal2=Number(rep.monthlyIncomeGoal)||0;
              const gPct=goal2>0?Math.min(100,Math.round((mEarned/goal2)*100)):0;
              let rows="";
              me.forEach(e=>{const c=calcC2(Number(e.premium)||0);const isCOD=!!e.cod;const isPending=isCOD&&!e.codAccepted;const statusCell=isCOD?"<td style='text-align:center;padding:6px'><span style='font-size:10px;padding:2px 6px;border-radius:4px;background:"+(isPending?"#fef3c7":"#d1fae5")+";color:"+(isPending?"#d97706":"#059669")+"'>"+(isPending?"⏳ COD Pending":"✅ COD Accepted")+"</span></td>":"<td></td>";rows+="<tr style='border-bottom:1px solid #eee'><td style='padding:6px'>"+(e.client||"")+"</td><td style='text-align:right;padding:6px'>$"+e.premium+"/mo</td>"+statusCell+"<td style='text-align:right;padding:6px;color:"+(isPending?"#999":"#10b981")+";font-weight:600'>"+(isPending?"—":"$"+c.up.toFixed(0))+"</td><td style='text-align:right;padding:6px'>"+(isPending?"—":"$"+c.ae.toFixed(0))+"</td><td style='text-align:right;padding:6px;font-weight:600'>"+(isPending?"—":"$"+c.tot.toFixed(0))+"</td></tr>";});
              const table=me.length>0?"<h2>THIS MONTH'S APPS</h2><table style='width:100%;border-collapse:collapse;font-size:12px;margin-top:8px'><tr style='background:#f0f4f8'><th style='text-align:left;padding:6px'>Client</th><th style='text-align:right;padding:6px'>Mo. Premium</th><th style='text-align:center;padding:6px'>Status</th><th style='text-align:right;padding:6px'>Upfront</th><th style='text-align:right;padding:6px'>As Earned</th><th style='text-align:right;padding:6px'>Total 1yr</th></tr>"+rows+"</table>":"<p style='color:#999;font-size:12px'>No apps logged this month</p>";
              return "<h2>INCOME GOAL & COMMISSION</h2><p class='note'>Commission tracking for "+rep.name+". Based on promotion level and logged life apps.</p><div class='grid2'><div class='card'><div class='big'>"+promo.label+"</div><div class='label'>Promotion Level ("+promo.pct+"%)</div></div><div class='card'><div class='big'>$"+(goal2>0?goal2.toLocaleString():"Not set")+"</div><div class='label'>Monthly Income Goal</div></div><div class='card'><div class='big'>$"+mEarned.toFixed(0)+"</div><div class='label'>Earned This Month (upfront)</div></div><div class='card'><div class='big'>"+gPct+"%</div><div class='label'>Goal Progress</div></div></div>"+table;
            })():""}
            ${(rep.track==="licensed"||rep.fieldTrainerGranted)?(()=>{
              const wkKey=getWeekStart();
              const repScores=((data.scorecards||{})[rep.id]||{})[wkKey]||{days:{}};
              const wkDays=repScores.days||{};
              const wkStartDate=new Date(wkKey+"T12:00:00");
              const todayLocal=localDateStr();
              const dayRows=[0,1,2,3,4,5,6].map(i=>{
                const d=new Date(wkStartDate); d.setDate(wkStartDate.getDate()+i);
                const dStr=localDateStr(d);
                const dLabel=d.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
                const entry=wkDays[dStr]||{committed:{},actual:{}};
                const committedTotal=getEffectiveCommitmentCategories(data).reduce((s,c)=>s+(Number(entry.committed?.[c.key])||0),0);
                const actualTotal=getEffectiveCommitmentCategories(data).reduce((s,c)=>s+getScorecardActual(data,rep.id,dStr,c.key,entry),0);
                const isFuture=dStr>todayLocal;
                return {dLabel,committedTotal,actualTotal,isFuture};
              });
              // Detailed category-by-category breakdown, one column per day — this is the
              // part used to actually walk through the week on a call: "Monday you committed
              // to 5 calls and made 0" etc.
              const shortLabels=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
              const detailHeader="<th style='text-align:left;padding:6px'>Category</th>"+dayRows.map((dr,i)=>"<th style='text-align:center;padding:6px'>"+shortLabels[i]+"</th>").join("");
              const detailRows=getEffectiveCommitmentCategories(data).map(cat=>{
                const cells=dayRows.map((dr,i)=>{
                  if(dr.isFuture) return "<td style='text-align:center;padding:6px;color:#cbd5e1'>—</td>";
                  const d=new Date(wkStartDate); d.setDate(wkStartDate.getDate()+i);
                  const dStr=localDateStr(d);
                  const entry=wkDays[dStr]||{committed:{},actual:{}};
                  const committed=Number(entry.committed?.[cat.key])||0;
                  const actual=getScorecardActual(data,rep.id,dStr,cat.key,entry);
                  if(committed===0&&actual===0) return "<td style='text-align:center;padding:6px;color:#cbd5e1'>—</td>";
                  const missed=committed>0&&actual<committed;
                  const prefix=cat.isMoney?"$":"";
                  return "<td style='text-align:center;padding:6px;font-size:11px;"+(missed?"color:#dc2626;font-weight:600":"color:#374151")+"'>C: "+prefix+committed+"<br/>A: "+prefix+actual+"</td>";
                }).join("");
                return "<tr style='border-bottom:1px solid #eee'><td style='padding:6px;font-weight:600;white-space:nowrap'>"+cat.icon+" "+cat.label+"</td>"+cells+"</tr>";
              }).join("");
              return "<h2>WEEKLY COMMITMENT VS ACTUAL</h2>"
                +"<p class='note'>Category-by-category breakdown for "+rep.name+" — C = Committed, A = Actual. Red means they fell short that day. Use this to walk through the week day by day.</p>"
                +"<table style='width:100%;border-collapse:collapse;font-size:11px'><tr style='background:#f0f4f8'>"+detailHeader+"</tr>"+detailRows+"</table>";
            })():""}
            <h2>TRAINING OBSERVATIONS</h2>
            <p class="note">Observations are a core part of the training process. Field Training Observations (FTO) show how actively ${rep.name} is working alongside their trainer in the field.</p>
            <div class="grid">
              <div class="card"><div class="big">${rep.ftoCount||0}<span style="font-size:14px;color:#999">/20</span></div><div class="label">FTO Observations</div></div>
              <div class="card"><div class="big">${rep.lifeAppCount||0}<span style="font-size:14px;color:#999">/10</span></div><div class="label">Life Insurance Observations</div></div>
              <div class="card"><div class="big">${(rep.investmentObservations||[]).length}<span style="font-size:14px;color:#999">/10</span></div><div class="label">Investment Observations</div></div>
            </div>
            ${(()=>{
              const obs=rep.investmentObservations||[];
              if(obs.length===0) return "";
              let rows=obs.map((o,i)=>"<tr style='border-bottom:1px solid #eee'><td style='padding:6px;color:#999'>"+(i+1)+"</td><td style='padding:6px;font-weight:600'>"+o.name+"</td><td style='text-align:right;padding:6px;color:#666'>"+o.date+"</td></tr>").join("");
              return "<h2>INVESTMENT OBSERVATION LOG</h2><p class='note'>These are the prospects "+rep.name+" observed getting investment accounts opened during training appointments. This builds their future AUM pipeline.</p><table style='width:100%;border-collapse:collapse;font-size:12px;margin-top:8px'><tr style='background:#f0f4f8'><th style='text-align:left;padding:6px'>#</th><th style='text-align:left;padding:6px'>Prospect Name</th><th style='text-align:right;padding:6px'>Date Logged</th></tr>"+rows+"</table>";
            })()}
            <h2>CHECKLIST PROGRESS</h2>
            <p class="note">Training completion shows how invested ${rep.name} is in learning the system.</p>
            <p><strong>${rep.progress}% complete</strong></p>

            ${(rep.track==="fast"||rep.track==="regular")?(()=>{
              const trackDays=rep.track==="fast"?14:30;
              const trackLabel=rep.track==="fast"?"Fast Start (7-14 days)":"Regular Start (30 days)";
              // Use createdAt as start date since startDate was removed from Add Rep form
              const startDate=rep.createdAt?new Date(rep.createdAt):null;
              const daysSinceStart=startDate?Math.floor((Date.now()-startDate)/86400000):null;
              const daysRemaining=daysSinceStart!==null?Math.max(0,trackDays-daysSinceStart):null;
              const expectedPct=daysSinceStart!==null?Math.min(100,Math.round((daysSinceStart/trackDays)*100)):null;
              const actualPct=rep.progress||0;
              const onPace=expectedPct!==null?actualPct>=expectedPct:null;
              const chosenAt=rep.trackChosenAt||null;

              // References
              const refs=rep.references||[];
              const refsSubmitted=refs.filter(r=>r.name).length;
              const REF_STAGES_R=["textSent","callScheduled","called","callComplete","trainingApptSet"];
              const REF_LABELS_R={"textSent":"Text Sent","callScheduled":"Call Scheduled","called":"Called Ref","callComplete":"Call Complete","trainingApptSet":"Appt Set"};
              let refRows=refs.filter(r=>r.name).map((r)=>{
                const completed=REF_STAGES_R.filter(s=>(r.status||{})[s]);
                const latest=completed.length>0?REF_LABELS_R[completed[completed.length-1]]:"No outreach yet";
                const bg=completed.length>=5?"#d1fae5":completed.length>0?"#fef3c7":"#f1f5f9";
                const col=completed.length>=5?"#059669":completed.length>0?"#d97706":"#94a3b8";
                return "<tr style='border-bottom:1px solid #eee'><td style='padding:6px;font-weight:600'>"+(r.name||"")+"</td><td style='padding:6px;color:#666'>"+(r.phone||"")+"</td><td style='padding:6px;text-align:center'><span style='font-size:10px;padding:2px 6px;border-radius:4px;background:"+bg+";color:"+col+"'>"+latest+"</span></td></tr>";
              }).join("");

              // Login activity
              const loginHistory=(data.loginHistory||{})[rep.id]||[];
              const last7=[];
              for(let i=0;i<7;i++){const d=new Date();d.setDate(d.getDate()-i);last7.push(d.toISOString().split("T")[0]);}
              const loginsLast7=loginHistory.filter(l=>last7.includes(l.date)).length;
              const loginsTotal=loginHistory.length;

              // Pre-licensing
              const preLic=rep.preLicType||null;
              const preLicDone=rep.preLicDone||false;

              let html="<h2>NEW REP TRAINING STATUS</h2>";
              html+="<p class='note'>Detailed training snapshot for "+rep.name+" on the "+trackLabel+" path.</p>";
              html+="<div class='grid2'>";
              html+="<div class='card'><div class='big'>"+trackLabel+"</div><div class='label'>Training Path"+(chosenAt?" — Chose "+chosenAt:"")+"</div></div>";
              html+="<div class='card'><div class='big'>"+(daysSinceStart!==null?daysSinceStart+" days":"Unknown")+"</div><div class='label'>Days Since Start"+(startDate?" — "+startDate.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"")+"</div></div>";
              html+="<div class='card'><div class='big' style='color:"+(daysRemaining===0?"#ef4444":"inherit")+"'>"+(daysRemaining!==null?daysRemaining+" days left":"—")+"</div><div class='label'>Days Remaining to Target</div></div>";
              html+="<div class='card'><div class='big' style='color:"+(onPace===null?"#94a3b8":onPace?"#10b981":"#ef4444")+"'>"+(onPace===null?"—":onPace?"✅ On Pace":"⚠️ Behind")+"</div><div class='label'>Pace Check — Expected "+expectedPct+"% vs Actual "+actualPct+"%</div></div>";
              html+="<div class='card'><div class='big'>"+loginsLast7+"/7</div><div class='label'>App Logins Last 7 Days</div></div>";
              html+="<div class='card'><div class='big'>"+loginsTotal+"</div><div class='label'>Total App Logins</div></div>";
              html+="</div>";
              html+="<h2>REFERENCES PIPELINE ("+refsSubmitted+"/5)</h2>";
              html+=refsSubmitted===0?"<p style='color:#999;font-size:12px'>No references submitted yet — this should be one of the first things completed in training.</p>":"<table style='width:100%;border-collapse:collapse;font-size:12px;margin-top:8px'><tr style='background:#f0f4f8'><th style='text-align:left;padding:6px'>Name</th><th style='padding:6px'>Phone</th><th style='text-align:center;padding:6px'>Outreach Status</th></tr>"+refRows+"</table>";
              html+="<h2>PRE-LICENSING STATUS</h2>";
              html+="<div class='grid'>";
              html+="<div class='card'><div class='big'>"+(preLic||"Not selected yet")+"</div><div class='label'>Class Type Selected</div></div>";
              html+="<div class='card'><div class='big' style='color:"+(preLicDone?"#10b981":"#f59e0b")+"'>"+(preLicDone?"✅ Completed":"⏳ In Progress")+"</div><div class='label'>Pre-Licensing Class</div></div>";
              html+="<div class='card'><div class='big'>"+(rep.examDate?new Date(rep.examDate+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}):"Not scheduled yet")+"</div><div class='label'>Exam Date</div></div>";
              html+="</div>";
              if(!preLic) html+="<p style='color:#ef4444;font-size:12px;margin-top:6px'>⚠️ Rep has not selected a pre-licensing class type yet — check the Milestones tab.</p>";
              return html;
            })():""}

            <h2>COACHING NOTES</h2>
            <p class="note">Notes from previous coaching sessions.</p>
            ${(rep.checkIns||[]).length===0?"<p style='color:#999;font-size:12px'>No coaching notes yet</p>":
            (rep.checkIns||[]).slice(-5).reverse().map(ci=>`<div class="note-item">${ci.text}<div class="note-date">${new Date(ci.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div></div>`).join("")}

            <p style="margin-top:40px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:10px;">Generated by NextLevel Field Training Hub • ${new Date().toLocaleString()}</p>
            </body></html>`);
            w.document.close();
          }} style={{width:"100%",padding:"9px",borderRadius:8,background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,marginBottom:8}}>Generate Coaching Report</button>

          {/* Remove rep — admin only */}
          {isAdmin&&<button onClick={()=>removeRep(rep.id,rep.name)} style={{width:"100%",padding:"8px",borderRadius:8,background:C.danger+"11",color:C.danger,border:"1px solid "+C.danger+"33",cursor:"pointer",fontSize:13,fontWeight:600}}>Mark as Inactive</button>}
        </div>}
      </div>;
    })}
  </div>;
}

// ══════════════════════════════════════════════════
// REASSIGN TRAINER
// ══════════════════════════════════════════════════
function ReassignTrainer({rep,data,onUpdate}) {
  const [editing,setEditing] = useState(false);
  const [selected,setSelected] = useState(rep.trainerId||"");
  const trainers = data.trainers||[];
  const allOptions = [
    ...trainers.map(t=>({id:t.id,label:t.name})),
    ...(data.admins||[]).filter(a=>a.alsoRecruits||a.isSuperAdmin).map(a=>({id:a.id,label:a.name+" (Admin)"}))
  ];
  const current = allOptions.find(o=>o.id===rep.trainerId);

  const save = () => {
    const updatedReps = (data.reps||[]).map(r=>r.id===rep.id?{...r,trainerId:selected}:r);
    onUpdate(rep.id, {...rep, trainerId:selected});
    setEditing(false);
  };

  return <div style={{marginBottom:8}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{fontSize:13,color:C.textMid}}>Trainer: <strong style={{color:C.text}}>{current?.label||"Unassigned"}</strong></div>
      <button onClick={()=>{setSelected(rep.trainerId||"");setEditing(!editing);}} style={{fontSize:12,padding:"2px 7px",borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>{editing?"Cancel":"Reassign"}</button>
    </div>
    {editing&&<div style={{marginTop:6,display:"flex",gap:6}}>
      <select value={selected} onChange={e=>setSelected(e.target.value)} style={{flex:1,padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text}}>
        <option value="">No trainer</option>
        {trainers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        {(data.admins||[]).filter(a=>a.alsoRecruits||a.isSuperAdmin).map(a=><option key={a.id} value={a.id}>{a.name} (Admin)</option>)}
      </select>
      <button onClick={save} style={{padding:"6px 12px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Save</button>
    </div>}
  </div>;
}



// ── RECRUITED BY EDITOR ──
function RecruitedByEditor({rep,data,onUpdate}) {
  const [editing,setEditing] = useState(false);
  const [selected,setSelected] = useState(rep.recruitedBy||"");
  const current = findPerson(rep.recruitedBy,data);
  const allPeople = [
    ...(data.admins||[]).map(a=>({...a,label:a.name+" (Admin)"})),
    ...(data.trainers||[]).map(t=>({...t,label:t.name+" (Trainer)"})),
    ...(data.reps||[]).filter(r=>r.id!==rep.id).map(r=>({...r,label:r.name+" (Rep)"})),
  ];

  const save = () => {
    onUpdate(rep.id,{...rep,recruitedBy:selected});
    setEditing(false);
  };

  return <div style={{marginBottom:8}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{fontSize:13,color:C.textMid}}>Recruited by: <strong style={{color:current?C.purple:C.textLight}}>{current?.name||"Not specified"}</strong></div>
      <button onClick={()=>{setSelected(rep.recruitedBy||"");setEditing(!editing);}} style={{fontSize:12,padding:"2px 7px",borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>{editing?"Cancel":"Edit"}</button>
    </div>
    {editing&&<div style={{marginTop:6,display:"flex",gap:6}}>
      <select value={selected} onChange={e=>setSelected(e.target.value)} style={{flex:1,padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text}}>
        <option value="">Not specified</option>
        {allPeople.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <button onClick={save} style={{padding:"6px 12px",borderRadius:7,border:"none",background:C.purple,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Save</button>
    </div>}
  </div>;
}

// ── RESET PIN ──
function ResetPinButton({person,personType,data,onUpdate}) {
  const [showForm,setShowForm] = useState(false);
  const [newPin,setNewPin] = useState("");
  const [done,setDone] = useState(false);

  const save = () => {
    if(newPin.length!==4||isNaN(newPin)) {alert("PIN must be exactly 4 digits");return;}
    const field = personType==="rep"?"reps":personType==="trainer"?"trainers":"admins";
    const updated = (data[field]||[]).map(p=>p.id===person.id?{...p,customPin:newPin,pinReset:true}:p);
    onUpdate({...data,[field]:updated});
    setDone(true);
    setTimeout(()=>{setDone(false);setShowForm(false);setNewPin("");},2500);
  };

  return <div style={{marginBottom:8}}>
    {!showForm?<button onClick={()=>setShowForm(true)} style={{fontSize:12,padding:"4px 9px",borderRadius:6,border:"1px solid "+C.gold+"44",background:C.gold+"11",cursor:"pointer",color:C.gold,fontWeight:600}}>Reset PIN</button>:
    <div style={{background:C.surface,borderRadius:8,padding:"10px 12px",border:"1px solid "+C.gold+"33"}}>
      {done?<div style={{fontSize:13,color:C.success,fontWeight:600,textAlign:"center"}}>✓ PIN reset! Share the new PIN with {person.name}.</div>:<>
        <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:6}}>Set Temporary PIN for {person.name}</div>
        <div style={{fontSize:13,color:C.textMid,marginBottom:8,lineHeight:1.5}}>Enter a 4-digit temporary PIN. Share it with {person.name} verbally or by text. They will be prompted to set a new PIN on login.</div>
        <input type="number" placeholder="4-digit PIN" value={newPin} onChange={e=>setNewPin(e.target.value.slice(0,4))} style={{width:"100%",padding:"8px 10px",borderRadius:7,border:"1px solid "+C.border,fontSize:16,textAlign:"center",letterSpacing:6,color:C.text,marginBottom:8,boxSizing:"border-box"}}/>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>{setShowForm(false);setNewPin("");}} style={{flex:1,padding:"7px",borderRadius:7,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
          <button onClick={save} style={{flex:2,padding:"7px",borderRadius:7,border:"none",background:C.gold,color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>Set PIN</button>
        </div>
      </>}
    </div>}
  </div>;
}


// ── FIRST LOGIN PIN CHANGE ──
function ForceNewPin({session,data,onUpdate,onDone}) {
  const [pin1,setPin1] = useState("");
  const [pin2,setPin2] = useState("");
  const [err,setErr] = useState("");

  const save = () => {
    if(pin1.length!==4||isNaN(pin1)){setErr("PIN must be exactly 4 digits");return;}
    if(pin1!==pin2){setErr("PINs do not match");return;}
    const field = session.role==="rep"?"reps":session.role==="trainer"?"trainers":"admins";
    const updated = (data[field]||[]).map(p=>p.id===session.id?{...p,customPin:pin1,pinReset:false}:p);
    onUpdate({...data,[field]:updated});
    onDone();
  };

  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{background:"white",borderRadius:16,padding:"24px 20px",maxWidth:360,width:"100%"}}>
      <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:4}}>Set Your New PIN</div>
      <div style={{fontSize:13,color:C.textMid,marginBottom:16,lineHeight:1.6}}>Your PIN was recently reset. Please set a new personal 4-digit PIN to continue.</div>
      <div style={{marginBottom:10}}>
        <div style={{fontSize:13,color:C.textMid,marginBottom:4}}>New PIN</div>
        <input type="password" inputMode="numeric" maxLength={4} placeholder="Enter new 4-digit PIN" value={pin1} onChange={e=>setPin1(e.target.value)} style={{width:"100%",padding:"10px",borderRadius:8,border:"1px solid "+C.border,fontSize:18,textAlign:"center",letterSpacing:8,boxSizing:"border-box",color:C.text}}/>
      </div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:13,color:C.textMid,marginBottom:4}}>Confirm PIN</div>
        <input type="password" inputMode="numeric" maxLength={4} placeholder="Confirm your new PIN" value={pin2} onChange={e=>setPin2(e.target.value)} style={{width:"100%",padding:"10px",borderRadius:8,border:"1px solid "+C.border,fontSize:18,textAlign:"center",letterSpacing:8,boxSizing:"border-box",color:C.text}}/>
      </div>
      {err&&<div style={{fontSize:13,color:C.danger,marginBottom:10,textAlign:"center"}}>{err}</div>}
      <button onClick={save} style={{width:"100%",padding:"11px",borderRadius:9,background:"linear-gradient(135deg,"+C.teal+",#0891b2)",color:"white",border:"none",cursor:"pointer",fontSize:14,fontWeight:700}}>Save My PIN</button>
    </div>
  </div>;
}


// ── MONTH END CELEBRATION REPORT ──
const INCOME_MILESTONES = ["$25,000","$50,000","$100,000","100k Ring","$200,000","AALC Council Member","$300,000 Ownership","$500,000","$1,000,000"];
const PROMOTION_RANKS = ["Senior Rep","District Leader","Division Leader","Regional Leader","Field Trainer","Regional Vice President"];

function MonthEndReport({data}) {
  const [showForm,setShowForm] = useState(false);
  const now = new Date();
  const monthName = now.toLocaleDateString("en-US",{month:"long",year:"numeric"});
  const monthStart = new Date(now.getFullYear(),now.getMonth(),1).toISOString().split("T")[0];
  const reps = (data.reps||[]).filter(r=>!r.inactive);
  const trainers = data.trainers||[];
  const allPeople = [...reps,...trainers];
  const activityLogs = data.activityLogs||{};

  // Pre-calculate app data
  const newlyLicensed = reps.filter(r=>r.licensedDate&&r.licensedDate>=monthStart);
  const newTrainers = reps.filter(r=>r.fieldTrainerGranted&&r.fieldTrainerGrantedAt&&r.fieldTrainerGrantedAt>=monthStart);
  const withPremium = reps.map(r=>({name:r.name,total:(r.selfPremium||[]).reduce((s,e)=>s+(Number(e.premium)||0),0)})).filter(r=>r.total>0).sort((a,b)=>b.total-a.total);
  const withRecruits = allPeople.map(p=>({name:p.name,count:(data.reps||[]).filter(r=>r.recruitedBy===p.id&&!r.excludeFromRecruitCount).length})).filter(p=>p.count>0).sort((a,b)=>b.count-a.count);
  const withAppts = allPeople.map(p=>({name:p.name,appts:(data.scorecards||{})[p.id]?.apptDone||0})).filter(p=>p.appts>0).sort((a,b)=>b.appts-a.appts);
  const withStreak = allPeople.map(p=>{
    const repLog=activityLogs[p.id]||{};let streak=0;const d=new Date();
    while(true){const key=d.toISOString().split("T")[0];if(repLog[key])streak++;else break;d.setDate(d.getDate()-1);if(streak>365)break;}
    return {name:p.name,streak};
  }).filter(p=>p.streak>0).sort((a,b)=>b.streak-a.streak);
  const totalPremium = reps.reduce((s,r)=>s+(r.selfPremium||[]).reduce((ss,e)=>ss+(Number(e.premium)||0),0),0)
    +[...(data.trainers||[]),...(data.admins||[])].reduce((s,t)=>{const a=(data.myProduction||{})[t.id]?.lifeApps||[];return s+a.reduce((ss,a)=>ss+(Number(a.premium)||0),0);},0);
    const allInvestors = [...reps,...trainers,...(data.admins||[])];
    const repInv = reps.reduce((a,r)=>[...a,...(r.investments||[])],[]);
    const staffInv = [...trainers,...(data.admins||[])].reduce((a,p)=>[...a,...((data.myProduction||{})[p.id]?.investments||[])],[]);
    const allInv = [...repInv,...staffInv];
    const teamPAC = allInv.reduce((s,i)=>s+(Number(i.pac)||0),0);
    const teamLump = allInv.reduce((s,i)=>s+(Number(String(i.lumpSum||"").replace(/[$,]/g,""))||0),0);
  const totalRecruits = withRecruits.reduce((s,r)=>s+r.count,0);
  const teamTotals = {talked:0,followup:0,apptSet:0,apptRan:0,recruited:0,logsSubmitted:0};
  allPeople.forEach(p=>{const repLog=activityLogs[p.id]||{};Object.entries(repLog).forEach(([date,log])=>{if(typeof log==="object"&&log.submittedAt&&date>=monthStart){teamTotals.logsSubmitted++;teamTotals.talked+=(Number(log.talked)||0);teamTotals.followup+=(Number(log.followup)||0);teamTotals.apptSet+=(Number(log.apptSet)||0);teamTotals.apptRan+=(Number(log.apptRan)||0);teamTotals.recruited+=(Number(log.recruited)||0);}});});
  const wofThisMonth = (data.wallOfFame||[]).filter(r=>r.postedAt&&r.postedAt>=monthStart);
  const wofNamesDefault = wofThisMonth.map(r=>r.personName+" — "+r.category+(r.message?" — "+r.message:"")).join(", ");
  const completedChecklists = reps.filter(r=>{const cl=r.track==="licensed"?19:13;return Object.values(r.checked||{}).filter(Boolean).length>=cl;});

  // Editable form state
  const [form,setForm] = useState({
    totalPremium:totalPremium,
    totalRecruits:totalRecruits,
    apptRan:teamTotals.apptRan,
    talked:teamTotals.talked,
    logsSubmitted:teamTotals.logsSubmitted,
    teamPAC:teamPAC,
    teamLump:teamLump,
    topProducer:withPremium[0]?.name||"",
    topRecruiter:withRecruits[0]?.name||"",
    mostConsistent:withStreak[0]?.name||"",
    mostAppts:withAppts[0]?.name||"",
    newlyLicensed:newlyLicensed.map(r=>r.name).join(", "),
    newTrainers:newTrainers.map(r=>r.name).join(", "),
    completedChecklists:completedChecklists.map(r=>r.name).join(", "),
    promotions:PROMOTION_RANKS.reduce((a,r)=>({...a,[r]:""}),{}),
    milestones:INCOME_MILESTONES.reduce((a,m)=>({...a,[m]:""}),{}),
    commaChecks:"",
    customShoutout:"",
    wofNames:wofNamesDefault,
  });

  const generateHTML = (f) => {
    const w=window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html><head><title>Month End Report — ${monthName}</title><style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Arial,sans-serif;background:#f0f4f8;color:#1a1a2e;}
      .header{background:linear-gradient(135deg,#0d1b2a,#1a2d47);color:white;padding:40px 30px;text-align:center;}
      .header h1{font-size:28px;font-weight:800;margin-bottom:6px;}
      .month{font-size:20px;font-weight:700;color:#0ea5c9;margin-top:8px;}
      .container{max-width:900px;margin:30px auto;padding:0 20px;}
      .section{background:white;border-radius:12px;padding:24px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.08);}
      .section-title{font-size:18px;font-weight:800;margin-bottom:4px;}
      .section-desc{font-size:12px;color:#666;margin-bottom:16px;font-style:italic;}
      .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
      .stat-card{background:linear-gradient(135deg,#0d1b2a,#1a2d47);border-radius:10px;padding:16px;text-align:center;color:white;}
      .stat-number{font-size:28px;font-weight:800;color:#0ea5c9;}
      .stat-label{font-size:10px;opacity:0.7;text-transform:uppercase;margin-top:4px;}
      .person-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
      .person-card{background:#fef9ec;border:2px solid #f59e0b;border-radius:10px;padding:14px;text-align:center;}
      .person-name{font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:4px;}
      .person-label{font-size:10px;color:#666;}
      .names-list{display:flex;flex-wrap:wrap;gap:8px;}
      .name-chip{background:linear-gradient(135deg,#0ea5c9,#0891b2);color:white;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;}
      .name-chip.gold{background:linear-gradient(135deg,#f59e0b,#d97706);}
      .name-chip.purple{background:linear-gradient(135deg,#8b5cf6,#7c3aed);}
      .name-chip.green{background:linear-gradient(135deg,#10b981,#059669);}
      .milestone-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
      .milestone-card{background:#f8faff;border:1px solid #e2e8f0;border-radius:8px;padding:12px;}
      .milestone-label{font-size:11px;color:#0ea5c9;font-weight:700;margin-bottom:4px;}
      .milestone-names{font-size:12px;color:#1a1a2e;}
      .empty{color:#999;font-size:13px;font-style:italic;}
      .closing{text-align:center;background:linear-gradient(135deg,#0d1b2a,#1a2d47);color:white;padding:32px;}
      @media print{.no-print{display:none;}}
    </style></head><body>
    <div class="header">
      <h1>🏆 Month End Celebration Report</h1>
      <div class="month">${monthName}</div>
      <p style="margin-top:8px;font-size:12px;opacity:0.5">Generated ${new Date().toLocaleString()}</p>
    </div>
    <div class="container">
      <button class="no-print" onclick="window.print()" style="width:100%;padding:12px;background:linear-gradient(135deg,#0d1b2a,#1a2d47);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:20px;">Print / Save as PDF</button>

      <div class="section">
        <div class="section-title">📊 Team Highlights</div>
        <div class="section-desc">Look what we accomplished together this month!</div>
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-number">$${Number(f.totalPremium).toLocaleString()}</div><div class="stat-label">Total Premium</div></div>
          <div class="stat-card"><div class="stat-number">${f.totalRecruits}</div><div class="stat-label">New Recruits</div></div>
          <div class="stat-card"><div class="stat-number">${f.apptRan}</div><div class="stat-label">Appointments Run</div></div>
          <div class="stat-card"><div class="stat-number">${f.talked}</div><div class="stat-label">Conversations</div></div>
        </div>
      </div>

      ${f.newlyLicensed?`<div class="section">
        <div class="section-title">🎓 Newly Licensed</div>
        <div class="section-desc">These agents completed their licensing exam and are ready to protect families!</div>
        <div class="names-list">${f.newlyLicensed.split(",").map(n=>n.trim()).filter(Boolean).map(n=>`<div class="name-chip gold">⭐ ${n}</div>`).join("")}</div>
      </div>`:""}

      ${f.newTrainers?`<div class="section">
        <div class="section-title">👑 New Field Trainers</div>
        <div class="section-desc">Congratulations on earning your Field Trainer designation!</div>
        <div class="names-list">${f.newTrainers.split(",").map(n=>n.trim()).filter(Boolean).map(n=>`<div class="name-chip purple">👑 ${n}</div>`).join("")}</div>
      </div>`:""}

      ${Object.entries(f.promotions).some(([,v])=>v)?`<div class="section">
        <div class="section-title">🚀 Promotions</div>
        <div class="section-desc">Celebrating team members who leveled up this month!</div>
        <div class="milestone-grid">${Object.entries(f.promotions).filter(([,v])=>v).map(([rank,names])=>`<div class="milestone-card">
          <div class="milestone-label">${rank}</div>
          <div class="milestone-names">${names}</div>
        </div>`).join("")}</div>
      </div>`:""}

      ${Object.entries(f.milestones).some(([,v])=>v)||f.commaChecks?`<div class="section">
        <div class="section-title">💰 Income Milestones & Comma Checks</div>
        <div class="section-desc">Recognizing the financial wins our team is achieving!</div>
        ${f.commaChecks?`<div style="margin-bottom:12px"><div style="font-size:12px;font-weight:700;color:#059669;margin-bottom:6px">💵 Comma Check Recipients ($1,000+)</div>
        <div class="names-list">${f.commaChecks.split(",").map(n=>n.trim()).filter(Boolean).map(n=>`<div class="name-chip green">💵 ${n}</div>`).join("")}</div></div>`:""}
        <div class="milestone-grid">${Object.entries(f.milestones).filter(([,v])=>v).map(([m,names])=>`<div class="milestone-card">
          <div class="milestone-label">${m}</div>
          <div class="milestone-names">${names}</div>
        </div>`).join("")}</div>
      </div>`:""}

      <div class="section">
        <div class="section-title">🏆 Top Performers</div>
        <div class="section-desc">These team members led the way this month!</div>
        <div class="person-grid">
          ${f.topProducer?`<div class="person-card"><div style="font-size:20px">💰</div><div class="person-name">${f.topProducer}</div><div class="person-label">Top Producer</div></div>`:""}
          ${f.topRecruiter?`<div class="person-card"><div style="font-size:20px">🤝</div><div class="person-name">${f.topRecruiter}</div><div class="person-label">Top Recruiter</div></div>`:""}
          ${f.mostConsistent?`<div class="person-card"><div style="font-size:20px">🔥</div><div class="person-name">${f.mostConsistent}</div><div class="person-label">Most Consistent</div></div>`:""}
          ${f.mostAppts?`<div class="person-card"><div style="font-size:20px">📅</div><div class="person-name">${f.mostAppts}</div><div class="person-label">Most Appointments</div></div>`:""}
        </div>
      </div>

      ${f.wofNames?`<div class="section">
        <div class="section-title">⭐ Team Recognition</div>
        <div class="section-desc">These team members were recognized this month!</div>
        <div class="names-list">${f.wofNames.split(",").map(n=>n.trim()).filter(Boolean).map(n=>`<div class="name-chip">⭐ ${n}</div>`).join("")}</div>
      </div>`:""}

      ${f.customShoutout?`<div class="section">
        <div class="section-title">💪 Special Shoutouts</div>
        <div style="font-size:13px;color:#1a1a2e;line-height:1.7;white-space:pre-wrap">${f.customShoutout}</div>
      </div>`:""}

      <div class="closing section">
        <div style="font-size:28px;margin-bottom:8px">🚀</div>
        <div style="font-size:18px;font-weight:800;margin-bottom:8px;">Keep Going — Next Month Is Even Bigger!</div>
        <div style="font-size:13px;opacity:0.7;line-height:1.6;">Every conversation, every appointment, every family protected — it all counts. You are building something real. Let's finish strong!</div>
      </div>
    </div></body></html>`);
    w.document.close();
  };

  // ── Photo lookup helper ──
  const getPersonPhoto = (nameStr) => {
    if(!nameStr) return null;
    const name = nameStr.trim().toLowerCase();
    const allP = [...(data.reps||[]),...(data.trainers||[]),...(data.admins||[])];
    const person = allP.find(p=>(p.name||"").toLowerCase()===name||(p.name||"").toLowerCase().startsWith(name.split(" ")[0]));
    if(!person) return null;
    const photos = data.profilePhotos||{};
    if(photos[person.id]) return photos[person.id];
    try{const lsPhoto=localStorage.getItem("profilePhoto_"+person.id);if(lsPhoto)return lsPhoto;}catch(e){}
    if(person.dgoPhoto) return person.dgoPhoto;
    try{const lgDgo=localStorage.getItem("dgoPhoto_"+person.id);if(lgDgo)return lgDgo;}catch(e){}
    return null;
  };

  const getInitialImg = (name,color="0EA5C9") => {
    const initial = (name||"?").charAt(0).toUpperCase();
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><circle cx='100' cy='100' r='100' fill='%23${color}'/><text x='100' y='130' font-family='Arial' font-size='100' font-weight='bold' fill='white' text-anchor='middle'>${initial}</text></svg>`;
    return "image/png;base64,"+btoa(unescape(encodeURIComponent(svg)));
  };

  const addPersonCard = (slide,pres,name,label,x,y,w,h,bgColor="1A2D47") => {
    const photo = getPersonPhoto(name);
    slide.addShape("rect",{x,y,w,h,fill:{color:bgColor},rectRadius:0.08});
    if(photo){
      try{
        slide.addImage({data:photo,x:x+(w/2)-0.4,y:y+0.1,w:0.8,h:0.8,rounding:true});
        slide.addText(name,{x,y:y+0.95,w,h:0.35,fontSize:12,bold:true,color:"FFFFFF",align:"center"});
        if(label) slide.addText(label,{x,y:y+1.28,w,h:0.25,fontSize:8,color:"AABBCC",align:"center"});
      }catch(e){
        slide.addText((name||"?").charAt(0).toUpperCase(),{x,y:y+0.1,w,h:0.6,fontSize:28,bold:true,color:"0EA5C9",align:"center"});
        slide.addText(name,{x,y:y+0.72,w,h:0.35,fontSize:12,bold:true,color:"FFFFFF",align:"center"});
        if(label) slide.addText(label,{x,y:y+1.05,w,h:0.25,fontSize:8,color:"AABBCC",align:"center"});
      }
    } else {
      slide.addText((name||"?").charAt(0).toUpperCase(),{x,y:y+0.1,w,h:0.6,fontSize:28,bold:true,color:"0EA5C9",align:"center"});
      slide.addText(name,{x,y:y+0.72,w,h:0.35,fontSize:12,bold:true,color:"FFFFFF",align:"center"});
      if(label) slide.addText(label,{x,y:y+1.05,w,h:0.25,fontSize:8,color:"AABBCC",align:"center"});
    }
  };

  const generateSlideshow = (f) => {
    const w = window.open("","_blank");
    const slides = [
      // Slide 1 - Cover
      {bg:"linear-gradient(135deg,#0d1b2a,#1a2d47)",content:`
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px">
          <div style="font-size:72px;margin-bottom:20px">🏆</div>
          <div style="font-size:48px;font-weight:900;color:white;margin-bottom:12px;line-height:1.1">Month End<br>Celebration</div>
          <div style="font-size:28px;font-weight:700;color:#0ea5c9;margin-bottom:16px">${monthName}</div>
          <div style="width:80px;height:4px;background:#0ea5c9;border-radius:2px;margin-bottom:16px"></div>
          <div style="font-size:16px;color:rgba(255,255,255,0.5)">Team Performance Report</div>
        </div>`},
      // Slide 2 - Team Highlights
      {bg:"#f0f4f8",content:`
        <div style="padding:40px;height:100%;box-sizing:border-box">
          <div style="font-size:32px;font-weight:900;color:#0d1b2a;margin-bottom:6px">📊 Team Highlights</div>
          <div style="font-size:14px;color:#666;margin-bottom:28px;font-style:italic">Look what we accomplished together this month!</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
            ${[["$"+Number(f.totalPremium).toLocaleString(),"Life Premium"],["$"+Number(f.teamPAC||0).toLocaleString(),"Monthly PAC"],["$"+Number(f.teamLump||0).toLocaleString(),"Total Lump Sum"],[""+f.totalRecruits,"New Recruits"],[""+f.apptRan,"Appointments Run"],[""+f.talked,"Conversations"]].map(([v,l])=>`
            <div style="background:linear-gradient(135deg,#0d1b2a,#1a2d47);border-radius:16px;padding:24px;text-align:center">
              <div style="font-size:36px;font-weight:900;color:#0ea5c9">${v}</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;margin-top:6px">${l}</div>
            </div>`).join("")}
          </div>
        </div>`},
      // Slide 3 - Newly Licensed
      ...(f.newlyLicensed?[{bg:"linear-gradient(135deg,#0d1b2a,#1a2d47)",content:`
        <div style="padding:40px;height:100%;box-sizing:border-box">
          <div style="font-size:32px;font-weight:900;color:#f59e0b;margin-bottom:6px">🎓 Newly Licensed</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:28px;font-style:italic">These agents are ready to protect families!</div>
          <div style="display:flex;flex-wrap:wrap;gap:12px">
            ${f.newlyLicensed.split(",").map(n=>n.trim()).filter(Boolean).map(n=>{
              const allP=[...(data.reps||[]),...(data.trainers||[]),...(data.admins||[])];
              const person=allP.find(p=>(p.name||"").toLowerCase()===n.toLowerCase()||(p.name||"").toLowerCase().startsWith(n.split(" ")[0].toLowerCase()));
              let photo=(data.profilePhotos||{})[person?.id]||null;
              if(!photo&&person?.id){try{photo=localStorage.getItem("profilePhoto_"+person.id)||null;}catch(e){}}
              if(!photo&&person?.dgoPhoto){photo=person.dgoPhoto;}
              if(!photo&&person?.id){try{photo=localStorage.getItem("dgoPhoto_"+person.id)||null;}catch(e){}}
              return `<div style="background:rgba(245,158,11,0.15);border:2px solid #f59e0b;border-radius:16px;padding:16px 20px;display:flex;align-items:center;gap:12px">
                ${photo?`<img src="${photo}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #f59e0b">`:`<div style="width:48px;height:48px;border-radius:50%;background:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#0d1b2a">${n.charAt(0)}</div>`}
                <div><div style="font-size:18px;font-weight:700;color:white">⭐ ${n}</div><div style="font-size:11px;color:#f59e0b">Licensed Agent</div></div>
              </div>`;
            }).join("")}
          </div>
        </div>`}]:[]),
      // Slide 4 - New Field Trainers
      ...(f.newTrainers?[{bg:"linear-gradient(135deg,#2d1a47,#1a0d2e)",content:`
        <div style="padding:40px;height:100%;box-sizing:border-box">
          <div style="font-size:32px;font-weight:900;color:#c084fc;margin-bottom:6px">👑 New Field Trainers</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:28px;font-style:italic">Congratulations on earning your Field Trainer designation!</div>
          <div style="display:flex;flex-wrap:wrap;gap:12px">
            ${f.newTrainers.split(",").map(n=>n.trim()).filter(Boolean).map(n=>{
              const allP=[...(data.reps||[]),...(data.trainers||[]),...(data.admins||[])];
              const person=allP.find(p=>(p.name||"").toLowerCase()===n.toLowerCase()||(p.name||"").toLowerCase().startsWith(n.split(" ")[0].toLowerCase()));
              let photo=(data.profilePhotos||{})[person?.id]||null;
              if(!photo&&person?.id){try{photo=localStorage.getItem("profilePhoto_"+person.id)||null;}catch(e){}}
              if(!photo&&person?.dgoPhoto){photo=person.dgoPhoto;}
              if(!photo&&person?.id){try{photo=localStorage.getItem("dgoPhoto_"+person.id)||null;}catch(e){}}
              return `<div style="background:rgba(139,92,246,0.2);border:2px solid #8b5cf6;border-radius:16px;padding:16px 20px;display:flex;align-items:center;gap:12px">
                ${photo?`<img src="${photo}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #8b5cf6">`:`<div style="width:48px;height:48px;border-radius:50%;background:#8b5cf6;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:white">${n.charAt(0)}</div>`}
                <div><div style="font-size:18px;font-weight:700;color:white">👑 ${n}</div><div style="font-size:11px;color:#c084fc">Field Trainer</div></div>
              </div>`;
            }).join("")}
          </div>
        </div>`}]:[]),
      // Slide 5 - Promotions
      ...(Object.entries(f.promotions).some(([,v])=>v)?[{bg:"#f0f4f8",content:`
        <div style="padding:40px;height:100%;box-sizing:border-box">
          <div style="font-size:32px;font-weight:900;color:#0d1b2a;margin-bottom:6px">🚀 Promotions</div>
          <div style="font-size:14px;color:#666;margin-bottom:24px;font-style:italic">Celebrating team members who leveled up!</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
            ${Object.entries(f.promotions).filter(([,v])=>v).map(([rank,names])=>`
            <div style="background:linear-gradient(135deg,#0d1b2a,#1a2d47);border-radius:12px;padding:16px">
              <div style="font-size:11px;color:#0ea5c9;font-weight:700;text-transform:uppercase;margin-bottom:8px">${rank}</div>
              ${names.split(",").map(n=>n.trim()).filter(Boolean).map(n=>{
                const allP=[...(data.reps||[]),...(data.trainers||[]),...(data.admins||[])];
                const person=allP.find(p=>(p.name||"").toLowerCase()===n.toLowerCase()||(p.name||"").toLowerCase().startsWith(n.split(" ")[0].toLowerCase()));
                let photo=(data.profilePhotos||{})[person?.id]||null;
              if(!photo&&person?.id){try{photo=localStorage.getItem("profilePhoto_"+person.id)||null;}catch(e){}}
              if(!photo&&person?.dgoPhoto){photo=person.dgoPhoto;}
              if(!photo&&person?.id){try{photo=localStorage.getItem("dgoPhoto_"+person.id)||null;}catch(e){}}
                return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                  ${photo?`<img src="${photo}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:1px solid #0ea5c9">`:`<div style="width:32px;height:32px;border-radius:50%;background:#0ea5c9;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#0d1b2a;flex-shrink:0">${n.charAt(0)}</div>`}
                  <span style="font-size:13px;color:white;font-weight:600">${n}</span>
                </div>`;
              }).join("")}
            </div>`).join("")}
          </div>
        </div>`}]:[]),
      // Slide 6 - Comma Checks (all recipients on ONE slide, green)
      ...(f.commaChecks?[{bg:"linear-gradient(135deg,#064e3b,#065f46)",content:`
        <div style="display:flex;flex-direction:column;height:100%;text-align:center;padding:32px">
          <div style="font-size:13px;color:#34d399;font-weight:700;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px">💵 Comma Check Recipients</div>
          <div style="font-size:40px;font-weight:900;color:#34d399;margin-bottom:6px">$1,000+</div>
          <div style="width:60px;height:4px;background:#34d399;border-radius:2px;margin:0 auto 24px"></div>
          <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;align-items:center;flex:1">
            ${f.commaChecks.split(",").map(n=>n.trim()).filter(Boolean).map(n=>{
              const photo=getPersonPhoto(n);
              return `<div style="text-align:center">
                ${photo?`<img src="${photo}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;border:4px solid #34d399;margin-bottom:10px;box-shadow:0 0 30px rgba(52,211,153,0.4)">`:`<div style="width:120px;height:120px;border-radius:50%;background:linear-gradient(135deg,#059669,#047857);display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:900;color:white;margin-bottom:10px">${n.charAt(0)}</div>`}
                <div style="font-size:18px;font-weight:800;color:white">${n}</div>
              </div>`;
            }).join("")}
          </div>
        </div>`}]:[]),
      // Slide 6b - Income Milestones (one slide PER MILESTONE LEVEL, bigger photos)
      ...Object.entries(f.milestones).filter(([,v])=>v).map(([milestone,namesStr])=>{
        const names=namesStr.split(",").map(n=>n.trim()).filter(Boolean);
        const photoSize=names.length===1?"200px":"140px";
        const fontSize=names.length===1?"30px":"22px";
        return {bg:"linear-gradient(135deg,#052e16,#064e3b)",content:`
          <div style="display:flex;flex-direction:column;height:100%;text-align:center;padding:32px">
            <div style="font-size:13px;color:#34d399;font-weight:700;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px">🏆 Income Milestone</div>
            <div style="font-size:44px;font-weight:900;color:#fbbf24;margin-bottom:6px">${milestone}</div>
            <div style="width:60px;height:4px;background:#fbbf24;border-radius:2px;margin:0 auto 24px"></div>
            <div style="display:flex;flex-wrap:wrap;gap:24px;justify-content:center;align-items:center;flex:1">
              ${names.map(n=>{
                const photo=getPersonPhoto(n);
                return `<div style="text-align:center">
                  ${photo?`<img src="${photo}" style="width:${photoSize};height:${photoSize};border-radius:50%;object-fit:cover;border:5px solid #fbbf24;margin-bottom:14px;box-shadow:0 0 40px rgba(251,191,36,0.5)">`:`<div style="width:${photoSize};height:${photoSize};border-radius:50%;background:linear-gradient(135deg,#d97706,#b45309);display:flex;align-items:center;justify-content:center;font-size:80px;font-weight:900;color:white;margin-bottom:14px">${n.charAt(0)}</div>`}
                  <div style="font-size:${fontSize};font-weight:800;color:white">${n}</div>
                </div>`;
              }).join("")}
            </div>
            <div style="font-size:15px;color:rgba(255,255,255,0.5);margin-top:16px">Congratulations on this incredible achievement!</div>
          </div>`};
      }),
      // Slide 7 - Top Performers
      {bg:"linear-gradient(135deg,#0d1b2a,#1a2d47)",content:`
        <div style="padding:40px;height:100%;box-sizing:border-box">
          <div style="font-size:32px;font-weight:900;color:#f59e0b;margin-bottom:6px">🏆 Top Performers</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:24px;font-style:italic">These team members led the way this month!</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
            ${[["💰","Top Producer",f.topProducer],["🤝","Top Recruiter",f.topRecruiter],["🔥","Most Consistent",f.mostConsistent],["📅","Most Appointments",f.mostAppts]].filter(([,,n])=>n).map(([emoji,label,name])=>{
              const allP=[...(data.reps||[]),...(data.trainers||[]),...(data.admins||[])];
              const person=allP.find(p=>(p.name||"").toLowerCase()===name.toLowerCase()||(p.name||"").toLowerCase().startsWith(name.split(" ")[0].toLowerCase()));
              let photo=(data.profilePhotos||{})[person?.id]||null;
              if(!photo&&person?.id){try{photo=localStorage.getItem("profilePhoto_"+person.id)||null;}catch(e){}}
              if(!photo&&person?.dgoPhoto){photo=person.dgoPhoto;}
              if(!photo&&person?.id){try{photo=localStorage.getItem("dgoPhoto_"+person.id)||null;}catch(e){}}
              return `<div style="background:rgba(245,158,11,0.1);border:2px solid #f59e0b44;border-radius:16px;padding:20px;text-align:center">
                ${photo?`<img src="${photo}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid #f59e0b;margin-bottom:10px">`:`<div style="width:72px;height:72px;border-radius:50%;background:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#0d1b2a;margin:0 auto 10px">${name.charAt(0)}</div>`}
                <div style="font-size:20px;margin-bottom:6px">${emoji}</div>
                <div style="font-size:15px;font-weight:700;color:white;margin-bottom:4px">${name}</div>
                <div style="font-size:11px;color:#f59e0b">${label}</div>
              </div>`;
            }).join("")}
          </div>
        </div>`},
      // Slide 8 - Team Activity
      {bg:"#f0f4f8",content:`
        <div style="padding:40px;height:100%;box-sizing:border-box">
          <div style="font-size:32px;font-weight:900;color:#0d1b2a;margin-bottom:6px">📈 Team Activity This Month</div>
          <div style="font-size:14px;color:#666;margin-bottom:28px;font-style:italic">Combined activity reported by the entire team</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">
            ${[[""+f.logsSubmitted,"Daily Logs Submitted","#0ea5c9"],[""+f.talked,"People Talked To","#10b981"],[""+f.apptRan,"Appointments Run","#f59e0b"],[""+f.followup||teamTotals.followup,"Follow-up Calls","#8b5cf6"]].map(([v,l,c])=>`
            <div style="background:linear-gradient(135deg,#0d1b2a,#1a2d47);border-radius:16px;padding:28px;display:flex;align-items:center;gap:20px">
              <div style="font-size:48px;font-weight:900;color:${c}">${v}</div>
              <div style="font-size:14px;color:rgba(255,255,255,0.7)">${l}</div>
            </div>`).join("")}
          </div>
        </div>`},
      // Slide 9 - Recognition
      ...(f.wofNames?[{bg:"linear-gradient(135deg,#0d1b2a,#1a2d47)",content:`
        <div style="padding:40px;height:100%;box-sizing:border-box">
          <div style="font-size:32px;font-weight:900;color:white;margin-bottom:6px">⭐ Team Recognition</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:24px;font-style:italic">Recognized for going above and beyond!</div>
          <div style="display:flex;flex-wrap:wrap;gap:14px">
            ${f.wofNames.split(",").map(n=>n.trim()).filter(Boolean).map(n=>{
              const allP2=[...(data.reps||[]),...(data.trainers||[]),...(data.admins||[])];
              const nameOnly=n.split("—")[0].trim();
              const personW=allP2.find(p=>(p.name||"").toLowerCase()===nameOnly.toLowerCase()||(p.name||"").toLowerCase().startsWith(nameOnly.split(" ")[0].toLowerCase()));
              let photoW=(data.wofPhotos||{})[personW?.id]||(data.profilePhotos||{})[personW?.id]||null;
              if(!photoW&&personW?.id){try{photoW=localStorage.getItem("wofPhoto_"+personW.id)||localStorage.getItem("profilePhoto_"+personW.id)||null;}catch(e){}}
              if(!photoW&&personW?.dgoPhoto){photoW=personW.dgoPhoto;}
              if(!photoW&&personW?.id){try{photoW=localStorage.getItem("dgoPhoto_"+personW.id)||null;}catch(e){}}
              return `<div style="background:rgba(245,158,11,0.15);border:1px solid #f59e0b44;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px;max-width:320px">
                ${photoW?`<img src="${photoW}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #f59e0b;flex-shrink:0">`:`<div style="width:40px;height:40px;border-radius:50%;background:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#0d1b2a;flex-shrink:0">${nameOnly.charAt(0)}</div>`}
                <span style="font-size:13px;color:#f59e0b;font-weight:600">⭐ ${n}</span>
              </div>`;
            }).join("")}
          </div>
        </div>`}]:[]),
      // Closing slide
      {bg:"linear-gradient(135deg,#0d1b2a,#1a2d47)",content:`
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px">
          <div style="font-size:72px;margin-bottom:20px">🚀</div>
          <div style="font-size:42px;font-weight:900;color:white;margin-bottom:12px;line-height:1.1">Keep Going!</div>
          <div style="font-size:24px;font-weight:700;color:#0ea5c9;margin-bottom:20px">Next Month Is Even Bigger!</div>
          <div style="width:80px;height:4px;background:#0ea5c9;border-radius:2px;margin-bottom:20px"></div>
          <div style="font-size:15px;color:rgba(255,255,255,0.6);max-width:600px;line-height:1.7">Every conversation, every appointment, every family protected — it all counts. You are building something real. Let's finish strong!</div>
        </div>`},
    ];

    const slideCount = slides.length;
    const slidesHTML = slides.map((s,i)=>'<div class="slide '+(i===0?"active":"")+'" id="slide'+i+'" style="background:'+s.bg+'"><div class="slide-inner">'+s.content+'</div></div>').join("");

    const html = '<!DOCTYPE html><html><head><title>Month End Report — '+monthName+'</title><style>'
      +'*{margin:0;padding:0;box-sizing:border-box;}'
      +'body{font-family:Arial,sans-serif;background:#111;color:white;}'
      +'.slide{width:100vw;height:100vh;display:none;overflow:hidden;position:relative;}'
      +'.slide.active{display:flex;align-items:stretch;}'
      +'.slide-inner{width:100%;display:flex;flex-direction:column;}'
      +'.nav{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:12px;align-items:center;z-index:100;background:rgba(0,0,0,0.5);padding:10px 20px;border-radius:30px;}'
      +'.nav button{background:rgba(255,255,255,0.2);color:white;border:none;padding:8px 20px;border-radius:20px;cursor:pointer;font-size:14px;font-weight:600;}'
      +'.nav .counter{font-size:13px;color:rgba(255,255,255,0.7);min-width:60px;text-align:center;}'
      +'.print-btn{position:fixed;top:16px;right:16px;background:#0ea5c9;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;z-index:100;}'
      +'@media print{.nav,.print-btn{display:none;}.slide{display:flex!important;page-break-after:always;width:100%;height:100vh;}}'
      +'</style></head><body>'
      +slidesHTML
      +'<div class="nav">'
      +'<button onclick="changeSlide(-1)">&#8592; Prev</button>'
      +'<span class="counter" id="counter">1 / '+slideCount+'</span>'
      +'<button onclick="changeSlide(1)">Next &#8594;</button>'
      +'</div>'
      +'<button class="print-btn" onclick="window.print()">Print / PDF</button>'
      +'<script>'
      +'var cur=0;'
      +'function changeSlide(dir){'
      +'document.getElementById("slide"+cur).classList.remove("active");'
      +'cur=Math.max(0,Math.min('+slideCount+'-1,cur+dir));'
      +'document.getElementById("slide"+cur).classList.add("active");'
      +'document.getElementById("counter").textContent=(cur+1)+" / '+slideCount+'";'
      +'}'
      +'document.addEventListener("keydown",function(e){if(e.key==="ArrowRight"||e.key===" ")changeSlide(1);if(e.key==="ArrowLeft")changeSlide(-1);});'
      +'<'+'/script>'
      +'</body></html>';

    w.document.write(html);
    w.document.close();
  };

  if(!showForm) return <button onClick={()=>setShowForm(true)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",borderRadius:9,background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,width:"100%",justifyContent:"center",marginBottom:10}}>
    🏆 Generate Month End Celebration Report
  </button>;

  return <div style={{background:"white",borderRadius:12,border:"1px solid "+C.gold+"44",padding:"16px",marginBottom:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text}}>Month End Report — {monthName}</div>
      <button onClick={()=>setShowForm(false)} style={{fontSize:13,color:C.textMid,background:"none",border:"none",cursor:"pointer"}}>Cancel</button>
    </div>

    {/* Team Numbers */}
    <div style={{fontSize:13,fontWeight:700,color:C.teal,marginBottom:6,textTransform:"uppercase"}}>Team Numbers</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:12}}>
      {[["Total Life Premium $",form.totalPremium,"totalPremium"],["Total Recruits",form.totalRecruits,"totalRecruits"],["Appointments Run",form.apptRan,"apptRan"],["People Talked To",form.talked,"talked"],["Daily Logs Submitted",form.logsSubmitted,"logsSubmitted"],["Monthly PAC $",form.teamPAC,"teamPAC"],["Lump Sum $",form.teamLump,"teamLump"]].map(([label,val,key])=><div key={key}>
        <div style={{fontSize:12,color:C.textMid,marginBottom:2}}>{label}</div>
        <input type="number" value={val} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
      </div>)}
    </div>

    {/* Names */}
    <div style={{fontSize:13,fontWeight:700,color:C.teal,marginBottom:6,textTransform:"uppercase"}}>People to Recognize</div>
    {[["Newly Licensed (comma separated)",form.newlyLicensed,"newlyLicensed"],["New Field Trainers",form.newTrainers,"newTrainers"],["Completed Checklist",form.completedChecklists,"completedChecklists"],["Top Producer",form.topProducer,"topProducer"],["Top Recruiter",form.topRecruiter,"topRecruiter"],["Most Consistent",form.mostConsistent,"mostConsistent"],["Most Appointments",form.mostAppts,"mostAppts"],["Comma Check Recipients",form.commaChecks,"commaChecks"],["Wall of Fame Recognition",form.wofNames,"wofNames"]].map(([label,val,key])=>{
      const previewPhotos = (val||"").split(",").map(n=>n.trim()).filter(Boolean).map(name=>{
        const allP=[...(data.reps||[]),...(data.trainers||[]),...(data.admins||[])];
        const person=allP.find(p=>(p.name||"").toLowerCase()===name.toLowerCase()||(p.name||"").toLowerCase().startsWith(name.split(" ")[0].toLowerCase()));
        let photo=(data.profilePhotos||{})[person?.id]||null;
              if(!photo&&person?.id){try{photo=localStorage.getItem("profilePhoto_"+person.id)||null;}catch(e){}}
              if(!photo&&person?.dgoPhoto){photo=person.dgoPhoto;}
              if(!photo&&person?.id){try{photo=localStorage.getItem("dgoPhoto_"+person.id)||null;}catch(e){}}
        return {name,photo};
      });
      return <div key={key} style={{marginBottom:8}}>
        <div style={{fontSize:12,color:C.textMid,marginBottom:2}}>{label}</div>
        <input value={val} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:13,color:C.text,boxSizing:"border-box",marginBottom:previewPhotos.length>0?4:0}}/>
        {previewPhotos.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {previewPhotos.map((p,pi)=><div key={pi} style={{display:"flex",alignItems:"center",gap:4,background:C.surface,borderRadius:6,padding:"2px 6px"}}>
            {p.photo?<img src={p.photo} style={{width:20,height:20,borderRadius:10,objectFit:"cover"}}/>:<div style={{width:20,height:20,borderRadius:10,background:C.teal,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"white"}}>{p.name.charAt(0)}</div>}
            <span style={{fontSize:12,color:C.text}}>{p.name}</span>
          </div>)}
        </div>}
      </div>;
    })}

    {/* Promotions */}
    <div style={{fontSize:13,fontWeight:700,color:C.teal,marginBottom:6,textTransform:"uppercase",marginTop:4}}>Promotions</div>
    {PROMOTION_RANKS.map(rank=>{
      const previews=(form.promotions[rank]||"").split(",").map(n=>n.trim()).filter(Boolean).map(name=>{
        const allP=[...(data.reps||[]),...(data.trainers||[]),...(data.admins||[])];
        const person=allP.find(p=>(p.name||"").toLowerCase()===name.toLowerCase()||(p.name||"").toLowerCase().startsWith(name.split(" ")[0].toLowerCase()));
        let photo=(data.profilePhotos||{})[person?.id]||null;
              if(!photo&&person?.id){try{photo=localStorage.getItem("profilePhoto_"+person.id)||null;}catch(e){}}
              if(!photo&&person?.dgoPhoto){photo=person.dgoPhoto;}
              if(!photo&&person?.id){try{photo=localStorage.getItem("dgoPhoto_"+person.id)||null;}catch(e){}}
        return {name,photo};
      });
      return <div key={rank} style={{marginBottom:8}}>
        <div style={{fontSize:12,color:C.textMid,marginBottom:2}}>{rank}</div>
        <input placeholder="Names (comma separated)..." value={form.promotions[rank]||""} onChange={e=>setForm(f=>({...f,promotions:{...f.promotions,[rank]:e.target.value}}))} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:13,color:C.text,boxSizing:"border-box",marginBottom:previews.length>0?4:0}}/>
        {previews.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {previews.map((p,pi)=><div key={pi} style={{display:"flex",alignItems:"center",gap:4,background:C.surface,borderRadius:6,padding:"2px 6px"}}>
            {p.photo?<img src={p.photo} style={{width:20,height:20,borderRadius:10,objectFit:"cover"}}/>:<div style={{width:20,height:20,borderRadius:10,background:C.teal,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"white"}}>{p.name.charAt(0)}</div>}
            <span style={{fontSize:12,color:C.text}}>{p.name}</span>
          </div>)}
        </div>}
      </div>;
    })}

    {/* Income Milestones */}
    <div style={{fontSize:13,fontWeight:700,color:C.teal,marginBottom:6,textTransform:"uppercase",marginTop:4}}>Income Milestones</div>
    {INCOME_MILESTONES.map(m=>{
      const previews=(form.milestones[m]||"").split(",").map(n=>n.trim()).filter(Boolean).map(name=>{
        const allP=[...(data.reps||[]),...(data.trainers||[]),...(data.admins||[])];
        const person=allP.find(p=>(p.name||"").toLowerCase()===name.toLowerCase()||(p.name||"").toLowerCase().startsWith(name.split(" ")[0].toLowerCase()));
        let photo=(data.profilePhotos||{})[person?.id]||null;
              if(!photo&&person?.id){try{photo=localStorage.getItem("profilePhoto_"+person.id)||null;}catch(e){}}
              if(!photo&&person?.dgoPhoto){photo=person.dgoPhoto;}
              if(!photo&&person?.id){try{photo=localStorage.getItem("dgoPhoto_"+person.id)||null;}catch(e){}}
        return {name,photo};
      });
      return <div key={m} style={{marginBottom:8}}>
        <div style={{fontSize:12,color:C.textMid,marginBottom:2}}>{m}</div>
        <input placeholder="Names (comma separated)..." value={form.milestones[m]||""} onChange={e=>setForm(f=>({...f,milestones:{...f.milestones,[m]:e.target.value}}))} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:13,color:C.text,boxSizing:"border-box",marginBottom:previews.length>0?4:0}}/>
        {previews.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {previews.map((p,pi)=><div key={pi} style={{display:"flex",alignItems:"center",gap:4,background:"#064e3b22",borderRadius:6,padding:"2px 6px",border:"1px solid #34d39944"}}>
            {p.photo?<img src={p.photo} style={{width:20,height:20,borderRadius:10,objectFit:"cover"}}/>:<div style={{width:20,height:20,borderRadius:10,background:"#059669",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"white"}}>{p.name.charAt(0)}</div>}
            <span style={{fontSize:12,color:"#059669",fontWeight:600}}>{p.name}</span>
          </div>)}
        </div>}
      </div>;
    })}

    {/* Custom Shoutout */}
    <div style={{fontSize:13,fontWeight:700,color:C.teal,marginBottom:6,textTransform:"uppercase",marginTop:4}}>Special Shoutouts</div>
    <textarea placeholder="Any additional shoutouts or notes..." value={form.customShoutout} onChange={e=>setForm(f=>({...f,customShoutout:e.target.value}))} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text,resize:"vertical",minHeight:60,boxSizing:"border-box",lineHeight:1.5,marginBottom:12}}/>

    {/* Generate buttons */}
    <div style={{display:"flex",gap:8}}>
      <button onClick={()=>generateHTML(form)} style={{flex:1,padding:"10px",borderRadius:8,background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:700}}>📄 Generate PDF Version</button>
      <button onClick={()=>generateSlideshow(form)} style={{flex:1,padding:"10px",borderRadius:8,background:"linear-gradient(135deg,"+C.gold+",#d97706)",color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:700}}>📊 View as Slideshow</button>
    </div>
    <div style={{fontSize:12,color:C.textMid,textAlign:"center",marginTop:6}}>PowerPoint can be uploaded to Google Drive and opened as Google Slides</div>
  </div>;
}


// ── NEED HELP ──
function NeedHelpModal({rep,data,onUpdate,onClose}) {
  const [msg,setMsg] = useState("");
  const [sent,setSent] = useState(false);
  const send = () => {
    if(!msg.trim()) return;
    const alert = {repId:rep.id,repName:rep.name,repTrack:rep.track,message:msg,sentAt:new Date().toISOString(),dismissed:false};
    onUpdate({...data,helpRequests:[...(data.helpRequests||[]),alert]});
    setSent(true);
  };
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{background:"white",borderRadius:16,padding:"24px 20px",maxWidth:380,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
      {!sent?<>
        <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:4}}>Need Help?</div>
        <div style={{fontSize:13,color:C.textMid,marginBottom:14,lineHeight:1.5}}>Tell us what you need help with and your trainer and admin will be notified right away.</div>
        <textarea placeholder="What do you need help with? Give us a quick summary..." value={msg} onChange={e=>setMsg(e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1px solid "+C.border,fontSize:14,color:C.text,resize:"vertical",minHeight:90,boxSizing:"border-box",lineHeight:1.5,fontFamily:"inherit",marginBottom:10}}/>
        <div style={{background:C.teal+"11",border:"1px solid "+C.teal+"33",borderRadius:8,padding:"8px 12px",fontSize:13,color:C.teal,marginBottom:14,lineHeight:1.5}}>
          For a quicker response, reach out to your trainer directly on <strong>Telegram</strong>!
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"9px",borderRadius:8,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
          <button onClick={send} style={{flex:2,padding:"9px",borderRadius:8,border:"none",background:"linear-gradient(135deg,"+C.teal+",#0891b2)",color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>Send</button>
        </div>
      </>:<>
        <div style={{textAlign:"center",padding:"12px 0"}}>
          <div style={{fontSize:32,marginBottom:10}}>✓</div>
          <div style={{fontSize:15,fontWeight:700,color:C.success,marginBottom:6}}>Message Sent!</div>
          <div style={{fontSize:13,color:C.textMid,marginBottom:6,lineHeight:1.5}}>Your trainer and admin have been notified. We will be in touch soon!</div>
          <div style={{fontSize:13,color:C.teal,fontWeight:600,marginBottom:16}}>Remember — Telegram is available for a quicker response!</div>
          <button onClick={onClose} style={{padding:"9px 24px",borderRadius:8,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:700}}>Done</button>
        </div>
      </>}
    </div>
  </div>;
}

// ── HELP REQUESTS BANNER (admin/trainer dashboard) ──
function HelpRequestsBanner({data,onUpdate,userRole,userId}) {
  const requests = (data.helpRequests||[]).filter(r=>!r.dismissed);
  const myRequests = userRole==="trainer" ? requests.filter(r=>{const rep=(data.reps||[]).find(rp=>rp.id===r.repId);return rep?.trainerId===userId;}) : requests;
  if(myRequests.length===0) return null;
  const dismiss = (i) => {
    const idx = (data.helpRequests||[]).findIndex(r=>r.repId===myRequests[i].repId&&r.sentAt===myRequests[i].sentAt);
    const updated = (data.helpRequests||[]).map((r,j)=>j===idx?{...r,dismissed:true}:r);
    onUpdate({...data,helpRequests:updated});
  };
  return <div style={{background:"white",borderRadius:12,border:"2px solid "+C.danger+"44",padding:"12px 16px",marginBottom:14}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <div style={{width:8,height:8,borderRadius:4,background:C.danger,animation:"pulse 1.5s infinite"}}/>
      <div style={{fontSize:14,fontWeight:700,color:C.text}}>Help Requests ({myRequests.length})</div>
    </div>
    {myRequests.map((r,i)=><div key={i} style={{background:C.danger+"08",borderRadius:8,padding:"10px 12px",marginBottom:6,border:"1px solid "+C.danger+"22"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
            <span style={{fontSize:14,fontWeight:700,color:C.text}}>{r.repName}</span>
            <Badge color={C.danger} small>Needs Help</Badge>
          </div>
          <div style={{fontSize:13,color:C.text,lineHeight:1.5,marginBottom:3}}>"{r.message}"</div>
          <div style={{fontSize:12,color:C.textLight}}>{new Date(r.sentAt).toLocaleDateString()} at {new Date(r.sentAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
        </div>
        <button onClick={()=>dismiss(i)} style={{fontSize:12,padding:"4px 8px",borderRadius:6,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid,whiteSpace:"nowrap",flexShrink:0}}>Dismiss</button>
      </div>
    </div>)}
  </div>;
}


// ── WALL OF FAME ──
const FAME_CATEGORIES = ["First Life App","Licensed!","Top Producer","Field Trainer Approved","Recruiter of the Month","Most Improved","Going Above and Beyond","Custom"];
const FAME_COLORS = {"First Life App":C.teal,"Licensed!":C.gold,"Top Producer":C.success,"Field Trainer Approved":C.purple,"Recruiter of the Month":C.teal,"Most Improved":C.gold,"Going Above and Beyond":C.success,"Custom":C.textMid};

function WallOfFame({data,onUpdate,userRole}) {
  const isAdmin = userRole==="admin"||userRole==="superadmin";
  const pm = getCurrentPrimerMonth(data.primerMonthEnds||[]);
  const allRecognitions = data.wallOfFame||[];
  const recognitions = allRecognitions.filter(r=>r.postedAt&&r.postedAt>=pm.start);
  const pastRecognitions = allRecognitions.filter(r=>!r.postedAt||r.postedAt<pm.start);
  const [showPast,setShowPast] = useState(false);
  const [showForm,setShowForm] = useState(false);
  const [form,setForm] = useState({personId:"",category:"First Life App",message:"",customPhoto:null});
  const [personSearch,setPersonSearch] = useState("");
  const [showPersonList,setShowPersonList] = useState(false);

  const allPeople = [
    ...(data.admins||[]).map(p=>({...p,role:"Admin"})),
    ...(data.trainers||[]).map(p=>({...p,role:"Trainer"})),
    ...activeReps(data.reps).map(p=>({...p,role:"Rep"})),
  ];

  const filteredPeople = personSearch.length>0 ? allPeople.filter(p=>(p.name||"").toLowerCase().includes(personSearch.toLowerCase())) : allPeople.slice(0,8);

  const getPhoto = (personId) => {
    const profilePhotos = data.profilePhotos||{};
    if(profilePhotos[personId]) return profilePhotos[personId];
    try{const ls=localStorage.getItem("profilePhoto_"+personId);if(ls)return ls;}catch(e){}
    const rep = (data.reps||[]).find(r=>r.id===personId);
    if(rep?.dgoPhoto) return rep.dgoPhoto;
    try{const ls=localStorage.getItem("dgoPhoto_"+personId);if(ls)return ls;}catch(e){}
    const trainer = (data.trainers||[]).find(t=>t.id===personId);
    if(trainer?.photo) return trainer.photo;
    return null;
  };

  const save = () => {
    if(!form.personId||!form.message) return;
    const person = allPeople.find(p=>p.id===form.personId);
    let newData = {...data};
    if(form.customPhoto){
      newData = {...newData,wofPhotos:{...(data.wofPhotos||{}),[form.personId]:form.customPhoto}};
    }
    const entry = {
      personId:form.personId,
      category:form.category,
      message:form.message,
      personName:person?.name||"",
      personRole:person?.role||"",
      postedAt:new Date().toISOString(),
      id:Date.now()
    };
    onUpdate({...newData,wallOfFame:[entry,...allRecognitions]});
    setForm({personId:"",category:"First Life App",message:"",customPhoto:null});
    setPersonSearch("");
    setShowForm(false);
  };

  const remove = (id) => onUpdate({...data,wallOfFame:allRecognitions.filter(r=>r.id!==id)});

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div>
        <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text}}>{pm.label} Wall of Fame</div>
        <div style={{fontSize:13,color:C.textMid}}>Celebrating our team's achievements — resets automatically each new Primerica month</div>
      </div>
      {isAdmin&&<button onClick={()=>setShowForm(!showForm)} style={{fontSize:13,padding:"6px 12px",borderRadius:8,border:"none",background:C.gold,color:"white",cursor:"pointer",fontWeight:700}}>+ Add Recognition</button>}
    </div>

    {isAdmin&&showForm&&<Card style={{marginBottom:14,border:"1px solid "+C.gold+"44"}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>New Recognition</div>
      <div style={{marginBottom:8,position:"relative"}}>
        <div style={{fontSize:13,color:C.textMid,marginBottom:3}}>Select Person</div>
        {form.personId?(
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,border:"1px solid "+C.teal,background:C.teal+"11"}}>
            {(()=>{const p=getPhoto(form.personId);return p?<img src={p} style={{width:32,height:32,borderRadius:"50%",objectFit:"cover",border:"2px solid "+C.teal}}/>:<div style={{width:32,height:32,borderRadius:"50%",background:C.teal+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:C.teal}}>{allPeople.find(p=>p.id===form.personId)?.name?.charAt(0)}</div>;})()}
            <span style={{flex:1,fontSize:13,fontWeight:600,color:C.text}}>{allPeople.find(p=>p.id===form.personId)?.name}</span>
            <button onClick={()=>{setForm({...form,personId:""});setPersonSearch("");}} style={{fontSize:13,color:C.danger,background:"none",border:"none",cursor:"pointer"}}>✕ Change</button>
          </div>
        ):(
          <div>
            <input
              placeholder="Search name..."
              value={personSearch}
              onChange={e=>{setPersonSearch(e.target.value);setShowPersonList(true);}}
              onFocus={()=>setShowPersonList(true)}
              style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:13,color:C.text,boxSizing:"border-box"}}
            />
            {showPersonList&&(personSearch.length>0||true)&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:"white",border:"1px solid "+C.border,borderRadius:8,boxShadow:"0 4px 12px rgba(0,0,0,0.1)",zIndex:100,maxHeight:200,overflowY:"auto"}}>
              {filteredPeople.length===0&&<div style={{padding:"10px",fontSize:13,color:C.textLight,textAlign:"center"}}>No results</div>}
              {filteredPeople.map(p=><button key={p.id} onClick={()=>{setForm({...form,personId:p.id});setPersonSearch("");setShowPersonList(false);}} style={{width:"100%",padding:"8px 12px",background:"white",border:"none",borderBottom:"1px solid "+C.border,cursor:"pointer",textAlign:"left",fontSize:13,color:C.text}}>
                <span style={{fontWeight:600}}>{p.name}</span>
                <span style={{fontSize:12,color:C.textMid,marginLeft:6}}>({p.role})</span>
              </button>)}
            </div>}
          </div>
        )}
      </div>
      <div style={{marginBottom:8}}>
        <div style={{fontSize:13,color:C.textMid,marginBottom:3}}>Category</div>
        <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:13,color:C.text}}>
          {FAME_CATEGORIES.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <div style={{marginBottom:10}}>
        <div style={{fontSize:13,color:C.textMid,marginBottom:3}}>Personal Message</div>
        <textarea placeholder="Write a personal recognition message..." value={form.message} onChange={e=>setForm({...form,message:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:13,color:C.text,resize:"vertical",minHeight:70,boxSizing:"border-box",lineHeight:1.5}}/>
      </div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:13,color:C.textMid,marginBottom:6}}>Photo</div>
        {form.personId&&(()=>{const autoPhoto=getPhoto(form.personId);return autoPhoto?<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"7px 10px",background:C.success+"11",borderRadius:8,border:"1px solid "+C.success+"33"}}>
          <img src={form.customPhoto||autoPhoto} style={{width:36,height:36,borderRadius:8,objectFit:"cover",border:"2px solid "+C.success}}/>
          <div style={{fontSize:13,color:C.success,fontWeight:600}}>Photo found automatically</div>
          {form.customPhoto&&<button onClick={()=>setForm({...form,customPhoto:null})} style={{fontSize:12,color:C.textMid,background:"none",border:"none",cursor:"pointer",marginLeft:"auto"}}>Use auto</button>}
        </div>:null;})()}
        <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:7,background:C.surface,border:"1px solid "+C.border,cursor:"pointer",fontSize:13,color:C.textMid}}>
          {form.customPhoto?"Change Photo":"Upload Custom Photo"}
          <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
            const file=e.target.files[0];
            if(!file) return;
            compressImage(file, compressed=>setForm({...form,customPhoto:compressed}), 400, 0.8);
          }}/>
        </label>
        {form.customPhoto&&<span style={{fontSize:12,color:C.success,marginLeft:8}}>Custom photo ready</span>}
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
        <button onClick={save} style={{flex:2,padding:"8px",borderRadius:8,border:"none",background:C.gold,color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>Post Recognition</button>
      </div>
    </Card>}

    {recognitions.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:C.textLight}}>
      <div style={{fontSize:32,marginBottom:10}}>★</div>
      <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:6}}>No recognitions yet</div>
      <div style={{fontSize:13}}>{isAdmin?"Add your first recognition above!":"Check back soon — great things are coming!"}</div>
    </div>}

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      {recognitions.map((r,i)=>{
        const photo = r.customPhoto||(data.wofPhotos||{})[r.personId]||(data.profilePhotos||{})[r.personId]||(()=>{try{return localStorage.getItem("profilePhoto_"+r.personId)||null;}catch(e){return null;}})()
          ||(data.reps||[]).find(rp=>rp.id===r.personId)?.dgoPhoto
          ||(()=>{try{return localStorage.getItem("dgoPhoto_"+r.personId)||null;}catch(e){return null;}})();
        const catColor = FAME_COLORS[r.category]||C.gold;
        return <div key={i} style={{borderRadius:12,border:"2px solid "+catColor+"33",background:"white",overflow:"hidden",position:"relative"}}>
          {isAdmin&&<button onClick={()=>remove(r.id)} style={{position:"absolute",top:6,right:6,width:20,height:20,borderRadius:10,background:"rgba(0,0,0,0.15)",color:"white",border:"none",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1}}>x</button>}
          {/* Photo/Avatar */}
          <div style={{background:"linear-gradient(135deg,"+catColor+"33,"+catColor+"11)",padding:"16px 16px 8px",textAlign:"center"}}>
            {(r.customPhoto||photo)?<img src={r.customPhoto||photo} alt={r.personName} style={{width:64,height:64,borderRadius:32,objectFit:"cover",border:"3px solid "+catColor,margin:"0 auto"}}/>:
            <div style={{width:64,height:64,borderRadius:32,background:catColor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"white",margin:"0 auto",border:"3px solid "+catColor+"66"}}>{r.personName?.charAt(0)?.toUpperCase()}</div>}
          </div>
          {/* Content */}
          <div style={{padding:"8px 12px 12px"}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,textAlign:"center",marginBottom:4}}>{r.personName}</div>
            <div style={{textAlign:"center",marginBottom:6}}><Badge color={catColor} small>{r.category}</Badge></div>
            <div style={{fontSize:13,color:C.textMid,lineHeight:1.5,textAlign:"center",fontStyle:"italic"}}>"{r.message}"</div>
            <div style={{fontSize:10,color:C.textLight,textAlign:"center",marginTop:6}}>{new Date(r.postedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
          </div>
        </div>;
      })}
    </div>

    {pastRecognitions.length>0&&<div style={{marginTop:20}}>
      <button onClick={()=>setShowPast(!showPast)} style={{fontSize:13,fontWeight:700,color:C.textMid,background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:6}}>
        <span style={{transform:showPast?"rotate(90deg)":"none",display:"inline-block",fontSize:11}}>▶</span>
        Past Recognitions ({pastRecognitions.length})
      </button>
      {showPast&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:10}}>
        {pastRecognitions.map((r,i)=>{
          const photo = r.customPhoto||(data.wofPhotos||{})[r.personId]||(data.profilePhotos||{})[r.personId];
          const catColor = FAME_COLORS[r.category]||C.gold;
          return <div key={i} style={{borderRadius:12,border:"1px solid "+C.border,background:C.surface,overflow:"hidden",position:"relative",opacity:0.85}}>
            {isAdmin&&<button onClick={()=>remove(r.id)} style={{position:"absolute",top:6,right:6,width:20,height:20,borderRadius:10,background:"rgba(0,0,0,0.15)",color:"white",border:"none",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1}}>x</button>}
            <div style={{padding:"12px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                {photo?<img src={photo} alt={r.personName} style={{width:32,height:32,borderRadius:16,objectFit:"cover"}}/>:<div style={{width:32,height:32,borderRadius:16,background:catColor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"white"}}>{r.personName?.charAt(0)?.toUpperCase()}</div>}
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>{r.personName}</div>
              </div>
              <div style={{fontSize:12,color:C.textMid,fontStyle:"italic"}}>"{r.message}"</div>
              <div style={{fontSize:10,color:C.textLight,marginTop:5}}>{r.postedAt?new Date(r.postedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):""}</div>
            </div>
          </div>;
        })}
      </div>}
    </div>}
  </div>;
}


// ── GOAL BOARD ──
function GoalBoard({data,onUpdate,userRole,showEdit=false}) {
  const goals = data.teamGoals||[];
  const teams = data.goalTeams||["Main Team"];
  const isAdmin = userRole==="admin"||userRole==="superadmin";
  const [open,setOpen] = useState(true);
  const [collapsedTeams,setCollapsedTeams] = useState({});
  const [showForm,setShowForm] = useState(false);
  const [showAddTeam,setShowAddTeam] = useState(false);
  const [newTeamName,setNewTeamName] = useState("");
  const [form,setForm] = useState({title:"",target:0,unit:"Life Apps",current:0,deadline:"",team:teams[0]||"Main Team"});

  const addTeam = () => {
    if(!newTeamName.trim()) return;
    onUpdate({...data,goalTeams:[...teams,newTeamName.trim()]});
    setNewTeamName("");
    setShowAddTeam(false);
  };

  const save = () => {
    if(!form.title||!form.target) return;
    onUpdate({...data,teamGoals:[...goals,{...form,id:Date.now(),postedAt:new Date().toISOString()}]});
    setForm({title:"",target:0,unit:"Life Apps",current:0,deadline:"",team:teams[0]||"Main Team"});
    setShowForm(false);
  };

  const updateCurrent = (id,val) => onUpdate({...data,teamGoals:goals.map(g=>g.id===id?{...g,current:val}:g)});
  const removeGoal = (id) => onUpdate({...data,teamGoals:goals.filter(g=>g.id!==id)});
  const toggleTeam = (t) => setCollapsedTeams(prev=>({...prev,[t]:!prev[t]}));

  if(goals.length===0&&!isAdmin) return null;

  return <div style={{marginBottom:14}}>
    {/* Master header */}
    <div onClick={()=>setOpen(!open)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:open?10:0,cursor:"pointer",padding:"10px 14px",background:"white",borderRadius:10,border:"1px solid "+C.gold+"33",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text}}>Team Goals <span style={{fontSize:13,color:C.textLight,fontWeight:400}}>({teams.length} team{teams.length!==1?"s":""}, {goals.length} goal{goals.length!==1?"s":""})</span></div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {isAdmin&&open&&<div style={{display:"flex",gap:5}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>setShowAddTeam(!showAddTeam)} style={{fontSize:12,padding:"4px 8px",borderRadius:6,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>+ Team</button>
          <button onClick={()=>setShowForm(!showForm)} style={{fontSize:12,padding:"4px 9px",borderRadius:6,border:"none",background:C.gold,color:"white",cursor:"pointer",fontWeight:600}}>+ Goal</button>
        </div>}
        <span style={{fontSize:14,color:C.textLight,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>v</span>
      </div>
    </div>

    {open&&<div>
      {/* Add team form */}
      {isAdmin&&showAddTeam&&<div style={{background:"white",borderRadius:8,padding:10,marginBottom:10,border:"1px solid "+C.border,display:"flex",gap:6}}>
        <input placeholder="New team name..." value={newTeamName} onChange={e=>setNewTeamName(e.target.value)} style={{flex:1,padding:"6px 9px",borderRadius:6,border:"1px solid "+C.border,fontSize:13,color:C.text}}/>
        <button onClick={addTeam} style={{padding:"6px 12px",borderRadius:6,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Add</button>
        <button onClick={()=>setShowAddTeam(false)} style={{padding:"6px 9px",borderRadius:6,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>x</button>
      </div>}

      {/* Add goal form */}
      {isAdmin&&showForm&&<div style={{background:"white",borderRadius:9,padding:12,marginBottom:10,border:"1px solid "+C.gold+"44"}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>New Goal</div>
        <div style={{marginBottom:7}}>
          <div style={{fontSize:12,color:C.textMid,marginBottom:3}}>Team</div>
          <select value={form.team} onChange={e=>setForm({...form,team:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text}}>
            {teams.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <input placeholder="Goal title (e.g. May Life Apps Goal)" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
          <div>
            <div style={{fontSize:12,color:C.textMid,marginBottom:3}}>Target</div>
            <input type="number" value={form.target} onChange={e=>setForm({...form,target:Number(e.target.value)})} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
          </div>
          <div>
            <div style={{fontSize:12,color:C.textMid,marginBottom:3}}>Unit</div>
            <select value={["Life Apps","Recruits","Licensed Agents","Appointments","Contacts"].includes(form.unit)?form.unit:"Custom"} onChange={e=>setForm({...form,unit:e.target.value==="Custom"?"":e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text}}>
              {["Life Apps","Recruits","Licensed Agents","Appointments","Contacts","Custom"].map(u=><option key={u}>{u}</option>)}
            </select>
            {!["Life Apps","Recruits","Licensed Agents","Appointments","Contacts"].includes(form.unit)&&<input placeholder="Custom unit..." value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} style={{width:"100%",padding:"5px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text,marginTop:4,boxSizing:"border-box"}}/>}
          </div>
        </div>
        <div style={{marginBottom:8}}>
          <div style={{fontSize:12,color:C.textMid,marginBottom:3}}>Deadline (optional)</div>
          <input type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
        </div>
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"7px",borderRadius:7,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
          <button onClick={save} style={{flex:2,padding:"7px",borderRadius:7,border:"none",background:C.gold,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Save Goal</button>
        </div>
      </div>}

      {/* Team cards — horizontal scrollable */}
      {goals.length===0&&isAdmin&&<div style={{fontSize:13,color:C.textLight,textAlign:"center",padding:"12px 0",background:"white",borderRadius:8,border:"1px solid "+C.border}}>No goals yet — click + Goal above to add your first!</div>}
      {goals.length>0&&<div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:6,WebkitOverflowScrolling:"touch"}}>
        {teams.map(team=>{
          const teamGoals = goals.filter(g=>(g.team||teams[0])===team);
          if(teamGoals.length===0&&!isAdmin) return null;
          const collapsed = collapsedTeams[team];
          const teamTotal = teamGoals.length>0?Math.round(teamGoals.reduce((s,g)=>s+Math.min((g.current/g.target)*100,100),0)/teamGoals.length):0;
          return <div key={team} style={{flexShrink:0,width:260,background:"white",borderRadius:12,border:"1px solid "+C.gold+"33",overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
            {/* Team card header */}
            <div onClick={()=>toggleTeam(team)} style={{background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",padding:"10px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"white"}}>{team}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>{teamGoals.length} goal{teamGoals.length!==1?"s":""} • {teamTotal}% avg</div>
              </div>
              <span style={{color:"rgba(255,255,255,0.5)",fontSize:14,transform:collapsed?"none":"rotate(180deg)",transition:"transform 0.2s",display:"inline-block"}}>v</span>
            </div>
            {/* Team goals */}
            {!collapsed&&<div style={{padding:"10px 12px"}}>
              {teamGoals.length===0&&<div style={{fontSize:13,color:C.textLight,textAlign:"center",padding:"8px 0"}}>No goals yet</div>}
              {teamGoals.map(g=>{
                const pct=Math.min(Math.round((g.current/g.target)*100),100);
                const daysLeft=g.deadline?Math.ceil((new Date(g.deadline+"T12:00:00")-new Date())/86400000):null;
                return <div key={g.id} style={{marginBottom:10,paddingBottom:10,borderBottom:"1px solid "+C.border}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.text,flex:1,paddingRight:6}}>{g.title}</div>
                    <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                      {daysLeft!==null&&<span style={{fontSize:10,color:daysLeft<=7?C.danger:C.textLight}}>{daysLeft<=0?"Past":daysLeft+"d"}</span>}
                      {isAdmin&&<button onClick={()=>removeGoal(g.id)} style={{fontSize:13,color:C.danger,background:"none",border:"none",cursor:"pointer",padding:"0 2px"}}>x</button>}
                    </div>
                  </div>
                  <Bar pct={pct} color={pct>=100?C.success:C.gold} h={5}/>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                    <span style={{fontSize:12,color:C.textMid}}>{g.current}/{g.target} {g.unit}</span>
                    <span style={{fontSize:12,fontWeight:700,color:pct>=100?C.success:C.gold}}>{pct}%</span>
                  </div>
                  {isAdmin&&<div style={{display:"flex",gap:4,marginTop:6,alignItems:"center"}}>
                    <button onClick={()=>updateCurrent(g.id,Math.max(0,g.current-1))} style={{width:24,height:24,borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:14,fontWeight:700,color:C.textMid}}>-</button>
                    <span style={{fontSize:13,fontWeight:600,color:C.text,flex:1,textAlign:"center"}}>{g.current}</span>
                    <button onClick={()=>updateCurrent(g.id,g.current+1)} style={{width:24,height:24,borderRadius:5,border:"none",background:C.gold,cursor:"pointer",fontSize:14,fontWeight:700,color:"white"}}>+</button>
                  </div>}
                </div>;
              })}
            </div>}
          </div>;
        })}
      </div>}
    </div>}
  </div>;
}


// ── QUICK MESSAGE TEMPLATES ──
const DEFAULT_TEMPLATES = [
  {cat:"Encouragement",msg:"Hey [name], just checked your progress — you're doing amazing! Keep pushing!"},
  {cat:"Encouragement",msg:"You haven't checked in lately — we believe in you! What can I do to help you win this week?"},
  {cat:"Encouragement",msg:"Your exam is coming up — you've got this! Stay focused and trust your preparation."},
  {cat:"Accountability",msg:"Hey [name], let's connect this week. I want to make sure you have everything you need to succeed."},
  {cat:"Accountability",msg:"Just a reminder — Monday Mindset is tonight at 7:30 PM CST. See you there!"},
  {cat:"Accountability",msg:"You're so close to finishing your checklist! One more push and you unlock the next level."},
  {cat:"Recognition",msg:"CONGRATULATIONS! You passed your exam! We are so proud of you — the team is celebrating you!"},
  {cat:"Recognition",msg:"You just wrote your first life app — that family is protected because of YOU. That is huge!"},
  {cat:"Recognition",msg:"Look at you building your team! Recruiting is one of the most powerful things you can do. Keep going!"},
  {cat:"Invitation",msg:"Opportunity Night is Thursday at 7:30 PM CST. Who are you bringing?"},
  {cat:"Invitation",msg:"Saturday training is going to be FIRE this week. Don't miss it — bring a friend!"},
  {cat:"Invitation",msg:"I have someone perfect for this opportunity — can we connect today so I can share more?"},
  {cat:"Welcome",msg:"Welcome to the team [name]! We are so excited you are here. Your trainer will be reaching out soon. Let's get to work!"},
];

function QuickMessages({data,onUpdate,userRole}) {
  const isAdmin = userRole==="admin"||userRole==="superadmin";
  const templates = data.quickMessages||(()=>{try{const ls=localStorage.getItem("quickMessages_backup");return ls?JSON.parse(ls):DEFAULT_TEMPLATES;}catch(e){return DEFAULT_TEMPLATES;}})();
  const [copied,setCopied] = useState(null);
  const [showAdd,setShowAdd] = useState(false);
  const [form,setForm] = useState({cat:"Encouragement",msg:""});
  const [filter,setFilter] = useState("All");
  const cats = ["All",...[...new Set(templates.map(t=>t.cat))]];
  const filtered = filter==="All"?templates:templates.filter(t=>t.cat===filter);

  const copy = (msg,i) => {
    navigator.clipboard?.writeText(msg);
    setCopied(i);
    setTimeout(()=>setCopied(null),2000);
  };

  const add = () => {
    if(!form.msg) return;
    const newTemplates = [...templates,{...form,id:Date.now()}];
    onUpdate({...data,quickMessages:newTemplates});
    // Also save to localStorage as backup
    try{localStorage.setItem("quickMessages_backup",JSON.stringify(newTemplates));}catch(e){}
    setForm({cat:"Encouragement",msg:""});
    setShowAdd(false);
  };

  const del = (i) => onUpdate({...data,quickMessages:templates.filter((_,idx)=>idx!==i)});
  const reset = () => {if(window.confirm("Reset to default templates?")) onUpdate({...data,quickMessages:DEFAULT_TEMPLATES});};

  const catColors = {Encouragement:C.teal,Accountability:C.gold,Recognition:C.success,Invitation:C.purple,Welcome:C.teal};

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <div><div style={{fontSize:dv(17,22),fontWeight:700,color:C.text}}>Quick Messages</div><div style={{fontSize:13,color:C.textMid}}>Copy and paste to send via text</div></div>
      {isAdmin&&<div style={{display:"flex",gap:6}}>
        <button onClick={reset} style={{fontSize:12,padding:"4px 8px",borderRadius:6,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>Reset</button>
        <button onClick={()=>setShowAdd(!showAdd)} style={{fontSize:13,padding:"5px 10px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>+ Add</button>
      </div>}
    </div>
    <div style={{background:C.teal+"11",border:"1px solid "+C.teal+"33",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:13,color:C.teal}}>
      Tap <strong>Copy</strong> on any message, then paste it into a text message on your phone. Replace [name] with the person's name before sending!
    </div>
    {isAdmin&&showAdd&&<Card style={{marginBottom:12,border:"1px solid "+C.teal+"44"}}>
      <select value={form.cat} onChange={e=>setForm({...form,cat:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text,marginBottom:7}}>
        {["Encouragement","Accountability","Recognition","Invitation","Welcome"].map(c=><option key={c}>{c}</option>)}
      </select>
      <textarea placeholder="Message text..." value={form.msg} onChange={e=>setForm({...form,msg:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text,resize:"vertical",minHeight:70,boxSizing:"border-box",lineHeight:1.5,marginBottom:7}}/>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>setShowAdd(false)} style={{flex:1,padding:"6px",borderRadius:7,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
        <button onClick={add} style={{flex:2,padding:"6px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Save</button>
      </div>
    </Card>}
    <div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:12,paddingBottom:2}}>
      {cats.map(c=><button key={c} onClick={()=>setFilter(c)} style={{padding:"4px 10px",borderRadius:7,border:"none",cursor:"pointer",whiteSpace:"nowrap",fontSize:13,fontWeight:filter===c?600:400,background:filter===c?C.navy:C.surface,color:filter===c?"white":C.textMid}}>{c}</button>)}
    </div>
    {[...new Set(filtered.map(t=>t.cat))].map(cat=><div key={cat}>
      <SecHead title={cat} color={catColors[cat]||C.teal}/>
      {filtered.filter(t=>t.cat===cat).map((t,i)=>{
        const realIdx=templates.indexOf(t);
        return <div key={i} style={{borderRadius:8,border:"1px solid "+C.border,padding:"10px 12px",marginBottom:7,background:"white"}}>
          <div style={{fontSize:13,color:C.text,lineHeight:1.5,marginBottom:8}}>{t.msg}</div>
          <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
            {isAdmin&&<button onClick={()=>del(realIdx)} style={{fontSize:12,padding:"3px 7px",borderRadius:5,border:"1px solid "+C.danger+"33",background:C.danger+"11",cursor:"pointer",color:C.danger}}>Delete</button>}
            <button onClick={()=>copy(t.msg,realIdx)} style={{fontSize:13,padding:"4px 12px",borderRadius:6,border:"none",background:copied===realIdx?C.success:C.teal,color:"white",cursor:"pointer",fontWeight:600,transition:"background 0.2s"}}>{copied===realIdx?"Copied!":"Copy"}</button>
          </div>
        </div>;
      })}
    </div>)}
  </div>;
}


// ── INVESTMENT LOG ──
function RepInvestmentEntry({rep,onUpdate}) {
  const [show,setShow] = useState(false);
  const [form,setForm] = useState({clientName:"",pac:"",lumpSum:"",type:"Mutual Fund",date:localDateStr()});
  const entries = rep.investments||[];
  const totPAC = entries.reduce((s,e)=>s+(Number(e.pac)||0),0);
  const totLump = entries.reduce((s,e)=>s+(Number(e.lumpSum)||0),0);

  const save = () => {
    if(!form.clientName) return;
    onUpdate({...rep,investments:[...entries,{...form,id:Date.now()}]});
    setForm({clientName:"",pac:"",lumpSum:"",type:"Mutual Fund",date:localDateStr()});
    setShow(false);
  };

  return <Card style={{marginBottom:12,border:"1px solid "+C.purple+"33"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
      <div>
        <div style={{fontSize:13,fontWeight:700,color:C.text}}>My Investments</div>
        <div style={{fontSize:13,color:C.textMid}}>PAC: <span style={{color:C.purple,fontWeight:700}}>${totPAC.toLocaleString()}/mo</span> &nbsp;|&nbsp; Lump Sum: <span style={{color:C.gold,fontWeight:700}}>${totLump.toLocaleString()}</span></div>
      </div>
      <button onClick={()=>setShow(!show)} style={{fontSize:13,padding:"4px 10px",borderRadius:7,border:"none",background:C.purple,color:"white",cursor:"pointer",fontWeight:600}}>+ Log</button>
    </div>
    <div style={{background:C.gold+"11",border:`1px solid ${C.gold}33`,borderRadius:7,padding:"6px 10px",marginBottom:8,fontSize:11,color:"#b45309",lineHeight:1.5}}>
      ⚠️ Only enter investment information if you are securities licensed. If you are not yet licensed, use the <strong>Investment Observation Log</strong> below to track prospects you observed during training appointments.
    </div>
    {show&&<div style={{background:C.surface,borderRadius:8,padding:9,marginBottom:8}}>
      <input placeholder="Client name" value={form.clientName} onChange={e=>setForm({...form,clientName:e.target.value})} style={{width:"100%",padding:"6px 9px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text,marginBottom:6,boxSizing:"border-box"}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
        <input type="number" placeholder="Monthly PAC $" value={form.pac} onChange={e=>setForm({...form,pac:e.target.value})} style={{padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
        <input type="number" placeholder="Lump Sum $" value={form.lumpSum} onChange={e=>setForm({...form,lumpSum:e.target.value})} style={{padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
        <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} style={{padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text}}>
          {["Mutual Fund","IBA","Fixed Annuity","Indexed Annuity","Other"].map(t=><option key={t}>{t}</option>)}
        </select>
        <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={{padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setShow(false)} style={{flex:1,padding:"6px",borderRadius:7,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
        <button onClick={save} style={{flex:2,padding:"6px",borderRadius:7,border:"none",background:C.purple,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Save</button>
      </div>
    </div>}
    {entries.length>0&&<div style={{maxHeight:140,overflowY:"auto",marginTop:6}}>
      {entries.slice().reverse().map((e,i)=>{
        const realIdx=entries.length-1-i;
        return <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:"1px solid "+C.border,fontSize:13}}>
          <span style={{color:C.text,flex:1}}>{e.clientName}</span>
          <span style={{color:C.textMid,fontSize:12,marginRight:6}}>{e.type}</span>
          <div style={{textAlign:"right",marginRight:8}}>
            {e.pac&&<div style={{color:C.purple,fontWeight:600}}>${e.pac}/mo</div>}
            {e.lumpSum&&<div style={{color:C.gold,fontWeight:600}}>${e.lumpSum}</div>}
          </div>
          <button onClick={()=>onUpdate({...rep,investments:entries.filter((_,j)=>j!==realIdx)})} style={{fontSize:12,color:C.danger,background:"none",border:"none",cursor:"pointer",padding:"0 2px"}}>x</button>
        </div>;
      })}
    </div>}
  </Card>;
}

function InvestmentLog({data,onUpdate,userRole}) {
  if(userRole!=="admin"&&userRole!=="superadmin") return null;
  const [open,setOpen] = useState(false);
  const allLogs = Object.entries(data.investmentLogs||{}).flatMap(([repId,entries])=>
    entries.map(e=>({...e,repName:(data.reps||[]).find(r=>r.id===repId)?.name||"Unknown"}))
  ).sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(allLogs.length===0) return null;
  const total = allLogs.reduce((s,e)=>s+(Number(e.pac)||0)+(Number(e.lumpSum)||0),0);
  return <Card style={{marginBottom:14}}>
    <div onClick={()=>setOpen(!open)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text}}>Investment Log ({allLogs.length})</div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:13,color:C.gold,fontWeight:600}}>${total.toLocaleString()} total</span>
        <button onClick={e=>{e.stopPropagation();if(window.confirm("Clear all investment logs? This cannot be undone."))onUpdate({...data,investmentLogs:{}});}} style={{fontSize:12,padding:"3px 8px",borderRadius:5,background:C.danger+"11",color:C.danger,border:"1px solid "+C.danger+"33",cursor:"pointer"}}>Clear All</button>
        <span style={{fontSize:14,color:C.textLight,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>v</span>
      </div>
    </div>
    {open&&<div style={{marginTop:10}}>
      {allLogs.map((e,i)=><div key={i} style={{padding:"7px 0",borderBottom:"1px solid "+C.border,display:"flex",gap:10,alignItems:"center"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text}}>{e.clientName}</div>
          <div style={{fontSize:12,color:C.textMid}}>{e.repName} • {e.type} • {new Date(e.date).toLocaleDateString()}</div>
        </div>
        <div style={{textAlign:"right",fontSize:13,color:C.gold,fontWeight:600}}>
          {e.pac&&<div>PAC: ${e.pac}</div>}
          {e.lumpSum&&<div>Lump: ${e.lumpSum}</div>}
        </div>
      </div>)}
    </div>}
  </Card>;
}


// ── LICENSED PREMIUM ENTRY ──
function LicensedPremiumEntry({rep,onUpdate,readOnly}) {
  const repRef=useRef(rep);
  useEffect(()=>{repRef.current=rep;},[rep]);
  const [goalInput,setGoalInput]=useState(rep.monthlyIncomeGoal||"");
  useEffect(()=>{setGoalInput(rep.monthlyIncomeGoal||"");},[rep.monthlyIncomeGoal]);
  const [form,setForm] = useState({client:"",premium:"",date:localDateStr(),cod:false});
  const [show,setShow] = useState(false);
  const [calcPremium,setCalcPremium] = useState("");
  const entries = rep.selfPremium||[];
  const total = entries.filter(e=>!e.cod||e.codAccepted).reduce((s,e)=>s+(Number(e.premium)||0),0);
  const pendingCOD = entries.filter(e=>e.cod&&!e.codAccepted);

  // Promotion level — reads from rep, defaults to rep 25%
  const PROMO_LEVELS=[
    {key:"rep",label:"Rep",pct:25},{key:"sr_rep",label:"Senior Rep",pct:35},
    {key:"dl",label:"District Leader",pct:50},{key:"divl",label:"Division Leader",pct:60},
    {key:"rl",label:"Regional Leader",pct:70},{key:"srl",label:"Senior Regional Leader",pct:80},
    {key:"rvp",label:"RVP",pct:110},
  ];
  const promo = PROMO_LEVELS.find(p=>p.key===(rep.promotionLevel||"rep"))||PROMO_LEVELS[0];
  const pct = promo.pct / 100;

  // Commission calculation helper
  const calcCommission = (monthlyPremium) => {
    const mp = Number(monthlyPremium)||0;
    if(!mp) return null;
    const commissionable = (mp * 12) - 65;
    const total1yr = commissionable * pct;
    const upfront = (total1yr / 12) * 9;
    const asEarned = (total1yr / 12) * 3;
    return {commissionable, total1yr, upfront, asEarned};
  };

  // Monthly earnings from all logged apps
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const thisMonthEntries = entries.filter(e=>e.date>=monthStart);
  const thisMonthEarned = thisMonthEntries.filter(e=>!e.cod||e.codAccepted).reduce((s,e)=>{
    const c = calcCommission(e.premium);
    return s + (c ? c.upfront : 0);
  }, 0);

  const goal = Number(goalInput)||0;
  const goalPct = goal>0 ? Math.min(100, Math.round((thisMonthEarned/goal)*100)) : 0;
  const avgUpfront = entries.length>0 ? thisMonthEarned/Math.max(thisMonthEntries.length,1) : 0;
  const appsNeeded = goal>0 && avgUpfront>0 ? Math.ceil((goal-thisMonthEarned)/avgUpfront) : null;

  const save = () => {
    if(!form.client||!form.premium) return;
    onUpdate({...repRef.current,selfPremium:[...entries,{...form,id:Date.now(),codAccepted:false}]});
    setForm({client:"",premium:"",date:localDateStr(),cod:false});
    setShow(false);
  };
  const acceptCOD=(idx)=>{
    const updated=entries.map((e,i)=>i===idx?{...e,codAccepted:true}:e);
    onUpdate({...repRef.current,selfPremium:updated});
  };

  const calcResult = calcCommission(calcPremium);

  return <Card style={{marginBottom:12,border:"1px solid "+C.teal+"33"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <div>
        <div style={{fontSize:13,fontWeight:700,color:C.text}}>My Life Apps</div>
        <div style={{fontSize:13,color:C.textMid}}>Running total: <span style={{color:C.teal,fontWeight:700}}>${total.toFixed(0)}/mo</span> · <span style={{color:C.gold,fontWeight:600}}>{promo.label} ({promo.pct}%)</span></div>
      </div>
      {!readOnly&&<button onClick={()=>setShow(!show)} style={{fontSize:13,padding:"4px 10px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>+ Log</button>}
    </div>

    {/* Monthly Income Goal */}
    <div style={{background:C.surface,borderRadius:8,padding:"8px 10px",marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:goal>0?8:0}}>
        <div style={{fontSize:13,fontWeight:600,color:C.text,whiteSpace:"nowrap"}}>Monthly Income Goal $</div>
        {readOnly?<div style={{fontSize:13,fontWeight:700,color:C.text}}>${goal.toLocaleString()}</div>:<input type="number" placeholder="e.g. 2000" value={rep.monthlyIncomeGoal||""} onChange={e=>onUpdate({...repRef.current,monthlyIncomeGoal:e.target.value})} style={{flex:1,padding:"4px 7px",borderRadius:6,border:"1px solid "+C.border,fontSize:13,color:C.text,maxWidth:100}}/>}
        {goal>0&&<div style={{fontSize:13,color:C.textMid,whiteSpace:"nowrap"}}>Earned: <strong style={{color:C.success}}>${thisMonthEarned.toFixed(0)}</strong></div>}
      </div>
      {goal>0&&<div>
        <div style={{height:8,background:"rgba(0,0,0,0.08)",borderRadius:4,overflow:"hidden",marginBottom:4}}>
          <div style={{height:"100%",borderRadius:4,background:`linear-gradient(90deg,${C.teal},${C.success})`,width:goalPct+"%",transition:"width 0.4s"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.textMid}}>
          <span>{goalPct}% of ${goal.toLocaleString()} goal</span>
          {appsNeeded!==null&&appsNeeded>0&&<span>~{appsNeeded} more app{appsNeeded!==1?"s":""} needed</span>}
          {goalPct>=100&&<span style={{color:C.success,fontWeight:700}}>🎉 Goal reached!</span>}
        </div>
      </div>}
    </div>

    {/* Log App Form */}
    {!readOnly&&show&&<div style={{background:C.surface,borderRadius:8,padding:9,marginBottom:8}}>
      <input placeholder="Client name" value={form.client} onChange={e=>setForm({...form,client:e.target.value})} style={{width:"100%",padding:"6px 9px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text,marginBottom:6,boxSizing:"border-box"}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
        <input type="number" placeholder="Monthly premium $ (per month)" value={form.premium} onChange={e=>setForm({...form,premium:e.target.value})} style={{padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
        <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={{padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
      </div>
      <label style={{display:"flex",alignItems:"center",gap:7,marginBottom:6,cursor:"pointer"}}>
        <input type="checkbox" checked={form.cod} onChange={e=>setForm({...form,cod:e.target.checked})} style={{width:15,height:15,accentColor:C.gold}}/>
        <span style={{fontSize:13,color:C.textMid}}>COD Application — <span style={{color:C.gold,fontWeight:600}}>premium pending acceptance</span></span>
      </label>
      {form.premium&&(()=>{const c=calcCommission(form.premium);return c?<div style={{background:form.cod?C.textLight+"11":C.gold+"11",borderRadius:7,padding:"6px 8px",marginBottom:6,fontSize:12}}>
        <div style={{fontWeight:700,color:form.cod?C.textMid:C.gold,marginBottom:2}}>{form.cod?"Estimated Commission (COD — pending acceptance)":"Estimated Commission at"} {form.cod?"":promo.label+" ("+promo.pct+"%)"}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4}}>
          <div><div style={{color:C.textMid}}>Upfront</div><div style={{fontWeight:700,color:C.text}}>${c.upfront.toFixed(2)}</div></div>
          <div><div style={{color:C.textMid}}>As Earned</div><div style={{fontWeight:700,color:C.text}}>${c.asEarned.toFixed(2)}</div></div>
          <div><div style={{color:C.textMid}}>Total 1st Yr</div><div style={{fontWeight:700,color:C.text}}>${c.total1yr.toFixed(2)}</div></div>
        </div>
      </div>:null;})()}
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setShow(false)} style={{flex:1,padding:"6px",borderRadius:7,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
        <button onClick={save} style={{flex:2,padding:"6px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Save</button>
      </div>
    </div>}

    {/* Pending COD banner */}
    {pendingCOD.length>0&&<div style={{background:C.gold+"11",border:`1px solid ${C.gold}33`,borderRadius:8,padding:"7px 10px",marginBottom:8,fontSize:12}}>
      <div style={{fontWeight:700,color:C.gold,marginBottom:4}}>⏳ {pendingCOD.length} COD App{pendingCOD.length>1?"s":""} Pending Acceptance</div>
      <div style={{color:C.textMid}}>These are not counted in your totals or commission until accepted.</div>
    </div>}
    {/* App entries with commission breakdown */}
    {entries.length>0&&<div style={{maxHeight:240,overflowY:"auto",marginTop:6}}>
      {entries.slice().reverse().map((e,i)=>{
        const realIdx=entries.length-1-i;
        const c=calcCommission(e.premium);
        const isCOD=!!e.cod;
        const isPending=isCOD&&!e.codAccepted;
        return <div key={i} style={{padding:"6px 0",borderBottom:"1px solid "+C.border,opacity:isPending?0.75:1}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13}}>
            <div style={{flex:1}}>
              <span style={{color:C.text,fontWeight:600}}>{e.client}</span>
              {isCOD&&<span style={{marginLeft:6,fontSize:10,padding:"1px 5px",borderRadius:4,background:isPending?C.gold+"22":C.success+"22",color:isPending?C.gold:C.success,fontWeight:700}}>{isPending?"⏳ COD Pending":"✅ COD Accepted"}</span>}
            </div>
            <span style={{color:isPending?C.textMid:C.teal,fontWeight:600,marginRight:8}}>${e.premium}/mo</span>
            <button onClick={()=>onUpdate({...repRef.current,selfPremium:entries.filter((_,j)=>j!==realIdx)})} style={{fontSize:12,color:C.danger,background:"none",border:"none",cursor:"pointer",padding:"0 2px"}}>x</button>
          </div>
          {isPending&&<button onClick={()=>acceptCOD(realIdx)} style={{marginTop:4,width:"100%",padding:"3px 8px",borderRadius:5,background:C.success+"11",border:`1px solid ${C.success}33`,color:C.success,fontSize:12,fontWeight:600,cursor:"pointer"}}>✓ Mark as Accepted — Add to Totals</button>}
          {c&&!isPending&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:2,marginTop:3}}>
            <div style={{fontSize:10,color:C.textMid}}>Upfront: <span style={{color:C.success,fontWeight:600}}>${c.upfront.toFixed(0)}</span></div>
            <div style={{fontSize:10,color:C.textMid}}>As Earned: <span style={{color:C.text,fontWeight:600}}>${c.asEarned.toFixed(0)}</span></div>
            <div style={{fontSize:10,color:C.textMid}}>Total: <span style={{color:C.gold,fontWeight:600}}>${c.total1yr.toFixed(0)}</span></div>
          </div>}
        </div>;
      })}
    </div>}

    <div style={{borderTop:"1px solid "+C.border,paddingTop:8,marginTop:8}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>💡 Quick Commission Calculator</div>
      <div style={{fontSize:12,color:C.textMid,marginBottom:6}}>Enter the <strong>monthly</strong> premium amount (what the client pays per month). The calculator will use their annual premium to compute your commission.</div>
      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:calcResult?6:0}}>
        <input type="number" placeholder="Monthly premium $ (per month)" value={calcPremium} onChange={e=>setCalcPremium(e.target.value)} style={{flex:1,padding:"5px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text}}/>
        {calcPremium&&<button onClick={()=>setCalcPremium("")} style={{fontSize:12,color:C.textMid,background:"none",border:"none",cursor:"pointer"}}>Clear</button>}
      </div>
      {calcResult&&<div style={{background:C.gold+"11",borderRadius:7,padding:"7px 9px",fontSize:12}}>
        <div style={{fontWeight:700,color:C.gold,marginBottom:4}}>{promo.label} ({promo.pct}%) on ${calcPremium}/mo app (${(Number(calcPremium)*12).toFixed(0)}/yr annual)</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
          <div style={{textAlign:"center"}}><div style={{color:C.textMid,marginBottom:2}}>Upfront</div><div style={{fontSize:14,fontWeight:800,color:C.success}}>${calcResult.upfront.toFixed(2)}</div></div>
          <div style={{textAlign:"center"}}><div style={{color:C.textMid,marginBottom:2}}>As Earned</div><div style={{fontSize:14,fontWeight:800,color:C.text}}>${calcResult.asEarned.toFixed(2)}</div></div>
          <div style={{textAlign:"center"}}><div style={{color:C.textMid,marginBottom:2}}>Total 1st Yr</div><div style={{fontSize:14,fontWeight:800,color:C.gold}}>${calcResult.total1yr.toFixed(2)}</div></div>
        </div>
        <div style={{fontSize:10,color:C.textLight,marginTop:4,textAlign:"center"}}>Commissionable: ${calcResult.commissionable.toFixed(2)} (annual premium minus $65 policy fee)</div>
      </div>}
    </div>
  </Card>;
}


// ── INVESTMENT LOG PAGE ──
function InvestmentLogPage({data,onUpdate}) {
  const allLogs = Object.entries(data.investmentLogs||{}).flatMap(([repId,entries])=>
    entries.map(e=>({...e,repName:(data.reps||[]).find(r=>r.id===repId)?.name||"Unknown"}))
  ).sort((a,b)=>new Date(b.date)-new Date(a.date));

  const clearAll = () => {
    if(window.confirm("Clear all investment observation logs?")) onUpdate({...data,investmentLogs:{}});
  };

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
      <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text}}>Investment Observations</div>
      {allLogs.length>0&&<button onClick={clearAll} style={{fontSize:13,padding:"5px 10px",borderRadius:7,background:C.danger+"11",color:C.danger,border:"1px solid "+C.danger+"33",cursor:"pointer",fontWeight:600}}>Clear All</button>}
    </div>
    <div style={{fontSize:13,color:C.textMid,marginBottom:14}}>All investment observation entries logged by reps.</div>
    {allLogs.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:C.textLight}}>No investment observations logged yet</div>}
    {allLogs.map((e,i)=><Card key={i} style={{marginBottom:8,padding:"10px 12px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:14,fontWeight:600,color:C.text}}>{e.clientName}</div>
          <div style={{fontSize:13,color:C.textMid}}>{e.repName} — {new Date(e.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
        </div>
        <Badge color={C.gold} small>Investment Obs</Badge>
      </div>
    </Card>)}
  </div>;
}

// ── INVESTMENT LOG (rep view below counter) ──
function RepInvestmentLog({repId,data}) {
  const entries = (data.investmentLogs||{})[repId]||[];
  if(entries.length===0) return null;
  return <div style={{marginTop:4}}>
    {entries.slice().reverse().slice(0,5).map((e,i)=><div key={i} style={{fontSize:12,color:C.textMid,padding:"2px 0",borderBottom:"1px solid "+C.border}}>{e.clientName} — {new Date(e.date).toLocaleDateString()}</div>)}
  </div>;
}




// ── BIRTHDAY & ANNIVERSARY TRACKER ──
function BirthdayAnniversaryWidget({data}) {
  const reps = data.reps||[];
  const today = new Date();
  const upcoming = [];
  const todayBirthdays = [];
  reps.forEach(rep => {
    if(rep.birthday) {
      try {
        const d = new Date(rep.birthday+"T12:00:00");
        const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());
        const diff = Math.ceil((thisYear - today)/(1000*60*60*24));
        const days = diff < 0 ? diff + 365 : diff;
        const age = today.getFullYear() - d.getFullYear() + (diff < 0 ? 1 : 0);
        if(days === 0) todayBirthdays.push({name:rep.name});
        if(days <= 30) upcoming.push({name:rep.name, type:"Birthday", days, date:thisYear});
      } catch(e) {}
    }
  });
  upcoming.sort((a,b)=>a.days-b.days);
  return <>
    {todayBirthdays.length>0&&<div style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",borderRadius:14,padding:"16px 18px",marginBottom:14,textAlign:"center"}}>
      <div style={{fontSize:32,marginBottom:6}}>🎂🎉🎈</div>
      <div style={{fontSize:16,fontWeight:800,color:"white",marginBottom:4}}>
        Happy Birthday{todayBirthdays.length>1?"s":""}!
      </div>
      <div style={{fontSize:14,color:"rgba(255,255,255,0.9)"}}>
        {todayBirthdays.map(b=>b.name).join(" · ")} — Happy Birthday! 🎂
      </div>
      <div style={{fontSize:13,color:"rgba(255,255,255,0.65)",marginTop:6}}>Make sure to reach out and celebrate them! 🥳</div>
    </div>}
    {upcoming.filter(u=>u.days>0).length>0&&<Card style={{marginBottom:14}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:10}}>Upcoming Birthdays</div>
      {upcoming.filter(u=>u.days>0).map((item,i)=>{const arr=upcoming.filter(u=>u.days>0);return <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none"}}>
        <div style={{width:32,height:32,borderRadius:8,background:C.purple+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.purple,flexShrink:0}}>BD</div>
        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:C.text}}>{item.name}</div><div style={{fontSize:13,color:C.textMid}}>{item.type} on {item.date.toLocaleDateString("en-US",{month:"long",day:"numeric"})}</div></div>
        <div>{item.days===1?<Badge color={C.gold} small>Tomorrow</Badge>:<Badge color={C.teal} small>{"In "+item.days+"d"}</Badge>}</div>
      </div>;})}
    </Card>}
  </>;
}




// ── STALLED REFERENCES ALERT ──
function StalledReferencesAlert({data,onUpdate,userRole,userId}) {
  const [showAll,setShowAll]=useState(false);
  if(!(userRole==="admin"||userRole==="superadmin"||userRole==="trainer")) return null;

  const reps = userRole==="trainer" ? (data.reps||[]).filter(r=>r.trainerId===userId) : (data.reps||[]);
  const dismissedRefAlerts = data.dismissedRefAlerts||[];
  const now = Date.now();
  const THRESHOLD = 3*86400000; // 3 days
  const alerts=[];

  reps.forEach(rep=>{
    if(rep.referencesNotRequired) return;
    const namedRefs = (rep.references||[]).filter(r=>r&&r.name&&r.name.trim());
    if(rep.track!=="licensed"&&namedRefs.length===0&&rep.createdAt&&(now-rep.createdAt)>=THRESHOLD){
      alerts.push({key:rep.id+"_norefs",repName:rep.name,refName:"—",msg:"No references entered yet",days:Math.floor((now-rep.createdAt)/86400000)});
    }
    (rep.references||[]).forEach((r,i)=>{
      if(!r||!r.name) return;
      const stagesDone = REF_STAGES.filter(s=>(r.status||{})[s.k]);
      const addedAt = r.addedAt || rep.createdAt || null; // fallback for refs added before timestamp tracking existed
      if(stagesDone.length===0){
        if(addedAt && (now-addedAt)>=THRESHOLD){
          alerts.push({key:rep.id+"_ref"+i+"_none",repName:rep.name,refName:r.name,msg:"No outreach started",days:Math.floor((now-addedAt)/86400000)});
        }
      } else if(stagesDone.length<REF_STAGES.length){
        const refPoint = r.lastActivityAt || addedAt;
        if(refPoint && (now-refPoint)>=THRESHOLD){
          const latestStage = stagesDone[stagesDone.length-1];
          alerts.push({key:rep.id+"_ref"+i+"_stuck",repName:rep.name,refName:r.name,msg:"Stuck at "+latestStage.l,days:Math.floor((now-refPoint)/86400000)});
        }
      }
    });
  });

  const visible_alerts = alerts.filter(a=>!dismissedRefAlerts.includes(a.key));
  if(visible_alerts.length===0) return null;
  const visible = showAll?visible_alerts:visible_alerts.slice(0,5);

  const dismiss = (key) => onUpdate({...data,dismissedRefAlerts:[...dismissedRefAlerts,key]});
  const clearAll = () => onUpdate({...data,dismissedRefAlerts:[...dismissedRefAlerts,...alerts.map(a=>a.key)]});

  return <div style={{background:"white",borderRadius:12,border:`1px solid ${C.border}`,padding:"12px 16px",marginBottom:14}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <div style={{width:8,height:8,borderRadius:4,background:C.danger}}/>
      <div style={{fontSize:14,fontWeight:700,color:C.text,flex:1}}>Stalled References ({visible_alerts.length})</div>
      <button onClick={clearAll} style={{fontSize:12,padding:"3px 8px",borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>Clear All</button>
    </div>
    {visible.map((a,i)=>(
      <div key={a.key} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:i<visible.length-1?`1px solid ${C.border}`:"none",flexWrap:"wrap"}}>
        <div style={{width:6,height:6,borderRadius:3,background:C.danger,flexShrink:0}}/>
        <span style={{fontSize:13,fontWeight:600,color:C.text}}>{a.repName}</span>
        <span style={{fontSize:12,color:C.textMid,flex:1}}>{a.refName==="—"?a.msg:`Ref: ${a.refName} — ${a.msg}`}</span>
        <span style={{fontSize:11,fontWeight:700,color:C.danger,background:C.danger+"11",padding:"2px 8px",borderRadius:6,whiteSpace:"nowrap"}}>{a.days}d</span>
        <button onClick={()=>dismiss(a.key)} style={{fontSize:12,padding:"2px 6px",borderRadius:4,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid,flexShrink:0}}>Dismiss</button>
      </div>
    ))}
    {visible_alerts.length>5&&<button onClick={()=>setShowAll(!showAll)} style={{width:"100%",marginTop:8,padding:"5px",borderRadius:7,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>{showAll?"Show Less":"Show All "+visible_alerts.length+" Alerts"}</button>}
  </div>;
}

// ── ACTIVITY ALERTS ──
function ActivityAlerts({data,onUpdate,userRole,userId}) {
  const reps = userRole==="trainer" ? (data.reps||[]).filter(r=>r.trainerId===userId) : (data.reps||[]);
  const dismissedAlerts = data.dismissedAlerts||[];
  const alerts = [];
  reps.forEach(rep => {
    const cis = rep.checkIns||[];
    const lastCI = cis.length>0 ? new Date(cis[cis.length-1].date) : null;
    const ds = lastCI ? Math.floor((Date.now()-lastCI)/(86400000)) : null;
    const cl = (rep.track ? (({fast:13,regular:13,licensed:19})[rep.track]||13) : 13);
    const done = Object.values(rep.checked||{}).filter(Boolean).length;
    const pct = Math.round((done/cl)*100);
    if(ds===null&&rep.createdAt&&Date.now()-rep.createdAt>3*86400000) alerts.push({name:rep.name,msg:"No check-ins logged yet",color:C.warning,key:rep.id+"_noci"});
    else if(ds!==null&&ds>=7) alerts.push({name:rep.name,msg:"No check-in for "+ds+" days",color:C.danger,key:rep.id+"_stale"});
    if(pct===0&&rep.createdAt&&Date.now()-rep.createdAt>2*86400000) alerts.push({name:rep.name,msg:"No checklist progress yet",color:C.warning,key:rep.id+"_noprog"});
  });
  const [showAll,setShowAll] = useState(false);
  const visible_alerts = alerts.filter(a=>!dismissedAlerts.includes(a.key));
  if(visible_alerts.length===0) return null;
  const visible = showAll?visible_alerts:visible_alerts.slice(0,5);

  const dismiss = (key) => onUpdate({...data,dismissedAlerts:[...dismissedAlerts,key]});
  const clearAll = () => onUpdate({...data,dismissedAlerts:[...dismissedAlerts,...alerts.map(a=>a.key)]});

  return <div style={{background:"white",borderRadius:12,border:`1px solid ${C.border}`,padding:"12px 16px",marginBottom:14}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <div style={{width:8,height:8,borderRadius:4,background:C.danger}}/>
      <div style={{fontSize:14,fontWeight:700,color:C.text,flex:1}}>Activity Alerts ({visible_alerts.length})</div>
      <button onClick={clearAll} style={{fontSize:12,padding:"3px 8px",borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>Clear All</button>
    </div>
    {visible.map((a,i)=>(
      <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:i<visible.length-1?`1px solid ${C.border}`:"none"}}>
        <div style={{width:6,height:6,borderRadius:3,background:a.color,flexShrink:0}}/>
        <span style={{fontSize:13,fontWeight:600,color:C.text,flex:1}}>{a.name}</span>
        <span style={{fontSize:13,color:a.color,fontWeight:500,flex:1}}>{a.msg}</span>
        <button onClick={()=>dismiss(a.key)} style={{fontSize:12,padding:"2px 6px",borderRadius:4,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid,flexShrink:0}}>Dismiss</button>
      </div>
    ))}
    {visible_alerts.length>5&&<button onClick={()=>setShowAll(!showAll)} style={{width:"100%",marginTop:8,padding:"5px",borderRadius:7,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>{showAll?"Show Less":"Show All "+visible_alerts.length+" Alerts"}</button>}
  </div>;
}

// ── MONTHLY PRODUCTION HISTORY ──
function MonthlyHistory({data,onUpdate}) {
  const [open,setOpen] = useState(false);
  const history = data.productionHistory||[];
  const currentMonth = new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"});
  const reps = data.reps||[];
  const trainers = data.trainers||[];
  const totPremMo = reps.reduce((s,r)=>s+(Number(r.premiumSubmitted)||0),0)+[...(data.trainers||[]),...(data.admins||[])].reduce((s,t)=>{const a=(data.myProduction||{})[t.id]?.lifeApps||[];return s+a.reduce((ss,a)=>ss+(Number(a.premium)||0),0);},0);

  const archiveMonth = () => {
    if(!window.confirm(`Archive ${currentMonth} production data and reset for next month?`)) return;
    const entry = {
      month: currentMonth,
      archivedAt: new Date().toISOString(),
      premium: totPremMo,
      annualPremium: totPremMo*12,
      recruits: reps.length,
      licensed: reps.filter(r=>r.isLicensed).length,
    };
    onUpdate({...data, productionHistory:[...history, entry], reps: data.reps.map(r=>({...r,premiumSubmitted:0}))});
  };

  return <Card style={{marginBottom:14}}>
    <div onClick={()=>setOpen(!open)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text}}>Production History</div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <span style={{fontSize:13,color:C.textLight}}>{history.length} months archived</span>
        <span style={{fontSize:14,color:C.textLight,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>v</span>
      </div>
    </div>
    {open&&<div style={{marginTop:12}}>
      <button onClick={archiveMonth} style={{width:"100%",padding:"8px",borderRadius:8,background:C.navy,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,marginBottom:12}}>
        Archive {currentMonth} and Reset
      </button>
      {history.length===0&&<div style={{color:C.textLight,fontSize:13,textAlign:"center",padding:"8px 0"}}>No months archived yet</div>}
      {history.slice().reverse().map((h,i)=><div key={i} style={{padding:"8px 10px",borderRadius:8,background:C.surface,marginBottom:6}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <span style={{fontSize:13,fontWeight:700,color:C.text}}>{h.month}</span>
          <Badge color={C.teal} small>${Math.round(h.annualPremium).toLocaleString()}/yr</Badge>
        </div>
        <div style={{display:"flex",gap:12,fontSize:13,color:C.textMid}}>
          <span>${h.premium.toFixed(0)}/mo premium</span>
          <span>{h.recruits} recruits</span>
          <span>{h.licensed} licensed</span>
        </div>
      </div>)}
    </div>}
  </Card>;
}

// ── LEADERBOARD ──
function Leaderboard({data,userId}) {
  const [mode,setMode] = useState("scorecard");
  const weekKey = (()=>{const d=new Date();const day=d.getDay();const diff=d.getDate()-day+(day===0?-6:1);d.setDate(diff);d.setHours(0,0,0,0);return d.toISOString().split("T")[0];})();
  const allUsers = [
    ...(data.admins||[]).map(u=>({...u,role:"admin"})),
    ...(data.trainers||[]).map(u=>({...u,role:"trainer"})),
    ...(data.reps||[]).map(u=>({...u,role:"rep"})),
  ];
  const goals={contacts:100,apptSet:20,apptDone:20};

  const ranked = allUsers.map(u=>{
    const sc=(data.scorecards||{})[u.id]||{};
    const wk=sc[weekKey]||{contacts:0,apptSet:0,apptDone:0};
    const scorePct=Math.round(((wk.contacts/goals.contacts)+(wk.apptSet/goals.apptSet)+(wk.apptDone/goals.apptDone))/3*100);
    const apps=(data.myProduction||{})[u.id]?.lifeApps||[];
    const appts=(data.reps||[]).find(r=>r.id===u.id)?.appointments?.filter(a=>a.status==="Completed").length||0;
    return {...u,scorePct,lifeApps:apps.length,appts,wk};
  }).sort((a,b)=>{
    if(mode==="scorecard") return b.scorePct-a.scorePct;
    if(mode==="lifeapps") return b.lifeApps-a.lifeApps;
    return b.appts-a.appts;
  });

  const medals=["1st","2nd","3rd"];
  const roleColors={admin:C.teal,trainer:C.purple,rep:C.gold};

  const [open,setOpen] = useState(false);
  return <Card style={{marginBottom:14}}>
    <div onClick={()=>setOpen(!open)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",marginBottom:open?12:0}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text}}>Team Leaderboard</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:13,color:C.textLight}}>{ranked.length} members</span>
        <span style={{fontSize:14,color:C.textLight,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>v</span>
      </div>
    </div>
    {open&&<div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
      {[["scorecard","Scorecard"],["lifeapps","Life Apps"],["appts","Appts"],["recruits","Recruits"]].map(([k,l])=>(
        <button key={k} onClick={e=>{e.stopPropagation();setMode(k);}} style={{fontSize:12,padding:"3px 8px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:mode===k?700:400,background:mode===k?C.navy:C.surface,color:mode===k?"white":C.textMid}}>{l}</button>
      ))}
    </div>}
    {!open&&null}
    {open&&ranked.slice(0,10).map((u,i)=>{
      const isMe=u.id===userId;
      const val=mode==="scorecard"?`${u.scorePct}%`:mode==="lifeapps"?u.lifeApps:mode==="recruits"?u.recruits:u.appts;
      const maxVal=mode==="scorecard"?100:mode==="lifeapps"?Math.max(...ranked.map(r=>r.lifeApps),1):mode==="recruits"?Math.max(...ranked.map(r=>r.recruits),1):Math.max(...ranked.map(r=>r.appts),1);
      const pct=mode==="scorecard"?u.scorePct:(Number(val)/maxVal)*100;
      return <div key={u.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7,padding:"7px 9px",borderRadius:8,background:isMe?C.teal+"11":i<3?"rgba(0,0,0,0.02)":"transparent",border:isMe?`1px solid ${C.teal}33`:"1px solid transparent"}}>
        <div style={{width:28,height:20,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:i<3?9:11,fontWeight:700,color:i===0?C.gold:i===1?"#94a3b8":i===2?"#b45309":C.textLight,background:i<3?(i===0?C.gold+"22":i===1?"rgba(148,163,184,0.15)":"rgba(180,83,9,0.1)"):"transparent",borderRadius:4}}>{i<3?medals[i]:i+1}</div>
        <div style={{width:28,height:28,borderRadius:8,background:roleColors[u.role]+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:roleColors[u.role],flexShrink:0}}>{u.name?.charAt(0)?.toUpperCase()}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
            <span style={{fontSize:13,fontWeight:isMe?700:500,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}{isMe&&<span style={{fontSize:12,color:C.teal,marginLeft:4}}>(you)</span>}</span>
            <span style={{fontSize:13,fontWeight:700,color:i===0?C.gold:C.text,marginLeft:8,flexShrink:0}}>{val}</span>
          </div>
          <Bar pct={pct} color={i===0?C.gold:i===1?"#94a3b8":i===2?"#b45309":C.teal} h={3}/>
        </div>
      </div>;
    })}
    {open&&ranked.length===0&&<div style={{color:C.textLight,fontSize:13,textAlign:"center",padding:"12px 0"}}>No activity logged yet this week</div>}
  </Card>;
}


// ── TOP RECRUITERS ──
function TopRecruiters({data,onUpdate,userRole}) {
  const resetAt = data.topRecruitersResetAt || 0; // 0 = never cleared, show all-time
  const allPeople = [
    ...(data.admins||[]).map(p=>({...p,role:"Admin"})),
    ...(data.trainers||[]).map(p=>({...p,role:"Trainer"})),
    ...activeReps(data.reps).map(p=>({...p,role:"Rep"})),
  ];
  const recruitCounts = allPeople.map(p=>({
    ...p,
    // Only count recruits added since the last "Clear" — nothing about the reps
    // themselves (or who recruited them) is ever deleted, just what's displayed here.
    recruits:(data.reps||[]).filter(r=>r.recruitedBy===p.id&&!r.excludeFromRecruitCount&&(!resetAt||!r.createdAt||r.createdAt>=resetAt)),
  })).filter(p=>p.recruits.length>0).sort((a,b)=>b.recruits.length-a.recruits.length);

  const canClear=(userRole==="admin"||userRole==="superadmin")&&typeof onUpdate==="function";
  const clearSince = resetAt ? new Date(resetAt).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : null;

  const handleClear=()=>{
    if(!window.confirm("Clear Top Recruiters for a new month?\n\nThis only resets what's SHOWN here — it does NOT delete any rep, and does not change who recruited who. Past months' recruits just won't count toward this list anymore.")) return;
    onUpdate({...data,topRecruitersResetAt:Date.now()});
  };

  if(recruitCounts.length===0){
    if(!canClear) return null;
    return <Card style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div style={{fontSize:14,fontWeight:700,color:C.text}}>Top Recruiters</div>
        <button onClick={handleClear} style={{fontSize:11,padding:"4px 9px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textMid,cursor:"pointer",fontWeight:600}}>Clear</button>
      </div>
      <div style={{fontSize:12,color:C.textLight}}>{clearSince?`No recruits since ${clearSince}`:"No recruits yet"}</div>
    </Card>;
  }
  const roleColors={Admin:C.teal,Trainer:C.purple,Rep:C.gold};
  const medals=["1st","2nd","3rd"];

  return <Card style={{marginBottom:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text}}>Top Recruiters{clearSince&&<span style={{fontSize:11,fontWeight:500,color:C.textLight}}> (since {clearSince})</span>}</div>
      {canClear&&<button onClick={handleClear} style={{fontSize:11,padding:"4px 9px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textMid,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>Clear</button>}
    </div>
    {recruitCounts.slice(0,5).map((p,i)=><div key={p.id} style={{display:"flex",alignItems:"center",gap:9,marginBottom:8,padding:"7px 9px",borderRadius:8,background:i===0?C.gold+"11":"transparent",border:i===0?`1px solid ${C.gold}33`:"none"}}>
      <div style={{fontSize:i<3?9:11,fontWeight:700,width:28,height:20,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:4,background:i===0?C.gold+"22":i===1?"rgba(148,163,184,0.15)":i===2?"rgba(180,83,9,0.1)":"transparent",color:i===0?C.gold:i===1?"#94a3b8":i===2?"#b45309":C.textLight}}>{i<3?medals[i]:i+1}</div>
      <div style={{width:28,height:28,borderRadius:8,background:roleColors[p.role]+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:roleColors[p.role],flexShrink:0}}>{p.name?.charAt(0)?.toUpperCase()}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name} <span style={{fontSize:12,color:C.textLight}}>({p.role})</span></div>
        <div style={{fontSize:12,color:C.textMid,marginTop:1}}>{p.recruits.map(r=>r.name).join(", ")}</div>
      </div>
      <div style={{textAlign:"center",flexShrink:0}}>
        <div style={{fontSize:18,fontWeight:800,color:i===0?C.gold:C.text}}>{p.recruits.length}</div>
        <div style={{fontSize:10,color:C.textLight}}>recruit{p.recruits.length!==1?"s":""}</div>
      </div>
    </div>)}
  </Card>;
}

// ── COLLAPSIBLE REP LIST ──
function CollapsibleRepList({reps,data,onUpdateData}) {
  const [open,setOpen] = useState(false);
  const [search,setSearch] = useState("");
  const filtered = search ? activeReps(reps).filter(r=>r.name.toLowerCase().includes(search.toLowerCase())) : reps;
  return <div style={{marginTop:10,borderTop:`1px solid ${C.border}`,paddingTop:10}}>
    <button onClick={()=>setOpen(!open)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",padding:0}}>
      <div style={{fontSize:12,fontWeight:700,color:C.textMid,textTransform:"uppercase",letterSpacing:"0.5px"}}>Update Licensed Status ({reps.length} reps)</div>
      <div style={{fontSize:13,color:C.textLight,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>v</div>
    </button>
    {open&&<div style={{marginTop:8}}>
      <input placeholder="Search reps..." value={search} onChange={e=>setSearch(e.target.value)}
        style={{width:"100%",padding:"6px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,marginBottom:8,boxSizing:"border-box"}}/>
      {filtered.length===0&&<div style={{fontSize:13,color:C.textLight,textAlign:"center",padding:"8px 0"}}>No reps found</div>}
      {filtered.map(r=><div key={r.id} style={{display:"flex",alignItems:"center",gap:7,marginBottom:6,padding:"5px 0",borderBottom:`1px solid ${C.border}`}}>
        <span style={{fontSize:13,color:C.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</span>
        <label style={{display:"flex",alignItems:"center",gap:4,fontSize:13,color:C.textMid,cursor:"pointer",whiteSpace:"nowrap"}}>
          <input type="checkbox" checked={!!r.isLicensed} onChange={e=>onUpdateData({...data,reps:data.reps.map(rep=>rep.id===r.id?{...rep,isLicensed:e.target.checked}:rep)})}/> Licensed
        </label>
      </div>)}
    </div>}
  </div>;
}



// ── RECRUITS TAB ──
function RecruitsTab({rep,data,myRecruits,onUpdate}) {
  const [showForm,setShowForm] = useState(false);
  const [form,setForm] = useState({name:"",phone:"",date:localDateStr()});
  const myLoggedRecruits = rep.myRecruitLog||(()=>{try{const ls=localStorage.getItem("recruitLog_"+rep.id);return ls?JSON.parse(ls):[];}catch(e){return [];}})();

  const addRecruit = () => {
    if(!form.name) return;
    const updated = [...myLoggedRecruits,{...form,addedAt:new Date().toISOString(),id:Date.now()}];
    try{localStorage.setItem("recruitLog_"+rep.id,JSON.stringify(updated));}catch(e){}
    onUpdate(rep.id,{...rep,myRecruitLog:updated});
    setForm({name:"",phone:"",date:localDateStr()});
    setShowForm(false);
  };

  const removeRecruit = (id) => {
    onUpdate(rep.id,{...rep,myRecruitLog:myLoggedRecruits.filter(r=>r.id!==id)});
  };

  const totalRecruits = myRecruits.length + myLoggedRecruits.length;

  return <div>
    {/* Motivational banner */}
    <div style={{background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",borderRadius:12,padding:"14px 16px",marginBottom:14,color:"white",border:"1px solid "+C.teal+"33"}}>
      <div style={{fontSize:13,fontWeight:700,color:C.teal,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:6}}>Build Your Team</div>
      <div style={{fontSize:14,color:"rgba(255,255,255,0.85)",lineHeight:1.6,marginBottom:8}}>Every person you bring in builds your team, your income, and your legacy. <strong style={{color:"white"}}>Your income grows as your team grows.</strong> Stay connected to your recruits — their success is your success!</div>
      <div style={{background:"rgba(255,255,255,0.07)",borderRadius:8,padding:"8px 12px",fontSize:13,color:"rgba(255,255,255,0.7)"}}>Recruiting is a core requirement to become a Field Trainer and RVP. Every conversation is a step toward your goals!</div>
    </div>

    {/* Stats */}
    <Card style={{padding:"12px 14px",marginBottom:14,textAlign:"center"}}>
      <div style={{fontSize:28,fontWeight:800,color:C.teal}}>{totalRecruits}</div>
      <div style={{fontSize:13,color:C.textMid}}>Total People You Have Brought In</div>
    </Card>

    {/* Official recruits - in the system */}
    {myRecruits.length>0&&<div style={{marginBottom:14}}>
      <SecHead title={"In the System ("+myRecruits.length+")"} color={C.teal}/>
      {myRecruits.map((r,i)=>{
        const track=TRACK_INFO[r.track];
        const cl=TRACK_TO_CHECKLIST_KEY[r.track]?getChecklistItems(data,TRACK_TO_CHECKLIST_KEY[r.track]):[];
        const done=cl.filter(item=>(r.checked||{})[item.id]).length;
        const pct=cl.length>0?Math.round((done/cl.length)*100):0;
        return <div key={i} style={{borderRadius:8,border:"1px solid "+C.border,padding:"10px 12px",marginBottom:7,background:"white"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div><div style={{fontSize:14,fontWeight:700,color:C.text}}>{r.name}</div><div style={{fontSize:13,color:C.textMid}}><PhoneLink phone={r.phone}/></div></div>
            <Badge color={track?.color||C.teal} small>{track?.label}</Badge>
          </div>
          <div style={{fontSize:12,color:C.textMid,marginBottom:3}}>Their progress {pct}%</div>
          <Bar pct={pct} color={track?.color||C.teal} h={4}/>
          {pct===100&&<div style={{marginTop:5,fontSize:12,color:C.success,fontWeight:600}}>Graduated! Great job investing in them!</div>}
        </div>;
      })}
    </div>}

    {/* Personal recruit log */}
    {myLoggedRecruits.length>0&&<div style={{marginBottom:14}}>
      <SecHead title={"My Recruit Log ("+myLoggedRecruits.length+")"} color={C.purple}/>
      {myLoggedRecruits.map((r,i)=><div key={i} style={{borderRadius:8,border:"1px solid "+C.border,padding:"10px 12px",marginBottom:6,background:"white",display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:600,color:C.text}}>{r.name}</div>
          <div style={{fontSize:13,color:C.textMid}}>{r.phone&&r.phone+" - "}{r.date&&new Date(r.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
        </div>
        <button onClick={()=>removeRecruit(r.id)} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:16,padding:"0 4px"}}>x</button>
      </div>)}
    </div>}

    {/* Empty state */}
    {totalRecruits===0&&<div style={{textAlign:"center",padding:"20px 0",marginBottom:14}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>Your team starts with one conversation</div>
      <div style={{fontSize:13,color:C.textMid,lineHeight:1.6,maxWidth:320,margin:"0 auto"}}>Think about who in your life could use more income, financial protection, or a career change. That person is your first recruit. Log them below and reach out today!</div>
    </div>}

    {/* Add recruit button/form */}
    {!showForm?<button onClick={()=>setShowForm(true)} style={{width:"100%",padding:"10px",borderRadius:9,background:"linear-gradient(135deg,"+C.teal+",#0891b2)",color:"white",border:"none",fontWeight:700,fontSize:14,cursor:"pointer"}}>+ Log a New Recruit</button>:
    <Card style={{border:"1px solid "+C.teal+"44"}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>Log a New Recruit</div>
      <div style={{fontSize:13,color:C.textMid,marginBottom:10}}>Track everyone you bring into the opportunity. This is your personal record.</div>
      <input placeholder="Full Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:14,color:C.text,boxSizing:"border-box"}}/>
      <div style={{fontSize:11,color:C.textLight,marginBottom:8,marginTop:3}}>Use their exact name — if they're added as a full rep later, spell it the same way here (e.g. "Mike" here and "Michael" later won't match).</div>
      <input placeholder="Phone Number" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:14,color:C.text,marginBottom:8,boxSizing:"border-box"}}/>
      <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:14,color:C.text,marginBottom:10,boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
        <button onClick={addRecruit} style={{flex:2,padding:"8px",borderRadius:8,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>Save Recruit</button>
      </div>
    </Card>}
  </div>;
}


// ── PROSPECTS TAB ──
const PROSPECT_QUESTIONS = [
  {
    cat:"Purpose & Protection",
    color:"#e11d48",
    questions:[
      {id:"q1",q:"Who would you hate to see have to do a GoFundMe if something happened to them?"},
      {id:"q2",q:"Who would struggle financially if they lost their income tomorrow?"},
      {id:"q3",q:"Who has people depending on them but no protection in place?"},
      {id:"q4",q:"Who do you know that is the backbone of their family?"},
      {id:"q5",q:"Who would you feel guilty about NOT telling about this opportunity?"},
      {id:"q6",q:"Who is too young to be thinking about this but really should be?"},
    ]
  },
  {
    cat:"Life Events",
    color:C.teal,
    questions:[
      {id:"q7",q:"Who is getting married soon?"},
      {id:"q8",q:"Who just had or is expecting a baby?"},
      {id:"q9",q:"Who recently bought a home?"},
      {id:"q10",q:"Who just graduated or started a new job?"},
    ]
  },
  {
    cat:"Relationships",
    color:C.purple,
    questions:[
      {id:"q11",q:"Who would be your bridesmaid or groomsman?"},
      {id:"q12",q:"Who would you call first in an emergency? Who would be second?"},
      {id:"q13",q:"Who did you grow up with that you are still close to?"},
      {id:"q14",q:"Who do you respect at work?"},
    ]
  },
  {
    cat:"Financial Moments",
    color:C.gold,
    questions:[
      {id:"q15",q:"Who just got a promotion or raise?"},
      {id:"q16",q:"Who recently started their own business?"},
      {id:"q17",q:"Who do you know that worries about money or their family's future?"},
    ]
  },
  {
    cat:"Community",
    color:C.success,
    questions:[
      {id:"q18",q:"Who do you go to church with?"},
      {id:"q19",q:"Who is in your gym, sports team, or hobby group?"},
      {id:"q20",q:"Who did you go to school with that you are still in touch with?"},
    ]
  },
];

function ProspectsTab({rep,onUpdate}) {
  const prospects = rep.prospects||(()=>{try{const ls=localStorage.getItem("prospects_"+rep.id);return ls?JSON.parse(ls):{};}catch(e){return {};}})();
  const [openCats,setOpenCats] = useState({"Purpose & Protection":true});
  const [inputs,setInputs] = useState({});

  const toggleCat = (cat) => setOpenCats(prev=>({...prev,[cat]:!prev[cat]}));

  const addName = (qId) => {
    const name = (inputs[qId]||"").trim();
    if(!name) return;
    const existing = prospects[qId]||[];
    if(existing.some(n=>n.toLowerCase()===name.toLowerCase())) return;
    const updatedProspects = {...prospects,[qId]:[...existing,name]};
    try{localStorage.setItem("prospects_"+rep.id,JSON.stringify(updatedProspects));}catch(e){}
    onUpdate({...rep,prospects:updatedProspects});
    setInputs(prev=>({...prev,[qId]:""}));
  };

  const removeName = (qId,name) => {
    onUpdate({...rep,prospects:{...prospects,[qId]:(prospects[qId]||[]).filter(n=>n!==name)}});
  };

  // Build master list
  const masterList = [];
  PROSPECT_QUESTIONS.forEach(cat=>{
    cat.questions.forEach(q=>{
      (prospects[q.id]||[]).forEach(name=>{
        masterList.push({name,question:q.q,cat:cat.cat,color:cat.color,qId:q.id});
      });
    });
  });

  const totalProspects = masterList.length;

  return <div>
    {/* Header */}
    <div style={{background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",borderRadius:12,padding:"14px 16px",marginBottom:14,color:"white"}}>
      <div style={{fontSize:13,fontWeight:700,color:C.teal,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:6}}>Who Do You Know?</div>
      <div style={{fontSize:14,color:"rgba(255,255,255,0.85)",lineHeight:1.6,marginBottom:8}}>Answer each question honestly and write down every name that comes to mind. <strong style={{color:"white"}}>Don't overthink it.</strong> These are people who already know and trust you — they deserve to know about this opportunity.</div>
      <div style={{background:"rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 12px",fontSize:13,color:"rgba(255,255,255,0.7)"}}>
        {totalProspects===0?"Start with the first section below — it is the most important one.":"You have identified "+totalProspects+" prospect"+(totalProspects!==1?"s":"")+". Keep going!"}
      </div>
    </div>

    {/* Question categories */}
    {PROSPECT_QUESTIONS.map((cat,ci)=><div key={ci} style={{marginBottom:10}}>
      <button onClick={()=>toggleCat(cat.cat)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderRadius:10,background:"white",border:"2px solid "+cat.color+"33",cursor:"pointer",marginBottom:openCats[cat.cat]?0:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:10,height:10,borderRadius:5,background:cat.color,flexShrink:0}}/>
          <span style={{fontSize:14,fontWeight:700,color:C.text}}>{cat.cat}</span>
          {(()=>{const count=cat.questions.reduce((s,q)=>s+(prospects[q.id]||[]).length,0);return count>0?<span style={{fontSize:12,background:cat.color+"22",color:cat.color,padding:"2px 7px",borderRadius:10,fontWeight:600}}>{count} name{count!==1?"s":""}</span>:null;})()}
        </div>
        <span style={{fontSize:14,color:C.textLight,transform:openCats[cat.cat]?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>v</span>
      </button>

      {openCats[cat.cat]&&<div style={{background:"white",borderRadius:"0 0 10px 10px",border:"2px solid "+cat.color+"33",borderTop:"none",padding:"10px 14px"}}>
        {cat.questions.map((q,qi)=><div key={q.id} style={{marginBottom:qi<cat.questions.length-1?14:0,paddingBottom:qi<cat.questions.length-1?14:0,borderBottom:qi<cat.questions.length-1?"1px solid "+C.border:"none"}}>
          <div style={{fontSize:13,color:C.text,lineHeight:1.5,marginBottom:8,fontWeight:500}}>{q.q}</div>
          {/* Existing names */}
          {(prospects[q.id]||[]).length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
            {(prospects[q.id]||[]).map((name,ni)=><div key={ni} style={{display:"flex",alignItems:"center",gap:4,background:cat.color+"15",border:"1px solid "+cat.color+"33",borderRadius:20,padding:"3px 10px"}}>
              <span style={{fontSize:13,color:C.text,fontWeight:500}}>{name}</span>
              <button onClick={()=>removeName(q.id,name)} style={{background:"none",border:"none",cursor:"pointer",color:C.textLight,fontSize:14,lineHeight:1,padding:"0 0 0 2px"}}>×</button>
            </div>)}
          </div>}
          {/* Add name input */}
          <div style={{display:"flex",gap:6}}>
            <input placeholder="Type a name and press Add..." value={inputs[q.id]||""} onChange={e=>setInputs(prev=>({...prev,[q.id]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addName(q.id)} style={{flex:1,padding:"6px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:13,color:C.text}}/>
            <button onClick={()=>addName(q.id)} style={{padding:"6px 12px",borderRadius:8,border:"none",background:cat.color,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>Add</button>
          </div>
        </div>)}
      </div>}
    </div>)}

    {/* Master prospect list */}
    {masterList.length>0&&<div style={{marginTop:16}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:10}}>My Prospect List ({masterList.length})</div>
      {masterList.map((item,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 12px",borderRadius:8,background:"white",border:"1px solid "+C.border,marginBottom:6}}>
        <div style={{width:8,height:8,borderRadius:4,background:item.color,flexShrink:0,marginTop:4}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600,color:C.text}}>{item.name}</div>
          <div style={{fontSize:12,color:C.textLight,lineHeight:1.4,marginTop:2}}>{item.question}</div>
        </div>
        <button onClick={()=>removeName(item.qId,item.name)} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:16,flexShrink:0,padding:"0 2px"}}>×</button>
      </div>)}
    </div>}
  </div>;
}


// ── PROSPECTS PAGE (admin/trainer sidebar) ──
function ProspectsPage({session,data,onUpdate}) {
  const rep = {
    id: session.id,
    prospects: (data.staffProspects||{})[session.id]||{}
  };
  const updateProspects = (updated) => {
    onUpdate({...data,staffProspects:{...(data.staffProspects||{}),[session.id]:updated.prospects}});
  };
  return <div>
    <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:4}}>My Prospects</div>
    <div style={{fontSize:13,color:C.textMid,marginBottom:14}}>Your personal prospect list — separate from your reps' lists.</div>
    <ProspectsTab rep={rep} onUpdate={updateProspects}/>
  </div>;
}


// ── LEAD LINK PAGE (sidebar) ──
function QuickLinkCard({label,url,data,onUpdate,personId}) {
  const [shared,setShared] = useState(false);
  const markShared = () => {
    if(typeof onUpdate!=="function"||!personId) return;
    logLinkShare(data,onUpdate,personId,label||"Quick Link");
    setShared(true);
    setTimeout(()=>setShared(false),2000);
  };
  return <div style={{border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",marginBottom:8,background:"white"}}>
    <a href={url} target="_blank" rel="noopener noreferrer" style={{display:"block",textDecoration:"none"}}>
      <div style={{fontSize:16,fontWeight:700,color:C.teal}}>{label||"Link"}</div>
      <div style={{fontSize:13,color:C.textLight,marginTop:3,wordBreak:"break-all"}}>{url}</div>
    </a>
    {onUpdate&&personId&&<button onClick={markShared} style={{width:"100%",marginTop:10,padding:"9px",borderRadius:8,border:shared?`1px solid ${C.success}`:`1px solid ${C.border}`,background:shared?C.success+"11":"white",color:shared?C.success:C.textMid,cursor:"pointer",fontSize:13,fontWeight:600}}>
      {shared?"✓ Logged!":"Mark as Shared"}
    </button>}
  </div>;
}

function ShareableVideoLinkCard({label,url,data,onUpdate,personId,sendTo,messages}) {
  const [copied,setCopied] = useState(false);
  const [shared,setShared] = useState(false);
  const [msgCopied,setMsgCopied] = useState(false);
  const msgList = messages||[];
  const [msgIdx,setMsgIdx] = useState(0);
  const copy = () => {
    navigator.clipboard?.writeText(url).then(()=>{
      setCopied(true);
      setTimeout(()=>setCopied(false),2500);
    });
  };
  const copyMsg = () => {
    const text = msgList[msgIdx]?.content||"";
    if(!text) return;
    navigator.clipboard?.writeText(text).then(()=>{
      setMsgCopied(true);
      setTimeout(()=>setMsgCopied(false),2500);
    });
  };
  const markShared = () => {
    if(typeof onUpdate!=="function"||!personId) return;
    logLinkShare(data,onUpdate,personId,label||"Shareable Link");
    setShared(true);
    setTimeout(()=>setShared(false),2000);
  };
  return <div style={{background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",borderRadius:14,padding:"18px 20px",marginBottom:12,border:"1px solid "+C.teal+"33"}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <div style={{width:9,height:9,borderRadius:5,background:C.gold}}/>
      <div style={{fontSize:16,fontWeight:800,color:C.gold,textTransform:"uppercase",letterSpacing:"0.7px"}}>{label}</div>
    </div>
    {sendTo&&<div style={{background:"rgba(255,255,255,0.07)",borderRadius:10,padding:"12px 14px",marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:800,color:C.teal,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>Who Should I Send This To?</div>
      <div style={{fontSize:15,color:"rgba(255,255,255,0.85)",lineHeight:1.6}}>{sendTo}</div>
    </div>}
    <div style={{background:"rgba(255,255,255,0.08)",borderRadius:9,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
      <div style={{flex:1,fontSize:15,color:"white",wordBreak:"break-all",fontFamily:"monospace"}}>{url}</div>
    </div>
    <button onClick={copy} style={{width:"100%",padding:"12px",borderRadius:9,border:"none",background:copied?C.success:"linear-gradient(135deg,"+C.teal+",#0891b2)",color:"white",cursor:"pointer",fontSize:15,fontWeight:700}}>
      {copied?"Copied!":"Copy Link"}
    </button>
    {onUpdate&&personId&&<button onClick={markShared} style={{width:"100%",marginTop:10,padding:"11px",borderRadius:9,border:shared?"1px solid "+C.success:"1px solid rgba(255,255,255,0.2)",background:shared?"rgba(22,163,74,0.15)":"rgba(255,255,255,0.05)",color:shared?C.success:"rgba(255,255,255,0.8)",cursor:"pointer",fontSize:14,fontWeight:600}}>
      {shared?"✓ Logged!":"Mark as Shared"}
    </button>}
    {msgList.length>0&&<div style={{marginTop:12,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.12)"}}>
      <div style={{fontSize:13,fontWeight:800,color:C.teal,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Message to Send</div>
      {msgList.length>1&&<select value={msgIdx} onChange={e=>setMsgIdx(Number(e.target.value))} style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1px solid rgba(255,255,255,0.2)",background:C.navyMid,color:"white",fontSize:14,marginBottom:10}}>
        {msgList.map((m,i)=><option key={i} value={i} style={{background:C.navy}}>{m.label}</option>)}
      </select>}
      <div style={{background:"rgba(255,255,255,0.07)",borderRadius:9,padding:"12px 14px",marginBottom:10,fontSize:15,color:"rgba(255,255,255,0.9)",lineHeight:1.7,whiteSpace:"pre-wrap",maxHeight:180,overflowY:"auto"}}>{msgList[msgIdx]?.content}</div>
      <button onClick={copyMsg} style={{width:"100%",padding:"10px",borderRadius:9,border:"none",background:msgCopied?C.success:"rgba(255,255,255,0.1)",color:"white",cursor:"pointer",fontSize:14,fontWeight:600}}>
        {msgCopied?"Copied!":"📋 Copy Message"}
      </button>
    </div>}
  </div>;
}

function buildPersonalShareLink(templateUrl,refText){
  if(!templateUrl) return "";
  if(templateUrl.includes("{REP}")) return templateUrl.replace("{REP}",encodeURIComponent(refText));
  return templateUrl+(templateUrl.includes("?")?"&":"?")+"ref="+encodeURIComponent(refText);
}

function findMyRecordForLinks(data,session){
  if(session.role==="trainer") return {arr:"trainers",rec:(data.trainers||[]).find(t=>t.id===session.id)};
  if(session.role==="admin"||session.role==="superadmin") return {arr:"admins",rec:(data.admins||[]).find(a=>a.id===session.id)};
  return {arr:"reps",rec:(data.reps||[]).find(r=>r.id===session.id)};
}

function LeadLinkPage({session,data,onUpdate}) {
  const {rec:myRecord} = findMyRecordForLinks(data,session);
  const savedRepId = myRecord?.primericaRepId||"";
  const refText = session.name + (savedRepId?` (${savedRepId})`:"");
  const shareableLinks = data.repShareableLinks||[];

  return <div>
    <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:4}}>My Lead Link</div>
    <div style={{fontSize:13,color:C.textMid,marginBottom:16}}>Your personal MoneyMap link. Share it with anyone to start a financial conversation.</div>
    <MyLeadLink name={session.name} data={data} onUpdate={onUpdate} personId={session.id}/>

    {!savedRepId&&<div style={{border:`1px solid ${C.danger}`,borderRadius:10,padding:"10px 13px",marginBottom:16,background:C.danger+"0a",fontSize:13,color:C.text,lineHeight:1.5}}>⚠️ You haven't entered your Primerica Rep ID yet — head to <b>My Profile</b> to add it so you get credit when you share your video links below.</div>}

    {shareableLinks.length>0&&<>
      <div style={{background:C.gold+"11",border:`2px solid ${C.gold}`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:800,color:"#92400e",lineHeight:1.5}}>YOUR JOB IS NOT TO EXPLAIN THE OPPORTUNITY.</div>
        <div style={{fontSize:12,color:"#92400e",lineHeight:1.5,marginTop:4}}>Your job is to identify interest, send the appropriate video, and make sure the person completes the form. The video provides the overview. The form identifies their interest. From there, a follow-up conversation — or an interview for recruiting opportunities — determines the fit.</div>
      </div>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:8}}>Your Shareable Video Links</div>
      {shareableLinks.map(link=><ShareableVideoLinkCard key={link.id} label={link.label||"Shareable Link"} url={buildPersonalShareLink(link.templateUrl,refText)} data={data} onUpdate={onUpdate} personId={session.id} sendTo={link.sendTo} messages={link.messages}/>)}
    </>}

    {(data.teamLinks||[]).length>0&&<div style={{marginBottom:16}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:8}}>Quick Links</div>
      {(data.teamLinks||[]).map(link=><QuickLinkCard key={link.id} label={link.label} url={link.url} data={data} onUpdate={onUpdate} personId={session.id}/>)}
    </div>}

    <Card>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:8}}>How to use your links</div>
      {[
        {step:"1",text:"Copy whichever link fits the conversation — your MoneyMap link, a shareable video, or a Quick Link"},
        {step:"2",text:"Share it via text, email, social media, or in person"},
        {step:"3",text:"Tap \"Mark as Shared\" right after sending it — that's how you get credit for the share, and it feeds straight into your Scorecard"},
        {step:"4",text:"They click it and take the next step — complete their MoneyMap, watch the video, or check out the resource"},
        {step:"5",text:"Follow up with them to talk through it and set an appointment"},
        {step:"6",text:"Some links, like the recruiting video, come in more than one version — for example, a male or female speaker. Either version is fine to send; just pick whichever fits the person you're sending it to"},
      ].map((item,i)=><div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:i<5?"1px solid "+C.border:"none",alignItems:"flex-start"}}>
        <div style={{width:22,height:22,borderRadius:11,background:C.teal+"22",border:"1px solid "+C.teal+"33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <span style={{fontSize:12,fontWeight:700,color:C.teal}}>{item.step}</span>
        </div>
        <div style={{fontSize:13,color:C.text,lineHeight:1.5,paddingTop:2}}>{item.text}</div>
      </div>)}
    </Card>
  </div>;
}


// ── TEAM LEADS ──
function TeamLeads({userRole}) {
  const [leads,setLeads] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState(null);
  const [search,setSearch] = useState("");
  const [filter,setFilter] = useState("all");
  const [showArchived,setShowArchived] = useState(false);
  const isAdmin = userRole==="admin"||userRole==="superadmin";

  const fetchLeads = async () => {
    try {
      const q = query(collection(mmDb,"leads"), orderBy("submittedAt","desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(d=>({...d.data(),docId:d.id}));
      setLeads(data);
    } catch(e) {
      setError("Could not load leads. Check Firestore rules on MoneyMap Firebase.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ fetchLeads(); },[]);

  const archiveLead = async (docId) => {
    try {
      const {doc:fsDoc,updateDoc} = await import("firebase/firestore");
      await updateDoc(fsDoc(mmDb,"leads",docId),{archived:true});
      setLeads(prev=>prev.map(l=>l.docId===docId?{...l,archived:true}:l));
    } catch(e) {
      alert("Could not archive lead. Check MoneyMap Firestore write rules.");
    }
  };

  const unarchiveLead = async (docId) => {
    try {
      const {doc:fsDoc,updateDoc} = await import("firebase/firestore");
      await updateDoc(fsDoc(mmDb,"leads",docId),{archived:false});
      setLeads(prev=>prev.map(l=>l.docId===docId?{...l,archived:false}:l));
    } catch(e) {
      alert("Could not restore lead.");
    }
  };

  const activeLeads = leads.filter(l=>!l.archived);
  const archivedLeads = leads.filter(l=>l.archived);
  const displayLeads = showArchived ? archivedLeads : activeLeads;

  const filtered = displayLeads.filter(l=>{
    const matchSearch = !search ||
      (l.name||"").toLowerCase().includes(search.toLowerCase()) ||
      (l.phone||"").includes(search) ||
      (l.email||"").toLowerCase().includes(search.toLowerCase()) ||
      (l.referredBy||"").toLowerCase().includes(search.toLowerCase());
    if(filter==="wantsReview") return matchSearch && l.wantsReview;
    if(filter==="reviewCalled") return matchSearch && l.reviewCalled;
    if(filter==="bookSent") return matchSearch && l.bookSent;
    if(filter==="new") return matchSearch && !l.reviewCalled && !l.bookSent;
    return matchSearch;
  });

  const stats = {
    total: activeLeads.length,
    wantsReview: activeLeads.filter(l=>l.wantsReview).length,
    reviewCalled: activeLeads.filter(l=>l.reviewCalled).length,
    bookSent: activeLeads.filter(l=>l.bookSent).length,
    newLeads: activeLeads.filter(l=>!l.reviewCalled&&!l.bookSent).length,
  };

  const INTEREST_MAP = [
    {keys:["interest_identity_1","interest_identity_2"],label:"🔒 Identity Theft Protection",color:"#7c3aed"},
    {keys:["interest_life_ins_1","interest_life_ins_2"],label:"🛡️ Life Insurance",color:"#0ea5a0"},
    {keys:["interest_fna_1","interest_fna_2"],label:"💼 Financial Needs Analysis",color:"#0891b2"},
    {keys:["interest_savings_1","interest_savings_2"],label:"🐷 Savings",color:"#10b981"},
    {keys:["interest_debt_1","interest_debt_2"],label:"📉 Debt Help",color:"#ef4444"},
    {keys:["interest_auto_home_1","interest_auto_home_2"],label:"🏠 Auto & Home Insurance",color:"#f59e0b"},
    {keys:["interest_legal_1","interest_legal_2"],label:"⚖️ Legal Protection",color:"#8b5cf6"},
    {keys:["interest_home_security_1","interest_home_security_2"],label:"🏡 Home Security",color:"#059669"},
    {keys:["interest_budget_1","interest_budget_2"],label:"💡 Budgeting",color:"#d97706"},
    {keys:["interest_subscriptions_1","interest_subscriptions_2"],label:"💸 Subscriptions",color:"#6366f1"},
    {keys:["interest_mortgage_1","interest_mortgage_2"],label:"🏠 Mortgage",color:"#b45309"},
  ];

  const getInterests = (lead) => INTEREST_MAP.filter(item=>item.keys.some(k=>lead[k]===true));

  return <div>
    <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:4}}>Team Leads</div>
    <div style={{fontSize:13,color:C.textMid,marginBottom:14}}>All leads submitted through MoneyMap links.</div>

    {loading&&<div style={{textAlign:"center",padding:"40px 0",color:C.textMid}}>Loading leads...</div>}
    {error&&<div style={{background:C.danger+"11",border:"1px solid "+C.danger+"33",borderRadius:8,padding:"12px",color:C.danger,fontSize:13,marginBottom:14}}>{error}</div>}

    {!loading&&!error&&<div>
      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:14}}>
        {[
          {l:"Total Leads",v:stats.total,c:C.teal},
          {l:"Wants Review",v:stats.wantsReview,c:C.gold},
          {l:"Review Called",v:stats.reviewCalled,c:C.purple},
          {l:"New",v:stats.newLeads,c:C.success},
        ].map(s=><Card key={s.l} style={{padding:"9px 11px",textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:700,color:s.c}}>{s.v}</div>
          <div style={{fontSize:12,color:C.textMid,textTransform:"uppercase",letterSpacing:"0.5px"}}>{s.l}</div>
        </Card>)}
      </div>

      {/* Archived toggle */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:13,color:C.textMid}}>{showArchived?"Showing archived leads":"Showing active leads"} ({filtered.length})</div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {archivedLeads.length>0&&<button onClick={()=>{setShowArchived(!showArchived);setFilter("all");}} style={{fontSize:12,padding:"4px 9px",borderRadius:6,border:"1px solid "+C.border,background:showArchived?C.navy:"white",color:showArchived?"white":C.textMid,cursor:"pointer"}}>{showArchived?"View Active":"View Archived ("+archivedLeads.length+")"}</button>}
          <button onClick={fetchLeads} style={{fontSize:12,padding:"4px 9px",borderRadius:6,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>Refresh</button>
        </div>
      </div>
      {/* Search + Filter */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <input placeholder="Search by name, phone, or email..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,minWidth:180,padding:"7px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:13,color:C.text}}/>
        <div style={{display:"flex",gap:4}}>
          {[["all","All"],["new","New"],["wantsReview","Wants Review"],["reviewCalled","Called"],["bookSent","Book Sent"]].map(([k,l])=>(
            <button key={k} onClick={()=>setFilter(k)} style={{fontSize:12,padding:"5px 9px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:filter===k?600:400,background:filter===k?C.navy:C.surface,color:filter===k?"white":C.textMid,whiteSpace:"nowrap"}}>{l}</button>
          ))}
        </div>
      </div>

      {/* Leads list */}
      {filtered.length===0&&<div style={{textAlign:"center",padding:"32px 0",color:C.textLight}}>No leads found</div>}
      {filtered.map((lead,i)=><div key={i} style={{borderRadius:10,border:"1px solid "+(lead.archived?C.border+"88":C.border),padding:"12px 14px",marginBottom:8,background:lead.archived?C.surface:"white",opacity:lead.archived?0.7:1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:3}}>{lead.name||"Unknown"}</div>
            <div style={{fontSize:13,color:C.textMid,marginBottom:2}}>
              {lead.phone&&<span style={{marginRight:12}}>{lead.phone}</span>}
              {lead.email&&<span style={{color:C.teal}}>{lead.email}</span>}
            </div>
            {lead.referredBy&&<div style={{fontSize:13,color:C.purple,fontWeight:600,marginBottom:2}}>Rep: {lead.referredBy}</div>}
            <div style={{fontSize:12,color:C.textLight,marginBottom:6}}>{lead.submittedAt?new Date(lead.submittedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}):"No date"}</div>
            {(()=>{
              const interests=getInterests(lead);
              return interests.length>0?<div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4}}>
                {interests.map(item=><span key={item.label} style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:item.color+"18",color:item.color,fontWeight:600,border:`1px solid ${item.color}33`}}>{item.label}</span>)}
              </div>:lead.lastInterestTopic?<span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:C.teal+"18",color:C.teal,fontWeight:600,border:`1px solid ${C.teal}33`}}>{lead.lastInterestTopic}</span>:null;
            })()}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end",flexShrink:0}}>
            {lead.wantsReview&&<Badge color={C.gold} small>Wants Review</Badge>}
            {lead.reviewCalled&&<Badge color={C.purple} small>Review Called</Badge>}
            {lead.bookSent&&<Badge color={C.success} small>Book Sent</Badge>}
            {!lead.reviewCalled&&!lead.bookSent&&!lead.archived&&<Badge color={C.teal} small>New</Badge>}
            {isAdmin&&<button onClick={()=>lead.archived?unarchiveLead(lead.docId):archiveLead(lead.docId)} style={{fontSize:12,padding:"3px 8px",borderRadius:5,border:"1px solid "+(lead.archived?C.success+"33":C.danger+"33"),background:lead.archived?C.success+"11":C.danger+"11",color:lead.archived?C.success:C.danger,cursor:"pointer",marginTop:2}}>{lead.archived?"Restore":"Archive"}</button>}
          </div>
        </div>
      </div>)}

      <div style={{fontSize:13,color:C.textLight,textAlign:"center",marginTop:8}}>
        Showing {filtered.length} of {leads.length} leads • Refreshes on page load
      </div>
    </div>}
  </div>;
}


// ── MY LEADS (rep view) ──
function MyLeads({repName}) {
  const [leads,setLeads] = useState([]);
  const [loading,setLoading] = useState(true);
  const safeName = (repName||"").trim().split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g,"");

  useEffect(()=>{
    const fetchMyLeads = async () => {
      try {
        const q = query(collection(mmDb,"leads"), orderBy("submittedAt","desc"));
        const snap = await getDocs(q);
        const all = snap.docs.map(d=>({...d.data(),docId:d.id}));
        const mine = all.filter(l=>!l.archived&&(l.referredBy||"").toLowerCase()===safeName);
        setLeads(mine);
      } catch(e) {
        console.error("Could not load leads",e);
      } finally {
        setLoading(false);
      }
    };
    fetchMyLeads();
  },[safeName]);

  const INTEREST_MAP_R = [
    {keys:["interest_identity_1","interest_identity_2"],label:"🔒 Identity",color:"#7c3aed"},
    {keys:["interest_life_ins_1","interest_life_ins_2"],label:"🛡️ Life Ins",color:"#0ea5a0"},
    {keys:["interest_fna_1","interest_fna_2"],label:"💼 FNA",color:"#0891b2"},
    {keys:["interest_savings_1","interest_savings_2"],label:"🐷 Savings",color:"#10b981"},
    {keys:["interest_debt_1","interest_debt_2"],label:"📉 Debt",color:"#ef4444"},
    {keys:["interest_auto_home_1","interest_auto_home_2"],label:"🏠 Auto/Home",color:"#f59e0b"},
    {keys:["interest_legal_1","interest_legal_2"],label:"⚖️ Legal",color:"#8b5cf6"},
    {keys:["interest_home_security_1","interest_home_security_2"],label:"🏡 Security",color:"#059669"},
    {keys:["interest_budget_1","interest_budget_2"],label:"💡 Budget",color:"#d97706"},
    {keys:["interest_subscriptions_1","interest_subscriptions_2"],label:"💸 Subs",color:"#6366f1"},
    {keys:["interest_mortgage_1","interest_mortgage_2"],label:"🏠 Mortgage",color:"#b45309"},
  ];

  if(loading) return null;
  if(leads.length===0) return null;

  return <div style={{background:"white",borderRadius:12,border:"1px solid "+C.teal+"33",padding:"12px 14px",marginBottom:14}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <div style={{width:8,height:8,borderRadius:4,background:C.teal}}/>
      <div style={{fontSize:14,fontWeight:700,color:C.text}}>My Leads ({leads.length})</div>
    </div>
    {leads.slice(0,5).map((lead,i)=>{
      const interests=INTEREST_MAP_R.filter(item=>item.keys.some(k=>lead[k]===true));
      return <div key={i} style={{padding:"7px 0",borderBottom:i<Math.min(leads.length,5)-1?"1px solid "+C.border:"none"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:C.text}}>{lead.name||"Unknown"}</div>
            <div style={{fontSize:13,color:C.textMid}}>{lead.phone} • {lead.submittedAt?new Date(lead.submittedAt).toLocaleDateString():"No date"}</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end"}}>
            {lead.wantsReview&&<Badge color={C.gold} small>Wants Review</Badge>}
            {lead.reviewCalled&&<Badge color={C.purple} small>Called</Badge>}
            {lead.bookSent&&<Badge color={C.success} small>Book Sent</Badge>}
            {!lead.reviewCalled&&!lead.bookSent&&<Badge color={C.teal} small>New</Badge>}
          </div>
        </div>
        {interests.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:4}}>
          {interests.map(item=><span key={item.label} style={{fontSize:10,padding:"1px 6px",borderRadius:8,background:item.color+"18",color:item.color,fontWeight:600,border:`1px solid ${item.color}33`}}>{item.label}</span>)}
        </div>}
        {interests.length===0&&lead.lastInterestTopic&&<div style={{marginTop:3}}><span style={{fontSize:10,padding:"1px 6px",borderRadius:8,background:C.teal+"18",color:C.teal,fontWeight:600}}>{lead.lastInterestTopic}</span></div>}
      </div>;
    })}
    {leads.length>5&&<div style={{fontSize:13,color:C.textLight,textAlign:"center",marginTop:6}}>+{leads.length-5} more leads</div>}
  </div>;
}


// ── LEAD PIPELINE ──
const PIPELINE_STAGES = [
  {key:"new",label:"New Lead",color:C.teal},
  {key:"wantsReview",label:"Wants Review 🔔",color:"#f97316"},
  {key:"called",label:"Called",color:"#3b82f6"},
  {key:"bookSent",label:"HMW Book Sent",color:C.purple},
  {key:"apptScheduled",label:"Appt Scheduled",color:C.gold},
  {key:"apptDone",label:"Appt Done",color:"#f97316"},
  {key:"closedClient",label:"Closed - Client",color:C.success},
  {key:"closedNo",label:"Closed - Not Interested",color:C.danger},
];

function LeadPipeline({rep,data,onUpdate,isAdmin=false}) {
  const [activeStage,setActiveStage] = useState("all");
  const [search,setSearch] = useState("");
  const pipelineData = data.leadPipeline||{};
  const repPipeline = pipelineData[rep.id]||{};

  // Get all leads for this rep from MoneyMap leads merged with pipeline stage data
  const [mmLeads,setMmLeads] = useState([]);
  const safeName = rep.linkName||(rep.name||"").trim().split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g,"");

  useEffect(()=>{
    const fetchLeads = async()=>{
      try{
        const q = query(collection(mmDb,"leads"),orderBy("submittedAt","desc"));
        const snap = await getDocs(q);
        const all = snap.docs.map(d=>({...d.data(),docId:d.id}));
        const mine = all.filter(l=>!l.archived&&(l.referredBy||"").toLowerCase()===safeName);
        setMmLeads(mine);
      }catch(e){console.error(e);}
    };
    fetchLeads();
  },[safeName]);

  // Merge MoneyMap leads with pipeline stage from NextLevel Firebase
  const leads = mmLeads.map(l=>({
    ...l,
    stage: (repPipeline[l.docId]||{}).stage||(l.wantsReview?"wantsReview":"new"),
    stageUpdatedAt: (repPipeline[l.docId]||{}).stageUpdatedAt||l.submittedAt,
    notes: (repPipeline[l.docId]||{}).notes||"",
  }));

  const updateStage = (docId,stage) => {
    const updated = {
      ...pipelineData,
      [rep.id]:{
        ...repPipeline,
        [docId]:{
          ...(repPipeline[docId]||{}),
          stage,
          stageUpdatedAt:new Date().toISOString(),
        }
      }
    };
    onUpdate({...data,leadPipeline:updated});
  };

  const stageCounts = PIPELINE_STAGES.reduce((acc,s)=>{
    acc[s.key]=leads.filter(l=>l.stage===s.key).length;
    return acc;
  },{});

  const filtered = leads.filter(l=>{
    const matchStage = activeStage==="all"||l.stage===activeStage;
    const matchSearch = !search||(l.name||"").toLowerCase().includes(search.toLowerCase())||(l.phone||"").includes(search);
    return matchStage&&matchSearch;
  });

  const getDaysInStage = (stageUpdatedAt) => {
    return Math.floor((Date.now()-new Date(stageUpdatedAt))/(86400000));
  };

  if(mmLeads.length===0) return <div style={{textAlign:"center",padding:"20px 0",color:C.textLight,fontSize:13}}>No leads in your pipeline yet. Share your MoneyMap link to get started!</div>;

  return <div>
    {/* Wants Review notification banner */}
    {leads.filter(l=>l.wantsReview&&l.stage==="wantsReview").length>0&&<div style={{background:"linear-gradient(135deg,#f97316,#ea580c)",borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:16}}>🔔</span>
      <div style={{flex:1}}>
        <div style={{fontSize:14,fontWeight:700,color:"white"}}>{leads.filter(l=>l.wantsReview&&l.stage==="wantsReview").length} lead{leads.filter(l=>l.wantsReview&&l.stage==="wantsReview").length!==1?"s":""} requesting a review!</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.8)"}}>They submitted a Financial Needs Analysis request and are ready to speak with you.</div>
      </div>
    </div>}
    {/* Stage selector */}
    <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:6,marginBottom:12,WebkitOverflowScrolling:"touch"}}>
      <button onClick={()=>setActiveStage("all")} style={{flexShrink:0,padding:"5px 10px",borderRadius:7,border:"none",cursor:"pointer",fontWeight:activeStage==="all"?700:400,background:activeStage==="all"?C.navy:C.surface,color:activeStage==="all"?"white":C.textMid,fontSize:13}}>
        All ({leads.length})
      </button>
      {PIPELINE_STAGES.map(s=><button key={s.key} onClick={()=>setActiveStage(s.key)} style={{flexShrink:0,padding:"5px 10px",borderRadius:7,border:"none",cursor:"pointer",fontWeight:activeStage===s.key?700:400,background:activeStage===s.key?s.color:C.surface,color:activeStage===s.key?"white":C.textMid,fontSize:13,whiteSpace:"nowrap"}}>
        {s.label} {stageCounts[s.key]>0&&<span style={{background:"rgba(255,255,255,0.3)",borderRadius:10,padding:"1px 5px"}}>{stageCounts[s.key]}</span>}
      </button>)}
    </div>

    {/* Search */}
    {leads.length>3&&<input placeholder="Search leads..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:13,color:C.text,marginBottom:10,boxSizing:"border-box"}}/>}

    {/* Lead cards */}
    {filtered.length===0&&<div style={{textAlign:"center",padding:"16px 0",color:C.textLight,fontSize:13}}>No leads in this stage</div>}
    {filtered.map((lead,i)=>{
      const stage = PIPELINE_STAGES.find(s=>s.key===lead.stage)||PIPELINE_STAGES[0];
      const daysInStage = getDaysInStage(lead.stageUpdatedAt);
      const isStale = daysInStage>=7&&lead.stage!=="closedClient"&&lead.stage!=="closedNo";
      return <div key={i} style={{borderRadius:10,border:"2px solid "+stage.color+"33",padding:"10px 12px",marginBottom:8,background:"white"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text}}>{lead.name||"Unknown"}</div>
            {lead.phone&&<div style={{fontSize:13,color:C.textMid}}><PhoneLink phone={lead.phone}/></div>}
            {lead.email&&<div style={{fontSize:13,color:C.teal}}><a href={"mailto:"+lead.email} style={{color:C.teal,textDecoration:"none"}}>✉ {lead.email}</a></div>}
            <div style={{fontSize:12,color:C.textLight,marginTop:2}}>
              Received: {lead.submittedAt?new Date(lead.submittedAt).toLocaleDateString():"Unknown"}
            </div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:12,fontWeight:700,color:stage.color,background:stage.color+"15",borderRadius:6,padding:"2px 8px",marginBottom:4}}>{stage.label}</div>
            <div style={{fontSize:12,color:isStale?C.danger:C.textLight,fontWeight:isStale?600:400}}>{daysInStage}d in stage{isStale?" ⚠":""}
            </div>
          </div>
        </div>
        {/* Stage update */}
        {!isAdmin&&<select value={lead.stage} onChange={e=>updateStage(lead.docId,e.target.value)} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+stage.color+"44",fontSize:13,color:C.text,background:stage.color+"08",cursor:"pointer"}}>
          {PIPELINE_STAGES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
        </select>}
      </div>;
    })}
  </div>;
}

// ── ADMIN PIPELINE VIEW ──
function AdminPipeline({data,onUpdate}) {
  const [expandedRep,setExpandedRep] = useState(null);
  const [allLeads,setAllLeads] = useState([]);
  const [loading,setLoading] = useState(true);
  const pipelineData = data.leadPipeline||{};

  useEffect(()=>{
    const fetch = async()=>{
      try{
        const q = query(collection(mmDb,"leads"),orderBy("submittedAt","desc"));
        const snap = await getDocs(q);
        setAllLeads(snap.docs.map(d=>({...d.data(),docId:d.id})).filter(l=>!l.archived));
      }catch(e){console.error(e);}
      finally{setLoading(false);}
    };
    fetch();
  },[]);

  const allUsers = [
    ...(data.reps||[]).filter(r=>r.track==="licensed").map(r=>({...r,userRole:"rep"})),
    ...(data.trainers||[]).map(t=>({...t,userRole:"trainer"})),
    ...(data.admins||[]).map(a=>({...a,userRole:"admin"})),
  ];

  const repsWithLeads = allUsers.map(rep=>{
    const safeName = (rep.name||"").trim().split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g,"");
    const repLeads = allLeads.filter(l=>(l.referredBy||"").toLowerCase()===safeName).map(l=>({
      ...l,
      stage:(pipelineData[rep.id]||{})[l.docId]?.stage||"new",
      stageUpdatedAt:(pipelineData[rep.id]||{})[l.docId]?.stageUpdatedAt||l.submittedAt,
    }));
    const staleCount = repLeads.filter(l=>Math.floor((Date.now()-new Date(l.stageUpdatedAt))/86400000)>=7&&l.stage!=="closedClient"&&l.stage!=="closedNo").length;
    return {...rep,repLeads,staleCount};
  }).filter(r=>r.repLeads.length>0);

  if(loading) return <div style={{textAlign:"center",padding:"20px",color:C.textMid,fontSize:13}}>Loading pipeline data...</div>;
  if(repsWithLeads.length===0) return <div style={{textAlign:"center",padding:"20px",color:C.textLight,fontSize:13}}>No pipeline data yet</div>;

  return <div>
    {repsWithLeads.map((rep,i)=>{
      const isExpanded = expandedRep===rep.id;
      const stageSummary = PIPELINE_STAGES.reduce((acc,s)=>{acc[s.key]=rep.repLeads.filter(l=>l.stage===s.key).length;return acc;},{});
      return <div key={rep.id} style={{borderRadius:10,border:"1px solid "+C.border,marginBottom:8,overflow:"hidden"}}>
        <div onClick={()=>setExpandedRep(isExpanded?null:rep.id)} style={{padding:"10px 14px",background:isExpanded?C.navy:"white",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:isExpanded?"white":C.text}}>{rep.name} {rep.userRole!=="rep"&&<span style={{fontSize:12,color:isExpanded?"rgba(255,255,255,0.5)":C.textMid,fontWeight:400}}>({rep.userRole})</span>}</div>
            <div style={{fontSize:13,color:isExpanded?"rgba(255,255,255,0.5)":C.textMid}}>{rep.repLeads.length} lead{rep.repLeads.length!==1?"s":""}{rep.staleCount>0&&<span style={{color:C.danger,fontWeight:600}}> • {rep.staleCount} stale</span>}</div>
          </div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end",maxWidth:200}}>
            {PIPELINE_STAGES.filter(s=>stageSummary[s.key]>0).map(s=><span key={s.key} style={{fontSize:10,background:s.color+"22",color:s.color,borderRadius:4,padding:"1px 5px",fontWeight:600}}>{stageSummary[s.key]} {s.label.split(" ")[0]}</span>)}
          </div>
        </div>
        {isExpanded&&<div style={{padding:"10px 14px"}}>
          <LeadPipeline rep={rep} data={data} onUpdate={onUpdate} isAdmin={true}/>
        </div>}
      </div>;
    })}
  </div>;
}

// ── MY PIPELINE PAGE (admin/trainer sidebar) ──
function MyPipelinePage({session,data,onUpdate}) {
  // For admins use their linkName if set, otherwise use first name
  const adminRecord = (data.admins||[]).find(a=>a.id===session.id);
  const trainerRecord = (data.trainers||[]).find(t=>t.id===session.id);
  const linkName = adminRecord?.linkName||trainerRecord?.linkName||null;
  const pseudoRep = {id:session.id, name:linkName||session.name, linkName:linkName||null, track:"licensed", primericaRepId:adminRecord?.primericaRepId||trainerRecord?.primericaRepId||null};
  return <div>
    <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:4}}>My Pipeline</div>
    <div style={{fontSize:13,color:C.textMid,marginBottom:14}}>Leads from your personal MoneyMap link and their current stage.</div>
    <LeadPipeline rep={pseudoRep} data={data} onUpdate={onUpdate}/>
  </div>;
}


// ── MY TASKS ──
const TASK_DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const TASK_CATEGORIES = ["Activity","Recruiting","Personal","Prospecting","Production","End of Day","Business","Custom"];
const TASK_PRIORITIES = ["High","Medium","Low"];
const PRIORITY_COLORS = {High:C.danger,Medium:C.gold,Low:C.success};

// Preset items for the RVP Daily Success Checklist (admin/superadmin only) — loads as
// recurring My Tasks items (Mon–Fri) using the same completedDays tracking every other
// recurring task already uses, so no new data model or page was needed for this.
const DAILY_SUCCESS_CHECKLIST_ITEMS = [
  {key:"personal_time_with_god",title:"Time with God",category:"Personal"},
  {key:"personal_workout",title:"Workout complete",category:"Personal"},
  {key:"personal_read",title:"Read 10–20 minutes",category:"Personal"},
  {key:"personal_review_goals",title:"Review goals",category:"Personal"},
  {key:"prospecting_contact",title:"Contact 20–30 people",category:"Prospecting"},
  {key:"prospecting_book_appts",title:"Book 5+ appointments",category:"Prospecting"},
  {key:"prospecting_conduct_appts",title:"Conduct 3+ appointments",category:"Prospecting"},
  {key:"prospecting_referrals",title:"Ask every client for referrals",category:"Prospecting"},
  {key:"prospecting_recruit",title:"Recruit at least 1 prospective agent",category:"Prospecting"},
  {key:"production_investment",title:"Investment appointments completed",category:"Production"},
  {key:"production_mortgage",title:"Mortgage appointments completed",category:"Production"},
  {key:"production_life",title:"Life insurance presentations completed",category:"Production"},
  {key:"production_followup",title:"Follow up on pending business",category:"Production"},
  {key:"production_submit",title:"Submit all available business today",category:"Production"},
  {key:"eod_recorded",title:"Daily production recorded",category:"End of Day"},
  {key:"eod_revenue",title:"Revenue updated",category:"End of Day"},
  {key:"eod_plan_tomorrow",title:"Tomorrow planned before bed",category:"End of Day"},
];

// Money / business / work-ethic scripture for the Income Goal Campaign — King James Version
// (public domain, no translation licensing to worry about). Picks a new one each calendar day.
const MONEY_SCRIPTURES = [
  {ref:"Proverbs 22:29",text:"Seest thou a man diligent in his business? he shall stand before kings; he shall not stand before mean men."},
  {ref:"Proverbs 13:11",text:"Wealth gotten by vanity shall be diminished: but he that gathereth by labour shall increase."},
  {ref:"Proverbs 14:23",text:"In all labour there is profit: but the talk of the lips tendeth only to penury."},
  {ref:"Colossians 3:23",text:"And whatsoever ye do, do it heartily, as to the Lord, and not unto men."},
  {ref:"Proverbs 21:5",text:"The thoughts of the diligent tend only to plenteousness; but of every one that is hasty only to want."},
  {ref:"Proverbs 10:4",text:"He becometh poor that dealeth with a slack hand: but the hand of the diligent maketh rich."},
  {ref:"Proverbs 16:3",text:"Commit thy works unto the LORD, and thy thoughts shall be established."},
  {ref:"Ecclesiastes 9:10",text:"Whatsoever thy hand findeth to do, do it with thy might."},
  {ref:"Proverbs 27:23",text:"Be thou diligent to know the state of thy flocks, and look well to thy herds."},
  {ref:"Philippians 4:13",text:"I can do all things through Christ which strengtheneth me."},
  {ref:"Proverbs 24:27",text:"Prepare thy work without, and make it fit for thyself in the field; and afterwards build thine house."},
  {ref:"Proverbs 6:6",text:"Go to the ant, thou sluggard; consider her ways, and be wise."},
  {ref:"Proverbs 12:24",text:"The hand of the diligent shall bear rule: but the slothful shall be under tribute."},
  {ref:"Deuteronomy 8:18",text:"Thou shalt remember the LORD thy God: for it is he that giveth thee power to get wealth."},
  {ref:"Proverbs 3:9",text:"Honour the LORD with thy substance, and with the firstfruits of all thine increase."},
  {ref:"2 Corinthians 9:6",text:"He which soweth sparingly shall reap also sparingly; and he which soweth bountifully shall reap also bountifully."},
  {ref:"Proverbs 16:9",text:"A man's heart deviseth his way: but the LORD directeth his steps."},
  {ref:"Proverbs 31:17",text:"She girdeth her loins with strength, and strengtheneth her arms."},
  {ref:"Galatians 6:9",text:"And let us not be weary in well doing: for in due season we shall reap, if we faint not."},
  {ref:"Proverbs 22:6",text:"Train up a child in the way he should go: and when he is old, he will not depart from it."},
  {ref:"Matthew 25:21",text:"Well done, thou good and faithful servant: thou hast been faithful over a few things, I will make thee ruler over many things."},
  {ref:"Proverbs 11:25",text:"The liberal soul shall be made fat: and he that watereth shall be watered also himself."},
  {ref:"Luke 16:10",text:"He that is faithful in that which is least is faithful also in much."},
  {ref:"Proverbs 28:20",text:"A faithful man shall abound with blessings: but he that maketh haste to be rich shall not be innocent."},
  {ref:"Jeremiah 29:11",text:"For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end."},
  {ref:"Malachi 3:10",text:"Bring ye all the tithes into the storehouse, that there may be meat in mine house, and prove me now herewith, saith the LORD of hosts, if I will not open you the windows of heaven, and pour you out a blessing, that there shall not be room enough to receive it."},
  {ref:"Proverbs 3:10",text:"So shall thy barns be filled with plenty, and thy presses shall burst out with new wine."},
  {ref:"Leviticus 27:30",text:"And all the tithe of the land, whether of the seed of the land, or of the fruit of the tree, is the LORD's: it is holy unto the LORD."},
  {ref:"2 Corinthians 9:7",text:"Every man according as he purposeth in his heart, so let him give; not grudgingly, or of necessity: for God loveth a cheerful giver."},
  {ref:"Luke 6:38",text:"Give, and it shall be given unto you; good measure, pressed down, and shaken together, and running over, shall men give into your bosom."},
  {ref:"Romans 12:11",text:"Not slothful in business; fervent in spirit; serving the Lord."},
  {ref:"Proverbs 16:8",text:"Better is a little with righteousness than great revenues without right."},
  {ref:"Ecclesiastes 5:19",text:"Every man also to whom God hath given riches and wealth, and hath given him power to eat thereof, and to take his portion, and to rejoice in his labour; this is the gift of God."},
  {ref:"1 Timothy 6:10",text:"For the love of money is the root of all evil: which while some coveted after, they have erred from the faith, and pierced themselves through with many sorrows."},
  {ref:"Proverbs 11:1",text:"A false balance is abomination to the LORD: but a just weight is his delight."},
  {ref:"James 1:5",text:"If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him."},
  {ref:"Psalm 37:4",text:"Delight thyself also in the LORD; and he shall give thee the desires of thine heart."},
  {ref:"Proverbs 15:22",text:"Without counsel purposes are disappointed: but in the multitude of counsellors they are established."},
  {ref:"Habakkuk 2:2",text:"Write the vision, and make it plain upon tables, that he may run that readeth it."},
  {ref:"Joshua 1:9",text:"Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest."},
];
const getTodaysScripture = () => {
  const start = new Date(new Date().getFullYear(),0,0);
  const diff = new Date() - start;
  const dayOfYear = Math.floor(diff/86400000);
  return MONEY_SCRIPTURES[dayOfYear % MONEY_SCRIPTURES.length];
};

function MyTasksPage({session,data,onUpdate}) {
  const userId = session.id;
  const myTasks = (data.myTasks||{})[userId]||[];
  const [showForm,setShowForm] = useState(false);
  const [editId,setEditId] = useState(null);
  const [form,setForm] = useState({
    title:"",description:"",startDate:new Date().toISOString().split("T")[0],
    dueDate:"",recurring:false,days:[0,1,2,3,4,5,6],
    priority:"Medium",category:"Activity",subtasks:[],newSubtask:""
  });
  const today = new Date().toISOString().split("T")[0];

  const resetForm = () => setForm({
    title:"",description:"",startDate:new Date().toISOString().split("T")[0],
    dueDate:"",recurring:false,days:[0,1,2,3,4,5,6],
    priority:"Medium",category:"Activity",subtasks:[],newSubtask:""
  });

  const saveTask = () => {
    if(!form.title.trim()) return;
    const task = {
      id:editId||Date.now(),
      title:form.title,description:form.description,
      startDate:form.startDate,dueDate:form.dueDate,
      recurring:form.recurring,days:form.days,
      priority:form.priority,category:form.category,
      subtasks:form.subtasks,
      createdAt:new Date().toISOString(),
      completedDays:{},
    };
    const updated = editId
      ? myTasks.map(t=>t.id===editId?{...t,...task}:t)
      : [...myTasks,task];
    onUpdate({...data,myTasks:{...(data.myTasks||{}),[userId]:updated}});
    setShowForm(false);setEditId(null);resetForm();
  };

  const toggleDayComplete = (taskId,day) => {
    const updated = myTasks.map(t=>{
      if(t.id!==taskId) return t;
      const cd = t.completedDays||{};
      return {...t,completedDays:{...cd,[day]:!cd[day]}};
    });
    onUpdate({...data,myTasks:{...(data.myTasks||{}),[userId]:updated}});
  };

  const deleteTask = (taskId) => {
    if(!window.confirm("Delete this task?")) return;
    onUpdate({...data,myTasks:{...(data.myTasks||{}),[userId]:myTasks.filter(t=>t.id!==taskId)}});
  };

  const editTask = (task) => {
    setForm({...task,newSubtask:""});
    setEditId(task.id);
    setShowForm(true);
  };

  const addSubtask = () => {
    if(!form.newSubtask.trim()) return;
    setForm(f=>({...f,subtasks:[...f.subtasks,{id:Date.now(),text:f.newSubtask.trim()}],newSubtask:""}));
  };

  const getDaysLeft = (dueDate) => {
    if(!dueDate) return null;
    return Math.ceil((new Date(dueDate+"T12:00:00")-new Date())/86400000);
  };

  const getStreak = (task) => {
    const cd = task.completedDays||{};
    let streak=0;
    const d=new Date();
    while(true){
      const key=d.toISOString().split("T")[0];
      if(cd[key]) streak++;
      else break;
      d.setDate(d.getDate()-1);
      if(streak>365) break;
    }
    return streak;
  };

  const isTodayActive = (task) => {
    if(!task.recurring) return true;
    const dayOfWeek = new Date().getDay();
    return (task.days||[]).includes(dayOfWeek);
  };

  // ── INCOME GOAL CAMPAIGN (admin/superadmin, fully editable, reusable for future campaigns) ──
  const campaign = (data.incomeCampaign||{})[userId] || null;
  const updateCampaign = (patch) => {
    onUpdate({...data,incomeCampaign:{...(data.incomeCampaign||{}),[userId]:{...campaign,...patch}}});
  };
  const loadIncomeCampaign = () => {
    if(campaign){ return; }
    const defaultCampaign = {
      deadline:"2026-08-07",
      targetIncome:53956,
      weeklyGoal:10792,
      dailyGoal:1459,
      totalDays:37,
      dailyFocus:"Highest-income activity first",
      dailyQuestion:"What is the highest-income activity I can complete before the day ends?",
      targets:[
        {id:1,category:"Jackie's Investment Override",goalValue:"Approx. $4,900",done:false},
        {id:2,category:"Securities Production",goalValue:"$900,000 AUM = approx. $27,000",done:false},
        {id:3,category:"Mortgage Closing",goalValue:"$268,500 close = approx. $2,660",done:false},
        {id:4,category:"Life Insurance",goalValue:"25 applications at $84/month average premium",done:false},
      ],
      weeks:[1,2,3,4,5].map(n=>({id:n,weekNum:n,revenueTarget:10792,revenueDone:false,lifeAppsTarget:5,lifeAppsDone:false,securitiesTarget:180000,securitiesDone:false,mortgageTarget:53700,mortgageDone:false,notes:n===1?"Investment override progress":""})),
      finishLine:[
        {id:1,label:"$53,956 income achieved",done:false},
        {id:2,label:"$900,000 securities submitted/closed",done:false},
        {id:3,label:"$268,500 mortgage closed",done:false},
        {id:4,label:"25 life insurance applications submitted",done:false},
        {id:5,label:"$4,900 Jackie investment override",done:false},
      ],
    };
    onUpdate({...data,incomeCampaign:{...(data.incomeCampaign||{}),[userId]:defaultCampaign}});
  };
  const deleteCampaign = () => {
    if(!window.confirm("Delete this Income Goal Campaign? This removes all targets, weekly scorecard, and finish line progress — permanently, with no copy saved.")) return;
    const {[userId]:_omit,...restCampaigns} = data.incomeCampaign||{};
    onUpdate({...data,incomeCampaign:restCampaigns});
  };
  const campaignArchive = ((data.incomeCampaignArchive||{})[userId])||[];
  const [showArchive,setShowArchive]=useState(false);
  const archiveCampaign = () => {
    if(!window.confirm("Archive this campaign and start a new one?\n\nA snapshot of everything (targets, weekly scorecard, finish line) will be saved so you can look back on it later, then this campaign will be cleared so you can start fresh.")) return;
    const snapshot = {...campaign,archivedAt:Date.now(),id:Date.now()};
    const updatedArchive = [snapshot,...campaignArchive];
    const {[userId]:_omit,...restCampaigns} = data.incomeCampaign||{};
    onUpdate({
      ...data,
      incomeCampaign:restCampaigns,
      incomeCampaignArchive:{...(data.incomeCampaignArchive||{}),[userId]:updatedArchive},
    });
  };
  const deleteArchivedCampaign = (id) => {
    if(!window.confirm("Permanently delete this archived campaign? This cannot be undone.")) return;
    onUpdate({...data,incomeCampaignArchive:{...(data.incomeCampaignArchive||{}),[userId]:campaignArchive.filter(c=>c.id!==id)}});
  };
  const updateTarget=(id,patch)=>updateCampaign({targets:campaign.targets.map(t=>t.id===id?{...t,...patch}:t)});
  const addTarget=()=>updateCampaign({targets:[...campaign.targets,{id:Date.now(),category:"New Category",goalValue:"",done:false}]});
  const removeTarget=(id)=>updateCampaign({targets:campaign.targets.filter(t=>t.id!==id)});
  const updateWeek=(id,patch)=>updateCampaign({weeks:campaign.weeks.map(w=>w.id===id?{...w,...patch}:w)});
  const addWeek=()=>{
    const nextNum=(campaign.weeks[campaign.weeks.length-1]?.weekNum||0)+1;
    updateCampaign({weeks:[...campaign.weeks,{id:Date.now(),weekNum:nextNum,revenueTarget:campaign.weeklyGoal||0,revenueDone:false,lifeAppsTarget:0,lifeAppsDone:false,securitiesTarget:0,securitiesDone:false,mortgageTarget:0,mortgageDone:false,notes:""}]});
  };
  const removeWeek=(id)=>updateCampaign({weeks:campaign.weeks.filter(w=>w.id!==id)});
  const updateFinish=(id,patch)=>updateCampaign({finishLine:campaign.finishLine.map(f=>f.id===id?{...f,...patch}:f)});
  const addFinish=()=>updateCampaign({finishLine:[...campaign.finishLine,{id:Date.now(),label:"New goal",done:false}]});
  const removeFinish=(id)=>updateCampaign({finishLine:campaign.finishLine.filter(f=>f.id!==id)});

  const loadDailyChecklist = () => {
    const existingKeys = new Set(myTasks.filter(t=>t.dailyChecklist).map(t=>t.checklistKey));
    const newOnes = DAILY_SUCCESS_CHECKLIST_ITEMS.filter(i=>!existingKeys.has(i.key)).map((i,idx)=>({
      id:Date.now()+idx,
      title:i.title,
      description:"",
      startDate:new Date().toISOString().split("T")[0],
      dueDate:"",
      recurring:true,
      days:[1,2,3,4,5],
      priority:"Medium",
      category:i.category,
      subtasks:[],
      createdAt:new Date().toISOString(),
      completedDays:{},
      dailyChecklist:true,
      checklistKey:i.key,
    }));
    if(newOnes.length===0){ alert("Your Daily Success Checklist is already loaded — check below for all your items."); return; }
    onUpdate({...data,myTasks:{...(data.myTasks||{}),[userId]:[...myTasks,...newOnes]}});
  };

  // ── Weekly grid view for the Daily Success Checklist (admin/superadmin) ──
  const [weekOffset,setWeekOffset]=useState(0);
  const [editingItemId,setEditingItemId]=useState(null);
  const [editingItemDraft,setEditingItemDraft]=useState("");
  const startEditItem=(t)=>{ setEditingItemId(t.id); setEditingItemDraft(t.title); };
  const saveEditItem=()=>{
    if(!editingItemDraft.trim()){ setEditingItemId(null); return; }
    const updated=myTasks.map(t=>t.id===editingItemId?{...t,title:editingItemDraft.trim(),dailyChecklist:true}:t);
    onUpdate({...data,myTasks:{...(data.myTasks||{}),[userId]:updated}});
    setEditingItemId(null);
  };
  const checklistTitleSet = new Set(DAILY_SUCCESS_CHECKLIST_ITEMS.map(i=>i.title));
  const checklistTasks = myTasks.filter(t=>t.dailyChecklist||checklistTitleSet.has(t.title));
  const otherTasks = myTasks.filter(t=>!(t.dailyChecklist||checklistTitleSet.has(t.title)));
  const weekDates = (()=>{
    const now=new Date();
    const dow=now.getDay();
    const diffToMonday=dow===0?-6:1-dow;
    const monday=new Date(now);
    monday.setDate(now.getDate()+diffToMonday+weekOffset*7);
    monday.setHours(0,0,0,0);
    return [0,1,2,3,4].map(i=>{
      const d=new Date(monday);
      d.setDate(monday.getDate()+i);
      return {label:["Mon","Tue","Wed","Thu","Fri"][i],dateStr:d.toISOString().split("T")[0],dateObj:d};
    });
  })();
  const weekLabel = `${weekDates[0].dateObj.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${weekDates[4].dateObj.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`;
  const CHECKLIST_CATEGORY_ORDER=["Personal","Prospecting","Production","End of Day"];
  const groupedChecklist={};
  checklistTasks.forEach(t=>{ (groupedChecklist[t.category]=groupedChecklist[t.category]||[]).push(t); });

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,flexWrap:"wrap",gap:8}}>
      <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text}}>My Tasks & Goals</div>
      <div style={{display:"flex",gap:8}}>
        {(session.role==="admin"||session.role==="superadmin")&&!campaign&&<button onClick={loadIncomeCampaign} style={{fontSize:13,padding:"5px 12px",borderRadius:8,border:`1px solid ${C.teal}`,background:C.teal+"11",color:C.teal,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>Load Income Goal Campaign</button>}
        {(session.role==="admin"||session.role==="superadmin")&&<button onClick={loadDailyChecklist} style={{fontSize:13,padding:"5px 12px",borderRadius:8,border:`1px solid ${C.gold}`,background:C.gold+"11",color:C.gold,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>Load Daily Success Checklist</button>}
        <button onClick={()=>{setShowForm(!showForm);setEditId(null);resetForm();}} style={{fontSize:13,padding:"5px 12px",borderRadius:8,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>+ New Task</button>
      </div>
    </div>
    <div style={{fontSize:13,color:C.textMid,marginBottom:14}}>Personal tasks and recurring goals — private to you.</div>

    {(session.role==="admin"||session.role==="superadmin")&&(()=>{ const s=getTodaysScripture(); return <div style={{background:C.teal+"0d",border:`1px solid ${C.teal}33`,borderRadius:10,padding:"10px 13px",marginBottom:16}}>
      <div style={{fontSize:13,color:C.text,fontStyle:"italic",lineHeight:1.5,marginBottom:3}}>"{s.text}"</div>
      <div style={{fontSize:11,color:C.teal,fontWeight:700}}>{s.ref}</div>
    </div>; })()}

    {/* Income Goal Campaign */}
    {(session.role==="admin"||session.role==="superadmin")&&campaign&&<div style={{marginBottom:24}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:14,fontWeight:700,color:C.text}}>Income Goal Campaign</div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={archiveCampaign} style={{fontSize:11,padding:"4px 9px",borderRadius:6,border:`1px solid ${C.teal}`,background:C.teal+"11",color:C.teal,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>Archive & Start New</button>
          <button onClick={deleteCampaign} style={{fontSize:11,padding:"4px 9px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textMid,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>Delete (no copy saved)</button>
        </div>
      </div>

      <div style={{background:C.gold+"11",border:`1px solid ${C.gold}44`,borderRadius:10,padding:"9px 12px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:15,flexShrink:0}}>🎯</span>
        <input value={campaign.dailyQuestion||""} onChange={e=>updateCampaign({dailyQuestion:e.target.value})} style={{flex:1,background:"transparent",border:"none",fontSize:13,fontWeight:600,color:"#92400e",outline:"none"}}/>
      </div>

      <div style={{border:`1px solid ${C.border}`,borderRadius:10,padding:12,background:"white",marginBottom:10}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:10}}>
          <div>
            <div style={{fontSize:11,color:C.textMid,fontWeight:600,marginBottom:3}}>Deadline</div>
            <input type="date" value={campaign.deadline} onChange={e=>updateCampaign({deadline:e.target.value})} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,width:"100%"}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:C.textMid,fontWeight:600,marginBottom:3}}>Target Income ($)</div>
            <input type="number" value={campaign.targetIncome} onChange={e=>updateCampaign({targetIncome:Number(e.target.value)})} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,width:"100%"}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:C.textMid,fontWeight:600,marginBottom:3}}>Weekly Goal ($/wk)</div>
            <input type="number" value={campaign.weeklyGoal} onChange={e=>updateCampaign({weeklyGoal:Number(e.target.value)})} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,width:"100%"}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:C.textMid,fontWeight:600,marginBottom:3}}>Daily Goal ($/day)</div>
            <input type="number" value={campaign.dailyGoal} onChange={e=>updateCampaign({dailyGoal:Number(e.target.value)})} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,width:"100%"}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:C.textMid,fontWeight:600,marginBottom:3}}>Total Days</div>
            <input type="number" value={campaign.totalDays} onChange={e=>updateCampaign({totalDays:Number(e.target.value)})} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,width:"100%"}}/>
          </div>
        </div>
        <div>
          <div style={{fontSize:11,color:C.textMid,fontWeight:600,marginBottom:3}}>Daily Focus</div>
          <input value={campaign.dailyFocus} onChange={e=>updateCampaign({dailyFocus:e.target.value})} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,color:C.text,width:"100%"}}/>
        </div>
      </div>

      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>Income Targets</div>
      <div style={{border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",background:"white",marginBottom:6}}>
        {campaign.targets.map((t,i)=><div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderTop:i>0?`1px solid ${C.border}`:"none"}}>
          <input type="checkbox" checked={t.done} onChange={e=>updateTarget(t.id,{done:e.target.checked})} style={{width:17,height:17,cursor:"pointer",flexShrink:0}}/>
          <input value={t.category} onChange={e=>updateTarget(t.id,{category:e.target.value})} placeholder="Category" style={{flex:"1 1 160px",padding:"4px 7px",borderRadius:5,border:`1px solid ${C.border}`,fontSize:12,color:C.text,fontWeight:600}}/>
          <input value={t.goalValue} onChange={e=>updateTarget(t.id,{goalValue:e.target.value})} placeholder="Goal / Value" style={{flex:"2 1 220px",padding:"4px 7px",borderRadius:5,border:`1px solid ${C.border}`,fontSize:12,color:C.textMid}}/>
          <button onClick={()=>removeTarget(t.id)} style={{fontSize:14,color:C.textLight,background:"none",border:"none",cursor:"pointer",flexShrink:0}}>✕</button>
        </div>)}
      </div>
      <button onClick={addTarget} style={{fontSize:12,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textMid,cursor:"pointer",fontWeight:600,marginBottom:18}}>+ Add Target</button>

      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>Weekly Scorecard — Complete Every Friday</div>
      <div style={{overflowX:"auto",border:`1px solid ${C.border}`,borderRadius:10,background:"white",marginBottom:6}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:640}}>
          <thead>
            <tr style={{background:C.navy}}>
              <th style={{padding:"7px 8px",fontSize:11,color:"white",fontWeight:700,textAlign:"left"}}>Week</th>
              <th style={{padding:"7px 8px",fontSize:11,color:"white",fontWeight:700}}>Revenue</th>
              <th style={{padding:"7px 8px",fontSize:11,color:"white",fontWeight:700}}>Life Apps</th>
              <th style={{padding:"7px 8px",fontSize:11,color:"white",fontWeight:700}}>Securities</th>
              <th style={{padding:"7px 8px",fontSize:11,color:"white",fontWeight:700}}>Mortgage</th>
              <th style={{padding:"7px 8px",fontSize:11,color:"white",fontWeight:700,textAlign:"left"}}>Notes</th>
              <th style={{padding:"7px 4px"}}></th>
            </tr>
          </thead>
          <tbody>
            {campaign.weeks.map((w,i)=><tr key={w.id} style={{borderTop:i>0?`1px solid ${C.border}`:"none"}}>
              <td style={{padding:"6px 8px",fontSize:12,fontWeight:700,color:C.text,whiteSpace:"nowrap"}}>Week {w.weekNum}</td>
              <td style={{padding:"6px 6px"}}><div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}><input type="checkbox" checked={w.revenueDone} onChange={e=>updateWeek(w.id,{revenueDone:e.target.checked})} style={{width:15,height:15,cursor:"pointer"}}/><input type="number" value={w.revenueTarget} onChange={e=>updateWeek(w.id,{revenueTarget:Number(e.target.value)})} style={{width:64,padding:"3px 5px",borderRadius:5,border:`1px solid ${C.border}`,fontSize:12}}/></div></td>
              <td style={{padding:"6px 6px"}}><div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}><input type="checkbox" checked={w.lifeAppsDone} onChange={e=>updateWeek(w.id,{lifeAppsDone:e.target.checked})} style={{width:15,height:15,cursor:"pointer"}}/><input type="number" value={w.lifeAppsTarget} onChange={e=>updateWeek(w.id,{lifeAppsTarget:Number(e.target.value)})} style={{width:44,padding:"3px 5px",borderRadius:5,border:`1px solid ${C.border}`,fontSize:12}}/></div></td>
              <td style={{padding:"6px 6px"}}><div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}><input type="checkbox" checked={w.securitiesDone} onChange={e=>updateWeek(w.id,{securitiesDone:e.target.checked})} style={{width:15,height:15,cursor:"pointer"}}/><input type="number" value={w.securitiesTarget} onChange={e=>updateWeek(w.id,{securitiesTarget:Number(e.target.value)})} style={{width:72,padding:"3px 5px",borderRadius:5,border:`1px solid ${C.border}`,fontSize:12}}/></div></td>
              <td style={{padding:"6px 6px"}}><div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}><input type="checkbox" checked={w.mortgageDone} onChange={e=>updateWeek(w.id,{mortgageDone:e.target.checked})} style={{width:15,height:15,cursor:"pointer"}}/><input type="number" value={w.mortgageTarget} onChange={e=>updateWeek(w.id,{mortgageTarget:Number(e.target.value)})} style={{width:64,padding:"3px 5px",borderRadius:5,border:`1px solid ${C.border}`,fontSize:12}}/></div></td>
              <td style={{padding:"6px 6px"}}><input value={w.notes} onChange={e=>updateWeek(w.id,{notes:e.target.value})} placeholder="Notes" style={{width:"100%",padding:"3px 6px",borderRadius:5,border:`1px solid ${C.border}`,fontSize:12}}/></td>
              <td style={{padding:"6px 4px",textAlign:"center"}}><button onClick={()=>removeWeek(w.id)} style={{fontSize:13,color:C.textLight,background:"none",border:"none",cursor:"pointer"}}>✕</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <button onClick={addWeek} style={{fontSize:12,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textMid,cursor:"pointer",fontWeight:600,marginBottom:18}}>+ Add Week</button>

      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>Finish Line</div>
      <div style={{border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",background:"white"}}>
        {campaign.finishLine.map((f,i)=><div key={f.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderTop:i>0?`1px solid ${C.border}`:"none"}}>
          <input type="checkbox" checked={f.done} onChange={e=>updateFinish(f.id,{done:e.target.checked})} style={{width:17,height:17,cursor:"pointer",flexShrink:0}}/>
          <input value={f.label} onChange={e=>updateFinish(f.id,{label:e.target.value})} style={{flex:1,padding:"4px 7px",borderRadius:5,border:`1px solid ${C.border}`,fontSize:12,color:C.text}}/>
          <button onClick={()=>removeFinish(f.id)} style={{fontSize:14,color:C.textLight,background:"none",border:"none",cursor:"pointer",flexShrink:0}}>✕</button>
        </div>)}
      </div>
      <button onClick={addFinish} style={{fontSize:12,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textMid,cursor:"pointer",fontWeight:600,marginTop:6}}>+ Add Goal</button>
    </div>}

    {/* Archived Campaigns — visible any time, even with no active campaign */}
    {(session.role==="admin"||session.role==="superadmin")&&campaignArchive.length>0&&<div style={{marginBottom:24}}>
      <button onClick={()=>setShowArchive(!showArchive)} style={{fontSize:13,fontWeight:700,color:C.text,background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:6,marginBottom:showArchive?10:0}}>
        <span style={{transform:showArchive?"rotate(90deg)":"none",display:"inline-block",fontSize:11}}>▶</span>
        Archived Campaigns ({campaignArchive.length})
      </button>
      {showArchive&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
        {campaignArchive.map(c=>{
          const targetsMet=(c.targets||[]).filter(t=>t.done).length;
          const weeksMet=(c.weeks||[]).filter(w=>w.revenueDone).length;
          const finishMet=(c.finishLine||[]).filter(f=>f.done).length;
          return <div key={c.id} style={{border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",background:C.surface||"#f8fafc"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>Target: ${Number(c.targetIncome||0).toLocaleString()} by {c.deadline}</div>
                <div style={{fontSize:11,color:C.textMid,marginTop:2}}>Archived {new Date(c.archivedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
                <div style={{fontSize:11,color:C.textMid,marginTop:4}}>{targetsMet}/{(c.targets||[]).length} targets hit · {weeksMet}/{(c.weeks||[]).length} weeks on pace · {finishMet}/{(c.finishLine||[]).length} finish line goals met</div>
              </div>
              <button onClick={()=>deleteArchivedCampaign(c.id)} style={{fontSize:11,padding:"3px 8px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textLight,cursor:"pointer",flexShrink:0}}>Delete</button>
            </div>
          </div>;
        })}
      </div>}
    </div>}

    {/* Daily Success Checklist — weekly grid */}
    {(session.role==="admin"||session.role==="superadmin")&&checklistTasks.length>0&&<div style={{marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:14,fontWeight:700,color:C.text}}>Daily Success Checklist</div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={()=>setWeekOffset(w=>w-1)} style={{padding:"3px 9px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:14,color:C.textMid}}>‹</button>
          <span style={{fontSize:12,color:C.textMid,whiteSpace:"nowrap",fontWeight:600}}>{weekLabel}</span>
          <button onClick={()=>setWeekOffset(w=>w+1)} style={{padding:"3px 9px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:14,color:C.textMid}}>›</button>
          {weekOffset!==0&&<button onClick={()=>setWeekOffset(0)} style={{fontSize:11,padding:"4px 8px",borderRadius:6,border:"none",background:C.teal+"15",color:C.teal,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>This Week</button>}
        </div>
      </div>
      <div style={{overflowX:"auto",border:`1px solid ${C.border}`,borderRadius:10,background:"white"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:460}}>
          <thead>
            <tr style={{background:C.navy}}>
              <th style={{textAlign:"left",padding:"8px 10px",fontSize:12,color:"white",fontWeight:700,minWidth:160}}>Action</th>
              {weekDates.map(wd=><th key={wd.dateStr} style={{padding:"8px 4px",fontSize:11,color:"white",fontWeight:700,textAlign:"center",minWidth:46}}>{wd.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {CHECKLIST_CATEGORY_ORDER.filter(cat=>groupedChecklist[cat]?.length).map(cat=>
              <Fragment key={cat}>
                <tr><td colSpan={weekDates.length+1} style={{padding:"5px 10px",fontSize:12,fontWeight:700,color:C.teal,background:C.teal+"0d"}}>{cat}</td></tr>
                {groupedChecklist[cat].map(t=><tr key={t.id} style={{borderTop:`1px solid ${C.border}`}}>
                  <td style={{padding:"6px 10px",fontSize:13,color:C.text}}>
                    {editingItemId===t.id?
                      <div style={{display:"flex",gap:4,alignItems:"center"}}>
                        <input autoFocus value={editingItemDraft} onChange={e=>setEditingItemDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveEditItem();if(e.key==="Escape")setEditingItemId(null);}} style={{flex:1,padding:"3px 6px",borderRadius:5,border:`1px solid ${C.teal}`,fontSize:13,color:C.text,minWidth:120}}/>
                        <button onClick={saveEditItem} style={{fontSize:11,padding:"3px 7px",borderRadius:5,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>Save</button>
                      </div>
                      :
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span>{t.title}</span>
                        <button onClick={()=>startEditItem(t)} title="Edit" style={{fontSize:11,padding:"1px 5px",borderRadius:4,border:"none",background:"transparent",color:C.textLight,cursor:"pointer"}}>✎</button>
                      </div>
                    }
                  </td>
                  {weekDates.map(wd=>{
                    const isScheduled=(t.days||[]).includes(wd.dateObj.getDay());
                    const done=!!(t.completedDays||{})[wd.dateStr];
                    return <td key={wd.dateStr} style={{textAlign:"center",padding:"6px 4px"}}>
                      {isScheduled?<input type="checkbox" checked={done} onChange={()=>toggleDayComplete(t.id,wd.dateStr)} style={{width:17,height:17,cursor:"pointer"}}/>:<span style={{color:C.textLight,fontSize:12}}>—</span>}
                    </td>;
                  })}
                </tr>)}
              </Fragment>
            )}
          </tbody>
        </table>
      </div>
    </div>}

    {/* Task Form */}
    {showForm&&<div style={{background:"white",borderRadius:12,border:"1px solid "+C.teal+"44",padding:"16px",marginBottom:14}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>{editId?"Edit Task":"New Task"}</div>

      <input placeholder="Task title..." value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:14,color:C.text,marginBottom:8,boxSizing:"border-box"}}/>

      <textarea placeholder="Description or notes (optional)..." value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:13,color:C.text,resize:"vertical",minHeight:60,boxSizing:"border-box",lineHeight:1.5,marginBottom:8}}/>

      {/* Sub-tasks */}
      <div style={{marginBottom:8}}>
        <div style={{fontSize:13,color:C.textMid,marginBottom:4}}>Sub-tasks (optional)</div>
        {form.subtasks.map((s,i)=><div key={s.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
          <span style={{fontSize:13,color:C.text,flex:1,background:C.surface,padding:"4px 8px",borderRadius:6}}>• {s.text}</span>
          <button onClick={()=>setForm(f=>({...f,subtasks:f.subtasks.filter((_,j)=>j!==i)}))} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:14}}>×</button>
        </div>)}
        <div style={{display:"flex",gap:6}}>
          <input placeholder="Add sub-task..." value={form.newSubtask} onChange={e=>setForm(f=>({...f,newSubtask:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addSubtask()} style={{flex:1,padding:"6px 9px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text}}/>
          <button onClick={addSubtask} style={{padding:"6px 10px",borderRadius:7,border:"none",background:C.teal+"22",color:C.teal,cursor:"pointer",fontSize:13,fontWeight:600}}>Add</button>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <div>
          <div style={{fontSize:12,color:C.textMid,marginBottom:3}}>Start Date</div>
          <input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
        </div>
        <div>
          <div style={{fontSize:12,color:C.textMid,marginBottom:3}}>End Date (optional)</div>
          <input type="date" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <div>
          <div style={{fontSize:12,color:C.textMid,marginBottom:3}}>Priority</div>
          <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text}}>
            {TASK_PRIORITIES.map(p=><option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <div style={{fontSize:12,color:C.textMid,marginBottom:3}}>Category</div>
          <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:13,color:C.text}}>
            {TASK_CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Recurring */}
      <div style={{marginBottom:10}}>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:8}}>
          <input type="checkbox" checked={form.recurring} onChange={e=>setForm(f=>({...f,recurring:e.target.checked}))} style={{width:16,height:16}}/>
          <span style={{fontSize:13,color:C.text,fontWeight:600}}>Recurring task</span>
        </label>
        {form.recurring&&<div>
          <div style={{fontSize:12,color:C.textMid,marginBottom:4}}>Repeat on these days:</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {TASK_DAYS.map((d,i)=><button key={i} onClick={()=>setForm(f=>({...f,days:f.days.includes(i)?f.days.filter(x=>x!==i):[...f.days,i]}))} style={{padding:"5px 9px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:form.days.includes(i)?700:400,background:form.days.includes(i)?C.teal:C.surface,color:form.days.includes(i)?"white":C.textMid,fontSize:13}}>{d}</button>)}
          </div>
          <div style={{display:"flex",gap:6,marginTop:6}}>
            <button onClick={()=>setForm(f=>({...f,days:[1,2,3,4,5]}))} style={{fontSize:12,padding:"3px 8px",borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>Weekdays</button>
            <button onClick={()=>setForm(f=>({...f,days:[0,1,2,3,4,5,6]}))} style={{fontSize:12,padding:"3px 8px",borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>Every Day</button>
            <button onClick={()=>setForm(f=>({...f,days:[0,6]}))} style={{fontSize:12,padding:"3px 8px",borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>Weekends</button>
          </div>
        </div>}
      </div>

      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>{setShowForm(false);setEditId(null);resetForm();}} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
        <button onClick={saveTask} style={{flex:2,padding:"8px",borderRadius:8,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>Save Task</button>
      </div>
    </div>}

    {/* Task List — everything besides the Daily Success Checklist items shown in the grid above */}
    {otherTasks.length===0&&!showForm&&<div style={{textAlign:"center",padding:"40px 0",color:C.textLight}}>
      <div style={{fontSize:28,marginBottom:8}}>✓</div>
      <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:4}}>No other tasks yet</div>
      <div style={{fontSize:13}}>Add your first task or recurring goal above</div>
    </div>}

    {[...otherTasks].sort((a,b)=>{
      const po={High:0,Medium:1,Low:2};
      return (po[a.priority]||1)-(po[b.priority]||1);
    }).map((task,i)=>{
      const daysLeft = getDaysLeft(task.dueDate);
      const streak = getStreak(task);
      const todayActive = isTodayActive(task);
      const completedToday = !!(task.completedDays||{})[today];
      const totalDays = task.dueDate&&task.startDate?Math.ceil((new Date(task.dueDate+"T12:00:00")-new Date(task.startDate+"T12:00:00"))/86400000):null;
      const daysCompleted = Object.values(task.completedDays||{}).filter(Boolean).length;
      const pct = totalDays?Math.min(Math.round((daysCompleted/totalDays)*100),100):null;

      return <div key={task.id} style={{borderRadius:12,border:"2px solid "+(PRIORITY_COLORS[task.priority]||C.gold)+"33",background:"white",marginBottom:10,overflow:"hidden"}}>
        {/* Header */}
        <div style={{padding:"10px 14px",borderBottom:"1px solid "+C.border}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}>
                <span style={{fontSize:14,fontWeight:700,color:C.text}}>{task.title}</span>
                <Badge color={PRIORITY_COLORS[task.priority]||C.gold} small>{task.priority}</Badge>
                <Badge color={C.teal} small>{task.category}</Badge>
                {task.recurring&&<Badge color={C.purple} small>Recurring</Badge>}
              </div>
              {task.description&&<div style={{fontSize:13,color:C.textMid,lineHeight:1.5,marginBottom:4}}>{task.description}</div>}
              {task.recurring&&task.days&&<div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                {TASK_DAYS.map((d,di)=><span key={di} style={{fontSize:10,padding:"1px 5px",borderRadius:4,background:task.days.includes(di)?C.teal+"22":C.surface,color:task.days.includes(di)?C.teal:C.textLight,fontWeight:task.days.includes(di)?600:400}}>{d}</span>)}
              </div>}
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              <button onClick={()=>editTask(task)} style={{fontSize:12,padding:"3px 7px",borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>Edit</button>
              <button onClick={()=>deleteTask(task.id)} style={{fontSize:12,padding:"3px 7px",borderRadius:5,border:"1px solid "+C.danger+"33",background:C.danger+"11",cursor:"pointer",color:C.danger}}>Delete</button>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:6,flexWrap:"wrap"}}>
            {daysLeft!==null&&<span style={{fontSize:12,color:daysLeft<=3?C.danger:daysLeft<=7?C.gold:C.textLight}}>{daysLeft<=0?"Ended":daysLeft+"d left"}</span>}
            {streak>0&&<span style={{fontSize:12,color:C.gold,fontWeight:600}}>🔥 {streak} day streak</span>}
            {pct!==null&&<span style={{fontSize:12,color:C.teal}}>{daysCompleted}/{totalDays} days done ({pct}%)</span>}
          </div>
          {pct!==null&&<Bar pct={pct} color={pct>=100?C.success:C.teal} h={4} style={{marginTop:4}}/>}
        </div>

        {/* Sub-tasks */}
        {task.subtasks&&task.subtasks.length>0&&<div style={{padding:"8px 14px",borderBottom:"1px solid "+C.border}}>
          {task.subtasks.map((s,si)=><div key={s.id} style={{fontSize:13,color:C.textMid,padding:"3px 0"}}>• {s.text}</div>)}
        </div>}

        {/* Today's completion */}
        {todayActive&&<div style={{padding:"10px 14px",background:completedToday?C.success+"08":C.surface}}>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
            <input type="checkbox" checked={completedToday} onChange={()=>toggleDayComplete(task.id,today)} style={{width:18,height:18,cursor:"pointer"}}/>
            <span style={{fontSize:13,fontWeight:600,color:completedToday?C.success:C.text}}>{completedToday?"Completed today!":"Mark today as done"}</span>
          </label>
        </div>}
        {!todayActive&&<div style={{padding:"8px 14px",background:C.surface}}>
          <span style={{fontSize:13,color:C.textLight}}>Not scheduled for today</span>
        </div>}
      </div>;
    })}
  </div>;
}

// ── CAREER PATH ──
function CareerPath({rep,data,onUpdate}) {
  const stages = [
    {key:"new",label:"New Rep",color:C.teal},
    {key:"licensed",label:"Licensed Agent",color:C.gold},
    {key:"trainer",label:"Field Trainer",color:C.purple},
  ];
  const currentStage = rep.fieldTrainerGranted?"trainer":rep.track==="licensed"?"licensed":"new";
  const ftRequested = rep.fieldTrainerRequested&&!rep.fieldTrainerGranted;
  const rvpRequested = rep.rvpPathRequested&&!rep.rvpPathGranted;

  return <div>
    {/* Roadmap */}
    <div style={{background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",borderRadius:12,padding:"16px",marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.teal,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:12}}>Your Career Journey</div>
      <div style={{display:"flex",gap:0}}>
        {stages.map((s,i)=>{
          const active=s.key===currentStage;
          const stageIndex=stages.findIndex(st=>st.key===currentStage);
          const done=i<stageIndex;
          return <div key={s.key} style={{flex:1,textAlign:"center",position:"relative"}}>
            {i>0&&<div style={{position:"absolute",top:14,left:0,right:"50%",height:2,background:done||active?s.color:"rgba(255,255,255,0.1)"}}/>}
            {i<stages.length-1&&<div style={{position:"absolute",top:14,left:"50%",right:0,height:2,background:done?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.1)"}}/>}
            <div style={{width:28,height:28,borderRadius:14,background:active?s.color:done?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.05)",border:"2px solid "+(active?s.color:done?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.1)"),margin:"0 auto 6px",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:1}}>
              {done&&<svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
              {active&&<div style={{width:10,height:10,borderRadius:5,background:"white"}}/>}
            </div>
            <div style={{fontSize:10,fontWeight:active?700:400,color:active?"white":"rgba(255,255,255,0.4)",lineHeight:1.2}}>{s.label}</div>
          </div>;
        })}
      </div>
    </div>

    {/* ── NEW REP: Goal is to get Life Licensed ── */}
    {currentStage==="new"&&<div>
      <div style={{background:C.teal+"11",border:"1px solid "+C.teal+"33",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:700,color:C.teal,marginBottom:6}}>Your Next Goal: Become Life Licensed</div>
        <div style={{fontSize:13,color:C.text,lineHeight:1.7}}>Getting your life insurance license is your first major milestone. Focus on completing your checklist, finishing your pre-licensing class, and passing your exam. Once you are licensed a whole new path opens up!</div>
      </div>
      <div style={{background:C.navy+"11",border:"1px solid "+C.border,borderRadius:8,padding:"10px 12px",fontSize:13,color:C.textMid,textAlign:"center",lineHeight:1.5}}>
        Field Trainer and RVP paths unlock after you get licensed. Stay focused — every step brings you closer!
      </div>
    </div>}

    {/* ── LICENSED AGENT: Goal is Field Trainer ── */}
    {currentStage==="licensed"&&<div>
      <div style={{background:C.gold+"11",border:"1px solid "+C.gold+"33",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:700,color:C.gold,marginBottom:6}}>Your Next Goal: Become a Field Trainer</div>
        <div style={{fontSize:13,color:C.text,lineHeight:1.7}}>You are licensed — that is a huge achievement! Now the focus shifts to building your skills, your production, and your team. When you feel ready and meet all the Field Trainer requirements, request your review below.</div>
      </div>
      <Card style={{border:"1px solid "+(ftRequested?C.gold+"44":C.purple+"33")}}>
        <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>Ready for Field Trainer Review?</div>
        <div style={{fontSize:13,color:C.textMid,marginBottom:10,lineHeight:1.5}}>When you feel confident you meet all the requirements, request a review. Your RVP will be notified and will schedule time to go through everything with you.</div>
        {!ftRequested&&!rep.fieldTrainerDenied&&<button onClick={()=>onUpdate(rep.id,{...rep,fieldTrainerRequested:true,fieldTrainerDenied:false,fieldTrainerRequestedAt:new Date().toISOString()})}
          style={{width:"100%",padding:"10px",borderRadius:9,background:"linear-gradient(135deg,"+C.purple+",#7c3aed)",color:"white",border:"none",fontWeight:700,fontSize:14,cursor:"pointer"}}>
          Request Field Trainer Review
        </button>}
        {ftRequested&&<div style={{background:C.gold+"11",border:"1px solid "+C.gold+"33",borderRadius:8,padding:"10px 12px",textAlign:"center",fontSize:13,color:C.gold,fontWeight:600}}>Review requested! Your RVP has been notified. Keep pushing forward!</div>}
        {rep.fieldTrainerDenied&&!ftRequested&&<div>
          <div style={{background:C.danger+"11",border:"1px solid "+C.danger+"33",borderRadius:8,padding:"8px 12px",fontSize:13,color:C.danger,marginBottom:8,textAlign:"center"}}>Request was not approved — speak with your trainer for next steps</div>
          <button onClick={()=>onUpdate(rep.id,{...rep,fieldTrainerRequested:true,fieldTrainerDenied:false,fieldTrainerRequestedAt:new Date().toISOString()})} style={{width:"100%",padding:"10px",borderRadius:9,background:"linear-gradient(135deg,"+C.purple+",#7c3aed)",color:"white",border:"none",fontWeight:700,fontSize:14,cursor:"pointer"}}>Request Again</button>
        </div>}
      </Card>
    </div>}

    {/* ── FIELD TRAINER: Goal is RVP ── */}
    {currentStage==="trainer"&&<div>
      <div style={{background:C.success+"11",border:"1px solid "+C.success+"33",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:700,color:C.success,marginBottom:4}}>Field Trainer Approved!</div>
        <div style={{fontSize:13,color:C.textMid}}>Congratulations! You are now a Field Trainer. Your next and final goal is Regional Vice President.</div>
      </div>
      <Card style={{marginBottom:14,border:"1px solid "+(rvpRequested?C.gold+"44":C.success+"33")}}>
        <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>Ready for the RVP Path?</div>
        <div style={{fontSize:13,color:C.textMid,marginBottom:10,lineHeight:1.5}}>The RVP Path is the final stage of your career journey. When you are consistently producing as a Field Trainer and ready to build a region, request access to the full RVP checklist.</div>
        {!rvpRequested&&!rep.rvpPathDenied&&<button onClick={()=>onUpdate(rep.id,{...rep,rvpPathRequested:true,rvpPathDenied:false,rvpPathRequestedAt:new Date().toISOString()})}
          style={{width:"100%",padding:"10px",borderRadius:9,background:"linear-gradient(135deg,"+C.success+",#059669)",color:"white",border:"none",fontWeight:700,fontSize:14,cursor:"pointer"}}>
          Request RVP Path Access
        </button>}
        {rvpRequested&&<div style={{background:C.gold+"11",border:"1px solid "+C.gold+"33",borderRadius:8,padding:"10px 12px",textAlign:"center",fontSize:13,color:C.gold,fontWeight:600}}>RVP Path request sent! Your admin will review and grant access when ready.</div>}
        {rep.rvpPathDenied&&!rvpRequested&&<div>
          <div style={{background:C.danger+"11",border:"1px solid "+C.danger+"33",borderRadius:8,padding:"8px 12px",fontSize:13,color:C.danger,marginBottom:8,textAlign:"center"}}>Request was not approved — speak with your trainer for next steps</div>
          <button onClick={()=>onUpdate(rep.id,{...rep,rvpPathRequested:true,rvpPathDenied:false,rvpPathRequestedAt:new Date().toISOString()})} style={{width:"100%",padding:"10px",borderRadius:9,background:"linear-gradient(135deg,"+C.success+",#059669)",color:"white",border:"none",fontWeight:700,fontSize:14,cursor:"pointer"}}>Request Again</button>
        </div>}
      </Card>
    </div>}

    {/* ── RVP PATH GRANTED: Show full checklist ── */}
    {currentStage==="rvp"&&<div>
      <div style={{background:C.success+"11",border:"1px solid "+C.success+"33",borderRadius:10,padding:"12px 14px",marginBottom:14,textAlign:"center"}}>
        <div style={{fontSize:14,fontWeight:700,color:C.success,marginBottom:4}}>RVP Path Unlocked!</div>
        <div style={{fontSize:13,color:C.textMid}}>You are on your way to Regional Vice President! Complete every item below.</div>
      </div>
      {Object.entries(getChecklistItems(data,"rvpChecklist").reduce((a,i)=>{if(!a[i.cat])a[i.cat]=[];a[i.cat].push(i);return a;},{})).map(([cat,items])=><div key={cat}><SecHead title={cat} color={C.gold}/>{items.map(item=><CheckItem key={item.id} item={item} checked={!!(rep.rvpChecked||{})[item.id]} onToggle={()=>onUpdate(rep.id,{...rep,rvpChecked:{...(rep.rvpChecked||{}),[item.id]:!(rep.rvpChecked||{})[item.id]}})} readOnly={false}/>)}</div>)}
    </div>}
  </div>;
}

// ── SCRIPTS PAGE (editable by admins) ──
// ── CHECKLIST EDITOR (admin only) — add/edit/delete/rename/reorder categories and items
// across all 6 checklists. Deleting/renaming/reordering never touches anyone's already-
// checked progress, since that's tracked by item id, not by position or category name.
function moveItemInCategory(items,itemId,direction){
  const item=items.find(i=>i.id===itemId);
  if(!item) return items;
  const cat=item.cat||"Uncategorized";
  const catItems=items.filter(i=>(i.cat||"Uncategorized")===cat);
  const idx=catItems.findIndex(i=>i.id===itemId);
  const swapIdx=idx+direction;
  if(swapIdx<0||swapIdx>=catItems.length) return items;
  const other=catItems[swapIdx];
  const newItems=[...items];
  const i1=newItems.findIndex(i=>i.id===item.id);
  const i2=newItems.findIndex(i=>i.id===other.id);
  [newItems[i1],newItems[i2]]=[newItems[i2],newItems[i1]];
  return newItems;
}
function moveCategoryBlock(items,catName,direction){
  const order=[]; items.forEach(i=>{const c=i.cat||"Uncategorized"; if(!order.includes(c)) order.push(c);});
  const idx=order.indexOf(catName);
  const swapIdx=idx+direction;
  if(swapIdx<0||swapIdx>=order.length) return items;
  const newOrder=[...order];
  [newOrder[idx],newOrder[swapIdx]]=[newOrder[swapIdx],newOrder[idx]];
  const grouped={}; items.forEach(i=>{const c=i.cat||"Uncategorized"; if(!grouped[c])grouped[c]=[]; grouped[c].push(i);});
  return newOrder.flatMap(c=>grouped[c]||[]);
}

// ── COMMITMENT CATEGORY EDITOR (admin only) — rename any category, add/delete manual ones.
// Auto-calculated categories (Recruits, Life Apps, Premium, PAC/Lump Investment, Links
// Shared) can be renamed but never deleted, since Team Numbers and the Coaching Report are
// wired directly to those specific keys.
const MANUAL_CAT_ICONS=["📱","📞","📅","✅","💰","🎯","📋","☎️","💬","🗓️"];
function CommitmentCategoryEditor({data,onUpdate}) {
  const cats=getEffectiveCommitmentCategories(data);
  const [renamingKey,setRenamingKey]=useState(null);
  const [renameVal,setRenameVal]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [newCatName,setNewCatName]=useState("");

  const startRename=(cat)=>{ setRenamingKey(cat.key); setRenameVal(cat.label); };
  const saveRename=(key)=>{
    if(!renameVal.trim()) return;
    onUpdate({...data,commitmentCategoryOverrides:{...(data.commitmentCategoryOverrides||{}),[key]:{label:renameVal.trim()}}});
    setRenamingKey(null);
  };
  const deleteCat=(cat)=>{
    if(!cat.manual) return; // protected, button is disabled but double-guard here too
    if(!window.confirm(`Delete "${cat.label}"? Reps will no longer see this in Today's Commitment.`)) return;
    onUpdate({...data,deletedCommitmentCategories:[...(data.deletedCommitmentCategories||[]),cat.key]});
  };
  const addCat=()=>{
    if(!newCatName.trim()) return;
    const key="custom_"+newCatName.trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").slice(0,24)+"_"+Date.now();
    const icon=MANUAL_CAT_ICONS[(data.customCommitmentCategories||[]).length%MANUAL_CAT_ICONS.length];
    const newCat={key,label:newCatName.trim(),icon,manual:true};
    onUpdate({...data,customCommitmentCategories:[...(data.customCommitmentCategories||[]),newCat]});
    setNewCatName("");
    setShowAdd(false);
  };

  const manualCats=cats.filter(c=>c.manual);
  const autoCats=cats.filter(c=>!c.manual);

  const renderRow=(cat)=><div key={cat.key} style={{display:"flex",alignItems:"center",gap:8,padding:"11px 14px",border:`1px solid ${C.border}`,borderRadius:9,marginBottom:8}}>
    <span style={{fontSize:16}}>{cat.icon}</span>
    <div style={{fontSize:14,fontWeight:700,color:C.text,flex:1}}>{cat.label}</div>
    {!cat.manual&&<span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:5,background:C.gold+"1f",color:C.gold}}>AUTO</span>}
    <button onClick={()=>startRename(cat)} style={{fontSize:11,padding:"5px 9px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textMid,cursor:"pointer"}}>Rename</button>
    <button onClick={()=>deleteCat(cat)} disabled={!cat.manual} style={{fontSize:11,padding:"5px 9px",borderRadius:6,border:`1px solid ${cat.manual?C.danger+"44":C.border}`,background:cat.manual?C.danger+"11":C.surface,color:cat.manual?C.danger:C.textLight,cursor:cat.manual?"pointer":"not-allowed",opacity:cat.manual?1:0.5}}>✕</button>
  </div>;

  return <div>
    <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:4}}>Manage Commitment Categories</div>
    <div style={{fontSize:13,color:C.textMid,marginBottom:16}}>Admins only. Renaming never affects anyone's already-logged numbers. Deleting a manual category removes it going forward.</div>

    {!showAdd?
      <button onClick={()=>setShowAdd(true)} style={{width:"100%",padding:"9px",borderRadius:8,border:`2px dashed ${C.border}`,background:"white",color:C.textMid,fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:16}}>+ Add Category</button>
      :
      <div style={{border:`1px solid ${C.teal}44`,borderRadius:8,padding:10,marginBottom:16,display:"flex",gap:6}}>
        <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="New category name..." onKeyDown={e=>e.key==="Enter"&&addCat()} style={{flex:1,padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13}}/>
        <button onClick={addCat} style={{padding:"6px 14px",borderRadius:6,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Add</button>
        <button onClick={()=>{setShowAdd(false);setNewCatName("");}} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textMid,cursor:"pointer",fontSize:13}}>Cancel</button>
      </div>
    }

    <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:"uppercase",letterSpacing:"0.5px",margin:"16px 0 8px"}}>Manual (self-reported, rename or delete freely)</div>
    {manualCats.map(cat=>renamingKey===cat.key?
      <div key={cat.key} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",border:`1px solid ${C.teal}`,borderRadius:9,marginBottom:8,background:C.teal+"0d"}}>
        <span style={{fontSize:16}}>{cat.icon}</span>
        <input value={renameVal} onChange={e=>setRenameVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveRename(cat.key)} style={{flex:1,padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13}}/>
        <button onClick={()=>saveRename(cat.key)} style={{padding:"6px 12px",borderRadius:6,border:"none",background:C.teal,color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>Save</button>
        <button onClick={()=>setRenamingKey(null)} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textMid,fontSize:12,cursor:"pointer"}}>Cancel</button>
      </div>
      :renderRow(cat)
    )}

    <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:"uppercase",letterSpacing:"0.5px",margin:"16px 0 8px"}}>Auto-Calculated (pulled from other data — rename label only)</div>
    {autoCats.map(cat=>renamingKey===cat.key?
      <div key={cat.key} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",border:`1px solid ${C.teal}`,borderRadius:9,marginBottom:8,background:C.teal+"0d"}}>
        <span style={{fontSize:16}}>{cat.icon}</span>
        <input value={renameVal} onChange={e=>setRenameVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveRename(cat.key)} style={{flex:1,padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13}}/>
        <button onClick={()=>saveRename(cat.key)} style={{padding:"6px 12px",borderRadius:6,border:"none",background:C.teal,color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>Save</button>
        <button onClick={()=>setRenamingKey(null)} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textMid,fontSize:12,cursor:"pointer"}}>Cancel</button>
      </div>
      :renderRow(cat)
    )}
  </div>;
}

function ChecklistEditor({data,onUpdate}) {
  const [activeKey,setActiveKey]=useState("fastStart");
  const [editingItem,setEditingItem]=useState(null); // {id, task, note, link, linkLabel}
  const [renamingCat,setRenamingCat]=useState(null); // old category name being renamed
  const [renameVal,setRenameVal]=useState("");
  const [addingCatItem,setAddingCatItem]=useState(false);
  const [newCatName,setNewCatName]=useState("");
  const [addingToCat,setAddingToCat]=useState(null); // category name currently adding an item to
  const [newItemDraft,setNewItemDraft]=useState({task:"",note:"",link:"",linkLabel:""});

  const items=getChecklistItems(data,activeKey);
  const grouped=getGroupedChecklist(data,activeKey);

  const saveItems=(newItems)=>{
    onUpdate({...data,checklists:{...(data.checklists||{}),[activeKey]:{items:newItems}}});
  };

  const startEdit=(item)=>{ setEditingItem({...item}); };
  const saveEdit=()=>{
    if(!editingItem.task?.trim()) return;
    saveItems(items.map(i=>i.id===editingItem.id?{...editingItem,task:editingItem.task.trim()}:i));
    setEditingItem(null);
  };
  const deleteItem=(id)=>{
    if(!window.confirm("Delete this checkbox for everyone? This can't be undone.")) return;
    saveItems(items.filter(i=>i.id!==id));
  };
  const addItemToCat=(cat)=>{
    if(!newItemDraft.task.trim()) return;
    const newItem={id:"custom_"+Date.now(),cat,task:newItemDraft.task.trim(),note:newItemDraft.note.trim()||undefined,link:newItemDraft.link.trim()||undefined,linkLabel:newItemDraft.linkLabel.trim()||undefined};
    saveItems([...items,newItem]);
    setNewItemDraft({task:"",note:"",link:"",linkLabel:""});
    setAddingToCat(null);
  };
  const addCategory=()=>{
    if(!newCatName.trim()) return;
    const newItem={id:"custom_"+Date.now(),cat:newCatName.trim(),task:"New checkbox — tap Edit to customize"};
    saveItems([...items,newItem]);
    setNewCatName("");
    setAddingCatItem(false);
  };
  const renameCategory=(oldName)=>{
    if(!renameVal.trim()) return;
    saveItems(items.map(i=>(i.cat||"Uncategorized")===oldName?{...i,cat:renameVal.trim()}:i));
    setRenamingCat(null);
    setRenameVal("");
  };
  const deleteCategory=(catName)=>{
    if(!window.confirm(`Delete "${catName}"? Checkboxes inside it will move to Uncategorized, not be deleted.`)) return;
    saveItems(items.map(i=>(i.cat||"Uncategorized")===catName?{...i,cat:"Uncategorized"}:i));
  };

  return <div>
    <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:4}}>Checklist Editor</div>
    <div style={{fontSize:13,color:C.textMid,marginBottom:14}}>Admins only. Renaming or reordering never affects reps' existing checked progress. Deleting a checkbox removes it for everyone going forward.</div>

    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
      {Object.keys(CHECKLIST_LABELS).map(key=><button key={key} onClick={()=>setActiveKey(key)} style={{fontSize:12,padding:"7px 12px",borderRadius:8,border:`1px solid ${activeKey===key?C.teal:C.border}`,background:activeKey===key?C.teal+"11":"white",color:activeKey===key?C.teal:C.textMid,cursor:"pointer",fontWeight:600}}>{CHECKLIST_LABELS[key]}</button>)}
    </div>

    {!addingCatItem?
      <button onClick={()=>setAddingCatItem(true)} style={{width:"100%",padding:"9px",borderRadius:8,border:`2px dashed ${C.border}`,background:"white",color:C.textMid,fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:16}}>+ Add Category</button>
      :
      <div style={{border:`1px solid ${C.teal}44`,borderRadius:8,padding:10,marginBottom:16,display:"flex",gap:6}}>
        <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="New category name..." onKeyDown={e=>e.key==="Enter"&&addCategory()} style={{flex:1,padding:"6px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13}}/>
        <button onClick={addCategory} style={{padding:"6px 14px",borderRadius:6,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Add</button>
        <button onClick={()=>{setAddingCatItem(false);setNewCatName("");}} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textMid,cursor:"pointer",fontSize:13}}>Cancel</button>
      </div>
    }

    {grouped.map(({cat,items:catItems},ci)=><div key={cat} style={{border:`1px solid ${C.border}`,borderRadius:10,marginBottom:14,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:C.surface,borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",flexDirection:"column",gap:1}}>
          <button onClick={()=>saveItems(moveCategoryBlock(items,cat,-1))} disabled={ci===0} style={{width:20,height:16,border:`1px solid ${C.border}`,background:"white",color:C.textLight,fontSize:9,cursor:ci===0?"default":"pointer",borderRadius:3,opacity:ci===0?0.4:1}}>▲</button>
          <button onClick={()=>saveItems(moveCategoryBlock(items,cat,1))} disabled={ci===grouped.length-1} style={{width:20,height:16,border:`1px solid ${C.border}`,background:"white",color:C.textLight,fontSize:9,cursor:ci===grouped.length-1?"default":"pointer",borderRadius:3,opacity:ci===grouped.length-1?0.4:1}}>▼</button>
        </div>
        {renamingCat===cat?
          <div style={{flex:1,display:"flex",gap:5}}>
            <input value={renameVal} onChange={e=>setRenameVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&renameCategory(cat)} style={{flex:1,padding:"4px 8px",borderRadius:6,border:`1px solid ${C.teal}`,fontSize:13}}/>
            <button onClick={()=>renameCategory(cat)} style={{fontSize:11,padding:"4px 8px",borderRadius:6,border:"none",background:C.teal,color:"white",cursor:"pointer"}}>Save</button>
            <button onClick={()=>setRenamingCat(null)} style={{fontSize:11,padding:"4px 8px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textMid,cursor:"pointer"}}>Cancel</button>
          </div>
          :<>
            <div style={{fontSize:14,fontWeight:700,color:C.text,flex:1}}>{cat}</div>
            <button onClick={()=>{setRenamingCat(cat);setRenameVal(cat);}} style={{fontSize:11,padding:"4px 8px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textMid,cursor:"pointer"}}>Rename</button>
            <button onClick={()=>deleteCategory(cat)} style={{fontSize:11,padding:"4px 8px",borderRadius:6,border:`1px solid ${C.danger}44`,background:C.danger+"11",color:C.danger,cursor:"pointer"}}>Delete Category</button>
          </>}
      </div>

      {catItems.map((item,ii)=><div key={item.id}>
        <div style={{display:"flex",alignItems:"flex-start",gap:8,padding:"10px 14px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",flexDirection:"column",gap:1,marginTop:2}}>
            <button onClick={()=>saveItems(moveItemInCategory(items,item.id,-1))} disabled={ii===0} style={{width:20,height:16,border:`1px solid ${C.border}`,background:"white",color:C.textLight,fontSize:9,cursor:ii===0?"default":"pointer",borderRadius:3,opacity:ii===0?0.4:1}}>▲</button>
            <button onClick={()=>saveItems(moveItemInCategory(items,item.id,1))} disabled={ii===catItems.length-1} style={{width:20,height:16,border:`1px solid ${C.border}`,background:"white",color:C.textLight,fontSize:9,cursor:ii===catItems.length-1?"default":"pointer",borderRadius:3,opacity:ii===catItems.length-1?0.4:1}}>▼</button>
          </div>
          <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${C.border}`,flexShrink:0,marginTop:2}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:C.text}}>{item.task}</div>
            {item.note&&<div style={{fontSize:11,color:C.textLight,marginTop:2}}>{item.note}</div>}
            {item.link&&<div style={{fontSize:11,color:C.teal,marginTop:2}}>🔗 {item.linkLabel||"Link"}</div>}
          </div>
          <div style={{display:"flex",gap:5,flexShrink:0}}>
            <button onClick={()=>startEdit(item)} style={{width:26,height:26,borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textMid,fontSize:11,cursor:"pointer"}}>Edit</button>
            <button onClick={()=>deleteItem(item.id)} style={{width:26,height:26,borderRadius:6,border:`1px solid ${C.danger}44`,background:C.danger+"11",color:C.danger,fontSize:11,cursor:"pointer"}}>✕</button>
          </div>
        </div>
        {editingItem?.id===item.id&&<div style={{background:C.surface,borderRadius:8,padding:"10px 12px",margin:"0 14px 10px",border:`1px solid ${C.teal}44`}}>
          <div style={{fontSize:10,fontWeight:700,color:C.textMid,marginBottom:3}}>Task</div>
          <input value={editingItem.task} onChange={e=>setEditingItem({...editingItem,task:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,marginBottom:8,boxSizing:"border-box"}}/>
          <div style={{fontSize:10,fontWeight:700,color:C.textMid,marginBottom:3}}>Note (optional)</div>
          <input value={editingItem.note||""} onChange={e=>setEditingItem({...editingItem,note:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,marginBottom:8,boxSizing:"border-box"}}/>
          <div style={{fontSize:10,fontWeight:700,color:C.textMid,marginBottom:3}}>Link Label (optional)</div>
          <input value={editingItem.linkLabel||""} onChange={e=>setEditingItem({...editingItem,linkLabel:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,marginBottom:8,boxSizing:"border-box"}}/>
          <div style={{fontSize:10,fontWeight:700,color:C.textMid,marginBottom:3}}>Link URL (optional)</div>
          <input value={editingItem.link||""} onChange={e=>setEditingItem({...editingItem,link:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,marginBottom:8,boxSizing:"border-box"}}/>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setEditingItem(null)} style={{flex:1,padding:"6px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textMid,cursor:"pointer",fontSize:12}}>Cancel</button>
            <button onClick={saveEdit} style={{flex:2,padding:"6px",borderRadius:6,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:12,fontWeight:600}}>Save Changes</button>
          </div>
        </div>}
      </div>)}

      {addingToCat===cat?
        <div style={{padding:"10px 14px",background:C.surface}}>
          <input placeholder="Task" value={newItemDraft.task} onChange={e=>setNewItemDraft({...newItemDraft,task:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,marginBottom:6,boxSizing:"border-box"}}/>
          <input placeholder="Note (optional)" value={newItemDraft.note} onChange={e=>setNewItemDraft({...newItemDraft,note:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,marginBottom:6,boxSizing:"border-box"}}/>
          <input placeholder="Link Label (optional)" value={newItemDraft.linkLabel} onChange={e=>setNewItemDraft({...newItemDraft,linkLabel:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,marginBottom:6,boxSizing:"border-box"}}/>
          <input placeholder="Link URL (optional)" value={newItemDraft.link} onChange={e=>setNewItemDraft({...newItemDraft,link:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,marginBottom:8,boxSizing:"border-box"}}/>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>{setAddingToCat(null);setNewItemDraft({task:"",note:"",link:"",linkLabel:""});}} style={{flex:1,padding:"6px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",color:C.textMid,cursor:"pointer",fontSize:12}}>Cancel</button>
            <button onClick={()=>addItemToCat(cat)} style={{flex:2,padding:"6px",borderRadius:6,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:12,fontWeight:600}}>Save Checkbox</button>
          </div>
        </div>
        :<div style={{padding:"8px 14px",background:C.surface}}>
          <button onClick={()=>setAddingToCat(cat)} style={{fontSize:12,color:C.teal,background:"none",border:"none",fontWeight:600,cursor:"pointer"}}>+ Add Checkbox to This Category</button>
        </div>
      }
    </div>)}
  </div>;
}

const SCRIPT_CATEGORIES = ["Cold Market","Warm Market","Objection Handling","Recruiting","Other"];

// Read-only Scripts view for reps — same category grouping and link display as the
// admin ScriptsPage, just without the edit/delete controls.
function RepScriptsView({scripts}) {
  const grouped={};
  scripts.forEach((s,i)=>{
    const cat=s.category||"Uncategorized";
    if(!grouped[cat]) grouped[cat]=[];
    grouped[cat].push(i);
  });
  const catOrder=[...SCRIPT_CATEGORIES,"Uncategorized"].filter(c=>grouped[c]);
  return <div>
    {catOrder.map(cat=><div key={cat}>
      <div style={{fontSize:13,fontWeight:800,color:C.textMid,textTransform:"uppercase",letterSpacing:"0.5px",margin:"14px 0 10px"}}>{cat}</div>
      {grouped[cat].map(i=>{const s=scripts[i]; return <Card key={i} style={{marginBottom:10}}>
        <div style={{fontSize:17,fontWeight:800,color:C.text,marginBottom:10}}>{s.title}</div>
        <div style={{background:C.surface,borderRadius:9,padding:"14px 16px",fontSize:16,fontWeight:600,color:C.text,lineHeight:1.75,whiteSpace:"pre-wrap"}}>{s.content}</div>
        {s.link&&<a href={s.link} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",marginTop:10,fontSize:14,color:C.teal,fontWeight:700,textDecoration:"none",wordBreak:"break-all"}}>🔗 {s.link}</a>}
      </Card>;})}
    </div>)}
  </div>;
}

function ScriptsPage({data,onUpdate,userRole}) {
  const scripts = data.scripts || SCRIPTS;
  const isAdmin = userRole==="admin"||userRole==="superadmin";
  const [editing,setEditing] = useState(null);
  const [draft,setDraft] = useState({title:"",category:"",content:"",link:""});
  const [showAdd,setShowAdd] = useState(false);
  const [newScript,setNewScript] = useState({title:"",category:"",content:"",link:""});

  const saveEdit = (i) => {
    const updated = scripts.map((s,idx)=>idx===i?{...draft}:s);
    onUpdate({...data,scripts:updated});
    setEditing(null);
  };
  const deleteScript = (i) => {
    onUpdate({...data,scripts:scripts.filter((_,idx)=>idx!==i)});
  };
  const addScript = () => {
    if(!newScript.title||!newScript.content) return;
    onUpdate({...data,scripts:[...scripts,{...newScript}]});
    setNewScript({title:"",category:"",content:"",link:""});
    setShowAdd(false);
  };
  const resetToDefault = () => {
    if(window.confirm("Reset all scripts to the original defaults?")) onUpdate({...data,scripts:SCRIPTS});
  };

  // Group by category — anything without one lands in "Uncategorized" so nothing gets lost
  const grouped={};
  scripts.forEach((s,i)=>{
    const cat=s.category||"Uncategorized";
    if(!grouped[cat]) grouped[cat]=[];
    grouped[cat].push(i);
  });
  const catOrder=[...SCRIPT_CATEGORIES,"Uncategorized"].filter(c=>grouped[c]);

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text}}>Scripts</div>
      {isAdmin&&<div style={{display:"flex",gap:7}}>
        <button onClick={resetToDefault} style={{fontSize:13,padding:"5px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>Reset Defaults</button>
        <button onClick={()=>setShowAdd(!showAdd)} style={{fontSize:13,padding:"5px 10px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>{showAdd?"Cancel":"+ Add Script"}</button>
      </div>}
    </div>
    {isAdmin&&<div style={{background:C.teal+"11",border:`1px solid ${C.teal}33`,borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:13,color:C.teal}}>
      Word-for-word scripts your team can use for calls, texts, and appointments.
    </div>}
    {showAdd&&<Card style={{marginBottom:14,border:`1px solid ${C.teal}44`}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:10}}>New Script</div>
      <div style={{fontSize:12,fontWeight:600,color:C.textMid,marginBottom:4}}>Title</div>
      <input placeholder="e.g. Warm Market Opener" value={newScript.title} onChange={e=>setNewScript({...newScript,title:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,color:C.text,marginBottom:10,boxSizing:"border-box"}}/>
      <div style={{fontSize:12,fontWeight:600,color:C.textMid,marginBottom:4}}>Category</div>
      <select value={newScript.category} onChange={e=>setNewScript({...newScript,category:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,color:C.text,marginBottom:10,boxSizing:"border-box",background:"white"}}>
        <option value="">Select a category...</option>
        {SCRIPT_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
      </select>
      <div style={{fontSize:12,fontWeight:600,color:C.textMid,marginBottom:4}}>Script Content</div>
      <textarea placeholder="What to say..." value={newScript.content} onChange={e=>setNewScript({...newScript,content:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text,resize:"vertical",minHeight:100,boxSizing:"border-box",lineHeight:1.6,marginBottom:10}}/>
      <div style={{fontSize:12,fontWeight:600,color:C.textMid,marginBottom:4}}>Link <span style={{color:C.textLight,fontWeight:400}}>(optional — e.g. a video or doc that goes with this script)</span></div>
      <input placeholder="https://..." value={newScript.link} onChange={e=>setNewScript({...newScript,link:e.target.value.trim()})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,color:C.text,marginBottom:8,boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:7,marginTop:8}}>
        <button onClick={()=>setShowAdd(false)} style={{flex:1,padding:"7px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
        <button onClick={addScript} style={{flex:2,padding:"7px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Save Script</button>
      </div>
    </Card>}
    {catOrder.map(cat=><div key={cat}>
      <div style={{fontSize:13,fontWeight:800,color:C.textMid,textTransform:"uppercase",letterSpacing:"0.5px",margin:"18px 0 10px"}}>{cat}</div>
      {grouped[cat].map(i=>{const s=scripts[i]; return <Card key={i} style={{marginBottom:10}}>
        {editing===i?(
          <div>
            <div style={{fontSize:12,fontWeight:600,color:C.textMid,marginBottom:4}}>Title</div>
            <input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.teal}`,fontSize:14,color:C.text,marginBottom:8,boxSizing:"border-box",fontWeight:600}}/>
            <div style={{fontSize:12,fontWeight:600,color:C.textMid,marginBottom:4}}>Category</div>
            <select value={draft.category||""} onChange={e=>setDraft({...draft,category:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.teal}`,fontSize:14,color:C.text,marginBottom:8,boxSizing:"border-box",background:"white"}}>
              <option value="">Select a category...</option>
              {SCRIPT_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{fontSize:12,fontWeight:600,color:C.textMid,marginBottom:4}}>Script Content</div>
            <textarea value={draft.content} onChange={e=>setDraft({...draft,content:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:7,border:`1px solid ${C.teal}`,fontSize:13,color:C.text,resize:"vertical",minHeight:100,boxSizing:"border-box",lineHeight:1.6,marginBottom:8}}/>
            <div style={{fontSize:12,fontWeight:600,color:C.textMid,marginBottom:4}}>Link <span style={{color:C.textLight,fontWeight:400}}>(optional)</span></div>
            <input value={draft.link||""} onChange={e=>setDraft({...draft,link:e.target.value.trim()})} placeholder="https://..." style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.teal}`,fontSize:14,color:C.text,marginBottom:8,boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:7,marginTop:8}}>
              <button onClick={()=>setEditing(null)} style={{flex:1,padding:"6px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
              <button onClick={()=>saveEdit(i)} style={{flex:2,padding:"6px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Save Changes</button>
            </div>
          </div>
        ):(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div style={{fontSize:dv(16,19),fontWeight:800,color:C.text,flex:1}}>{s.title}</div>
              {isAdmin&&<div style={{display:"flex",gap:5,marginLeft:8}}>
                <button onClick={()=>{setEditing(i);setDraft({title:s.title,category:s.category||"",content:s.content,link:s.link||""});}} style={{fontSize:13,padding:"3px 8px",borderRadius:5,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>Edit</button>
                <button onClick={()=>deleteScript(i)} style={{fontSize:13,padding:"3px 8px",borderRadius:5,border:`1px solid ${C.danger}33`,background:C.danger+"11",cursor:"pointer",color:C.danger}}>Delete</button>
              </div>}
            </div>
            <div style={{background:C.surface,borderRadius:9,padding:"14px 16px",fontSize:dv(15,18),fontWeight:600,color:C.text,lineHeight:1.75,whiteSpace:"pre-wrap"}}>{s.content}</div>
            {s.link&&<a href={s.link} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",marginTop:10,fontSize:14,color:C.teal,fontWeight:700,textDecoration:"none"}}>🔗 {s.link}</a>}
          </div>
        )}
      </Card>;})}
    </div>)}
  </div>;
}

// ── SIDEBAR ──
function Sidebar({section,onNav,role,name,onSignOut,onClose,onShowPhone,onShowTour,alsoRecruits=false,rewatchVideo=null}) {
  const nav=[
    {k:"dashboard",l:"Dashboard",d:"M3 12L12 3L21 12V20H15V14H9V20H3V12Z"},
    {k:"production",l:"Production",d:"M3 3H21V5H3ZM3 8H15V10H3ZM3 13H21V15H3ZM3 18H15V20H3Z"},
    ...(role==="admin"||role==="superadmin"||role==="trainer"?[{k:"myactivity",l:"My Activity Report",d:"M9 19V6L21 3V16M9 19C9 20.1 8.1 21 7 21C5.9 21 5 20.1 5 19C5 17.9 5.9 17 7 17C8.1 17 9 17.9 9 19ZM21 16C21 17.1 20.1 18 19 18C17.9 18 17 17.1 17 16C17 14.9 17.9 14 19 14C20.1 14 21 14.9 21 16Z"}]:[]),
    {k:"reps",l:"My Reps",d:"M17 21V19C17 17.9 16.1 17 15 17H9C7.9 17 7 17.9 7 19V21M12 14C9.8 14 8 12.2 8 10C8 7.8 9.8 6 12 6C14.2 6 16 7.8 16 10C16 12.2 14.2 14 12 14Z"},
    {k:"planner",l:"Daily Planner",d:"M8 2V5M16 2V5M3.5 9H20.5M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z"},
    {k:"mytasks",l:"My Tasks",d:"M9 11L12 14L22 4M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16"},
    {k:"accountability",l:"Accountability",d:"M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"},
    {k:"teamleads",l:"Team Leads",d:"M17 20H7C5.9 20 5 19.1 5 18V6C5 4.9 5.9 4 7 4H17C18.1 4 19 4.9 19 6V18C19 19.1 18.1 20 17 20ZM9 8H15M9 12H15M9 16H12"},
    {k:"mypipeline",l:"My Pipeline",d:"M9 17H7C5.9 17 5 16.1 5 15V5C5 3.9 5.9 3 7 3H17C18.1 3 19 3.9 19 5V15C19 16.1 18.1 17 17 17H15M9 17L12 21L15 17M9 17H15"},
    {k:"scorecard",l:"Scorecard",d:"M9 19V6L21 3V16M9 19C9 20.1 8.1 21 7 21C5.9 21 5 20.1 5 19C5 17.9 5.9 17 7 17C8.1 17 9 17.9 9 19ZM21 16C21 17.1 20.1 18 19 18C17.9 18 17 17.1 17 16C17 14.9 17.9 14 19 14C20.1 14 21 14.9 21 16Z"},
    {k:"wallfame",l:"Wall of Fame",d:"M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"},
    {k:"emailtemplates",l:"Email Templates",d:"M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6"},
    {k:"objectiontraining",l:"Objection Training",d:"M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"},
    {k:"prospecting",l:"Prospecting",d:"M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"},
    {k:"quickmsg",l:"Quick Messages",d:"M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"},
    {k:"leadlink",l:"My Lead Link",d:"M10 13C10.4295 13.5741 10.9774 14.0492 11.6066 14.3929C12.2357 14.7367 12.9315 14.9411 13.6467 14.9923C14.3618 15.0435 15.0796 14.9404 15.7513 14.6898C16.4231 14.4392 17.0331 14.0471 17.54 13.54L20.54 10.54C21.4508 9.59699 21.9548 8.33397 21.9434 7.02299C21.932 5.71201 21.4061 4.45794 20.4791 3.53087C19.5521 2.60381 18.298 2.07799 16.987 2.0666C15.676 2.0552 14.413 2.55918 13.47 3.46997L11.75 5.17997M14 11C13.5705 10.4259 13.0226 9.95083 12.3934 9.60706C11.7642 9.26329 11.0685 9.05886 10.3533 9.00765C9.63816 8.95643 8.92037 9.05954 8.24861 9.31018C7.57685 9.56083 6.96684 9.95294 6.45996 10.46L3.45996 13.46C2.54917 14.403 2.04519 15.666 2.0566 16.977C2.06801 18.288 2.59383 19.5421 3.52089 20.4691C4.44796 21.3962 5.70203 21.922 7.01301 21.9334C8.32399 21.9448 9.58701 21.4408 10.53 20.53L12.24 18.82"},
    {k:"prospects",l:"My Prospects",d:"M17 21V19C17 17.9 16.1 17 15 17H9C7.9 17 7 17.9 7 19V21M12 11C9.8 11 8 9.2 8 7C8 4.8 9.8 3 12 3C14.2 3 16 4.8 16 7C16 9.2 14.2 11 12 11ZM21 11L19 13L17 11M19 13V7"},
    {k:"resources",l:"Resources",d:"M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12"},
    {k:"advancement",l:"Advancement",d:"M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"},
    {k:"scripts",l:"Scripts",d:"M9 5H7C5.9 5 5 5.9 5 7V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V7C19 5.9 18.1 5 17 5H15M9 5C9 5.6 9.4 6 10 6H14C14.6 6 15 5.6 15 5M9 5C9 4.4 9.4 4 10 4H14C14.6 4 15 4.4 15 5"},
    {k:"schedule",l:"Schedule",d:"M8 2V5M16 2V5M3.5 9H20.5M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z"},
    {k:"myprofile",l:"My Profile",d:"M20 21V19C20 17.9 19.1 17 18 17H6C4.9 17 4 17.9 4 19V21M16 7C16 9.2 14.2 11 12 11C9.8 11 8 9.2 8 7C8 4.8 9.8 3 12 3C14.2 3 16 4.8 16 7C16 9.2 14.2 11 12 11Z"},
    ...(role==="trainer"||role==="superadmin"||alsoRecruits?[{k:"careerpath",l:"My Career Path",d:"M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"}]:[]),
  ];
  if(role==="admin"||role==="superadmin") nav.push({k:"commitmentcats",l:"Manage Categories",d:"M4 6H20M4 12H14M4 18H9"});
  if(role==="admin"||role==="superadmin") nav.push({k:"checklisteditor",l:"Checklist Editor",d:"M9 5H7C5.9 5 5 5.9 5 7V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V7C19 5.9 18.1 5 17 5H15M9 5C9 5.6 9.4 6 10 6H14C14.6 6 15 5.6 15 5M9 5C9 4.4 9.4 4 10 4H14C14.6 4 15 4.4 15 5M9 12L11 14L16 9"});
  if(role==="admin"||role==="superadmin") nav.push({k:"team",l:"Team Mgmt",d:"M16 11C17.66 11 18.99 9.66 18.99 8C18.99 6.34 17.66 5 16 5C14.34 5 13 6.34 13 8C13 9.66 14.34 11 16 11ZM8 11C9.66 11 10.99 9.66 10.99 8C10.99 6.34 9.66 5 8 5C6.34 5 5 6.34 5 8C5 9.66 6.34 11 8 11ZM8 13C5.67 13 1 14.17 1 16.5V18H15V16.5C15 14.17 10.33 13 8 13ZM16 13C15.71 13 15.38 13.02 15.03 13.05C16.19 13.89 17 15.02 17 16.5V18H23V16.5C23 14.17 18.33 13 16 13Z"});
  return <div style={{width:210,background:C.navy,height:"100%",display:"flex",flexDirection:"column",color:"white",flexShrink:0}}>
    <div style={{padding:"18px 14px 14px",borderBottom:`1px solid ${C.borderLight}`,display:"flex",alignItems:"center",gap:9}}>
      <div style={{width:34,height:34,background:"rgba(14,165,160,0.15)",border:"1px solid rgba(14,165,160,0.35)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L1 4.5V11.5L8 15L15 11.5V4.5L8 1Z" stroke={C.teal} strokeWidth="1.5" fill="none"/><path d="M4.5 8L6.5 10L11.5 5" stroke={C.teal} strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
      <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700,color:"white",lineHeight:1.2}}>NextLevel</div><div style={{fontSize:10,color:C.textLight,lineHeight:1.2}}>Field Training Hub</div></div>
      {onClose&&<button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:18,padding:0,lineHeight:1}}>x</button>}
    </div>
    {rewatchVideo&&<div style={{padding:"10px 14px 0"}}>
      <button onClick={()=>{rewatchVideo.trigger();onClose?.();}} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"7px 9px",borderRadius:7,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer"}}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span style={{fontSize:11,color:"rgba(255,255,255,0.6)",fontWeight:500}}>{rewatchVideo.label}</span>
      </button>
    </div>}
    <nav style={{flex:1,padding:"10px 7px",overflowY:"auto"}}>
      {nav.map(item=><button key={item.k} onClick={()=>{onNav(item.k);onClose?.();}} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"8px 9px",borderRadius:7,border:"none",cursor:"pointer",textAlign:"left",marginBottom:1,background:section===item.k?"rgba(14,165,160,0.15)":"transparent",color:section===item.k?C.teal:"rgba(255,255,255,0.6)"}} onMouseEnter={e=>{if(section!==item.k)e.currentTarget.style.background="rgba(255,255,255,0.05)";}} onMouseLeave={e=>{if(section!==item.k)e.currentTarget.style.background="transparent";}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.d}/></svg>
        <span style={{fontSize:13,fontWeight:section===item.k?600:400}}>{item.l}</span>
        {section===item.k&&<div style={{marginLeft:"auto",width:3,height:3,borderRadius:2,background:C.teal}}/>}
      </button>)}
      <div style={{borderTop:`1px solid ${C.borderLight}`,marginTop:8,paddingTop:8}}>
        {[{l:"App Tour",fn:onShowTour},{l:"Add to Phone",fn:onShowPhone}].map(btn=><button key={btn.l} onClick={()=>{btn.fn();onClose?.();}} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"7px 9px",borderRadius:7,border:"none",cursor:"pointer",textAlign:"left",marginBottom:1,background:"transparent",color:"rgba(255,255,255,0.45)",fontSize:13}}>{btn.l}</button>)}
      </div>
    </nav>
    <div style={{padding:"10px 14px",borderTop:`1px solid ${C.borderLight}`}}>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
        <div style={{width:28,height:28,borderRadius:7,background:"rgba(14,165,160,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.teal,flexShrink:0}}>{name?.charAt(0)?.toUpperCase()||"U"}</div>
        <div style={{minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:"white",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name||"User"}</div><div style={{fontSize:10,color:C.textLight,textTransform:"capitalize"}}>{role}</div></div>
      </div>
      <button onClick={onSignOut} style={{width:"100%",padding:"6px",borderRadius:7,background:"rgba(255,255,255,0.04)",border:`1px solid ${C.borderLight}`,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:13}}>Sign Out</button>
    </div>
  </div>;
}

// ── MAIN APP ──
// ── WELCOME ORIENTATION MODAL ──
// ── BIRTHDAY MODAL ──
function BirthdayModal({name,age,onClose}) {
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:"white",borderRadius:20,width:"100%",maxWidth:380,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
      <div style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",padding:"28px 24px",textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:8}}>🎂🎉</div>
        <div style={{fontSize:22,fontWeight:800,color:"white",marginBottom:4}}>Happy Birthday!</div>
        <div style={{fontSize:15,color:"rgba(255,255,255,0.85)"}}>Today is your special day, {name}!</div>
        
      </div>
      <div style={{padding:"20px 24px",textAlign:"center"}}>
        <div style={{fontSize:14,color:"#6b7280",lineHeight:1.6,marginBottom:16}}>We're so grateful to have you on the team. Keep shining — today and every day. Now go celebrate! 🥳</div>
        <button onClick={onClose} style={{width:"100%",padding:"12px",borderRadius:10,background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",color:"white",fontSize:14,fontWeight:700,cursor:"pointer"}}>
          Thank You! 🎊
        </button>
      </div>
    </div>
  </div>;
}

// ── PROSPECTING PAGE ──
const PROSPECTING_CARDS = [
  {id:"p1",emoji:"🛒",situation:"Random Encounter",context:"At the grocery store, gas station, waiting in line — you meet someone friendly and there's a natural moment.",
    opening:"\"Do you by chance keep your options open for extra income?\"",
    ifYes:"Great — find out what they do, show genuine interest, then say: \"I actually help people in situations like yours protect their income and build wealth on the side. It's not for everyone but it might be worth a 20-minute conversation. Can I get your number?\"",
    ifNo:"\"No worries at all — I respect that. Have a great day!\" Smile and move on. Never push. The goal is sorting, not convincing.",
    purpose:"This is a filter question, not a pitch. You're not selling anything — you're identifying who's open. Most people won't be, and that's fine. The ones who say yes are self-selecting as interested.",
    tip:"Say it casually, like you're asking about the weather. The energy matters more than the words."
  },
  {id:"p2",emoji:"🥂",situation:"Social Event / Party",context:"You're at a gathering, someone asks what you do, or you're in a natural conversation.",
    opening:"\"I work in financial services — I help families protect their income and build wealth. What do you do?\" (Turn it back to them immediately.)",
    ifYes:"When they show interest: \"It's actually pretty interesting what we do — I'd love to share more over coffee sometime. Are you open to that?\"",
    ifNo:"If they're not interested: pivot to genuine conversation. Don't make it awkward. Your goal at social events is to make a connection, not close a deal.",
    purpose:"Lead with curiosity about them, not excitement about you. People are drawn to those who listen. If you talk about yourself too much at a party, you become the person everyone avoids.",
    tip:"Never pitch at the party. Get the number and follow up later. The party is for planting seeds."
  },
  {id:"p3",emoji:"⛪",situation:"Church / Community Group",context:"Someone you see regularly in a faith or community setting — relationship already exists.",
    opening:"\"Hey, I've been meaning to ask — do you have someone helping you with life insurance and building wealth for your family? I work in that space and I love helping people in our community.\"",
    ifYes:"\"That's great — just know I'm always here if you ever want a second opinion or a review. No pressure at all.\"",
    ifNo:"\"I'd love to sit down with you sometime — it's really just a conversation, no commitment. I think you'd find it valuable.\"",
    purpose:"Trust is already established. You're not a stranger — you're a community member offering to help. Lead with service, not sales. The relationship matters more than any one prospect.",
    tip:"Never make it feel like you're working your congregation. Be genuinely helpful and let your reputation do the prospecting for you over time."
  },
  {id:"p4",emoji:"📱",situation:"Social Media / DM Outreach",context:"Reaching out to someone online — friend, follower, or someone who engaged with your content.",
    opening:"\"Hey [Name]! Hope you're doing well. I've been working with families in [city] helping them protect their income and build wealth — I thought of you. Would you be open to a quick conversation?\"",
    ifYes:"\"Awesome — let's find a time. Are you free for a 20-minute call this week?\"",
    ifNo:"\"Totally understand! If anything ever changes, you know where to find me. Take care!\"",
    purpose:"Keep DMs short. Long messages feel like copy-paste spam. Personalize it — reference something real about them. The goal is to get a YES to a conversation, not to explain everything in the message.",
    tip:"Never send a wall of text. If they don't respond in a week, one follow-up is fine. After that, let it go and move on."
  },
  {id:"p5",emoji:"🤝",situation:"Warm Referral",context:"Someone gave you a name — \"you should talk to my friend Sarah.\"",
    opening:"\"Hey [Name], my name is [Your Name] — [Mutual Contact] actually suggested I reach out to you. I help families protect their income and build wealth, and they thought we'd be a good fit to connect. Would you be open to a quick call?\"",
    ifYes:"\"Perfect — I appreciate you being open. Let's find a time this week that works for you.\"",
    ifNo:"\"No worries at all — I'll let [Mutual Contact] know I reached out. Hope to connect sometime in the future!\"",
    purpose:"The warm referral is your highest-conversion prospect. Use the mutual contact's name immediately — it establishes trust before you've said anything else.",
    tip:"Always follow up with the person who referred you after the conversation — good or bad. It shows professionalism and encourages more referrals."
  },
  {id:"p6",emoji:"💼",situation:"Networking Event",context:"A business networking event, chamber of commerce, professional mixer.",
    opening:"\"I'm [Name] — I work in financial services helping families and business owners protect their income and build wealth. Who do you work with?\"",
    ifYes:"\"I love connecting with people like you — would you be open to a coffee chat this week?\"",
    ifNo:"Exchange cards anyway. The relationship may develop over time.",
    purpose:"Networking events are about building relationships, not collecting business cards or pitching. The sale happens weeks later, not at the event.",
    tip:"\"Who do you work with?\" is more powerful than \"what do you do?\" It gets them thinking about their network, which naturally leads to referrals."
  },
  {id:"p7",emoji:"🛡️",situation:"\"I already have insurance\"",context:"Someone mentions they already have coverage when you bring up what you do.",
    opening:"\"That's great — most people don't. Can I ask — do you know if it's term or whole life? And do you know exactly how much coverage you have?\"",
    ifYes:"\"That's really good that you know that. Most people don't — and a lot of people have group coverage through work that ends when their job ends. Would you be open to a quick review just to confirm you're in good shape?\"",
    ifNo:"\"Totally understand — I'm not here to replace what you have. If you ever want a second opinion, I'm here.\"",
    purpose:"\"I already have insurance\" is not a no — it's an invitation to educate. Most people have inadequate coverage and don't know it.",
    tip:"Never say their insurance is probably not good enough. Ask questions that lead them to the realization themselves."
  },
  {id:"p8",emoji:"🚫",situation:"\"I'm not interested in sales\"",context:"Someone reacts to your opportunity by saying they're not a salesperson.",
    opening:"\"I completely understand — honestly, I'm not really a salesperson either. I'm more of an educator. I sit down with families, look at their situation, and help them understand their options.\"",
    ifYes:"\"And the income part is really just a byproduct of helping people. Would you be open to just learning more about it?\"",
    ifNo:"\"That's fair — it's definitely not for everyone. I appreciate your honesty.\"",
    purpose:"Reframe the opportunity away from sales and toward service and education. Most people who say they're not salespeople actually hate pushy selling — which is not what we do.",
    tip:"The best reps don't think of themselves as salespeople. They think of themselves as advisors."
  },
  {
    id:"p9",
    emoji:"🔺",
    situation:"Skeptical Prospect / Industry Pushback",
    context:"Someone expresses skepticism about the industry, mentions MLMs, or seems dismissive before they've heard anything. Also works as a pattern interrupt when a prospect seems checked out.",
    opening:"You know what's interesting — most people I talk to are already in a structure that looks exactly like what you're describing and don't even know it. Let me show you what I mean.",
    ifYes:"Walk them through all five points: Point 1: 'Most people already have someone above them making more money and someone below them making less. The difference is most people can't move up — and if they do, there's a ceiling they'll never break through. What I want to show you is how to remove that ceiling.' Point 2: 'Most people's income is capped. Hourly wages, salary — it doesn't matter how hard they work because someone else already decided what they're worth. Here the only limit is how much someone is willing to put in.' Point 3: 'Most people are already selling every single day — selling their boss on why they deserve a raise, why they deserve a promotion. And most of the time they get very little in return. Here you learn to channel that same energy into building your own income.' Point 4: 'Most people say they want freedom but keep making choices that guarantee security — and then wonder why nothing changes. This is the vehicle that lets someone earn their way out of that cycle.' Point 5: 'Most people say they want more but tend to avoid environments that are actually going to require more of them. People who put in the work here get paid very well. It's that straightforward.' Close: 'I'm not asking you to make any decisions today. I'm just asking for twenty minutes to show you something that might change how you think about your options. Can you do that?'",
    ifNo:"That's actually the most common reaction — and it's exactly why I want to sit down with you. Because what I'm going to show you looks very different from what you're picturing right now.",
    purpose:"Most people have already been conditioned to reject this opportunity before they understand it. This approach meets their skepticism head on without getting defensive. By making it about what most people experience rather than what they personally are doing, you keep the conversation open and let them draw their own conclusions. Curiosity does the work — not pressure.",
    tip:"You don't have to deliver all five points perfectly. The goal is to get them curious enough to say yes to a meeting — not to close them on the phone. If they're engaged after point two or three, go straight to the close."
  },
];

function ProspectingPage({data,onUpdate,userRole}) {
  const isAdmin=userRole==="admin"||userRole==="superadmin";
  const [tab,setTab]=useState("situations");
  const [cardIndex,setCardIndex]=useState(0);
  const [flipped,setFlipped]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [form,setForm]=useState({emoji:"💬",situation:"",context:"",opening:"",ifYes:"",ifNo:"",purpose:"",tip:""});
  const [editingBuiltInP,setEditingBuiltInP]=useState(null);
  const customLines=data.prospectingLibrary||[];
  const prospEdits=data.prospectingEdits||{};

  const getPCard=(card)=>{
    const edit=prospEdits[card.id];
    if(!edit) return card;
    return {...card,...edit,id:card.id};
  };

  const startEditBuiltInP=(card)=>{
    const edit=prospEdits[card.id]||{};
    setEditingBuiltInP({id:card.id,form:{
      emoji:edit.emoji||card.emoji||"",
      situation:edit.situation||card.situation||"",
      context:edit.context||card.context||"",
      opening:edit.opening||card.opening||"",
      ifYes:edit.ifYes||card.ifYes||"",
      ifNo:edit.ifNo||card.ifNo||"",
      purpose:edit.purpose||card.purpose||"",
      tip:edit.tip||card.tip||"",
    }});
  };

  const saveBuiltInPEdit=()=>{
    if(!editingBuiltInP) return;
    onUpdate({...data,prospectingEdits:{...prospEdits,[editingBuiltInP.id]:editingBuiltInP.form}});
    setEditingBuiltInP(null);
  };

  const resetBuiltInP=(id)=>{
    const newEdits={...prospEdits};
    delete newEdits[id];
    onUpdate({...data,prospectingEdits:newEdits});
  };

  const allCards=[...PROSPECTING_CARDS.map(c=>getPCard(c)),...customLines];
  const card=allCards[cardIndex]||null;

  const next=()=>{setCardIndex(i=>Math.min(i+1,allCards.length-1));setFlipped(false);};
  const prev=()=>{setCardIndex(i=>Math.max(i-1,0));setFlipped(false);};

  const saveCard=()=>{
    if(!form.situation||!form.opening) return;
    const newCard={...form,id:`custom_p_${Date.now()}`};
    if(editingId){
      onUpdate({...data,prospectingLibrary:customLines.map(c=>c.id===editingId?{...newCard,id:editingId}:c)});
    } else {
      onUpdate({...data,prospectingLibrary:[...customLines,newCard]});
    }
    setForm({emoji:"💬",situation:"",context:"",opening:"",ifYes:"",ifNo:"",purpose:"",tip:""});
    setShowForm(false);
    setEditingId(null);
  };

  const deleteCard=(id)=>{
    if(window.confirm("Delete this card?")) onUpdate({...data,prospectingLibrary:customLines.filter(c=>c.id!==id)});
  };

  const editCard=(c)=>{
    setForm({emoji:c.emoji||"💬",situation:c.situation,context:c.context||"",opening:c.opening,ifYes:c.ifYes||"",ifNo:c.ifNo||"",purpose:c.purpose||"",tip:c.tip||""});
    setEditingId(c.id);
    setShowForm(true);
    setTab("library");
  };

  return <div style={{padding:dv(14,24),maxWidth:680,margin:"0 auto"}}>
    {editingBuiltInP&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
      <div style={{background:"white",borderRadius:16,padding:20,width:"100%",maxWidth:480,maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:4}}>Edit Prospecting Card</div>
        <div style={{fontSize:11,color:C.textMid,marginBottom:12}}>Your edits save to Firebase. The original is preserved — use Reset to restore it anytime.</div>
        {[["emoji","Emoji",""],["situation","Situation Title",""],["context","Context / Setup",""],["opening","Opening Line",""],["ifYes","If They Say Yes",""],["ifNo","If They Say No",""],["purpose","The Purpose",""],["tip","Pro Tip",""]].map(([k,l,ph])=><div key={k} style={{marginBottom:8}}>
          <label style={{fontSize:11,color:C.textMid,display:"block",marginBottom:3,fontWeight:600}}>{l}</label>
          <textarea value={editingBuiltInP.form[k]||""} onChange={e=>setEditingBuiltInP({...editingBuiltInP,form:{...editingBuiltInP.form,[k]:e.target.value}})} placeholder={ph} rows={k==="opening"||k==="purpose"?3:2} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,resize:"vertical",boxSizing:"border-box"}}/>
        </div>)}
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <button onClick={()=>setEditingBuiltInP(null)} style={{flex:1,padding:"9px",borderRadius:9,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:12,color:C.textMid}}>Cancel</button>
          <button onClick={()=>{resetBuiltInP(editingBuiltInP.id);setEditingBuiltInP(null);}} style={{flex:1,padding:"9px",borderRadius:9,border:`1px solid ${C.danger}33`,background:"white",cursor:"pointer",fontSize:12,color:C.danger}}>Reset to Original</button>
          <button onClick={saveBuiltInPEdit} style={{flex:2,padding:"9px",borderRadius:9,background:C.teal,border:"none",color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>Save Changes</button>
        </div>
      </div>
    </div>}
    <div style={{marginBottom:16}}>
      <div style={{fontSize:dv(19,24),fontWeight:800,color:C.text,marginBottom:4}}>🎯 Prospecting Training</div>
      <div style={{fontSize:13,color:C.textMid}}>Real-world scenarios and proven approaches for starting conversations naturally.</div>
    </div>
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
      {[["situations","📚 Situation Cards"],["quickref","⚡ Quick Reference"],["library","📖 Team's Best Lines"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:"7px 14px",borderRadius:20,border:`1px solid ${tab===k?C.teal:C.border}`,background:tab===k?C.teal:"white",color:tab===k?"white":C.textMid,fontSize:12,fontWeight:tab===k?700:400,cursor:"pointer"}}>{l}</button>)}
    </div>

    {tab==="situations"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,fontSize:11,color:C.textMid}}>
        <span>Card {cardIndex+1} of {allCards.length}</span>
        <span>{card?.emoji} {card?.situation}</span>
      </div>
      <div onClick={()=>setFlipped(f=>!f)} style={{cursor:"pointer",marginBottom:12,minHeight:260,borderRadius:16,border:`2px solid ${flipped?C.teal:C.border}`,background:flipped?`linear-gradient(135deg,${C.navy},#16304f)`:"white",padding:"20px",transition:"all 0.3s",boxShadow:"0 4px 20px rgba(0,0,0,0.08)"}}>
        {!flipped?<div>
          <div style={{fontSize:11,fontWeight:700,color:C.textLight,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>THE SITUATION</div>
          <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:8}}>{card?.emoji} {card?.situation}</div>
          {card?.context&&<div style={{fontSize:13,color:C.textMid,lineHeight:1.6,marginBottom:12,fontStyle:"italic"}}>{card.context}</div>}
          <div style={{marginTop:12,padding:"10px 14px",background:C.teal+"11",borderRadius:10,border:`1px solid ${C.teal}33`}}>
            <div style={{fontSize:10,fontWeight:700,color:C.teal,marginBottom:4}}>YOUR OPENING LINE</div>
            <div style={{fontSize:13,color:C.text,fontWeight:600,lineHeight:1.6}}>{card?.opening}</div>
          </div>
          <div style={{marginTop:16,textAlign:"center",fontSize:11,color:C.textLight}}>👆 Tap to see how to handle their response</div>
        </div>:<div>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>HOW TO HANDLE IT</div>
          {card?.ifYes&&<div style={{background:"rgba(16,185,129,0.15)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:8,padding:"10px 12px",marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:"#10b981",marginBottom:4}}>✅ IF THEY SAY YES</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",lineHeight:1.6}}>{card.ifYes}</div>
          </div>}
          {card?.ifNo&&<div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"10px 12px",marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:"#ef4444",marginBottom:4}}>🙅 IF THEY SAY NO</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",lineHeight:1.6}}>{card.ifNo}</div>
          </div>}
          {card?.purpose&&<div style={{background:"rgba(255,255,255,0.05)",borderRadius:8,padding:"10px 12px",marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",marginBottom:4}}>🧠 THE PURPOSE</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",lineHeight:1.6}}>{card.purpose}</div>
          </div>}
          {card?.tip&&<div style={{background:C.gold+"22",borderRadius:8,padding:"8px 12px"}}>
            <div style={{fontSize:10,fontWeight:700,color:C.gold,marginBottom:3}}>💡 PRO TIP</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.8)",lineHeight:1.5}}>{card.tip}</div>
          </div>}
        </div>}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <button onClick={prev} disabled={cardIndex===0} style={{width:40,height:40,borderRadius:20,border:`1px solid ${C.border}`,background:"white",cursor:cardIndex>0?"pointer":"default",color:cardIndex>0?C.text:C.textLight,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
        <div style={{flex:1,textAlign:"center",fontSize:11,color:C.textLight}}>Tap card to {flipped?"hide":"see"} response</div>
        <button onClick={next} disabled={cardIndex===allCards.length-1} style={{width:40,height:40,borderRadius:20,border:`1px solid ${C.border}`,background:"white",cursor:cardIndex<allCards.length-1?"pointer":"default",color:cardIndex<allCards.length-1?C.text:C.textLight,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>→</button>
      </div>
      <div style={{marginTop:16}}>
        <div style={{fontSize:11,fontWeight:700,color:C.textMid,marginBottom:8}}>Jump to a situation:</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {allCards.map((c,i)=><button key={c.id} onClick={()=>{setCardIndex(i);setFlipped(false);}} style={{padding:"4px 10px",borderRadius:14,border:`1px solid ${cardIndex===i?C.teal:C.border}`,background:cardIndex===i?C.teal+"11":"white",color:cardIndex===i?C.teal:C.textMid,fontSize:11,cursor:"pointer"}}>{c.emoji} {c.situation}</button>)}
        </div>
      </div>
    </div>}

    {tab==="quickref"&&<div>
      <div style={{background:`linear-gradient(135deg,${C.navy},#16304f)`,borderRadius:14,padding:"18px 20px",marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:800,color:"white",marginBottom:2}}>⚡ Quick Reference</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>Your go-to lines — screenshot this and keep it on your phone</div>
      </div>
      {[
        {label:"The Filter Opener",line:"\"Do you by chance keep your options open for extra income?\"",when:"Anywhere, anytime — sorts the interested from the not interested"},
        {label:"The Professional Intro",line:"\"I'm [Name] — I help families protect their income and build wealth. Who's helping you with that?\"",when:"Networking events, professional settings"},
        {label:"The Referral Opener",line:"\"[Mutual Contact] suggested I reach out — I help families with financial protection and wealth building. Would you be open to a quick call?\"",when:"Warm referral situations"},
        {label:"The Social Media DM",line:"\"Hey [Name]! I thought of you — I help people in [city] build extra income in financial services. Would you be open to a quick conversation?\"",when:"Social media outreach to warm contacts"},
        {label:"The Community Approach",line:"\"Do you have someone helping you with life insurance and protecting your family? I work in that space and love helping people in our community.\"",when:"Church, community groups, people you already know"},
        {label:"The Insurance Reframe",line:"\"That's great you have coverage — do you know if it's term or whole life? And do you know exactly how much you have?\"",when:"When someone says they already have insurance"},
      ].map((item,i)=><Card key={i} style={{marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:700,color:C.teal,marginBottom:4}}>{item.label}</div>
        <div style={{fontSize:13,color:C.text,lineHeight:1.6,marginBottom:6,fontStyle:"italic"}}>{item.line}</div>
        <div style={{fontSize:11,color:C.textMid}}>📍 {item.when}</div>
      </Card>)}
    </div>}

    {tab==="library"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:13,color:C.textMid}}>{customLines.length} custom line{customLines.length!==1?"s":""} from your team</div>
        {isAdmin&&<button onClick={()=>{setShowForm(true);setEditingId(null);setForm({emoji:"💬",situation:"",context:"",opening:"",ifYes:"",ifNo:"",purpose:"",tip:""});}} style={{padding:"7px 14px",borderRadius:8,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:600}}>+ Add Line</button>}
      </div>
      {isAdmin&&showForm&&<Card style={{marginBottom:16,border:`1px solid ${C.teal}33`}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>{editingId?"Edit":"New Prospecting Line"}</div>
        {[["situation","Situation Title","e.g. At the gym"],["context","Context / Setup","When and where this comes up..."],["opening","Opening Line","What you say first..."],["ifYes","If They Say Yes","What to say next..."],["ifNo","If They Say No","How to handle gracefully..."],["purpose","The Purpose","Why this approach works..."],["tip","Pro Tip",""],].map(([k,l,ph])=><div key={k} style={{marginBottom:8}}>
          <label style={{fontSize:10,color:C.textMid,display:"block",marginBottom:3}}>{l}</label>
          <textarea value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} placeholder={ph} rows={2} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,resize:"vertical",boxSizing:"border-box"}}/>
        </div>)}
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setShowForm(false);setEditingId(null);}} style={{flex:1,padding:"8px",borderRadius:8,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:12,color:C.textMid}}>Cancel</button>
          <button onClick={saveCard} disabled={!form.situation||!form.opening} style={{flex:2,padding:"8px",borderRadius:8,background:form.situation&&form.opening?C.teal:C.textLight,color:"white",border:"none",cursor:form.situation&&form.opening?"pointer":"default",fontSize:12,fontWeight:700}}>Save</button>
        </div>
      </Card>}
      {customLines.length===0&&!showForm&&<div style={{textAlign:"center",padding:"30px 20px",color:C.textLight}}>
        <div style={{fontSize:24,marginBottom:8}}>💬</div>
        <div style={{fontSize:13,marginBottom:4}}>No custom lines yet</div>
        {isAdmin?<div style={{fontSize:11}}>Add prospecting lines that have worked for your team so everyone can learn from them.</div>:<div style={{fontSize:11}}>Your admin will add team prospecting lines here as they're discovered in the field.</div>}
      </div>}
      {/* Built-in cards with edit option */}
      {PROSPECTING_CARDS.map((origCard,i)=>{const c=getPCard(origCard);return <div key={c.id} style={{borderRadius:10,border:`1px solid ${C.border}`,padding:"12px 14px",marginBottom:8,background:"white"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:8}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text}}>{c.emoji||"💬"} {c.situation}</div>
          <div style={{display:"flex",gap:4,flexShrink:0,alignItems:"center"}}>
            {prospEdits[c.id]&&<Badge color={C.gold} small>Edited</Badge>}
            {isAdmin&&<button onClick={()=>startEditBuiltInP(origCard)} style={{padding:"3px 8px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:11,color:C.textMid}}>Edit</button>}
          </div>
        </div>
        <div style={{fontSize:12,color:C.teal,fontWeight:600,marginBottom:4,fontStyle:"italic"}}>"{c.opening}"</div>
        <button onClick={()=>{const idx=allCards.findIndex(ac=>ac.id===c.id);if(idx>=0){setCardIndex(idx);setFlipped(false);setTab("situations");}}} style={{marginTop:4,width:"100%",padding:"5px",borderRadius:7,border:`1px solid ${C.teal}33`,background:C.teal+"08",color:C.teal,fontSize:11,fontWeight:600,cursor:"pointer"}}>📚 View as Flashcard</button>
      </div>;})}
      {customLines.length>0&&<div style={{fontSize:11,fontWeight:700,color:C.textMid,margin:"12px 0 6px",textTransform:"uppercase",letterSpacing:"0.5px"}}>Team's Custom Lines</div>}
      {customLines.map((c,i)=><div key={c.id} style={{borderRadius:10,border:`1px solid ${C.border}`,padding:"12px 14px",marginBottom:8,background:"white"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:8}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text}}>{c.emoji||"💬"} {c.situation}</div>
          {isAdmin&&<div style={{display:"flex",gap:4,flexShrink:0}}>
            <button onClick={()=>editCard(c)} style={{padding:"3px 8px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:11,color:C.textMid}}>Edit</button>
            <button onClick={()=>deleteCard(c.id)} style={{padding:"3px 8px",borderRadius:6,border:`1px solid ${C.danger}33`,background:"white",cursor:"pointer",fontSize:11,color:C.danger}}>Delete</button>
          </div>}
        </div>
        <div style={{fontSize:12,color:C.teal,fontWeight:600,marginBottom:6,fontStyle:"italic"}}>"{c.opening}"</div>
        {c.ifYes&&<div style={{fontSize:11,color:C.textMid,marginBottom:3}}>✅ Yes: {c.ifYes}</div>}
        {c.ifNo&&<div style={{fontSize:11,color:C.textMid,marginBottom:3}}>🙅 No: {c.ifNo}</div>}
        {c.tip&&<div style={{fontSize:11,color:C.gold,marginTop:4}}>💡 {c.tip}</div>}
        <button onClick={()=>{const idx=allCards.findIndex(ac=>ac.id===c.id);if(idx>=0){setCardIndex(idx);setFlipped(false);setTab("situations");}}} style={{marginTop:8,width:"100%",padding:"5px",borderRadius:7,border:`1px solid ${C.teal}33`,background:C.teal+"08",color:C.teal,fontSize:11,fontWeight:600,cursor:"pointer"}}>📚 View as Flashcard</button>
      </div>)}
    </div>}
  </div>;
}

// ── OBJECTION TRAINING — FLASHCARD SYSTEM ──
const OBJECTION_CARDS = [
  // ══ LIFE INSURANCE ══
  {id:"li1",cat:"Life Insurance",emoji:"💰",
    front:{title:"I can't afford it",prospect:"We're really tight on money right now. I just don't think we can afford another bill."},
    back:{
      best:"I hear you — and that's exactly why we need to have this conversation. Most families we sit with feel the same way until we do the numbers together. A lot of times it ends up being less than a cell phone bill. Can we just look at the numbers real quick?",
      keyPhrase:"It's not about the money — it's about priorities.",
      dontSay:"'It's really affordable' or 'It's only $X/month' — leading with price before establishing need makes you sound like a salesperson, not someone who cares about their family.",
      coaching:"Shift the conversation from cost to consequence. What does it cost their family if they DON'T have coverage? Get them to feel the gap before you ever mention a premium.",
      variations:["We're on a budget right now","I can't take on any more expenses","Money is tight after COVID"]
    }
  },
  {id:"li2",cat:"Life Insurance",emoji:"⏰",
    front:{title:"I need to think about it",prospect:"This all sounds good but I just need some time to think about it. Can I get back to you?"},
    back:{
      best:"I completely respect that. Can I ask — is it the cost, the coverage, or something else on your mind? Because 'I need to think about it' usually means there's a specific concern, and I'd rather help you think through it right now than leave you with unanswered questions.",
      keyPhrase:"What specifically did you want to think about?",
      dontSay:"'Okay, I'll follow up with you next week' — this lets them off the hook. Always find out what the real objection is before you leave.",
      coaching:"'I need to think about it' is almost never the real objection. It's usually a polite way of saying something else — cost, distrust, needing their spouse. Your job is to find the real concern.",
      variations:["Let me sleep on it","I want to do more research first","Can you send me some information?"]
    }
  },
  {id:"li3",cat:"Life Insurance",emoji:"👫",
    front:{title:"I need to talk to my spouse",prospect:"I can't make any financial decisions without talking to my husband/wife first."},
    back:{
      best:"Absolutely — and I wouldn't expect you to. That's exactly the right approach. Let's set up a time when we can all sit down together. That way both of you can ask questions and make the decision together. When works best for you both this week?",
      keyPhrase:"Let's set up a time when we can all sit down together.",
      dontSay:"'Can you just make the decision and tell them later?' — never try to get someone to go around their spouse. It destroys trust and the sale will cancel anyway.",
      coaching:"Welcome this objection — it means they're serious. Always try to get in front of both decision-makers at the same time. A third appointment with both spouses closes far more often than trying to coach one person to sell the other.",
      variations:["My wife handles all the finances","I need to run this by my partner","We make all decisions together"]
    }
  },
  {id:"li4",cat:"Life Insurance",emoji:"📋",
    front:{title:"I already have insurance through work",prospect:"I actually already have life insurance through my job so I think I'm covered."},
    back:{
      best:"That's great that your employer provides some coverage — most people don't even have that. Can I ask — do you know how much coverage it is? Because most group policies are 1-2x your salary, and the rule of thumb is 10-12x. Plus, here's the thing — that coverage ends the moment you leave that job. We want to make sure your family is protected no matter what happens with your employment.",
      keyPhrase:"Group coverage ends when your job ends.",
      dontSay:"'That's not enough coverage' — don't attack their existing coverage before you've asked about it. Ask first, educate second.",
      coaching:"Group life insurance has three problems: it's usually not enough, it's not portable, and it ends when employment ends. Walk them through all three — but ask questions first, don't lecture.",
      variations:["My company gives us life insurance","HR said I have coverage","I'm already covered through benefits"]
    }
  },
  {id:"li5",cat:"Life Insurance",emoji:"🧑",
    front:{title:"I'm too young to worry about that",prospect:"I'm only 26. I don't really need life insurance right now — that's something for older people."},
    back:{
      best:"I thought the same thing at your age. Here's the thing — you're actually in the best position right now. You're young and healthy, which means your rates will never be lower than they are today. Every year you wait, it costs more. And if anything changes with your health, you could become uninsurable. The best time to get protected is before you need it.",
      keyPhrase:"Your rates will never be lower than they are today.",
      dontSay:"'You never know when something could happen to you' — this sounds morbid and fear-based. Focus on the financial benefit of locking in low rates now.",
      coaching:"Young people think life insurance is for old people. Reframe it as a smart financial move — locking in the lowest rates while they're healthy. Add the portability angle: they're starting careers, might have a family soon, will have a mortgage.",
      variations:["I'm young and healthy, I don't need it yet","I'll think about it when I'm older","I don't have dependents yet"]
    }
  },
  {id:"li6",cat:"Life Insurance",emoji:"🤔",
    front:{title:"I don't believe in life insurance",prospect:"I just don't really believe in life insurance. If something happened to me my family would figure it out."},
    back:{
      best:"I respect that perspective. Can I ask — what would 'figuring it out' look like for your family? Would they have to sell the house? Would your spouse have to go back to work? Would your kids have to change schools? I'm not trying to scare you — I just want to make sure that's a plan your family is okay with.",
      keyPhrase:"What would 'figuring it out' actually look like for your family?",
      dontSay:"'You have to have life insurance' — telling someone they HAVE to do something puts them on defense. Ask questions that help them see the reality themselves.",
      coaching:"People who say they don't believe in life insurance usually haven't thought through what happens without it. Your job is to paint a specific picture of what 'figuring it out' actually means for their specific family situation.",
      variations:["I'm not a big insurance person","We'll cross that bridge when we come to it","My family is tough, they'll be fine"]
    }
  },
  // ══ INVESTMENTS ══
  {id:"inv1",cat:"Investments",emoji:"📈",
    front:{title:"I don't trust the stock market",prospect:"After 2008, I just don't trust putting my money in the market. I keep my savings in the bank."},
    back:{
      best:"That experience scared a lot of people — understandably. Here's what most people don't realize though: the people who lost everything in 2008 were the ones who panicked and sold at the bottom. The people who stayed in recovered everything and then some. The question isn't whether the market goes up and down — it does. The question is whether you want your money working for you over 20-30 years or sitting in a savings account losing to inflation every year.",
      keyPhrase:"Savings accounts don't lose money — they just lose value.",
      dontSay:"'The market always goes up long term' — while true, this feels dismissive of their real fear. Acknowledge the pain first.",
      coaching:"This objection is about fear, not logic. Acknowledge the fear first, then gently reframe the real risk: inflation quietly destroying purchasing power is also a form of losing money — it's just slower and less visible.",
      variations:["I got burned in the market before","I'd rather keep my money safe","The market is too volatile for me"]
    }
  },
  {id:"inv2",cat:"Investments",emoji:"💼",
    front:{title:"I already have a 401k",prospect:"I already contribute to my 401k at work. I think that's enough for retirement."},
    back:{
      best:"That's a great start — a lot of people don't even have that. Quick question: do you know what your 401k is actually invested in? And do you know what the fees are? Because most people have no idea. The other thing to consider is that 401k withdrawals are taxed as ordinary income in retirement. A Roth mutual fund grows tax-free. A lot of people actually have both — it's about building multiple streams for retirement.",
      keyPhrase:"Do you know what your 401k is actually invested in?",
      dontSay:"'A 401k isn't enough' — this sounds critical of their choices. Ask questions that help them discover the gaps themselves.",
      coaching:"Most people set up their 401k once and never look at it again. They don't know their allocation, their fees, or what they'll actually net after taxes. Asking simple questions about their 401k often reveals they know very little — which opens the door to education.",
      variations:["My company has a 401k match so I max that out","I have a pension through work","I'm already saving for retirement"]
    }
  },
  {id:"inv3",cat:"Investments",emoji:"💸",
    front:{title:"I don't have extra money to invest",prospect:"I live paycheck to paycheck. There's just nothing left over at the end of the month to invest."},
    back:{
      best:"I hear that — and it's the most common thing we hear. Here's what I've found: it's rarely actually about not having money. It's about where the money goes. Most people are investing — in their car payment, their streaming subscriptions, eating out. What if we just redirected $50 a month that you're already spending on something less important? Over 30 years at market returns, $50/month becomes something significant.",
      keyPhrase:"You're already investing — the question is what you're investing in.",
      dontSay:"'Everyone has at least a little extra' — this sounds dismissive and judgmental of their financial situation.",
      coaching:"The paycheck-to-paycheck objection needs a budget conversation, not an investment pitch. Help them see that small amounts matter and that they're likely spending on things that aren't serving their future.",
      variations:["I have too much debt to invest","Once I pay off my car I'll start","I barely cover my bills each month"]
    }
  },
  // ══ RECRUITING ══
  {id:"rec1",cat:"Recruiting",emoji:"🔺",
    front:{title:"Is this a pyramid scheme?",prospect:"No offense but this sounds like one of those pyramid schemes. My cousin got involved in something like this and lost money."},
    back:{
      best:"Honestly? I asked the exact same question when I was first introduced. Here's the difference: in a pyramid scheme, the person at the top always earns more than the people below them — period. At Primerica, I can earn MORE than the person who brought me in, based purely on my own production. We're also licensed, regulated by the state, and publicly traded on the New York Stock Exchange. Your cousin's experience was probably with a company that sells products with no real value. We help families protect their financial future. That's a real service people actually need.",
      keyPhrase:"In a pyramid scheme, the top always wins. Here, you can out-earn the person who recruited you.",
      dontSay:"'It's NOT a pyramid scheme!' — getting defensive immediately makes you look guilty. Stay calm and educate.",
      coaching:"This objection needs confidence and facts, not defensiveness. Three key facts: (1) you can earn more than your recruiter, (2) NYSE listed since 2010, (3) in business since 1977. Lead with empathy for their skepticism, then educate.",
      variations:["This sounds like an MLM","My friend said Primerica is a scam","How is this different from Amway?"]
    }
  },
  {id:"rec2",cat:"Recruiting",emoji:"⌚",
    front:{title:"I don't have time for this",prospect:"I already work 50 hours a week. I just don't have time to build a side business."},
    back:{
      best:"I completely understand — and I'm not here to add stress to your life. Most of the people on our team started exactly where you are, working full time. The question I'd ask is: are you working 50 hours a week because you love what you do, or because you need the income? Because if it's the second one, at some point you have to ask whether trading time for a paycheck forever is the plan. We help people build something that works for them, not the other way around.",
      keyPhrase:"At some point you have to ask if trading time for a paycheck forever is the plan.",
      dontSay:"'You only need a few hours a week' — this undersells the commitment and sets up unrealistic expectations. Be honest about the work involved.",
      coaching:"Time objections usually mask a deeper concern — either they don't see the opportunity or they don't believe they can succeed. Find out which one it is. If it's time, ask what they'd do with more of it.",
      variations:["I have kids and a full-time job","My schedule is already maxed out","I tried a side hustle before and burned out"]
    }
  },
  {id:"rec3",cat:"Recruiting",emoji:"👥",
    front:{title:"I don't know enough people",prospect:"I'm pretty introverted. I don't really have a big network so I don't see how I'd be successful."},
    back:{
      best:"You know what — some of our best reps are introverts. Here's why: introverts are usually great listeners, and listening is the most important skill in this business. You don't need a huge network to start — you need five good references. And those five people know five more. We're not asking you to cold call strangers. We're asking you to help people you care about. You probably already know families who need what we offer.",
      keyPhrase:"You don't need a huge network — you need five people who trust you.",
      dontSay:"'Everyone knows enough people' — this dismisses their concern and sounds naive.",
      coaching:"This is often really an 'I'm afraid of rejection' objection in disguise. Reframe from 'selling to strangers' to 'helping people you already care about.' The reference system means they're never cold calling.",
      variations:["I'm not a salesperson","I don't like talking to people I don't know","My circle is small"]
    }
  },
  {id:"rec4",cat:"Recruiting",emoji:"💵",
    front:{title:"I have to PAY to join?",prospect:"Wait — I have to pay $99 to work for a company? That doesn't make sense to me."},
    back:{
      best:"That's a fair question. The $99 covers your background check, your licensing materials, and your access to our systems and training — it's not going to us. Think about it this way: a real estate license costs $500-$1,500. A cosmetology license costs $10,000+. A life insurance license opens the door to an unlimited income potential and costs $99. That's probably one of the lowest barriers to entry in any licensed profession.",
      keyPhrase:"Name another licensed profession with a $99 entry cost.",
      dontSay:"'It's only $99, that's nothing' — what feels small to you might feel significant to them. Justify the value, don't minimize their concern.",
      coaching:"The $99 objection is often a proxy for 'I don't trust this yet.' Address the trust issue by explaining exactly what the fee covers and comparing it to the cost of other licensed professions.",
      variations:["Why do I have to pay to work?","Other jobs don't make you pay to start","I've heard of companies that make you buy inventory too"]
    }
  },
  {id:"rec5",cat:"Recruiting",emoji:"❌",
    front:{title:"I tried MLM before and it didn't work",prospect:"I tried one of those network marketing things a few years ago and I ended up losing money and friends. I'm not interested."},
    back:{
      best:"I'm really sorry that happened — and I understand why you'd be skeptical. Can I ask what you were selling? Because there's a big difference between selling products to your friends and helping families with their finances. People need life insurance whether they buy it from you or not. You're not asking friends to buy something they don't need — you're offering something that could literally save their family. That's a completely different conversation.",
      keyPhrase:"People need life insurance whether they buy it from you or not.",
      dontSay:"'This is totally different' — without explaining HOW it's different, this sounds like exactly what every MLM rep says.",
      coaching:"This objection requires specific differentiation. Ask what they sold before — if it was supplements, candles, or cosmetics, the contrast with financial services is easy to draw. Focus on the difference between selling discretionary products vs. essential financial protection.",
      variations:["I lost money with Herbalife","I tried selling leggings and it ruined friendships","Every MLM promises the same thing"]
    }
  },
  {
    id:"o15",
    cat:"Recruiting",
    emoji:"⏰",
    front:{
      title:"I don't have time / I work too much",
      prospect:"I can't add anything else to my plate right now. I work constantly and barely have time for my family as it is."
    },
    back:{
      best:"Use their own objection as the opener. The fact that they work too much is exactly WHY they need to hear this. Say: \"That's exactly why we need to get together. I just need ten to twenty minutes with you. I want to share what I'm doing — what's already taken me out of my job or is taking me out — so I can work less and still make the same amount of money working remote. You can't tell me you don't want to hear about that.\" Then: \"I know you don't work 168 hours a week. When's the best time — during the week or on the weekends?\" Let them answer. \"Morning or evening?\" Let them answer. Book the appointment.",
      keyPhrase:"\"That's exactly why we need to get together.\"",
      dontSay:"Don't explain what the business is before the meeting. If they ask, say 'That's exactly what I want to show you — that's why I want to sit down with you.' Protect the curiosity.",
      coaching:"The rep who struggles with this objection is usually trying to pitch the opportunity instead of selling the meeting. The goal of this conversation is one thing only — get ten minutes on the calendar. Lead with the outcome (work less, make the same money, work remote) and let them sell themselves on wanting to know more. The two-question close at the end makes booking feel natural, not pushy.",
      variations:["I'm too busy","I already have a full-time job","I don't have time for a side hustle","My schedule is crazy right now"]
    }
  },
  {
    id:"o16",
    cat:"Recruiting",
    emoji:"💰",
    front:{
      title:"How much have you made so far?",
      prospect:"Before I consider this, I want to know — how much money have you actually made doing this?"
    },
    back:{
      best:"Be honest. Tell them exactly what you've made — don't dodge it, don't exaggerate. Then immediately follow with: \"But here's what I want you to think about — how does what I made have any bearing on what YOU'RE going to do? It doesn't. I could go on to make a million dollars and that doesn't guarantee you will. And you could outwork me and make ten times what I've made. Your results are going to be based on YOU.\"",
      keyPhrase:"\"How does what I made have any bearing on what you're going to do?\"",
      dontSay:"Don't dodge the question. Don't make up a number. Don't say 'it depends' or 'I'm just getting started' without owning it. Honesty builds trust — trying to spin your answer kills it instantly.",
      coaching:"This isn't really an objection — it's a transparency question. And the rep who struggles with it usually struggles because they're insecure about their own answer. The real coaching here is: look in the mirror and ask yourself why you don't have a better answer yet. The best handler for this question is a bigger paycheck. In the meantime, own your number, then redirect to their potential — because their results have nothing to do with yours.",
      variations:["Are you making good money at this?","What's your income been like?","Is this actually worth it financially?","How long before you start making real money?"]
    }
  },
];

function ObjectionTrainingPage({data,onUpdate,userRole}) {
  const isAdmin=userRole==="admin"||userRole==="superadmin";
  const [tab,setTab]=useState("practice"); // practice | library
  const [cat,setCat]=useState("All");
  const [shuffle,setShuffle]=useState(false);
  const [cardIndex,setCardIndex]=useState(0);
  const [flipped,setFlipped]=useState(false);
  const [mastered,setMastered]=useState({});
  const [filter,setFilter]=useState("all"); // all | learning | mastered
  const [showLibraryForm,setShowLibraryForm]=useState(false);
  const [libraryForm,setLibraryForm]=useState({cat:"Life Insurance",emoji:"💬",frontTitle:"",frontProspect:"",backBest:"",backKeyPhrase:"",backDontSay:"",backCoaching:""});
  const [editingId,setEditingId]=useState(null);
  const [editingBuiltIn,setEditingBuiltIn]=useState(null); // {id, form}

  const customCards=data.objectionLibrary||[];
  const builtInEdits=data.objectionEdits||{};

  // Get effective card — built-in with any admin edits applied
  const getCard=(card)=>{
    const edit=builtInEdits[card.id];
    if(!edit) return card;
    return {
      ...card,
      emoji:edit.emoji||card.emoji,
      cat:edit.cat||card.cat,
      front:{title:edit.frontTitle||card.front.title,prospect:edit.frontProspect||card.front.prospect},
      back:{best:edit.backBest||card.back.best,keyPhrase:edit.backKeyPhrase||card.back.keyPhrase,dontSay:edit.backDontSay||card.back.dontSay,coaching:edit.backCoaching||card.back.coaching,variations:card.back.variations}
    };
  };

  const startEditBuiltIn=(card)=>{
    const edit=builtInEdits[card.id]||{};
    setEditingBuiltIn({id:card.id,form:{
      emoji:edit.emoji||card.emoji,
      cat:edit.cat||card.cat,
      frontTitle:edit.frontTitle||card.front.title,
      frontProspect:edit.frontProspect||card.front.prospect,
      backBest:edit.backBest||card.back.best,
      backKeyPhrase:edit.backKeyPhrase||card.back.keyPhrase,
      backDontSay:edit.backDontSay||card.back.dontSay,
      backCoaching:edit.backCoaching||card.back.coaching,
    }});
  };

  const saveBuiltInEdit=()=>{
    if(!editingBuiltIn) return;
    onUpdate({...data,objectionEdits:{...builtInEdits,[editingBuiltIn.id]:editingBuiltIn.form}});
    setEditingBuiltIn(null);
  };

  const resetBuiltIn=(id)=>{
    const newEdits={...builtInEdits};
    delete newEdits[id];
    onUpdate({...data,objectionEdits:newEdits});
  };
  const cats=["All","Life Insurance","Investments","Recruiting",...[...new Set(customCards.map(c=>c.cat).filter(c=>!["Life Insurance","Investments","Recruiting"].includes(c)))]];

  const allCards=[
    ...OBJECTION_CARDS.map(c=>({...getCard(c),isBuiltIn:true,_originalId:c.id})),
    ...customCards.map(c=>({
      ...c,
      isBuiltIn:false,
      // Normalize flat Firebase structure to nested structure
      front:c.front||{title:c.frontTitle||"",prospect:c.frontProspect||""},
      back:c.back||{best:c.backBest||"",keyPhrase:c.backKeyPhrase||"",dontSay:c.backDontSay||"",coaching:c.backCoaching||"",variations:[]}
    }))
  ];

  const filtered=allCards.filter(c=>{
    if(cat!=="All"&&c.cat!==cat) return false;
    if(filter==="mastered"&&!mastered[c.id]) return false;
    if(filter==="learning"&&mastered[c.id]) return false;
    return true;
  });
  const deck=shuffle?[...filtered].sort(()=>Math.random()-0.5):filtered;
  const card=deck[cardIndex]||null;
  const progress=Object.keys(mastered).filter(k=>mastered[k]).length;

  const next=()=>{setCardIndex(i=>Math.min(i+1,deck.length-1));setFlipped(false);};
  const prev=()=>{setCardIndex(i=>Math.max(i-1,0));setFlipped(false);};
  const markMastered=()=>{setMastered(m=>({...m,[card.id]:true}));next();};
  const markLearning=()=>{setMastered(m=>({...m,[card.id]:false}));next();};

  const saveLibraryCard=()=>{
    if(!libraryForm.frontTitle||!libraryForm.backBest) return;
    const newCard={id:`custom_${Date.now()}`,cat:libraryForm.cat,emoji:libraryForm.emoji,
      front:{title:libraryForm.frontTitle,prospect:libraryForm.frontProspect},
      back:{best:libraryForm.backBest,keyPhrase:libraryForm.backKeyPhrase,dontSay:libraryForm.backDontSay,coaching:libraryForm.backCoaching,variations:[]}
    };
    if(editingId){
      onUpdate({...data,objectionLibrary:customCards.map(c=>c.id===editingId?{...newCard,id:editingId}:c)});
    } else {
      onUpdate({...data,objectionLibrary:[...customCards,newCard]});
    }
    setLibraryForm({cat:"Life Insurance",emoji:"💬",frontTitle:"",frontProspect:"",backBest:"",backKeyPhrase:"",backDontSay:"",backCoaching:""});
    setShowLibraryForm(false);
    setEditingId(null);
  };

  const deleteCard=(id)=>{
    if(window.confirm("Delete this card?")) onUpdate({...data,objectionLibrary:customCards.filter(c=>c.id!==id)});
  };

  const editCard=(c)=>{
    setLibraryForm({cat:c.cat,emoji:c.emoji,frontTitle:c.front.title,frontProspect:c.front.prospect,backBest:c.back.best,backKeyPhrase:c.back.keyPhrase||"",backDontSay:c.back.dontSay||"",backCoaching:c.back.coaching||""});
    setEditingId(c.id);
    setShowLibraryForm(true);
  };

  return <div style={{padding:dv(14,24),maxWidth:680,margin:"0 auto"}}>
    {/* Edit Built-In Modal */}
    {editingBuiltIn&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
      <div style={{background:"white",borderRadius:16,padding:20,width:"100%",maxWidth:480,maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:4}}>Edit Card</div>
        <div style={{fontSize:11,color:C.textMid,marginBottom:12}}>Your edits save to Firebase. The original is always preserved — use Reset to restore anytime.</div>
        {[["emoji","Emoji"],["cat","Category"],["frontTitle","Situation Title"],["frontProspect","Prospect Says..."],["backBest","Best Response"],["backKeyPhrase","Key Phrase"],["backDontSay","Don't Say"],["backCoaching","Coaching Note"]].map(([k,l])=><div key={k} style={{marginBottom:8}}>
          <label style={{fontSize:11,color:C.textMid,display:"block",marginBottom:3,fontWeight:600}}>{l}</label>
          <textarea value={editingBuiltIn.form[k]||""} onChange={e=>setEditingBuiltIn({...editingBuiltIn,form:{...editingBuiltIn.form,[k]:e.target.value}})} rows={k==="backBest"||k==="backCoaching"?4:2} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,resize:"vertical",boxSizing:"border-box"}}/>
        </div>)}
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <button onClick={()=>setEditingBuiltIn(null)} style={{flex:1,padding:"10px",borderRadius:9,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:13,color:C.textMid,fontWeight:600}}>Cancel</button>
          <button onClick={()=>{resetBuiltIn(editingBuiltIn.id);setEditingBuiltIn(null);}} style={{flex:1,padding:"10px",borderRadius:9,border:`1px solid ${C.danger}44`,background:"white",cursor:"pointer",fontSize:13,color:C.danger,fontWeight:600}}>Reset</button>
          <button onClick={saveBuiltInEdit} style={{flex:2,padding:"10px",borderRadius:9,background:C.teal,border:"none",color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>Save Changes</button>
        </div>
      </div>
    </div>}
    {/* Header */}
    <div style={{marginBottom:16}}>
      <div style={{fontSize:dv(19,24),fontWeight:800,color:C.text,marginBottom:4}}>🎯 Objection Training</div>
      <div style={{fontSize:13,color:C.textMid}}>Study real objections and master your responses. {progress>0&&<span style={{color:C.success,fontWeight:600}}>{progress} card{progress!==1?"s":""} mastered!</span>}</div>
    </div>

    {/* Tabs */}
    <div style={{display:"flex",gap:6,marginBottom:16}}>
      {[["practice","📚 Flashcards"],["library","📖 Library"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:"7px 16px",borderRadius:20,border:`1px solid ${tab===k?C.teal:C.border}`,background:tab===k?C.teal:"white",color:tab===k?"white":C.textMid,fontSize:13,fontWeight:tab===k?700:400,cursor:"pointer"}}>{l}</button>)}
    </div>

    {/* PRACTICE TAB */}
    {tab==="practice"&&<div>
      {/* Filters */}
      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        {cats.map(c=><button key={c} onClick={()=>{setCat(c);setCardIndex(0);setFlipped(false);}} style={{padding:"4px 10px",borderRadius:16,border:`1px solid ${cat===c?C.teal:C.border}`,background:cat===c?C.teal:"white",color:cat===c?"white":C.textMid,fontSize:13,cursor:"pointer"}}>{c}</button>)}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        {[["all","All Cards"],["learning","Still Learning"],["mastered","Mastered ✅"]].map(([k,l])=><button key={k} onClick={()=>{setFilter(k);setCardIndex(0);setFlipped(false);}} style={{padding:"3px 9px",borderRadius:12,border:`1px solid ${filter===k?C.gold:C.border}`,background:filter===k?C.gold+"11":"white",color:filter===k?C.gold:C.textMid,fontSize:13,cursor:"pointer"}}>{l}</button>)}
        <button onClick={()=>{setShuffle(s=>!s);setCardIndex(0);setFlipped(false);}} style={{marginLeft:"auto",padding:"3px 9px",borderRadius:12,border:`1px solid ${shuffle?C.purple:C.border}`,background:shuffle?C.purple+"11":"white",color:shuffle?C.purple:C.textMid,fontSize:13,cursor:"pointer"}}>🔀 {shuffle?"Shuffle ON":"Shuffle"}</button>
      </div>

      {deck.length===0?<div style={{textAlign:"center",padding:"40px 20px",color:C.textLight}}>No cards in this filter. Try a different category.</div>:card&&<div>
        {/* Progress */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,fontSize:13,color:C.textMid}}>
          <span>Card {cardIndex+1} of {deck.length}</span>
          <span>{card.cat} {card.emoji}</span>
        </div>

        {/* Flashcard */}
        <div onClick={()=>setFlipped(f=>!f)} style={{cursor:"pointer",marginBottom:12,minHeight:220,borderRadius:16,border:`2px solid ${flipped?C.teal:C.border}`,background:flipped?`linear-gradient(135deg,${C.navy},#16304f)`:"white",padding:"20px",transition:"all 0.3s",boxShadow:"0 4px 20px rgba(0,0,0,0.08)"}}>
          {!flipped?<div>
            <div style={{fontSize:13,fontWeight:700,color:C.textLight,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>PROSPECT SAYS...</div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:12}}>{card.front.title}</div>
            <div style={{fontSize:14,color:C.textMid,lineHeight:1.6,fontStyle:"italic"}}>"{card.front.prospect}"</div>
            {card.front.variations?.length>0&&<div style={{marginTop:12,fontSize:12,color:C.textLight}}>Also heard as: {card.front.variations.slice(0,2).join(" · ")}</div>}
            <div style={{marginTop:16,textAlign:"center",fontSize:13,color:C.textLight}}>👆 Tap to reveal response</div>
          </div>:<div>
            <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.5)",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>BEST RESPONSE</div>
            <div style={{fontSize:14,color:"white",lineHeight:1.6,marginBottom:14}}>"{card.back.best}"</div>
            {card.back.keyPhrase&&<div style={{background:"rgba(251,191,36,0.15)",border:"1px solid rgba(251,191,36,0.3)",borderRadius:8,padding:"8px 10px",marginBottom:10}}>
              <div style={{fontSize:12,color:C.gold,fontWeight:700,marginBottom:2}}>⚡ KEY PHRASE</div>
              <div style={{fontSize:13,color:C.gold,fontWeight:600}}>"{card.back.keyPhrase}"</div>
            </div>}
            {card.back.dontSay&&<div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"8px 10px",marginBottom:10}}>
              <div style={{fontSize:12,color:"#ef4444",fontWeight:700,marginBottom:2}}>⚠️ DON'T SAY</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>{card.back.dontSay}</div>
            </div>}
            {card.back.coaching&&<div style={{background:"rgba(255,255,255,0.05)",borderRadius:8,padding:"8px 10px"}}>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",fontWeight:700,marginBottom:2}}>🧠 COACHING NOTE</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.65)",lineHeight:1.5}}>{card.back.coaching}</div>
            </div>}
          </div>}
        </div>

        {/* Navigation */}
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={prev} disabled={cardIndex===0} style={{width:40,height:40,borderRadius:20,border:`1px solid ${C.border}`,background:"white",cursor:cardIndex>0?"pointer":"default",color:cardIndex>0?C.text:C.textLight,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
          {flipped&&<>
            <button onClick={markLearning} style={{flex:1,padding:"10px",borderRadius:10,background:"white",border:`2px solid ${C.border}`,color:C.textMid,fontSize:13,fontWeight:600,cursor:"pointer"}}>🔄 Still Learning</button>
            <button onClick={markMastered} style={{flex:1,padding:"10px",borderRadius:10,background:C.success,border:"none",color:"white",fontSize:13,fontWeight:700,cursor:"pointer"}}>✅ Got It!</button>
          </>}
          {!flipped&&<div style={{flex:1,textAlign:"center",fontSize:13,color:C.textLight}}>Tap card to see response</div>}
          <button onClick={next} disabled={cardIndex===deck.length-1} style={{width:40,height:40,borderRadius:20,border:`1px solid ${C.border}`,background:"white",cursor:cardIndex<deck.length-1?"pointer":"default",color:cardIndex<deck.length-1?C.text:C.textLight,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>→</button>
        </div>
      </div>}
    </div>}

    {/* LIBRARY TAB */}
    {tab==="library"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:14,color:C.textMid}}>{allCards.length} total cards · {customCards.length} custom</div>
        {isAdmin&&<button onClick={()=>{setShowLibraryForm(true);setEditingId(null);setLibraryForm({cat:"Life Insurance",emoji:"💬",frontTitle:"",frontProspect:"",backBest:"",backKeyPhrase:"",backDontSay:"",backCoaching:""}); }} style={{padding:"7px 14px",borderRadius:8,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600}}>+ Add Card</button>}
      </div>

      {/* Admin form */}
      {isAdmin&&showLibraryForm&&<Card style={{marginBottom:16,border:`1px solid ${C.teal}33`}}>
        <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>{editingId?"Edit Card":"New Objection Card"}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <div><label style={{fontSize:12,color:C.textMid,display:"block",marginBottom:3}}>Category</label>
            <select value={libraryForm.cat} onChange={e=>setLibraryForm({...libraryForm,cat:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}>
              <option>Life Insurance</option><option>Investments</option><option>Recruiting</option><option>Other</option>
            </select>
          </div>
          <div><label style={{fontSize:12,color:C.textMid,display:"block",marginBottom:3}}>Emoji</label>
            <input value={libraryForm.emoji} onChange={e=>setLibraryForm({...libraryForm,emoji:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:16}} maxLength={2}/>
          </div>
        </div>
        {[["frontTitle","Objection Title (short)","e.g. They said the price is too high"],["frontProspect","Prospect's exact words","What the prospect actually says..."],["backBest","Best Response","The response to memorize..."],["backKeyPhrase","Key Phrase (one memorable line)",""],["backDontSay","Don't Say This (and why)",""],["backCoaching","Coaching Note","The psychology behind this objection..."]].map(([k,l,ph])=><div key={k} style={{marginBottom:8}}>
          <label style={{fontSize:12,color:C.textMid,display:"block",marginBottom:3}}>{l}</label>
          <textarea value={libraryForm[k]} onChange={e=>setLibraryForm({...libraryForm,[k]:e.target.value})} placeholder={ph} rows={k==="backBest"||k==="backCoaching"?3:2} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,resize:"vertical",boxSizing:"border-box"}}/>
        </div>)}
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setShowLibraryForm(false);setEditingId(null);}} style={{flex:1,padding:"8px",borderRadius:8,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Cancel</button>
          <button onClick={saveLibraryCard} disabled={!libraryForm.frontTitle||!libraryForm.backBest} style={{flex:2,padding:"8px",borderRadius:8,background:libraryForm.frontTitle&&libraryForm.backBest?C.teal:C.textLight,color:"white",border:"none",cursor:libraryForm.frontTitle&&libraryForm.backBest?"pointer":"default",fontSize:13,fontWeight:700}}>Save Card</button>
        </div>
      </Card>}

      {/* All cards list */}
      {allCards.map((c,i)=><div key={c.id} style={{borderRadius:10,border:`1px solid ${C.border}`,padding:"12px 14px",marginBottom:8,background:"white"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <span style={{fontSize:18}}>{c.emoji}</span>
              <div style={{fontSize:14,fontWeight:700,color:C.text}}>{c.front.title}</div>
              <Badge color={c.cat==="Life Insurance"?C.teal:c.cat==="Investments"?C.gold:C.purple} small>{c.cat}</Badge>
              {customCards.find(cc=>cc.id===c.id)&&<Badge color={C.textLight} small>Custom</Badge>}
            </div>
            <div style={{fontSize:13,color:C.textMid,fontStyle:"italic",marginBottom:6}}>"{c.front.prospect?.slice(0,80)}..."</div>
            <div style={{fontSize:13,color:C.text,marginBottom:4}}><strong>Best:</strong> {c.back.best?.slice(0,100)}...</div>
            {c.back.keyPhrase&&<div style={{fontSize:13,color:C.gold,fontWeight:600}}>⚡ "{c.back.keyPhrase}"</div>}
          </div>
          {isAdmin&&<div style={{display:"flex",gap:4,flexShrink:0,flexDirection:"column",alignItems:"flex-end"}}>
            {c.isBuiltIn
              ?<><button onClick={()=>startEditBuiltIn(OBJECTION_CARDS.find(oc=>oc.id===(c._originalId||c.id))||c)} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Edit</button>
              {builtInEdits[c._originalId||c.id]&&<button onClick={()=>resetBuiltIn(c._originalId||c.id)} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${C.gold}33`,background:"white",cursor:"pointer",fontSize:11,color:C.gold}}>Reset</button>}</>
              :<><button onClick={()=>editCard(c)} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Edit</button>
              <button onClick={()=>deleteCard(c.id)} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${C.danger}33`,background:"white",cursor:"pointer",fontSize:13,color:C.danger}}>Delete</button></>
            }
            {builtInEdits[c._originalId||c.id]&&c.isBuiltIn&&<Badge color={C.gold} small>Edited</Badge>}
          </div>}
        </div>
        <button onClick={()=>{const idx=deck.findIndex(d=>d.id===c.id);if(idx>=0){setCardIndex(idx);setFlipped(false);setTab("practice");}else{setCat("All");setFilter("all");setCardIndex(allCards.indexOf(c));setFlipped(false);setTab("practice");}}} style={{marginTop:8,width:"100%",padding:"5px",borderRadius:7,border:`1px solid ${C.teal}33`,background:C.teal+"08",color:C.teal,fontSize:13,fontWeight:600,cursor:"pointer"}}>📚 Practice This Card</button>
      </div>)}
    </div>}
  </div>;
}


// ── MONTHLY COMMITMENT SYSTEM ──
const COMMITMENT_TIERS = [
  {id:"role_player",emoji:"🎯",label:"Role Player",recruits:1,premium:1000,color:"#6b7280"},
  {id:"starter",emoji:"⭐",label:"Starter",recruits:3,premium:5000,color:"#f59e0b"},
  {id:"all_star",emoji:"🌟",label:"All-Star",recruits:7,premium:7500,color:"#8b5cf6"},
  {id:"champ",emoji:"🏆",label:"I'm A Champ",recruits:10,premium:10000,color:"#ef4444"},
  {id:"custom",emoji:"✏️",label:"Custom Goal",recruits:0,premium:0,color:"#0ea5a0"},
];

function getCurrentPrimerMonth(primerMonthEnds=[]) {
  const today = localDateStr();
  // Sort by cutoff date
  const sorted = [...primerMonthEnds].filter(m=>m.cutoff&&m.label).sort((a,b)=>a.cutoff.localeCompare(b.cutoff));
  // Find the current month — the one whose cutoff is in the future (or today)
  for(let i=0;i<sorted.length;i++){
    if(sorted[i].cutoff>=today){
      // Previous cutoff is the start of this period
      const start=i>0?sorted[i-1].cutoff:"2020-01-01";
      return {label:sorted[i].label,cutoff:sorted[i].cutoff,start,key:sorted[i].label.replace(/\s+/g,"_")};
    }
  }
  // Fallback to calendar month
  const now=new Date();
  const y=now.getFullYear();
  const m=now.getMonth();
  const monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const lastDay=localDateStr(new Date(y,m+1,0));
  return {label:`${monthNames[m]} ${y}`,cutoff:lastDay,start:localDateStr(new Date(y,m,1)),key:`${monthNames[m]}_${y}`};
}

function getDaysRemaining(cutoff) {
  const today=new Date();
  today.setHours(0,0,0,0);
  const end=new Date(cutoff+"T00:00:00");
  return Math.max(0,Math.ceil((end-today)/86400000));
}

// ── COMMITMENT POPUP ──
function CommitmentPopup({rep,primerMonth,onSave,onClose}) {
  const [selected,setSelected]=useState(null);
  const [customRecruits,setCustomRecruits]=useState("");
  const [customPremium,setCustomPremium]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const tier=COMMITMENT_TIERS.find(t=>t.id===selected);

  if(confirmed&&tier) return <div style={{position:"fixed",inset:0,background:"linear-gradient(135deg,#0f1f35,#16304f)",zIndex:5000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
    <div style={{fontSize:52,marginBottom:12}}>{tier.emoji}</div>
    <div style={{fontSize:26,fontWeight:900,color:"white",marginBottom:6,textAlign:"center"}}>{tier.label}!</div>
    <div style={{fontSize:14,color:"rgba(255,255,255,0.7)",textAlign:"center",marginBottom:24,lineHeight:1.6}}>
      {selected==="custom"?`${customRecruits} recruits · $${Number(customPremium).toLocaleString()} in premium`:`${tier.recruits} recruit${tier.recruits!==1?"s":""} · $${tier.premium.toLocaleString()} in premium`}
    </div>
    <div style={{fontSize:14,color:"rgba(255,255,255,0.5)",textAlign:"center"}}>Commitment locked for {primerMonth.label} 🔒</div>
  </div>;

  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:5000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
    <div style={{background:"white",borderRadius:20,width:"100%",maxWidth:440,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
      <div style={{background:"linear-gradient(135deg,#0f1f35,#16304f)",padding:"20px 22px"}}>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:4,textTransform:"uppercase",letterSpacing:"1px"}}>{primerMonth.label} Commitment</div>
        <div style={{fontSize:20,fontWeight:800,color:"white",marginBottom:6}}>Set Your Monthly Goal</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.65)",lineHeight:1.6}}>This is your commitment — not just to your goals, but to your team. Be honest with yourself. Be bold. Choose thoughtfully — this locks for the month.</div>
      </div>
      <div style={{padding:"16px 20px",maxHeight:"60vh",overflowY:"auto"}}>
        <div style={{fontSize:13,color:C.textMid,marginBottom:10,fontWeight:600}}>Choose your level for {primerMonth.label}:</div>
        {COMMITMENT_TIERS.map(t=><button key={t.id} onClick={()=>setSelected(t.id)} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`2px solid ${selected===t.id?t.color:C.border}`,background:selected===t.id?t.color+"11":"white",cursor:"pointer",textAlign:"left",marginBottom:8,transition:"all 0.15s"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>{t.emoji}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:selected===t.id?t.color:C.text}}>{t.label}</div>
              {t.id!=="custom"&&<div style={{fontSize:13,color:C.textMid}}>{t.recruits} recruit{t.recruits!==1?"s":""} · ${t.premium.toLocaleString()} in premium</div>}
              {t.id==="custom"&&<div style={{fontSize:13,color:C.textMid}}>Set your own numbers</div>}
            </div>
            {selected===t.id&&<div style={{width:18,height:18,borderRadius:9,background:t.color,display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg></div>}
          </div>
          {selected==="custom"&&t.id==="custom"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
            <div><div style={{fontSize:12,color:C.textMid,marginBottom:3}}>Recruit Goal</div><input type="number" placeholder="e.g. 5" value={customRecruits} onChange={e=>setCustomRecruits(e.target.value)} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box"}} onClick={e=>e.stopPropagation()}/></div>
            <div><div style={{fontSize:12,color:C.textMid,marginBottom:3}}>Premium Goal $</div><input type="number" placeholder="e.g. 8000" value={customPremium} onChange={e=>setCustomPremium(e.target.value)} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box"}} onClick={e=>e.stopPropagation()}/></div>
          </div>}
        </button>)}
        <div style={{fontSize:12,color:C.textLight,lineHeight:1.5,marginTop:4,textAlign:"center"}}>⏳ {getDaysRemaining(primerMonth.cutoff)} days left in {primerMonth.label} · Closes {new Date(primerMonth.cutoff+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric"})}</div>
      </div>
      <div style={{padding:"12px 20px",borderTop:`1px solid ${C.border}`,display:"flex",gap:8}}>
        <button onClick={onClose} style={{flex:1,padding:"10px",borderRadius:10,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:13,color:C.textMid,fontWeight:600}}>Remind Me Later</button>
        <button disabled={!selected||(selected==="custom"&&(!customRecruits||!customPremium))} onClick={()=>{
          const t=COMMITMENT_TIERS.find(tt=>tt.id===selected);
          const recruits=selected==="custom"?Number(customRecruits):t.recruits;
          const premium=selected==="custom"?Number(customPremium):t.premium;
          onSave({tierId:selected,tierLabel:t.label,tierEmoji:t.emoji,recruits,premium,monthKey:primerMonth.key,monthLabel:primerMonth.label,lockedAt:new Date().toISOString()});
          setConfirmed(true);
          setTimeout(onClose,2500);
        }} style={{flex:2,padding:"10px",borderRadius:10,background:selected?C.teal:C.textLight,color:"white",border:"none",cursor:selected?"pointer":"default",fontSize:14,fontWeight:700}}>
          🔒 Lock In My Commitment
        </button>
      </div>
    </div>
  </div>;
}

// ── COMMITMENT CARD (shows on rep dashboard) ──
function CommitmentCard({rep,primerMonth,onUnlock,canUnlock,recruitsOverride,premiumOverride}) {
  const commitment=rep.commitments?.[primerMonth.key];
  const daysLeft=getDaysRemaining(primerMonth.cutoff);
  if(!commitment) return null;

  const now=new Date();
  const monthStart=primerMonth.start;
  const recruits=recruitsOverride!==undefined?recruitsOverride:(rep.recruits||[]).filter(r=>r.date&&r.date>=monthStart).length;
  const premium=premiumOverride!==undefined?premiumOverride:(rep.selfPremium||[]).filter(e=>e.date&&e.date>=monthStart&&(!e.cod||e.codAccepted)).reduce((s,e)=>s+(Number(e.premium)||0)*12,0);
  const recruitPct=commitment.recruits>0?Math.min(100,Math.round((recruits/commitment.recruits)*100)):0;
  const premiumPct=commitment.premium>0?Math.min(100,Math.round((premium/commitment.premium)*100)):0;

  return <Card style={{marginBottom:14,border:`2px solid ${commitment.tierId==="champ"?"#ef4444":commitment.tierId==="all_star"?"#8b5cf6":commitment.tierId==="starter"?"#f59e0b":C.border}`}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
      <div>
        <div style={{fontSize:13,color:C.textMid,marginBottom:2}}>{primerMonth.label} Commitment</div>
        <div style={{fontSize:15,fontWeight:800,color:C.text}}>{commitment.tierEmoji} {commitment.tierLabel}</div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:12,color:C.textLight}}>{daysLeft} days left</div>
        <div style={{fontSize:12,color:C.textLight}}>Closes {new Date(primerMonth.cutoff+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
        {canUnlock&&<button onClick={onUnlock} style={{fontSize:10,color:C.textLight,background:"none",border:`1px solid ${C.border}`,borderRadius:4,cursor:"pointer",padding:"1px 5px",marginTop:3}}>Unlock</button>}
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.textMid,marginBottom:3}}>
          <span>Recruits</span><span style={{fontWeight:700,color:recruits>=commitment.recruits?C.success:C.text}}>{recruits}/{commitment.recruits}</span>
        </div>
        <div style={{height:6,background:"rgba(0,0,0,0.08)",borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",borderRadius:3,background:recruits>=commitment.recruits?C.success:C.teal,width:recruitPct+"%",transition:"width 0.4s"}}/>
        </div>
      </div>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.textMid,marginBottom:3}}>
          <span>Premium</span><span style={{fontWeight:700,color:premium>=commitment.premium?C.success:C.text}}>${Math.round(premium).toLocaleString()}/${commitment.premium.toLocaleString()}</span>
        </div>
        <div style={{height:6,background:"rgba(0,0,0,0.08)",borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",borderRadius:3,background:premium>=commitment.premium?C.success:C.gold,width:premiumPct+"%",transition:"width 0.4s"}}/>
        </div>
      </div>
    </div>
    {recruitPct>=100&&premiumPct>=100&&<div style={{marginTop:8,textAlign:"center",fontSize:13,fontWeight:700,color:C.success}}>🎉 Commitment achieved!</div>}
  </Card>;
}


// ── DAILY BLOCK PLANNER ──
const PLANNER_CATS = [
  {id:"work",    label:"Work",     color:"#0ea5a0"},
  {id:"client",  label:"Client",   color:"#8b5cf6"},
  {id:"training",label:"Training", color:"#f59e0b"},
  {id:"personal",label:"Personal", color:"#10b981"},
  {id:"admin",   label:"Admin",    color:"#6366f1"},
  {id:"break",   label:"Break",    color:"#94a3b8"},
];
const SLOT_START = 6;   // 6 AM
const SLOT_END   = 22;  // 10 PM
const SLOT_MINUTES = 15; // size of one grid slot
const SLOTS_PER_HOUR = 60/SLOT_MINUTES;
const TOTAL_SLOTS = (SLOT_END - SLOT_START) * SLOTS_PER_HOUR;

function slotToTime(slot) {
  const totalMin = slot*SLOT_MINUTES;
  const h = SLOT_START + Math.floor(totalMin/60);
  const m = totalMin%60;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
}

function nowSlot() {
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes();
  if (h < SLOT_START || h >= SLOT_END) return -1;
  return (h - SLOT_START) * SLOTS_PER_HOUR + Math.floor(m/SLOT_MINUTES);
}

function DailyPlanner({ session, db }) {
  const today = localDate();
  const [selDate, setSelDate] = useState(today);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newCat, setNewCat] = useState("work");
  const [newDur, setNewDur] = useState(4); // in 15-minute units (4 = 1hr)
  const [customDurMin, setCustomDurMin] = useState("");
  const [newStartSlot, setNewStartSlot] = useState(() => { const s = nowSlot(); return s >= 0 ? s : 0; });
  const [editBlock, setEditBlock] = useState(null);
  const [nowS, setNowS] = useState(nowSlot());
  const userId = session?.id;

  // Tick the now line every minute
  useEffect(() => {
    const t = setInterval(() => setNowS(nowSlot()), 60000);
    return () => clearInterval(t);
  }, []);

  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'failed'
  const lastWriteRef = useRef(null); // holds the write function to retry if it fails
  const savedTimeoutRef = useRef(null);
  // Retries once after a short delay before giving up — most failures are brief network
  // blips, not real problems. Always shows what's actually happening so a save never
  // silently fails without you knowing.
  const writeWithRetry = async (writeFn) => {
    lastWriteRef.current = writeFn;
    setSaveStatus("saving");
    try {
      await writeFn();
      setSaveStatus("saved");
      clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setSaveStatus(s => s === "saved" ? null : s), 2500);
    } catch(e1) {
      await new Promise(r => setTimeout(r, 1200));
      try {
        await writeFn();
        setSaveStatus("saved");
        clearTimeout(savedTimeoutRef.current);
        savedTimeoutRef.current = setTimeout(() => setSaveStatus(s => s === "saved" ? null : s), 2500);
      } catch(e2) {
        console.warn("Save failed after retry:", e2);
        setSaveStatus("failed");
      }
    }
  };
  const retryLastSave = () => { if (lastWriteRef.current) writeWithRetry(lastWriteRef.current); };

  const [recurringBlocks, setRecurringBlocks] = useState([]);
  const [customCats, setCustomCats] = useState([]);
  // Refs mirror the state above on every render so mutation functions (addBlock, saveEdit,
  // deleteBlock) always build on the true latest data — never a stale closure from the
  // render they were defined in. This is what prevents rapid back-to-back edits from
  // silently overwriting each other.
  const blocksRef = useRef([]);
  const recurringBlocksRef = useRef([]);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);
  useEffect(() => { recurringBlocksRef.current = recurringBlocks; }, [recurringBlocks]);
  const [migrating, setMigrating] = useState(false);

  // Load recurring blocks + custom categories once
  useEffect(() => {
    if (!userId || !db) return;
    const ref = doc(db, "userSchedules", `${userId}_recurring`);
    const unsub = onSnapshot(ref, async snap => {
      if (snap.exists()) {
        const d = snap.data();
        const rawBlocks = d.blocks || [];
        if (d.slotUnit !== 15 && rawBlocks.length > 0) {
          // One-time migration: old blocks were stored in 30-minute units, double
          // slot/dur so they land on the same real-world times in the new 15-min grid.
          // Block all edits until this fully finishes writing, so nothing can race it.
          setMigrating(true);
          const migrated = rawBlocks.map(b => ({...b, slot: b.slot*2, dur: b.dur*2}));
          recurringBlocksRef.current = migrated;
          setRecurringBlocks(migrated);
          try { await setDoc(ref, {blocks: migrated, customCats: d.customCats||[], userId, slotUnit: 15, updatedAt: new Date().toISOString()}, {merge:true}); } catch(e) {}
          setMigrating(false);
        } else {
          recurringBlocksRef.current = rawBlocks;
          setRecurringBlocks(rawBlocks);
        }
        setCustomCats(d.customCats || []);
      } else {
        setRecurringBlocks([]);
        setCustomCats([]);
      }
    }, () => {});
    return () => unsub();
  }, [userId]);

  // Save recurring blocks (merge so this never wipes out customCats saved separately)
  const saveRecurring = (newBlocks) => {
    if (!userId || !db) return;
    return writeWithRetry(() => setDoc(doc(db, "userSchedules", `${userId}_recurring`), {
      blocks: newBlocks, userId, slotUnit: 15, updatedAt: new Date().toISOString()
    }, { merge: true }));
  };

  // Save custom categories (merge so this never wipes out recurring blocks saved separately)
  const saveCustomCats = (newCats) => {
    if (!userId || !db) return;
    return writeWithRetry(() => setDoc(doc(db, "userSchedules", `${userId}_recurring`), {
      customCats: newCats, userId, updatedAt: new Date().toISOString()
    }, { merge: true }));
  };
  const CUSTOM_CAT_COLORS=["#ec4899","#06b6d4","#84cc16","#f97316","#a855f7","#14b8a6"];
  const [showAddCat,setShowAddCat]=useState(false);
  const [newCatName,setNewCatName]=useState("");
  const addCustomCat=()=>{
    const name=newCatName.trim();
    if(!name) return;
    const id="custom_"+name.toLowerCase().replace(/[^a-z0-9]+/g,"_").slice(0,24)+"_"+Date.now();
    const color=CUSTOM_CAT_COLORS[customCats.length%CUSTOM_CAT_COLORS.length];
    const updated=[...customCats,{id,label:name,color}];
    setCustomCats(updated);
    saveCustomCats(updated);
    setNewCat(id);
    setNewCatName("");
    setShowAddCat(false);
  };
  const ALL_PLANNER_CATS=[...PLANNER_CATS,...customCats];

  // Load blocks for selected date
  useEffect(() => {
    if (!userId || !db) return;
    setLoading(true);
    const ref = doc(db, "userSchedules", `${userId}_${selDate}`);
    const unsub = onSnapshot(ref, async snap => {
      if (snap.exists()) {
        const d = snap.data();
        const rawBlocks = d.blocks || [];
        if (d.slotUnit !== 15 && rawBlocks.length > 0) {
          setMigrating(true);
          const migrated = rawBlocks.map(b => ({...b, slot: b.slot*2, dur: b.dur*2}));
          blocksRef.current = migrated;
          setBlocks(migrated);
          try { await setDoc(ref, {blocks: migrated, userId, date: selDate, slotUnit: 15, updatedAt: new Date().toISOString()}, {merge:true}); } catch(e) {}
          setMigrating(false);
        } else {
          blocksRef.current = rawBlocks;
          setBlocks(rawBlocks);
        }
      } else {
        setBlocks([]);
      }
      setLoading(false);
    }, () => { setLoading(false); });
    return () => unsub();
  }, [userId, selDate]);

  // Save blocks to Firestore
  const saveBlocks = (newBlocks) => {
    if (!userId || !db) return;
    return writeWithRetry(() => setDoc(doc(db, "userSchedules", `${userId}_${selDate}`), {
      blocks: newBlocks, userId, date: selDate, slotUnit: 15, updatedAt: new Date().toISOString()
    }));
  };

  // Merge recurring blocks with daily blocks for display
  // Daily blocks can override recurring (by matching slot)
  // done status from daily overrides recurring for that day
  const dailyOverrideIds = new Set(blocks.map(b => b.recurringId).filter(Boolean));
  const selWeekday = new Date(selDate+"T12:00:00").getDay(); // 0=Sun..6=Sat
  const mergedBlocks = [
    ...recurringBlocks
      .filter(r => !dailyOverrideIds.has(r.id))
      .filter(r => !r.days || r.days.length===0 || r.days.includes(selWeekday)) // days=[] or undefined means every day
      .map(r => ({...r, isRecurring:true, done:false})),
    ...blocks.filter(b => !b.recurringId), // non-recurring daily blocks
    ...blocks.filter(b => b.recurringId).map(b => ({...b, isRecurring:true, _dailyId:b.id})), // recurring blocks with a done-status override for today — must render here or they vanish
  ].sort((a,b) => a.slot - b.slot);

  // Check for conflicts across merged blocks
  const hasConflict = (slot, dur, excludeId = null) => {
    return mergedBlocks.some(b => {
      if (b.id === excludeId) return false;
      const bEnd = b.slot + b.dur;
      const nEnd = slot + dur;
      return slot < bEnd && nEnd > b.slot;
    });
  };

  const [newRepeat, setNewRepeat] = useState(false);
  const [newDays, setNewDays] = useState([]); // empty = every day
  const WEEKDAY_LABELS = ["S","M","T","W","T","F","S"];

  // Add block to slot
  const addBlock = (slot) => {
    if (!newTitle.trim()) return;
    if (hasConflict(slot, newDur)) return;
    if (slot + newDur > TOTAL_SLOTS) return;
    const id = Date.now().toString();
    const nb = { id, title: newTitle.trim(), cat: newCat, dur: newDur, slot, notes: "", createdAt: new Date().toISOString() };
    if (newRepeat) {
      // Save to recurring — include selected days (empty array = every day)
      const updatedR = [...recurringBlocksRef.current, {...nb, days: newDays}].sort((a,b) => a.slot - b.slot);
      recurringBlocksRef.current = updatedR;
      setRecurringBlocks(updatedR);
      saveRecurring(updatedR);
    } else {
      const updated = [...blocksRef.current, nb].sort((a, b) => a.slot - b.slot);
      blocksRef.current = updated;
      setBlocks(updated);
      saveBlocks(updated);
    }
    setNewTitle("");
    setNewDays([]);
  };

  // Save edit
  const saveEdit = () => {
    if (!editBlock) return;
    if (hasConflict(editBlock.slot, editBlock.dur, editBlock.id)) {
      alert("This change would overlap another block.");
      return;
    }
    if (editBlock.isRecurring) {
      // For recurring blocks, only save done status to daily overrides
      // Full edits go to recurring collection
      if (editBlock._doneOnly) {
        // Just saving done status — write a daily override
        const override = { id: editBlock._dailyId||Date.now().toString(), recurringId: editBlock.id, done: editBlock.done, slot: editBlock.slot, dur: editBlock.dur, title: editBlock.title, cat: editBlock.cat, notes: editBlock.notes, createdAt: new Date().toISOString() };
        const updated = editBlock._dailyId
          ? blocksRef.current.map(b => b.id === editBlock._dailyId ? override : b)
          : [...blocksRef.current, override];
        blocksRef.current = updated;
        setBlocks(updated);
        saveBlocks(updated);
      } else {
        // Full edit — update recurring collection
        const updatedR = recurringBlocksRef.current.map(b => b.id === editBlock.id ? {...editBlock, isRecurring:undefined, _dailyId:undefined, _doneOnly:undefined} : b);
        recurringBlocksRef.current = updatedR;
        setRecurringBlocks(updatedR);
        saveRecurring(updatedR);
      }
    } else {
      const updated = blocksRef.current.map(b => b.id === editBlock.id ? editBlock : b).sort((a,b) => a.slot - b.slot);
      blocksRef.current = updated;
      setBlocks(updated);
      saveBlocks(updated);
    }
    setEditBlock(null);
  };

  // Delete block
  const deleteBlock = (id) => {
    if (editBlock?.isRecurring) {
      // Remove from recurring
      const updatedR = recurringBlocksRef.current.filter(b => b.id !== id);
      recurringBlocksRef.current = updatedR;
      setRecurringBlocks(updatedR);
      saveRecurring(updatedR);
      // Also remove any daily overrides
      const updated = blocksRef.current.filter(b => b.recurringId !== id);
      blocksRef.current = updated;
      setBlocks(updated);
      saveBlocks(updated);
    } else {
      const updated = blocksRef.current.filter(b => b.id !== id);
      blocksRef.current = updated;
      setBlocks(updated);
      saveBlocks(updated);
    }
    setEditBlock(null);
  };

  // Date options — today + next 6 days
  const dateOptions = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return localDate(d);
  });

  const dateLabel = (d) => {
    if (d === today) return "Today";
    const dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  // Stats
  const activeBlocks = mergedBlocks.filter(b => !b.done);
  const doneBlocks = mergedBlocks.filter(b => b.done);
  const totalMins = activeBlocks.reduce((s, b) => s + b.dur * 30, 0);
  const statsByCat = ALL_PLANNER_CATS.map(cat => {
    const mins = activeBlocks.filter(b => b.cat === cat.id).reduce((s, b) => s + b.dur * 30, 0);
    return { ...cat, mins };
  }).filter(c => c.mins > 0);

  const catColor = (id) => ALL_PLANNER_CATS.find(c => c.id === id)?.color || C.teal;
  const catLabel = (id) => ALL_PLANNER_CATS.find(c => c.id === id)?.label || id;

  const isToday = selDate === today;

  // In-app notification when a block's start time arrives — only fires while someone
  // has the Hub open and this Planner has loaded; there's no real push notification here.
  const [activeNotif, setActiveNotif] = useState(null);
  const notifiedIdsRef = useRef(new Set());
  const notifDayRef = useRef(today);
  const mergedBlocksRef = useRef(mergedBlocks);
  useEffect(() => { mergedBlocksRef.current = mergedBlocks; });
  useEffect(() => {
    if (!isToday || nowS < 0) return;
    if (notifDayRef.current !== today) { notifiedIdsRef.current = new Set(); notifDayRef.current = today; }
    const starting = mergedBlocksRef.current.find(b => b.slot === nowS && !notifiedIdsRef.current.has(b.isRecurring ? "r_"+b.id : b.id));
    if (starting) {
      const key = starting.isRecurring ? "r_"+starting.id : starting.id;
      notifiedIdsRef.current.add(key);
      setActiveNotif(starting);
    }
  }, [nowS, isToday]);

  return <div style={{ padding: dv(14, 24), maxWidth: 600, margin: "0 auto" }}>
    {/* Save status — always visible when there's something to report, so a save never silently fails without you knowing */}
    {saveStatus === "saving" && <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"9px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ fontSize:14 }}>⏳</div>
      <div style={{ fontSize:12, color:C.textMid }}>Saving...</div>
    </div>}
    {saveStatus === "saved" && <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"9px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ fontSize:14 }}>✓</div>
      <div style={{ fontSize:12, color:"#166534", fontWeight:600 }}>Saved</div>
    </div>}
    {saveStatus === "failed" && <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ fontSize:16 }}>⚠️</div>
      <div style={{ fontSize:12, color:"#991b1b", flex:1, fontWeight:600 }}>Not Saved — your last change didn't go through. Don't leave this tab yet.</div>
      <button onClick={retryLastSave} style={{ background:"#991b1b", border:"none", color:"white", cursor:"pointer", fontSize:12, fontWeight:700, padding:"5px 12px", borderRadius:6 }}>Retry</button>
    </div>}
    {/* Migration in progress — blocks all edits until the one-time schedule upgrade finishes saving */}
    {migrating && <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ fontSize:16 }}>⏳</div>
      <div style={{ fontSize:12, color:C.textMid }}>Updating your schedule to the new format — just a moment, don't add or edit blocks yet.</div>
    </div>}
    {/* Block-starting notification */}
    {activeNotif && <div style={{ background:`linear-gradient(135deg,${catColor(activeNotif.cat)},${catColor(activeNotif.cat)}cc)`, borderRadius:12, padding:"12px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:10, boxShadow:"0 4px 14px rgba(0,0,0,0.15)" }}>
      <div style={{ fontSize:22 }}>🔔</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:800, color:"white" }}>Starting now: {activeNotif.title}</div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.85)" }}>{catLabel(activeNotif.cat)} · {slotToTime(activeNotif.slot)} – {slotToTime(activeNotif.slot+activeNotif.dur)}</div>
      </div>
      <button onClick={()=>setActiveNotif(null)} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"white", borderRadius:6, padding:"4px 10px", fontSize:12, cursor:"pointer", fontWeight:600 }}>Dismiss</button>
    </div>}
    {/* Edit Modal */}
    {editBlock && <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"white", borderRadius:16, padding:20, width:"100%", maxWidth:400 }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:12 }}>Edit Block</div>
        <div style={{ marginBottom:8 }}>
          <label style={{ fontSize:11, color:C.textMid, display:"block", marginBottom:3 }}>Title</label>
          <input value={editBlock.title} onChange={e=>setEditBlock({...editBlock, title:e.target.value})} style={{ width:"100%", padding:"7px 9px", borderRadius:7, border:`1px solid ${C.border}`, fontSize:13, color:C.text, boxSizing:"border-box" }}/>
        </div>
        <div style={{ marginBottom:8 }}>
          <label style={{ fontSize:11, color:C.textMid, display:"block", marginBottom:3 }}>Start Time</label>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <button onClick={()=>{const ns=editBlock.slot-1;if(ns>=0&&!hasConflict(ns,editBlock.dur,editBlock.id))setEditBlock({...editBlock,slot:ns});}} disabled={editBlock.slot<=0||hasConflict(editBlock.slot-1,editBlock.dur,editBlock.id)} style={{ width:30, height:30, borderRadius:7, border:`1px solid ${C.border}`, background:"white", cursor:"pointer", fontSize:14, color:C.textMid, flexShrink:0 }}>−</button>
            <select value={editBlock.slot} onChange={e=>{const ns=Number(e.target.value);if(!hasConflict(ns,editBlock.dur,editBlock.id))setEditBlock({...editBlock,slot:ns});}} style={{ flex:1, padding:"6px 8px", borderRadius:7, border:`1px solid ${C.border}`, fontSize:12, color:C.text, background:"white" }}>
              {Array.from({length:TOTAL_SLOTS},(_,s)=>s).map(s=>{const conflict=s!==editBlock.slot&&hasConflict(s,editBlock.dur,editBlock.id);return <option key={s} value={s} disabled={conflict}>{slotToTime(s)}{conflict?" (busy)":""}</option>;})}
            </select>
            <button onClick={()=>{const ns=editBlock.slot+1;if(ns+editBlock.dur<=TOTAL_SLOTS&&!hasConflict(ns,editBlock.dur,editBlock.id))setEditBlock({...editBlock,slot:ns});}} disabled={editBlock.slot+editBlock.dur>=TOTAL_SLOTS||hasConflict(editBlock.slot+1,editBlock.dur,editBlock.id)} style={{ width:30, height:30, borderRadius:7, border:`1px solid ${C.border}`, background:"white", cursor:"pointer", fontSize:14, color:C.textMid, flexShrink:0 }}>+</button>
          </div>
          <div style={{ fontSize:10, color:C.textLight, marginTop:3 }}>Use −/+ to nudge by {SLOT_MINUTES} min, or pick a time directly</div>
        </div>
        <div style={{ marginBottom:8 }}>
          <label style={{ fontSize:11, color:C.textMid, display:"block", marginBottom:3 }}>Category</label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
            {ALL_PLANNER_CATS.map(cat => <button key={cat.id} onClick={()=>setEditBlock({...editBlock,cat:cat.id})} style={{ padding:"4px 10px", borderRadius:14, border:`2px solid ${editBlock.cat===cat.id?cat.color:C.border}`, background:editBlock.cat===cat.id?cat.color+"22":"white", cursor:"pointer", fontSize:12, color:editBlock.cat===cat.id?cat.color:C.textMid, fontWeight:editBlock.cat===cat.id?700:400 }}>{cat.label}</button>)}
          </div>
        </div>
        <div style={{ marginBottom:8 }}>
          <label style={{ fontSize:11, color:C.textMid, display:"block", marginBottom:3 }}>Duration</label>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:6 }}>
            {[[1,"15m"],[2,"30m"],[3,"45m"],[4,"1h"],[6,"1.5h"],[8,"2h"],[12,"3h"]].map(([v,l])=><button key={v} onClick={()=>setEditBlock({...editBlock,dur:v})} style={{ flex:"1 1 auto", minWidth:40, padding:"5px", borderRadius:7, border:`2px solid ${editBlock.dur===v?C.teal:C.border}`, background:editBlock.dur===v?C.teal+"11":"white", cursor:"pointer", fontSize:12, color:editBlock.dur===v?C.teal:C.textMid, fontWeight:editBlock.dur===v?700:400 }}>{l}</button>)}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:12, color:C.textMid }}>Custom:</span>
            <input type="number" min="15" step="15" value={editBlock.dur*SLOT_MINUTES} onChange={e=>{const v=Number(e.target.value);if(v>0)setEditBlock({...editBlock,dur:Math.max(1,Math.round(v/SLOT_MINUTES))});}} style={{ width:70, padding:"5px 7px", borderRadius:6, border:`1px solid ${C.border}`, fontSize:12, color:C.text }}/>
            <span style={{ fontSize:12, color:C.textMid }}>minutes</span>
          </div>
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:11, color:C.textMid, display:"block", marginBottom:3 }}>Notes</label>
          <textarea value={editBlock.notes||""} onChange={e=>setEditBlock({...editBlock,notes:e.target.value})} rows={2} style={{ width:"100%", padding:"6px 8px", borderRadius:7, border:`1px solid ${C.border}`, fontSize:12, color:C.text, resize:"vertical", boxSizing:"border-box" }}/>
        </div>
        {editBlock.isRecurring&&<div style={{ background:C.gold+"11", border:`1px solid ${C.gold}33`, borderRadius:7, padding:"8px 10px", marginBottom:8, fontSize:11, color:"#b45309" }}>
          <div style={{marginBottom:6}}>🔁 This is a recurring block. Full edits below update all future days.</div>
          <div style={{ fontSize:10, marginBottom:4, fontWeight:600 }}>Repeats on:</div>
          <div style={{ display:"flex", gap:4 }}>
            {WEEKDAY_LABELS.map((lbl,i)=><button key={i} onClick={()=>setEditBlock(eb=>({...eb,days:(eb.days||[]).includes(i)?(eb.days||[]).filter(x=>x!==i):[...(eb.days||[]),i],_doneOnly:false}))} style={{ width:26, height:26, borderRadius:13, border:`2px solid ${(editBlock.days||[]).includes(i)?C.gold:C.border}`, background:(editBlock.days||[]).includes(i)?C.gold:"white", color:(editBlock.days||[]).includes(i)?"white":C.textMid, fontSize:11, fontWeight:700, cursor:"pointer" }}>{lbl}</button>)}
          </div>
          <div style={{fontSize:9,color:"#b45309",marginTop:3}}>{(editBlock.days||[]).length===0?"Currently: every day":"Currently: selected days only"}</div>
        </div>}
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          <button onClick={()=>{setEditBlock({...editBlock, done:!editBlock.done, _doneOnly:true});}} style={{ width:"100%", padding:"9px", borderRadius:9, border:`1px solid ${editBlock.done?C.success:C.border}`, background:editBlock.done?C.success+"11":"white", cursor:"pointer", fontSize:12, color:editBlock.done?C.success:C.textMid, fontWeight:600 }}>
            {editBlock.done?"✅ Done — tap to unmark":"Mark as Done (today only)"}
          </button>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>setEditBlock(null)} style={{ flex:1, padding:"9px", borderRadius:9, border:`1px solid ${C.border}`, background:"white", cursor:"pointer", fontSize:12, color:C.textMid }}>Cancel</button>
          <button onClick={()=>deleteBlock(editBlock.id)} style={{ flex:1, padding:"9px", borderRadius:9, border:`1px solid ${C.danger}33`, background:"white", cursor:"pointer", fontSize:12, color:C.danger, fontWeight:600 }}>Delete</button>
          <button onClick={saveEdit} style={{ flex:2, padding:"9px", borderRadius:9, background:C.teal, border:"none", color:"white", cursor:"pointer", fontSize:12, fontWeight:700 }}>Save</button>
        </div>
      </div>
    </div>}

    {/* Header */}
    <div style={{ fontSize:dv(19,24), fontWeight:800, color:C.text, marginBottom:4 }}>📅 Daily Planner</div>
    <div style={{ fontSize:13, color:C.textMid, marginBottom:14 }}>Block your time. Protect your priorities.</div>

    {/* Date Selector */}
    <div style={{ display:"flex", gap:5, overflowX:"auto", marginBottom:14, paddingBottom:4 }}>
      {dateOptions.map(d => <button key={d} onClick={()=>setSelDate(d)} style={{ padding:"6px 12px", borderRadius:20, border:`1px solid ${selDate===d?C.teal:C.border}`, background:selDate===d?C.teal:"white", color:selDate===d?"white":C.textMid, fontSize:12, fontWeight:selDate===d?700:400, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>{dateLabel(d)}</button>)}
    </div>

    {/* New Block Form */}
    <Card style={{ marginBottom:14 }}>
      <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:8 }}>Add a Block</div>
      <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="What are you blocking time for?" style={{ width:"100%", padding:"7px 10px", borderRadius:8, border:`1px solid ${C.border}`, fontSize:13, color:C.text, marginBottom:8, boxSizing:"border-box" }}/>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
        {ALL_PLANNER_CATS.map(cat => <button key={cat.id} onClick={()=>setNewCat(cat.id)} style={{ padding:"4px 10px", borderRadius:14, border:`2px solid ${newCat===cat.id?cat.color:C.border}`, background:newCat===cat.id?cat.color+"22":"white", cursor:"pointer", fontSize:12, color:newCat===cat.id?cat.color:C.textMid, fontWeight:newCat===cat.id?700:400 }}>{cat.label}</button>)}
        <button onClick={()=>setShowAddCat(!showAddCat)} style={{ padding:"4px 10px", borderRadius:14, border:`2px dashed ${C.border}`, background:"white", cursor:"pointer", fontSize:12, color:C.textMid, fontWeight:400 }}>+ Custom</button>
      </div>
      {showAddCat&&<div style={{ display:"flex", gap:6, marginBottom:8 }}>
        <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="Category name..." onKeyDown={e=>e.key==="Enter"&&addCustomCat()} style={{ flex:1, padding:"6px 9px", borderRadius:7, border:`1px solid ${C.border}`, fontSize:12, color:C.text }}/>
        <button onClick={addCustomCat} style={{ padding:"6px 12px", borderRadius:7, border:"none", background:C.teal, color:"white", cursor:"pointer", fontSize:12, fontWeight:600 }}>Add</button>
      </div>}
      <div style={{ display:"flex", gap:5, marginBottom:6, flexWrap:"wrap" }}>
        {[[1,"15m"],[2,"30m"],[3,"45m"],[4,"1hr"],[6,"1.5hr"],[8,"2hr"],[12,"3hr"]].map(([v,l])=><button key={v} onClick={()=>{setNewDur(v);setCustomDurMin("");}} style={{ flex:"1 1 auto", minWidth:44, padding:"5px", borderRadius:7, border:`2px solid ${newDur===v&&!customDurMin?C.teal:C.border}`, background:newDur===v&&!customDurMin?C.teal+"11":"white", cursor:"pointer", fontSize:12, color:newDur===v&&!customDurMin?C.teal:C.textMid, fontWeight:newDur===v&&!customDurMin?700:400 }}>{l}</button>)}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
        <span style={{ fontSize:12, color:C.textMid }}>Custom:</span>
        <input type="number" min="15" step="15" value={customDurMin} onChange={e=>{const v=e.target.value;setCustomDurMin(v);if(v)setNewDur(Math.max(1,Math.round(Number(v)/SLOT_MINUTES)));}} placeholder="e.g. 90" style={{ width:70, padding:"5px 7px", borderRadius:6, border:`1px solid ${customDurMin?C.teal:C.border}`, fontSize:12, color:C.text }}/>
        <span style={{ fontSize:12, color:C.textMid }}>minutes</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
        <button onClick={()=>{setNewRepeat(r=>!r);if(newRepeat)setNewDays([]);}} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:8, border:`1px solid ${newRepeat?C.gold:C.border}`, background:newRepeat?C.gold+"11":"white", cursor:"pointer", fontSize:12, color:newRepeat?"#b45309":C.textMid, fontWeight:newRepeat?700:400 }}>
          🔁 {newRepeat?(newDays.length>0?"Repeats Weekly":"Repeats Daily"):"One-time only"}
        </button>
        <div style={{ fontSize:11, color:C.textLight }}>{newRepeat?(newDays.length>0?`Only on selected days`:"Shows every day automatically"):"Only appears on the selected date"}</div>
      </div>
      {newRepeat&&<div style={{ marginBottom:8 }}>
        <div style={{ fontSize:11, color:C.textMid, marginBottom:5 }}>Repeat on specific days (leave blank for every day):</div>
        <div style={{ display:"flex", gap:4 }}>
          {WEEKDAY_LABELS.map((lbl,i)=><button key={i} onClick={()=>setNewDays(d=>d.includes(i)?d.filter(x=>x!==i):[...d,i])} style={{ width:32, height:32, borderRadius:16, border:`2px solid ${newDays.includes(i)?C.gold:C.border}`, background:newDays.includes(i)?C.gold:"white", color:newDays.includes(i)?"white":C.textMid, fontSize:12, fontWeight:700, cursor:"pointer" }}>{lbl}</button>)}
        </div>
      </div>}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
        <span style={{ fontSize:12, color:C.textMid, whiteSpace:"nowrap" }}>Start time:</span>
        <select value={newStartSlot} onChange={e=>setNewStartSlot(Number(e.target.value))} style={{ flex:1, padding:"6px 8px", borderRadius:7, border:`1px solid ${C.border}`, fontSize:12, color:C.text, background:"white" }}>
          {Array.from({length:TOTAL_SLOTS},(_,s)=>s).map(s=><option key={s} value={s}>{slotToTime(s)}</option>)}
        </select>
        <button onClick={()=>{if(migrating||!newTitle.trim())return;if(hasConflict(newStartSlot,newDur)||newStartSlot+newDur>TOTAL_SLOTS)return;addBlock(newStartSlot);}} disabled={migrating||!newTitle.trim()||hasConflict(newStartSlot,newDur)||newStartSlot+newDur>TOTAL_SLOTS} style={{ padding:"6px 14px", borderRadius:7, border:"none", background:(migrating||!newTitle.trim()||hasConflict(newStartSlot,newDur)||newStartSlot+newDur>TOTAL_SLOTS)?C.textLight:C.teal, color:"white", cursor:(migrating||!newTitle.trim()||hasConflict(newStartSlot,newDur)||newStartSlot+newDur>TOTAL_SLOTS)?"default":"pointer", fontSize:12, fontWeight:600, whiteSpace:"nowrap" }}>Place Block</button>
      </div>
      {newTitle.trim()&&hasConflict(newStartSlot,newDur)&&<div style={{ fontSize:11, color:"#ef4444", marginBottom:8 }}>That time overlaps another block — pick a different start time or tap an open slot below.</div>}
      <div style={{ fontSize:11, color:C.textMid }}>
        {newTitle.trim() ? "👆 Or tap a time slot below to place this block" : "Enter a title first, then pick a start time or tap a slot below"}
      </div>
    </Card>

    {/* Time Grid */}
    <div style={{ position:"relative" }}>
      {Array.from({length: TOTAL_SLOTS}, (_, slot) => {
        const isHour = slot % SLOTS_PER_HOUR === 0;
        const block = mergedBlocks.find(b => b.slot === slot);
        const covered = mergedBlocks.find(b => b.slot < slot && b.slot + b.dur > slot);
        const conflict = newTitle.trim() && hasConflict(slot, newDur);
        const overflows = slot + newDur > TOTAL_SLOTS;
        const canPlace = !migrating && newTitle.trim() && !conflict && !overflows;
        const isNow = isToday && nowS === slot;
        const isNowCovered = isToday && nowS > slot && nowS < slot + (block?.dur || 1);

        if (covered && !block) return null; // Hidden — inside a multi-slot block

        if (block) {
          const cat = ALL_PLANNER_CATS.find(c => c.id === block.cat);
          const blockH = block.dur * 14; // 14px per 15-min slot = same 56px/hour as before
          return <div key={slot} onClick={()=>!migrating&&setEditBlock({...block})} style={{ display:"flex", cursor:migrating?"default":"pointer", marginBottom:1, position:"relative" }}>
            <div style={{ width:52, flexShrink:0, paddingTop:4, fontSize:11, color:C.textLight, textAlign:"right", paddingRight:8 }}>{isHour?slotToTime(slot):""}</div>
            <div style={{ flex:1, height:blockH, borderRadius:8, background:block.done?"rgba(0,0,0,0.04)":cat?.color+"22", border:`2px solid ${block.done?"rgba(0,0,0,0.1)":cat?.color}`, padding:"4px 8px", overflow:"hidden", position:"relative" }}>
              <div style={{ fontSize:12, fontWeight:700, color:block.done?C.textLight:cat?.color, textDecoration:block.done?"line-through":"none", opacity:block.done?0.6:1 }}>{block.title}</div>
              <div style={{ fontSize:10, color:block.done?C.textLight:cat?.color+"aa", opacity:block.done?0.5:1 }}>{block.isRecurring?"🔁 ":""}{cat?.label} · {slotToTime(block.slot)} – {slotToTime(block.slot+block.dur)}{block.done?" · ✅ Done":""}</div>
              {block.notes&&!block.done&&<div style={{ fontSize:10, color:C.textMid, marginTop:2 }}>{block.notes}</div>}
              {isToday&&!block.done&&nowS>=block.slot&&nowS<block.slot+block.dur&&<div style={{ position:"absolute", left:0, right:0, top:`${((nowS-block.slot)/block.dur)*100}%`, height:2, background:"red", opacity:0.6 }}/>}
            </div>
          </div>;
        }

        return <div key={slot} onClick={()=>canPlace&&addBlock(slot)} style={{ display:"flex", marginBottom:1, cursor:canPlace?"pointer":"default" }}>
          <div style={{ width:52, flexShrink:0, paddingTop:4, fontSize:11, color:C.textLight, textAlign:"right", paddingRight:8 }}>{isHour?slotToTime(slot):""}</div>
          <div style={{ flex:1, height:14, borderRadius:4, background:conflict?"rgba(239,68,68,0.06)":canPlace?"rgba(14,165,160,0.06)":"rgba(0,0,0,0.02)", border:`1px dashed ${conflict?"rgba(239,68,68,0.3)":isHour?"rgba(0,0,0,0.1)":"rgba(0,0,0,0.04)"}`, display:"flex", alignItems:"center", paddingLeft:8, transition:"background 0.1s", position:"relative" }}>
            {isNow&&<div style={{ position:"absolute", left:0, right:0, top:0, height:2, background:"#ef4444" }}><div style={{ position:"absolute", left:0, top:-4, width:8, height:8, borderRadius:4, background:"#ef4444" }}/></div>}
            {canPlace&&<div style={{ fontSize:10, color:C.teal, opacity:0 }} className="slot-hint">+ Add here</div>}
            {conflict&&<div style={{ fontSize:10, color:"#ef4444" }}>Overlap</div>}
          </div>
        </div>;
      })}
    </div>

    {/* Stats */}
    {blocks.length > 0 && <Card style={{ marginTop:14 }}>
      <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:4 }}>
        {dateLabel(selDate)} — {(totalMins/60).toFixed(1)} hrs remaining
        {doneBlocks.length>0&&<span style={{ fontSize:11, color:C.success, fontWeight:400, marginLeft:8 }}>✅ {doneBlocks.length} completed</span>}
      </div>
      {statsByCat.map(cat => <div key={cat.id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
        <div style={{ width:10, height:10, borderRadius:5, background:cat.color, flexShrink:0 }}/>
        <div style={{ flex:1, fontSize:12, color:C.text }}>{cat.label}</div>
        <div style={{ fontSize:12, color:C.textMid }}>{(cat.mins/60).toFixed(1)}h</div>
        <div style={{ width:80, height:6, background:"rgba(0,0,0,0.06)", borderRadius:3, overflow:"hidden" }}>
          <div style={{ height:"100%", borderRadius:3, background:cat.color, width:`${Math.min(100,(cat.mins/totalMins)*100)}%` }}/>
        </div>
      </div>)}
    </Card>}

    {loading && <div style={{ textAlign:"center", padding:20, color:C.textLight, fontSize:13 }}>Loading...</div>}
  </div>;
}

// ── CHOOSE YOUR PATH SCREEN ──
function ChooseYourPath({rep,onChoose}) {
  const [chosen,setChosen]=useState(null);
  const [animating,setAnimating]=useState(false);

  const choose=(track)=>{
    setChosen(track);
    setAnimating(true);
    setTimeout(()=>onChoose(track),2200);
  };

  if(animating&&chosen==="fast") return <div style={{position:"fixed",inset:0,background:"linear-gradient(135deg,#0f1f35,#1c3d63)",zIndex:5000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
    <div style={{fontSize:64,marginBottom:16,animation:"bounce 0.5s infinite alternate"}}>⚡</div>
    <div style={{fontSize:28,fontWeight:900,color:C.gold,marginBottom:8,textAlign:"center"}}>You chose Fast Start!</div>
    <div style={{fontSize:16,color:"rgba(255,255,255,0.8)",textAlign:"center",marginBottom:24}}>Let's GO! Your checklist is ready. 🚀</div>
    <div style={{display:"flex",gap:8}}>{[...Array(8)].map((_,i)=><div key={i} style={{width:10,height:10,borderRadius:5,background:C.gold,opacity:Math.random(),animation:`pulse ${0.3+Math.random()*0.4}s infinite alternate`}}/>)}</div>
    <style>{`@keyframes bounce{from{transform:translateY(0)}to{transform:translateY(-20px)}}@keyframes pulse{from{opacity:0.2}to{opacity:1}}`}</style>
  </div>;

  if(animating&&chosen==="regular") return <div style={{position:"fixed",inset:0,background:"linear-gradient(135deg,#0f1f35,#0d3d3a)",zIndex:5000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
    <div style={{fontSize:64,marginBottom:16}}>🏆</div>
    <div style={{fontSize:28,fontWeight:900,color:C.teal,marginBottom:8,textAlign:"center"}}>Building Strong!</div>
    <div style={{fontSize:16,color:"rgba(255,255,255,0.8)",textAlign:"center",marginBottom:24}}>Your 30-day journey starts now. Let's build something great. 💪</div>
    <div style={{width:200,height:6,background:"rgba(255,255,255,0.1)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",background:C.teal,borderRadius:3,animation:"grow 2s ease-out forwards"}}/></div>
    <style>{`@keyframes grow{from{width:0%}to{width:100%}}`}</style>
  </div>;

  return <div style={{position:"fixed",inset:0,background:"linear-gradient(135deg,#0f1f35,#16304f)",zIndex:5000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,overflowY:"auto"}}>
    <div style={{maxWidth:480,width:"100%"}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{fontSize:32,marginBottom:8}}>🎯</div>
        <div style={{fontSize:24,fontWeight:900,color:"white",marginBottom:6}}>Choose Your Path</div>
        <div style={{fontSize:14,color:"rgba(255,255,255,0.65)",lineHeight:1.5}}>Hey {rep.name}! Now that you've watched the welcome video, it's time to choose your training path. Both paths lead to the same goal — pick the one that fits your life right now.</div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {/* Fast Start */}
        <button onClick={()=>choose("fast")} style={{background:"linear-gradient(135deg,rgba(251,191,36,0.12),rgba(251,191,36,0.06))",border:"2px solid "+C.gold,borderRadius:16,padding:"20px",textAlign:"left",cursor:"pointer",transition:"transform 0.1s",width:"100%"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
            <div style={{fontSize:32}}>⚡</div>
            <div>
              <div style={{fontSize:18,fontWeight:800,color:C.gold}}>Fast Start</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.6)"}}>7–14 days to complete</div>
            </div>
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.75)",lineHeight:1.6,marginBottom:12}}>High intensity, full commitment. You're ready to go all in right now. This path is for people who want to get licensed and writing business as fast as possible.</div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {["Daily focused activity","Faster path to income","High accountability","Best for: full-time focus"].map((item,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"rgba(255,255,255,0.65)"}}>
              <span style={{color:C.gold}}>✓</span>{item}
            </div>)}
          </div>
          <div style={{marginTop:14,padding:"10px",background:C.gold,borderRadius:10,textAlign:"center",fontSize:14,fontWeight:700,color:"#0f1f35"}}>I'm Going Fast Start! ⚡</div>
        </button>

        {/* Regular Start */}
        <button onClick={()=>choose("regular")} style={{background:"linear-gradient(135deg,rgba(14,165,160,0.12),rgba(14,165,160,0.06))",border:"2px solid "+C.teal,borderRadius:16,padding:"20px",textAlign:"left",cursor:"pointer",width:"100%"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
            <div style={{fontSize:32}}>🏆</div>
            <div>
              <div style={{fontSize:18,fontWeight:800,color:C.teal}}>Regular Start</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.6)"}}>30 days to complete</div>
            </div>
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.75)",lineHeight:1.6,marginBottom:12}}>Steady, consistent pace. You're building a strong foundation. This path gives you 30 days to learn, practice, and prepare — perfect if you're balancing other commitments.</div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {["Balanced daily activity","30 days to get licensed","Strong foundation building","Best for: part-time or balanced schedule"].map((item,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"rgba(255,255,255,0.65)"}}>
              <span style={{color:C.teal}}>✓</span>{item}
            </div>)}
          </div>
          <div style={{marginTop:14,padding:"10px",background:C.teal,borderRadius:10,textAlign:"center",fontSize:14,fontWeight:700,color:"white"}}>I'm Taking Regular Start 🏆</div>
        </button>
      </div>

      <div style={{textAlign:"center",marginTop:16,fontSize:13,color:"rgba(255,255,255,0.35)"}}>Your choice will be shared with your trainer. You can discuss it with them at any time.</div>
    </div>
  </div>;
}

// ── VIDEO EMBED HELPER ──
// Returns null for Google Drive on mobile (use direct link instead)
const isMobileBrowser = () => /iPhone|iPad|iPod|Android/i.test(typeof navigator!=="undefined"?navigator.userAgent:"");
function buildVideoSrc(videoUrl) {
  const yt = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  if(yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&playsinline=1`;
  if(videoUrl.includes("drive.google.com")){
    if(isMobileBrowser()) return null; // Mobile can't reliably embed Drive — use direct link
    let src = videoUrl.replace("/view","/preview").replace("/edit","/preview");
    if(!src.includes("?")) src+="?embedded=true";
    else if(!src.includes("embedded=true")) src+="&embedded=true";
    return src;
  }
  return videoUrl;
}

function VideoPopupModal({videoUrl,repName,emoji,title,subtitle,onClose}) {
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:"white",borderRadius:18,width:"100%",maxWidth:480,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
      <div style={{background:`linear-gradient(135deg,#0f1f35,#16304f)`,padding:"20px 20px 16px",textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:6}}>{emoji}</div>
        <div style={{fontSize:18,fontWeight:800,color:"white",marginBottom:4}}>{title}</div>
        <div style={{fontSize:14,color:"rgba(255,255,255,0.65)"}}>{subtitle.replace("{name}",repName)}</div>
      </div>
      <div style={{position:"relative",paddingBottom:"56.25%",background:"#000"}}>
        {(()=>{
          const src=buildVideoSrc(videoUrl);
          if(!src) return <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,background:"#0f1f35"}}>
            <div style={{fontSize:32}}>▶</div>
            <div style={{fontSize:14,color:"white",fontWeight:600,textAlign:"center",padding:"0 20px"}}>Tap below to watch the video</div>
            <a href={videoUrl} target="_blank" rel="noreferrer" style={{padding:"10px 24px",background:C.teal,color:"white",borderRadius:10,fontSize:14,fontWeight:700,textDecoration:"none"}}>Watch Video</a>
          </div>;
          return <iframe src={src} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:"none"}} allow="autoplay; fullscreen" allowFullScreen title="Video"/>;
        })()}
      </div>
      <div style={{padding:"14px 20px",textAlign:"center",background:"white"}}>
        <a href={videoUrl} target="_blank" rel="noreferrer" style={{display:"block",fontSize:13,color:C.teal,textDecoration:"none",marginBottom:10}}>▶ Open video in new tab</a>
        <button onClick={onClose} style={{width:"100%",padding:"11px",borderRadius:10,background:`linear-gradient(135deg,#0ea5a0,#0891b2)`,border:"none",color:"white",fontSize:14,fontWeight:700,cursor:"pointer"}}>
          Got it — Let's Get Started! 🚀
        </button>
      </div>
    </div>
  </div>;
}

// ── REWATCHABLE VIDEO MODAL (no localStorage tracking, just plays) ──
function RewatchVideoModal({videoUrl,title,onClose}) {
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:"white",borderRadius:18,width:"100%",maxWidth:480,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
      <div style={{background:`linear-gradient(135deg,#0f1f35,#16304f)`,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:15,fontWeight:700,color:"white"}}>{title}</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,0.7)",fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
      </div>
      <div style={{position:"relative",paddingBottom:"56.25%",background:"#000"}}>
        {(()=>{
          const src=buildVideoSrc(videoUrl);
          if(!src) return <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,background:"#0f1f35"}}>
            <div style={{fontSize:32}}>▶</div>
            <div style={{fontSize:14,color:"white",fontWeight:600,textAlign:"center",padding:"0 20px"}}>Tap below to watch the video</div>
            <a href={videoUrl} target="_blank" rel="noreferrer" style={{padding:"10px 24px",background:C.teal,color:"white",borderRadius:10,fontSize:14,fontWeight:700,textDecoration:"none"}}>Watch Video</a>
          </div>;
          return <iframe src={src} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:"none"}} allow="autoplay; fullscreen" allowFullScreen title="Video"/>;
        })()}
      </div>
      <div style={{padding:"10px 16px",textAlign:"center"}}>
        <a href={videoUrl} target="_blank" rel="noreferrer" style={{fontSize:13,color:C.teal,textDecoration:"none"}}>▶ Open video in new tab</a>
      </div>
    </div>
  </div>;
}

export default function App() {
  const [data,setData]=useState({});
  const [loading,setLoading]=useState(true);
  const [session,setSession]=useState(null);
  const [section,setSection]=useState("dashboard");
  const [selRepId,setSelRepId]=useState(null);
  const [mobileOpen,setMobileOpen]=useState(false);
  const [winWidth,setWinWidth]=useState(window.innerWidth);
  const isDesktopView=winWidth>=900;
  useEffect(()=>{
    const handle=()=>{setWinWidth(window.innerWidth);if(window.innerWidth>=768)setMobileOpen(false);};
    window.addEventListener("resize",handle);
    return()=>window.removeEventListener("resize",handle);
  },[]);
  const [showTour,setShowTour]=useState(false);
  const [showPhone,setShowPhone]=useState(false);
  const [showNeedHelp,setShowNeedHelp]=useState(false);

  // Subscribe to Firebase
  const lastSaveRef=useRef(0);
  const versionRef=useRef(0);

  // ── REPS COLLECTION (each rep is now its own Firestore document) ──
  const repsFromCollectionRef=useRef([]);
  const repsCollectionLoadedRef=useRef(false);
  const legacyRepsCapturedRef=useRef(null); // captured once from the old embedded array, for one-time migration
  const migrationDoneRef=useRef(false);
  const [appdataLoaded,setAppdataLoaded]=useState(false);
  const [repsLoaded,setRepsLoaded]=useState(false);

  useEffect(()=>{
    if(appdataLoaded&&repsLoaded) setLoading(false);
  },[appdataLoaded,repsLoaded]);

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"reps"),(snap)=>{
      const list=[];
      snap.forEach(docSnap=>{ list.push({...docSnap.data(),id:docSnap.id}); });
      repsFromCollectionRef.current=list;
      repsCollectionLoadedRef.current=true;
      setRepsLoaded(true);
      setData(prev=>({...prev,reps:list}));
    },(err)=>{console.error("Reps collection read error",err);setRepsLoaded(true);});
    return ()=>unsub();
  },[]);

  useEffect(()=>{
    const unsub=onSnapshot(doc(db,"appdata","main"),(snap)=>{
      if(snap.exists()){
        try{
          const d=JSON.parse(snap.data().payload||"{}");
          versionRef.current=d.__v||0;
          // Capture the legacy embedded reps array once, so we can migrate it into its own collection
          if(legacyRepsCapturedRef.current===null){
            legacyRepsCapturedRef.current=Array.isArray(d.reps)?d.reps:[];
          }
          const dataForState = repsCollectionLoadedRef.current
            ? {...d, reps: repsFromCollectionRef.current}
            : d;
          if(Date.now()-lastSaveRef.current>5000){
            // Migrate photos to localStorage to free Firebase space
            const profilePhotos=dataForState.profilePhotos||{};
            const wofPhotos=dataForState.wofPhotos||{};
            let needsClean=false;
            Object.entries(profilePhotos).forEach(([id,photo])=>{
              if(photo){
                try{localStorage.setItem("profilePhoto_"+id,photo);}catch(e){}
                needsClean=true;
              }
            });
            Object.entries(wofPhotos).forEach(([id,photo])=>{
              if(photo){
                try{localStorage.setItem("wofPhoto_"+id,photo);}catch(e){}
                needsClean=true;
              }
            });
            if(needsClean&&(Object.keys(profilePhotos).length>0||Object.keys(wofPhotos).length>0)){
              const cleaned={...dataForState,profilePhotos:{},wofPhotos:{}};
              setData(cleaned);
              saveToFirebase(cleaned); // saveToFirebase always strips reps before writing
            } else {
              setData(dataForState);
            }
          }
        }catch{}
      }
      setAppdataLoaded(true);
    },(err)=>{console.error("Firebase read error",err);setAppdataLoaded(true);});
    return ()=>unsub();
  },[]);

  // ── ONE-TIME MIGRATION: move any legacy embedded reps into the new reps collection ──
  useEffect(()=>{
    if(migrationDoneRef.current) return;
    if(!repsLoaded||!appdataLoaded) return;
    if(legacyRepsCapturedRef.current===null) return;
    const legacyReps=legacyRepsCapturedRef.current;
    const collectionReps=repsFromCollectionRef.current;
    if(legacyReps.length===0){ migrationDoneRef.current=true; return; }
    if(collectionReps.length>0){ migrationDoneRef.current=true; return; } // already migrated (by this device or another)
    migrationDoneRef.current=true; // claim immediately so we don't double-run
    (async()=>{
      try{
        console.log(`Migrating ${legacyReps.length} rep(s) into their own Firestore collection...`);
        for(const rep of legacyReps){
          if(rep&&rep.id){
            await setDoc(doc(db,"reps",rep.id),rep);
          }
        }
        // Remove the now-migrated reps array from appdata/main so it's never embedded there again
        const mainSnap=await getDoc(doc(db,"appdata","main"));
        if(mainSnap.exists()){
          const mainData=JSON.parse(mainSnap.data().payload||"{}");
          const { reps:_omit, ...rest } = mainData;
          await setDoc(doc(db,"appdata","main"),{payload:JSON.stringify(rest)});
        }
        console.log("Rep migration complete — reps now live in their own collection.");
      }catch(e){
        console.error("Rep migration failed, will retry next load",e);
        migrationDoneRef.current=false;
      }
    })();
  },[repsLoaded,appdataLoaded]);

  const dataRef=useRef(data);
  useEffect(()=>{dataRef.current=data;},[data]);

  const [saveConflict,setSaveConflict]=useState(false);
  const saveQueueRef=useRef(Promise.resolve());
  const upd=useCallback((d)=>{
    setData(d);

    // ── Sync reps individually to their own collection (diff-based, so only changed reps write) ──
    const newReps=Array.isArray(d.reps)?d.reps:[];
    const prevReps=Array.isArray(dataRef.current?.reps)?dataRef.current.reps:[];
    const prevById={};
    prevReps.forEach(r=>{ if(r&&r.id) prevById[r.id]=r; });
    const newIds=new Set();
    newReps.forEach(rep=>{
      if(!rep||!rep.id) return;
      newIds.add(rep.id);
      const prevRep=prevById[rep.id];
      if(!prevRep||JSON.stringify(prevRep)!==JSON.stringify(rep)){
        setDoc(doc(db,"reps",rep.id),rep).catch(e=>console.error("Rep save error",rep.id,e));
      }
    });
    prevReps.forEach(rep=>{
      if(rep&&rep.id&&!newIds.has(rep.id)){
        deleteDoc(doc(db,"reps",rep.id)).catch(e=>console.error("Rep delete error",rep.id,e));
      }
    });

    // ── Save everything else to the shared appdata document (reps excluded — own collection now) ──
    const profilePhotos=d.profilePhotos||{};
    const wofPhotos=d.wofPhotos||{};
    Object.entries(profilePhotos).forEach(([id,photo])=>{if(photo)try{localStorage.setItem("profilePhoto_"+id,photo);}catch(e){}});
    Object.entries(wofPhotos).forEach(([id,photo])=>{if(photo)try{localStorage.setItem("wofPhoto_"+id,photo);}catch(e){}});
    const { reps:_omitReps, ...rest } = d;
    const lean={...rest,profilePhotos:{},wofPhotos:{}};
    // Saves are queued one-at-a-time (not fired in parallel) so quick back-to-back edits
    // in the SAME browser tab never race each other and trigger a false "conflict" warning.
    // The version is read fresh at the moment this save actually runs, after any earlier
    // queued save has finished and updated versionRef.
    saveQueueRef.current = saveQueueRef.current.then(()=>{
      const expectedVersion=versionRef.current;
      return saveToFirebaseVersioned(lean,expectedVersion).then(result=>{
        if(result&&result.conflict){
          // A save from ANOTHER tab/device (not this one — same-tab races are ruled out above)
          // landed in between. Don't let this write silently win.
          setSaveConflict(true);
        } else if(result&&result.nextVersion){
          versionRef.current=result.nextVersion;
          lastSaveRef.current=Date.now();
        }
      });
    }).catch(e=>console.error("Queued save error",e));
  },[]);

  // Track login — must be before any conditional returns
  useEffect(()=>{
    if(session&&data&&Object.keys(data).length>0){
      const today=new Date().toISOString().split("T")[0];
      const logins=data.loginHistory||{};
      const userLogins=logins[session.id]||[];
      const todayEntry=userLogins.find(l=>l.date===today);
      if(!todayEntry){
        const updated={...logins,[session.id]:[...userLogins,{date:today,ts:new Date().toISOString()}].slice(-60)};
        upd({...data,loginHistory:updated});
      }
    }
  },[session?.id]);

  const [showWelcome,setShowWelcome]=useState(false);
  const [showChoosePath,setShowChoosePath]=useState(false);
  const [showCommitmentPopup,setShowCommitmentPopup]=useState(false);
  const [birthdayInfo,setBirthdayInfo]=useState(null);
  const [showLicensedVideo,setShowLicensedVideo]=useState(false);
  const [showFieldTrainerVideo,setShowFieldTrainerVideo]=useState(false);
  const [showRvpPathVideo,setShowRvpPathVideo]=useState(false);

  const handleLogin=(role,id,userData,newPin)=>{
    if(role==="rep"&&newPin){
      const updated={...data,reps:(data.reps||[]).map(r=>r.id===id?{...r,repPin:newPin}:r)};
      upd(updated);
    }
    setSession({role,id,name:userData?.name||(role==="admin"?"Admin":"User")});
    setSection("dashboard");
    if(role==="trainer"){
      const trainer=(data.trainers||[]).find(t=>t.id===id);
      if(trainer&&!(trainer?.seenVideos?.fieldTrainer)&&data.fieldTrainerVideoUrl){
        setShowFieldTrainerVideo(true);
      }
    }
    if(role==="admin"||role==="superadmin"){
      const admin=(data.admins||[]).find(a=>a.id===id);
      if(admin&&!(admin?.seenVideos?.rvpPath)&&data.rvpPathVideoUrl){
        setShowRvpPathVideo(true);
      }
    }
    if(role==="rep"){
      const rep=(data.reps||[]).find(r=>r.id===id);
      // Welcome video — Fast Start / Regular Start, first login ever
      const isNewRep=rep&&(rep.track==="fast"||rep.track==="regular");
      if(isNewRep&&!(rep?.seenVideos?.welcome)&&data.welcomeVideoUrl){
        setShowWelcome(true);
      }
      // If rep has no track yet — show welcome video first (if available), then Choose Your Path
      // Choose Your Path is triggered from the welcome video onClose, or immediately if no welcome video
      if(rep&&!rep.track){
        if(data.welcomeVideoUrl&&!(rep?.seenVideos?.welcome)){
          setShowWelcome(true);
          // Choose Your Path will show after welcome video closes (handled in render)
        } else {
          setShowChoosePath(true);
        }
      }
      // Licensed Now What video — fires once when on licensed track
      // Covers both: approval flow (nextLevelGranted) AND directly added as licensed (track==="licensed")
      const isLicensedRep=rep&&(rep.nextLevelGranted||rep.track==="licensed");
      if(isLicensedRep&&!(rep?.seenVideos?.licensed)&&data.licensedVideoUrl){
        setShowLicensedVideo(true);
      }
      // Field Trainer video — fires once when access is granted
      if(rep&&rep.fieldTrainerGranted&&!(rep?.seenVideos?.fieldTrainer)&&data.fieldTrainerVideoUrl){
        setShowFieldTrainerVideo(true);
      }
      // RVP Path video — fires once when access is granted
      if(rep&&rep.rvpPathGranted&&!(rep?.seenVideos?.rvpPath)&&data.rvpPathVideoUrl){
        setShowRvpPathVideo(true);
      }
      // Commitment popup — show on first login of new Primerica month for licensed/trainer reps
      if(rep&&(rep.track==="licensed"||rep.fieldTrainerGranted)){
        const pm=getCurrentPrimerMonth(data.primerMonthEnds||[]);
        const hasCommitted=rep.commitments?.[pm.key];
        if(!hasCommitted){
          setShowCommitmentPopup(true);
        }
      }
      // Birthday check — show greeting if today is their birthday
      if(rep&&rep.birthday){
        try{
          const bd=new Date(rep.birthday+"T12:00:00");
          const now2=new Date();
          if(bd.getMonth()===now2.getMonth()&&bd.getDate()===now2.getDate()){
            const age=now2.getFullYear()-bd.getFullYear();
            setBirthdayInfo({name:rep.name});
          }
        }catch(e){}
      }
    }
    const tourKey=`tour_shown_${role}_${id}`;
    if(!localStorage.getItem(tourKey)){setShowTour(true);localStorage.setItem(tourKey,"done");}
  };

  const signOut=()=>{setSession(null);setSelRepId(null);};

  // Smart phone back button navigation
  useEffect(()=>{
    if(!session) return;
    // Push initial state so we have somewhere to go back to
    window.history.pushState({appNav:true},'',window.location.href);

    const handler=(e)=>{
      // Always re-push so we never actually leave the page
      window.history.pushState({appNav:true},'',window.location.href);

      try {
        // Priority 1: Close any open modals/popups first
        if(showCommitmentPopup){setShowCommitmentPopup(false);return;}
        if(showChoosePath){setShowChoosePath(false);return;}
        if(showWelcome){setShowWelcome(false);return;}
        if(showLicensedVideo){setShowLicensedVideo(false);return;}
        if(showFieldTrainerVideo){setShowFieldTrainerVideo(false);return;}
        if(showRvpPathVideo){setShowRvpPathVideo(false);return;}
        if(birthdayInfo){setBirthdayInfo(null);return;}

        // Priority 2: Close rep profile if open
        if(selRepId){setSelRepId(null);return;}

        // Priority 3: Go back to dashboard if on another section
        if(section&&section!=="dashboard"){setSection("dashboard");setSelRepId(null);return;}

        // Priority 4: Already on dashboard — do nothing (don't sign out)
      } catch(err) {
        // Safety net — never crash on back button
        console.warn("Back nav error:",err);
      }
    };

    window.addEventListener('popstate',handler);
    return()=>window.removeEventListener('popstate',handler);
  },[session,selRepId,section,showCommitmentPopup,showChoosePath,showWelcome,showLicensedVideo,showFieldTrainerVideo,showRvpPathVideo,birthdayInfo]);

  if(loading) return <div style={{minHeight:"100vh",background:C.navy,display:"flex",alignItems:"center",justifyContent:"center",color:"white",flexDirection:"column",gap:12}}>
    <div style={{width:40,height:40,border:`3px solid ${C.teal}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <div style={{fontSize:14,color:"rgba(255,255,255,0.5)"}}>Loading...</div>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;

  // Track login
  // (handled above before conditional returns)

  if(!session) return <LoginScreen data={data} onLogin={handleLogin}/>;
  // Check if PIN was reset and needs to be changed
  const personRecord = [...(data.reps||[]),(data.trainers||[]),...(data.admins||[])].flat().find(p=>p.id===session.id);
  if(personRecord?.pinReset) return <ForceNewPin session={session} data={data} onUpdate={upd} onDone={()=>upd({...data})}/>;

  if(session.role==="rep"){
    const rep=(data.reps||[]).find(r=>r.id===session.id);
    if(!rep) return <div style={{padding:24,color:C.textMid}}>Not found - ask your trainer to add you.</div>;
    return <div style={{minHeight:"100vh",background:C.surface,display:"flex",flexDirection:"column"}}>
      {showCommitmentPopup&&(()=>{const pm=getCurrentPrimerMonth(data.primerMonthEnds||[]);return <CommitmentPopup rep={rep} primerMonth={pm} onSave={(commitment)=>{upd({...dataRef.current,reps:(dataRef.current.reps||[]).map(r=>r.id===rep.id?{...r,commitments:{...(r.commitments||{}),[pm.key]:commitment}}:r)});setShowCommitmentPopup(false);}} onClose={()=>{setShowCommitmentPopup(false);}}/>;})()}
      {showChoosePath&&<ChooseYourPath rep={rep} onChoose={(track)=>{
        const chosenAt=new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
        upd({...dataRef.current,reps:(dataRef.current.reps||[]).map(r=>r.id===rep.id?{...r,track,trackChosenAt:chosenAt}:r)});
        setShowChoosePath(false);
      }}/>}
      {birthdayInfo&&<BirthdayModal name={birthdayInfo.name} age={birthdayInfo.age} onClose={()=>setBirthdayInfo(null)}/>}
      {showWelcome&&data.welcomeVideoUrl&&<VideoPopupModal videoUrl={data.welcomeVideoUrl} repName={rep.name} emoji="🎉" title="Welcome to the Team!" subtitle="Hey {name}! Watch this short welcome video to get started." onClose={()=>{upd({...dataRef.current,reps:(dataRef.current.reps||[]).map(r=>r.id===session.id?{...r,seenVideos:{...(r.seenVideos||{}),welcome:true}}:r)});setShowWelcome(false);if(!rep.track){setShowChoosePath(true);}}}/>}
      {showLicensedVideo&&data.licensedVideoUrl&&<VideoPopupModal videoUrl={data.licensedVideoUrl} repName={rep.name} emoji="🎓" title="Licensed — Now What?" subtitle="Hey {name}! Watch this video to learn what's expected of you on your new checklist." onClose={()=>{upd({...dataRef.current,reps:(dataRef.current.reps||[]).map(r=>r.id===session.id?{...r,seenVideos:{...(r.seenVideos||{}),licensed:true}}:r)});setShowLicensedVideo(false);}}/>}
      {showFieldTrainerVideo&&data.fieldTrainerVideoUrl&&<VideoPopupModal videoUrl={data.fieldTrainerVideoUrl} repName={rep.name} emoji="🧑‍🏫" title="Welcome, Field Trainer!" subtitle="Hey {name}! Watch this video to learn what's expected of you as a Field Trainer." onClose={()=>{upd({...dataRef.current,reps:(dataRef.current.reps||[]).map(r=>r.id===session.id?{...r,seenVideos:{...(r.seenVideos||{}),fieldTrainer:true}}:r)});setShowFieldTrainerVideo(false);}}/>}
      {showRvpPathVideo&&data.rvpPathVideoUrl&&<VideoPopupModal videoUrl={data.rvpPathVideoUrl} repName={rep.name} emoji="🚀" title="Welcome to the RVP Path!" subtitle="Hey {name}! Watch this video to learn what's expected of you on the RVP Path." onClose={()=>{upd({...dataRef.current,reps:(dataRef.current.reps||[]).map(r=>r.id===session.id?{...r,seenVideos:{...(r.seenVideos||{}),rvpPath:true}}:r)});setShowRvpPathVideo(false);}}/>}
      {showTour&&<AppTour role="rep" onClose={()=>setShowTour(false)}/>}
      {showPhone&&<AddToPhoneModal onClose={()=>setShowPhone(false)}/>}
      {showNeedHelp&&<NeedHelpModal rep={rep} data={data} onUpdate={upd} onClose={()=>setShowNeedHelp(false)}/>}
      {saveConflict&&<div style={{background:"#fef2f2",borderBottom:"2px solid #dc2626",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexShrink:0}}>
        <div style={{fontSize:13,color:"#991b1b",fontWeight:600}}>⚠️ Someone else saved a change at the same time as you. Your last change was NOT saved — please refresh the page and try again.</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>window.location.reload()} style={{padding:"6px 12px",borderRadius:7,border:"none",background:"#dc2626",color:"white",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>Refresh Now</button>
          <button onClick={()=>setSaveConflict(false)} style={{padding:"6px 10px",borderRadius:7,border:"1px solid #dc262633",background:"white",color:"#991b1b",fontSize:12,fontWeight:600,cursor:"pointer"}}>Dismiss</button>
        </div>
      </div>}
      <div style={{background:C.navy,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{color:"white",fontWeight:700,fontSize:14}}>NextLevel Field Training Hub</div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setShowTour(true)} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.6)",padding:"4px 9px",borderRadius:6,cursor:"pointer",fontSize:13}}>Tour</button>
          <button onClick={()=>setShowNeedHelp(true)} style={{background:"rgba(255,100,100,0.25)",border:"1px solid rgba(255,100,100,0.4)",color:"white",padding:"4px 9px",borderRadius:6,cursor:"pointer",fontSize:13,fontWeight:600}}>Need Help</button>
          <button onClick={()=>setShowPhone(true)} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.6)",padding:"4px 9px",borderRadius:6,cursor:"pointer",fontSize:13}}>Add to Phone</button>
          <button onClick={signOut} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.6)",padding:"4px 9px",borderRadius:6,cursor:"pointer",fontSize:13}}>Sign Out</button>
        </div>
      </div>
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{width:"100%"}}><AnnouncementsBanner data={data} onUpdate={upd} userRole="rep"/></div>
        <div style={{width:"100%"}}><DailyEventsBanner data={data} onUpdateData={upd} userRole="rep"/></div>
        <div style={{flex:1,overflow:"hidden",display:"flex"}}><RepView rep={rep} data={data} onUpdate={(id,u)=>upd({...dataRef.current,reps:(dataRef.current.reps||[]).map(r=>r.id===id?u:r)})} onUpdateData={upd} readOnly={false} isOwnView={true} key={rep.id} onOpenCommitment={()=>setShowCommitmentPopup(true)}/></div>
      </div>
    </div>;
  }

  const selRep=selRepId?(data.reps||[]).find(r=>r.id===selRepId):null;
  const navTo=(s)=>{setSection(s);setSelRepId(null);};

  const renderContent=()=>{
    if(selRep&&(section==="reps"||section==="dashboard")) {const latestRep=(dataRef.current.reps||[]).find(r=>r.id===selRep.id)||selRep;return <RepProfile rep={latestRep} data={dataRef.current} onUpdate={(id,u)=>upd({...dataRef.current,reps:(dataRef.current.reps||[]).map(r=>r.id===id?u:r)})} onUpdateData={upd} onBack={()=>setSelRepId(null)} onDelete={(id)=>{upd({...dataRef.current,reps:(dataRef.current.reps||[]).filter(r=>r.id!==id)});setSelRepId(null);}}/>;}
    if(section==="dashboard") return <Dashboard data={data} onUpdate={upd} userRole={session.role} userId={session.id} onSelectRep={(id)=>{setSelRepId(id);setSection("dashboard");}}/>;
    if(section==="reps") return <MyRepsPage data={data} onUpdate={upd} userRole={session.role} userId={session.id} onSelectRep={(id)=>{setSelRepId(id);setSection("reps");}}/>;
    if(section==="production") {
      const staffRecord=(data.trainers||[]).find(t=>t.id===session.id)||(data.admins||[]).find(a=>a.id===session.id)||{};
      const PROMO_LEVELS=[{key:"rep",label:"Rep",pct:25},{key:"sr_rep",label:"Senior Rep",pct:35},{key:"dl",label:"District Leader",pct:50},{key:"divl",label:"Division Leader",pct:60},{key:"rl",label:"Regional Leader",pct:70},{key:"srl",label:"Senior Regional Leader",pct:80},{key:"rvp",label:"RVP",pct:110}];
      const saveStaff=(updated)=>{
        const isTrainer=(data.trainers||[]).some(t=>t.id===session.id);
        if(isTrainer) upd({...data,trainers:(data.trainers||[]).map(t=>t.id===session.id?updated:t)});
        else upd({...data,admins:(data.admins||[]).map(a=>a.id===session.id?updated:a)});
      };
      // Create a pseudo-rep object so LicensedPremiumEntry can work with staff data
      const pseudoRep={
        ...staffRecord,
        id:session.id,
        selfPremium:(data.myProduction||{})[session.id]?.lifeApps||[],
        promotionLevel:staffRecord.promotionLevel||"rep",
        monthlyIncomeGoal:staffRecord.monthlyIncomeGoal||"",
      };
      const updatePseudoRep=(updated)=>{
        // Save promotionLevel and monthlyIncomeGoal to staff record
        const updatedStaff={...staffRecord,promotionLevel:updated.promotionLevel,monthlyIncomeGoal:updated.monthlyIncomeGoal};
        const isTrainer=(data.trainers||[]).some(t=>t.id===session.id);
        const newData={...data,
          myProduction:{...(data.myProduction||{}),[session.id]:{...((data.myProduction||{})[session.id]||{}),lifeApps:updated.selfPremium||[]}},
        };
        if(isTrainer) newData.trainers=(data.trainers||[]).map(t=>t.id===session.id?updatedStaff:t);
        else newData.admins=(data.admins||[]).map(a=>a.id===session.id?updatedStaff:a);
        upd(newData);
      };
      return <div>
        <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:14}}>Production</div>
        <ProdDash data={data} onUpdateData={upd}/>
        {/* Promotion Level Selector */}
        <Card style={{marginBottom:12,border:`1px solid ${C.gold}33`}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8}}>My Contract Level</div>
          <div style={{fontSize:13,color:C.textMid,marginBottom:8}}>Select your current Primerica promotion level. Updates commission calculations automatically.</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
            {PROMO_LEVELS.map(p=><button key={p.key} onClick={()=>saveStaff({...staffRecord,promotionLevel:p.key})} style={{padding:"6px 8px",borderRadius:7,border:`1px solid ${(staffRecord.promotionLevel||"rep")===p.key?C.gold:C.border}`,background:(staffRecord.promotionLevel||"rep")===p.key?C.gold+"11":"white",cursor:"pointer",textAlign:"left"}}>
              <div style={{fontSize:13,fontWeight:700,color:(staffRecord.promotionLevel||"rep")===p.key?C.gold:C.text}}>{p.label}</div>
              <div style={{fontSize:12,color:C.textMid}}>{p.pct}%</div>
            </button>)}
          </div>
        </Card>
        {/* Life Apps with commission tracking */}
        <LicensedPremiumEntry rep={pseudoRep} onUpdate={updatePseudoRep}/>
        <QuickRecruitLog person={staffRecord} onSave={(log)=>saveStaff({...staffRecord,myRecruitLog:log})}/>
        {/* Investments */}
        <MyProd myProd={(data.myProduction||{})[session.id]||{}} onUpdate={p=>{
          const newData={...data,myProduction:{...(data.myProduction||{}),[session.id]:p}};
          const isAdminRole=session.role==="admin"||session.role==="superadmin";
          if(isAdminRole&&p.investments){
            newData.admins=(data.admins||[]).map(a=>a.id===session.id?{...a,investments:p.investments}:a);
          }
          upd(newData);
        }} investmentsOnly={true}/>
      </div>;
    }
    if(section==="schedule") return <div><div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:14}}>Team Schedule</div><ScheduleView data={data} onUpdate={upd} userRole={session.role}/></div>;
    if(section==="scripts") return <ScriptsPage data={data} onUpdate={upd} userRole={session.role}/>;
    if(section==="resources") return <ResourceLibrary data={data} onUpdate={upd} userRole={session.role}/>;
    if(section==="advancement") return <AdvancementLibrary data={data} onUpdate={upd} userRole={session.role}/>;
    if(section==="scorecard") return <ScorecardPage data={data} onUpdate={upd} userId={session.id} userRole={session.role}/>;
    if(section==="wallfame") return <WallOfFame data={data} onUpdate={upd} userRole={session.role}/>;
    if(section==="myactivity"&&(session.role==="admin"||session.role==="superadmin"||session.role==="trainer")) return <MyActivityReport session={session} data={data} onUpdate={upd}/>;
    if(section==="commitmentcats"&&(session.role==="admin"||session.role==="superadmin")) return <CommitmentCategoryEditor data={data} onUpdate={upd}/>;
    if(section==="checklisteditor"&&(session.role==="admin"||session.role==="superadmin")) return <ChecklistEditor data={data} onUpdate={upd}/>;
    if(section==="myprofile") return <MyProfilePage session={session} data={data} onUpdate={upd}/>;
    if(section==="mytasks") return <MyTasksPage session={session} data={data} onUpdate={upd}/>;
    if(section==="prospects") return <ProspectsPage session={session} data={data} onUpdate={upd}/>;
    if(section==="leadlink") return <LeadLinkPage session={session} data={data} onUpdate={upd}/>;
    if(section==="mypipeline") return <MyPipelinePage session={session} data={data} onUpdate={upd}/>;
    if(section==="accountability") return <AccountabilityDashboard data={data} onUpdate={upd} userRole={session.role} userId={session.id}/>;
    // Admin trainer tools — only if alsoRecruits is enabled
    const adminRecord = (data.admins||[]).find(a=>a.id===session.id);
    const alsoRecruits = adminRecord?.alsoRecruits||session.role==="superadmin";
    if(section==="careerpath"&&alsoRecruits) return <TrainerCareerPath data={data} onUpdate={upd} session={session}/>;
    if(section==="mypipeline"&&alsoRecruits) return <MyPipelinePage session={session} data={data} onUpdate={upd}/>;
    if(section==="teamleads") return <div><TeamLeads userRole={session.role}/><div style={{marginTop:14}}><div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:10}}>Rep Pipelines</div><AdminPipeline data={data} onUpdate={upd}/></div></div>;
    if(section==="emailtemplates") return <EmailTemplatesPage data={data} onUpdate={upd} userRole={session.role} reps={data.reps||[]} trainers={data.trainers||[]} admins={data.admins||[]}/>;    if(section==="objectiontraining") return <ObjectionTrainingPage data={data} onUpdate={upd} userRole={session.role}/>;
    if(section==="prospecting") return <ProspectingPage data={data} onUpdate={upd} userRole={session.role}/>;
    if(section==="planner") return <DailyPlanner session={session} db={db}/>;    if(section==="quickmsg") return <QuickMessages data={data} onUpdate={upd} userRole={session.role}/>;
    if(section==="careerpath") return <TrainerCareerPath data={data} onUpdate={upd} session={session}/>;
    if(section==="team") return <div><div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:14}}>Team Management</div><ManageTeamPage data={data} onUpdate={upd}/></div>;
    return null;
  };

  const rewatchVideo = session.role==="trainer"
    ? (data.fieldTrainerVideoUrl?{url:data.fieldTrainerVideoUrl,label:"Rewatch: Field Trainer",title:"Welcome, Field Trainer!",trigger:()=>setShowFieldTrainerVideo(true)}:null)
    : (session.role==="admin"||session.role==="superadmin")
    ? (data.rvpPathVideoUrl?{url:data.rvpPathVideoUrl,label:"Rewatch: RVP Path",title:"Welcome to the RVP Path!",trigger:()=>setShowRvpPathVideo(true)}:null)
    : null;

  return <div style={{display:"flex",height:"100vh",background:C.surface,overflow:"hidden"}}>
    {showTour&&<AppTour role={session.role} onClose={()=>setShowTour(false)}/>}
    {showPhone&&<AddToPhoneModal onClose={()=>setShowPhone(false)}/>}
    {showFieldTrainerVideo&&data.fieldTrainerVideoUrl&&<VideoPopupModal videoUrl={data.fieldTrainerVideoUrl} repName={session.name} emoji="🧑‍🏫" title="Welcome, Field Trainer!" subtitle="Hey {name}! Watch this video to learn what's expected of you as a Field Trainer." onClose={()=>{
      const updatedTrainers=(data.trainers||[]).map(t=>t.id===session.id?{...t,seenVideos:{...(t.seenVideos||{}),fieldTrainer:true}}:t);
      upd({...data,trainers:updatedTrainers});
      setShowFieldTrainerVideo(false);
    }}/>}
    {showRvpPathVideo&&data.rvpPathVideoUrl&&<VideoPopupModal videoUrl={data.rvpPathVideoUrl} repName={session.name} emoji="🚀" title="Welcome to the RVP Path!" subtitle="Hey {name}! Watch this video to learn what's expected of you on the RVP Path." onClose={()=>{
      const updatedAdmins=(data.admins||[]).map(a=>a.id===session.id?{...a,seenVideos:{...(a.seenVideos||{}),rvpPath:true}}:a);
      upd({...data,admins:updatedAdmins});
      setShowRvpPathVideo(false);
    }}/>}
    {/* Desktop sidebar — hidden on mobile via media query workaround using window width */}
    <div style={{display:"flex",flexShrink:0,width:winWidth>=768?(winWidth>=900?260:240):0,overflow:"hidden"}}>
      {winWidth>=768&&<Sidebar section={section} onNav={navTo} role={session.role} name={session.name} onSignOut={signOut} onShowPhone={()=>setShowPhone(true)} onShowTour={()=>setShowTour(true)} alsoRecruits={((data.admins||[]).find(a=>a.id===session.id)||{}).alsoRecruits||session.role==="superadmin"} rewatchVideo={rewatchVideo}/>}
    </div>
    {/* Mobile sidebar overlay */}
    {mobileOpen&&<div style={{position:"fixed",inset:0,zIndex:200,display:"flex"}}>
      <Sidebar section={section} onNav={navTo} role={session.role} name={session.name} onSignOut={signOut} onClose={()=>setMobileOpen(false)} onShowPhone={()=>{setShowPhone(true);setMobileOpen(false);}} onShowTour={()=>{setShowTour(true);setMobileOpen(false);}} alsoRecruits={((data.admins||[]).find(a=>a.id===session.id)||{}).alsoRecruits||session.role==="superadmin"} rewatchVideo={rewatchVideo}/>
      <div style={{flex:1,background:"rgba(0,0,0,0.5)"}} onClick={()=>setMobileOpen(false)}/>
    </div>}
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
      {saveConflict&&<div style={{background:"#fef2f2",borderBottom:"2px solid #dc2626",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexShrink:0}}>
        <div style={{fontSize:13,color:"#991b1b",fontWeight:600}}>⚠️ Someone else saved a change at the same time as you (maybe another admin, or another tab/device). Your last change was NOT saved — please refresh the page and try again.</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>window.location.reload()} style={{padding:"6px 12px",borderRadius:7,border:"none",background:"#dc2626",color:"white",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>Refresh Now</button>
          <button onClick={()=>setSaveConflict(false)} style={{padding:"6px 10px",borderRadius:7,border:"1px solid #dc262633",background:"white",color:"#991b1b",fontSize:12,fontWeight:600,cursor:"pointer"}}>Dismiss</button>
        </div>
      </div>}
      <div style={{background:"white",borderBottom:`1px solid ${C.border}`,padding:"9px 14px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        {winWidth<768&&<button onClick={()=>setMobileOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:3,display:"flex",flexDirection:"column",gap:3}}>
          <div style={{width:17,height:2,background:C.text,borderRadius:1}}/><div style={{width:13,height:2,background:C.text,borderRadius:1}}/><div style={{width:17,height:2,background:C.text,borderRadius:1}}/>
        </button>}
        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:C.text,textTransform:"capitalize"}}>{selRep?selRep.name:section.replace(/([A-Z])/," $1")}</div><div style={{fontSize:12,color:C.textMid}}>NextLevel Field Training Hub</div></div>
        <div style={{width:26,height:26,borderRadius:7,background:C.teal+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.teal}}>{session.name?.charAt(0)?.toUpperCase()}</div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:14}}>
        <div style={{maxWidth:1400,margin:"0 auto",padding:"0 4px"}}>
          <AnnouncementsBanner data={data} onUpdate={upd} userRole={session.role}/>
          <DailyEventsBanner data={data} onUpdateData={upd} userRole={session.role}/>
          {renderContent()}
        </div>
      </div>
    </div>
  </div>;
}
