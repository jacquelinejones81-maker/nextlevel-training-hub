import { useState, useCallback, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc, collection, getDocs, query, orderBy } from "firebase/firestore";


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
  const size = new Blob([JSON.stringify(data)]).size;
  if(size > 900000) {
    console.warn("Firebase document size warning:", Math.round(size/1024)+"KB — approaching 1MB limit");
  }
  try {
    await setDoc(doc(db, "appdata", "main"), { payload: JSON.stringify(data) });
    return true;
  } catch(e) {
    console.error("Firebase save error", e);
    // If document too large, try saving without photos
    if(e.message&&(e.message.includes("maximum")||e.message.includes("size")||size>900000)){
      try {
        const stripped={...data};
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

// ── DESIGN TOKENS ──
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
  {id:"t5",cat:"Apps & Access",task:"Give recruit access to new student folder",link:"https://drive.google.com/drive/folders/1IrsYPZyMlaClTLftKSkK6pCxAzVavTPl",linkLabel:"Student Folder"},
  {id:"t6",cat:"References",task:"Get 5 character references (names and phone numbers - MACHO people)",note:"Character references can be found in the Refs tab"},
  {id:"t7",cat:"Onboarding Videos",task:"Send welcome video link",link:"https://us06web.zoom.us/clips/share/HkOwxveSSd6QaYTXZ0gUgg",linkLabel:"Welcome Video"},
  {id:"t8",cat:"Onboarding Videos",task:"Send orientation video to watch",note:"Find the orientation video in the Resources tab → Onboarding Videos"},
  {id:"t9",cat:"References",task:"Complete character reference calls and book 5 training appointments",link:"https://docs.google.com/document/d/1ju_kh_QbSc5whqLpm8r9190Jr7raYfcGoi2jdDxP49U/edit?usp=sharing",linkLabel:"Call Script"},
  {id:"t10",cat:"Appointments",task:"Share training appointment link with rep",link:"https://calendly.com/jacquelinejones81/trainingappointment",linkLabel:"Schedule Appointment",note:"Add yourself as guest"},
  {id:"t11",cat:"Events",task:"Choose Digital Grand Opening (DGO) date",note:"DGO date can be scheduled in the Milestones tab"},
  {id:"t12",cat:"FNA & Personal Plan",task:"Schedule time with RVP to complete personal FNA",link:"https://calendly.com/jacquelinejones81/meet-with-coach",linkLabel:"Schedule with Coach",note:"Add yourself as guest"},
  {id:"t13",cat:"Events",task:"Follow up after DGO - debrief, next steps, pipeline review"},
  {id:"t14",cat:"Milestones",task:"First sale milestone - rep writes first policy"},
];

const FAST_START = [
  {id:"f1",cat:"Getting Started",task:"Download Primerica app, register and log in within 24 hrs (earn $50 bonus)"},
  {id:"f2",cat:"Apps & Access",task:"Download Telegram app (team communication)"},
  {id:"f3",cat:"References",task:"Provide 5 professional character references to your trainer",note:"Character references can be found in the Refs tab"},
  {id:"f4",cat:"Onboarding",task:"Complete Orientation",note:"Orientation video is in the Resources tab"},
  {id:"f5",cat:"Business Commitment",task:"Business Commitment - pay POL fee and set up business account"},
  {id:"f6",cat:"FNA",task:"Complete your financial needs analysis (Life Insurance and Roth IRA)"},
  {id:"f7",cat:"Events",task:"Schedule Digital Grand Opening (DGO)",note:"DGO date can be set in the Milestones tab"},
  {id:"f8",cat:"Events",task:"Attend DGO and debrief afterward"},
  {id:"f9",cat:"Pre-Licensing",task:"Complete Pre-Licensing class (In-Person, Zoom, or Online)",note:"Set your class type and access ExamFX study materials in the Milestones tab"},
  {id:"f10",cat:"Licensing",task:"Schedule exam within 5 days of completing class"},
  {id:"f11",cat:"Licensing",task:"Access exam simulator"},
  {id:"f12",cat:"Licensing",task:"Pass exam - upload pass notice and required docs in Primerica app"},
  {id:"f13",cat:"Licensing",task:"Request License - Now What Checklist"},
];

const REGULAR_START = [
  {id:"r1",cat:"Getting Started",task:"Download Primerica app, register and log in within 24 hrs (earn $50 bonus)"},
  {id:"r2",cat:"Apps & Access",task:"Download Telegram app (team communication)"},
  {id:"r3",cat:"References",task:"Provide 5 character references to your trainer",note:"Character references can be found in the Refs tab"},
  {id:"r4",cat:"Onboarding",task:"Complete Orientation",note:"Orientation video is in the Resources tab"},
  {id:"r5",cat:"Business Commitment",task:"Business Commitment - build your financial and business house"},
  {id:"r6",cat:"FNA",task:"Complete your financial needs analysis (Life Insurance and Roth IRA)"},
  {id:"r7",cat:"Events",task:"Schedule Digital Grand Opening (DGO)",note:"DGO date can be set in the Milestones tab"},
  {id:"r8",cat:"Events",task:"Attend DGO and debrief afterward"},
  {id:"r9",cat:"Pre-Licensing",task:"Complete Pre-Licensing class (In-Person, Zoom, or Online)",note:"Set your class type and access ExamFX study materials in the Milestones tab"},
  {id:"r10",cat:"Licensing",task:"Schedule exam within 5 days of completing class"},
  {id:"r11",cat:"Licensing",task:"Access exam simulator"},
  {id:"r12",cat:"Licensing",task:"Pass exam - upload pass notice and required docs in Primerica app"},
  {id:"r12b",cat:"Licensing",task:"Request License - Now What Checklist"},
];

const LICENSED_NOW_WHAT = [
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
  return <div style={{display:"flex",alignItems:"center",gap:8,margin:"14px 0 6px"}}><div style={{width:3,height:14,background:done?C.success:color,borderRadius:2}}/><span style={{fontSize:11,fontWeight:700,color:C.textMid,textTransform:"uppercase",letterSpacing:"0.7px",flex:1}}>{title}</span>{count&&<span style={{fontSize:10,color:done?C.success:C.textLight}}>{count[0]}/{count[1]}</span>}</div>;
}

// ── MACHO ──
function MachoQ({value={},onChange}) {
  const letters=["M","A","C","H","O"];
  const labels={M:"Married",A:"Age 25-55",C:"Children",H:"Homeowner",O:"Occupation"};
  const score=letters.filter(l=>value[l]).length;
  const qualified=score>=3;
  return <div style={{marginTop:8}}>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
      {letters.map(l=>{const active=!!value[l];return <button key={l} onClick={()=>onChange({...value,[l]:!active})} title={labels[l]} style={{width:44,height:44,borderRadius:10,border:`2px solid ${active?C.gold:"rgba(0,0,0,0.15)"}`,background:active?C.gold+"22":"white",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,transition:"all 0.15s"}}><span style={{fontSize:14}}>{active?"★":"☆"}</span><span style={{fontSize:9,fontWeight:700,color:active?C.gold:C.textLight}}>{l}</span></button>;})}
    </div>
    {score>0&&<div style={{background:qualified?C.success+"11":"rgba(0,0,0,0.04)",border:`1px solid ${qualified?C.success+"44":"rgba(0,0,0,0.08)"}`,borderRadius:8,padding:"6px 10px"}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}>{letters.filter(l=>value[l]).map(l=><span key={l} style={{background:C.gold+"22",color:C.gold,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:12}}>★ {labels[l]}</span>)}</div>
      <div style={{fontSize:11,fontWeight:700,color:qualified?C.success:C.gold}}>{score} ★ {qualified?"— Qualified! Great candidate.":"— "+(3-score)+" more needed to qualify"}</div>
    </div>}
  </div>;
}

function CheckItem({item,checked,onToggle,readOnly}) {
  return <div style={{display:"flex",gap:9,padding:"7px 0",borderBottom:`1px solid ${C.border}`}}><button onClick={!readOnly?onToggle:undefined} style={{width:20,height:20,borderRadius:5,border:`2px solid ${checked?C.teal:C.border}`,background:checked?C.teal:"white",flexShrink:0,marginTop:1,cursor:readOnly?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{checked&&<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}</button><div style={{flex:1}}><div style={{fontSize:13,color:checked?C.textLight:C.text,textDecoration:checked?"line-through":"none",lineHeight:1.4}}>{item.task}</div>{item.note&&<div style={{fontSize:11,color:C.textLight,marginTop:1}}>{item.note}</div>}{item.link&&<a href={item.link} target="_blank" rel="noreferrer" style={{fontSize:11,color:C.teal,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:2,marginTop:2}}>{item.linkLabel||"Open"} &rarr;</a>}</div></div>;
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
        {step>0&&<button onClick={()=>setStep(step-1)} style={{flex:1,padding:"9px",borderRadius:8,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:13,color:C.textMid}}>Back</button>}
        <button onClick={()=>isLast?onClose():setStep(step+1)} style={{flex:2,padding:"9px",borderRadius:8,border:"none",background:isLast?C.success:C.teal,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>{isLast?"Get Started!":"Next"}</button>
      </div>
    </div>
  </div>;
}

// ── ADD TO PHONE ──
function AddToPhoneModal({onClose}) {
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{background:"white",borderRadius:16,padding:24,maxWidth:400,width:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div style={{fontSize:15,fontWeight:700,color:C.text}}>Add App to Your Phone</div><button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.textMid}}>x</button></div>
      <div style={{marginBottom:14}}><div style={{fontSize:13,fontWeight:700,color:C.teal,marginBottom:8}}>iPhone / Safari</div><div style={{fontSize:12,color:C.text,lineHeight:1.7,background:C.surface,borderRadius:8,padding:"10px 12px"}}>1. Open this app in Safari<br/>2. Tap the Share button (box with arrow)<br/>3. Scroll down and tap "Add to Home Screen"<br/>4. Tap "Add" in the top right</div></div>
      <div><div style={{fontSize:13,fontWeight:700,color:C.purple,marginBottom:8}}>Android / Chrome</div><div style={{fontSize:12,color:C.text,lineHeight:1.7,background:C.surface,borderRadius:8,padding:"10px 12px"}}>1. Open this app in Chrome<br/>2. Tap the three dots menu (top right)<br/>3. Tap "Add to Home screen"<br/>4. Tap "Add"</div></div>
      <button onClick={onClose} style={{marginTop:16,width:"100%",padding:"10px",borderRadius:8,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600}}>Got it!</button>
    </div>
  </div>;
}

// ── DAILY EVENTS BANNER ──
function DailyEventsBanner({data,onUpdateData,userRole}) {
  const today=new Date().getDay();
  const todayEvents=TEAM_SCHEDULE.filter(s=>s.dayIndex===today);
  const cancelledEvents=data.cancelledEvents||{};
  const todayKey=new Date().toISOString().split("T")[0];
  if(todayEvents.length===0) return null;
  return <div style={{background:`linear-gradient(135deg,${C.navyMid} 0%,${C.navyLight} 100%)`,borderRadius:12,padding:"12px 16px",marginBottom:14,color:"white"}}>
    <div style={{fontSize:11,fontWeight:700,color:C.teal,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:6}}>Today's Events</div>
    {todayEvents.map((evt,i)=>{
      const key=`${todayKey}_${i}`;
      const cancelled=cancelledEvents[key];
      const zoomLinks=data.scheduleZoomLinks||{};
      const schedIdx=TEAM_SCHEDULE.findIndex(s=>s.title===evt.title&&s.dayIndex===today);
      const zEntry=zoomLinks[schedIdx]||{};
      const zUrl=typeof zEntry==="string"?zEntry:zEntry.url||"";
      const zPass=typeof zEntry==="string"?"":zEntry.password||"";
      return <div key={i} style={{marginBottom:i<todayEvents.length-1?8:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:cancelled?"rgba(255,255,255,0.3)":"white",textDecoration:cancelled?"line-through":"none"}}>{evt.title}</div><div style={{fontSize:11,color:cancelled?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.55)"}}>{evt.time}{evt.note&&" - "+evt.note}</div></div>
          {cancelled&&<Badge color={C.danger} small>Cancelled</Badge>}
          {(userRole==="admin"||userRole==="superadmin"||userRole==="trainer")&&<button onClick={()=>{const ce={...cancelledEvents,[key]:!cancelled};onUpdateData({...data,cancelledEvents:ce});}} style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:cancelled?"rgba(16,185,129,0.2)":"rgba(239,68,68,0.2)",border:`1px solid ${cancelled?"rgba(16,185,129,0.4)":"rgba(239,68,68,0.4)"}`,color:cancelled?"#6ee7b7":"#fca5a5",cursor:"pointer"}}>{cancelled?"Restore":"Cancel"}</button>}
        </div>
        {zUrl&&!cancelled&&<div style={{marginTop:6,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <a href={zUrl} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(45,140,255,0.25)",border:"1px solid rgba(45,140,255,0.5)",borderRadius:6,padding:"5px 12px",textDecoration:"none"}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#60a5fa"><path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/></svg>
            <span style={{fontSize:12,fontWeight:600,color:"#60a5fa"}}>Join Zoom</span>
          </a>
          {zPass&&<span style={{fontSize:11,color:"rgba(255,255,255,0.7)"}}>Password: <strong style={{color:"white",userSelect:"all"}}>{zPass}</strong></span>}
        </div>}
      </div>;
    })}
  </div>;
}

// ── APPOINTMENT TRACKER ──
function ApptTracker({appointments=[],onChange,readOnly,bookingLink}) {
  const [showPurpose,setShowPurpose]=useState(true);
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
      <div style={{fontSize:16,fontWeight:700,color:C.gold,marginBottom:8}}>Remember Your Purpose!</div>
      <div style={{fontSize:13,color:"rgba(255,255,255,0.8)",lineHeight:1.6,marginBottom:10}}>Your training appointments are primarily for <strong style={{color:"white"}}>YOUR development</strong>, not to recruit or sell. Your <strong style={{color:"white"}}>#1 goal</strong> is to get in front of your trainer and sharpen your skills.</div>
      <div style={{background:"rgba(255,255,255,0.07)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"rgba(255,255,255,0.7)"}}>Need help? <strong style={{color:C.gold}}>Tap the Scripts tab</strong> — it has everything you need!</div>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
      {[["Logged",logged,"20",C.teal],["Completed",done,logged||"-",C.success],["Qualified",qualified,logged||"-",C.gold]].map(([l,v,t,c])=><div key={l} style={{background:c+"11",borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:c}}>{v}</div><div style={{fontSize:10,color:C.textMid}}>{l}</div><div style={{fontSize:10,color:C.textLight}}>of {t}</div></div>)}
    </div>
    <Bar pct={(logged/20)*100} h={4}/>
    {bookingLink&&!readOnly&&<div style={{background:C.gold+"11",border:`1px solid ${C.gold}33`,borderRadius:8,padding:"8px 12px",margin:"10px 0",fontSize:12}}><a href={bookingLink} target="_blank" rel="noreferrer" style={{color:C.gold,fontWeight:600}}>Schedule Training Appointment &rarr;</a><div style={{color:C.textMid,marginTop:2,fontSize:11}}>Add yourself as "guest" to receive notifications</div></div>}
    <div style={{marginTop:10}}>
      {slots.map((a,i)=><div key={i} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:10,marginBottom:6,background:a.status==="Completed"?C.success+"08":"white"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:10,fontWeight:700,color:C.textLight,textTransform:"uppercase"}}>Appt #{i+1}</span>
          {!readOnly&&<select value={a.status||""} onChange={e=>upd(i,"status",e.target.value)} style={{fontSize:11,padding:"2px 5px",borderRadius:5,border:`1px solid ${C.border}`,color:C.text}}><option value="">Set Status</option><option value="Completed">Completed</option><option value="Cancelled">Cancelled</option></select>}
          {readOnly&&a.status&&<Badge color={a.status==="Completed"?C.success:C.warning} small>{a.status}</Badge>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>{[["name","Name"],["phone","Phone"],["email","Email"],["date","Date"]].map(([f,ph])=><input key={f} type={f==="date"?"date":"text"} placeholder={ph} value={a[f]||""} readOnly={readOnly} onChange={e=>upd(i,f,e.target.value)} style={{padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,background:readOnly?C.surface:"white",color:C.text}}/>)}</div>
        <textarea placeholder="Notes / Follow-up" value={a.notes||""} readOnly={readOnly} onChange={e=>upd(i,"notes",e.target.value)} style={{width:"100%",marginTop:5,padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,resize:"vertical",minHeight:36,background:readOnly?C.surface:"white",color:C.text,boxSizing:"border-box"}}/>
        {!readOnly&&<MachoQ value={a.macho||{}} onChange={m=>updM(i,m)}/>}
        {readOnly&&a.macho&&(()=>{const score=Object.values(a.macho).filter(Boolean).length;const q=score>=3;return score>0?<div style={{marginTop:6,background:q?C.success+"11":"rgba(0,0,0,0.04)",borderRadius:6,padding:"4px 8px",fontSize:11,color:q?C.success:C.textLight}}>{score}/5 stars {q?"- Qualified":""}</div>:null;})()}
      </div>)}
    </div>
  </div>;
}

// ── REP EXTRAS ──
function RepExtras({rep,onUpdate,onUpdateData,readOnly,data={}}) {
  const today=new Date();
  const motivation=MOTIVATIONS[today.getDate()%MOTIVATIONS.length];
  return <div>
    {/* Daily Motivation + My Why side by side */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
      <div style={{background:`linear-gradient(135deg,${C.navyMid},${C.navyLight})`,borderRadius:12,padding:"14px 16px",color:"white",border:`1px solid ${C.teal}33`}}>
        <div style={{fontSize:10,fontWeight:700,color:C.teal,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:6}}>Daily Motivation</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",lineHeight:1.6,fontStyle:"italic"}}>"{motivation}"</div>
      </div>
      <Card style={{margin:0}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:4}}>My Why</div>
        <div style={{fontSize:10,color:C.textMid,marginBottom:6}}>Your personal reason for joining</div>
        {!readOnly?<textarea placeholder="I joined because..." value={rep.myWhy||""} onChange={e=>onUpdate({...rep,myWhy:e.target.value})} style={{width:"100%",padding:"7px 9px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,resize:"vertical",minHeight:60,boxSizing:"border-box",lineHeight:1.5,fontFamily:"inherit"}}/>:
        <div style={{fontSize:12,lineHeight:1.5,background:C.surface,borderRadius:8,padding:"7px 9px",fontStyle:rep.myWhy?"italic":"normal",color:rep.myWhy?C.text:C.textLight}}>{rep.myWhy||"Not set yet"}</div>}
      </Card>
    </div>
    {/* Birthday */}
    <Card style={{marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:4}}>My Birthday</div>
      <div style={{fontSize:11,color:C.textMid,marginBottom:8}}>Your birthday helps us celebrate you!</div>
      {!readOnly?<input type="date" value={rep.birthday||""} onChange={e=>onUpdate({...rep,birthday:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box"}}/>:
      <div style={{fontSize:13,fontWeight:600,color:C.purple}}>{rep.birthday?new Date(rep.birthday+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}):"Not set"}</div>}
    </Card>
    {/* Pre-Licensing Class — hidden for licensed reps */}
    {rep.track!=="licensed"&&<Card style={{marginBottom:12,border:`1px solid ${rep.preLicDone?C.success+"44":C.purple+"33"}`,background:rep.preLicDone?C.success+"06":"white"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text}}>Pre-Licensing Class</div>
        {!readOnly&&<button onClick={()=>onUpdate({...rep,preLicDone:!rep.preLicDone})}
          style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:`1px solid ${rep.preLicDone?C.success:C.purple}`,background:rep.preLicDone?C.success+"11":C.purple+"11",color:rep.preLicDone?C.success:C.purple,cursor:"pointer",fontWeight:600}}>
          {rep.preLicDone?"Completed":"Mark Complete"}
        </button>}
        {rep.preLicDone&&readOnly&&<Badge color={C.success} small>Complete</Badge>}
      </div>

      {/* Class type selector */}
      {!readOnly&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
        {[["inperson","In-Person",""],["zoom","Zoom",""],["online","Online Course",""]].map(([val,label,icon])=>(
          <button key={val} onClick={()=>onUpdate({...rep,preLicType:val})}
            style={{padding:"10px 6px",borderRadius:8,border:`2px solid ${rep.preLicType===val?C.purple:C.border}`,background:rep.preLicType===val?C.purple+"11":"white",cursor:"pointer",textAlign:"center"}}>
            <div style={{fontSize:11,fontWeight:700,color:rep.preLicType===val?C.purple:C.textMid}}>{label}</div>
          </button>
        ))}
      </div>}
      {readOnly&&rep.preLicType&&<div style={{marginBottom:10}}><Badge color={C.purple} small>{rep.preLicType==="inperson"?"In-Person":rep.preLicType==="zoom"?"Zoom":"Online Course"}</Badge></div>}

      {/* Online course details - show for ALL types */}
      {rep.preLicType&&<div>
        <div style={{background:C.purple+"11",border:`1px solid ${C.purple}33`,borderRadius:8,padding:"10px 12px",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:C.purple,marginBottom:4}}>Get your study materials here:</div>
          <a href="https://www-ucanpass.examfx.com" target="_blank" rel="noreferrer"
            style={{fontSize:13,fontWeight:700,color:C.teal,textDecoration:"none",display:"block",marginBottom:3}}>www-ucanpass.examfx.com &rarr;</a>
          <div style={{fontSize:11,color:C.textMid}}>Log in or create your account to begin your online licensing course.</div>
        </div>

        {/* RVP ID selector */}
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textMid,marginBottom:6}}>Select Your RVP ID</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {[{id:"BXKX9",name:"Tellis Bolton"},{id:"519KU",name:"Jacqueline Jones"},...((data&&data.customRVPs)||[])].map((rvp,i)=>{
              const selected=rep.selectedRVP===rvp.id;
              return <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,border:`2px solid ${selected?C.gold:C.border}`,background:selected?C.gold+"11":"white",cursor:readOnly?"default":"pointer"}}
                onClick={()=>!readOnly&&onUpdate({...rep,selectedRVP:rvp.id})}>
                <div style={{width:18,height:18,borderRadius:9,border:`2px solid ${selected?C.gold:C.border}`,background:selected?C.gold:"white",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {selected&&<div style={{width:8,height:8,borderRadius:4,background:"white"}}/>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:selected?C.gold:C.text}}>{rvp.id}</div>
                  <div style={{fontSize:11,color:C.textMid}}>{rvp.name}</div>
                </div>
                {selected&&<button onClick={e=>{e.stopPropagation();navigator.clipboard?.writeText(rvp.id);}}
                  style={{fontSize:10,padding:"3px 8px",borderRadius:5,background:C.gold,color:"white",border:"none",cursor:"pointer",fontWeight:600}}>Copy</button>}
              </div>;
            })}
          </div>
        </div>
      </div>}

      {/* Dates */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:rep.preLicDone?8:0}}>
        <div>
          <div style={{fontSize:10,color:C.textMid,marginBottom:3}}>Start Date</div>
          {!readOnly?<input type="date" value={rep.preLicStart||""} onChange={e=>onUpdate({...rep,preLicStart:e.target.value})}
            style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,boxSizing:"border-box"}}/>:
          <div style={{fontSize:12,fontWeight:600,color:C.text}}>{rep.preLicStart||"Not set"}</div>}
        </div>
        {rep.preLicDone&&<div>
          <div style={{fontSize:10,color:C.textMid,marginBottom:3}}>Completion Date</div>
          {!readOnly?<input type="date" value={rep.preLicEnd||""} onChange={e=>onUpdate({...rep,preLicEnd:e.target.value})}
            style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,boxSizing:"border-box"}}/>:
          <div style={{fontSize:12,fontWeight:600,color:C.text}}>{rep.preLicEnd||"Not set"}</div>}
        </div>}
      </div>
    </Card>}
    {rep.track!=="licensed"&&<Card style={{marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:10}}>My Bonus Goal</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {BONUS_GOALS.map(g=>{const selected=rep.bonusGoal===g.id;return <button key={g.id} onClick={()=>!readOnly&&onUpdate({...rep,bonusGoal:g.id})} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,border:`2px solid ${selected?C.gold:C.border}`,background:selected?C.gold+"11":"white",cursor:readOnly?"default":"pointer",textAlign:"left"}}><div style={{width:18,height:18,borderRadius:9,border:`2px solid ${selected?C.gold:C.border}`,background:selected?C.gold:"white",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{selected&&<div style={{width:8,height:8,borderRadius:4,background:"white"}}/>}</div><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:selected?C.gold:C.text}}>{g.label} done</div><div style={{fontSize:11,color:C.textMid}}>{g.desc}</div></div></button>;})}
      </div>
    </Card>}
    <Card style={{marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>Business Commitment</div>
      <div style={{fontSize:11,color:C.textMid,marginBottom:8}}>Dollar amount committed to your business</div>
      {!readOnly?<div style={{display:"flex",gap:7,alignItems:"center"}}><span style={{color:C.textMid,fontSize:16}}>$</span><input type="number" placeholder="Enter amount" value={rep.businessCommitment||""} onChange={e=>onUpdate({...rep,businessCommitment:e.target.value})} style={{flex:1,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,color:C.text}}/></div>:
      <div style={{fontSize:16,fontWeight:700,color:C.gold}}>{rep.businessCommitment?`$${rep.businessCommitment}`:"Not set"}</div>}
    </Card>
    <Card style={{marginBottom:12,border:`1px solid ${rep.dgoDone?C.success+"44":C.teal+"33"}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text}}>Digital Grand Opening (DGO)</div>
        {!readOnly&&<button onClick={()=>onUpdate({...rep,dgoDone:!rep.dgoDone})} style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:`1px solid ${rep.dgoDone?C.success:C.teal}`,background:rep.dgoDone?C.success+"11":C.teal+"11",color:rep.dgoDone?C.success:C.teal,cursor:"pointer",fontWeight:600}}>{rep.dgoDone?"Completed":"Mark Complete"}</button>}
      </div>
      {!readOnly?<input type="date" value={rep.dgoDate||""} onChange={e=>onUpdate({...rep,dgoDate:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box",marginBottom:10}}/>:
      <div style={{fontSize:14,fontWeight:700,color:C.teal,marginBottom:10}}>{rep.dgoDate||"Not set"}</div>}
      {/* Professional Photo */}
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
        <div style={{fontSize:11,fontWeight:700,color:C.textMid,marginBottom:6}}>Professional Photo — DGO & Team Recognition</div>
        <div style={{fontSize:11,color:C.textLight,marginBottom:8}}>Upload a professional headshot — used for your DGO presentation and Wall of Fame recognition</div>
{(()=>{let p=rep.dgoPhoto;if(!p){try{p=localStorage.getItem("dgoPhoto_"+rep.id);}catch(ex){}}return p?<div style={{marginBottom:8,position:"relative",display:"inline-block"}}><img src={p} alt="DGO Photo" style={{width:80,height:80,borderRadius:10,objectFit:"cover",border:`2px solid ${C.teal}`}}/>{!readOnly&&<button onClick={()=>{try{localStorage.removeItem("dgoPhoto_"+rep.id);}catch(ex){}onUpdate({...rep,dgoPhoto:null});}} style={{position:"absolute",top:-6,right:-6,width:20,height:20,borderRadius:10,background:C.danger,color:"white",border:"none",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>x</button>}</div>:null;})()}
        {!readOnly&&<div>
          <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:8,background:C.teal+"11",border:`1px solid ${C.teal}33`,cursor:"pointer",fontSize:12,color:C.teal,fontWeight:600}}>
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
        {readOnly&&!rep.dgoPhoto&&<div style={{fontSize:11,color:C.textLight}}>No photo uploaded yet</div>}
      </div>
    </Card>
    <Card style={{marginBottom:12,border:`1px solid ${rep.examPassed?C.success+"44":C.gold+"33"}`}}>
      {rep.track!=="licensed"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text}}>Exam Date</div>
        {!readOnly&&<button onClick={()=>onUpdate({...rep,examPassed:!rep.examPassed})} style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:`1px solid ${rep.examPassed?C.success:C.gold}`,background:rep.examPassed?C.success+"11":C.gold+"11",color:rep.examPassed?C.success:C.gold,cursor:"pointer",fontWeight:600}}>{rep.examPassed?"Passed!":"Mark Passed"}</button>}
      </div>
      <div style={{fontSize:11,color:C.textLight,marginBottom:6}}>Schedule within 5 days of completing your class</div>
      {!readOnly?<input type="date" value={rep.examDate||""} onChange={e=>onUpdate({...rep,examDate:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box",marginBottom:12}}/>:
      <div style={{fontSize:14,fontWeight:700,color:C.gold,marginBottom:12}}>{rep.examDate||"Not set"}</div>}
      </div>}
      {/* T-Shirt Size */}
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
        <div style={{fontSize:11,fontWeight:700,color:C.textMid,marginBottom:4}}>T-Shirt Size</div>
        <div style={{fontSize:11,color:C.textLight,marginBottom:8}}>You will receive a t-shirt after passing your life insurance exam!</div>
        {!readOnly?<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["XS","S","M","L","XL","2XL","3XL"].map(size=>{
            const selected=rep.tshirtSize===size;
            return <button key={size} onClick={()=>onUpdate({...rep,tshirtSize:size})}
              style={{padding:"6px 12px",borderRadius:8,border:`2px solid ${selected?C.gold:C.border}`,background:selected?C.gold:"white",color:selected?"white":C.textMid,fontSize:12,fontWeight:selected?700:400,cursor:"pointer",transition:"all 0.15s"}}>
              {size}
            </button>;
          })}
        </div>:
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {rep.tshirtSize?<><div style={{padding:"6px 16px",borderRadius:8,background:C.gold,color:"white",fontSize:13,fontWeight:700}}>{rep.tshirtSize}</div><span style={{fontSize:11,color:C.textMid}}>T-Shirt Size</span></>:
          <span style={{fontSize:12,color:C.textLight}}>No size selected yet</span>}
        </div>}
      </div>
    </Card>

  </div>;
}

// ── REP COUNTERS ──
function RepCounters({rep,onUpdate,readOnly}) {
  return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
    {[{label:"FTO Observations",key:"ftoCount",goal:20,color:C.purple,note:"Goal: 20 FTO"},{label:"Life Insurance Observation",key:"lifeAppCount",goal:10,color:C.teal,note:"Goal: 10 during training"},{label:"Investment Observation",key:"pacCount",goal:10,color:C.gold,note:"Builds your future AUM"}].map(c=><Card key={c.key} style={{padding:"10px 12px"}}>
      <div style={{fontSize:11,color:C.textMid,marginBottom:4}}>{c.label}</div>
      <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{fontSize:22,fontWeight:700,color:c.color}}>{rep[c.key]||0}</div><div style={{flex:1}}><Bar pct={((rep[c.key]||0)/c.goal)*100} color={c.color}/></div><div style={{fontSize:10,color:C.textLight}}>/{c.goal}</div></div>
      {!readOnly&&<div style={{display:"flex",gap:5,marginTop:6}}><button onClick={()=>onUpdate({...rep,[c.key]:Math.max(0,(rep[c.key]||0)-1)})} style={{flex:1,padding:"3px",borderRadius:6,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:15,color:C.textMid}}>-</button><button onClick={()=>onUpdate({...rep,[c.key]:(rep[c.key]||0)+1})} style={{flex:1,padding:"3px",borderRadius:6,border:"1px solid "+c.color,background:c.color+"11",cursor:"pointer",fontSize:15,color:c.color,fontWeight:700}}>+</button></div>}
      <div style={{fontSize:10,color:C.textLight,marginTop:3}}>{c.note}</div>
    </Card>)}
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
        <div style={{fontSize:9,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.5px"}}>Next Goal</div>
        <div style={{fontSize:11,fontWeight:700,color:currentColor}}>{nextGoal}</div>
      </div>
      <div style={{color:"rgba(255,255,255,0.4)",fontSize:12,transform:expanded?"rotate(180deg)":"none",transition:"transform 0.2s",flexShrink:0}}>v</div>
    </button>

    {/* Expanded detail */}
    {expanded&&<div style={{background:"white",padding:"12px 14px"}}>
      {currentStage==="new"&&<div>
        <div style={{fontSize:12,color:C.text,lineHeight:1.6,marginBottom:10}}>Getting your life insurance license is your first major milestone. Complete your checklist, finish your pre-licensing class, and pass your exam. Once licensed a whole new path opens up!</div>
        <div style={{fontSize:11,color:C.textLight,textAlign:"center"}}>Field Trainer and RVP paths unlock after you get licensed.</div>
      </div>}
      {currentStage==="licensed"&&<div>
        <div style={{fontSize:12,color:C.text,lineHeight:1.6,marginBottom:10}}>You are licensed! Now build your skills, production, and team. When you meet the Field Trainer requirements, request your review below.</div>
        {!ftRequested&&!rep.fieldTrainerDenied&&<button onClick={()=>{onUpdate(rep.id,{...rep,fieldTrainerRequested:true,fieldTrainerDenied:false,fieldTrainerRequestedAt:new Date().toISOString()});setExpanded(false);}}
          style={{width:"100%",padding:"9px",borderRadius:8,background:"linear-gradient(135deg,"+C.purple+",#7c3aed)",color:"white",border:"none",fontWeight:700,fontSize:12,cursor:"pointer"}}>
          Request Field Trainer Review
        </button>}
        {ftRequested&&<div style={{background:C.gold+"11",border:"1px solid "+C.gold+"33",borderRadius:8,padding:"8px 12px",textAlign:"center",fontSize:11,color:C.gold,fontWeight:600}}>Review requested! Your RVP has been notified.</div>}
        {rep.fieldTrainerDenied&&!ftRequested&&<div>
          <div style={{background:C.danger+"11",border:"1px solid "+C.danger+"33",borderRadius:8,padding:"7px 12px",fontSize:11,color:C.danger,marginBottom:6,textAlign:"center"}}>Request was not approved — speak with your trainer for next steps</div>
          <button onClick={()=>{onUpdate(rep.id,{...rep,fieldTrainerRequested:true,fieldTrainerDenied:false,fieldTrainerRequestedAt:new Date().toISOString()});setExpanded(false);}}
            style={{width:"100%",padding:"9px",borderRadius:8,background:"linear-gradient(135deg,"+C.purple+",#7c3aed)",color:"white",border:"none",fontWeight:700,fontSize:12,cursor:"pointer"}}>
            Request Again
          </button>
        </div>}
      </div>}
      {currentStage==="trainer"&&<div>
        <div style={{fontSize:12,color:C.text,lineHeight:1.6,marginBottom:10}}>You are a Field Trainer! Now focus on consistently producing and building your team. When you are ready, request access to the RVP Path.</div>
        {!rvpRequested&&!rep.rvpPathDenied&&<button onClick={()=>{onUpdate(rep.id,{...rep,rvpPathRequested:true,rvpPathDenied:false,rvpPathRequestedAt:new Date().toISOString()});setExpanded(false);}}
          style={{width:"100%",padding:"9px",borderRadius:8,background:"linear-gradient(135deg,"+C.success+",#059669)",color:"white",border:"none",fontWeight:700,fontSize:12,cursor:"pointer"}}>
          Request RVP Path Access
        </button>}
        {rvpRequested&&<div style={{background:C.gold+"11",border:"1px solid "+C.gold+"33",borderRadius:8,padding:"8px 12px",textAlign:"center",fontSize:11,color:C.gold,fontWeight:600}}>RVP Path request sent! Your admin will review soon.</div>}
        {rep.rvpPathDenied&&!rvpRequested&&<div>
          <div style={{background:C.danger+"11",border:"1px solid "+C.danger+"33",borderRadius:8,padding:"7px 12px",fontSize:11,color:C.danger,marginBottom:6,textAlign:"center"}}>Request was not approved — speak with your trainer for next steps</div>
          <button onClick={()=>{onUpdate(rep.id,{...rep,rvpPathRequested:true,rvpPathDenied:false,rvpPathRequestedAt:new Date().toISOString()});setExpanded(false);}}
            style={{width:"100%",padding:"9px",borderRadius:8,background:"linear-gradient(135deg,"+C.success+",#059669)",color:"white",border:"none",fontWeight:700,fontSize:12,cursor:"pointer"}}>
            Request Again
          </button>
        </div>}
      </div>}
      {currentStage==="rvp"&&<div>
        <div style={{fontSize:12,color:C.text,lineHeight:1.6,marginBottom:8}}>You have unlocked the RVP Path! Check the Career Path tab for your full RVP checklist.</div>
        <div style={{fontSize:11,color:C.success,fontWeight:600,textAlign:"center"}}>You are on your way to Regional Vice President!</div>
      </div>}
    </div>}
  </div>;
}

// ── REP VIEW ──


// ── SCHEDULE VIEW WITH ZOOM LINKS ──
function ScheduleView({data,onUpdate,userRole}) {
  const isAdmin = userRole==="admin"||userRole==="superadmin";
  const zoomLinks = data.scheduleZoomLinks||{};
  const [editingIdx,setEditingIdx] = useState(null);
  const [editVal,setEditVal] = useState("");
  const [editPass,setEditPass] = useState("");

  const saveZoom = (idx) => {
    onUpdate({...data,scheduleZoomLinks:{...zoomLinks,[idx]:{url:editVal.trim(),password:editPass.trim()}}});
    setEditingIdx(null);
    setEditVal("");
    setEditPass("");
  };

  return <div>
    {TEAM_SCHEDULE.map((s,i)=>{
      const entry = zoomLinks[i]||{};
      const zoom = typeof entry==="string"?entry:entry.url||"";
      const zoomPass = typeof entry==="string"?"":entry.password||"";
      return <Card key={i} style={{marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text}}>{s.day} — {s.title}</div>
            <div style={{fontSize:11,color:C.textLight,marginTop:2}}>{s.time}{s.note&&" · "+s.note}</div>
            {zoom&&editingIdx!==i&&<div style={{marginTop:6,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <a href={zoom} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:5,background:"#2D8CFF22",border:"1px solid #2D8CFF55",borderRadius:6,padding:"4px 10px",textDecoration:"none"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#2D8CFF"><path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/></svg>
                <span style={{fontSize:11,fontWeight:600,color:"#2D8CFF"}}>Join Zoom</span>
              </a>
              {zoomPass&&<span style={{fontSize:11,color:C.textMid}}>Password: <strong style={{color:C.text,userSelect:"all"}}>{zoomPass}</strong></span>}
            </div>}
          </div>
          {isAdmin&&<button onClick={()=>{setEditingIdx(i);setEditVal(zoom);setEditPass(zoomPass);}} style={{fontSize:10,padding:"3px 8px",borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid,flexShrink:0}}>{zoom?"Edit Zoom":"+ Zoom"}</button>}
        </div>
        {editingIdx===i&&<div style={{marginTop:8}}>
          <input placeholder="Paste Zoom link..." value={editVal} onChange={e=>setEditVal(e.target.value)} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:11,color:C.text,marginBottom:5,boxSizing:"border-box"}}/>
          <input placeholder="Meeting password (optional)" value={editPass} onChange={e=>setEditPass(e.target.value)} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:11,color:C.text,marginBottom:6,boxSizing:"border-box"}}/>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>saveZoom(i)} style={{flex:2,padding:"5px 10px",borderRadius:6,border:"none",background:"#2D8CFF",color:"white",cursor:"pointer",fontSize:11,fontWeight:600}}>Save</button>
            <button onClick={()=>{setEditingIdx(null);setEditVal("");setEditPass("");}} style={{flex:1,padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:11,color:C.textMid}}>Cancel</button>
            {zoom&&<button onClick={()=>{onUpdate({...data,scheduleZoomLinks:{...zoomLinks,[i]:{}}});setEditingIdx(null);}} style={{flex:1,padding:"5px 8px",borderRadius:6,border:"1px solid "+C.danger+"33",background:C.danger+"11",cursor:"pointer",fontSize:11,color:C.danger}}>Remove</button>}
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
        <button onClick={()=>setShowEmailAll(!showEmailAll)} style={{fontSize:11,padding:"5px 10px",borderRadius:7,border:`1px solid ${C.teal}`,background:C.teal+"11",cursor:"pointer",color:C.teal,fontWeight:600}}>Email All</button>
        {isAdmin&&<button onClick={()=>setShowAdd(!showAdd)} style={{fontSize:11,padding:"5px 10px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>+ Add</button>}
        {isAdmin&&<button onClick={reset} style={{fontSize:11,padding:"5px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>Reset</button>}
      </div>
    </div>
    <div style={{fontSize:12,color:C.textMid,marginBottom:12}}>Click Email to open in your email app with the template pre-filled. Edit [Name] and [Your Name] before sending.</div>

    {/* Email All section */}
    {showEmailAll&&<Card style={{marginBottom:14,border:`1px solid ${C.teal}44`}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>Email All</div>
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {allEmails&&<a href={"mailto:"+allEmails} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,background:C.teal+"11",border:`1px solid ${C.teal}33`,textDecoration:"none"}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
          <span style={{fontSize:12,color:C.teal,fontWeight:600}}>Email All Active Reps ({(reps||[]).filter(r=>r.email&&!r.inactive).length})</span>
        </a>}
        {trackEmails("fast")&&<a href={"mailto:"+trackEmails("fast")} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,background:C.navy+"11",border:`1px solid ${C.navy}33`,textDecoration:"none"}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
          <span style={{fontSize:12,color:C.navy,fontWeight:600}}>Email Fast Start Reps ({(reps||[]).filter(r=>r.email&&!r.inactive&&r.track==="fast").length})</span>
        </a>}
        {trackEmails("regular")&&<a href={"mailto:"+trackEmails("regular")} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,background:C.gold+"11",border:`1px solid ${C.gold}33`,textDecoration:"none"}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
          <span style={{fontSize:12,color:C.gold,fontWeight:600}}>Email Regular Start Reps ({(reps||[]).filter(r=>r.email&&!r.inactive&&r.track==="regular").length})</span>
        </a>}
        {trackEmails("licensed")&&<a href={"mailto:"+trackEmails("licensed")} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,background:C.success+"11",border:`1px solid ${C.success}33`,textDecoration:"none"}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
          <span style={{fontSize:12,color:C.success,fontWeight:600}}>Email Licensed Now What ({(reps||[]).filter(r=>r.email&&!r.inactive&&r.track==="licensed").length})</span>
        </a>}
        {!allEmails&&<div style={{fontSize:12,color:C.textLight,textAlign:"center",padding:8}}>No rep emails on file. Add emails to rep profiles to use this feature.</div>}
      </div>
    </Card>}

    {/* Add new template */}
    {showAdd&&<Card style={{marginBottom:14,border:`1px solid ${C.teal}44`}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>New Email Template</div>
      <select value={newTpl.cat} onChange={e=>setNewTpl({...newTpl,cat:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,marginBottom:7}}>
        {EMAIL_CATS.map(c=><option key={c}>{c}</option>)}
      </select>
      <input placeholder="Subject line" value={newTpl.subject} onChange={e=>setNewTpl({...newTpl,subject:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
      <textarea placeholder="Email body... Use [Name] for recipient name and [Your Name] for your name" value={newTpl.body} onChange={e=>setNewTpl({...newTpl,body:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,resize:"vertical",minHeight:120,boxSizing:"border-box",lineHeight:1.6,marginBottom:7}}/>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>setShowAdd(false)} style={{flex:1,padding:"7px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:11,color:C.textMid}}>Cancel</button>
        <button onClick={add} style={{flex:2,padding:"7px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:11,fontWeight:600}}>Save Template</button>
      </div>
    </Card>}

    {/* Category filters */}
    <div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:12,paddingBottom:2}}>
      {cats.map(c=><button key={c} onClick={()=>setFilter(c)} style={{padding:"5px 10px",borderRadius:7,border:"none",cursor:"pointer",whiteSpace:"nowrap",fontSize:11,fontWeight:filter===c?600:400,background:filter===c?C.teal:C.surface,color:filter===c?"white":C.textMid}}>{c}</button>)}
    </div>

    {/* Templates */}
    {EMAIL_CATS.filter(cat=>filtered.some(t=>t.cat===cat)).map(cat=><div key={cat}>
      <SecHead title={cat}/>
      {filtered.filter(t=>t.cat===cat).map(t=><Card key={t.id} style={{marginBottom:8}}>
        {editing===t.id?(
          <div>
            <select value={draft.cat} onChange={e=>setDraft({...draft,cat:e.target.value})} style={{width:"100%",padding:"6px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,marginBottom:6}}>
              {EMAIL_CATS.map(c=><option key={c}>{c}</option>)}
            </select>
            <input value={draft.subject} onChange={e=>setDraft({...draft,subject:e.target.value})} style={{width:"100%",padding:"6px 9px",borderRadius:7,border:`1px solid ${C.teal}`,fontSize:12,color:C.text,marginBottom:6,boxSizing:"border-box",fontWeight:600}}/>
            <textarea value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.teal}`,fontSize:12,color:C.text,resize:"vertical",minHeight:120,boxSizing:"border-box",lineHeight:1.6,marginBottom:6}}/>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setEditing(null)} style={{flex:1,padding:"6px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:11,color:C.textMid}}>Cancel</button>
              <button onClick={save} style={{flex:2,padding:"6px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:11,fontWeight:600}}>Save</button>
            </div>
          </div>
        ):(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{fontSize:dv(13,15),fontWeight:700,color:C.text,flex:1,paddingRight:8}}>{t.subject}</div>
              {isAdmin&&<div style={{display:"flex",gap:4,flexShrink:0}}>
                <button onClick={()=>{setEditing(t.id);setDraft({cat:t.cat,subject:t.subject,body:t.body});}} style={{fontSize:10,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>Edit</button>
                <button onClick={()=>del(t.id)} style={{fontSize:10,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.danger}33`,background:C.danger+"11",cursor:"pointer",color:C.danger}}>Del</button>
              </div>}
            </div>
            <div style={{background:C.surface,borderRadius:8,padding:"8px 10px",fontSize:dv(11,13),color:C.textMid,lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:8}}>{t.body}</div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>copy(t.id+"_body",t.body)} style={{flex:1,padding:"6px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:11,color:C.textMid,fontWeight:500}}>{copied===t.id+"_body"?"✓ Copied!":"Copy Body"}</button>
              <a href={"mailto:?subject="+encodeURIComponent(t.subject)+"&body="+encodeURIComponent(t.body)} style={{flex:1,padding:"6px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:11,fontWeight:600,textDecoration:"none",textAlign:"center",display:"block"}}>✉ Email</a>
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
        <div style={{fontSize:12,color:C.textMid,marginTop:2}}>Promotion guidelines, income milestones, and advancement resources</div>
      </div>
      {isAdmin&&<button onClick={()=>{setShowForm(!showForm);setEditing(null);setForm({title:"",url:"",description:"",category:"Promotions"});}} style={{fontSize:11,padding:"5px 10px",borderRadius:7,border:"none",background:C.purple,color:"white",cursor:"pointer",fontWeight:600}}>+ Add Link</button>}
    </div>
    {showForm&&<Card style={{marginBottom:14,border:`1px solid ${C.purple}44`}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>{editing!==null?"Edit":"New"} Advancement Link</div>
      <input placeholder="Title (e.g. RVP Promotion Requirements)" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
      <input placeholder="URL (https://...)" value={form.url} onChange={e=>setForm({...form,url:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
      <input placeholder="Description (optional)" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
      <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,marginBottom:10}}>
        {ADVANCEMENT_CATEGORIES.map(c=><option key={c}>{c}</option>)}
      </select>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>{setShowForm(false);setEditing(null);}} style={{flex:1,padding:"7px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:11,color:C.textMid}}>Cancel</button>
        <button onClick={save} style={{flex:2,padding:"7px",borderRadius:7,border:"none",background:C.purple,color:"white",cursor:"pointer",fontSize:11,fontWeight:600}}>Save Link</button>
      </div>
    </Card>}
    {resources.length===0&&<div style={{textAlign:"center",padding:"32px 0",color:C.textLight}}>{isAdmin?"No advancement resources yet — add your first link above":"No advancement resources added yet — check back soon!"}</div>}
    {resources.length>0&&<div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:12,paddingBottom:2}}>
      {cats.map(c=><button key={c} onClick={()=>setFilter(c)} style={{padding:"5px 10px",borderRadius:7,border:"none",cursor:"pointer",whiteSpace:"nowrap",fontSize:11,fontWeight:filter===c?600:400,background:filter===c?C.purple:C.surface,color:filter===c?"white":C.textMid}}>{c}</button>)}
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
            <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:2}}>{r.title}</div>
            {r.description&&<div style={{fontSize:11,color:C.textMid,marginBottom:4}}>{r.description}</div>}
            <a href={r.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:C.purple,textDecoration:"none",fontWeight:600}}>Open Link →</a>
          </div>
          {isAdmin&&<div style={{display:"flex",gap:4,flexShrink:0}}>
            <button onClick={()=>{setForm(r);setEditing(realIdx);setShowForm(true);}} style={{fontSize:10,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>Edit</button>
            <button onClick={()=>del(realIdx)} style={{fontSize:10,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.danger}33`,background:C.danger+"11",cursor:"pointer",color:C.danger}}>Del</button>
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
      const newRefs=prev.map((r,j)=>j===i?{...r,[f]:f==="phone"?fmtRefPhone(val):val}:r);
      // Save in the background using the LOCAL state as the base — never the stale rep prop
      onUpdate(rep.id,{...rep,references:newRefs});
      return newRefs;
    });
  };

  return <div>{localRefs.map((r,i)=>{const status=r.status||{};const completedCount=REF_STAGES.filter(s=>status[s.k]).length;return <div key={i} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:10,marginBottom:6}}>
    <div style={{fontSize:10,fontWeight:700,color:C.textLight,marginBottom:5}}>Reference #{i+1}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
      {[["name","Name"],["phone","Phone"],["relationship","Relationship"]].map(([f,ph])=><input key={f} placeholder={ph} value={r[f]||""} onChange={e=>updateField(i,f,e.target.value)} style={{padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:"white",gridColumn:f==="relationship"?"span 2":"auto"}}/>)}
    </div>
    {r.name&&completedCount>0&&<div style={{borderTop:`1px solid ${C.border}`,paddingTop:7,marginTop:8,display:"flex",flexDirection:"column",gap:4}}>
      {REF_STAGES.map(s=><div key={s.k} style={{display:"flex",alignItems:"center",gap:6}}>
        <div style={{width:14,height:14,borderRadius:7,background:status[s.k]?C.success:C.border,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{status[s.k]&&<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}</div>
        <span style={{fontSize:11,color:status[s.k]?C.success:C.textLight,fontWeight:status[s.k]?600:400}}>{s.l}</span>
      </div>)}
    </div>}
  </div>;})}</div>;
}

function RepView({rep,data,onUpdate,onUpdateData,readOnly,isOwnView=false}) {
  const [tab,setTab]=useState("checklist");
  const [showCelebration,setShowCelebration]=useState(false);
  const track=TRACK_INFO[rep.track];
  const cl=track?.checklist||[];
  const checked=rep.checked||{};
  const done=cl.filter(i=>checked[i.id]).length;
  const pct=cl.length>0?Math.round((done/cl.length)*100):0;
  const cats=cl.reduce((a,i)=>{if(!a[i.cat])a[i.cat]=[];a[i.cat].push(i);return a;},{});
  const trainer=[...(data.trainers||[]),...(data.admins||[])].find(t=>t.id===rep.trainerId);
  const bookingLink=trainer?.bookingLink||"https://calendly.com/jacquelinejones81/trainingappointment";
  const myRecruits=(data.reps||[]).filter(r=>r.recruitedBy===rep.id);
  const tabs=[
    {k:"checklist",l:"Checklist"},
    {k:"milestones",l:"Milestones"},
    ...(rep.track==="licensed"?[{k:"career",l:"Career Path"},{k:"pipeline",l:"My Pipeline"}]:[]),
    {k:"prospects",l:"Prospects"},
    {k:"appointments",l:"Appts ("+((rep.appointments||[]).length)+")"},
    {k:"scorecard",l:"Scorecard"},
    {k:"recruits",l:"Recruits ("+myRecruits.length+")"},
    {k:"refs",l:"Refs"},
    {k:"scripts",l:"Scripts"},
    {k:"resources",l:"Resources"},{k:"advancement",l:"Advancement"},
    {k:"fame",l:"Wall of Fame"},
    {k:"schedule",l:"Schedule"},
  ];
  const [celebrationPct,setCelebrationPct]=useState(100);
  const tog=(id)=>{
    if(!readOnly){
      const newChecked={...checked,[id]:!checked[id]};
      const newDone=cl.filter(i=>newChecked[i.id]).length;
      const newPct=cl.length>0?Math.round((newDone/cl.length)*100):0;
      const milestones=[25,50,75,100];
      const shownMilestones=rep.milestonesShown||[];
      const hitMilestone=milestones.find(m=>newPct>=m&&pct<m&&!shownMilestones.includes(m));
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
          <div style={{fontSize:13,fontWeight:700,color:"white",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rep.name}</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>{track?.label}</div>
        </div>
        {onClose&&<button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:18,padding:0}}>×</button>}
      </div>
      <div style={{marginTop:10}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>Progress</span>
          <span style={{fontSize:10,fontWeight:700,color:C.teal}}>{pct}%</span>
        </div>
        <div style={{height:4,background:"rgba(255,255,255,0.1)",borderRadius:2}}>
          <div style={{height:4,background:C.teal,borderRadius:2,width:pct+"%",transition:"width 0.3s"}}/>
        </div>
      </div>
      {/* Quick contact trainer */}
      {trainer&&<div style={{marginTop:10,display:"flex",gap:5}}>
        {trainer.phone&&<a href={"tel:"+trainer.phone.replace(/\\D/g,"")} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,padding:"5px 6px",borderRadius:6,background:"rgba(16,185,129,0.15)",border:"1px solid rgba(16,185,129,0.4)",textDecoration:"none"}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.22 1.18 2 2 0 012.22 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.2 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14v2.92z"/></svg>
          <span style={{fontSize:10,color:"#34d399",fontWeight:600}}>Call</span>
        </a>}
        {trainer.phone&&<a href={"sms:"+trainer.phone.replace(/\\D/g,"")} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,padding:"5px 6px",borderRadius:6,background:"rgba(14,165,160,0.15)",border:"1px solid rgba(14,165,160,0.4)",textDecoration:"none"}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
          <span style={{fontSize:10,color:C.teal,fontWeight:600}}>Text</span>
        </a>}
      </div>}
      {/* Meet with RVP */}
      {(data.rvpBookingLinks||[]).filter(r=>r.link).length>0&&<div style={{marginTop:6}}>
        {(data.rvpBookingLinks||[]).filter(r=>r.link).map((rvp,i)=><a key={i} href={rvp.link} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"6px 8px",borderRadius:6,background:"rgba(251,191,36,0.12)",border:"1px solid rgba(251,191,36,0.4)",textDecoration:"none",marginBottom:i<(data.rvpBookingLinks||[]).filter(r=>r.link).length-1?5:0}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2"><path d="M8 2V5M16 2V5M3.5 9H20.5M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z"/></svg>
          <span style={{fontSize:10,color:"#fbbf24",fontWeight:600}}>Meet with RVP - {rvp.name}</span>
        </a>)}
      </div>}
    </div>
    {/* Nav items */}
    <div style={{flex:1,overflowY:"auto",padding:"8px 8px"}}>
      {tabs.map(t=><button key={t.k} onClick={()=>{setTab(t.k);if(onClose)onClose();}} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"9px 10px",background:tab===t.k?"rgba(14,165,160,0.18)":"transparent",border:"none",borderRadius:8,cursor:"pointer",marginBottom:2,textAlign:"left"}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tab===t.k?C.teal:"rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={tabIcons[t.k]||tabIcons.resources}/>
        </svg>
        <span style={{fontSize:12,color:tab===t.k?C.teal:"rgba(255,255,255,0.7)",fontWeight:tab===t.k?600:400}}>{t.l}</span>
      </button>)}
    </div>
    {/* Footer */}
    <div style={{padding:"10px 12px",borderTop:"1px solid rgba(255,255,255,0.08)",fontSize:10,color:"rgba(255,255,255,0.3)",textAlign:"center"}}>NextLevel Field Training Hub</div>
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
        <span style={{fontSize:13,fontWeight:600,color:"white"}}>{tabs.find(t=>t.k===tab)?.l||"Checklist"}</span>
        <div style={{marginLeft:"auto",fontSize:12,fontWeight:700,color:C.teal}}>{pct}%</div>
      </div>}
      <div style={{padding:"14px 16px"}}>
    <div style={{background:`linear-gradient(135deg,${C.navy} 0%,${C.navyMid} 100%)`,borderRadius:12,padding:"14px 18px",marginBottom:14,color:"white"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div><div style={{fontSize:15,fontWeight:700}}>{rep.name}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginTop:2}}>{track?.label} - {track?.days}</div></div>
        <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:700,color:C.teal}}>{pct}%</div><div style={{fontSize:9,color:"rgba(255,255,255,0.4)"}}>COMPLETE</div></div>
      </div>
      <Bar pct={pct} h={5}/>
      {pct===100&&<div style={{marginTop:8,background:C.success+"22",border:`1px solid ${C.success}44`,borderRadius:8,padding:"6px 10px",fontSize:12,color:C.success,textAlign:"center",fontWeight:600}}>All tasks complete!</div>}
      {pct===100&&(rep.track==="fast"||rep.track==="regular")&&!rep.nextLevelRequested&&!rep.nextLevelGranted&&(
        <button onClick={()=>{const lr=(data.reps||[]).find(r=>r.id===rep.id)||rep;onUpdate(rep.id,{...lr,nextLevelRequested:true,nextLevelRequestedAt:new Date().toISOString()});}}
          style={{width:"100%",marginTop:8,padding:"10px",borderRadius:8,background:`linear-gradient(135deg,${C.gold},#f97316)`,border:"none",color:"white",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          Request Access to Licensed Now What
        </button>
      )}
      {rep.nextLevelRequested&&!rep.nextLevelGranted&&(
        <div style={{marginTop:8,background:C.gold+"22",border:`1px solid ${C.gold}44`,borderRadius:8,padding:"8px 12px",fontSize:12,color:C.gold,textAlign:"center"}}>
          Request sent! Waiting for admin approval...
        </div>
      )}
      {!rep.nextLevelRequested&&rep.nextLevelDenied&&!rep.nextLevelGranted&&(pct===100)&&(rep.track==="fast"||rep.track==="regular")&&(
        <div style={{marginTop:8}}>
          <div style={{background:C.danger+"22",border:`1px solid ${C.danger}44`,borderRadius:8,padding:"7px 12px",fontSize:11,color:C.danger,marginBottom:6,textAlign:"center"}}>
            Request was not approved — speak with your trainer for next steps
          </div>
          <button onClick={()=>onUpdate(rep.id,{...rep,nextLevelRequested:true,nextLevelDenied:false,nextLevelRequestedAt:new Date().toISOString()})}
            style={{width:"100%",padding:"9px",borderRadius:8,background:`linear-gradient(135deg,${C.gold},#f97316)`,border:"none",color:"white",fontWeight:700,fontSize:12,cursor:"pointer"}}>
            Request Again
          </button>
        </div>
      )}
      {rep.nextLevelGranted&&rep.track!=="licensed"&&(
        <div style={{marginTop:8,background:C.success+"22",border:`1px solid ${C.success}44`,borderRadius:8,padding:"8px 12px",fontSize:12,color:C.success,textAlign:"center",fontWeight:600}}>
          Access granted! Refresh to see your Licensed Now What checklist.
        </div>
      )}
    </div>
    {/* ── WALL OF FAME BANNER ── */}
    <WallOfFameBanner data={data}/>
    {!readOnly&&rep.track==="licensed"&&<DailyActivityLog rep={rep} data={data} onUpdate={(u)=>{if(onUpdateData)onUpdateData(u);}} isFirstTime={!(data.activityLogs||{})[rep.id]?.seenIntro}/>}
    {!readOnly&&rep.track==="licensed"&&<MyLeadLink name={rep.name} data={data}/>}
    {!readOnly&&rep.track==="licensed"&&<MyLeads repName={rep.name}/>}
    {/* ── CAREER JOURNEY STICKY BANNER ── */}
    {!readOnly&&<CareerJourneyBanner rep={rep} onUpdate={onUpdate}/>}

    {showCelebration&&<Confetti name={rep.name} pct={celebrationPct} onClose={()=>setShowCelebration(false)}/>}
    {tab==="checklist"&&<div>{rep.track==="licensed"&&!readOnly&&<LicensedPremiumEntry rep={rep} onUpdate={(u)=>onUpdate(rep.id,u)}/>}{rep.track==="licensed"&&!readOnly&&<RepInvestmentEntry rep={rep} onUpdate={(u)=>onUpdate(rep.id,u)}/>}{rep.track==="licensed"&&<GoalBoard data={data} onUpdate={()=>{}} userRole="rep"/>}<RepCounters rep={rep} onUpdate={(u)=>onUpdate(rep.id,u)} readOnly={readOnly}/>{Object.entries(cats).map(([cat,items])=>{const cd=items.filter(i=>checked[i.id]).length;return <div key={cat}><SecHead title={cat} count={[cd,items.length]}/>{items.map(item=><CheckItem key={item.id} item={item} checked={!!checked[item.id]} onToggle={()=>tog(item.id)} readOnly={readOnly}/>)}</div>;})}</div>}
    {tab==="milestones"&&<RepExtras rep={rep} onUpdate={(u)=>onUpdate(rep.id,u)} onUpdateData={onUpdateData||null} readOnly={readOnly} data={data}/>}
    {tab==="appointments"&&<ApptTracker appointments={rep.appointments||[]} onChange={a=>onUpdate(rep.id,{...rep,appointments:a})} readOnly={readOnly} bookingLink={bookingLink}/>}
    {tab==="refs"&&<RefsEditor rep={rep} data={data} onUpdate={onUpdate}/>}
    {tab==="scripts"&&<div>{(data.scripts||SCRIPTS).map((s,i)=><Card key={i} style={{marginBottom:10}}><div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:8}}>{s.title}</div><div style={{background:C.surface,borderRadius:8,padding:"10px 12px",fontSize:12,color:C.textMid,lineHeight:1.6}}>"{s.content}"</div></Card>)}</div>}
    {tab==="prospects"&&<ProspectsTab rep={rep} onUpdate={(u)=>onUpdate(rep.id,u)}/>}
    {tab==="pipeline"&&<LeadPipeline rep={rep} data={data} onUpdate={onUpdateData||((u)=>onUpdate(rep.id,u))}/>}
    {tab==="resources"&&<ResourceLibrary data={data} onUpdate={()=>{}} userRole="rep"/>}
    {tab==="advancement"&&<AdvancementLibrary data={data} onUpdate={()=>{}} userRole="rep"/>}
    {tab==="recruits"&&<RecruitsTab rep={rep} data={data} myRecruits={myRecruits} onUpdate={onUpdate}/>}
    {tab==="career"&&<CareerPath rep={rep} data={data} onUpdate={onUpdate}/>}
    {tab==="fame"&&<WallOfFame data={data} onUpdate={()=>{}} userRole="rep"/>}
    {tab==="scorecard"&&<ScorecardPage data={data} onUpdate={onUpdateData||(u=>onUpdate(rep.id,{...rep}))} userId={rep.id} userRole="rep"/>}
    {tab==="schedule"&&<ScheduleView data={data} onUpdate={(u)=>onUpdate(rep.id,{...rep})} userRole="rep"/>}
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
      const newRefs=prev.map((r,j)=>j===i?{...r,[f]:f==="phone"?fmtRefPhone(val):val}:r);
      onUpdate(rep.id,{...rep,references:newRefs});
      return newRefs;
    });
  };

  const toggleStatus=(i,stageKey)=>{
    setLocalRefs(prev=>{
      const curStatus=prev[i].status||{};
      const newRefs=prev.map((r,j)=>j===i?{...r,status:{...curStatus,[stageKey]:!curStatus[stageKey]}}:r);
      onUpdate(rep.id,{...rep,references:newRefs});
      return newRefs;
    });
  };

  return <div>{localRefs.map((r,i)=>{const status=r.status||{};return <div key={i} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:10,marginBottom:6}}>
    <div style={{fontSize:10,fontWeight:700,color:C.textLight,marginBottom:5}}>Reference #{i+1}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:r.name?8:0}}>
      {[["name","Name"],["phone","Phone"],["relationship","Relationship"]].map(([f,ph])=><input key={f} placeholder={ph} value={r[f]||""} onChange={e=>updateField(i,f,e.target.value)} style={{padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:"white",gridColumn:f==="relationship"?"span 2":"auto"}}/>)}
    </div>
    {r.name&&<div style={{borderTop:`1px solid ${C.border}`,paddingTop:8}}>
      <div style={{fontSize:9,fontWeight:700,color:C.textLight,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.5px"}}>Outreach Status</div>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {REF_STAGES.map(s=><label key={s.k} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer"}}>
          <input type="checkbox" checked={!!status[s.k]} onChange={()=>toggleStatus(i,s.k)} style={{width:15,height:15,accentColor:C.teal,cursor:"pointer"}}/>
          <span style={{fontSize:12,color:status[s.k]?C.success:C.textMid,fontWeight:status[s.k]?600:400,textDecoration:status[s.k]?"line-through":"none"}}>{s.l}</span>
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
  const trDone=TRAINER_CHECKLIST.filter(i=>tc[i.id]).length;
  const cl=track?.checklist||[];
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
      <span style={{fontSize:12,color:C.gold,fontWeight:600}}>Viewing as: {rep.name}</span>
      <button onClick={()=>setViewAsRep(false)} style={{fontSize:11,padding:"4px 10px",borderRadius:6,background:C.gold,color:"white",border:"none",cursor:"pointer",fontWeight:600}}>Exit Preview</button>

    </div>
    <RepView rep={rep} data={data} onUpdate={onUpdate} onUpdateData={null} readOnly={true}/>
  </div>;

  return <div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button onClick={onBack} style={{background:C.surface,border:"none",padding:"6px 10px",borderRadius:8,cursor:"pointer",fontSize:12,color:C.textMid}}>&larr; Back</button>
      <div style={{flex:1}}>
        <div style={{fontSize:15,fontWeight:700,color:C.text}}>{rep.name}</div>
        {!editContact&&<div style={{fontSize:11,color:C.textMid,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
          <PhoneLink phone={rep.phone}/>
          {rep.email&&<a href={"mailto:"+rep.email} style={{fontSize:11,color:C.teal,textDecoration:"none"}}>✉ {rep.email}</a>}
          <Badge color={track?.color||C.teal} small>{track?.label}</Badge>
          <button onClick={()=>{setContactForm({phone:rep.phone||"",email:rep.email||""});setEditContact(true);}} style={{fontSize:10,padding:"1px 6px",borderRadius:4,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>Edit</button>
        </div>}
        {editContact&&<div style={{marginTop:4,display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
          <input placeholder="Phone" value={contactForm.phone} onChange={e=>setContactForm({...contactForm,phone:e.target.value})} style={{width:120,padding:"3px 6px",borderRadius:5,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}/>
          <input placeholder="Email" value={contactForm.email} onChange={e=>setContactForm({...contactForm,email:e.target.value})} style={{width:160,padding:"3px 6px",borderRadius:5,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}/>
          <button onClick={saveContact} style={{padding:"3px 8px",borderRadius:5,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:10,fontWeight:600}}>Save</button>
          <button onClick={()=>setEditContact(false)} style={{padding:"3px 8px",borderRadius:5,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:10,color:C.textMid}}>Cancel</button>
        </div>}
      </div>
      <button onClick={()=>setViewAsRep(true)} style={{fontSize:11,padding:"5px 10px",borderRadius:7,background:C.teal+"11",border:`1px solid ${C.teal}44`,color:C.teal,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>View as Rep</button>
      <ReassignTrainer rep={rep} data={data} onUpdate={onUpdate} />
      <RecruitedByEditor rep={rep} data={data} onUpdate={onUpdate}/>
      <ResetPinButton person={rep} personType="rep" data={data} onUpdate={onUpdate||upd}/>
      <button onClick={()=>{if(window.confirm(`Remove ${rep.name} from the app? This cannot be undone.`))onDelete(rep.id);}} style={{fontSize:11,padding:"5px 10px",borderRadius:7,background:C.danger+"11",border:`1px solid ${C.danger}33`,color:C.danger,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>Remove Rep</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
      <Card style={{padding:"10px 12px"}}><div style={{fontSize:10,color:C.textMid,marginBottom:3}}>Trainer</div><div style={{fontSize:18,fontWeight:700,color:C.teal}}>{Math.round((trDone/TRAINER_CHECKLIST.length)*100)}%</div><Bar pct={(trDone/TRAINER_CHECKLIST.length)*100}/><div style={{fontSize:10,color:C.textLight,marginTop:3}}>{trDone}/{TRAINER_CHECKLIST.length}</div></Card>
      <Card style={{padding:"10px 12px"}}><div style={{fontSize:10,color:C.textMid,marginBottom:3}}>Rep</div><div style={{fontSize:18,fontWeight:700,color:track?.color||C.purple}}>{Math.round((repDone/(cl.length||1))*100)}%</div><Bar pct={(repDone/(cl.length||1))*100} color={track?.color||C.purple}/><div style={{fontSize:10,color:C.textLight,marginTop:3}}>{repDone}/{cl.length}</div></Card>
    </div>
    <Card style={{marginBottom:12,padding:"10px 14px"}}>
      <div style={{fontSize:11,fontWeight:700,color:C.textMid,marginBottom:8}}>Rep-Entered Data</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        {[{l:"DGO Date",v:rep.dgoDate||(rep.dgoDone?"Done":"Not set"),c:C.teal},{l:"Business Commit",v:rep.businessCommitment?`$${rep.businessCommitment}`:"Not set",c:C.gold},{l:"Exam Date",v:rep.examDate||(rep.examPassed?"Passed":"Not set"),c:C.purple},{l:"Bonus Goal",v:BONUS_GOALS.find(g=>g.id===rep.bonusGoal)?.label||"Not set",c:C.danger}].map(d=><div key={d.l} style={{textAlign:"center",padding:"7px",background:C.surface,borderRadius:8}}><div style={{fontSize:11,fontWeight:700,color:d.c,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.v}</div><div style={{fontSize:9,color:C.textLight}}>{d.l}</div></div>)}
      {rep.myWhy&&<div style={{marginTop:8,background:C.purple+"11",border:`1px solid ${C.purple}22`,borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:9,fontWeight:700,color:C.purple,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:3}}>My Why</div><div style={{fontSize:11,color:C.text,fontStyle:"italic",lineHeight:1.5}}>"{rep.myWhy}"</div></div>}
      {rep.preLicType&&<div style={{marginTop:6,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}><Badge color={C.purple} small>Pre-Lic: {rep.preLicType==="inperson"?"In-Person":rep.preLicType==="zoom"?"Zoom":"Online"}</Badge>{rep.preLicDone&&<Badge color={C.success} small>Complete</Badge>}{rep.selectedRVP&&<Badge color={C.gold} small>RVP: {rep.selectedRVP}</Badge>}</div>}
      {rep.dgoPhoto&&<DgoPhotoPanel photo={rep.dgoPhoto} name={rep.name}/>}
      {rep.tshirtSize&&<div style={{display:"flex",alignItems:"center",gap:6,marginTop:8}}><div style={{padding:"4px 12px",borderRadius:6,background:C.gold,color:"white",fontSize:12,fontWeight:700}}>{rep.tshirtSize}</div><span style={{fontSize:11,color:C.textMid}}>T-Shirt Size</span></div>}
      </div>
    </Card>
    <div style={{display:"flex",gap:3,overflowX:"auto",marginBottom:10}}>
      {tabs.map(t=><button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"5px 9px",borderRadius:8,border:"none",cursor:"pointer",whiteSpace:"nowrap",fontSize:11,fontWeight:tab===t.k?600:400,background:tab===t.k?C.navy:C.surface,color:tab===t.k?"white":C.textMid}}>{t.l}</button>)}
    </div>
    {tab==="trainer"&&<div>{Object.entries(TRAINER_CHECKLIST.reduce((a,i)=>{if(!a[i.cat])a[i.cat]=[];a[i.cat].push(i);return a;},{})).map(([cat,items])=>{const cd=items.filter(i=>tc[i.id]).length;return <div key={cat}><SecHead title={cat} count={[cd,items.length]}/>{items.map(item=><CheckItem key={item.id} item={item} checked={!!tc[item.id]} onToggle={()=>togT(item.id)}/>)}</div>;})}</div>}
    {tab==="rep"&&<RepView rep={liveRepData} data={data} onUpdate={onUpdate} onUpdateData={null} readOnly={false}/>}
    {tab==="appointments"&&<ApptTracker appointments={rep.appointments||[]} onChange={a=>onUpdate(rep.id,{...rep,appointments:a})}/>}
    {tab==="refs"&&<AdminRefsEditor rep={rep} data={data} onUpdate={onUpdate}/>}
    {tab==="milestones"&&<RepExtras rep={rep} onUpdate={(u)=>onUpdate(rep.id,u)} onUpdateData={null} readOnly={false} data={data}/>}
    {tab==="checkins"&&<div>
      {(()=>{const cis=rep.checkIns||[];const last=cis.length>0?new Date(cis[cis.length-1].date):null;const ds=last?Math.floor((Date.now()-last)/(86400000)):null;const stalled=ds!==null&&ds>=7;return <div style={{background:stalled?C.danger+"11":C.success+"11",border:`1px solid ${stalled?C.danger+"33":C.success+"33"}`,borderRadius:8,padding:"7px 10px",marginBottom:10,fontSize:12,color:stalled?C.danger:C.success}}>{ds===null?"No check-ins yet - log one below":ds===0?"Checked in today":`Last check-in ${ds} day${ds!==1?"s":""} ago${stalled?" - consider reaching out!":""}`}</div>;})()}
      <div style={{display:"flex",gap:7,marginBottom:12}}><input placeholder="Log a check-in note..." value={ciNote} onChange={e=>setCiNote(e.target.value)} style={{flex:1,padding:"7px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text}}/><button onClick={addCI} style={{padding:"7px 12px",borderRadius:8,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:600}}>Log</button></div>
      {(()=>{const liveRep=(data.reps||[]).find(r=>r.id===rep.id)||rep;return(liveRep.checkIns||[]).slice().reverse().map((ci,i)=><div key={i} style={{padding:"7px 0",borderBottom:`1px solid ${C.border}`}}><div style={{fontSize:12,color:C.text}}>{ci.note}</div><div style={{fontSize:10,color:C.textLight,marginTop:1}}>{new Date(ci.date).toLocaleDateString()}</div></div>);})()}
    </div>}
    {tab==="career"&&<CareerPath rep={rep} data={data} onUpdate={onUpdate}/>}
    {tab==="schedule"&&<ScheduleView data={data} onUpdate={onUpdateData||((u)=>{})} userRole="rep"/>}
    {tab==="rvp"&&<div>{Object.entries(RVP_CHECKLIST.reduce((a,i)=>{if(!a[i.cat])a[i.cat]=[];a[i.cat].push(i);return a;},{})).map(([cat,items])=><div key={cat}><SecHead title={cat} color={C.gold}/>{items.map(item=><CheckItem key={item.id} item={item} checked={!!(rep.rvpChecked||{})[item.id]} onToggle={()=>onUpdate(rep.id,{...rep,rvpChecked:{...(rep.rvpChecked||{}),[item.id]:!(rep.rvpChecked||{})[item.id]}})}/>)}</div>)}</div>}
  </div>;
}

// ── MY PRODUCTION ──
function MyProd({myProd,onUpdate}) {
  const [open,setOpen]=useState(false);
  const [tab,setTab]=useState("lifeapps");
  const [na,setNa]=useState({clientName:"",premium:"",date:""});
  const [ni,setNi]=useState({clientName:"",pac:"",lumpSum:"",type:"Mutual Fund"});
  const [addPrem,setAddPrem]=useState("");
  const apps=myProd.lifeApps||[];
  const invs=myProd.investments||[];
  const totPrem=apps.reduce((s,a)=>s+(Number(a.premium)||0),0);
  const totPAC=invs.reduce((s,i)=>s+(Number(i.pac)||0),0);
  const totLump=invs.reduce((s,i)=>s+(Number(i.lumpSum)||0),0);
  return <Card style={{marginBottom:14}}>
    <div onClick={()=>setOpen(!open)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
      <div><div style={{fontSize:13,fontWeight:700,color:C.text}}>My Production</div><div style={{fontSize:11,color:C.textMid,marginTop:1}}>{apps.length} apps - ${totPrem.toFixed(0)}/mo - ${(totPrem*12).toFixed(0)}/yr</div></div>
      <span style={{color:C.textLight,fontSize:18,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>v</span>
    </div>
    {open&&<div style={{marginTop:12}}>
      <div style={{display:"flex",gap:3,marginBottom:10}}>{[["lifeapps","Life Apps"],["investments","Investments"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:"4px 10px",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,fontWeight:tab===k?600:400,background:tab===k?C.teal:"transparent",color:tab===k?"white":C.textMid}}>{l}</button>)}</div>
      {tab==="lifeapps"&&<div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:10}}>
          <div style={{background:C.teal+"11",borderRadius:8,padding:"7px 10px",textAlign:"center"}}><div style={{fontSize:17,fontWeight:700,color:C.teal}}>{apps.length}</div><div style={{fontSize:10,color:C.textMid}}>Life Apps</div></div>
          <div style={{background:C.gold+"11",borderRadius:8,padding:"7px 10px",textAlign:"center"}}><div style={{fontSize:17,fontWeight:700,color:C.gold}}>${totPrem.toFixed(0)}/mo</div><div style={{fontSize:10,color:C.textMid}}>Monthly</div></div>
          <div style={{background:C.purple+"11",borderRadius:8,padding:"7px 10px",textAlign:"center"}}><div style={{fontSize:17,fontWeight:700,color:C.purple}}>${(totPrem*12).toFixed(0)}/yr</div><div style={{fontSize:10,color:C.textMid}}>Annual</div></div>
        </div>
        <div style={{background:C.surface,borderRadius:8,padding:9,marginBottom:8}}>
          <div style={{fontSize:10,fontWeight:700,color:C.textMid,marginBottom:6}}>Log New Life App</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
            <input placeholder="Client Name" value={na.clientName} onChange={e=>setNa({...na,clientName:e.target.value})} style={{gridColumn:"span 2",padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}/>
            <input placeholder="Monthly Premium $" value={na.premium} onChange={e=>setNa({...na,premium:e.target.value})} style={{padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}/>
            <input type="date" value={na.date} onChange={e=>setNa({...na,date:e.target.value})} style={{padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}/>
          </div>
          <button onClick={()=>{if(!na.clientName)return;onUpdate({...myProd,lifeApps:[...apps,{...na,id:Date.now()}]});setNa({clientName:"",premium:"",date:""}); }} style={{marginTop:7,width:"100%",padding:"6px",borderRadius:7,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:11,fontWeight:600}}>+ Log Life App</button>
        </div>
        {apps.length>0&&<div style={{background:C.gold+"11",border:`1px solid ${C.gold}33`,borderRadius:8,padding:"10px 12px",marginBottom:8}}>
          <div style={{fontSize:11,fontWeight:700,color:C.gold,marginBottom:8}}>Add Premium to Running Total</div>
          <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:6}}>
            <input type="number" placeholder="New amount $/mo" value={addPrem} onChange={e=>setAddPrem(e.target.value)} style={{flex:1,padding:"6px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text}}/>
            <button onClick={()=>{if(!addPrem)return;onUpdate({...myProd,lifeApps:[...apps,{clientName:"Additional Premium",premium:addPrem,date:new Date().toLocaleDateString(),id:Date.now()}]});setAddPrem("");}} style={{padding:"6px 12px",borderRadius:6,background:C.gold,color:"white",border:"none",cursor:"pointer",fontSize:11,fontWeight:600}}>Add</button>
          </div>
          <div style={{fontSize:11,color:C.textMid}}>Current: <strong style={{color:C.gold}}>${totPrem.toFixed(0)}/mo</strong>{addPrem&&<span> + ${addPrem} = <strong style={{color:C.success}}>${(totPrem+Number(addPrem)).toFixed(0)}/mo (${((totPrem+Number(addPrem))*12).toFixed(0)}/yr)</strong></span>}</div>
        </div>}
        {apps.map((a,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${C.border}`,fontSize:11}}><span style={{color:C.text}}>{a.clientName}</span><div style={{display:"flex",gap:7,alignItems:"center"}}>{a.premium&&<span style={{color:C.gold}}>${a.premium}/mo</span>}<button onClick={()=>onUpdate({...myProd,lifeApps:apps.filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:14}}>x</button></div></div>)}
      </div>}
      {tab==="investments"&&<div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>{[[invs.length,"Investments",C.teal],[`$${totPAC.toFixed(0)}/mo`,"PAC Total",C.gold],[`$${totLump.toFixed(0)}`,"Lump Sum",C.purple]].map(([v,l,c])=><div key={l} style={{background:c+"11",borderRadius:8,padding:"7px 8px",textAlign:"center"}}><div style={{fontSize:15,fontWeight:700,color:c}}>{v}</div><div style={{fontSize:9,color:C.textMid}}>{l}</div></div>)}</div>
        <div style={{background:C.surface,borderRadius:8,padding:9,marginBottom:8}}>
          <div style={{fontSize:10,fontWeight:700,color:C.textMid,marginBottom:6}}>Log New Investment</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
            <input placeholder="Client Name" value={ni.clientName} onChange={e=>setNi({...ni,clientName:e.target.value})} style={{gridColumn:"span 2",padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}/>
            <input placeholder="PAC $/mo" value={ni.pac} onChange={e=>setNi({...ni,pac:e.target.value})} style={{padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}/>
            <input placeholder="Lump Sum $" value={ni.lumpSum} onChange={e=>setNi({...ni,lumpSum:e.target.value})} style={{padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}/>
            <select value={ni.type} onChange={e=>setNi({...ni,type:e.target.value})} style={{gridColumn:"span 2",padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}><option>Mutual Fund</option><option>Annuity</option></select>
          </div>
          <button onClick={()=>{if(!ni.clientName)return;onUpdate({...myProd,investments:[...invs,{...ni,id:Date.now(),date:new Date().toLocaleDateString()}]});setNi({clientName:"",pac:"",lumpSum:"",type:"Mutual Fund"});}} style={{marginTop:7,width:"100%",padding:"6px",borderRadius:7,background:C.gold,color:"white",border:"none",cursor:"pointer",fontSize:11,fontWeight:600}}>+ Log New Investment</button>
        </div>
        {invs.map((inv,i)=><div key={i} style={{padding:"6px 0",borderBottom:`1px solid ${C.border}`,fontSize:11}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:C.text,fontWeight:600}}>{inv.clientName}</span><button onClick={()=>onUpdate({...myProd,investments:invs.filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer"}}>x</button></div><div style={{color:C.textMid,display:"flex",gap:6,marginTop:1}}><Badge color={C.teal} small>{inv.type}</Badge>{inv.pac&&<span>PAC: ${inv.pac}/mo</span>}{inv.lumpSum&&<span>Lump: ${inv.lumpSum}</span>}</div></div>)}
      </div>}
    </div>}
  </Card>;
}

// ── INVESTMENT BREAKDOWN ──
function InvestmentBreakdown({data,reps,allStaff,totPAC,totLump}) {
  const [open,setOpen] = useState(false);

  // Build per-person breakdown
  const breakdown = [];
  reps.forEach(r=>{
    const inv = r.investments||[];
    const pac = inv.reduce((s,i)=>s+(Number(i.pac)||0),0);
    const lump = inv.reduce((s,i)=>s+(Number(i.lumpSum)||0),0);
    if(pac>0||lump>0) breakdown.push({name:r.name,role:"Rep",pac,lump,entries:inv});
  });
  allStaff.forEach(t=>{
    const inv = (data.myProduction||{})[t.id]?.investments||[];
    const inv2 = t.investments||[];
    const allInv = [...inv,...inv2.filter(i=>!inv.find(j=>j.id===i.id))];
    const pac = allInv.reduce((s,i)=>s+(Number(i.pac)||0),0);
    const lump = allInv.reduce((s,i)=>s+(Number(i.lumpSum)||0),0);
    if(pac>0||lump>0) breakdown.push({name:t.name,role:t.isSuperAdmin?"Super Admin":"Admin/Trainer",pac,lump,entries:allInv});
  });

  return <div style={{marginTop:4,marginBottom:10}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:6}}>
      <div style={{background:C.surface,borderRadius:8,padding:"8px 10px"}}>
        <div style={{fontSize:10,color:C.textMid,marginBottom:2}}>Total Monthly PAC</div>
        <div style={{fontSize:16,fontWeight:700,color:C.teal}}>${totPAC.toLocaleString()}</div>
      </div>
      <div style={{background:C.surface,borderRadius:8,padding:"8px 10px"}}>
        <div style={{fontSize:10,color:C.textMid,marginBottom:2}}>Total Lump Sum</div>
        <div style={{fontSize:16,fontWeight:700,color:C.purple}}>${totLump.toLocaleString()}</div>
      </div>
    </div>
    {breakdown.length>0&&<button onClick={()=>setOpen(!open)} style={{fontSize:10,color:C.teal,background:"none",border:"none",cursor:"pointer",padding:0,textDecoration:"underline"}}>
      {open?"Hide":"Show"} breakdown ({breakdown.length} contributor{breakdown.length!==1?"s":""})
    </button>}
    {open&&<div style={{marginTop:6,background:C.surface,borderRadius:8,padding:"8px 10px"}}>
      {breakdown.map((b,i)=><div key={i} style={{marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
          <div>
            <span style={{fontSize:12,fontWeight:600,color:C.text}}>{b.name}</span>
            <span style={{fontSize:10,color:C.textLight,marginLeft:6}}>{b.role}</span>
          </div>
          <div style={{display:"flex",gap:10}}>
            {b.pac>0&&<span style={{fontSize:11,color:C.teal,fontWeight:600}}>${b.pac}/mo PAC</span>}
            {b.lump>0&&<span style={{fontSize:11,color:C.purple,fontWeight:600}}>${b.lump.toLocaleString()} Lump</span>}
          </div>
        </div>
        {b.entries.map((e,ei)=><div key={ei} style={{fontSize:10,color:C.textMid,paddingLeft:10,borderLeft:"2px solid "+C.border,marginBottom:2}}>
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
  const totLump = allInvLogs.reduce((s,i)=>s+(Number(i.lumpSum)||0),0);
  return <Card style={{marginBottom:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:13,fontWeight:700,color:C.text}}>Team Production</div><div style={{display:"flex",gap:6}}><button onClick={()=>{if(window.confirm("Clear Annual Premium, New Recruits display, Licensed Agents, and all investment entries? This resets all production counters."))onUpdateData({...data,reps:(data.reps||[]).map(r=>({...r,selfPremium:[],isLicensed:false,premiumSubmitted:0,investments:[]})),myProduction:{},prodOverride:{recruits:0},admins:(data.admins||[]).map(a=>({...a,investments:[]})),trainers:(data.trainers||[]).map(t=>({...t,investments:[]}))});}} style={{fontSize:10,padding:"3px 8px",borderRadius:6,border:"1px solid "+C.danger+"33",background:C.danger+"11",cursor:"pointer",color:C.danger,fontWeight:600}}>Clear Counters</button><button onClick={()=>setEditG(!editG)} style={{fontSize:11,padding:"3px 9px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>{editG?"Cancel":"Edit Goals"}</button></div></div>
    {editG&&<div style={{background:C.surface,borderRadius:8,padding:9,marginBottom:10}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}>{[["premium","Annual Premium $",gd.premium],["recruits","Recruits",gd.recruits],["licensed","Licensed Agents",gd.licensed]].map(([k,l,v])=><div key={k}><div style={{fontSize:10,color:C.textMid,marginBottom:3}}>{l}</div><input type="number" value={v} onChange={e=>setGd({...gd,[k]:Number(e.target.value)})} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,boxSizing:"border-box",color:C.text}}/></div>)}</div>
      <button onClick={()=>{onUpdateData({...data,goals:gd});setEditG(false);}} style={{marginTop:7,width:"100%",padding:"6px",borderRadius:7,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:11,fontWeight:600}}>Save Goals</button>
    </div>}
    {[{l:"Annual Premium",v:totPremMo*12,goal:goals.premium,fmt:v=>`$${Math.round(v).toLocaleString()}`,c:C.teal,sub:`$${totPremMo.toFixed(0)}/mo`},{l:"New Recruits",v:totRecs,goal:goals.recruits,fmt:v=>v,c:C.purple},{l:"Licensed Agents",v:totLic,goal:goals.licensed,fmt:v=>v,c:C.gold}].map(g=><div key={g.l} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:C.textMid}}>{g.l}</span><span style={{fontSize:12,fontWeight:600,color:g.v>=g.goal?C.success:C.text}}>{g.fmt(g.v)} / {g.fmt(g.goal)}</span></div>{g.sub&&<div style={{fontSize:10,color:C.textLight,marginBottom:3}}>{g.sub}</div>}<Bar pct={(g.v/g.goal)*100} color={g.v>=g.goal?C.success:g.c}/></div>)}
    {(totPAC>0||totLump>0)&&<InvestmentBreakdown data={data} reps={reps} allStaff={allStaff} totPAC={totPAC} totLump={totLump}/>}
    <CollapsibleRepList reps={reps} data={data} onUpdateData={onUpdateData}/>
  </Card>;
}

// ── ADD REP ──
function AddRep({onAdd,onClose,trainers,allPeople=[]}) {
  const [f,setF]=useState({name:"",phone:"",email:"",track:"fast",trainerId:"",startDate:new Date().toISOString().split("T")[0],graduationDate:""});
  const fmtP=v=>{const d=v.replace(/\D/g,"").slice(0,10);if(d.length>=7)return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;if(d.length>=4)return `${d.slice(0,3)}-${d.slice(3)}`;return d;};
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
    <div style={{background:"white",borderRadius:16,padding:22,width:"100%",maxWidth:420,maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div style={{fontSize:15,fontWeight:700,color:C.text}}>Add New Rep</div><button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.textMid}}>x</button></div>
      {[{fld:"name",l:"Full Name",t:"text"},{fld:"phone",l:"Phone",t:"text"},{fld:"email",l:"Email",t:"email"},{fld:"startDate",l:"Start Date",t:"date"},{fld:"graduationDate",l:"Target Graduation",t:"date"},].map(({fld,l,t})=><div key={fld} style={{marginBottom:9}}><label style={{fontSize:11,color:C.textMid,display:"block",marginBottom:3}}>{l}</label><input type={t} value={f[fld]} onChange={e=>setF({...f,[fld]:fld==="phone"?fmtP(e.target.value):e.target.value})} style={{width:"100%",padding:"8px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box"}}/></div>)}
      <div style={{marginBottom:9}}><label style={{fontSize:11,color:C.textMid,display:"block",marginBottom:5}}>Track</label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>{Object.entries(TRACK_INFO).map(([k,ti])=><button key={k} onClick={()=>setF({...f,track:k})} style={{padding:"7px",borderRadius:8,border:`2px solid ${f.track===k?ti.color:C.border}`,background:f.track===k?ti.color+"11":"white",cursor:"pointer"}}><div style={{fontSize:10,fontWeight:700,color:f.track===k?ti.color:C.textMid}}>{ti.label}</div><div style={{fontSize:9,color:C.textLight}}>{ti.days}</div></button>)}</div></div>
      <div style={{marginBottom:9}}><label style={{fontSize:11,color:C.textMid,display:"block",marginBottom:3}}>Assign Trainer</label><select value={f.trainerId} onChange={e=>setF({...f,trainerId:e.target.value})} style={{width:"100%",padding:"8px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}><option value="">No trainer</option>{trainers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}{(allPeople||[]).filter(p=>p.role==="Admin"&&(p.alsoRecruits||p.isSuperAdmin)).map(a=><option key={a.id} value={a.id}>{a.name} (Admin)</option>)}</select></div>
      <div style={{marginBottom:9}}><label style={{fontSize:11,color:C.textMid,display:"block",marginBottom:3}}>Recruited By</label><select value={f.recruitedBy||""} onChange={e=>setF({...f,recruitedBy:e.target.value})} style={{width:"100%",padding:"8px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}><option value="">Select recruiter...</option>{allPeople.map(p=><option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}</select></div>
      <button onClick={()=>{if(f.name){onAdd(f);onClose();}}} style={{width:"100%",padding:"10px",borderRadius:8,background:C.teal,color:"white",border:"none",fontWeight:600,fontSize:13,cursor:"pointer",marginTop:4}}>Add Rep</button>
    </div>
  </div>;
}

// ── MANAGE TEAM ──
function ManageTeam({data,onUpdate,onClose}) {
  const [nt,setNt]=useState({name:"",pin:"",bookingLink:""});
  const [na,setNa]=useState({name:"",pin:""});
  const trainers=data.trainers||[];
  const admins=data.admins||[{id:"superadmin",name:"Jacqueline Jones",pin:"1234",isSuperAdmin:true,alsoRecruits:true}];
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
    <div style={{background:"white",borderRadius:16,padding:22,width:"100%",maxWidth:460,maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}><div style={{fontSize:15,fontWeight:700,color:C.text}}>Manage Team</div><button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.textMid}}>x</button></div>
      <div style={{marginBottom:14}}><div style={{fontSize:12,fontWeight:700,color:C.textMid,marginBottom:7}}>Admins</div>
        {admins.map((a,i)=><div key={a.id} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:"8px 10px",marginBottom:6}}>
          <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:4}}>
            <input value={a.name} onChange={e=>{const u=admins.map((ad,j)=>j===i?{...ad,name:e.target.value}:ad);onUpdate({...data,admins:u});}} style={{flex:1,padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,fontWeight:600}} placeholder="Admin name"/>
            {a.isSuperAdmin&&<span style={{fontSize:10,color:C.gold,whiteSpace:"nowrap"}}>Super Admin</span>}
            <input placeholder="PIN" maxLength={6} value={a.pin} onChange={e=>{const u=admins.map((ad,j)=>j===i?{...ad,pin:e.target.value.replace(/\D/,"")}:ad);onUpdate({...data,admins:u});}} style={{width:65,padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,textAlign:"center",letterSpacing:"2px",color:C.text}}/>
            {!a.isSuperAdmin&&<button onClick={()=>onUpdate({...data,admins:admins.filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer"}}>x</button>}
          </div>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",marginTop:4}}>
            <input type="checkbox" checked={!!a.alsoRecruits} onChange={e=>{const u=admins.map((ad,j)=>j===i?{...ad,alsoRecruits:e.target.checked}:ad);onUpdate({...data,admins:u});}}/>
            <span style={{fontSize:11,color:C.textMid}}>Also actively recruits and trains</span>
            {a.alsoRecruits&&<span style={{fontSize:10,background:C.purple+"22",color:C.purple,padding:"1px 6px",borderRadius:4,fontWeight:600}}>Active</span>}
          </label>
          {a.alsoRecruits&&<div style={{marginTop:4,display:"flex",flexDirection:"column",gap:4}}>
            <input placeholder="Phone (for rep call/text button)" value={a.phone||""} onChange={e=>{const u=admins.map((ad,j)=>j===i?{...ad,phone:e.target.value}:ad);onUpdate({...data,admins:u});}} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:10,color:C.text,boxSizing:"border-box"}}/>
            <input placeholder="MoneyMap link name (e.g. jackie)" value={a.linkName||""} onChange={e=>{const u=admins.map((ad,j)=>j===i?{...ad,linkName:e.target.value.toLowerCase().replace(/[^a-z0-9]/g,"")}:ad);onUpdate({...data,admins:u});}} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:10,color:C.text,boxSizing:"border-box"}}/>
            <input placeholder="Calendar/booking link (optional)" value={a.bookingLink||""} onChange={e=>{const u=admins.map((ad,j)=>j===i?{...ad,bookingLink:e.target.value}:ad);onUpdate({...data,admins:u});}} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:10,color:C.text,boxSizing:"border-box"}}/>
          </div>}
        </div>)}
        <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:5,marginTop:6}}><input placeholder="Admin name" value={na.name} onChange={e=>setNa({...na,name:e.target.value})} style={{padding:"5px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}/><input placeholder="PIN" maxLength={6} value={na.pin} onChange={e=>setNa({...na,pin:e.target.value.replace(/\D/,"")})} style={{width:60,padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,textAlign:"center",letterSpacing:"2px",color:C.text}}/><button onClick={()=>{if(na.name&&na.pin){onUpdate({...data,admins:[...admins,{...na,id:"admin_"+Date.now()}]});setNa({name:"",pin:""});}}} style={{padding:"5px 10px",borderRadius:6,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:11}}>Add</button></div>
      </div>
      <div><div style={{fontSize:12,fontWeight:700,color:C.textMid,marginBottom:7}}>Field Trainers</div>
        {trainers.map((t,i)=><div key={t.id} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:9,marginBottom:7}}><div style={{display:"flex",gap:7,alignItems:"center",marginBottom:5}}><span style={{fontSize:12,flex:1,fontWeight:600,color:C.text}}>{t.name}</span><input placeholder="PIN" maxLength={6} value={t.pin} onChange={e=>{const u=trainers.map((tr,j)=>j===i?{...tr,pin:e.target.value.replace(/\D/,"")}:tr);onUpdate({...data,trainers:u});}} style={{width:65,padding:"3px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,textAlign:"center",letterSpacing:"2px",color:C.text}}/><button onClick={()=>onUpdate({...data,trainers:trainers.filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer"}}>x</button></div><input placeholder="Phone (for rep call/text button)" value={t.phone||""} onChange={e=>{const u=trainers.map((tr,j)=>j===i?{...tr,phone:e.target.value}:tr);onUpdate({...data,trainers:u});}} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:10,color:C.text,boxSizing:"border-box",marginBottom:5}}/><input placeholder="Booking link" value={t.bookingLink||""} onChange={e=>{const u=trainers.map((tr,j)=>j===i?{...tr,bookingLink:e.target.value}:tr);onUpdate({...data,trainers:u});}} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:10,color:C.text,boxSizing:"border-box"}}/></div>)}
        <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:5,marginTop:6}}><input placeholder="Trainer name" value={nt.name} onChange={e=>setNt({...nt,name:e.target.value})} style={{padding:"5px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}/><input placeholder="PIN" maxLength={6} value={nt.pin} onChange={e=>setNt({...nt,pin:e.target.value.replace(/\D/,"")})} style={{width:60,padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,textAlign:"center",letterSpacing:"2px",color:C.text}}/><button onClick={()=>{if(nt.name&&nt.pin){onUpdate({...data,trainers:[...trainers,{...nt,id:"trainer_"+Date.now()}]});setNt({name:"",pin:"",bookingLink:""});}}} style={{padding:"5px 10px",borderRadius:6,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:11}}>Add</button></div>
      </div>

      {/* RVP IDs */}
      <div style={{marginTop:14}}>
        <div style={{fontSize:12,fontWeight:700,color:C.textMid,marginBottom:7}}>RVP IDs (Online Pre-Licensing)</div>
        <div style={{marginBottom:8}}>
          {[{id:"BXKX9",name:"Tellis Bolton"},{id:"519KU",name:"Jacqueline Jones"},...(data.customRVPs||[])].map((rvp,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:7,background:C.surface,marginBottom:5}}>
              <div style={{flex:1}}><span style={{fontSize:12,fontWeight:700,color:C.gold}}>{rvp.id}</span><span style={{fontSize:11,color:C.textMid,marginLeft:8}}>{rvp.name}</span></div>
              {i>=2&&<button onClick={()=>onUpdate({...data,customRVPs:(data.customRVPs||[]).filter((_,j)=>j!==i-2)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:13}}>x</button>}
              {i<2&&<Badge color={C.teal} small>Default</Badge>}
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:5}}>
          <input placeholder="RVP ID" value={(data._newRVP||{}).id||""} onChange={e=>onUpdate({...data,_newRVP:{...(data._newRVP||{}),id:e.target.value.toUpperCase()}})}
            style={{width:80,padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text,letterSpacing:"1px",fontWeight:700}}/>
          <input placeholder="RVP Name" value={(data._newRVP||{}).name||""} onChange={e=>onUpdate({...data,_newRVP:{...(data._newRVP||{}),name:e.target.value}})}
            style={{padding:"5px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}/>
          <button onClick={()=>{
            const nr=data._newRVP||{};
            if(nr.id&&nr.name){onUpdate({...data,customRVPs:[...(data.customRVPs||[]),{id:nr.id,name:nr.name}],_newRVP:{}});}
          }} style={{padding:"5px 10px",borderRadius:6,background:C.gold,color:"white",border:"none",cursor:"pointer",fontSize:11,fontWeight:600}}>Add</button>
        </div>
      </div>

      {/* RVP Booking Links — for "Meet with your RVP" button */}
      <div style={{marginTop:14}}>
        <div style={{fontSize:12,fontWeight:700,color:C.textMid,marginBottom:7}}>RVP Booking Links</div>
        <div style={{fontSize:10,color:C.textLight,marginBottom:8}}>These show as "Meet with your RVP" buttons for all reps. Add multiple RVPs if needed.</div>
        <div style={{marginBottom:8}}>
          {(data.rvpBookingLinks||[]).map((rvp,i)=>(
            <div key={i} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:8,marginBottom:6}}>
              <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:5}}>
                <input value={rvp.name} onChange={e=>{const u=(data.rvpBookingLinks||[]).map((r,j)=>j===i?{...r,name:e.target.value}:r);onUpdate({...data,rvpBookingLinks:u});}} placeholder="RVP Name" style={{flex:1,padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text,fontWeight:600}}/>
                <button onClick={()=>onUpdate({...data,rvpBookingLinks:(data.rvpBookingLinks||[]).filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:14}}>x</button>
              </div>
              <input value={rvp.link} onChange={e=>{const u=(data.rvpBookingLinks||[]).map((r,j)=>j===i?{...r,link:e.target.value}:r);onUpdate({...data,rvpBookingLinks:u});}} placeholder="Booking link (Calendly, etc.)" style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:10,color:C.text,boxSizing:"border-box"}}/>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:5}}>
          <input placeholder="New RVP name" value={(data._newRVPBooking||{}).name||""} onChange={e=>onUpdate({...data,_newRVPBooking:{...(data._newRVPBooking||{}),name:e.target.value}})} style={{padding:"5px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}/>
          <button onClick={()=>{
            const nrb=data._newRVPBooking||{};
            if(nrb.name){onUpdate({...data,rvpBookingLinks:[...(data.rvpBookingLinks||[]),{name:nrb.name,link:""}],_newRVPBooking:{}});}
          }} style={{padding:"5px 10px",borderRadius:6,background:C.purple,color:"white",border:"none",cursor:"pointer",fontSize:11,fontWeight:600}}>+ Add RVP</button>
        </div>
      </div>
    </div>
  </div>;
}

// ── MY REPS PAGE (separate from dashboard) ──
function MyRepsPage({data,onUpdate,userRole,userId,onSelectRep}) {
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("all");
  const [showAdd,setShowAdd]=useState(false);
  const [showManage,setShowManage]=useState(false);
  const [showInactive,setShowInactive]=useState(false);
  const isAdmin=userRole==="admin"||userRole==="superadmin";
  const allReps=data.reps||[];
  const activeR=allReps.filter(r=>!r.inactive&&(userRole==="trainer"?r.trainerId===userId:true));
  const inactiveR=allReps.filter(r=>r.inactive&&(userRole==="trainer"?r.trainerId===userId:true));
  const displayR=showInactive?inactiveR:activeR;
  const filtered=displayR.filter(r=>(r.name.toLowerCase().includes(search.toLowerCase())||r.phone?.includes(search))&&(filter==="all"||r.track===filter));
  const addRep=f=>onUpdate({...data,reps:[...allReps,{...f,id:"rep_"+Date.now(),checked:{},trainerChecked:{},appointments:[],references:[],checkIns:[],repPin:null,createdAt:Date.now()}]});
  const trainers=data.trainers||[];

  const restoreRep=(id)=>onUpdate({...data,reps:allReps.map(r=>r.id===id?{...r,inactive:false}:r)});
  const deleteRep=(id,name)=>{
    if(!window.confirm("PERMANENTLY DELETE "+name+"? This cannot be undone.")) return;
    if(!window.confirm("Are you absolutely sure?")) return;
    onUpdate({...data,reps:allReps.filter(r=>r.id!==id)});
  };

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text}}>My Reps {showInactive&&<span style={{fontSize:12,color:C.danger,fontWeight:400}}>(Inactive)</span>}</div>
      <div style={{display:"flex",gap:6}}>
        {inactiveR.length>0&&<button onClick={()=>setShowInactive(!showInactive)} style={{fontSize:10,padding:"4px 9px",borderRadius:6,border:"1px solid "+(showInactive?C.danger:C.border),background:showInactive?C.danger+"11":"white",cursor:"pointer",color:showInactive?C.danger:C.textMid,fontWeight:600}}>{showInactive?"View Active":"Inactive ("+inactiveR.length+")"}</button>}
        {isAdmin&&!showInactive&&<button onClick={()=>setShowManage(true)} style={{fontSize:11,padding:"5px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>Manage Team</button>}
        {isAdmin&&!showInactive&&<button onClick={()=>setShowAdd(true)} style={{fontSize:11,padding:"5px 12px",borderRadius:8,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>+ Add Rep</button>}
      </div>
    </div>
    <div style={{display:"flex",gap:7,marginBottom:10,flexWrap:"wrap"}}>
      <input placeholder="Search reps..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,minWidth:140,padding:"7px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text}}/>
      {["all","fast","regular","licensed"].map(f=><button key={f} onClick={()=>setFilter(f)} style={{padding:"5px 9px",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,fontWeight:filter===f?600:400,background:filter===f?C.navy:C.surface,color:filter===f?"white":C.textMid,whiteSpace:"nowrap"}}>{f==="all"?"All":f==="fast"?"Fast Start":f==="regular"?"Regular Start":f==="licensed"?"Licensed Now What":f}</button>)}
    </div>
    {filtered.length===0&&<div style={{textAlign:"center",padding:"24px",color:C.textLight,fontSize:12}}>No reps found</div>}
    {filtered.map(r=>{
      const track=TRACK_INFO[r.track];
      const cl=track?.checklist||[];
      const done=cl.filter(i=>(r.checked||{})[i.id]).length;
      const pct=cl.length>0?Math.round((done/cl.length)*100):0;
      return <div key={r.id} style={{borderRadius:10,background:"white",border:`1px solid ${showInactive?C.danger+"33":C.border}`,marginBottom:7,overflow:"hidden"}}>
        <div onClick={()=>!showInactive&&onSelectRep(r.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:showInactive?"default":"pointer"}}>
          <div style={{width:32,height:32,borderRadius:8,background:(track?.color||C.teal)+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:track?.color||C.teal,flexShrink:0}}>{r.name?.charAt(0)?.toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:dv(13,16),fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
            <div style={{fontSize:10,color:C.textMid}}>{track?.label||r.track}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:1}}>
              <span style={{fontSize:10,color:C.textMid}}>Trainer: <strong style={{color:([...(data.trainers||[]),...(data.admins||[])]).find(t=>t.id===r.trainerId)?C.teal:C.textLight}}>{([...(data.trainers||[]),...(data.admins||[])]).find(t=>t.id===r.trainerId)?.name||"Not assigned"}</strong></span>
              <span style={{fontSize:10,color:C.textMid}}>Rec: <strong style={{color:findPerson(r.recruitedBy,data)?C.purple:C.textLight}}>{findPerson(r.recruitedBy,data)?.name||"Not specified"}</strong></span>
            </div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:12,fontWeight:700,color:track?.color||C.teal}}>{pct}%</div>
            <div style={{fontSize:10,color:C.textLight}}>{done}/{cl.length}</div>
          </div>
          {!showInactive&&<div style={{fontSize:11,color:C.textLight}}>›</div>}
        </div>
        {showInactive&&isAdmin&&<div style={{display:"flex",gap:6,padding:"8px 12px",borderTop:`1px solid ${C.danger}22`,background:C.danger+"05"}}>
          <button onClick={()=>restoreRep(r.id)} style={{flex:1,padding:"6px",borderRadius:7,border:"none",background:C.success,color:"white",cursor:"pointer",fontSize:11,fontWeight:600}}>Restore</button>
          <button onClick={()=>deleteRep(r.id,r.name)} style={{flex:1,padding:"6px",borderRadius:7,border:"none",background:C.danger,color:"white",cursor:"pointer",fontSize:11,fontWeight:600}}>Delete Forever</button>
        </div>}
      </div>;
    })}
    {showAdd&&<AddRepModal data={data} onAdd={f=>{addRep(f);setShowAdd(false);}} onClose={()=>setShowAdd(false)} trainers={trainers}/>}
    {showManage&&<ManageTeam data={data} onUpdate={onUpdate} onClose={()=>setShowManage(false)}/>}
  </div>;
}

// ── DASHBOARD ──
function Dashboard({data,onUpdate,userRole,userId,onSelectRep}) {
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("all");
  const [showAdd,setShowAdd]=useState(false);
  const [showManage,setShowManage]=useState(false);
  const reps=(data.reps||[]).filter(r=>userRole==="trainer"?r.trainerId===userId:true);
  const filtered=reps.filter(r=>(r.name.toLowerCase().includes(search.toLowerCase())||r.phone?.includes(search))&&(filter==="all"||r.track===filter));
  const addRep=f=>onUpdate({...data,reps:[...(data.reps||[]),{...f,id:"rep_"+Date.now(),checked:{},trainerChecked:{},appointments:[],references:[],checkIns:[],repPin:null,createdAt:Date.now()}]});
  const trainers=data.trainers||[];
  const stats=[{l:"Total Reps",v:reps.length,c:C.teal},{l:"Fast Start",v:reps.filter(r=>r.track==="fast").length,c:C.teal},{l:"Licensed",v:reps.filter(r=>r.track==="licensed").length,c:C.gold},{l:"Graduated",v:reps.filter(r=>{const cl=TRACK_INFO[r.track]?.checklist||[];return cl.length>0&&cl.every(i=>(r.checked||{})[i.id])}).length,c:C.success}];
  return <div>
    {/* Next Level Access Requests */}
    {(()=>{
      const pending=(data.reps||[]).filter(r=>r.nextLevelRequested&&!r.nextLevelGranted&&(r.track==="fast"||r.track==="regular"));
      if(pending.length===0||(userRole!=="admin"&&userRole!=="superadmin"&&userRole!=="trainer")) return null;
      return <div style={{background:C.gold+"15",border:`2px solid ${C.gold}55`,borderRadius:12,padding:"12px 16px",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <div style={{width:8,height:8,borderRadius:4,background:C.gold,animation:"pulse 1.5s infinite"}}/>
          <div style={{fontSize:13,fontWeight:700,color:C.gold}}>Next Level Access Requests ({pending.length})</div>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
        {pending.map(rep=>{
          const track=TRACK_INFO[rep.track];
          return <div key={rep.id} style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:C.text}}>{rep.name}</div>
              <div style={{fontSize:11,color:C.textMid}}>Completed {track?.label} — requesting Licensed Now What access</div>
              {rep.nextLevelRequestedAt&&<div style={{fontSize:10,color:C.textLight}}>Requested: {new Date(rep.nextLevelRequestedAt).toLocaleDateString()}</div>}
            </div>
            <button onClick={()=>{
              const updated={...rep,track:"licensed",nextLevelGranted:true,nextLevelGrantedAt:new Date().toISOString(),checked:{},celebrationShown:false};
              onUpdate({...data,reps:(data.reps||[]).map(r=>r.id===rep.id?updated:r)});
            }} style={{padding:"7px 14px",borderRadius:8,background:C.success,color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>
              Grant Access
            </button>
            <button onClick={()=>{
              const updated={...rep,nextLevelRequested:false,nextLevelRequestedAt:null};
              onUpdate({...data,reps:(data.reps||[]).map(r=>r.id===rep.id?updated:r)});
            }} style={{padding:"7px 10px",borderRadius:8,background:C.danger+"11",color:C.danger,border:`1px solid ${C.danger}33`,cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>
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

    <BirthdayAnniversaryWidget data={data}/>
    {(userRole==="admin"||userRole==="superadmin")&&<TopRecruiters data={data}/>}
    {(userRole==="admin"||userRole==="superadmin")&&<Leaderboard data={data} userId={userId}/>}
    {(userRole==="admin"||userRole==="superadmin")&&<ProdDash data={data} onUpdateData={onUpdate}/>}

    {userRole==="trainer"&&<WallOfFameBanner data={data}/>}
    {userRole==="trainer"&&<DailyActivityLog rep={{id:userId,name:""}} data={data} onUpdate={onUpdate} isFirstTime={!(data.activityLogs||{})[userId]?.seenIntro}/>}

    {userRole==="trainer"&&<MyProd myProd={(data.myProduction||{})[userId]||{}} onUpdate={p=>{
      const newData={...data,myProduction:{...(data.myProduction||{}),[userId]:p}};
      if(p.investments){
        newData.trainers=(data.trainers||[]).map(t=>t.id===userId?{...t,investments:p.investments}:t);
      }
      onUpdate(newData);
    }}/>}
    <div style={{display:"flex",gap:7,marginBottom:10,flexWrap:"wrap"}}>
      <input placeholder="Search reps..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,minWidth:140,padding:"7px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text}}/>
      <select value={filter} onChange={e=>setFilter(e.target.value)} style={{padding:"7px 9px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}><option value="all">All Tracks</option>{Object.entries(TRACK_INFO).map(([k,t])=><option key={k} value={k}>{t.label}</option>)}</select>
    </div>
    <div style={{display:"flex",gap:7,marginBottom:14}}>
      <button onClick={()=>setShowAdd(true)} style={{flex:1,padding:"8px",borderRadius:8,background:C.teal,color:"white",border:"none",cursor:"pointer",fontWeight:600,fontSize:12}}>+ Add New Rep</button>
      {(userRole==="admin"||userRole==="superadmin")&&<button onClick={()=>setShowManage(true)} style={{padding:"8px 12px",borderRadius:8,background:C.navyMid,color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:600}}>Manage Team</button>}
    </div>
    {filtered.length===0&&<div style={{textAlign:"center",padding:"28px 0",color:C.textLight}}>{reps.length===0?"No reps yet - add your first rep":"No results found"}</div>}
    {filtered.map(rep=>{
      const track=TRACK_INFO[rep.track];
      const cl=track?.checklist||[];
      const done=cl.filter(i=>(rep.checked||{})[i.id]).length;
      const pct=cl.length>0?Math.round((done/cl.length)*100):0;
      const trDone=TRAINER_CHECKLIST.filter(i=>(rep.trainerChecked||{})[i.id]).length;
      const trPct=Math.round((trDone/TRAINER_CHECKLIST.length)*100);
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
              <span style={{fontSize:13,fontWeight:700,color:C.text}}>{rep.name}</span>
              {grad&&<Badge color={C.success} small>Graduated</Badge>}
              {stalled&&!grad&&<Badge color={C.danger} small>Stalled</Badge>}
              {rep.nextLevelRequested&&!rep.nextLevelGranted&&<Badge color={C.gold} small>Upgrade Pending</Badge>}
            </div>
            <div style={{fontSize:dv(11,13),color:C.textMid,marginTop:1,display:"flex",alignItems:"center",gap:8}}><PhoneLink phone={rep.phone}/>{rep.email&&<a href={"mailto:"+rep.email} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:22,height:22,borderRadius:5,background:C.teal+"22",border:"1px solid "+C.teal+"44",textDecoration:"none"}} title="Email"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg></a>}</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:2}}>
              <span style={{fontSize:dv(10,12),color:C.textMid}}>Trainer: <strong style={{color:trainer?C.teal:C.textLight}}>{trainer?.name||"Not assigned"}</strong></span>
              <span style={{fontSize:10,color:C.textMid}}>Recruited by: <strong style={{color:(()=>{const r=findPerson(rep.recruitedBy,data);return r?C.purple:C.textLight;})()}}>{findPerson(rep.recruitedBy,data)?.name||"Not specified"}</strong></span>
            </div>
          </div>
          <Badge color={track?.color||C.teal} small>{track?.label}</Badge>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:5}}>
          <div><div style={{fontSize:9,color:C.textMid,marginBottom:2}}>Trainer {trPct}%</div><Bar pct={trPct} h={3}/></div>
          <div><div style={{fontSize:9,color:C.textMid,marginBottom:2}}>Rep {pct}%</div><Bar pct={pct} color={track?.color||C.purple} h={3}/></div>
        </div>
        <div style={{fontSize:10,color:C.textLight}}>{ds===null?"No check-ins yet":ds===0?"Checked in today":`${ds}d since check-in`}{rep.dgoDate&&<span> - DGO: {rep.dgoDate}</span>}</div>
      </div>;
    })}
    {showAdd&&<AddRep onAdd={addRep} onClose={()=>setShowAdd(false)} trainers={trainers} allPeople={[(data.admins||[]).map(a=>({...a,role:"Admin"})),trainers.map(t=>({...t,role:"Trainer"})),(data.reps||[]).map(r=>({...r,role:"Rep"}))].flat()}/>}
    {showManage&&<ManageTeam data={data} onUpdate={onUpdate} onClose={()=>setShowManage(false)}/>}
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
  const inp={width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid rgba(0,0,0,0.12)`,fontSize:13,outline:"none",background:"white",boxSizing:"border-box",color:C.text};
  return <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${C.navy} 0%,${C.navyMid} 60%,${C.navyLight} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{width:"100%",maxWidth:420}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        {/* Shield logo */}
        <div style={{position:"relative",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
          <svg width="90" height="100" viewBox="0 0 90 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M45 4L8 18V52C8 72 45 96 45 96C45 96 82 72 82 52V18L45 4Z" fill="rgba(14,165,160,0.15)" stroke={C.teal} strokeWidth="2.5"/>
            <path d="M45 4L8 18V52C8 72 45 96 45 96C45 96 82 72 82 52V18L45 4Z" fill="url(#shieldGrad)"/>
            <defs><linearGradient id="shieldGrad" x1="45" y1="4" x2="45" y2="96" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor={C.teal} stopOpacity="0.25"/><stop offset="100%" stopColor={C.teal} stopOpacity="0.05"/></linearGradient></defs>
            <path d="M30 50L40 60L62 38" stroke={C.teal} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            <text x="45" y="85" textAnchor="middle" fill={C.teal} fontSize="9" fontWeight="700" fontFamily="Arial" letterSpacing="1">NL</text>
          </svg>
          {/* Glow effect */}
          <div style={{position:"absolute",width:90,height:90,borderRadius:"50%",background:C.teal,opacity:0.08,filter:"blur(20px)",zIndex:-1}}/>
        </div>
        {/* Welcome banner */}
        <div style={{background:"linear-gradient(90deg,rgba(245,158,11,0.15),rgba(14,165,160,0.15),rgba(245,158,11,0.15))",border:"1px solid rgba(245,158,11,0.3)",borderRadius:30,padding:"6px 20px",display:"inline-block",marginBottom:12}}>
          <span style={{fontSize:12,fontWeight:700,color:"#f59e0b",letterSpacing:"2px",textTransform:"uppercase"}}>✦ Welcome to the Team ✦</span>
        </div>
        <div style={{color:"white",fontSize:22,fontWeight:800,letterSpacing:"0.5px",lineHeight:1.2}}>NextLevel</div>
        <div style={{color:C.teal,fontSize:14,fontWeight:600,letterSpacing:"3px",textTransform:"uppercase",marginBottom:14}}>Field Training Hub</div>
        {/* Team badges */}
        <div style={{display:"flex",gap:8,justifyContent:"center"}}>
          <div style={{padding:"5px 16px",borderRadius:20,background:"rgba(245,158,11,0.15)",border:"1px solid rgba(245,158,11,0.5)",fontSize:11,fontWeight:700,color:"#f59e0b",letterSpacing:"0.5px"}}>⚡ Team PrimeTime</div>
          <div style={{padding:"5px 16px",borderRadius:20,background:"rgba(14,165,160,0.15)",border:"1px solid rgba(14,165,160,0.5)",fontSize:11,fontWeight:700,color:C.teal,letterSpacing:"0.5px"}}>🏆 Triumphant Families</div>
        </div>
      </div>
      <div style={{background:"white",borderRadius:16,padding:24,boxShadow:"0 20px 50px rgba(0,0,0,0.3)"}}>
        {mode==="select"&&<div>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:4}}>Welcome back</div>
          <div style={{fontSize:12,color:C.textMid,marginBottom:16}}>How are you accessing the app?</div>
          {[{k:"admin",l:"Admin / Super Admin",s:"Full system access"},{k:"trainer",l:"Field Trainer",s:"Manage your reps"},{k:"rep",l:"New Rep / Licensed Agent",s:"View your checklist and tools"}].map(o=><button key={o.k} onClick={()=>{setMode(o.k);setPin("");setErr("");}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:10,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",marginBottom:7,textAlign:"left"}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.teal} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:C.text}}>{o.l}</div><div style={{fontSize:11,color:C.textMid}}>{o.s}</div></div><span style={{color:C.textLight,fontSize:16}}>›</span></button>)}
        </div>}
        {(mode==="admin"||mode==="trainer")&&<div>
          <button onClick={()=>{setMode("select");setErr("");setPin("");}} style={{background:"none",border:"none",color:C.teal,cursor:"pointer",fontSize:12,marginBottom:14,padding:0}}>&larr; Back</button>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:14}}>{mode==="admin"?"Admin Login":"Trainer Login"}</div>
          <input type="password" maxLength={6} placeholder="Enter PIN" value={pin} onChange={e=>{setPin(e.target.value.replace(/\D/,""));setErr("");}} onKeyDown={e=>e.key==="Enter"&&(mode==="admin"?doAdminLogin():doTrainerLogin())} style={{...inp,marginBottom:6,letterSpacing:"6px",textAlign:"center"}}/>
          <button onClick={()=>alert("Contact the Super Admin to reset your PIN. They can set a temporary PIN from the Team Management section.")} style={{background:"none",border:"none",color:C.teal,fontSize:11,cursor:"pointer",marginBottom:10,padding:0,textDecoration:"underline"}}>Forgot PIN?</button>
          {err&&<div style={{color:C.danger,fontSize:11,marginBottom:8}}>{err}</div>}
          <button onClick={mode==="admin"?doAdminLogin:doTrainerLogin} style={{width:"100%",padding:"10px",borderRadius:8,background:C.teal,color:"white",border:"none",fontWeight:600,fontSize:13,cursor:"pointer"}}>Sign In</button>
        </div>}
        {mode==="rep"&&step==="find"&&<div>
          <button onClick={()=>{setMode("select");setErr("");setSearch("");}} style={{background:"none",border:"none",color:C.teal,cursor:"pointer",fontSize:12,marginBottom:14,padding:0}}>&larr; Back</button>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:14}}>Find your name</div>
          <input placeholder="Search your name..." value={search} onChange={e=>{setSearch(e.target.value);setErr("");}} style={{...inp,marginBottom:10}} autoFocus/>
          {!search&&<div style={{color:C.textLight,fontSize:12,textAlign:"center",padding:"8px 0"}}>Start typing to find yourself</div>}
          {search&&filtReps.length===0&&<div style={{color:C.textMid,fontSize:12,textAlign:"center",padding:"10px 0"}}>No results - ask your trainer to add you</div>}
          {filtReps.map(r=><button key={r.id} onClick={()=>{setSelRep(r);setRPin("");setRPinC("");setErr("");setStep(r.repPin?"enter":"create");}} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",textAlign:"left",marginBottom:5,fontSize:13,color:C.text}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.teal} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>{r.name}<span style={{float:"right",fontSize:10,color:C.textLight}}>{TRACK_INFO[r.track]?.label}</span></button>)}
        </div>}
        {mode==="rep"&&(step==="create"||step==="enter")&&selRep&&<div>
          <button onClick={()=>{setStep("find");setErr("");}} style={{background:"none",border:"none",color:C.teal,cursor:"pointer",fontSize:12,marginBottom:14,padding:0}}>&larr; Back</button>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:4}}>{step==="create"?"Create Your PIN":`Welcome, ${selRep.name}`}</div>
          <div style={{fontSize:11,color:C.textMid,marginBottom:14}}>{step==="create"?"Choose a 4-digit PIN":"Enter your 4-digit PIN"}</div>
          <input type="password" maxLength={4} placeholder="4-digit PIN" value={rPin} onChange={e=>{setRPin(e.target.value.replace(/\D/,""));setErr("");}} style={{...inp,marginBottom:step==="create"?9:6,textAlign:"center",fontSize:22,letterSpacing:"10px"}} autoFocus/>
          {step==="enter"&&<button onClick={()=>alert("Contact your trainer or admin to reset your PIN. They can set a temporary PIN from your profile.")} style={{background:"none",border:"none",color:C.teal,fontSize:11,cursor:"pointer",marginBottom:9,padding:0,textDecoration:"underline"}}>Forgot PIN?</button>}
          {step==="create"&&<input type="password" maxLength={4} placeholder="Confirm PIN" value={rPinC} onChange={e=>{setRPinC(e.target.value.replace(/\D/,""));setErr("");}} onKeyDown={e=>e.key==="Enter"&&doRepLogin()} style={{...inp,marginBottom:9,textAlign:"center",fontSize:22,letterSpacing:"10px"}}/>}
          {err&&<div style={{color:C.danger,fontSize:11,marginBottom:8}}>{err}</div>}
          <button onClick={doRepLogin} style={{width:"100%",padding:"10px",borderRadius:8,background:C.teal,color:"white",border:"none",fontWeight:600,fontSize:13,cursor:"pointer"}}>{step==="create"?"Create PIN and Continue":"Sign In"}</button>
        </div>}
      </div>
      <div style={{textAlign:"center",color:"rgba(255,255,255,0.25)",fontSize:10,marginTop:14}}>NextLevel Field Training Hub 2025</div>
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
      <div style={{fontSize:13,color:C.success,fontWeight:600,marginBottom:16}}>{pct}% Complete</div>
      <div style={{fontSize:12,color:C.textLight,marginBottom:20,lineHeight:1.5}}>{m.msg}</div>
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
        <div style={{fontSize:13,fontWeight:700,color:colors[ann.type||"info"],marginBottom:2}}>{ann.title}</div>
        <div style={{fontSize:12,color:C.text,lineHeight:1.5}}>{ann.message}</div>
        {ann.expiresAt&&<div style={{fontSize:10,color:C.textLight,marginTop:3}}>Expires: {new Date(ann.expiresAt).toLocaleDateString()}</div>}
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
      <div style={{fontSize:13,fontWeight:700,color:C.text}}>Team Announcements</div>
      <button onClick={()=>{setShowForm(!showForm);setEditing(null);setForm({title:"",message:"",type:"info",expiresAt:"",active:true});}} style={{fontSize:11,padding:"5px 10px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>+ New Announcement</button>
    </div>
    {showForm&&<div style={{background:C.surface,borderRadius:10,padding:12,marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:700,color:C.textMid,marginBottom:8}}>{editing!==null?"Edit":"New"} Announcement</div>
      <input placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
      <textarea placeholder="Message..." value={form.message} onChange={e=>setForm({...form,message:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,resize:"vertical",minHeight:70,boxSizing:"border-box",marginBottom:7,lineHeight:1.5}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
        <div>
          <div style={{fontSize:10,color:C.textMid,marginBottom:3}}>Type</div>
          <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}>
            <option value="info">Info (Teal)</option>
            <option value="warning">Warning (Gold)</option>
            <option value="success">Success (Green)</option>
            <option value="urgent">Urgent (Red)</option>
          </select>
        </div>
        <div>
          <div style={{fontSize:10,color:C.textMid,marginBottom:3}}>Expires (optional)</div>
          <input type="date" value={form.expiresAt} onChange={e=>setForm({...form,expiresAt:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,boxSizing:"border-box"}}/>
        </div>
      </div>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>{setShowForm(false);setEditing(null);}} style={{flex:1,padding:"7px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:11,color:C.textMid}}>Cancel</button>
        <button onClick={save} style={{flex:2,padding:"7px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:11,fontWeight:600}}>Save Announcement</button>
      </div>
    </div>}
    {announcements.length===0&&<div style={{color:C.textLight,fontSize:12,textAlign:"center",padding:"12px 0"}}>No announcements yet</div>}
    {announcements.map((ann,i)=><div key={i} style={{borderRadius:8,border:`1px solid ${typeColors[ann.type||"info"]}33`,padding:"10px 12px",marginBottom:7,background:ann.active?"white":C.surface,opacity:ann.active?1:0.6}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
            <span style={{fontSize:12,fontWeight:700,color:typeColors[ann.type||"info"]}}>{ann.title}</span>
            <Badge color={ann.active?C.success:C.textLight} small>{ann.active?"Live":"Off"}</Badge>
          </div>
          <div style={{fontSize:11,color:C.textMid,lineHeight:1.4}}>{ann.message}</div>
          {ann.expiresAt&&<div style={{fontSize:10,color:C.textLight,marginTop:2}}>Expires: {new Date(ann.expiresAt).toLocaleDateString()}</div>}
        </div>
        <div style={{display:"flex",gap:5,marginLeft:8,flexShrink:0}}>
          <button onClick={()=>toggle(i)} style={{fontSize:10,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>{ann.active?"Pause":"Activate"}</button>
          <button onClick={()=>{setEditing(i);setForm({...ann});setShowForm(true);}} style={{fontSize:10,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>Edit</button>
          <button onClick={()=>del(i)} style={{fontSize:10,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.danger}33`,background:C.danger+"11",cursor:"pointer",color:C.danger}}>Del</button>
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
      {isAdmin&&<button onClick={()=>{setShowForm(!showForm);setEditing(null);setForm({title:"",url:"",description:"",category:"Training"});}} style={{fontSize:11,padding:"5px 10px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>+ Add Resource</button>}
    </div>
    {isAdmin&&<div style={{background:C.teal+"11",border:`1px solid ${C.teal}33`,borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:C.teal}}>Add links to documents, training videos, and company materials for your team. <strong>Tip:</strong> Upload files to Google Drive, set sharing to "Anyone with the link", and paste the link here.</div>}
    {showForm&&<Card style={{marginBottom:14,border:`1px solid ${C.teal}44`}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>{editing!==null?"Edit":"New"} Resource</div>
      <input placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
      <input placeholder="URL (https://...)" value={form.url} onChange={e=>setForm({...form,url:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
      <input placeholder="Description (optional)" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
      <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.text,marginBottom:10}}>
        {RESOURCE_CATEGORIES.map(c=><option key={c}>{c}</option>)}
      </select>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>{setShowForm(false);setEditing(null);}} style={{flex:1,padding:"7px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:11,color:C.textMid}}>Cancel</button>
        <button onClick={save} style={{flex:2,padding:"7px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:11,fontWeight:600}}>Save Resource</button>
      </div>
    </Card>}
    {resources.length===0&&<div style={{textAlign:"center",padding:"32px 0",color:C.textLight}}>{isAdmin?"No resources yet — add your first one above":"No resources added yet — ask your admin to add some"}</div>}
    {resources.length>0&&<div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:12,paddingBottom:2}}>
      {cats.map(c=><button key={c} onClick={()=>setFilter(c)} style={{padding:"5px 10px",borderRadius:7,border:"none",cursor:"pointer",whiteSpace:"nowrap",fontSize:11,fontWeight:filter===c?600:400,background:filter===c?C.navy:C.surface,color:filter===c?"white":C.textMid}}>{c}</button>)}
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
            <a href={r.url} target="_blank" rel="noreferrer" style={{fontSize:13,fontWeight:600,color:C.teal,textDecoration:"none",display:"block",marginBottom:2}}>{r.title} &rarr;</a>
            {r.description&&<div style={{fontSize:11,color:C.textMid}}>{r.description}</div>}
          </div>
          {isAdmin&&<div style={{display:"flex",gap:4,flexShrink:0}}>
            <button onClick={()=>{setEditing(realIdx);setForm({...r});setShowForm(true);}} style={{fontSize:10,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>Edit</button>
            <button onClick={()=>del(realIdx)} style={{fontSize:10,padding:"3px 7px",borderRadius:5,border:`1px solid ${C.danger}33`,background:C.danger+"11",cursor:"pointer",color:C.danger}}>Del</button>
          </div>}
        </div>;
      })}
    </div>)}
    {filtered.length>0&&filtered.every(r=>!RESOURCE_CATEGORIES.includes(r.category))&&filtered.map((r,i)=>{
      const realIdx=resources.indexOf(r);
      return <div key={i} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:"10px 12px",marginBottom:6}}>
        <a href={r.url} target="_blank" rel="noreferrer" style={{fontSize:13,fontWeight:600,color:C.teal,textDecoration:"none"}}>{r.title} &rarr;</a>
        {r.description&&<div style={{fontSize:11,color:C.textMid,marginTop:2}}>{r.description}</div>}
      </div>;
    })}
  </div>;
}


// ── SCORECARD ──
function getWeekStart(date=new Date()) {
  const d=new Date(date);
  const day=d.getDay();
  const diff=d.getDate()-day+(day===0?-6:1);
  d.setDate(diff);
  d.setHours(0,0,0,0);
  return d.toISOString().split("T")[0];
}

function ScorecardPage({data,onUpdate,userId,userRole}) {
  const weekKey=getWeekStart();
  const allScores=data.scorecards||{};
  const myScores=allScores[userId]||{};
  const week=myScores[weekKey]||{contacts:0,apptSet:0,apptDone:0};
  const isAdmin=userRole==="admin"||userRole==="superadmin";

  const goals={contacts:100,apptSet:20,apptDone:20};

  const update=(field,val)=>{
    const updated={...data,scorecards:{...allScores,[userId]:{...myScores,[weekKey]:{...week,[field]:Math.max(0,val)}}}};
    onUpdate(updated);
  };

  const totalPct=Math.round(((week.contacts/goals.contacts)+(week.apptSet/goals.apptSet)+(week.apptDone/goals.apptDone))/3*100);
  const getMessage=()=>{
    if(totalPct>=80) return {msg:"Outstanding week! You are on fire!",color:C.success};
    if(totalPct>=50) return {msg:"You are building momentum! Keep going!",color:C.teal};
    if(totalPct>0) return {msg:"Keep pushing! Every contact counts.",color:C.gold};
    return {msg:"Start logging your activity — small actions add up!",color:C.textMid};
  };
  const {msg,color}=getMessage();

  const contactRate=week.contacts>0?Math.round((week.apptSet/week.contacts)*100):0;
  const showRate=week.apptSet>0?Math.round((week.apptDone/week.apptSet)*100):0;

  const metrics=[
    {key:"contacts",label:"Contacts Made",goal:goals.contacts,val:week.contacts,color:C.teal,icon:"📞",desc:"Top of the funnel — every appointment starts with a contact"},
    {key:"apptSet",label:"Appointments Set",goal:goals.apptSet,val:week.apptSet,color:C.purple,icon:"📅",desc:"Target 1 appointment per 5 contacts"},
    {key:"apptDone",label:"Appointments Completed",goal:goals.apptDone,val:week.apptDone,color:C.success,icon:"✅",desc:"Tracks your show rate — follow-through is everything"},
  ];

  // Get week history (last 4 weeks)
  const weekHistory=Array.from({length:4},(_,i)=>{
    const d=new Date();
    d.setDate(d.getDate()-(i*7));
    const wk=getWeekStart(d);
    const wkData=myScores[wk]||{contacts:0,apptSet:0,apptDone:0};
    const pct=Math.round(((wkData.contacts/goals.contacts)+(wkData.apptSet/goals.apptSet)+(wkData.apptDone/goals.apptDone))/3*100);
    return {week:wk,label:i===0?"This Week":i===1?"Last Week":`${i} Weeks Ago`,pct,data:wkData};
  });

  // Team summary for admins
  const allUsers=[...(data.trainers||[]),...(data.admins||[])];
  const teamRows=isAdmin?allUsers.map(u=>{
    const uScores=(data.scorecards||{})[u.id]||{};
    const uWeek=uScores[weekKey]||{contacts:0,apptSet:0,apptDone:0};
    const uPct=Math.round(((uWeek.contacts/goals.contacts)+(uWeek.apptSet/goals.apptSet)+(uWeek.apptDone/goals.apptDone))/3*100);
    return {...u,week:uWeek,pct:uPct};
  }):[];

  return <div>
    <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:4}}>Weekly Scorecard</div>
    <div style={{fontSize:12,color:C.textMid,marginBottom:16}}>Week of {new Date(weekKey+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>

    {/* Why this matters banner */}
    <div style={{background:`linear-gradient(135deg,${C.navyMid},${C.navyLight})`,borderRadius:12,padding:"14px 16px",marginBottom:16,color:"white"}}>
      <div style={{fontSize:11,fontWeight:700,color:C.teal,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:6}}>Why This Matters</div>
      <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",lineHeight:1.6}}>Production tracks your <strong style={{color:"white"}}>results</strong>. The scorecard tracks your <strong style={{color:"white"}}>activity</strong> — the daily work that creates results. You can't control whether someone buys, but you can control how many calls you make. <strong style={{color:C.teal}}>Focus on the activity and the results will follow.</strong></div>
    </div>

    {/* Weekly score */}
    <Card style={{marginBottom:16,background:`linear-gradient(135deg,${C.navy},${C.navyMid})`,border:"none"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div><div style={{fontSize:13,fontWeight:700,color:"white"}}>Weekly Score</div><div style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>Average across all 3 goals</div></div>
        <div style={{textAlign:"center"}}><div style={{fontSize:32,fontWeight:800,color:totalPct>=80?C.success:totalPct>=50?C.teal:C.gold}}>{totalPct}%</div></div>
      </div>
      <Bar pct={totalPct} color={totalPct>=80?C.success:totalPct>=50?C.teal:C.gold} h={8}/>
      <div style={{marginTop:8,fontSize:12,color:color,fontWeight:600}}>{msg}</div>
    </Card>

    {/* Conversion rates */}
    {(week.contacts>0||week.apptSet>0)&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
      <Card style={{padding:"10px 12px",textAlign:"center"}}>
        <div style={{fontSize:20,fontWeight:700,color:C.purple}}>{contactRate}%</div>
        <div style={{fontSize:11,color:C.textMid}}>Contact-to-Appt Rate</div>
        <div style={{fontSize:10,color:C.textLight}}>Industry target: 20%</div>
      </Card>
      <Card style={{padding:"10px 12px",textAlign:"center"}}>
        <div style={{fontSize:20,fontWeight:700,color:C.success}}>{showRate}%</div>
        <div style={{fontSize:11,color:C.textMid}}>Appointment Show Rate</div>
        <div style={{fontSize:10,color:C.textLight}}>Target: 80%+</div>
      </Card>
    </div>}

    {/* Metric cards */}
    {metrics.map(m=><Card key={m.key} style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
            <span style={{fontSize:16}}>{m.icon}</span>
            <span style={{fontSize:13,fontWeight:700,color:C.text}}>{m.label}</span>
          </div>
          <div style={{fontSize:11,color:C.textLight}}>{m.desc}</div>
        </div>
        <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
          <div style={{fontSize:22,fontWeight:800,color:m.color}}>{m.val}</div>
          <div style={{fontSize:10,color:C.textLight}}>Goal: {m.goal}</div>
        </div>
      </div>
      <Bar pct={(m.val/m.goal)*100} color={m.val>=m.goal?C.success:m.color} h={6}/>
      <div style={{display:"flex",gap:6,marginTop:8,alignItems:"center"}}>
        <button onClick={()=>update(m.key,m.val-1)} style={{width:36,height:36,borderRadius:8,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:18,color:C.textMid,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>-</button>
        <div style={{flex:1,textAlign:"center",fontSize:11,color:C.textMid}}>{m.val>=m.goal?<span style={{color:C.success,fontWeight:700}}>Goal reached!</span>:`${m.goal-m.val} more to reach goal`}</div>
        <button onClick={()=>update(m.key,m.val+1)} style={{width:36,height:36,borderRadius:8,border:`none`,background:m.color,cursor:"pointer",fontSize:18,color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>+</button>
      </div>
    </Card>)}

    {/* History */}
    <Card style={{marginBottom:16}}>
      <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:10}}>Recent History</div>
      {weekHistory.map((wh,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        <div style={{width:80,fontSize:11,color:i===0?C.text:C.textMid,fontWeight:i===0?700:400}}>{wh.label}</div>
        <div style={{flex:1}}><Bar pct={wh.pct} color={wh.pct>=80?C.success:wh.pct>=50?C.teal:C.gold} h={5}/></div>
        <div style={{fontSize:11,fontWeight:600,color:wh.pct>=80?C.success:wh.pct>=50?C.teal:C.gold,width:36,textAlign:"right"}}>{wh.pct}%</div>
        <div style={{fontSize:10,color:C.textLight,width:80,textAlign:"right"}}>{wh.data.contacts}c / {wh.data.apptSet}s / {wh.data.apptDone}d</div>
      </div>)}
    </Card>

    {/* Team summary - admin only */}
    {isAdmin&&teamRows.length>0&&<Card>
      <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:10}}>Team This Week</div>
      {teamRows.map((u,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"8px 10px",background:C.surface,borderRadius:8}}>
        <div style={{width:28,height:28,borderRadius:7,background:C.teal+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.teal,flexShrink:0}}>{u.name?.charAt(0)?.toUpperCase()}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}</div>
          <div style={{fontSize:10,color:C.textLight}}>{u.week.contacts}c / {u.week.apptSet}s / {u.week.apptDone}d</div>
        </div>
        <div style={{flex:1}}><Bar pct={u.pct} color={u.pct>=80?C.success:u.pct>=50?C.teal:C.gold} h={4}/></div>
        <div style={{fontSize:12,fontWeight:700,color:u.pct>=80?C.success:u.pct>=50?C.teal:C.gold,width:36,textAlign:"right"}}>{u.pct}%</div>
      </div>)}
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
        <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:8,background:C.teal,color:"white",cursor:"pointer",fontSize:12,fontWeight:600,marginRight:8}}>
          Change Photo<input type="file" accept="image/*" style={{display:"none"}} onChange={handleUpload}/>
        </label>
        <button onClick={()=>setShowLightbox(false)} style={{padding:"8px 16px",borderRadius:8,background:"rgba(255,255,255,0.1)",color:"white",border:"1px solid rgba(255,255,255,0.2)",cursor:"pointer",fontSize:12}}>Close</button>
      </div>
    </div>}
  </div>;

  return <div>
    {photo?<div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
      <img src={photo} alt="Profile" onClick={()=>setShowLightbox(true)} style={{width:80,height:80,borderRadius:10,objectFit:"cover",border:"2px solid "+C.teal,cursor:"pointer"}}/>
      <div>
        <div style={{fontSize:11,color:C.textMid,marginBottom:6,lineHeight:1.4}}>Click photo to view full size. Used for DGO and Wall of Fame recognition.</div>
        <label style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:7,background:C.teal+"11",border:"1px solid "+C.teal+"33",cursor:"pointer",fontSize:11,color:C.teal,fontWeight:600}}>
          Change Photo<input type="file" accept="image/*" style={{display:"none"}} onChange={handleUpload}/>
        </label>
      </div>
    </div>:
    <label style={{display:"flex",alignItems:"center",gap:6,padding:"9px 14px",borderRadius:9,background:C.teal+"11",border:"1px dashed "+C.teal+"44",cursor:"pointer",fontSize:12,color:C.teal,fontWeight:600,marginBottom:10}}>
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
    <div style={{fontSize:11,fontWeight:700,color:C.textMid,marginBottom:8}}>Profile Photo</div>
    <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
      <img src={photo} alt="DGO" onClick={()=>setShowLightbox(true)} style={{width:100,height:100,borderRadius:10,objectFit:"cover",border:`2px solid ${C.teal}`,cursor:"pointer",flexShrink:0,transition:"transform 0.15s"}} onMouseEnter={e=>e.target.style.transform="scale(1.03)"} onMouseLeave={e=>e.target.style.transform="scale(1)"}/>
      <div style={{flex:1}}>
        <div style={{fontSize:11,color:C.textMid,marginBottom:10,lineHeight:1.5}}>Click the photo to view full size. Right-click to copy. Use the buttons below to download for your presentation.</div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          <button onClick={()=>setShowLightbox(true)} style={{padding:"7px 14px",borderRadius:8,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View Full Size
          </button>
          <button onClick={download} style={{padding:"7px 14px",borderRadius:8,background:C.navy,color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
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
        <button onClick={download} style={{padding:"10px 24px",borderRadius:10,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:8}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          Download Photo
        </button>
        <button onClick={onClose} style={{padding:"10px 24px",borderRadius:10,background:"rgba(255,255,255,0.1)",color:"white",border:"1px solid rgba(255,255,255,0.2)",cursor:"pointer",fontSize:13,fontWeight:600}}>Close</button>
      </div>
      <div style={{textAlign:"center",marginTop:10,fontSize:11,color:"rgba(255,255,255,0.4)"}}>Right-click the photo to save or copy image</div>
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
      <div style={{fontSize:13,fontWeight:700,color:C.text}}>RVP Path Access Requests ({pending.length})</div>
    </div>
    {pending.map(rep=><div key={rep.id} style={{background:C.surface,borderRadius:8,padding:"10px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:600,color:C.text}}>{rep.name}</div>
        <div style={{fontSize:11,color:C.textMid}}>Requesting RVP Path access — {rep.rvpPathRequestedAt?new Date(rep.rvpPathRequestedAt).toLocaleDateString():""}</div>
      </div>
      <button onClick={()=>onUpdate({...data,reps:(data.reps||[]).map(r=>r.id===rep.id?{...r,rvpPathGranted:true,rvpPathGrantedAt:new Date().toISOString()}:r)})}
        style={{padding:"6px 12px",borderRadius:7,background:C.success,color:"white",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>Grant Access</button>
      <button onClick={()=>onUpdate({...data,reps:(data.reps||[]).map(r=>r.id===rep.id?{...r,rvpPathRequested:false}:r)})}
        style={{padding:"6px 10px",borderRadius:7,background:C.danger+"11",color:C.danger,border:"1px solid "+C.danger+"33",cursor:"pointer",fontSize:11,fontWeight:600}}>Deny</button>
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
      <div style={{fontSize:13,fontWeight:700,color:C.text}}>Field Trainer Review Requests ({pending.length})</div>
    </div>
    {pending.map(rep=><div key={rep.id} style={{background:C.surface,borderRadius:8,padding:"10px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:C.text}}>{rep.name}</div><div style={{fontSize:11,color:C.textMid}}>Requesting Field Trainer review - {rep.fieldTrainerRequestedAt?new Date(rep.fieldTrainerRequestedAt).toLocaleDateString():""}</div></div>
      <button onClick={()=>onUpdate({...data,reps:(data.reps||[]).map(r=>r.id===rep.id?{...r,fieldTrainerGranted:true,fieldTrainerGrantedAt:new Date().toISOString()}:r)})} style={{padding:"6px 12px",borderRadius:7,background:C.success,color:"white",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>Approve</button>
      <button onClick={()=>onUpdate({...data,reps:(data.reps||[]).map(r=>r.id===rep.id?{...r,fieldTrainerRequested:false,fieldTrainerDenied:true}:r)})} style={{padding:"6px 10px",borderRadius:7,background:C.danger+"11",color:C.danger,border:"1px solid "+C.danger+"33",cursor:"pointer",fontSize:11,fontWeight:600}}>Deny</button>
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
      <div style={{fontSize:13,fontWeight:700,color:C.text}}>Pending Recruit Submissions ({allPending.length})</div>
    </div>
    {allPending.map((p,i)=><div key={i} style={{background:C.surface,borderRadius:8,padding:"9px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
      <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:C.text}}>{p.name}{p.phone&&<span style={{color:C.textMid,fontWeight:400}}> - {p.phone}</span>}</div><div style={{fontSize:10,color:C.textMid}}>Submitted by {p.recruitedBy} on {new Date(p.submittedAt).toLocaleDateString()}</div></div>
      <button onClick={()=>{
        const recruiterRep=(data.reps||[]).find(r=>r.id===p.recruitedById);
        const updatedPending=(recruiterRep?.pendingRecruits||[]).filter(pr=>pr.id!==p.id);
        const newRep={name:p.name,phone:p.phone||"",track:"fast",trainerId:"",startDate:new Date().toISOString().split("T")[0],graduationDate:"",recruitedBy:p.recruitedById,id:"rep_"+Date.now(),checked:{},trainerChecked:{},appointments:[],references:[],checkIns:[],repPin:null,createdAt:Date.now()};
        onUpdate({...data,reps:[...(data.reps||[]).map(r=>r.id===p.recruitedById?{...r,pendingRecruits:updatedPending}:r),newRep]});
      }} style={{padding:"5px 10px",borderRadius:7,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>Add to System</button>
      <button onClick={()=>{
        const recruiterRep=(data.reps||[]).find(r=>r.id===p.recruitedById);
        const updatedPending=(recruiterRep?.pendingRecruits||[]).filter(pr=>pr.id!==p.id);
        onUpdate({...data,reps:(data.reps||[]).map(r=>r.id===p.recruitedById?{...r,pendingRecruits:updatedPending}:r)});
      }} style={{padding:"5px 8px",borderRadius:7,background:C.danger+"11",color:C.danger,border:"1px solid "+C.danger+"33",cursor:"pointer",fontSize:10}}>Dismiss</button>
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

  const rvpRequested = myData.rvpPathRequested&&!myData.rvpPathGranted;
  const rvpDenied = myData.rvpPathDenied&&!myData.rvpPathRequested;
  const rvpGranted = myData.rvpPathGranted;

  const save = (updates) => {
    onUpdate({...data,trainerCareer:{...trainerData,[session.id]:{...myData,...updates}}});
  };

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
  const rvpTotal = RVP_CHECKLIST.length;
  const rvpPct = rvpTotal>0?Math.round((rvpDone/rvpTotal)*100):0;

  // Stages roadmap
  const stages=[{key:"trainer",label:"Field Trainer",color:C.purple},{key:"rvp",label:"RVP",color:C.success}];
  const currentStage = rvpGranted?"rvp":"trainer";

  return <div>
    {showCelebration&&<Confetti name={session.name} onClose={()=>setShowCelebration(false)}/>}

    <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:14}}>My Career Path</div>

    {/* Roadmap */}
    <div style={{background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",borderRadius:12,padding:"16px",marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:700,color:C.teal,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:12}}>Your Career Journey</div>
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
            <div style={{fontSize:9,fontWeight:active?700:400,color:active?"white":"rgba(255,255,255,0.4)",lineHeight:1.2}}>{s.label}</div>
          </div>;
        })}
      </div>
    </div>

    {/* Recognition banner */}
    {!rvpGranted&&<div style={{background:"linear-gradient(135deg,"+C.purple+"22,"+C.gold+"11)",border:"1px solid "+C.purple+"33",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
      <div style={{fontSize:14,fontWeight:700,color:C.purple,marginBottom:6}}>You Are a Field Trainer!</div>
      <div style={{fontSize:12,color:C.text,lineHeight:1.7}}>You have earned one of the most important roles in this organization. You are not just building a business — you are changing lives and creating leaders. Your next milestone is becoming a <strong>Regional Vice President</strong>. You have what it takes!</div>
    </div>}

    {/* RVP Countdown */}
    {rvpGranted&&<div style={{background:"linear-gradient(135deg,"+C.success+"22,"+C.teal+"11)",border:"1px solid "+C.success+"33",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:13,fontWeight:700,color:C.success}}>RVP Path Unlocked!</div>
        <div style={{fontSize:11,color:C.textMid}}>Checklist {rvpPct}% complete</div>
      </div>
      <Bar pct={rvpPct} color={C.success} h={6}/>
      {myData.rvpTargetDate&&<div style={{marginTop:10,textAlign:"center"}}>
        <div style={{fontSize:28,fontWeight:800,color:countdownColor}}>{daysLeft<=0?"Time to push harder!":daysLeft+" days"}</div>
        <div style={{fontSize:11,color:C.textMid}}>until your target promotion date — {new Date(myData.rvpTargetDate+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>
        <div style={{fontSize:12,color:countdownColor,fontWeight:600,marginTop:4}}>{countdownMsg}</div>
      </div>}
    </div>}

    {/* RVP Request / Target Date */}
    {!rvpGranted&&<Card style={{marginBottom:14,border:"1px solid "+(rvpRequested?C.gold+"44":rvpDenied?C.danger+"44":C.purple+"33")}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>Request RVP Path Access</div>
      <div style={{fontSize:11,color:C.textMid,marginBottom:10,lineHeight:1.5}}>When you are consistently producing and ready to build a region, request access to the full RVP checklist. Enter your target promotion date so your team knows your commitment.</div>
      {rvpDenied&&<div style={{background:C.danger+"11",border:"1px solid "+C.danger+"33",borderRadius:8,padding:"7px 12px",fontSize:11,color:C.danger,marginBottom:10,textAlign:"center"}}>Request was not approved — speak with your RVP for next steps</div>}
      {!rvpRequested&&<div>
        <div style={{marginBottom:8}}>
          <div style={{fontSize:11,color:C.textMid,marginBottom:4}}>Target RVP Promotion Date</div>
          <input type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:13,color:C.text,boxSizing:"border-box"}}/>
        </div>
        <button onClick={()=>{
          if(!targetDate){alert("Please enter your target promotion date first");return;}
          save({rvpPathRequested:true,rvpPathDenied:false,rvpPathRequestedAt:new Date().toISOString(),rvpTargetDate:targetDate});
          setShowCelebration(true);
        }} style={{width:"100%",padding:"11px",borderRadius:9,background:"linear-gradient(135deg,"+C.purple+","+C.success+")",color:"white",border:"none",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          Request RVP Path Access
        </button>
      </div>}
      {rvpRequested&&<div style={{background:C.gold+"11",border:"1px solid "+C.gold+"33",borderRadius:8,padding:"10px 12px",textAlign:"center",fontSize:12,color:C.gold,fontWeight:600}}>
        RVP Path request sent! Your target date: {myData.rvpTargetDate?new Date(myData.rvpTargetDate+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}):"Not set"}. Your RVP has been notified!
      </div>}
    </Card>}

    {/* Target date for granted */}
    {rvpGranted&&!myData.rvpTargetDate&&<Card style={{marginBottom:14,border:"1px solid "+C.gold+"33"}}>
      <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:6}}>Set Your Target Promotion Date</div>
      <input type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:13,color:C.text,boxSizing:"border-box",marginBottom:8}}/>
      <button onClick={()=>save({rvpTargetDate:targetDate})} style={{width:"100%",padding:"8px",borderRadius:8,background:C.gold,color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:600}}>Save Date</button>
    </Card>}

    {/* RVP Goal Tracker */}
    {rvpGranted&&<Card style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text}}>RVP Goals</div>
        <button onClick={()=>setEditGoals(!editGoals)} style={{fontSize:11,padding:"3px 9px",borderRadius:6,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>{editGoals?"Done":"Edit"}</button>
      </div>
      {editGoals&&<div style={{background:C.surface,borderRadius:8,padding:9,marginBottom:10}}>
        {[["premium","Monthly Premium Target $",goals.premium],["agents","Licensed Agents Goal",goals.agents],["teamSize","Team Size Goal",goals.teamSize]].map(([k,l,v])=><div key={k} style={{marginBottom:7}}>
          <div style={{fontSize:10,color:C.textMid,marginBottom:3}}>{l}</div>
          <input type="number" value={v} onChange={e=>setGoals({...goals,[k]:Number(e.target.value)})} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:11,color:C.text,boxSizing:"border-box"}}/>
        </div>)}
        <button onClick={()=>{save({rvpGoals:goals});setEditGoals(false);}} style={{width:"100%",padding:"6px",borderRadius:7,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:11,fontWeight:600}}>Save Goals</button>
      </div>}
      {[
        {l:"Monthly Premium",val:"$"+totalPrem.toFixed(0),goal:"$"+(myData.rvpGoals?.premium||10000),pct:(totalPrem/(myData.rvpGoals?.premium||10000))*100,color:C.teal},
        {l:"Licensed Agents",val:licensed,goal:myData.rvpGoals?.agents||20,pct:(licensed/(myData.rvpGoals?.agents||20))*100,color:C.gold},
        {l:"Team Size",val:myReps.length,goal:myData.rvpGoals?.teamSize||30,pct:(myReps.length/(myData.rvpGoals?.teamSize||30))*100,color:C.purple},
      ].map(g=><div key={g.l} style={{marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
          <span style={{fontSize:12,color:C.textMid}}>{g.l}</span>
          <span style={{fontSize:12,fontWeight:600,color:g.pct>=100?C.success:C.text}}>{g.val} / {g.goal}</span>
        </div>
        <Bar pct={g.pct} color={g.pct>=100?C.success:g.color} h={5}/>
      </div>)}
    </Card>}

    {/* Weekly Accountability */}
    {rvpGranted&&<Card style={{marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>Weekly Accountability</div>
      <div style={{fontSize:11,color:C.textMid,marginBottom:8}}>What do you commit to doing this week toward your RVP goal?</div>
      <textarea placeholder="This week I will..." value={weeklyCommit} onChange={e=>setWeeklyCommit(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:12,color:C.text,resize:"vertical",minHeight:70,boxSizing:"border-box",lineHeight:1.6,fontFamily:"inherit",marginBottom:8}}/>
      <button onClick={()=>{
        const commits=[...(myData.weeklyCommits||[]),{text:weeklyCommit,date:new Date().toISOString()}];
        save({weeklyCommits:commits});
        setWeeklyCommit("");
      }} style={{width:"100%",padding:"8px",borderRadius:8,background:C.navy,color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:600}}>Save Commitment</button>
      {(myData.weeklyCommits||[]).slice(-3).reverse().map((c,i)=><div key={i} style={{padding:"7px 0",borderTop:"1px solid "+C.border,marginTop:6}}>
        <div style={{fontSize:11,color:C.text}}>{c.text}</div>
        <div style={{fontSize:10,color:C.textLight,marginTop:2}}>{new Date(c.date).toLocaleDateString()}</div>
      </div>)}
    </Card>}

    {/* RVP Checklist */}
    {rvpGranted&&<div>
      <SecHead title={"RVP Checklist ("+rvpDone+"/"+rvpTotal+")"} color={C.gold}/>
      {Object.entries(RVP_CHECKLIST.reduce((a,i)=>{if(!a[i.cat])a[i.cat]=[];a[i.cat].push(i);return a;},{})).map(([cat,items])=><div key={cat}>
        <SecHead title={cat} color={C.gold}/>
        {items.map(item=><CheckItem key={item.id} item={item}
          checked={!!(myData.rvpChecked||{})[item.id]}
          onToggle={()=>save({rvpChecked:{...(myData.rvpChecked||{}),[item.id]:!(myData.rvpChecked||{})[item.id]}})}/>)}
      </div>)}
    </div>}

    {/* Team overview */}
    {rvpGranted&&myReps.length>0&&<Card style={{marginTop:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>My Team</div>
      {myReps.map((r,i)=>{
        const cl=TRACK_INFO[r.track]?.checklist||[];
        const done=cl.filter(item=>(r.checked||{})[item.id]).length;
        const pct=cl.length>0?Math.round((done/cl.length)*100):0;
        return <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7,padding:"7px 0",borderBottom:i<myReps.length-1?"1px solid "+C.border:"none"}}>
          <div style={{width:28,height:28,borderRadius:7,background:C.teal+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.teal,flexShrink:0}}>{r.name?.charAt(0)?.toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
            <Bar pct={pct} color={TRACK_INFO[r.track]?.color||C.teal} h={3}/>
          </div>
          <div style={{fontSize:11,fontWeight:600,color:pct===100?C.success:C.textMid}}>{pct}%</div>
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
          <label style={{padding:"7px 14px",borderRadius:8,background:C.teal,color:"white",cursor:"pointer",fontSize:12,fontWeight:600}}>
            Change<input type="file" accept="image/*" style={{display:"none"}} onChange={handle}/>
          </label>
          <button onClick={remove} style={{padding:"7px 14px",borderRadius:8,background:C.danger+"22",color:C.danger,border:"none",cursor:"pointer",fontSize:12}}>Remove</button>
          <button onClick={()=>setShowLightbox(false)} style={{padding:"7px 14px",borderRadius:8,background:"rgba(255,255,255,0.1)",color:"white",border:"none",cursor:"pointer",fontSize:12}}>Close</button>
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
          <label style={{padding:"8px 16px",borderRadius:8,background:C.teal,color:"white",cursor:"pointer",fontSize:12,fontWeight:600}}>
            Change Photo<input type="file" accept="image/*" style={{display:"none"}} onChange={handleUpload}/>
          </label>
          <button onClick={remove} style={{padding:"8px 16px",borderRadius:8,background:C.danger+"22",color:C.danger,border:"none",cursor:"pointer",fontSize:12,fontWeight:600}}>Remove</button>
          <button onClick={()=>setShowLightbox(false)} style={{padding:"8px 16px",borderRadius:8,background:"rgba(255,255,255,0.1)",color:"white",border:"none",cursor:"pointer",fontSize:12}}>Close</button>
        </div>
      </div>
    </div>}

    <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:4}}>My Profile</div>
    <div style={{fontSize:12,color:C.textMid,marginBottom:20}}>Your profile photo is used for Wall of Fame recognition and team displays.</div>

    <Card style={{marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>Profile Photo</div>
      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
        {photo
          ?<img src={photo} onClick={()=>setShowLightbox(true)} style={{width:80,height:80,borderRadius:12,objectFit:"cover",border:"2px solid "+C.teal,cursor:"pointer",flexShrink:0}}/>
          :<div style={{width:80,height:80,borderRadius:12,background:C.teal+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:800,color:C.teal,border:"2px dashed "+C.teal+"44",flexShrink:0}}>
            {session.name?.charAt(0)?.toUpperCase()}
          </div>}
        <div style={{flex:1}}>
          <div style={{fontSize:12,color:C.textMid,marginBottom:10,lineHeight:1.6}}>{photo?"Click your photo to view full size, or use the buttons below to update it.":"Upload a professional headshot. This photo will be used when you are recognized on the Wall of Fame."}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,background:C.teal,color:"white",cursor:"pointer",fontSize:12,fontWeight:600}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              {photo?"Change Photo":"Upload Photo"}
              <input type="file" accept="image/*" style={{display:"none"}} onChange={handleUpload}/>
            </label>
            {photo&&<button onClick={remove} style={{padding:"7px 14px",borderRadius:8,background:C.danger+"11",color:C.danger,border:"1px solid "+C.danger+"33",cursor:"pointer",fontSize:12,fontWeight:600}}>Remove</button>}
            {photo&&<button onClick={()=>setShowLightbox(true)} style={{padding:"7px 14px",borderRadius:8,background:C.surface,color:C.textMid,border:"1px solid "+C.border,cursor:"pointer",fontSize:12}}>View Full Size</button>}
          </div>
        </div>
      </div>
    </Card>

    <Card>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>Account Info</div>
      {[{l:"Name",v:session.name},{l:"Role",v:session.role?.charAt(0)?.toUpperCase()+session.role?.slice(1)},{l:"App",v:"NextLevel Field Training Hub"}].map((item,i)=><div key={i} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:i<2?"1px solid "+C.border:"none"}}>
        <span style={{fontSize:12,color:C.textMid,width:60,flexShrink:0}}>{item.l}</span>
        <span style={{fontSize:12,fontWeight:600,color:C.text}}>{item.v}</span>
      </div>)}
    </Card>
  </div>;
}


// ── WALL OF FAME BANNER (scrollable strip) ──
function WallOfFameBanner({data}) {
  const recognitions = data.wallOfFame||[];
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
    <div style={{fontSize:10,fontWeight:700,color:C.textMid,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:8,paddingLeft:2}}>Wall of Fame</div>
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
            <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.personName}</div>
            <div style={{fontSize:9,fontWeight:700,color:catColor,background:catColor+"15",borderRadius:4,padding:"2px 6px",display:"inline-block",marginBottom:4}}>{r.category}</div>
            <div style={{fontSize:10,color:C.textMid,lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{r.message}</div>
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
function MyLeadLink({name,data}) {
  const [copied,setCopied] = useState(false);
  // Check if this admin has a custom link name set
  const adminRecord = (typeof data!=="undefined")&&(data.admins||[]).find(a=>a.name===name);
  const safeName = adminRecord?.linkName||(name||"").trim().split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g,"");
  const link = "https://moneymap-app-two.vercel.app?rep="+safeName;

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

  return <div style={{background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",borderRadius:12,padding:"14px 16px",marginBottom:14,border:"1px solid "+C.teal+"33"}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
      <div style={{width:8,height:8,borderRadius:4,background:C.teal}}/>
      <div style={{fontSize:11,fontWeight:700,color:C.teal,textTransform:"uppercase",letterSpacing:"0.7px"}}>My Lead Link</div>
    </div>
    <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:8,lineHeight:1.5}}>Share this personal link with prospects to start their MoneyMap conversation.</div>
    <div style={{background:"rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 12px",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
      <div style={{flex:1,fontSize:12,color:"white",wordBreak:"break-all",fontFamily:"monospace"}}>{link}</div>
    </div>
    <div style={{display:"flex",gap:8}}>
      <button onClick={copy} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:copied?C.success:"linear-gradient(135deg,"+C.teal+",#0891b2)",color:"white",cursor:"pointer",fontSize:12,fontWeight:700,transition:"background 0.2s"}}>
        {copied?"Copied!":"Copy Link"}
      </button>
      <button onClick={share} style={{flex:1,padding:"9px",borderRadius:8,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.08)",color:"white",cursor:"pointer",fontSize:12,fontWeight:600}}>
        Share
      </button>
    </div>
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
      <div style={{fontSize:12,color:C.textMid,marginBottom:14}}>You have uncompleted tasks on {newLeads.length} lead{newLeads.length!==1?"s":""}. Check off tasks as you complete them.</div>
      {newLeads.map((lead,i)=>{
        const lt = repTasks[lead.docId]||{};
        const done = LEAD_TASKS.filter(t=>lt[t.id]).length;
        return <div key={i} style={{borderRadius:10,border:"1px solid "+C.border,padding:"12px",marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:2}}>{lead.name||"Unknown"}</div>
          <div style={{fontSize:11,color:C.textMid,marginBottom:8}}>{lead.phone} • {done}/{LEAD_TASKS.length} tasks done</div>
          {LEAD_TASKS.map(task=><label key={task.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid "+C.border,cursor:"pointer"}}>
            <input type="checkbox" checked={!!lt[task.id]} onChange={()=>toggleTask(lead.docId,task.id)} style={{width:16,height:16,cursor:"pointer"}}/>
            <span style={{fontSize:12,color:lt[task.id]?C.textLight:C.text,textDecoration:lt[task.id]?"line-through":"none"}}>{task.label}</span>
          </label>)}
        </div>;
      })}
      <button onClick={onClose} style={{width:"100%",padding:"10px",borderRadius:9,background:C.navy,color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,marginTop:6}}>Done for Now</button>
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
  const today = new Date().toISOString().split("T")[0];
  const activityLog = data.activityLogs||{};
  const repLog = activityLog[rep.id]||{};
  const todayLog = repLog[today];
  const [form,setForm] = useState({talked:0,followup:0,apptSet:0,apptRan:0,recruited:0});
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
        [today]:{...form,submittedAt:new Date().toISOString()}
      }
    };
    onUpdate({...data,activityLogs:updated});
    setSubmitted(true);
  };

  if(submitted) return null;

  if(showFirst) return <div style={{background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",borderRadius:12,padding:"16px",marginBottom:14,border:"1px solid "+C.teal+"33"}}>
    <div style={{fontSize:13,fontWeight:700,color:C.teal,marginBottom:8}}>Welcome to Your Daily Activity Log</div>
    <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",lineHeight:1.7,marginBottom:12}}>Each day you will be asked to log a quick summary of your activity. This log helps your RVP track your progress and provide the right support. It only takes 30 seconds — <strong style={{color:"white"}}>your consistency here directly reflects your commitment to your goals.</strong></div>
    <button onClick={()=>{setShowFirst(false);const u={...activityLog,[rep.id]:{...(activityLog[rep.id]||{}),seenIntro:true}};onUpdate({...data,activityLogs:u});}} style={{width:"100%",padding:"9px",borderRadius:8,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>Got It — Let me Log Today</button>
  </div>;

  return <div style={{background:"white",borderRadius:12,border:"2px solid "+C.gold+"44",padding:"14px 16px",marginBottom:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text}}>Today's Activity Log</div>
      {streak>0&&<div style={{fontSize:11,fontWeight:700,color:C.gold}}>🔥 {streak} day streak</div>}
    </div>
    <div style={{fontSize:11,color:C.danger,fontWeight:600,marginBottom:12}}>You haven't logged today's activity yet. Your streak is at risk — log now.</div>
    {DAILY_QUESTIONS.map(q=><div key={q.id} style={{marginBottom:10}}>
      <div style={{fontSize:11,color:C.text,marginBottom:4,lineHeight:1.4}}>{q.label}</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <button onClick={()=>setForm(f=>({...f,[q.id]:Math.max(0,f[q.id]-1)}))} style={{width:30,height:30,borderRadius:7,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:16,color:C.textMid,fontWeight:700}}>-</button>
        <div style={{fontSize:18,fontWeight:700,color:C.teal,minWidth:30,textAlign:"center"}}>{form[q.id]}</div>
        <button onClick={()=>setForm(f=>({...f,[q.id]:f[q.id]+1}))} style={{width:30,height:30,borderRadius:7,border:"none",background:C.teal,cursor:"pointer",fontSize:16,color:"white",fontWeight:700}}>+</button>
      </div>
    </div>)}
    <button onClick={submit} style={{width:"100%",padding:"10px",borderRadius:9,background:"linear-gradient(135deg,"+C.gold+",#f97316)",border:"none",color:"white",cursor:"pointer",fontSize:13,fontWeight:700,marginTop:4}}>Submit Today's Log</button>
    <div style={{fontSize:10,color:C.textMid,textAlign:"center",marginTop:6,lineHeight:1.4}}>Your RVP reviews your activity log to support your growth and celebrate your wins!</div>
  </div>;
}

// ══════════════════════════════════════════════════
// PROMPT 6 — ACCOUNTABILITY DASHBOARD
// ══════════════════════════════════════════════════
function AccountabilityDashboard({data,onUpdate,userRole,userId}) {
  const isAdmin = userRole==="admin"||userRole==="superadmin";
  const allReps = data.reps||[];
  const trainers = data.trainers||[];
  const allTrainers = [...trainers,...(data.admins||[])];
  // Combine reps and trainers — admins see all, trainers see only their reps
  const reps = isAdmin 
    ? [...allReps, ...trainers.map(t=>({...t,isTrainer:true,track:"licensed"}))]
    : allReps.filter(r=>r.trainerId===userId);
  const activityLogs = data.activityLogs||{};
  const leadTasks = data.leadTasks||{};
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now()-86400000).toISOString().split("T")[0];
  const [search,setSearch] = useState("");
  const [statusFilter,setStatusFilter] = useState("all");
  const [expandedRep,setExpandedRep] = useState(null);
  const [checkInNote,setCheckInNote] = useState("");
  const [statusNote,setStatusNote] = useState({});

  const repStats = reps.map(rep=>{
    const repLog = activityLogs[rep.id]||{};
    const submittedToday = !!repLog[today];
    const submittedYesterday = !!repLog[yesterday];
    let streak=0;
    const d=new Date();
    if(submittedToday){streak=1;d.setDate(d.getDate()-1);while(repLog[d.toISOString().split("T")[0]]){streak++;d.setDate(d.getDate()-1);if(streak>365)break;}}
    // Auto at-risk flags
    const loginHistory2 = (data.loginHistory||{})[rep.id]||[];
    const lastLoginDate = loginHistory2.length>0?new Date(loginHistory2[loginHistory2.length-1].ts):null;
    const daysSinceLogin = lastLoginDate?Math.floor((Date.now()-lastLoginDate)/86400000):999;
    const daysSinceChecklist = rep.lastChecklistActivity?Math.floor((Date.now()-new Date(rep.lastChecklistActivity))/86400000):999;
    const isAtRisk = daysSinceLogin>=30||daysSinceChecklist>=30||(!submittedToday&&!submittedYesterday&&streak===0&&(loginHistory2.length>0));
    const status = submittedToday?"green":submittedYesterday?"yellow":"red";
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
    const scorecard = (data.scorecards||{})[rep.id]||{};

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

    return {...rep,submittedToday,streak,status,isAtRisk,openTasks,progress,recruiter,last7,todayLog,weekTotals,scorecard,lastLogin,loginsThisWeek,loginsThisMonth};
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
  const statusLabels={green:"Active Today",yellow:"1 Day Idle",red:"3+ Days Silent"};

  const addCheckIn = (repId) => {
    if(!checkInNote.trim()) return;
    const note={text:checkInNote,date:new Date().toISOString(),by:userId};
    const updated=(data.reps||[]).map(r=>r.id===repId?{...r,checkIns:[...(r.checkIns||[]),note]}:r);
    onUpdate({...data,reps:updated});
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
    <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:4}}>Accountability Dashboard</div>
    <div style={{fontSize:12,color:C.textMid,marginBottom:14,lineHeight:1.5}}>Track rep activity, daily log submissions, checklist progress, and coaching notes — all in one place. Green means active today. Yellow means 1 day idle. Red means 3+ days with no submission.</div>

    {/* Summary stats */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
      {[{l:"Active Today",v:repStats.filter(r=>r.status==="green").length,c:C.success},{l:"Needs Attention",v:repStats.filter(r=>r.status==="yellow").length,c:C.gold},{l:"Going Silent",v:repStats.filter(r=>r.status==="red").length,c:C.danger}].map(s=><Card key={s.l} style={{padding:"9px 11px",textAlign:"center"}}>
        <div style={{fontSize:20,fontWeight:700,color:s.c}}>{s.v}</div>
        <div style={{fontSize:10,color:C.textMid}}>{s.l}</div>
      </Card>)}
    </div>

    {/* Search + filter */}
    <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      <input placeholder="Search rep name..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,padding:"7px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:12,color:C.text}}/>
      <div style={{display:"flex",gap:4}}>
        {[["all","All"],["red","Silent"],["yellow","Idle"],["green","Active"]].map(([k,l])=>(
          <button key={k} onClick={()=>setStatusFilter(k)} style={{fontSize:10,padding:"5px 9px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:statusFilter===k?700:400,background:statusFilter===k?(k==="all"?C.navy:statusColors[k]):C.surface,color:statusFilter===k?"white":C.textMid}}>{l}</button>
        ))}
      </div>
    </div>

    {/* Rep cards */}
    {filtered.length===0&&<div style={{textAlign:"center",padding:"24px",color:C.textLight,fontSize:12}}>No reps match your filter</div>}
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
                <Badge color={statusColors[rep.status]} small>{statusLabels[rep.status]}</Badge>
                {rep.isAtRisk&&!rep.inactive&&<Badge color={"#f97316"} small>At Risk</Badge>}
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <span style={{fontSize:11,color:isExpanded?"rgba(255,255,255,0.5)":C.textMid}}>Streak: <strong style={{color:rep.streak>0?C.gold:(isExpanded?"rgba(255,255,255,0.5)":C.textLight)}}>{rep.streak}d</strong></span>
                <span style={{fontSize:11,color:isExpanded?"rgba(255,255,255,0.5)":C.textMid}}>Progress: <strong style={{color:isExpanded?"white":C.teal}}>{rep.progress}%</strong></span>
                <span style={{fontSize:11,color:isExpanded?"rgba(255,255,255,0.5)":C.textMid}}>Tasks: <strong style={{color:rep.openTasks>0?C.danger:(isExpanded?"white":C.success)}}>{rep.openTasks} open</strong></span>
                <span style={{fontSize:11,color:isExpanded?"rgba(255,255,255,0.5)":C.textMid}}>Recruited by: <strong style={{color:isExpanded?"white":C.purple}}>{rep.recruiter?.name||"Direct"}</strong></span>
              </div>
            </div>
            <span style={{color:isExpanded?"rgba(255,255,255,0.5)":C.textLight,fontSize:14,transform:isExpanded?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block",flexShrink:0}}>v</span>
          </div>
        </div>

        {/* Expanded details */}
        {isExpanded&&<div style={{padding:"14px",background:C.surface}}>

          {/* 7-day calendar */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:6}}>Last 7 Days</div>
            <div style={{display:"flex",gap:4}}>
              {rep.last7.map((day,di)=><div key={di} style={{flex:1,textAlign:"center"}}>
                <div style={{width:"100%",aspectRatio:"1",borderRadius:6,background:day.submitted?C.success:C.danger+"22",border:"2px solid "+(day.isToday?C.teal:(day.submitted?C.success:C.danger+"33")),display:"flex",alignItems:"center",justifyContent:"center",marginBottom:3}}>
                  <span style={{fontSize:14}}>{day.submitted?"✓":"·"}</span>
                </div>
                <div style={{fontSize:9,color:C.textLight}}>{["S","M","T","W","T","F","S"][new Date(day.key).getDay()]}</div>
              </div>)}
            </div>
          </div>

          {/* Today's log answers */}
          {rep.todayLog&&<div style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:8}}>Today's Activity Log</div>
            {DAILY_QUESTIONS.map(q=><div key={q.id} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid "+C.border}}>
              <span style={{fontSize:11,color:C.textMid,flex:1,paddingRight:8}}>{q.label.replace("How many ","").replace("?","")}</span>
              <span style={{fontSize:11,fontWeight:700,color:C.teal}}>{rep.todayLog[q.id]||0}</span>
            </div>)}
          </div>}
          {!rep.todayLog&&<div style={{background:C.danger+"11",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:C.danger,fontWeight:600}}>No activity log submitted today</div>}

          {/* Checklist progress */}
          <div style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:11,fontWeight:700,color:C.text}}>Checklist Progress</div>
              <div style={{fontSize:11,fontWeight:700,color:C.teal}}>{rep.progress}%</div>
            </div>
            <Bar pct={rep.progress} color={rep.progress>=100?C.success:C.teal} h={6}/>
          </div>

          {/* Status note */}
          <div style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:6}}>Status</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {["On Track","Needs Attention","At Risk","Inactive"].map(s=><button key={s} onClick={()=>setRepStatus(rep.id,rep.accountabilityStatus===s?null:s)} style={{fontSize:10,padding:"4px 9px",borderRadius:6,border:"1px solid "+C.border,cursor:"pointer",fontWeight:rep.accountabilityStatus===s?700:400,background:rep.accountabilityStatus===s?C.navy:"white",color:rep.accountabilityStatus===s?"white":C.textMid}}>{s}</button>)}
            </div>
          </div>

          {/* Weekly Activity Totals */}
          <div style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:8}}>Weekly Activity Totals ({rep.weekTotals.daysLogged}/7 days logged)</div>
            {rep.weekTotals.daysLogged===0?<div style={{fontSize:11,color:C.textLight}}>No activity logged this week</div>:
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {[{l:"People Talked To",v:rep.weekTotals.talked},{l:"Follow-up Calls",v:rep.weekTotals.followup},{l:"Appointments Set",v:rep.weekTotals.apptSet},{l:"Appointments Ran",v:rep.weekTotals.apptRan},{l:"Recruits Prospected",v:rep.weekTotals.recruited}].map(item=><div key={item.l} style={{background:C.surface,borderRadius:6,padding:"6px 9px"}}>
                <div style={{fontSize:18,fontWeight:700,color:C.teal}}>{item.v}</div>
                <div style={{fontSize:9,color:C.textMid}}>{item.l}</div>
              </div>)}
            </div>}
          </div>

          {/* Scorecard */}
          {rep.scorecard&&Object.keys(rep.scorecard).length>0&&<div style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:8}}>Scorecard This Week</div>
            {[{l:"Contacts Made",v:rep.scorecard.contacts||0,goal:100},{l:"Appointments Set",v:rep.scorecard.apptSet||0,goal:20},{l:"Appointments Done",v:rep.scorecard.apptDone||0,goal:20}].map(item=><div key={item.l} style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:11,color:C.textMid}}>{item.l}</span>
                <span style={{fontSize:11,fontWeight:700,color:C.teal}}>{item.v}/{item.goal}</span>
              </div>
              <Bar pct={Math.min(Math.round((item.v/item.goal)*100),100)} color={C.teal} h={4}/>
            </div>)}
          </div>}

          {/* App Engagement */}
          <div style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:8}}>App Engagement</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              <div style={{background:C.surface,borderRadius:6,padding:"6px 9px",textAlign:"center"}}>
                <div style={{fontSize:16,fontWeight:700,color:C.purple}}>{rep.loginsThisWeek}</div>
                <div style={{fontSize:9,color:C.textMid}}>Logins This Week</div>
              </div>
              <div style={{background:C.surface,borderRadius:6,padding:"6px 9px",textAlign:"center"}}>
                <div style={{fontSize:16,fontWeight:700,color:C.purple}}>{rep.loginsThisMonth}</div>
                <div style={{fontSize:9,color:C.textMid}}>Logins This Month</div>
              </div>
              <div style={{background:C.surface,borderRadius:6,padding:"6px 9px",textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:C.purple}}>{rep.lastLogin?new Date(rep.lastLogin).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"Never"}</div>
                <div style={{fontSize:9,color:C.textMid}}>Last Login</div>
              </div>
            </div>
          </div>

          {/* Editable Recruited By */}
          <div style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:6}}>Recruited By</div>
            <select value={rep.recruitedBy||""} onChange={e=>{
              const val=e.target.value;
              if(rep.isTrainer){
                const updated=(data.trainers||[]).map(t=>t.id===rep.id?{...t,recruitedBy:val}:t);
                onUpdate({...data,trainers:updated});
              } else {
                const updated=(data.reps||[]).map(r=>r.id===rep.id?{...r,recruitedBy:val}:r);
                onUpdate({...data,reps:updated});
              }
            }} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text}}>
              <option value="">Not specified</option>
              {[...(data.reps||[]),...(data.trainers||[]),...(data.admins||[])].map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Check-in log */}
          <div style={{background:"white",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:8}}>Coaching Notes</div>
            {(rep.checkIns||[]).length===0&&<div style={{fontSize:11,color:C.textLight,marginBottom:8}}>No coaching notes yet</div>}
            {(rep.checkIns||[]).slice(-3).reverse().map((ci,ci_i)=><div key={ci_i} style={{padding:"6px 0",borderBottom:"1px solid "+C.border,marginBottom:6}}>
              <div style={{fontSize:12,color:C.text}}>{ci.text}</div>
              <div style={{fontSize:10,color:C.textLight,marginTop:2}}>{new Date(ci.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
            </div>)}
            <div style={{display:"flex",gap:6,marginTop:6}}>
              <input placeholder="Add a coaching note..." value={checkInNote} onChange={e=>setCheckInNote(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCheckIn(rep.id)} style={{flex:1,padding:"6px 9px",borderRadius:7,border:"1px solid "+C.border,fontSize:11,color:C.text}}/>
              <button onClick={()=>addCheckIn(rep.id)} style={{padding:"6px 12px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:11,fontWeight:600}}>Add</button>
            </div>
          </div>

          {/* Generate Report */}
          <button onClick={()=>{
            const w=window.open("","_blank");
            const weekDays=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
            const totalPremium=(rep.selfPremium||[]).reduce((s,e)=>s+(Number(e.premium)||0),0);
            const premiumEntries=(rep.selfPremium||[]).length;
            const recruitsCount=(data.reps||[]).filter(r=>r.recruitedBy===rep.id).length;
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
              <div class="card"><div class="big">${rep.scorecard?.contacts||0}<span style="font-size:14px;color:#999">/100</span></div><div class="label">Contacts Made</div></div>
              <div class="card"><div class="big">${rep.scorecard?.apptSet||0}<span style="font-size:14px;color:#999">/20</span></div><div class="label">Appointments Set</div></div>
              <div class="card"><div class="big">${rep.scorecard?.apptDone||0}<span style="font-size:14px;color:#999">/20</span></div><div class="label">Appointments Done</div></div>
            </div>

            <h2>PRODUCTION</h2>
            <p class="note">Production numbers show the real-world results ${rep.name} is generating. Life apps and premium are the ultimate measure of activity translating into results.</p>
            <div class="grid">
              <div class="card"><div class="big">${premiumEntries}</div><div class="label">Premium Entries Logged</div></div>
              <div class="card"><div class="big">$${totalPremium.toLocaleString()}</div><div class="label">Total Monthly Premium</div></div>
              <div class="card"><div class="big">$${(rep.investments||[]).reduce((s,i)=>s+(Number(i.pac)||0),0).toLocaleString()}</div><div class="label">Monthly PAC</div></div>
              <div class="card"><div class="big">$${(rep.investments||[]).reduce((s,i)=>s+(Number(i.lumpSum)||0),0).toLocaleString()}</div><div class="label">Lump Sum</div></div>
              <div class="card"><div class="big">${recruitsCount}</div><div class="label">Reps Recruited</div></div>
            </div>

            <h2>TRAINING OBSERVATIONS</h2>
            <p class="note">Observations are a core part of the training process. Field Training Observations (FTO) show how actively ${rep.name} is working alongside their trainer in the field.</p>
            <div class="grid">
              <div class="card"><div class="big">${rep.ftoCount||0}<span style="font-size:14px;color:#999">/20</span></div><div class="label">FTO Observations</div></div>
              <div class="card"><div class="big">${rep.lifeAppCount||0}<span style="font-size:14px;color:#999">/10</span></div><div class="label">Life Insurance Observations</div></div>
              <div class="card"><div class="big">${rep.pacCount||0}<span style="font-size:14px;color:#999">/10</span></div><div class="label">Investment Observations</div></div>
            </div>

            <h2>CHECKLIST PROGRESS</h2>
            <p class="note">Training completion shows how invested ${rep.name} is in learning the system.</p>
            <p><strong>${rep.progress}% complete</strong></p>

            <h2>COACHING NOTES</h2>
            <p class="note">Notes from previous coaching sessions.</p>
            ${(rep.checkIns||[]).length===0?"<p style='color:#999;font-size:12px'>No coaching notes yet</p>":
            (rep.checkIns||[]).slice(-5).reverse().map(ci=>`<div class="note-item">${ci.text}<div class="note-date">${new Date(ci.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div></div>`).join("")}

            <p style="margin-top:40px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:10px;">Generated by NextLevel Field Training Hub • ${new Date().toLocaleString()}</p>
            </body></html>`);
            w.document.close();
          }} style={{width:"100%",padding:"9px",borderRadius:8,background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,marginBottom:8}}>Generate Coaching Report</button>

          {/* Remove rep — admin only */}
          {isAdmin&&<button onClick={()=>removeRep(rep.id,rep.name)} style={{width:"100%",padding:"8px",borderRadius:8,background:C.danger+"11",color:C.danger,border:"1px solid "+C.danger+"33",cursor:"pointer",fontSize:11,fontWeight:600}}>Mark as Inactive</button>}
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
      <div style={{fontSize:11,color:C.textMid}}>Trainer: <strong style={{color:C.text}}>{current?.label||"Unassigned"}</strong></div>
      <button onClick={()=>{setSelected(rep.trainerId||"");setEditing(!editing);}} style={{fontSize:10,padding:"2px 7px",borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>{editing?"Cancel":"Reassign"}</button>
    </div>
    {editing&&<div style={{marginTop:6,display:"flex",gap:6}}>
      <select value={selected} onChange={e=>setSelected(e.target.value)} style={{flex:1,padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text}}>
        <option value="">No trainer</option>
        {trainers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        {(data.admins||[]).filter(a=>a.alsoRecruits||a.isSuperAdmin).map(a=><option key={a.id} value={a.id}>{a.name} (Admin)</option>)}
      </select>
      <button onClick={save} style={{padding:"6px 12px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:11,fontWeight:600}}>Save</button>
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
      <div style={{fontSize:11,color:C.textMid}}>Recruited by: <strong style={{color:current?C.purple:C.textLight}}>{current?.name||"Not specified"}</strong></div>
      <button onClick={()=>{setSelected(rep.recruitedBy||"");setEditing(!editing);}} style={{fontSize:10,padding:"2px 7px",borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>{editing?"Cancel":"Edit"}</button>
    </div>
    {editing&&<div style={{marginTop:6,display:"flex",gap:6}}>
      <select value={selected} onChange={e=>setSelected(e.target.value)} style={{flex:1,padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text}}>
        <option value="">Not specified</option>
        {allPeople.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <button onClick={save} style={{padding:"6px 12px",borderRadius:7,border:"none",background:C.purple,color:"white",cursor:"pointer",fontSize:11,fontWeight:600}}>Save</button>
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
    {!showForm?<button onClick={()=>setShowForm(true)} style={{fontSize:10,padding:"4px 9px",borderRadius:6,border:"1px solid "+C.gold+"44",background:C.gold+"11",cursor:"pointer",color:C.gold,fontWeight:600}}>Reset PIN</button>:
    <div style={{background:C.surface,borderRadius:8,padding:"10px 12px",border:"1px solid "+C.gold+"33"}}>
      {done?<div style={{fontSize:12,color:C.success,fontWeight:600,textAlign:"center"}}>✓ PIN reset! Share the new PIN with {person.name}.</div>:<>
        <div style={{fontSize:11,fontWeight:600,color:C.text,marginBottom:6}}>Set Temporary PIN for {person.name}</div>
        <div style={{fontSize:11,color:C.textMid,marginBottom:8,lineHeight:1.5}}>Enter a 4-digit temporary PIN. Share it with {person.name} verbally or by text. They will be prompted to set a new PIN on login.</div>
        <input type="number" placeholder="4-digit PIN" value={newPin} onChange={e=>setNewPin(e.target.value.slice(0,4))} style={{width:"100%",padding:"8px 10px",borderRadius:7,border:"1px solid "+C.border,fontSize:16,textAlign:"center",letterSpacing:6,color:C.text,marginBottom:8,boxSizing:"border-box"}}/>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>{setShowForm(false);setNewPin("");}} style={{flex:1,padding:"7px",borderRadius:7,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:11,color:C.textMid}}>Cancel</button>
          <button onClick={save} style={{flex:2,padding:"7px",borderRadius:7,border:"none",background:C.gold,color:"white",cursor:"pointer",fontSize:11,fontWeight:700}}>Set PIN</button>
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
      <div style={{fontSize:12,color:C.textMid,marginBottom:16,lineHeight:1.6}}>Your PIN was recently reset. Please set a new personal 4-digit PIN to continue.</div>
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,color:C.textMid,marginBottom:4}}>New PIN</div>
        <input type="password" inputMode="numeric" maxLength={4} placeholder="Enter new 4-digit PIN" value={pin1} onChange={e=>setPin1(e.target.value)} style={{width:"100%",padding:"10px",borderRadius:8,border:"1px solid "+C.border,fontSize:18,textAlign:"center",letterSpacing:8,boxSizing:"border-box",color:C.text}}/>
      </div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,color:C.textMid,marginBottom:4}}>Confirm PIN</div>
        <input type="password" inputMode="numeric" maxLength={4} placeholder="Confirm your new PIN" value={pin2} onChange={e=>setPin2(e.target.value)} style={{width:"100%",padding:"10px",borderRadius:8,border:"1px solid "+C.border,fontSize:18,textAlign:"center",letterSpacing:8,boxSizing:"border-box",color:C.text}}/>
      </div>
      {err&&<div style={{fontSize:11,color:C.danger,marginBottom:10,textAlign:"center"}}>{err}</div>}
      <button onClick={save} style={{width:"100%",padding:"11px",borderRadius:9,background:"linear-gradient(135deg,"+C.teal+",#0891b2)",color:"white",border:"none",cursor:"pointer",fontSize:13,fontWeight:700}}>Save My PIN</button>
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
  const withRecruits = allPeople.map(p=>({name:p.name,count:(data.reps||[]).filter(r=>r.recruitedBy===p.id).length})).filter(p=>p.count>0).sort((a,b)=>b.count-a.count);
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
    const teamLump = allInv.reduce((s,i)=>s+(Number(i.lumpSum)||0),0);
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
        slide.addText(name,{x,y:y+0.95,w,h:0.35,fontSize:10,bold:true,color:"FFFFFF",align:"center"});
        if(label) slide.addText(label,{x,y:y+1.28,w,h:0.25,fontSize:8,color:"AABBCC",align:"center"});
      }catch(e){
        slide.addText((name||"?").charAt(0).toUpperCase(),{x,y:y+0.1,w,h:0.6,fontSize:28,bold:true,color:"0EA5C9",align:"center"});
        slide.addText(name,{x,y:y+0.72,w,h:0.35,fontSize:10,bold:true,color:"FFFFFF",align:"center"});
        if(label) slide.addText(label,{x,y:y+1.05,w,h:0.25,fontSize:8,color:"AABBCC",align:"center"});
      }
    } else {
      slide.addText((name||"?").charAt(0).toUpperCase(),{x,y:y+0.1,w,h:0.6,fontSize:28,bold:true,color:"0EA5C9",align:"center"});
      slide.addText(name,{x,y:y+0.72,w,h:0.35,fontSize:10,bold:true,color:"FFFFFF",align:"center"});
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

  if(!showForm) return <button onClick={()=>setShowForm(true)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",borderRadius:9,background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,width:"100%",justifyContent:"center",marginBottom:10}}>
    🏆 Generate Month End Celebration Report
  </button>;

  return <div style={{background:"white",borderRadius:12,border:"1px solid "+C.gold+"44",padding:"16px",marginBottom:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text}}>Month End Report — {monthName}</div>
      <button onClick={()=>setShowForm(false)} style={{fontSize:11,color:C.textMid,background:"none",border:"none",cursor:"pointer"}}>Cancel</button>
    </div>

    {/* Team Numbers */}
    <div style={{fontSize:11,fontWeight:700,color:C.teal,marginBottom:6,textTransform:"uppercase"}}>Team Numbers</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:12}}>
      {[["Total Life Premium $",form.totalPremium,"totalPremium"],["Total Recruits",form.totalRecruits,"totalRecruits"],["Appointments Run",form.apptRan,"apptRan"],["People Talked To",form.talked,"talked"],["Daily Logs Submitted",form.logsSubmitted,"logsSubmitted"],["Monthly PAC $",form.teamPAC,"teamPAC"],["Lump Sum $",form.teamLump,"teamLump"]].map(([label,val,key])=><div key={key}>
        <div style={{fontSize:10,color:C.textMid,marginBottom:2}}>{label}</div>
        <input type="number" value={val} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:12,color:C.text,boxSizing:"border-box"}}/>
      </div>)}
    </div>

    {/* Names */}
    <div style={{fontSize:11,fontWeight:700,color:C.teal,marginBottom:6,textTransform:"uppercase"}}>People to Recognize</div>
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
        <div style={{fontSize:10,color:C.textMid,marginBottom:2}}>{label}</div>
        <input value={val} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:12,color:C.text,boxSizing:"border-box",marginBottom:previewPhotos.length>0?4:0}}/>
        {previewPhotos.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {previewPhotos.map((p,pi)=><div key={pi} style={{display:"flex",alignItems:"center",gap:4,background:C.surface,borderRadius:6,padding:"2px 6px"}}>
            {p.photo?<img src={p.photo} style={{width:20,height:20,borderRadius:10,objectFit:"cover"}}/>:<div style={{width:20,height:20,borderRadius:10,background:C.teal,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white"}}>{p.name.charAt(0)}</div>}
            <span style={{fontSize:10,color:C.text}}>{p.name}</span>
          </div>)}
        </div>}
      </div>;
    })}

    {/* Promotions */}
    <div style={{fontSize:11,fontWeight:700,color:C.teal,marginBottom:6,textTransform:"uppercase",marginTop:4}}>Promotions</div>
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
        <div style={{fontSize:10,color:C.textMid,marginBottom:2}}>{rank}</div>
        <input placeholder="Names (comma separated)..." value={form.promotions[rank]||""} onChange={e=>setForm(f=>({...f,promotions:{...f.promotions,[rank]:e.target.value}}))} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:12,color:C.text,boxSizing:"border-box",marginBottom:previews.length>0?4:0}}/>
        {previews.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {previews.map((p,pi)=><div key={pi} style={{display:"flex",alignItems:"center",gap:4,background:C.surface,borderRadius:6,padding:"2px 6px"}}>
            {p.photo?<img src={p.photo} style={{width:20,height:20,borderRadius:10,objectFit:"cover"}}/>:<div style={{width:20,height:20,borderRadius:10,background:C.teal,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white"}}>{p.name.charAt(0)}</div>}
            <span style={{fontSize:10,color:C.text}}>{p.name}</span>
          </div>)}
        </div>}
      </div>;
    })}

    {/* Income Milestones */}
    <div style={{fontSize:11,fontWeight:700,color:C.teal,marginBottom:6,textTransform:"uppercase",marginTop:4}}>Income Milestones</div>
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
        <div style={{fontSize:10,color:C.textMid,marginBottom:2}}>{m}</div>
        <input placeholder="Names (comma separated)..." value={form.milestones[m]||""} onChange={e=>setForm(f=>({...f,milestones:{...f.milestones,[m]:e.target.value}}))} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,fontSize:12,color:C.text,boxSizing:"border-box",marginBottom:previews.length>0?4:0}}/>
        {previews.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {previews.map((p,pi)=><div key={pi} style={{display:"flex",alignItems:"center",gap:4,background:"#064e3b22",borderRadius:6,padding:"2px 6px",border:"1px solid #34d39944"}}>
            {p.photo?<img src={p.photo} style={{width:20,height:20,borderRadius:10,objectFit:"cover"}}/>:<div style={{width:20,height:20,borderRadius:10,background:"#059669",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white"}}>{p.name.charAt(0)}</div>}
            <span style={{fontSize:10,color:"#059669",fontWeight:600}}>{p.name}</span>
          </div>)}
        </div>}
      </div>;
    })}

    {/* Custom Shoutout */}
    <div style={{fontSize:11,fontWeight:700,color:C.teal,marginBottom:6,textTransform:"uppercase",marginTop:4}}>Special Shoutouts</div>
    <textarea placeholder="Any additional shoutouts or notes..." value={form.customShoutout} onChange={e=>setForm(f=>({...f,customShoutout:e.target.value}))} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text,resize:"vertical",minHeight:60,boxSizing:"border-box",lineHeight:1.5,marginBottom:12}}/>

    {/* Generate buttons */}
    <div style={{display:"flex",gap:8}}>
      <button onClick={()=>generateHTML(form)} style={{flex:1,padding:"10px",borderRadius:8,background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:700}}>📄 Generate PDF Version</button>
      <button onClick={()=>generateSlideshow(form)} style={{flex:1,padding:"10px",borderRadius:8,background:"linear-gradient(135deg,"+C.gold+",#d97706)",color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:700}}>📊 View as Slideshow</button>
    </div>
    <div style={{fontSize:10,color:C.textMid,textAlign:"center",marginTop:6}}>PowerPoint can be uploaded to Google Drive and opened as Google Slides</div>
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
        <div style={{fontSize:12,color:C.textMid,marginBottom:14,lineHeight:1.5}}>Tell us what you need help with and your trainer and admin will be notified right away.</div>
        <textarea placeholder="What do you need help with? Give us a quick summary..." value={msg} onChange={e=>setMsg(e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1px solid "+C.border,fontSize:13,color:C.text,resize:"vertical",minHeight:90,boxSizing:"border-box",lineHeight:1.5,fontFamily:"inherit",marginBottom:10}}/>
        <div style={{background:C.teal+"11",border:"1px solid "+C.teal+"33",borderRadius:8,padding:"8px 12px",fontSize:11,color:C.teal,marginBottom:14,lineHeight:1.5}}>
          For a quicker response, reach out to your trainer directly on <strong>Telegram</strong>!
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"9px",borderRadius:8,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:12,color:C.textMid}}>Cancel</button>
          <button onClick={send} style={{flex:2,padding:"9px",borderRadius:8,border:"none",background:"linear-gradient(135deg,"+C.teal+",#0891b2)",color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>Send</button>
        </div>
      </>:<>
        <div style={{textAlign:"center",padding:"12px 0"}}>
          <div style={{fontSize:32,marginBottom:10}}>✓</div>
          <div style={{fontSize:15,fontWeight:700,color:C.success,marginBottom:6}}>Message Sent!</div>
          <div style={{fontSize:12,color:C.textMid,marginBottom:6,lineHeight:1.5}}>Your trainer and admin have been notified. We will be in touch soon!</div>
          <div style={{fontSize:11,color:C.teal,fontWeight:600,marginBottom:16}}>Remember — Telegram is available for a quicker response!</div>
          <button onClick={onClose} style={{padding:"9px 24px",borderRadius:8,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:700}}>Done</button>
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
      <div style={{fontSize:13,fontWeight:700,color:C.text}}>Help Requests ({myRequests.length})</div>
    </div>
    {myRequests.map((r,i)=><div key={i} style={{background:C.danger+"08",borderRadius:8,padding:"10px 12px",marginBottom:6,border:"1px solid "+C.danger+"22"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
            <span style={{fontSize:13,fontWeight:700,color:C.text}}>{r.repName}</span>
            <Badge color={C.danger} small>Needs Help</Badge>
          </div>
          <div style={{fontSize:12,color:C.text,lineHeight:1.5,marginBottom:3}}>"{r.message}"</div>
          <div style={{fontSize:10,color:C.textLight}}>{new Date(r.sentAt).toLocaleDateString()} at {new Date(r.sentAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
        </div>
        <button onClick={()=>dismiss(i)} style={{fontSize:10,padding:"4px 8px",borderRadius:6,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid,whiteSpace:"nowrap",flexShrink:0}}>Dismiss</button>
      </div>
    </div>)}
  </div>;
}


// ── WALL OF FAME ──
const FAME_CATEGORIES = ["First Life App","Licensed!","Top Producer","Field Trainer Approved","Recruiter of the Month","Most Improved","Going Above and Beyond","Custom"];
const FAME_COLORS = {"First Life App":C.teal,"Licensed!":C.gold,"Top Producer":C.success,"Field Trainer Approved":C.purple,"Recruiter of the Month":C.teal,"Most Improved":C.gold,"Going Above and Beyond":C.success,"Custom":C.textMid};

function WallOfFame({data,onUpdate,userRole}) {
  const isAdmin = userRole==="admin"||userRole==="superadmin";
  const recognitions = data.wallOfFame||[];
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
    onUpdate({...newData,wallOfFame:[entry,...recognitions]});
    setForm({personId:"",category:"First Life App",message:"",customPhoto:null});
    setPersonSearch("");
    setShowForm(false);
  };

  const remove = (id) => onUpdate({...data,wallOfFame:recognitions.filter(r=>r.id!==id)});

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div>
        <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text}}>Wall of Fame</div>
        <div style={{fontSize:11,color:C.textMid}}>Celebrating our team's achievements</div>
      </div>
      {isAdmin&&<button onClick={()=>setShowForm(!showForm)} style={{fontSize:11,padding:"6px 12px",borderRadius:8,border:"none",background:C.gold,color:"white",cursor:"pointer",fontWeight:700}}>+ Add Recognition</button>}
    </div>

    {isAdmin&&showForm&&<Card style={{marginBottom:14,border:"1px solid "+C.gold+"44"}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>New Recognition</div>
      <div style={{marginBottom:8,position:"relative"}}>
        <div style={{fontSize:11,color:C.textMid,marginBottom:3}}>Select Person</div>
        {form.personId?(
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,border:"1px solid "+C.teal,background:C.teal+"11"}}>
            {(()=>{const p=getPhoto(form.personId);return p?<img src={p} style={{width:32,height:32,borderRadius:"50%",objectFit:"cover",border:"2px solid "+C.teal}}/>:<div style={{width:32,height:32,borderRadius:"50%",background:C.teal+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.teal}}>{allPeople.find(p=>p.id===form.personId)?.name?.charAt(0)}</div>;})()}
            <span style={{flex:1,fontSize:12,fontWeight:600,color:C.text}}>{allPeople.find(p=>p.id===form.personId)?.name}</span>
            <button onClick={()=>{setForm({...form,personId:""});setPersonSearch("");}} style={{fontSize:11,color:C.danger,background:"none",border:"none",cursor:"pointer"}}>✕ Change</button>
          </div>
        ):(
          <div>
            <input
              placeholder="Search name..."
              value={personSearch}
              onChange={e=>{setPersonSearch(e.target.value);setShowPersonList(true);}}
              onFocus={()=>setShowPersonList(true)}
              style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:12,color:C.text,boxSizing:"border-box"}}
            />
            {showPersonList&&(personSearch.length>0||true)&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:"white",border:"1px solid "+C.border,borderRadius:8,boxShadow:"0 4px 12px rgba(0,0,0,0.1)",zIndex:100,maxHeight:200,overflowY:"auto"}}>
              {filteredPeople.length===0&&<div style={{padding:"10px",fontSize:12,color:C.textLight,textAlign:"center"}}>No results</div>}
              {filteredPeople.map(p=><button key={p.id} onClick={()=>{setForm({...form,personId:p.id});setPersonSearch("");setShowPersonList(false);}} style={{width:"100%",padding:"8px 12px",background:"white",border:"none",borderBottom:"1px solid "+C.border,cursor:"pointer",textAlign:"left",fontSize:12,color:C.text}}>
                <span style={{fontWeight:600}}>{p.name}</span>
                <span style={{fontSize:10,color:C.textMid,marginLeft:6}}>({p.role})</span>
              </button>)}
            </div>}
          </div>
        )}
      </div>
      <div style={{marginBottom:8}}>
        <div style={{fontSize:11,color:C.textMid,marginBottom:3}}>Category</div>
        <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:12,color:C.text}}>
          {FAME_CATEGORIES.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,color:C.textMid,marginBottom:3}}>Personal Message</div>
        <textarea placeholder="Write a personal recognition message..." value={form.message} onChange={e=>setForm({...form,message:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:12,color:C.text,resize:"vertical",minHeight:70,boxSizing:"border-box",lineHeight:1.5}}/>
      </div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,color:C.textMid,marginBottom:6}}>Photo</div>
        {form.personId&&(()=>{const autoPhoto=getPhoto(form.personId);return autoPhoto?<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"7px 10px",background:C.success+"11",borderRadius:8,border:"1px solid "+C.success+"33"}}>
          <img src={form.customPhoto||autoPhoto} style={{width:36,height:36,borderRadius:8,objectFit:"cover",border:"2px solid "+C.success}}/>
          <div style={{fontSize:11,color:C.success,fontWeight:600}}>Photo found automatically</div>
          {form.customPhoto&&<button onClick={()=>setForm({...form,customPhoto:null})} style={{fontSize:10,color:C.textMid,background:"none",border:"none",cursor:"pointer",marginLeft:"auto"}}>Use auto</button>}
        </div>:null;})()}
        <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:7,background:C.surface,border:"1px solid "+C.border,cursor:"pointer",fontSize:11,color:C.textMid}}>
          {form.customPhoto?"Change Photo":"Upload Custom Photo"}
          <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
            const file=e.target.files[0];
            if(!file) return;
            compressImage(file, compressed=>setForm({...form,customPhoto:compressed}), 400, 0.8);
          }}/>
        </label>
        {form.customPhoto&&<span style={{fontSize:10,color:C.success,marginLeft:8}}>Custom photo ready</span>}
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:12,color:C.textMid}}>Cancel</button>
        <button onClick={save} style={{flex:2,padding:"8px",borderRadius:8,border:"none",background:C.gold,color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>Post Recognition</button>
      </div>
    </Card>}

    {recognitions.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:C.textLight}}>
      <div style={{fontSize:32,marginBottom:10}}>★</div>
      <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:6}}>No recognitions yet</div>
      <div style={{fontSize:12}}>{isAdmin?"Add your first recognition above!":"Check back soon — great things are coming!"}</div>
    </div>}

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      {recognitions.map((r,i)=>{
        const photo = r.customPhoto||(data.wofPhotos||{})[r.personId]||(data.profilePhotos||{})[r.personId]||(()=>{try{return localStorage.getItem("profilePhoto_"+r.personId)||null;}catch(e){return null;}})()
          ||(data.reps||[]).find(rp=>rp.id===r.personId)?.dgoPhoto
          ||(()=>{try{return localStorage.getItem("dgoPhoto_"+r.personId)||null;}catch(e){return null;}})();
        const catColor = FAME_COLORS[r.category]||C.gold;
        return <div key={i} style={{borderRadius:12,border:"2px solid "+catColor+"33",background:"white",overflow:"hidden",position:"relative"}}>
          {isAdmin&&<button onClick={()=>remove(r.id)} style={{position:"absolute",top:6,right:6,width:20,height:20,borderRadius:10,background:"rgba(0,0,0,0.15)",color:"white",border:"none",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1}}>x</button>}
          {/* Photo/Avatar */}
          <div style={{background:"linear-gradient(135deg,"+catColor+"33,"+catColor+"11)",padding:"16px 16px 8px",textAlign:"center"}}>
            {(r.customPhoto||photo)?<img src={r.customPhoto||photo} alt={r.personName} style={{width:64,height:64,borderRadius:32,objectFit:"cover",border:"3px solid "+catColor,margin:"0 auto"}}/>:
            <div style={{width:64,height:64,borderRadius:32,background:catColor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"white",margin:"0 auto",border:"3px solid "+catColor+"66"}}>{r.personName?.charAt(0)?.toUpperCase()}</div>}
          </div>
          {/* Content */}
          <div style={{padding:"8px 12px 12px"}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,textAlign:"center",marginBottom:4}}>{r.personName}</div>
            <div style={{textAlign:"center",marginBottom:6}}><Badge color={catColor} small>{r.category}</Badge></div>
            <div style={{fontSize:11,color:C.textMid,lineHeight:1.5,textAlign:"center",fontStyle:"italic"}}>"{r.message}"</div>
            <div style={{fontSize:9,color:C.textLight,textAlign:"center",marginTop:6}}>{new Date(r.postedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
          </div>
        </div>;
      })}
    </div>
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
      <div style={{fontSize:13,fontWeight:700,color:C.text}}>Team Goals <span style={{fontSize:11,color:C.textLight,fontWeight:400}}>({teams.length} team{teams.length!==1?"s":""}, {goals.length} goal{goals.length!==1?"s":""})</span></div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {isAdmin&&open&&<div style={{display:"flex",gap:5}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>setShowAddTeam(!showAddTeam)} style={{fontSize:10,padding:"4px 8px",borderRadius:6,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>+ Team</button>
          <button onClick={()=>setShowForm(!showForm)} style={{fontSize:10,padding:"4px 9px",borderRadius:6,border:"none",background:C.gold,color:"white",cursor:"pointer",fontWeight:600}}>+ Goal</button>
        </div>}
        <span style={{fontSize:14,color:C.textLight,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>v</span>
      </div>
    </div>

    {open&&<div>
      {/* Add team form */}
      {isAdmin&&showAddTeam&&<div style={{background:"white",borderRadius:8,padding:10,marginBottom:10,border:"1px solid "+C.border,display:"flex",gap:6}}>
        <input placeholder="New team name..." value={newTeamName} onChange={e=>setNewTeamName(e.target.value)} style={{flex:1,padding:"6px 9px",borderRadius:6,border:"1px solid "+C.border,fontSize:12,color:C.text}}/>
        <button onClick={addTeam} style={{padding:"6px 12px",borderRadius:6,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:11,fontWeight:600}}>Add</button>
        <button onClick={()=>setShowAddTeam(false)} style={{padding:"6px 9px",borderRadius:6,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:11,color:C.textMid}}>x</button>
      </div>}

      {/* Add goal form */}
      {isAdmin&&showForm&&<div style={{background:"white",borderRadius:9,padding:12,marginBottom:10,border:"1px solid "+C.gold+"44"}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:10}}>New Goal</div>
        <div style={{marginBottom:7}}>
          <div style={{fontSize:10,color:C.textMid,marginBottom:3}}>Team</div>
          <select value={form.team} onChange={e=>setForm({...form,team:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text}}>
            {teams.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <input placeholder="Goal title (e.g. May Life Apps Goal)" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text,marginBottom:7,boxSizing:"border-box"}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
          <div>
            <div style={{fontSize:10,color:C.textMid,marginBottom:3}}>Target</div>
            <input type="number" value={form.target} onChange={e=>setForm({...form,target:Number(e.target.value)})} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text,boxSizing:"border-box"}}/>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMid,marginBottom:3}}>Unit</div>
            <select value={["Life Apps","Recruits","Licensed Agents","Appointments","Contacts"].includes(form.unit)?form.unit:"Custom"} onChange={e=>setForm({...form,unit:e.target.value==="Custom"?"":e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text}}>
              {["Life Apps","Recruits","Licensed Agents","Appointments","Contacts","Custom"].map(u=><option key={u}>{u}</option>)}
            </select>
            {!["Life Apps","Recruits","Licensed Agents","Appointments","Contacts"].includes(form.unit)&&<input placeholder="Custom unit..." value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} style={{width:"100%",padding:"5px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:11,color:C.text,marginTop:4,boxSizing:"border-box"}}/>}
          </div>
        </div>
        <div style={{marginBottom:8}}>
          <div style={{fontSize:10,color:C.textMid,marginBottom:3}}>Deadline (optional)</div>
          <input type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text,boxSizing:"border-box"}}/>
        </div>
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"7px",borderRadius:7,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:11,color:C.textMid}}>Cancel</button>
          <button onClick={save} style={{flex:2,padding:"7px",borderRadius:7,border:"none",background:C.gold,color:"white",cursor:"pointer",fontSize:11,fontWeight:600}}>Save Goal</button>
        </div>
      </div>}

      {/* Team cards — horizontal scrollable */}
      {goals.length===0&&isAdmin&&<div style={{fontSize:11,color:C.textLight,textAlign:"center",padding:"12px 0",background:"white",borderRadius:8,border:"1px solid "+C.border}}>No goals yet — click + Goal above to add your first!</div>}
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
                <div style={{fontSize:12,fontWeight:700,color:"white"}}>{team}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>{teamGoals.length} goal{teamGoals.length!==1?"s":""} • {teamTotal}% avg</div>
              </div>
              <span style={{color:"rgba(255,255,255,0.5)",fontSize:13,transform:collapsed?"none":"rotate(180deg)",transition:"transform 0.2s",display:"inline-block"}}>v</span>
            </div>
            {/* Team goals */}
            {!collapsed&&<div style={{padding:"10px 12px"}}>
              {teamGoals.length===0&&<div style={{fontSize:11,color:C.textLight,textAlign:"center",padding:"8px 0"}}>No goals yet</div>}
              {teamGoals.map(g=>{
                const pct=Math.min(Math.round((g.current/g.target)*100),100);
                const daysLeft=g.deadline?Math.ceil((new Date(g.deadline+"T12:00:00")-new Date())/86400000):null;
                return <div key={g.id} style={{marginBottom:10,paddingBottom:10,borderBottom:"1px solid "+C.border}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.text,flex:1,paddingRight:6}}>{g.title}</div>
                    <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                      {daysLeft!==null&&<span style={{fontSize:9,color:daysLeft<=7?C.danger:C.textLight}}>{daysLeft<=0?"Past":daysLeft+"d"}</span>}
                      {isAdmin&&<button onClick={()=>removeGoal(g.id)} style={{fontSize:11,color:C.danger,background:"none",border:"none",cursor:"pointer",padding:"0 2px"}}>x</button>}
                    </div>
                  </div>
                  <Bar pct={pct} color={pct>=100?C.success:C.gold} h={5}/>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                    <span style={{fontSize:10,color:C.textMid}}>{g.current}/{g.target} {g.unit}</span>
                    <span style={{fontSize:10,fontWeight:700,color:pct>=100?C.success:C.gold}}>{pct}%</span>
                  </div>
                  {isAdmin&&<div style={{display:"flex",gap:4,marginTop:6,alignItems:"center"}}>
                    <button onClick={()=>updateCurrent(g.id,Math.max(0,g.current-1))} style={{width:24,height:24,borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:14,fontWeight:700,color:C.textMid}}>-</button>
                    <span style={{fontSize:11,fontWeight:600,color:C.text,flex:1,textAlign:"center"}}>{g.current}</span>
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
      <div><div style={{fontSize:dv(17,22),fontWeight:700,color:C.text}}>Quick Messages</div><div style={{fontSize:11,color:C.textMid}}>Copy and paste to send via text</div></div>
      {isAdmin&&<div style={{display:"flex",gap:6}}>
        <button onClick={reset} style={{fontSize:10,padding:"4px 8px",borderRadius:6,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>Reset</button>
        <button onClick={()=>setShowAdd(!showAdd)} style={{fontSize:11,padding:"5px 10px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>+ Add</button>
      </div>}
    </div>
    <div style={{background:C.teal+"11",border:"1px solid "+C.teal+"33",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:C.teal}}>
      Tap <strong>Copy</strong> on any message, then paste it into a text message on your phone. Replace [name] with the person's name before sending!
    </div>
    {isAdmin&&showAdd&&<Card style={{marginBottom:12,border:"1px solid "+C.teal+"44"}}>
      <select value={form.cat} onChange={e=>setForm({...form,cat:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text,marginBottom:7}}>
        {["Encouragement","Accountability","Recognition","Invitation","Welcome"].map(c=><option key={c}>{c}</option>)}
      </select>
      <textarea placeholder="Message text..." value={form.msg} onChange={e=>setForm({...form,msg:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text,resize:"vertical",minHeight:70,boxSizing:"border-box",lineHeight:1.5,marginBottom:7}}/>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>setShowAdd(false)} style={{flex:1,padding:"6px",borderRadius:7,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:11,color:C.textMid}}>Cancel</button>
        <button onClick={add} style={{flex:2,padding:"6px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:11,fontWeight:600}}>Save</button>
      </div>
    </Card>}
    <div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:12,paddingBottom:2}}>
      {cats.map(c=><button key={c} onClick={()=>setFilter(c)} style={{padding:"4px 10px",borderRadius:7,border:"none",cursor:"pointer",whiteSpace:"nowrap",fontSize:11,fontWeight:filter===c?600:400,background:filter===c?C.navy:C.surface,color:filter===c?"white":C.textMid}}>{c}</button>)}
    </div>
    {[...new Set(filtered.map(t=>t.cat))].map(cat=><div key={cat}>
      <SecHead title={cat} color={catColors[cat]||C.teal}/>
      {filtered.filter(t=>t.cat===cat).map((t,i)=>{
        const realIdx=templates.indexOf(t);
        return <div key={i} style={{borderRadius:8,border:"1px solid "+C.border,padding:"10px 12px",marginBottom:7,background:"white"}}>
          <div style={{fontSize:12,color:C.text,lineHeight:1.5,marginBottom:8}}>{t.msg}</div>
          <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
            {isAdmin&&<button onClick={()=>del(realIdx)} style={{fontSize:10,padding:"3px 7px",borderRadius:5,border:"1px solid "+C.danger+"33",background:C.danger+"11",cursor:"pointer",color:C.danger}}>Delete</button>}
            <button onClick={()=>copy(t.msg,realIdx)} style={{fontSize:11,padding:"4px 12px",borderRadius:6,border:"none",background:copied===realIdx?C.success:C.teal,color:"white",cursor:"pointer",fontWeight:600,transition:"background 0.2s"}}>{copied===realIdx?"Copied!":"Copy"}</button>
          </div>
        </div>;
      })}
    </div>)}
  </div>;
}


// ── INVESTMENT LOG ──
function RepInvestmentEntry({rep,onUpdate}) {
  const [show,setShow] = useState(false);
  const [form,setForm] = useState({clientName:"",pac:"",lumpSum:"",type:"Mutual Fund",date:new Date().toISOString().split("T")[0]});
  const entries = rep.investments||[];
  const totPAC = entries.reduce((s,e)=>s+(Number(e.pac)||0),0);
  const totLump = entries.reduce((s,e)=>s+(Number(e.lumpSum)||0),0);

  const save = () => {
    if(!form.clientName) return;
    onUpdate({...rep,investments:[...entries,{...form,id:Date.now()}]});
    setForm({clientName:"",pac:"",lumpSum:"",type:"Mutual Fund",date:new Date().toISOString().split("T")[0]});
    setShow(false);
  };

  return <Card style={{marginBottom:12,border:"1px solid "+C.purple+"33"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <div>
        <div style={{fontSize:12,fontWeight:700,color:C.text}}>My Investments</div>
        <div style={{fontSize:11,color:C.textMid}}>PAC: <span style={{color:C.purple,fontWeight:700}}>${totPAC.toLocaleString()}/mo</span> &nbsp;|&nbsp; Lump Sum: <span style={{color:C.gold,fontWeight:700}}>${totLump.toLocaleString()}</span></div>
      </div>
      <button onClick={()=>setShow(!show)} style={{fontSize:11,padding:"4px 10px",borderRadius:7,border:"none",background:C.purple,color:"white",cursor:"pointer",fontWeight:600}}>+ Log</button>
    </div>
    {show&&<div style={{background:C.surface,borderRadius:8,padding:9,marginBottom:8}}>
      <input placeholder="Client name" value={form.clientName} onChange={e=>setForm({...form,clientName:e.target.value})} style={{width:"100%",padding:"6px 9px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text,marginBottom:6,boxSizing:"border-box"}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
        <input type="number" placeholder="Monthly PAC $" value={form.pac} onChange={e=>setForm({...form,pac:e.target.value})} style={{padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text,boxSizing:"border-box"}}/>
        <input type="number" placeholder="Lump Sum $" value={form.lumpSum} onChange={e=>setForm({...form,lumpSum:e.target.value})} style={{padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text,boxSizing:"border-box"}}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
        <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} style={{padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text}}>
          {["Mutual Fund","IBA","Fixed Annuity","Indexed Annuity","Other"].map(t=><option key={t}>{t}</option>)}
        </select>
        <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={{padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text,boxSizing:"border-box"}}/>
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setShow(false)} style={{flex:1,padding:"6px",borderRadius:7,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:11,color:C.textMid}}>Cancel</button>
        <button onClick={save} style={{flex:2,padding:"6px",borderRadius:7,border:"none",background:C.purple,color:"white",cursor:"pointer",fontSize:11,fontWeight:600}}>Save</button>
      </div>
    </div>}
    {entries.length>0&&<div style={{maxHeight:140,overflowY:"auto",marginTop:6}}>
      {entries.slice().reverse().map((e,i)=>{
        const realIdx=entries.length-1-i;
        return <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:"1px solid "+C.border,fontSize:11}}>
          <span style={{color:C.text,flex:1}}>{e.clientName}</span>
          <span style={{color:C.textMid,fontSize:10,marginRight:6}}>{e.type}</span>
          <div style={{textAlign:"right",marginRight:8}}>
            {e.pac&&<div style={{color:C.purple,fontWeight:600}}>${e.pac}/mo</div>}
            {e.lumpSum&&<div style={{color:C.gold,fontWeight:600}}>${e.lumpSum}</div>}
          </div>
          <button onClick={()=>onUpdate({...rep,investments:entries.filter((_,j)=>j!==realIdx)})} style={{fontSize:10,color:C.danger,background:"none",border:"none",cursor:"pointer",padding:"0 2px"}}>x</button>
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
      <div style={{fontSize:13,fontWeight:700,color:C.text}}>Investment Log ({allLogs.length})</div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:11,color:C.gold,fontWeight:600}}>${total.toLocaleString()} total</span>
        <button onClick={e=>{e.stopPropagation();if(window.confirm("Clear all investment logs? This cannot be undone."))onUpdate({...data,investmentLogs:{}});}} style={{fontSize:10,padding:"3px 8px",borderRadius:5,background:C.danger+"11",color:C.danger,border:"1px solid "+C.danger+"33",cursor:"pointer"}}>Clear All</button>
        <span style={{fontSize:14,color:C.textLight,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>v</span>
      </div>
    </div>
    {open&&<div style={{marginTop:10}}>
      {allLogs.map((e,i)=><div key={i} style={{padding:"7px 0",borderBottom:"1px solid "+C.border,display:"flex",gap:10,alignItems:"center"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:12,fontWeight:600,color:C.text}}>{e.clientName}</div>
          <div style={{fontSize:10,color:C.textMid}}>{e.repName} • {e.type} • {new Date(e.date).toLocaleDateString()}</div>
        </div>
        <div style={{textAlign:"right",fontSize:11,color:C.gold,fontWeight:600}}>
          {e.pac&&<div>PAC: ${e.pac}</div>}
          {e.lumpSum&&<div>Lump: ${e.lumpSum}</div>}
        </div>
      </div>)}
    </div>}
  </Card>;
}


// ── LICENSED PREMIUM ENTRY ──
function LicensedPremiumEntry({rep,onUpdate}) {
  const [form,setForm] = useState({client:"",premium:"",date:new Date().toISOString().split("T")[0]});
  const [show,setShow] = useState(false);
  const entries = rep.selfPremium||[];
  const total = entries.reduce((s,e)=>s+(Number(e.premium)||0),0);

  const save = () => {
    if(!form.client||!form.premium) return;
    onUpdate({...rep,selfPremium:[...entries,{...form,id:Date.now()}]});
    setForm({client:"",premium:"",date:new Date().toISOString().split("T")[0]});
    setShow(false);
  };

  return <Card style={{marginBottom:12,border:"1px solid "+C.teal+"33"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <div><div style={{fontSize:12,fontWeight:700,color:C.text}}>My Premium</div><div style={{fontSize:11,color:C.textMid}}>Running total: <span style={{color:C.teal,fontWeight:700}}>${total.toFixed(0)}/mo</span></div></div>
      <button onClick={()=>setShow(!show)} style={{fontSize:11,padding:"4px 10px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>+ Log</button>
    </div>
    {show&&<div style={{background:C.surface,borderRadius:8,padding:9,marginBottom:8}}>
      <input placeholder="Client name" value={form.client} onChange={e=>setForm({...form,client:e.target.value})} style={{width:"100%",padding:"6px 9px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text,marginBottom:6,boxSizing:"border-box"}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
        <input type="number" placeholder="Monthly premium $" value={form.premium} onChange={e=>setForm({...form,premium:e.target.value})} style={{padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text,boxSizing:"border-box"}}/>
        <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={{padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text,boxSizing:"border-box"}}/>
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setShow(false)} style={{flex:1,padding:"6px",borderRadius:7,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:11,color:C.textMid}}>Cancel</button>
        <button onClick={save} style={{flex:2,padding:"6px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:11,fontWeight:600}}>Save</button>
      </div>
    </div>}
    {entries.length>0&&<div style={{maxHeight:140,overflowY:"auto",marginTop:6}}>
      {entries.slice().reverse().map((e,i)=>{
        const realIdx=entries.length-1-i;
        return <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:"1px solid "+C.border,fontSize:11}}>
          <span style={{color:C.text,flex:1}}>{e.client}</span>
          <span style={{color:C.teal,fontWeight:600,marginRight:8}}>${e.premium}/mo</span>
          <button onClick={()=>onUpdate({...rep,selfPremium:entries.filter((_,j)=>j!==realIdx)})} style={{fontSize:10,color:C.danger,background:"none",border:"none",cursor:"pointer",padding:"0 2px"}}>x</button>
        </div>;
      })}
    </div>}
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
      {allLogs.length>0&&<button onClick={clearAll} style={{fontSize:11,padding:"5px 10px",borderRadius:7,background:C.danger+"11",color:C.danger,border:"1px solid "+C.danger+"33",cursor:"pointer",fontWeight:600}}>Clear All</button>}
    </div>
    <div style={{fontSize:12,color:C.textMid,marginBottom:14}}>All investment observation entries logged by reps.</div>
    {allLogs.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:C.textLight}}>No investment observations logged yet</div>}
    {allLogs.map((e,i)=><Card key={i} style={{marginBottom:8,padding:"10px 12px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:C.text}}>{e.clientName}</div>
          <div style={{fontSize:11,color:C.textMid}}>{e.repName} — {new Date(e.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
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
    {entries.slice().reverse().slice(0,5).map((e,i)=><div key={i} style={{fontSize:10,color:C.textMid,padding:"2px 0",borderBottom:"1px solid "+C.border}}>{e.clientName} — {new Date(e.date).toLocaleDateString()}</div>)}
  </div>;
}




// ── BIRTHDAY & ANNIVERSARY TRACKER ──
function BirthdayAnniversaryWidget({data}) {
  const reps = data.reps||[];
  const today = new Date();
  const upcoming = [];
  reps.forEach(rep => {
    if(rep.birthday) {
      try {
        const d = new Date(rep.birthday+"T12:00:00");
        const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());
        const diff = Math.ceil((thisYear - today)/(1000*60*60*24));
        const days = diff < 0 ? diff + 365 : diff;
        const age = today.getFullYear() - d.getFullYear() + (diff < 0 ? 1 : 0);
        if(days <= 30) upcoming.push({name:rep.name, type:"Birthday (turning "+age+")", days, date:thisYear});
      } catch(e) {}
    }
  });
  upcoming.sort((a,b)=>a.days-b.days);
  if(upcoming.length===0) return null;
  return <Card style={{marginBottom:14}}>
    <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>Upcoming Birthdays</div>
    {upcoming.map((item,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:i<upcoming.length-1?`1px solid ${C.border}`:"none"}}>
      <div style={{width:32,height:32,borderRadius:8,background:C.purple+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.purple,flexShrink:0}}>BD</div>
      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:C.text}}>{item.name}</div><div style={{fontSize:11,color:C.textMid}}>{item.type} on {item.date.toLocaleDateString("en-US",{month:"long",day:"numeric"})}</div></div>
      <div>{item.days===0?<Badge color={C.success} small>Today!</Badge>:item.days===1?<Badge color={C.gold} small>Tomorrow</Badge>:<Badge color={C.teal} small>{"In "+item.days+"d"}</Badge>}</div>
    </div>)}
  </Card>;
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
      <div style={{fontSize:13,fontWeight:700,color:C.text,flex:1}}>Activity Alerts ({visible_alerts.length})</div>
      <button onClick={clearAll} style={{fontSize:10,padding:"3px 8px",borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>Clear All</button>
    </div>
    {visible.map((a,i)=>(
      <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:i<visible.length-1?`1px solid ${C.border}`:"none"}}>
        <div style={{width:6,height:6,borderRadius:3,background:a.color,flexShrink:0}}/>
        <span style={{fontSize:12,fontWeight:600,color:C.text,flex:1}}>{a.name}</span>
        <span style={{fontSize:11,color:a.color,fontWeight:500,flex:1}}>{a.msg}</span>
        <button onClick={()=>dismiss(a.key)} style={{fontSize:10,padding:"2px 6px",borderRadius:4,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid,flexShrink:0}}>Dismiss</button>
      </div>
    ))}
    {visible_alerts.length>5&&<button onClick={()=>setShowAll(!showAll)} style={{width:"100%",marginTop:8,padding:"5px",borderRadius:7,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:11,color:C.textMid}}>{showAll?"Show Less":"Show All "+visible_alerts.length+" Alerts"}</button>}
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
      <div style={{fontSize:13,fontWeight:700,color:C.text}}>Production History</div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <span style={{fontSize:11,color:C.textLight}}>{history.length} months archived</span>
        <span style={{fontSize:14,color:C.textLight,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>v</span>
      </div>
    </div>
    {open&&<div style={{marginTop:12}}>
      <button onClick={archiveMonth} style={{width:"100%",padding:"8px",borderRadius:8,background:C.navy,color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,marginBottom:12}}>
        Archive {currentMonth} and Reset
      </button>
      {history.length===0&&<div style={{color:C.textLight,fontSize:12,textAlign:"center",padding:"8px 0"}}>No months archived yet</div>}
      {history.slice().reverse().map((h,i)=><div key={i} style={{padding:"8px 10px",borderRadius:8,background:C.surface,marginBottom:6}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <span style={{fontSize:12,fontWeight:700,color:C.text}}>{h.month}</span>
          <Badge color={C.teal} small>${Math.round(h.annualPremium).toLocaleString()}/yr</Badge>
        </div>
        <div style={{display:"flex",gap:12,fontSize:11,color:C.textMid}}>
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
      <div style={{fontSize:13,fontWeight:700,color:C.text}}>Team Leaderboard</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:11,color:C.textLight}}>{ranked.length} members</span>
        <span style={{fontSize:14,color:C.textLight,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>v</span>
      </div>
    </div>
    {open&&<div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
      {[["scorecard","Scorecard"],["lifeapps","Life Apps"],["appts","Appts"],["recruits","Recruits"]].map(([k,l])=>(
        <button key={k} onClick={e=>{e.stopPropagation();setMode(k);}} style={{fontSize:10,padding:"3px 8px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:mode===k?700:400,background:mode===k?C.navy:C.surface,color:mode===k?"white":C.textMid}}>{l}</button>
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
        <div style={{width:28,height:28,borderRadius:8,background:roleColors[u.role]+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:roleColors[u.role],flexShrink:0}}>{u.name?.charAt(0)?.toUpperCase()}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
            <span style={{fontSize:12,fontWeight:isMe?700:500,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}{isMe&&<span style={{fontSize:10,color:C.teal,marginLeft:4}}>(you)</span>}</span>
            <span style={{fontSize:12,fontWeight:700,color:i===0?C.gold:C.text,marginLeft:8,flexShrink:0}}>{val}</span>
          </div>
          <Bar pct={pct} color={i===0?C.gold:i===1?"#94a3b8":i===2?"#b45309":C.teal} h={3}/>
        </div>
      </div>;
    })}
    {open&&ranked.length===0&&<div style={{color:C.textLight,fontSize:12,textAlign:"center",padding:"12px 0"}}>No activity logged yet this week</div>}
  </Card>;
}


// ── TOP RECRUITERS ──
function TopRecruiters({data}) {
  const allPeople = [
    ...(data.admins||[]).map(p=>({...p,role:"Admin"})),
    ...(data.trainers||[]).map(p=>({...p,role:"Trainer"})),
    ...activeReps(data.reps).map(p=>({...p,role:"Rep"})),
  ];
  const recruitCounts = allPeople.map(p=>({
    ...p,
    recruits:(data.reps||[]).filter(r=>r.recruitedBy===p.id),
  })).filter(p=>p.recruits.length>0).sort((a,b)=>b.recruits.length-a.recruits.length);

  if(recruitCounts.length===0) return null;
  const roleColors={Admin:C.teal,Trainer:C.purple,Rep:C.gold};
  const medals=["1st","2nd","3rd"];

  return <Card style={{marginBottom:14}}>
    <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>Top Recruiters</div>
    {recruitCounts.slice(0,5).map((p,i)=><div key={p.id} style={{display:"flex",alignItems:"center",gap:9,marginBottom:8,padding:"7px 9px",borderRadius:8,background:i===0?C.gold+"11":"transparent",border:i===0?`1px solid ${C.gold}33`:"none"}}>
      <div style={{fontSize:i<3?9:11,fontWeight:700,width:28,height:20,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:4,background:i===0?C.gold+"22":i===1?"rgba(148,163,184,0.15)":i===2?"rgba(180,83,9,0.1)":"transparent",color:i===0?C.gold:i===1?"#94a3b8":i===2?"#b45309":C.textLight}}>{i<3?medals[i]:i+1}</div>
      <div style={{width:28,height:28,borderRadius:8,background:roleColors[p.role]+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:roleColors[p.role],flexShrink:0}}>{p.name?.charAt(0)?.toUpperCase()}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name} <span style={{fontSize:10,color:C.textLight}}>({p.role})</span></div>
        <div style={{fontSize:10,color:C.textMid,marginTop:1}}>{p.recruits.map(r=>r.name).join(", ")}</div>
      </div>
      <div style={{textAlign:"center",flexShrink:0}}>
        <div style={{fontSize:18,fontWeight:800,color:i===0?C.gold:C.text}}>{p.recruits.length}</div>
        <div style={{fontSize:9,color:C.textLight}}>recruit{p.recruits.length!==1?"s":""}</div>
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
      <div style={{fontSize:10,fontWeight:700,color:C.textMid,textTransform:"uppercase",letterSpacing:"0.5px"}}>Update Licensed Status ({reps.length} reps)</div>
      <div style={{fontSize:12,color:C.textLight,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>v</div>
    </button>
    {open&&<div style={{marginTop:8}}>
      <input placeholder="Search reps..." value={search} onChange={e=>setSearch(e.target.value)}
        style={{width:"100%",padding:"6px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,marginBottom:8,boxSizing:"border-box"}}/>
      {filtered.length===0&&<div style={{fontSize:11,color:C.textLight,textAlign:"center",padding:"8px 0"}}>No reps found</div>}
      {filtered.map(r=><div key={r.id} style={{display:"flex",alignItems:"center",gap:7,marginBottom:6,padding:"5px 0",borderBottom:`1px solid ${C.border}`}}>
        <span style={{fontSize:12,color:C.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</span>
        <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:C.textMid,cursor:"pointer",whiteSpace:"nowrap"}}>
          <input type="checkbox" checked={!!r.isLicensed} onChange={e=>onUpdateData({...data,reps:data.reps.map(rep=>rep.id===r.id?{...rep,isLicensed:e.target.checked}:rep)})}/> Licensed
        </label>
      </div>)}
    </div>}
  </div>;
}



// ── RECRUITS TAB ──
function RecruitsTab({rep,data,myRecruits,onUpdate}) {
  const [showForm,setShowForm] = useState(false);
  const [form,setForm] = useState({name:"",phone:"",date:new Date().toISOString().split("T")[0]});
  const myLoggedRecruits = rep.myRecruitLog||(()=>{try{const ls=localStorage.getItem("recruitLog_"+rep.id);return ls?JSON.parse(ls):[];}catch(e){return [];}})();

  const addRecruit = () => {
    if(!form.name) return;
    const updated = [...myLoggedRecruits,{...form,addedAt:new Date().toISOString(),id:Date.now()}];
    try{localStorage.setItem("recruitLog_"+rep.id,JSON.stringify(updated));}catch(e){}
    onUpdate(rep.id,{...rep,myRecruitLog:updated});
    setForm({name:"",phone:"",date:new Date().toISOString().split("T")[0]});
    setShowForm(false);
  };

  const removeRecruit = (id) => {
    onUpdate(rep.id,{...rep,myRecruitLog:myLoggedRecruits.filter(r=>r.id!==id)});
  };

  const totalRecruits = myRecruits.length + myLoggedRecruits.length;

  return <div>
    {/* Motivational banner */}
    <div style={{background:"linear-gradient(135deg,"+C.navy+","+C.navyMid+")",borderRadius:12,padding:"14px 16px",marginBottom:14,color:"white",border:"1px solid "+C.teal+"33"}}>
      <div style={{fontSize:11,fontWeight:700,color:C.teal,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:6}}>Build Your Team</div>
      <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",lineHeight:1.6,marginBottom:8}}>Every person you bring in builds your team, your income, and your legacy. <strong style={{color:"white"}}>Your income grows as your team grows.</strong> Stay connected to your recruits — their success is your success!</div>
      <div style={{background:"rgba(255,255,255,0.07)",borderRadius:8,padding:"8px 12px",fontSize:11,color:"rgba(255,255,255,0.7)"}}>Recruiting is a core requirement to become a Field Trainer and RVP. Every conversation is a step toward your goals!</div>
    </div>

    {/* Stats */}
    <Card style={{padding:"12px 14px",marginBottom:14,textAlign:"center"}}>
      <div style={{fontSize:28,fontWeight:800,color:C.teal}}>{totalRecruits}</div>
      <div style={{fontSize:12,color:C.textMid}}>Total People You Have Brought In</div>
    </Card>

    {/* Official recruits - in the system */}
    {myRecruits.length>0&&<div style={{marginBottom:14}}>
      <SecHead title={"In the System ("+myRecruits.length+")"} color={C.teal}/>
      {myRecruits.map((r,i)=>{
        const track=TRACK_INFO[r.track];
        const cl=track?.checklist||[];
        const done=cl.filter(item=>(r.checked||{})[item.id]).length;
        const pct=cl.length>0?Math.round((done/cl.length)*100):0;
        return <div key={i} style={{borderRadius:8,border:"1px solid "+C.border,padding:"10px 12px",marginBottom:7,background:"white"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div><div style={{fontSize:13,fontWeight:700,color:C.text}}>{r.name}</div><div style={{fontSize:11,color:C.textMid}}><PhoneLink phone={r.phone}/></div></div>
            <Badge color={track?.color||C.teal} small>{track?.label}</Badge>
          </div>
          <div style={{fontSize:10,color:C.textMid,marginBottom:3}}>Their progress {pct}%</div>
          <Bar pct={pct} color={track?.color||C.teal} h={4}/>
          {pct===100&&<div style={{marginTop:5,fontSize:10,color:C.success,fontWeight:600}}>Graduated! Great job investing in them!</div>}
        </div>;
      })}
    </div>}

    {/* Personal recruit log */}
    {myLoggedRecruits.length>0&&<div style={{marginBottom:14}}>
      <SecHead title={"My Recruit Log ("+myLoggedRecruits.length+")"} color={C.purple}/>
      {myLoggedRecruits.map((r,i)=><div key={i} style={{borderRadius:8,border:"1px solid "+C.border,padding:"10px 12px",marginBottom:6,background:"white",display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text}}>{r.name}</div>
          <div style={{fontSize:11,color:C.textMid}}>{r.phone&&r.phone+" - "}{r.date&&new Date(r.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
        </div>
        <button onClick={()=>removeRecruit(r.id)} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:16,padding:"0 4px"}}>x</button>
      </div>)}
    </div>}

    {/* Empty state */}
    {totalRecruits===0&&<div style={{textAlign:"center",padding:"20px 0",marginBottom:14}}>
      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>Your team starts with one conversation</div>
      <div style={{fontSize:12,color:C.textMid,lineHeight:1.6,maxWidth:320,margin:"0 auto"}}>Think about who in your life could use more income, financial protection, or a career change. That person is your first recruit. Log them below and reach out today!</div>
    </div>}

    {/* Add recruit button/form */}
    {!showForm?<button onClick={()=>setShowForm(true)} style={{width:"100%",padding:"10px",borderRadius:9,background:"linear-gradient(135deg,"+C.teal+",#0891b2)",color:"white",border:"none",fontWeight:700,fontSize:13,cursor:"pointer"}}>+ Log a New Recruit</button>:
    <Card style={{border:"1px solid "+C.teal+"44"}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>Log a New Recruit</div>
      <div style={{fontSize:11,color:C.textMid,marginBottom:10}}>Track everyone you bring into the opportunity. This is your personal record.</div>
      <input placeholder="Full Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:13,color:C.text,marginBottom:8,boxSizing:"border-box"}}/>
      <input placeholder="Phone Number" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:13,color:C.text,marginBottom:8,boxSizing:"border-box"}}/>
      <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:13,color:C.text,marginBottom:10,boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:12,color:C.textMid}}>Cancel</button>
        <button onClick={addRecruit} style={{flex:2,padding:"8px",borderRadius:8,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>Save Recruit</button>
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
      <div style={{fontSize:11,fontWeight:700,color:C.teal,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:6}}>Who Do You Know?</div>
      <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",lineHeight:1.6,marginBottom:8}}>Answer each question honestly and write down every name that comes to mind. <strong style={{color:"white"}}>Don't overthink it.</strong> These are people who already know and trust you — they deserve to know about this opportunity.</div>
      <div style={{background:"rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"rgba(255,255,255,0.7)"}}>
        {totalProspects===0?"Start with the first section below — it is the most important one.":"You have identified "+totalProspects+" prospect"+(totalProspects!==1?"s":"")+". Keep going!"}
      </div>
    </div>

    {/* Question categories */}
    {PROSPECT_QUESTIONS.map((cat,ci)=><div key={ci} style={{marginBottom:10}}>
      <button onClick={()=>toggleCat(cat.cat)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderRadius:10,background:"white",border:"2px solid "+cat.color+"33",cursor:"pointer",marginBottom:openCats[cat.cat]?0:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:10,height:10,borderRadius:5,background:cat.color,flexShrink:0}}/>
          <span style={{fontSize:13,fontWeight:700,color:C.text}}>{cat.cat}</span>
          {(()=>{const count=cat.questions.reduce((s,q)=>s+(prospects[q.id]||[]).length,0);return count>0?<span style={{fontSize:10,background:cat.color+"22",color:cat.color,padding:"2px 7px",borderRadius:10,fontWeight:600}}>{count} name{count!==1?"s":""}</span>:null;})()}
        </div>
        <span style={{fontSize:14,color:C.textLight,transform:openCats[cat.cat]?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>v</span>
      </button>

      {openCats[cat.cat]&&<div style={{background:"white",borderRadius:"0 0 10px 10px",border:"2px solid "+cat.color+"33",borderTop:"none",padding:"10px 14px"}}>
        {cat.questions.map((q,qi)=><div key={q.id} style={{marginBottom:qi<cat.questions.length-1?14:0,paddingBottom:qi<cat.questions.length-1?14:0,borderBottom:qi<cat.questions.length-1?"1px solid "+C.border:"none"}}>
          <div style={{fontSize:12,color:C.text,lineHeight:1.5,marginBottom:8,fontWeight:500}}>{q.q}</div>
          {/* Existing names */}
          {(prospects[q.id]||[]).length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
            {(prospects[q.id]||[]).map((name,ni)=><div key={ni} style={{display:"flex",alignItems:"center",gap:4,background:cat.color+"15",border:"1px solid "+cat.color+"33",borderRadius:20,padding:"3px 10px"}}>
              <span style={{fontSize:12,color:C.text,fontWeight:500}}>{name}</span>
              <button onClick={()=>removeName(q.id,name)} style={{background:"none",border:"none",cursor:"pointer",color:C.textLight,fontSize:13,lineHeight:1,padding:"0 0 0 2px"}}>×</button>
            </div>)}
          </div>}
          {/* Add name input */}
          <div style={{display:"flex",gap:6}}>
            <input placeholder="Type a name and press Add..." value={inputs[q.id]||""} onChange={e=>setInputs(prev=>({...prev,[q.id]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addName(q.id)} style={{flex:1,padding:"6px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:12,color:C.text}}/>
            <button onClick={()=>addName(q.id)} style={{padding:"6px 12px",borderRadius:8,border:"none",background:cat.color,color:"white",cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>Add</button>
          </div>
        </div>)}
      </div>}
    </div>)}

    {/* Master prospect list */}
    {masterList.length>0&&<div style={{marginTop:16}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>My Prospect List ({masterList.length})</div>
      {masterList.map((item,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 12px",borderRadius:8,background:"white",border:"1px solid "+C.border,marginBottom:6}}>
        <div style={{width:8,height:8,borderRadius:4,background:item.color,flexShrink:0,marginTop:4}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text}}>{item.name}</div>
          <div style={{fontSize:10,color:C.textLight,lineHeight:1.4,marginTop:2}}>{item.question}</div>
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
    <div style={{fontSize:12,color:C.textMid,marginBottom:14}}>Your personal prospect list — separate from your reps' lists.</div>
    <ProspectsTab rep={rep} onUpdate={updateProspects}/>
  </div>;
}


// ── LEAD LINK PAGE (sidebar) ──
function LeadLinkPage({session,data}) {
  return <div>
    <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:4}}>My Lead Link</div>
    <div style={{fontSize:12,color:C.textMid,marginBottom:16}}>Your personal MoneyMap link. Share it with anyone to start a financial conversation.</div>
    <MyLeadLink name={session.name} data={data}/>
    <Card>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8}}>How to use your link</div>
      {[
        {step:"1",text:"Copy your personal link above"},
        {step:"2",text:"Share it via text, email, social media, or in person"},
        {step:"3",text:"Your prospect clicks the link and completes their MoneyMap"},
        {step:"4",text:"Follow up with them to review their results and set an appointment"},
      ].map((item,i)=><div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:i<3?"1px solid "+C.border:"none",alignItems:"flex-start"}}>
        <div style={{width:22,height:22,borderRadius:11,background:C.teal+"22",border:"1px solid "+C.teal+"33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <span style={{fontSize:10,fontWeight:700,color:C.teal}}>{item.step}</span>
        </div>
        <div style={{fontSize:12,color:C.text,lineHeight:1.5,paddingTop:2}}>{item.text}</div>
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

  return <div>
    <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:4}}>Team Leads</div>
    <div style={{fontSize:12,color:C.textMid,marginBottom:14}}>All leads submitted through MoneyMap links.</div>

    {loading&&<div style={{textAlign:"center",padding:"40px 0",color:C.textMid}}>Loading leads...</div>}
    {error&&<div style={{background:C.danger+"11",border:"1px solid "+C.danger+"33",borderRadius:8,padding:"12px",color:C.danger,fontSize:12,marginBottom:14}}>{error}</div>}

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
          <div style={{fontSize:10,color:C.textMid,textTransform:"uppercase",letterSpacing:"0.5px"}}>{s.l}</div>
        </Card>)}
      </div>

      {/* Archived toggle */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:11,color:C.textMid}}>{showArchived?"Showing archived leads":"Showing active leads"} ({filtered.length})</div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {archivedLeads.length>0&&<button onClick={()=>{setShowArchived(!showArchived);setFilter("all");}} style={{fontSize:10,padding:"4px 9px",borderRadius:6,border:"1px solid "+C.border,background:showArchived?C.navy:"white",color:showArchived?"white":C.textMid,cursor:"pointer"}}>{showArchived?"View Active":"View Archived ("+archivedLeads.length+")"}</button>}
          <button onClick={fetchLeads} style={{fontSize:10,padding:"4px 9px",borderRadius:6,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>Refresh</button>
        </div>
      </div>
      {/* Search + Filter */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <input placeholder="Search by name, phone, or email..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,minWidth:180,padding:"7px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:12,color:C.text}}/>
        <div style={{display:"flex",gap:4}}>
          {[["all","All"],["new","New"],["wantsReview","Wants Review"],["reviewCalled","Called"],["bookSent","Book Sent"]].map(([k,l])=>(
            <button key={k} onClick={()=>setFilter(k)} style={{fontSize:10,padding:"5px 9px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:filter===k?600:400,background:filter===k?C.navy:C.surface,color:filter===k?"white":C.textMid,whiteSpace:"nowrap"}}>{l}</button>
          ))}
        </div>
      </div>

      {/* Leads list */}
      {filtered.length===0&&<div style={{textAlign:"center",padding:"32px 0",color:C.textLight}}>No leads found</div>}
      {filtered.map((lead,i)=><div key={i} style={{borderRadius:10,border:"1px solid "+(lead.archived?C.border+"88":C.border),padding:"12px 14px",marginBottom:8,background:lead.archived?C.surface:"white",opacity:lead.archived?0.7:1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:3}}>{lead.name||"Unknown"}</div>
            <div style={{fontSize:12,color:C.textMid,marginBottom:2}}>
              {lead.phone&&<span style={{marginRight:12}}>{lead.phone}</span>}
              {lead.email&&<span style={{color:C.teal}}>{lead.email}</span>}
            </div>
            {lead.referredBy&&<div style={{fontSize:11,color:C.purple,fontWeight:600,marginBottom:2}}>Rep: {lead.referredBy}</div>}
            <div style={{fontSize:10,color:C.textLight}}>{lead.submittedAt?new Date(lead.submittedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}):"No date"}</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end",flexShrink:0}}>
            {lead.wantsReview&&<Badge color={C.gold} small>Wants Review</Badge>}
            {lead.reviewCalled&&<Badge color={C.purple} small>Review Called</Badge>}
            {lead.bookSent&&<Badge color={C.success} small>Book Sent</Badge>}
            {!lead.reviewCalled&&!lead.bookSent&&!lead.archived&&<Badge color={C.teal} small>New</Badge>}
            {isAdmin&&<button onClick={()=>lead.archived?unarchiveLead(lead.docId):archiveLead(lead.docId)} style={{fontSize:10,padding:"3px 8px",borderRadius:5,border:"1px solid "+(lead.archived?C.success+"33":C.danger+"33"),background:lead.archived?C.success+"11":C.danger+"11",color:lead.archived?C.success:C.danger,cursor:"pointer",marginTop:2}}>{lead.archived?"Restore":"Archive"}</button>}
          </div>
        </div>
      </div>)}

      <div style={{fontSize:11,color:C.textLight,textAlign:"center",marginTop:8}}>
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

  if(loading) return null;
  if(leads.length===0) return null;

  return <div style={{background:"white",borderRadius:12,border:"1px solid "+C.teal+"33",padding:"12px 14px",marginBottom:14}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <div style={{width:8,height:8,borderRadius:4,background:C.teal}}/>
      <div style={{fontSize:13,fontWeight:700,color:C.text}}>My Leads ({leads.length})</div>
    </div>
    {leads.slice(0,5).map((lead,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:i<Math.min(leads.length,5)-1?"1px solid "+C.border:"none"}}>
      <div>
        <div style={{fontSize:12,fontWeight:600,color:C.text}}>{lead.name||"Unknown"}</div>
        <div style={{fontSize:11,color:C.textMid}}>{lead.phone} • {lead.submittedAt?new Date(lead.submittedAt).toLocaleDateString():"No date"}</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end"}}>
        {lead.wantsReview&&<Badge color={C.gold} small>Wants Review</Badge>}
        {lead.reviewCalled&&<Badge color={C.purple} small>Called</Badge>}
        {lead.bookSent&&<Badge color={C.success} small>Book Sent</Badge>}
        {!lead.reviewCalled&&!lead.bookSent&&<Badge color={C.teal} small>New</Badge>}
      </div>
    </div>)}
    {leads.length>5&&<div style={{fontSize:11,color:C.textLight,textAlign:"center",marginTop:6}}>+{leads.length-5} more leads</div>}
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

  if(mmLeads.length===0) return <div style={{textAlign:"center",padding:"20px 0",color:C.textLight,fontSize:12}}>No leads in your pipeline yet. Share your MoneyMap link to get started!</div>;

  return <div>
    {/* Wants Review notification banner */}
    {leads.filter(l=>l.wantsReview&&l.stage==="wantsReview").length>0&&<div style={{background:"linear-gradient(135deg,#f97316,#ea580c)",borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:16}}>🔔</span>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:700,color:"white"}}>{leads.filter(l=>l.wantsReview&&l.stage==="wantsReview").length} lead{leads.filter(l=>l.wantsReview&&l.stage==="wantsReview").length!==1?"s":""} requesting a review!</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.8)"}}>They submitted a Financial Needs Analysis request and are ready to speak with you.</div>
      </div>
    </div>}
    {/* Stage selector */}
    <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:6,marginBottom:12,WebkitOverflowScrolling:"touch"}}>
      <button onClick={()=>setActiveStage("all")} style={{flexShrink:0,padding:"5px 10px",borderRadius:7,border:"none",cursor:"pointer",fontWeight:activeStage==="all"?700:400,background:activeStage==="all"?C.navy:C.surface,color:activeStage==="all"?"white":C.textMid,fontSize:11}}>
        All ({leads.length})
      </button>
      {PIPELINE_STAGES.map(s=><button key={s.key} onClick={()=>setActiveStage(s.key)} style={{flexShrink:0,padding:"5px 10px",borderRadius:7,border:"none",cursor:"pointer",fontWeight:activeStage===s.key?700:400,background:activeStage===s.key?s.color:C.surface,color:activeStage===s.key?"white":C.textMid,fontSize:11,whiteSpace:"nowrap"}}>
        {s.label} {stageCounts[s.key]>0&&<span style={{background:"rgba(255,255,255,0.3)",borderRadius:10,padding:"1px 5px"}}>{stageCounts[s.key]}</span>}
      </button>)}
    </div>

    {/* Search */}
    {leads.length>3&&<input placeholder="Search leads..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:12,color:C.text,marginBottom:10,boxSizing:"border-box"}}/>}

    {/* Lead cards */}
    {filtered.length===0&&<div style={{textAlign:"center",padding:"16px 0",color:C.textLight,fontSize:12}}>No leads in this stage</div>}
    {filtered.map((lead,i)=>{
      const stage = PIPELINE_STAGES.find(s=>s.key===lead.stage)||PIPELINE_STAGES[0];
      const daysInStage = getDaysInStage(lead.stageUpdatedAt);
      const isStale = daysInStage>=7&&lead.stage!=="closedClient"&&lead.stage!=="closedNo";
      return <div key={i} style={{borderRadius:10,border:"2px solid "+stage.color+"33",padding:"10px 12px",marginBottom:8,background:"white"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text}}>{lead.name||"Unknown"}</div>
            {lead.phone&&<div style={{fontSize:11,color:C.textMid}}><PhoneLink phone={lead.phone}/></div>}
            {lead.email&&<div style={{fontSize:11,color:C.teal}}><a href={"mailto:"+lead.email} style={{color:C.teal,textDecoration:"none"}}>✉ {lead.email}</a></div>}
            <div style={{fontSize:10,color:C.textLight,marginTop:2}}>
              Received: {lead.submittedAt?new Date(lead.submittedAt).toLocaleDateString():"Unknown"}
            </div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:10,fontWeight:700,color:stage.color,background:stage.color+"15",borderRadius:6,padding:"2px 8px",marginBottom:4}}>{stage.label}</div>
            <div style={{fontSize:10,color:isStale?C.danger:C.textLight,fontWeight:isStale?600:400}}>{daysInStage}d in stage{isStale?" ⚠":""}
            </div>
          </div>
        </div>
        {/* Stage update */}
        {!isAdmin&&<select value={lead.stage} onChange={e=>updateStage(lead.docId,e.target.value)} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+stage.color+"44",fontSize:11,color:C.text,background:stage.color+"08",cursor:"pointer"}}>
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

  if(loading) return <div style={{textAlign:"center",padding:"20px",color:C.textMid,fontSize:12}}>Loading pipeline data...</div>;
  if(repsWithLeads.length===0) return <div style={{textAlign:"center",padding:"20px",color:C.textLight,fontSize:12}}>No pipeline data yet</div>;

  return <div>
    {repsWithLeads.map((rep,i)=>{
      const isExpanded = expandedRep===rep.id;
      const stageSummary = PIPELINE_STAGES.reduce((acc,s)=>{acc[s.key]=rep.repLeads.filter(l=>l.stage===s.key).length;return acc;},{});
      return <div key={rep.id} style={{borderRadius:10,border:"1px solid "+C.border,marginBottom:8,overflow:"hidden"}}>
        <div onClick={()=>setExpandedRep(isExpanded?null:rep.id)} style={{padding:"10px 14px",background:isExpanded?C.navy:"white",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:isExpanded?"white":C.text}}>{rep.name} {rep.userRole!=="rep"&&<span style={{fontSize:10,color:isExpanded?"rgba(255,255,255,0.5)":C.textMid,fontWeight:400}}>({rep.userRole})</span>}</div>
            <div style={{fontSize:11,color:isExpanded?"rgba(255,255,255,0.5)":C.textMid}}>{rep.repLeads.length} lead{rep.repLeads.length!==1?"s":""}{rep.staleCount>0&&<span style={{color:C.danger,fontWeight:600}}> • {rep.staleCount} stale</span>}</div>
          </div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end",maxWidth:200}}>
            {PIPELINE_STAGES.filter(s=>stageSummary[s.key]>0).map(s=><span key={s.key} style={{fontSize:9,background:s.color+"22",color:s.color,borderRadius:4,padding:"1px 5px",fontWeight:600}}>{stageSummary[s.key]} {s.label.split(" ")[0]}</span>)}
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
  const pseudoRep = {id:session.id, name:linkName||session.name, linkName:linkName||null, track:"licensed"};
  return <div>
    <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:4}}>My Pipeline</div>
    <div style={{fontSize:12,color:C.textMid,marginBottom:14}}>Leads from your personal MoneyMap link and their current stage.</div>
    <LeadPipeline rep={pseudoRep} data={data} onUpdate={onUpdate}/>
  </div>;
}


// ── MY TASKS ──
const TASK_DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const TASK_CATEGORIES = ["Activity","Recruiting","Personal","Business","Custom"];
const TASK_PRIORITIES = ["High","Medium","Low"];
const PRIORITY_COLORS = {High:C.danger,Medium:C.gold,Low:C.success};

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

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
      <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text}}>My Tasks & Goals</div>
      <button onClick={()=>{setShowForm(!showForm);setEditId(null);resetForm();}} style={{fontSize:11,padding:"5px 12px",borderRadius:8,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>+ New Task</button>
    </div>
    <div style={{fontSize:12,color:C.textMid,marginBottom:14}}>Personal tasks and recurring goals — private to you.</div>

    {/* Task Form */}
    {showForm&&<div style={{background:"white",borderRadius:12,border:"1px solid "+C.teal+"44",padding:"16px",marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>{editId?"Edit Task":"New Task"}</div>

      <input placeholder="Task title..." value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:13,color:C.text,marginBottom:8,boxSizing:"border-box"}}/>

      <textarea placeholder="Description or notes (optional)..." value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.border,fontSize:12,color:C.text,resize:"vertical",minHeight:60,boxSizing:"border-box",lineHeight:1.5,marginBottom:8}}/>

      {/* Sub-tasks */}
      <div style={{marginBottom:8}}>
        <div style={{fontSize:11,color:C.textMid,marginBottom:4}}>Sub-tasks (optional)</div>
        {form.subtasks.map((s,i)=><div key={s.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
          <span style={{fontSize:12,color:C.text,flex:1,background:C.surface,padding:"4px 8px",borderRadius:6}}>• {s.text}</span>
          <button onClick={()=>setForm(f=>({...f,subtasks:f.subtasks.filter((_,j)=>j!==i)}))} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:14}}>×</button>
        </div>)}
        <div style={{display:"flex",gap:6}}>
          <input placeholder="Add sub-task..." value={form.newSubtask} onChange={e=>setForm(f=>({...f,newSubtask:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addSubtask()} style={{flex:1,padding:"6px 9px",borderRadius:7,border:"1px solid "+C.border,fontSize:11,color:C.text}}/>
          <button onClick={addSubtask} style={{padding:"6px 10px",borderRadius:7,border:"none",background:C.teal+"22",color:C.teal,cursor:"pointer",fontSize:11,fontWeight:600}}>Add</button>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <div>
          <div style={{fontSize:10,color:C.textMid,marginBottom:3}}>Start Date</div>
          <input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text,boxSizing:"border-box"}}/>
        </div>
        <div>
          <div style={{fontSize:10,color:C.textMid,marginBottom:3}}>End Date (optional)</div>
          <input type="date" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text,boxSizing:"border-box"}}/>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <div>
          <div style={{fontSize:10,color:C.textMid,marginBottom:3}}>Priority</div>
          <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text}}>
            {TASK_PRIORITIES.map(p=><option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <div style={{fontSize:10,color:C.textMid,marginBottom:3}}>Category</div>
          <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid "+C.border,fontSize:12,color:C.text}}>
            {TASK_CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Recurring */}
      <div style={{marginBottom:10}}>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:8}}>
          <input type="checkbox" checked={form.recurring} onChange={e=>setForm(f=>({...f,recurring:e.target.checked}))} style={{width:16,height:16}}/>
          <span style={{fontSize:12,color:C.text,fontWeight:600}}>Recurring task</span>
        </label>
        {form.recurring&&<div>
          <div style={{fontSize:10,color:C.textMid,marginBottom:4}}>Repeat on these days:</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {TASK_DAYS.map((d,i)=><button key={i} onClick={()=>setForm(f=>({...f,days:f.days.includes(i)?f.days.filter(x=>x!==i):[...f.days,i]}))} style={{padding:"5px 9px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:form.days.includes(i)?700:400,background:form.days.includes(i)?C.teal:C.surface,color:form.days.includes(i)?"white":C.textMid,fontSize:11}}>{d}</button>)}
          </div>
          <div style={{display:"flex",gap:6,marginTop:6}}>
            <button onClick={()=>setForm(f=>({...f,days:[1,2,3,4,5]}))} style={{fontSize:10,padding:"3px 8px",borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>Weekdays</button>
            <button onClick={()=>setForm(f=>({...f,days:[0,1,2,3,4,5,6]}))} style={{fontSize:10,padding:"3px 8px",borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>Every Day</button>
            <button onClick={()=>setForm(f=>({...f,days:[0,6]}))} style={{fontSize:10,padding:"3px 8px",borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>Weekends</button>
          </div>
        </div>}
      </div>

      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>{setShowForm(false);setEditId(null);resetForm();}} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid "+C.border,background:"white",cursor:"pointer",fontSize:12,color:C.textMid}}>Cancel</button>
        <button onClick={saveTask} style={{flex:2,padding:"8px",borderRadius:8,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>Save Task</button>
      </div>
    </div>}

    {/* Task List */}
    {myTasks.length===0&&!showForm&&<div style={{textAlign:"center",padding:"40px 0",color:C.textLight}}>
      <div style={{fontSize:28,marginBottom:8}}>✓</div>
      <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:4}}>No tasks yet</div>
      <div style={{fontSize:11}}>Add your first task or recurring goal above</div>
    </div>}

    {[...myTasks].sort((a,b)=>{
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
                <span style={{fontSize:13,fontWeight:700,color:C.text}}>{task.title}</span>
                <Badge color={PRIORITY_COLORS[task.priority]||C.gold} small>{task.priority}</Badge>
                <Badge color={C.teal} small>{task.category}</Badge>
                {task.recurring&&<Badge color={C.purple} small>Recurring</Badge>}
              </div>
              {task.description&&<div style={{fontSize:11,color:C.textMid,lineHeight:1.5,marginBottom:4}}>{task.description}</div>}
              {task.recurring&&task.days&&<div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                {TASK_DAYS.map((d,di)=><span key={di} style={{fontSize:9,padding:"1px 5px",borderRadius:4,background:task.days.includes(di)?C.teal+"22":C.surface,color:task.days.includes(di)?C.teal:C.textLight,fontWeight:task.days.includes(di)?600:400}}>{d}</span>)}
              </div>}
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              <button onClick={()=>editTask(task)} style={{fontSize:10,padding:"3px 7px",borderRadius:5,border:"1px solid "+C.border,background:"white",cursor:"pointer",color:C.textMid}}>Edit</button>
              <button onClick={()=>deleteTask(task.id)} style={{fontSize:10,padding:"3px 7px",borderRadius:5,border:"1px solid "+C.danger+"33",background:C.danger+"11",cursor:"pointer",color:C.danger}}>Delete</button>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:6,flexWrap:"wrap"}}>
            {daysLeft!==null&&<span style={{fontSize:10,color:daysLeft<=3?C.danger:daysLeft<=7?C.gold:C.textLight}}>{daysLeft<=0?"Ended":daysLeft+"d left"}</span>}
            {streak>0&&<span style={{fontSize:10,color:C.gold,fontWeight:600}}>🔥 {streak} day streak</span>}
            {pct!==null&&<span style={{fontSize:10,color:C.teal}}>{daysCompleted}/{totalDays} days done ({pct}%)</span>}
          </div>
          {pct!==null&&<Bar pct={pct} color={pct>=100?C.success:C.teal} h={4} style={{marginTop:4}}/>}
        </div>

        {/* Sub-tasks */}
        {task.subtasks&&task.subtasks.length>0&&<div style={{padding:"8px 14px",borderBottom:"1px solid "+C.border}}>
          {task.subtasks.map((s,si)=><div key={s.id} style={{fontSize:12,color:C.textMid,padding:"3px 0"}}>• {s.text}</div>)}
        </div>}

        {/* Today's completion */}
        {todayActive&&<div style={{padding:"10px 14px",background:completedToday?C.success+"08":C.surface}}>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
            <input type="checkbox" checked={completedToday} onChange={()=>toggleDayComplete(task.id,today)} style={{width:18,height:18,cursor:"pointer"}}/>
            <span style={{fontSize:12,fontWeight:600,color:completedToday?C.success:C.text}}>{completedToday?"Completed today!":"Mark today as done"}</span>
          </label>
        </div>}
        {!todayActive&&<div style={{padding:"8px 14px",background:C.surface}}>
          <span style={{fontSize:11,color:C.textLight}}>Not scheduled for today</span>
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
      <div style={{fontSize:11,fontWeight:700,color:C.teal,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:12}}>Your Career Journey</div>
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
            <div style={{fontSize:9,fontWeight:active?700:400,color:active?"white":"rgba(255,255,255,0.4)",lineHeight:1.2}}>{s.label}</div>
          </div>;
        })}
      </div>
    </div>

    {/* ── NEW REP: Goal is to get Life Licensed ── */}
    {currentStage==="new"&&<div>
      <div style={{background:C.teal+"11",border:"1px solid "+C.teal+"33",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.teal,marginBottom:6}}>Your Next Goal: Become Life Licensed</div>
        <div style={{fontSize:12,color:C.text,lineHeight:1.7}}>Getting your life insurance license is your first major milestone. Focus on completing your checklist, finishing your pre-licensing class, and passing your exam. Once you are licensed a whole new path opens up!</div>
      </div>
      <div style={{background:C.navy+"11",border:"1px solid "+C.border,borderRadius:8,padding:"10px 12px",fontSize:11,color:C.textMid,textAlign:"center",lineHeight:1.5}}>
        Field Trainer and RVP paths unlock after you get licensed. Stay focused — every step brings you closer!
      </div>
    </div>}

    {/* ── LICENSED AGENT: Goal is Field Trainer ── */}
    {currentStage==="licensed"&&<div>
      <div style={{background:C.gold+"11",border:"1px solid "+C.gold+"33",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.gold,marginBottom:6}}>Your Next Goal: Become a Field Trainer</div>
        <div style={{fontSize:12,color:C.text,lineHeight:1.7}}>You are licensed — that is a huge achievement! Now the focus shifts to building your skills, your production, and your team. When you feel ready and meet all the Field Trainer requirements, request your review below.</div>
      </div>
      <Card style={{border:"1px solid "+(ftRequested?C.gold+"44":C.purple+"33")}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>Ready for Field Trainer Review?</div>
        <div style={{fontSize:11,color:C.textMid,marginBottom:10,lineHeight:1.5}}>When you feel confident you meet all the requirements, request a review. Your RVP will be notified and will schedule time to go through everything with you.</div>
        {!ftRequested&&!rep.fieldTrainerDenied&&<button onClick={()=>onUpdate(rep.id,{...rep,fieldTrainerRequested:true,fieldTrainerDenied:false,fieldTrainerRequestedAt:new Date().toISOString()})}
          style={{width:"100%",padding:"10px",borderRadius:9,background:"linear-gradient(135deg,"+C.purple+",#7c3aed)",color:"white",border:"none",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          Request Field Trainer Review
        </button>}
        {ftRequested&&<div style={{background:C.gold+"11",border:"1px solid "+C.gold+"33",borderRadius:8,padding:"10px 12px",textAlign:"center",fontSize:12,color:C.gold,fontWeight:600}}>Review requested! Your RVP has been notified. Keep pushing forward!</div>}
        {rep.fieldTrainerDenied&&!ftRequested&&<div>
          <div style={{background:C.danger+"11",border:"1px solid "+C.danger+"33",borderRadius:8,padding:"8px 12px",fontSize:12,color:C.danger,marginBottom:8,textAlign:"center"}}>Request was not approved — speak with your trainer for next steps</div>
          <button onClick={()=>onUpdate(rep.id,{...rep,fieldTrainerRequested:true,fieldTrainerDenied:false,fieldTrainerRequestedAt:new Date().toISOString()})} style={{width:"100%",padding:"10px",borderRadius:9,background:"linear-gradient(135deg,"+C.purple+",#7c3aed)",color:"white",border:"none",fontWeight:700,fontSize:13,cursor:"pointer"}}>Request Again</button>
        </div>}
      </Card>
    </div>}

    {/* ── FIELD TRAINER: Goal is RVP ── */}
    {currentStage==="trainer"&&<div>
      <div style={{background:C.success+"11",border:"1px solid "+C.success+"33",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:700,color:C.success,marginBottom:4}}>Field Trainer Approved!</div>
        <div style={{fontSize:12,color:C.textMid}}>Congratulations! You are now a Field Trainer. Your next and final goal is Regional Vice President.</div>
      </div>
      <Card style={{marginBottom:14,border:"1px solid "+(rvpRequested?C.gold+"44":C.success+"33")}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>Ready for the RVP Path?</div>
        <div style={{fontSize:11,color:C.textMid,marginBottom:10,lineHeight:1.5}}>The RVP Path is the final stage of your career journey. When you are consistently producing as a Field Trainer and ready to build a region, request access to the full RVP checklist.</div>
        {!rvpRequested&&!rep.rvpPathDenied&&<button onClick={()=>onUpdate(rep.id,{...rep,rvpPathRequested:true,rvpPathDenied:false,rvpPathRequestedAt:new Date().toISOString()})}
          style={{width:"100%",padding:"10px",borderRadius:9,background:"linear-gradient(135deg,"+C.success+",#059669)",color:"white",border:"none",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          Request RVP Path Access
        </button>}
        {rvpRequested&&<div style={{background:C.gold+"11",border:"1px solid "+C.gold+"33",borderRadius:8,padding:"10px 12px",textAlign:"center",fontSize:12,color:C.gold,fontWeight:600}}>RVP Path request sent! Your admin will review and grant access when ready.</div>}
        {rep.rvpPathDenied&&!rvpRequested&&<div>
          <div style={{background:C.danger+"11",border:"1px solid "+C.danger+"33",borderRadius:8,padding:"8px 12px",fontSize:12,color:C.danger,marginBottom:8,textAlign:"center"}}>Request was not approved — speak with your trainer for next steps</div>
          <button onClick={()=>onUpdate(rep.id,{...rep,rvpPathRequested:true,rvpPathDenied:false,rvpPathRequestedAt:new Date().toISOString()})} style={{width:"100%",padding:"10px",borderRadius:9,background:"linear-gradient(135deg,"+C.success+",#059669)",color:"white",border:"none",fontWeight:700,fontSize:13,cursor:"pointer"}}>Request Again</button>
        </div>}
      </Card>
    </div>}

    {/* ── RVP PATH GRANTED: Show full checklist ── */}
    {currentStage==="rvp"&&<div>
      <div style={{background:C.success+"11",border:"1px solid "+C.success+"33",borderRadius:10,padding:"12px 14px",marginBottom:14,textAlign:"center"}}>
        <div style={{fontSize:14,fontWeight:700,color:C.success,marginBottom:4}}>RVP Path Unlocked!</div>
        <div style={{fontSize:12,color:C.textMid}}>You are on your way to Regional Vice President! Complete every item below.</div>
      </div>
      {Object.entries(RVP_CHECKLIST.reduce((a,i)=>{if(!a[i.cat])a[i.cat]=[];a[i.cat].push(i);return a;},{})).map(([cat,items])=><div key={cat}><SecHead title={cat} color={C.gold}/>{items.map(item=><CheckItem key={item.id} item={item} checked={!!(rep.rvpChecked||{})[item.id]} onToggle={()=>onUpdate(rep.id,{...rep,rvpChecked:{...(rep.rvpChecked||{}),[item.id]:!(rep.rvpChecked||{})[item.id]}})} readOnly={false}/>)}</div>)}
    </div>}
  </div>;
}

// ── SCRIPTS PAGE (editable by admins) ──
function ScriptsPage({data,onUpdate,userRole}) {
  const scripts = data.scripts || SCRIPTS;
  const isAdmin = userRole==="admin"||userRole==="superadmin";
  const [editing,setEditing] = useState(null);
  const [draft,setDraft] = useState({title:"",content:""});
  const [showAdd,setShowAdd] = useState(false);
  const [newScript,setNewScript] = useState({title:"",content:""});

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
    setNewScript({title:"",content:""});
    setShowAdd(false);
  };
  const resetToDefault = () => {
    if(window.confirm("Reset all scripts to the original defaults?")) onUpdate({...data,scripts:SCRIPTS});
  };

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div style={{fontSize:dv(17,22),fontWeight:700,color:C.text}}>Scripts</div>
      {isAdmin&&<div style={{display:"flex",gap:7}}>
        <button onClick={resetToDefault} style={{fontSize:11,padding:"5px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>Reset Defaults</button>
        <button onClick={()=>setShowAdd(!showAdd)} style={{fontSize:11,padding:"5px 10px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontWeight:600}}>+ Add Script</button>
      </div>}
    </div>
    {isAdmin&&<div style={{background:C.teal+"11",border:`1px solid ${C.teal}33`,borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:11,color:C.teal}}>
      You can edit any script below. Changes save instantly and update for everyone on the team.
    </div>}
    {showAdd&&<Card style={{marginBottom:14,border:`1px solid ${C.teal}44`}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>New Script</div>
      <input placeholder="Script title" value={newScript.title} onChange={e=>setNewScript({...newScript,title:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text,marginBottom:8,boxSizing:"border-box"}}/>
      <textarea placeholder="Script content..." value={newScript.content} onChange={e=>setNewScript({...newScript,content:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,resize:"vertical",minHeight:100,boxSizing:"border-box",lineHeight:1.6}}/>
      <div style={{display:"flex",gap:7,marginTop:8}}>
        <button onClick={()=>setShowAdd(false)} style={{flex:1,padding:"7px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:12,color:C.textMid}}>Cancel</button>
        <button onClick={addScript} style={{flex:2,padding:"7px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:12,fontWeight:600}}>Save Script</button>
      </div>
    </Card>}
    {scripts.map((s,i)=><Card key={i} style={{marginBottom:10}}>
      {editing===i?(
        <div>
          <input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.teal}`,fontSize:13,color:C.text,marginBottom:8,boxSizing:"border-box",fontWeight:600}}/>
          <textarea value={draft.content} onChange={e=>setDraft({...draft,content:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:7,border:`1px solid ${C.teal}`,fontSize:12,color:C.text,resize:"vertical",minHeight:100,boxSizing:"border-box",lineHeight:1.6}}/>
          <div style={{display:"flex",gap:7,marginTop:8}}>
            <button onClick={()=>setEditing(null)} style={{flex:1,padding:"6px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:11,color:C.textMid}}>Cancel</button>
            <button onClick={()=>saveEdit(i)} style={{flex:2,padding:"6px",borderRadius:7,border:"none",background:C.teal,color:"white",cursor:"pointer",fontSize:11,fontWeight:600}}>Save Changes</button>
          </div>
        </div>
      ):(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div style={{fontSize:dv(13,16),fontWeight:600,color:C.text,flex:1}}>{s.title}</div>
            {isAdmin&&<div style={{display:"flex",gap:5,marginLeft:8}}>
              <button onClick={()=>{setEditing(i);setDraft({title:s.title,content:s.content});}} style={{fontSize:11,padding:"3px 8px",borderRadius:5,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>Edit</button>
              <button onClick={()=>deleteScript(i)} style={{fontSize:11,padding:"3px 8px",borderRadius:5,border:`1px solid ${C.danger}33`,background:C.danger+"11",cursor:"pointer",color:C.danger}}>Delete</button>
            </div>}
          </div>
          <div style={{background:C.surface,borderRadius:8,padding:"10px 12px",fontSize:dv(12,15),color:C.textMid,lineHeight:1.7}}>"{s.content}"</div>
        </div>
      )}
    </Card>)}
  </div>;
}

// ── SIDEBAR ──
function Sidebar({section,onNav,role,name,onSignOut,onClose,onShowPhone,onShowTour,alsoRecruits=false}) {
  const nav=[
    {k:"dashboard",l:"Dashboard",d:"M3 12L12 3L21 12V20H15V14H9V20H3V12Z"},
    {k:"reps",l:"My Reps",d:"M17 21V19C17 17.9 16.1 17 15 17H9C7.9 17 7 17.9 7 19V21M12 14C9.8 14 8 12.2 8 10C8 7.8 9.8 6 12 6C14.2 6 16 7.8 16 10C16 12.2 14.2 14 12 14Z"},
    {k:"accountability",l:"Accountability",d:"M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"},
    {k:"teamleads",l:"Team Leads",d:"M17 20H7C5.9 20 5 19.1 5 18V6C5 4.9 5.9 4 7 4H17C18.1 4 19 4.9 19 6V18C19 19.1 18.1 20 17 20ZM9 8H15M9 12H15M9 16H12"},
    {k:"mypipeline",l:"My Pipeline",d:"M9 17H7C5.9 17 5 16.1 5 15V5C5 3.9 5.9 3 7 3H17C18.1 3 19 3.9 19 5V15C19 16.1 18.1 17 17 17H15M9 17L12 21L15 17M9 17H15"},
    {k:"production",l:"Production",d:"M3 3H21V5H3ZM3 8H15V10H3ZM3 13H21V15H3ZM3 18H15V20H3Z"},
    {k:"scorecard",l:"Scorecard",d:"M9 19V6L21 3V16M9 19C9 20.1 8.1 21 7 21C5.9 21 5 20.1 5 19C5 17.9 5.9 17 7 17C8.1 17 9 17.9 9 19ZM21 16C21 17.1 20.1 18 19 18C17.9 18 17 17.1 17 16C17 14.9 17.9 14 19 14C20.1 14 21 14.9 21 16Z"},
    {k:"wallfame",l:"Wall of Fame",d:"M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"},
    {k:"emailtemplates",l:"Email Templates",d:"M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6"},
    {k:"quickmsg",l:"Quick Messages",d:"M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"},
    {k:"leadlink",l:"My Lead Link",d:"M10 13C10.4295 13.5741 10.9774 14.0492 11.6066 14.3929C12.2357 14.7367 12.9315 14.9411 13.6467 14.9923C14.3618 15.0435 15.0796 14.9404 15.7513 14.6898C16.4231 14.4392 17.0331 14.0471 17.54 13.54L20.54 10.54C21.4508 9.59699 21.9548 8.33397 21.9434 7.02299C21.932 5.71201 21.4061 4.45794 20.4791 3.53087C19.5521 2.60381 18.298 2.07799 16.987 2.0666C15.676 2.0552 14.413 2.55918 13.47 3.46997L11.75 5.17997M14 11C13.5705 10.4259 13.0226 9.95083 12.3934 9.60706C11.7642 9.26329 11.0685 9.05886 10.3533 9.00765C9.63816 8.95643 8.92037 9.05954 8.24861 9.31018C7.57685 9.56083 6.96684 9.95294 6.45996 10.46L3.45996 13.46C2.54917 14.403 2.04519 15.666 2.0566 16.977C2.06801 18.288 2.59383 19.5421 3.52089 20.4691C4.44796 21.3962 5.70203 21.922 7.01301 21.9334C8.32399 21.9448 9.58701 21.4408 10.53 20.53L12.24 18.82"},
    {k:"prospects",l:"My Prospects",d:"M17 21V19C17 17.9 16.1 17 15 17H9C7.9 17 7 17.9 7 19V21M12 11C9.8 11 8 9.2 8 7C8 4.8 9.8 3 12 3C14.2 3 16 4.8 16 7C16 9.2 14.2 11 12 11ZM21 11L19 13L17 11M19 13V7"},
    {k:"mytasks",l:"My Tasks",d:"M9 11L12 14L22 4M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16"},
    {k:"resources",l:"Resources",d:"M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12"},
    {k:"advancement",l:"Advancement",d:"M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"},
    {k:"scripts",l:"Scripts",d:"M9 5H7C5.9 5 5 5.9 5 7V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V7C19 5.9 18.1 5 17 5H15M9 5C9 5.6 9.4 6 10 6H14C14.6 6 15 5.6 15 5M9 5C9 4.4 9.4 4 10 4H14C14.6 4 15 4.4 15 5"},
    {k:"schedule",l:"Schedule",d:"M8 2V5M16 2V5M3.5 9H20.5M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z"},
    {k:"myprofile",l:"My Profile",d:"M20 21V19C20 17.9 19.1 17 18 17H6C4.9 17 4 17.9 4 19V21M16 7C16 9.2 14.2 11 12 11C9.8 11 8 9.2 8 7C8 4.8 9.8 3 12 3C14.2 3 16 4.8 16 7Z"},
    ...(role==="trainer"||role==="superadmin"||alsoRecruits?[{k:"careerpath",l:"My Career Path",d:"M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"}]:[]),
  ];
  if(role==="admin"||role==="superadmin") nav.push({k:"team",l:"Team Mgmt",d:"M16 11C17.66 11 18.99 9.66 18.99 8C18.99 6.34 17.66 5 16 5C14.34 5 13 6.34 13 8C13 9.66 14.34 11 16 11ZM8 11C9.66 11 10.99 9.66 10.99 8C10.99 6.34 9.66 5 8 5C6.34 5 5 6.34 5 8C5 9.66 6.34 11 8 11ZM8 13C5.67 13 1 14.17 1 16.5V18H15V16.5C15 14.17 10.33 13 8 13ZM16 13C15.71 13 15.38 13.02 15.03 13.05C16.19 13.89 17 15.02 17 16.5V18H23V16.5C23 14.17 18.33 13 16 13Z"});
  return <div style={{width:210,background:C.navy,height:"100%",display:"flex",flexDirection:"column",color:"white",flexShrink:0}}>
    <div style={{padding:"18px 14px 14px",borderBottom:`1px solid ${C.borderLight}`,display:"flex",alignItems:"center",gap:9}}>
      <div style={{width:34,height:34,background:"rgba(14,165,160,0.15)",border:"1px solid rgba(14,165,160,0.35)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L1 4.5V11.5L8 15L15 11.5V4.5L8 1Z" stroke={C.teal} strokeWidth="1.5" fill="none"/><path d="M4.5 8L6.5 10L11.5 5" stroke={C.teal} strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
      <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:700,color:"white",lineHeight:1.2}}>NextLevel</div><div style={{fontSize:9,color:C.textLight,lineHeight:1.2}}>Field Training Hub</div></div>
      {onClose&&<button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:18,padding:0,lineHeight:1}}>x</button>}
    </div>
    <nav style={{flex:1,padding:"10px 7px",overflowY:"auto"}}>
      {nav.map(item=><button key={item.k} onClick={()=>{onNav(item.k);onClose?.();}} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"8px 9px",borderRadius:7,border:"none",cursor:"pointer",textAlign:"left",marginBottom:1,background:section===item.k?"rgba(14,165,160,0.15)":"transparent",color:section===item.k?C.teal:"rgba(255,255,255,0.6)"}} onMouseEnter={e=>{if(section!==item.k)e.currentTarget.style.background="rgba(255,255,255,0.05)";}} onMouseLeave={e=>{if(section!==item.k)e.currentTarget.style.background="transparent";}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.d}/></svg>
        <span style={{fontSize:12,fontWeight:section===item.k?600:400}}>{item.l}</span>
        {section===item.k&&<div style={{marginLeft:"auto",width:3,height:3,borderRadius:2,background:C.teal}}/>}
      </button>)}
      <div style={{borderTop:`1px solid ${C.borderLight}`,marginTop:8,paddingTop:8}}>
        {[{l:"App Tour",fn:onShowTour},{l:"Add to Phone",fn:onShowPhone}].map(btn=><button key={btn.l} onClick={()=>{btn.fn();onClose?.();}} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"7px 9px",borderRadius:7,border:"none",cursor:"pointer",textAlign:"left",marginBottom:1,background:"transparent",color:"rgba(255,255,255,0.45)",fontSize:11}}>{btn.l}</button>)}
      </div>
    </nav>
    <div style={{padding:"10px 14px",borderTop:`1px solid ${C.borderLight}`}}>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
        <div style={{width:28,height:28,borderRadius:7,background:"rgba(14,165,160,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.teal,flexShrink:0}}>{name?.charAt(0)?.toUpperCase()||"U"}</div>
        <div style={{minWidth:0}}><div style={{fontSize:11,fontWeight:600,color:"white",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name||"User"}</div><div style={{fontSize:9,color:C.textLight,textTransform:"capitalize"}}>{role}</div></div>
      </div>
      <button onClick={onSignOut} style={{width:"100%",padding:"6px",borderRadius:7,background:"rgba(255,255,255,0.04)",border:`1px solid ${C.borderLight}`,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:11}}>Sign Out</button>
    </div>
  </div>;
}

// ── MAIN APP ──
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
  useEffect(()=>{
    const unsub=onSnapshot(doc(db,"appdata","main"),(snap)=>{
      if(snap.exists()){
        try{
          const d=JSON.parse(snap.data().payload||"{}");
          if(Date.now()-lastSaveRef.current>5000){
            // Migrate photos to localStorage to free Firebase space
            const profilePhotos=d.profilePhotos||{};
            const wofPhotos=d.wofPhotos||{};
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
              const cleaned={...d,profilePhotos:{},wofPhotos:{}};
              setData(cleaned);
              saveToFirebase(cleaned);
            } else {
              setData(d);
            }
          }
        }catch{}
      }
      setLoading(false);
    },(err)=>{console.error("Firebase read error",err);setLoading(false);});
    return ()=>unsub();
  },[]);

  const upd=useCallback((d)=>{
    lastSaveRef.current=Date.now();
    setData(d);
    const profilePhotos=d.profilePhotos||{};
    const wofPhotos=d.wofPhotos||{};
    Object.entries(profilePhotos).forEach(([id,photo])=>{if(photo)try{localStorage.setItem("profilePhoto_"+id,photo);}catch(e){}});
    Object.entries(wofPhotos).forEach(([id,photo])=>{if(photo)try{localStorage.setItem("wofPhoto_"+id,photo);}catch(e){}});
    const lean={...d,profilePhotos:{},wofPhotos:{}};
    saveToFirebase(lean);
  },[]);
  const dataRef=useRef(data);
  useEffect(()=>{dataRef.current=data;},[data]);

  // Track login — must be before any conditional returns
  useEffect(()=>{
    if(session&&data&&Object.keys(data).length>0){
      const today=new Date().toISOString().split("T")[0];
      const logins=data.loginHistory||{};
      const userLogins=logins[session.id]||[];
      const todayEntry=userLogins.find(l=>l.date===today);
      if(!todayEntry){
        const updated={...logins,[session.id]:[...userLogins,{date:today,ts:new Date().toISOString()}].slice(-60)};
        setData(d=>({...d,loginHistory:updated}));
        saveToFirebase({...data,loginHistory:updated});
      }
    }
  },[session?.id]);

  const handleLogin=(role,id,userData,newPin)=>{
    if(role==="rep"&&newPin){
      const updated={...data,reps:(data.reps||[]).map(r=>r.id===id?{...r,repPin:newPin}:r)};
      upd(updated);
    }
    setSession({role,id,name:userData?.name||(role==="admin"?"Admin":"User")});
    setSection("dashboard");
    const tourKey=`tour_shown_${role}_${id}`;
    if(!localStorage.getItem(tourKey)){setShowTour(true);localStorage.setItem(tourKey,"done");}
  };

  const signOut=()=>{setSession(null);setSelRepId(null);};

  // Prevent phone back button from logging out
  useEffect(()=>{
    if(!session) return;
    window.history.pushState(null,'',window.location.href);
    const handler=()=>window.history.pushState(null,'',window.location.href);
    window.addEventListener('popstate',handler);
    return()=>window.removeEventListener('popstate',handler);
  },[session]);

  if(loading) return <div style={{minHeight:"100vh",background:C.navy,display:"flex",alignItems:"center",justifyContent:"center",color:"white",flexDirection:"column",gap:12}}>
    <div style={{width:40,height:40,border:`3px solid ${C.teal}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <div style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>Loading...</div>
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
      {showTour&&<AppTour role="rep" onClose={()=>setShowTour(false)}/>}
      {showPhone&&<AddToPhoneModal onClose={()=>setShowPhone(false)}/>}
      {showNeedHelp&&<NeedHelpModal rep={rep} data={data} onUpdate={upd} onClose={()=>setShowNeedHelp(false)}/>}
      <div style={{background:C.navy,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{color:"white",fontWeight:700,fontSize:13}}>NextLevel Field Training Hub</div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setShowTour(true)} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.6)",padding:"4px 9px",borderRadius:6,cursor:"pointer",fontSize:11}}>Tour</button>
          <button onClick={()=>setShowNeedHelp(true)} style={{background:"rgba(255,100,100,0.25)",border:"1px solid rgba(255,100,100,0.4)",color:"white",padding:"4px 9px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:600}}>Need Help</button>
          <button onClick={()=>setShowPhone(true)} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.6)",padding:"4px 9px",borderRadius:6,cursor:"pointer",fontSize:11}}>Add to Phone</button>
          <button onClick={signOut} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.6)",padding:"4px 9px",borderRadius:6,cursor:"pointer",fontSize:11}}>Sign Out</button>
        </div>
      </div>
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{width:"100%"}}><AnnouncementsBanner data={data} onUpdate={upd} userRole="rep"/></div>
        <div style={{width:"100%"}}><DailyEventsBanner data={data} onUpdateData={upd} userRole="rep"/></div>
        <div style={{flex:1,overflow:"hidden",display:"flex"}}><RepView rep={rep} data={data} onUpdate={(id,u)=>upd({...dataRef.current,reps:(dataRef.current.reps||[]).map(r=>r.id===id?u:r)})} onUpdateData={upd} readOnly={false} isOwnView={true} key={rep.id}/></div>
      </div>
    </div>;
  }

  const selRep=selRepId?(data.reps||[]).find(r=>r.id===selRepId):null;
  const navTo=(s)=>{setSection(s);setSelRepId(null);};

  const renderContent=()=>{
    if(selRep&&(section==="reps"||section==="dashboard")) {const latestRep=(dataRef.current.reps||[]).find(r=>r.id===selRep.id)||selRep;return <RepProfile rep={latestRep} data={dataRef.current} onUpdate={(id,u)=>upd({...dataRef.current,reps:(dataRef.current.reps||[]).map(r=>r.id===id?u:r)})} onUpdateData={upd} onBack={()=>setSelRepId(null)} onDelete={(id)=>{upd({...dataRef.current,reps:(dataRef.current.reps||[]).filter(r=>r.id!==id)});setSelRepId(null);}}/>;}
    if(section==="dashboard") return <Dashboard data={data} onUpdate={upd} userRole={session.role} userId={session.id} onSelectRep={(id)=>{setSelRepId(id);setSection("dashboard");}}/>;
    if(section==="reps") return <MyRepsPage data={data} onUpdate={upd} userRole={session.role} userId={session.id} onSelectRep={(id)=>{setSelRepId(id);setSection("reps");}}/>;
    if(section==="production") return <div><div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:14}}>Production</div><ProdDash data={data} onUpdateData={upd}/><MyProd myProd={(data.myProduction||{})[session.id]||{}} onUpdate={p=>{
      const newData={...data,myProduction:{...(data.myProduction||{}),[session.id]:p}};
      // Also sync investments directly to admin record so team totals pick them up
      const isAdminRole=session.role==="admin"||session.role==="superadmin";
      if(isAdminRole&&p.investments){
        newData.admins=(data.admins||[]).map(a=>a.id===session.id?{...a,investments:p.investments}:a);
      }
      upd(newData);
    }}/></div>;
    if(section==="schedule") return <div><div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:14}}>Team Schedule</div><ScheduleView data={data} onUpdate={upd} userRole={session.role}/></div>;
    if(section==="scripts") return <ScriptsPage data={data} onUpdate={upd} userRole={session.role}/>;
    if(section==="resources") return <ResourceLibrary data={data} onUpdate={upd} userRole={session.role}/>;
    if(section==="advancement") return <AdvancementLibrary data={data} onUpdate={upd} userRole={session.role}/>;
    if(section==="scorecard") return <ScorecardPage data={data} onUpdate={upd} userId={session.id} userRole={session.role}/>;
    if(section==="wallfame") return <WallOfFame data={data} onUpdate={upd} userRole={session.role}/>;
    if(section==="myprofile") return <MyProfilePage session={session} data={data} onUpdate={upd}/>;
    if(section==="mytasks") return <MyTasksPage session={session} data={data} onUpdate={upd}/>;
    if(section==="prospects") return <ProspectsPage session={session} data={data} onUpdate={upd}/>;
    if(section==="leadlink") return <LeadLinkPage session={session} data={data}/>;
    if(section==="mypipeline") return <MyPipelinePage session={session} data={data} onUpdate={upd}/>;
    if(section==="accountability") return <AccountabilityDashboard data={data} onUpdate={upd} userRole={session.role} userId={session.id}/>;
    // Admin trainer tools — only if alsoRecruits is enabled
    const adminRecord = (data.admins||[]).find(a=>a.id===session.id);
    const alsoRecruits = adminRecord?.alsoRecruits||session.role==="superadmin";
    if(section==="careerpath"&&alsoRecruits) return <TrainerCareerPath data={data} onUpdate={upd} session={session}/>;
    if(section==="mypipeline"&&alsoRecruits) return <MyPipelinePage session={session} data={data} onUpdate={upd}/>;
    if(section==="teamleads") return <div><TeamLeads userRole={session.role}/><div style={{marginTop:14}}><div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:10}}>Rep Pipelines</div><AdminPipeline data={data} onUpdate={upd}/></div></div>;
    if(section==="emailtemplates") return <EmailTemplatesPage data={data} onUpdate={upd} userRole={session.role} reps={data.reps||[]} trainers={data.trainers||[]} admins={data.admins||[]}/>;
    if(section==="quickmsg") return <QuickMessages data={data} onUpdate={upd} userRole={session.role}/>;
    if(section==="careerpath") return <TrainerCareerPath data={data} onUpdate={upd} session={session}/>;
    if(section==="team") return <div><div style={{fontSize:dv(17,22),fontWeight:700,color:C.text,marginBottom:14}}>Team Management</div><AnnouncementsManager data={data} onUpdate={upd}/><Card><div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:10}}>Field Trainers</div>{(data.trainers||[]).map(t=><div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.border}`}}><div><div style={{fontSize:12,color:C.text}}>{t.name}</div><div style={{fontSize:10,color:C.textLight}}>{(data.reps||[]).filter(r=>r.trainerId===t.id).length} reps</div></div><Badge color={C.teal} small>Trainer</Badge></div>)}</Card></div>;
    return null;
  };

  return <div style={{display:"flex",height:"100vh",background:C.surface,overflow:"hidden"}}>
    {showTour&&<AppTour role={session.role} onClose={()=>setShowTour(false)}/>}
    {showPhone&&<AddToPhoneModal onClose={()=>setShowPhone(false)}/>}
    {/* Desktop sidebar — hidden on mobile via media query workaround using window width */}
    <div style={{display:"flex",flexShrink:0,width:winWidth>=768?(winWidth>=900?260:240):0,overflow:"hidden"}}>
      {winWidth>=768&&<Sidebar section={section} onNav={navTo} role={session.role} name={session.name} onSignOut={signOut} onShowPhone={()=>setShowPhone(true)} onShowTour={()=>setShowTour(true)} alsoRecruits={((data.admins||[]).find(a=>a.id===session.id)||{}).alsoRecruits||session.role==="superadmin"}/>}
    </div>
    {/* Mobile sidebar overlay */}
    {mobileOpen&&<div style={{position:"fixed",inset:0,zIndex:200,display:"flex"}}>
      <Sidebar section={section} onNav={navTo} role={session.role} name={session.name} onSignOut={signOut} onClose={()=>setMobileOpen(false)} onShowPhone={()=>{setShowPhone(true);setMobileOpen(false);}} onShowTour={()=>{setShowTour(true);setMobileOpen(false);}} alsoRecruits={((data.admins||[]).find(a=>a.id===session.id)||{}).alsoRecruits||session.role==="superadmin"}/>
      <div style={{flex:1,background:"rgba(0,0,0,0.5)"}} onClick={()=>setMobileOpen(false)}/>
    </div>}
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
      <div style={{background:"white",borderBottom:`1px solid ${C.border}`,padding:"9px 14px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <button onClick={()=>setMobileOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:3,display:"flex",flexDirection:"column",gap:3}}>
          <div style={{width:17,height:2,background:C.text,borderRadius:1}}/><div style={{width:13,height:2,background:C.text,borderRadius:1}}/><div style={{width:17,height:2,background:C.text,borderRadius:1}}/>
        </button>
        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:C.text,textTransform:"capitalize"}}>{selRep?selRep.name:section.replace(/([A-Z])/," $1")}</div><div style={{fontSize:10,color:C.textMid}}>NextLevel Field Training Hub</div></div>
        <div style={{width:26,height:26,borderRadius:7,background:C.teal+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.teal}}>{session.name?.charAt(0)?.toUpperCase()}</div>
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
