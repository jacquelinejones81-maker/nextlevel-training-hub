import { useState, useCallback } from "react";

const C = {
  navy:"#0d1b2e", navyMid:"#1a2d47", navyLight:"#243a55",
  teal:"#0ea5a0", tealLight:"#14c5bf", tealFade:"rgba(14,165,160,0.12)",
  white:"#ffffff", surface:"#f4f6f9", surfaceCard:"#ffffff",
  border:"rgba(0,0,0,0.08)", borderLight:"rgba(255,255,255,0.08)",
  text:"#1e293b", textMid:"#64748b", textLight:"#94a3b8",
  success:"#10b981", warning:"#f59e0b", danger:"#ef4444",
  purple:"#8b5cf6", gold:"#f59e0b",
};

const TRAINER_CHECKLIST = [
  {id:"t1",cat:"Getting Started",task:"Complete IBA and register for class or self online study",note:"Move within 48 hours"},
  {id:"t2",cat:"Apps & Access",task:"Confirm recruit downloaded Primerica app and logged in within 24 hrs",note:"$50 bonus opportunity"},
  {id:"t3",cat:"Apps & Access",task:"Confirm recruit downloaded Telegram and added to group",link:"https://t.me/+WjPWktwvOpVhZDlh",linkLabel:"Telegram Group"},
  {id:"t4",cat:"Apps & Access",task:"Share app URL with new rep and confirm they have saved it"},
  {id:"t5",cat:"Apps & Access",task:"Give recruit access to new student folder",link:"https://drive.google.com/drive/folders/1IrsYPZyMlaClTLftKSkK6pCxAzVavTPl",linkLabel:"Student Folder"},
  {id:"t6",cat:"References",task:"Get 5 character references (names and phone numbers - MACHO people)"},
  {id:"t7",cat:"Onboarding Videos",task:"Send welcome video link",link:"https://us06web.zoom.us/clips/share/HkOwxveSSd6QaYTXZ0gUgg",linkLabel:"Welcome Video"},
  {id:"t8",cat:"Onboarding Videos",task:"Send orientation video to watch"},
  {id:"t9",cat:"References",task:"Complete character reference calls and book 5 training appointments",link:"https://docs.google.com/document/d/1ju_kh_QbSc5whqLpm8r9190Jr7raYfcGoi2jdDxP49U/edit?usp=sharing",linkLabel:"Call Script"},
  {id:"t10",cat:"Appointments",task:"Share training appointment link with rep",link:"https://calendly.com/jacquelinejones81/trainingappointment",linkLabel:"Schedule Appointment",note:"Add yourself as guest"},
  {id:"t11",cat:"Events",task:"Choose Digital Grand Opening (DGO) date"},
  {id:"t12",cat:"FNA & Personal Plan",task:"Schedule time with RVP to complete personal FNA - Life Insurance and Investment",link:"https://calendly.com/jacquelinejones81/meet-with-coach",linkLabel:"Schedule with Coach",note:"Add yourself as guest"},
  {id:"t13",cat:"Events",task:"Follow up after DGO - debrief, next steps, pipeline review"},
  {id:"t14",cat:"Milestones",task:"First sale milestone - rep writes first policy"},
];

const FAST_START = [
  {id:"f1",cat:"Getting Started",task:"Download Primerica app, register and log in within 24 hrs (earn $50 bonus)"},
  {id:"f2",cat:"Apps & Access",task:"Download Telegram app (team communication)"},
  {id:"f3",cat:"References",task:"Provide 5 professional character references to your trainer"},
  {id:"f4",cat:"Onboarding",task:"Complete Orientation"},
  {id:"f5",cat:"Business Commitment",task:"Business Commitment - pay POL fee and set up business account"},
  {id:"f6",cat:"FNA",task:"Complete your financial needs analysis (Life Insurance and Roth IRA)"},
  {id:"f7",cat:"Events",task:"Schedule Digital Grand Opening (DGO)"},
  {id:"f8",cat:"Events",task:"Attend DGO and debrief afterward"},
  {id:"f9",cat:"Pre-Licensing",task:"Complete Pre-Licensing class (In-Person, Zoom, or Online)"},
  {id:"f10",cat:"Licensing",task:"Schedule exam within 5 days of completing class"},
  {id:"f11",cat:"Licensing",task:"Access exam simulator"},
  {id:"f12",cat:"Licensing",task:"Pass exam - upload pass notice and required docs in Primerica app"},
  {id:"f13",cat:"Licensing",task:"Request License - Now What Checklist"},
];

const REGULAR_START = [
  {id:"r1",cat:"Getting Started",task:"Download Primerica app, register and log in within 24 hrs (earn $50 bonus)"},
  {id:"r2",cat:"Apps & Access",task:"Download Telegram app (team communication)"},
  {id:"r3",cat:"References",task:"Provide 5 character references to your trainer"},
  {id:"r4",cat:"Onboarding",task:"Complete Orientation"},
  {id:"r5",cat:"Business Commitment",task:"Business Commitment - build your financial and business house"},
  {id:"r6",cat:"FNA",task:"Complete your financial needs analysis (Life Insurance and Roth IRA)"},
  {id:"r7",cat:"Events",task:"Schedule Digital Grand Opening (DGO)"},
  {id:"r8",cat:"Events",task:"Attend DGO and debrief afterward"},
  {id:"r9",cat:"Pre-Licensing",task:"Complete Pre-Licensing class (In-Person, Zoom, or Online)"},
  {id:"r10",cat:"Licensing",task:"Schedule exam within 5 days of completing class"},
  {id:"r11",cat:"Licensing",task:"Access exam simulator"},
  {id:"r12",cat:"Licensing",task:"Pass exam - upload pass notice and required docs in Primerica app"},
  {id:"r12b",cat:"Licensing",task:"Request License - Now What Checklist"},
];

const LICENSED_NOW_WHAT = [
  {id:"l1",cat:"Milestones",task:"Become Life Licensed"},
  {id:"l2",cat:"Securities License",task:"Start SIE securities license process"},
  {id:"l2b",cat:"Securities License",task:"Series 6"},
  {id:"l2c",cat:"Securities License",task:"Series 63"},
  {id:"l2d",cat:"Securities License",task:"Series 65"},
  {id:"l2e",cat:"Securities License",task:"Series 26 (if RVP desired)"},
  {id:"l3",cat:"Learning Activity",task:"Complete Life Training Hub: POL > Products > Life Insurance > Life Training Hub"},
  {id:"l4",cat:"Learning Activity",task:"Get certified for Indexed and Fixed annuities"},
  {id:"l5",cat:"Learning Activity",task:"Master the 7 Fundamentals - Prospecting"},
  {id:"l6",cat:"Learning Activity",task:"Master the 7 Fundamentals - Setting Appointments"},
  {id:"l7",cat:"Learning Activity",task:"Master the 7 Fundamentals - Giving a Winning Presentation"},
  {id:"l8",cat:"Learning Activity",task:"Master the 7 Fundamentals - Overcoming Objections"},
  {id:"l9",cat:"Learning Activity",task:"Master the 7 Fundamentals - Closing (Life Insurance)"},
  {id:"l10",cat:"Learning Activity",task:"Master the 7 Fundamentals - Getting Referrals"},
  {id:"l11",cat:"Learning Activity",task:"Master the 7 Fundamentals - Getting a New Rep Started"},
  {id:"l12",cat:"Income Producing",task:"Add 30-60 qualified contacts to CRM weekly"},
  {id:"l13",cat:"Income Producing",task:"Set 15-30 qualified appointments weekly"},
  {id:"l14",cat:"Income Producing",task:"Complete 3 practice life apps in Primerica app"},
  {id:"l15",cat:"Income Producing",task:"Complete 3 practice IBAs in Primerica app"},
  {id:"l16",cat:"Team Schedule",task:"Attend Monday Mindset Monday 7:30 PM CST"},
  {id:"l17",cat:"Team Schedule",task:"Attend Thursday How Money Works Opportunity Night 7:30 PM CST"},
  {id:"l18",cat:"Team Schedule",task:"Attend Saturday Team Training 10:10 AM CST"},
  {id:"l19",cat:"RVP Path",task:"Request RVP checklist when ready"},
];

const RVP_CHECKLIST = [
  {id:"rvp1",cat:"Licensing",task:"Become Life Licensed"},
  {id:"rvp2",cat:"Licensing",task:"Get Securities Licensed - SIE"},
  {id:"rvp3",cat:"Licensing",task:"Series 6"},
  {id:"rvp4",cat:"Licensing",task:"Series 63"},
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
  {day:"Monday",title:"Mindset Monday",time:"7:30 PM CST / 8:30 PM EST",emoji:"??"},
  {day:"Tuesday",title:"SIE Securities Exam Study Group",time:"9:00 PM CST / 10:00 PM EST",note:"Licensed Life Agents only",emoji:"??"},
  {day:"Wednesday",title:"Education Center",time:"9:00 PM CST / 10:00 PM EST",emoji:"??"},
  {day:"Thursday",title:"How Money Works Opportunity Night",time:"7:30 PM CST / 8:30 PM EST",emoji:"??"},
  {day:"Saturday",title:"Team Training",time:"10:10 AM CST / 11:10 AM EST",emoji:"??"},
];

const SCRIPTS = [
  {title:"Setting Appointments - Warm Market",content:"Hey [Name], this is [Your Name]. I am calling because I recently partnered with a financial services company and I am in training. I need to complete some practice appointments and I thought of you. It is completely educational - no pressure, no sales. I just need to practice presenting. Would you be willing to help me out? It only takes about 45 minutes. When works better for you?"},
  {title:"Setting Appointments - New Contact",content:"Hi [Name], my name is [Your Name]. We met [where you met]. I am a financial professional and I am building my practice. I make it a point to sit down with people I meet and just share some information about what I do. There is no obligation whatsoever. I would love to get together for about 45 minutes. Are you available [Day 1] or [Day 2]?"},
  {title:"Opportunity Night Invite",content:"Hey [Name], I am attending a financial education event this [day] and I think you would really get value from it. It is about how money works and strategies people use to build wealth. It is free and only about an hour. I would love for you to come as my guest. Can you make it at [time]?"},
];

const MACHO_LABELS = {M:"Married",A:"Age 25-55",C:"Children",H:"Homeowner",O:"Occupation"};

const LS_KEY = "nlfh_v4";
const loadData = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } };
const saveData = (d) => { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {} };

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
  const done = count && count[0]===count[1];
  return <div style={{display:"flex",alignItems:"center",gap:8,margin:"14px 0 6px"}}><div style={{width:3,height:14,background:done?C.success:color,borderRadius:2}}/><span style={{fontSize:11,fontWeight:700,color:C.textMid,textTransform:"uppercase",letterSpacing:"0.7px",flex:1}}>{title}</span>{count&&<span style={{fontSize:10,color:done?C.success:C.textLight}}>{count[0]}/{count[1]}</span>}</div>;
}

function MachoQ({value={},onChange}) {
  const letters = ["M","A","C","H","O"];
  const score = letters.filter(l=>value[l]).length;
  return <div style={{marginTop:6}}><div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>{letters.map(l=><button key={l} onClick={()=>onChange({...value,[l]:!value[l]})} title={MACHO_LABELS[l]} style={{width:28,height:28,borderRadius:6,border:`1px solid ${value[l]?C.gold:C.border}`,background:value[l]?C.gold+"22":"transparent",color:value[l]?C.gold:C.textLight,fontWeight:700,fontSize:12,cursor:"pointer"}}>{l}</button>)}<span style={{fontSize:11,color:score>=3?C.success:C.textLight,marginLeft:2}}>{score}/5 {score>=3?"Qualified":""}</span></div></div>;
}

function CheckItem({item,checked,onToggle,readOnly}) {
  return <div style={{display:"flex",gap:9,padding:"7px 0",borderBottom:`1px solid ${C.border}`}}><button onClick={!readOnly?onToggle:undefined} style={{width:20,height:20,borderRadius:5,border:`2px solid ${checked?C.teal:C.border}`,background:checked?C.teal:"white",flexShrink:0,marginTop:1,cursor:readOnly?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{checked&&<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}</button><div style={{flex:1}}><div style={{fontSize:13,color:checked?C.textLight:C.text,textDecoration:checked?"line-through":"none",lineHeight:1.4}}>{item.task}</div>{item.note&&<div style={{fontSize:11,color:C.textLight,marginTop:1}}>{item.note}</div>}{item.link&&<a href={item.link} target="_blank" rel="noreferrer" style={{fontSize:11,color:C.teal,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:2,marginTop:2}}>{item.linkLabel||"Open"} &rarr;</a>}</div></div>;
}

function ApptTracker({appointments=[],onChange,readOnly,bookingLink}) {
  const slots = Array.from({length:20},(_,i)=>appointments[i]||{id:i,name:"",phone:"",email:"",date:"",notes:"",macho:{},status:""});
  const logged = slots.filter(a=>a.name).length;
  const done = slots.filter(a=>a.status==="Completed").length;
  const qualified = slots.filter(a=>a.name&&Object.values(a.macho||{}).filter(Boolean).length>=3).length;
  const fmt = v=>{const d=v.replace(/\D/g,"").slice(0,10);if(d.length>=7)return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;if(d.length>=4)return `${d.slice(0,3)}-${d.slice(3)}`;return d;};
  const upd = (i,field,val) => {const arr=[...slots];arr[i]={...arr[i],[field]:field==="phone"?fmt(val):val};onChange(arr.filter(a=>a.name||a.phone||a.date));};
  const updM = (i,macho) => {const arr=[...slots];arr[i]={...arr[i],macho};onChange(arr.filter(a=>a.name||a.phone||a.date));};
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
      {[["Logged",logged,"20",C.teal],["Completed",done,logged||"-",C.success],["Qualified",qualified,logged||"-",C.gold]].map(([l,v,t,c])=><div key={l} style={{background:c+"11",borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:c}}>{v}</div><div style={{fontSize:10,color:C.textMid}}>{l}</div><div style={{fontSize:10,color:C.textLight}}>of {t}</div></div>)}
    </div>
    <Bar pct={(logged/20)*100} h={4}/>
    {bookingLink&&!readOnly&&<div style={{background:C.gold+"11",border:`1px solid ${C.gold}33`,borderRadius:8,padding:"8px 12px",margin:"10px 0",fontSize:12}}><a href={bookingLink} target="_blank" rel="noreferrer" style={{color:C.gold,fontWeight:600}}>Schedule Training Appointment &rarr;</a><div style={{color:C.textMid,marginTop:2,fontSize:11}}>Add yourself as "guest" to receive notifications</div></div>}
    <div style={{marginTop:10}}>
      {slots.map((a,i)=><div key={i} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:10,marginBottom:6,background:a.status==="Completed"?C.success+"08":"white"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontSize:10,fontWeight:700,color:C.textLight,textTransform:"uppercase"}}>Appt #{i+1}</span>
          {!readOnly&&<select value={a.status||""} onChange={e=>upd(i,"status",e.target.value)} style={{fontSize:11,padding:"2px 5px",borderRadius:5,border:`1px solid ${C.border}`,color:C.text}}><option value="">Set</option><option value="Completed">Completed</option><option value="Cancelled">Cancelled</option></select>}
          {readOnly&&a.status&&<Badge color={a.status==="Completed"?C.success:C.warning} small>{a.status}</Badge>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
          {[["name","Name"],["phone","Phone"],["email","Email"],["date","Date"]].map(([f,ph])=><input key={f} type={f==="date"?"date":"text"} placeholder={ph} value={a[f]||""} readOnly={readOnly} onChange={e=>upd(i,f,e.target.value)} style={{padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,background:readOnly?C.surface:"white",color:C.text}}/>)}
        </div>
        <textarea placeholder="Notes" value={a.notes||""} readOnly={readOnly} onChange={e=>upd(i,"notes",e.target.value)} style={{width:"100%",marginTop:5,padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,resize:"vertical",minHeight:36,background:readOnly?C.surface:"white",color:C.text,boxSizing:"border-box"}}/>
        {!readOnly&&<MachoQ value={a.macho||{}} onChange={m=>updM(i,m)}/>}
        {readOnly&&a.macho&&Object.keys(a.macho).length>0&&<div style={{display:"flex",gap:3,marginTop:4}}>{["M","A","C","H","O"].map(l=><span key={l} style={{width:20,height:20,borderRadius:4,background:a.macho[l]?C.gold+"22":C.surface,color:a.macho[l]?C.gold:C.textLight,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{l}</span>)}<span style={{fontSize:10,color:C.textLight,marginLeft:3,alignSelf:"center"}}>{Object.values(a.macho).filter(Boolean).length}/5</span></div>}
      </div>)}
    </div>
  </div>;
}

function RepView({rep,data,onUpdate,readOnly}) {
  const [tab,setTab] = useState("checklist");
  const track = TRACK_INFO[rep.track];
  const cl = track?.checklist||[];
  const checked = rep.checked||{};
  const done = cl.filter(i=>checked[i.id]).length;
  const pct = cl.length>0?Math.round((done/cl.length)*100):0;
  const cats = cl.reduce((a,i)=>{if(!a[i.cat])a[i.cat]=[];a[i.cat].push(i);return a;},{});
  const trainer = data.trainers?.find(t=>t.id===rep.trainerId);
  const bookingLink = trainer?.bookingLink||"https://calendly.com/jacquelinejones81/trainingappointment";
  const tabs = [{k:"checklist",l:"Checklist"},...(rep.track!=="licensed"?[{k:"appointments",l:`Appointments (${(rep.appointments||[]).length})`}]:[]),{k:"refs",l:"References"},{k:"scripts",l:"Scripts"},{k:"schedule",l:"Schedule"},{k:"rvp",l:"RVP Path"}];
  const tog = (id) => { if(!readOnly) onUpdate(rep.id,{...rep,checked:{...checked,[id]:!checked[id]}}); };
  const togRvp = (id) => { if(!readOnly) onUpdate(rep.id,{...rep,rvpChecked:{...(rep.rvpChecked||{}),[id]:!(rep.rvpChecked||{})[id]}}); };
  return <div>
    <div style={{background:`linear-gradient(135deg,${C.navy} 0%,${C.navyMid} 100%)`,borderRadius:12,padding:"14px 18px",marginBottom:14,color:"white"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div><div style={{fontSize:15,fontWeight:700}}>{rep.name}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginTop:2}}>{track?.label} &middot; {track?.days}</div></div>
        <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:700,color:C.teal}}>{pct}%</div><div style={{fontSize:9,color:"rgba(255,255,255,0.4)"}}>COMPLETE</div></div>
      </div>
      <Bar pct={pct} h={5}/>
      {pct===100&&<div style={{marginTop:8,background:C.success+"22",border:`1px solid ${C.success}44`,borderRadius:8,padding:"6px 10px",fontSize:12,color:C.success,textAlign:"center",fontWeight:600}}>All tasks complete!</div>}
    </div>
    <div style={{display:"flex",gap:3,overflowX:"auto",marginBottom:12,paddingBottom:2}}>
      {tabs.map(t=><button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"6px 10px",borderRadius:8,border:"none",cursor:"pointer",whiteSpace:"nowrap",fontSize:11,fontWeight:tab===t.k?600:400,background:tab===t.k?C.teal:C.surface,color:tab===t.k?"white":C.textMid}}>{t.l}</button>)}
    </div>
    {tab==="checklist"&&<div>
      {Object.entries(cats).map(([cat,items])=>{const cd=items.filter(i=>checked[i.id]).length;return <div key={cat}><SecHead title={cat} count={[cd,items.length]}/>{items.map(item=><CheckItem key={item.id} item={item} checked={!!checked[item.id]} onToggle={()=>tog(item.id)} readOnly={readOnly}/>)}</div>;})}
      <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[{label:"FTO Observations",key:"ftoCount",goal:20,color:C.purple,note:"Goal: 20 FTO"},{label:"Life Apps Done",key:"lifeAppCount",goal:10,color:C.teal,note:"Goal: 10 during training"},{label:"Investments",key:"pacCount",goal:10,color:C.gold,note:"Builds your future AUM"}].map(c=><Card key={c.key} style={{padding:"10px 12px"}}>
          <div style={{fontSize:11,color:C.textMid,marginBottom:4}}>{c.label}</div>
          <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{fontSize:22,fontWeight:700,color:c.color}}>{rep[c.key]||0}</div><div style={{flex:1}}><Bar pct={((rep[c.key]||0)/c.goal)*100} color={c.color}/></div><div style={{fontSize:10,color:C.textLight}}>/{c.goal}</div></div>
          {!readOnly&&<div style={{display:"flex",gap:5,marginTop:6}}><button onClick={()=>onUpdate(rep.id,{...rep,[c.key]:Math.max(0,(rep[c.key]||0)-1)})} style={{flex:1,padding:"3px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",fontSize:15,color:C.textMid}}>-</button><button onClick={()=>onUpdate(rep.id,{...rep,[c.key]:(rep[c.key]||0)+1})} style={{flex:1,padding:"3px",borderRadius:6,border:`1px solid ${c.color}`,background:c.color+"11",cursor:"pointer",fontSize:15,color:c.color,fontWeight:700}}>+</button></div>}
          <div style={{fontSize:10,color:C.textLight,marginTop:3}}>{c.note}</div>
        </Card>)}
      </div>
    </div>}
    {tab==="appointments"&&<ApptTracker appointments={rep.appointments||[]} onChange={a=>onUpdate(rep.id,{...rep,appointments:a})} readOnly={readOnly} bookingLink={bookingLink}/>}
    {tab==="refs"&&<div>
      {Array.from({length:5},(_,i)=>{const r=(rep.references||[])[i]||{};return <div key={i} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:10,marginBottom:6}}><div style={{fontSize:10,fontWeight:700,color:C.textLight,marginBottom:5}}>Reference #{i+1}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>{[["name","Name"],["phone","Phone"],["relationship","Relationship"]].map(([f,ph])=><input key={f} placeholder={ph} value={r[f]||""} readOnly={readOnly} onChange={e=>{const refs=Array.from({length:5},(_,j)=>(rep.references||[])[j]||{});refs[i]={...refs[i],[f]:e.target.value};onUpdate(rep.id,{...rep,references:refs});}} style={{padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:readOnly?C.surface:"white",gridColumn:f==="relationship"?"span 2":"auto"}}/>)}</div></div>;})}
    </div>}
    {tab==="scripts"&&<div>{SCRIPTS.map((s,i)=><Card key={i} style={{marginBottom:10}}><div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:8}}>{s.title}</div><div style={{background:C.surface,borderRadius:8,padding:"10px 12px",fontSize:12,color:C.textMid,lineHeight:1.6}}>"{s.content}"</div></Card>)}</div>}
    {tab==="schedule"&&<div>{TEAM_SCHEDULE.map((s,i)=><div key={i} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}><div style={{fontSize:14,fontWeight:600,color:C.text,flex:1}}>{s.day} - {s.title}</div><div style={{fontSize:11,color:C.textLight,textAlign:"right"}}>{s.time}{s.note&&<div>{s.note}</div>}</div></div>)}</div>}
    {tab==="rvp"&&<div>{Object.entries(RVP_CHECKLIST.reduce((a,i)=>{if(!a[i.cat])a[i.cat]=[];a[i.cat].push(i);return a;},{})).map(([cat,items])=><div key={cat}><SecHead title={cat} color={C.gold}/>{items.map(item=><CheckItem key={item.id} item={item} checked={!!(rep.rvpChecked||{})[item.id]} onToggle={()=>togRvp(item.id)} readOnly={readOnly}/>)}</div>)}</div>}
  </div>;
}

function RepProfile({rep,data,onUpdate,onBack}) {
  const [tab,setTab] = useState("trainer");
  const track = TRACK_INFO[rep.track];
  const tc = rep.trainerChecked||{};
  const trDone = TRAINER_CHECKLIST.filter(i=>tc[i.id]).length;
  const cl = track?.checklist||[];
  const repDone = cl.filter(i=>(rep.checked||{})[i.id]).length;
  const [ciNote,setCiNote] = useState("");
  const tabs = [{k:"trainer",l:"Trainer"},{k:"rep",l:track?.label||"Rep"},{k:"appointments",l:`Appointments (${(rep.appointments||[]).length})`},{k:"refs",l:"References"},{k:"checkins",l:"Check-ins"},{k:"rvp",l:"RVP Path"}];
  const togT = (id) => onUpdate(rep.id,{...rep,trainerChecked:{...tc,[id]:!tc[id]}});
  const addCI = () => { if(!ciNote.trim())return; onUpdate(rep.id,{...rep,checkIns:[...(rep.checkIns||[]),{date:new Date().toISOString(),note:ciNote}]}); setCiNote(""); };
  return <div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button onClick={onBack} style={{background:C.surface,border:"none",padding:"6px 10px",borderRadius:8,cursor:"pointer",fontSize:12,color:C.textMid}}>&larr; Back</button>
      <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:C.text}}>{rep.name}</div><div style={{fontSize:11,color:C.textMid}}>{rep.phone} &middot; <Badge color={track?.color||C.teal} small>{track?.label}</Badge></div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
      <Card style={{padding:"10px 12px"}}><div style={{fontSize:10,color:C.textMid,marginBottom:3}}>Trainer</div><div style={{fontSize:18,fontWeight:700,color:C.teal}}>{Math.round((trDone/TRAINER_CHECKLIST.length)*100)}%</div><Bar pct={(trDone/TRAINER_CHECKLIST.length)*100}/><div style={{fontSize:10,color:C.textLight,marginTop:3}}>{trDone}/{TRAINER_CHECKLIST.length} tasks</div></Card>
      <Card style={{padding:"10px 12px"}}><div style={{fontSize:10,color:C.textMid,marginBottom:3}}>Rep</div><div style={{fontSize:18,fontWeight:700,color:track?.color||C.purple}}>{Math.round((repDone/(cl.length||1))*100)}%</div><Bar pct={(repDone/(cl.length||1))*100} color={track?.color||C.purple}/><div style={{fontSize:10,color:C.textLight,marginTop:3}}>{repDone}/{cl.length} tasks</div></Card>
    </div>
    <Card style={{marginBottom:12,padding:"10px 14px"}}>
      <div style={{fontSize:11,fontWeight:700,color:C.textMid,marginBottom:8}}>Rep-Entered Data</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
        {[{l:"DGO Date",v:rep.dgoDate||"Not set",c:C.teal},{l:"Business Commit",v:rep.businessCommitment?`$${rep.businessCommitment}`:"Not set",c:C.gold},{l:"Investments",v:`${rep.pacCount||0} logged`,c:C.purple}].map(d=><div key={d.l} style={{textAlign:"center",padding:"7px",background:C.surface,borderRadius:8}}><div style={{fontSize:13,fontWeight:700,color:d.c}}>{d.v}</div><div style={{fontSize:9,color:C.textLight}}>{d.l}</div></div>)}
      </div>
      {(rep.investmentClients||[]).length>0&&<div style={{marginTop:8}}><div style={{fontSize:10,color:C.textMid,marginBottom:4}}>Future Investment Clients</div>{rep.investmentClients.map((c,i)=><div key={i} style={{fontSize:12,color:C.text,padding:"3px 0",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between"}}><span>{c.name}</span>{!c.moved&&<button onClick={()=>onUpdate(rep.id,{...rep,investmentClients:rep.investmentClients.map((cl,j)=>j===i?{...cl,moved:true}:cl)})} style={{fontSize:10,color:C.teal,background:"none",border:"none",cursor:"pointer"}}>Mark Moved</button>}</div>)}</div>}
    </Card>
    <div style={{display:"flex",gap:3,overflowX:"auto",marginBottom:10}}>
      {tabs.map(t=><button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"5px 9px",borderRadius:8,border:"none",cursor:"pointer",whiteSpace:"nowrap",fontSize:11,fontWeight:tab===t.k?600:400,background:tab===t.k?C.navy:C.surface,color:tab===t.k?"white":C.textMid}}>{t.l}</button>)}
    </div>
    {tab==="trainer"&&<div>{Object.entries(TRAINER_CHECKLIST.reduce((a,i)=>{if(!a[i.cat])a[i.cat]=[];a[i.cat].push(i);return a;},{})).map(([cat,items])=>{const cd=items.filter(i=>tc[i.id]).length;return <div key={cat}><SecHead title={cat} count={[cd,items.length]}/>{items.map(item=><CheckItem key={item.id} item={item} checked={!!tc[item.id]} onToggle={()=>togT(item.id)}/>)}</div>;})}</div>}
    {tab==="rep"&&<RepView rep={rep} data={data} onUpdate={onUpdate} readOnly={false}/>}
    {tab==="appointments"&&<ApptTracker appointments={rep.appointments||[]} onChange={a=>onUpdate(rep.id,{...rep,appointments:a})}/>}
    {tab==="refs"&&<div>{(rep.references||[]).length===0?<div style={{color:C.textLight,fontSize:13,padding:"12px 0"}}>No references entered yet</div>:(rep.references||[]).filter(r=>r.name).map((r,i)=><div key={i} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:9,marginBottom:6,display:"flex",gap:10,alignItems:"center"}}><div style={{width:28,height:28,borderRadius:7,background:C.teal+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:C.teal}}>{i+1}</div><div><div style={{fontSize:13,fontWeight:600,color:C.text}}>{r.name}</div><div style={{fontSize:11,color:C.textMid}}>{r.phone}{r.relationship&&` - ${r.relationship}`}</div></div></div>)}</div>}
    {tab==="checkins"&&<div>
      {(()=>{const cis=rep.checkIns||[];const last=cis.length>0?new Date(cis[cis.length-1].date):null;const ds=last?Math.floor((Date.now()-last)/(86400000)):null;const stalled=ds===null||ds>=3;return <div style={{background:stalled?C.danger+"11":C.success+"11",border:`1px solid ${stalled?C.danger+"33":C.success+"33"}`,borderRadius:8,padding:"7px 10px",marginBottom:10,fontSize:12,color:stalled?C.danger:C.success}}>{ds===null?"No check-ins logged yet":ds===0?"Checked in today":`Last check-in ${ds} days ago`}</div>;})()}
      <div style={{display:"flex",gap:7,marginBottom:12}}><input placeholder="Log a check-in note..." value={ciNote} onChange={e=>setCiNote(e.target.value)} style={{flex:1,padding:"7px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text}}/><button onClick={addCI} style={{padding:"7px 12px",borderRadius:8,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:600}}>Log</button></div>
      {(rep.checkIns||[]).slice().reverse().map((ci,i)=><div key={i} style={{padding:"7px 0",borderBottom:`1px solid ${C.border}`}}><div style={{fontSize:12,color:C.text}}>{ci.note}</div><div style={{fontSize:10,color:C.textLight,marginTop:1}}>{new Date(ci.date).toLocaleDateString()}</div></div>)}
    </div>}
    {tab==="rvp"&&<div>{Object.entries(RVP_CHECKLIST.reduce((a,i)=>{if(!a[i.cat])a[i.cat]=[];a[i.cat].push(i);return a;},{})).map(([cat,items])=><div key={cat}><SecHead title={cat} color={C.gold}/>{items.map(item=><CheckItem key={item.id} item={item} checked={!!(rep.rvpChecked||{})[item.id]} onToggle={()=>onUpdate(rep.id,{...rep,rvpChecked:{...(rep.rvpChecked||{}),[item.id]:!(rep.rvpChecked||{})[item.id]}})}/>)}</div>)}</div>}
  </div>;
}

function MyProd({myProd,onUpdate}) {
  const [open,setOpen] = useState(false);
  const [tab,setTab] = useState("lifeapps");
  const [na,setNa] = useState({clientName:"",premium:"",date:""});
  const [ni,setNi] = useState({clientName:"",pac:"",lumpSum:"",type:"Mutual Fund"});
  const apps = myProd.lifeApps||[];
  const invs = myProd.investments||[];
  const totPrem = apps.reduce((s,a)=>s+(Number(a.premium)||0),0);
  const totPAC = invs.reduce((s,i)=>s+(Number(i.pac)||0),0);
  const totLump = invs.reduce((s,i)=>s+(Number(i.lumpSum)||0),0);
  return <Card style={{marginBottom:14}}>
    <div onClick={()=>setOpen(!open)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
      <div><div style={{fontSize:13,fontWeight:700,color:C.text}}>My Production</div><div style={{fontSize:11,color:C.textMid,marginTop:1}}>{apps.length} apps &middot; ${totPrem.toFixed(0)}/mo &middot; {invs.length} investments</div></div>
      <span style={{color:C.textLight,fontSize:18,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>v</span>
    </div>
    {open&&<div style={{marginTop:12}}>
      <div style={{display:"flex",gap:3,marginBottom:10}}>
        {[["lifeapps","Life Apps"],["investments","Investments"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:"4px 10px",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,fontWeight:tab===k?600:400,background:tab===k?C.teal:"transparent",color:tab===k?"white":C.textMid}}>{l}</button>)}
      </div>
      {tab==="lifeapps"&&<div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:10}}>
          <div style={{background:C.teal+"11",borderRadius:8,padding:"7px 10px",textAlign:"center"}}><div style={{fontSize:17,fontWeight:700,color:C.teal}}>{apps.length}</div><div style={{fontSize:10,color:C.textMid}}>Life Apps</div></div>
          <div style={{background:C.gold+"11",borderRadius:8,padding:"7px 10px",textAlign:"center"}}><div style={{fontSize:17,fontWeight:700,color:C.gold}}>${totPrem.toFixed(0)}/mo</div><div style={{fontSize:10,color:C.textMid}}>${(totPrem*12).toFixed(0)}/yr</div></div>
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
        {apps.map((a,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${C.border}`,fontSize:11}}><span style={{color:C.text}}>{a.clientName}</span><div style={{display:"flex",gap:7,alignItems:"center"}}>{a.premium&&<span style={{color:C.gold}}>${a.premium}/mo</span>}<button onClick={()=>onUpdate({...myProd,lifeApps:apps.filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer",fontSize:14}}>x</button></div></div>)}
      </div>}
      {tab==="investments"&&<div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
          {[[invs.length,"Investments",C.teal],[`$${totPAC.toFixed(0)}/mo`,"PAC Total",C.gold],[`$${totLump.toFixed(0)}`,"Lump Sum",C.purple]].map(([v,l,c])=><div key={l} style={{background:c+"11",borderRadius:8,padding:"7px 8px",textAlign:"center"}}><div style={{fontSize:15,fontWeight:700,color:c}}>{v}</div><div style={{fontSize:9,color:C.textMid}}>{l}</div></div>)}
        </div>
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

function ProdDash({data,onUpdateData}) {
  const reps = data.reps||[];
  const trainers = data.trainers||[];
  const goals = data.goals||{premium:10000,recruits:10,licensed:100};
  const [editG,setEditG] = useState(false);
  const [gd,setGd] = useState(goals);
  const totPremMo = reps.reduce((s,r)=>s+(Number(r.premiumSubmitted)||0),0)+trainers.reduce((s,t)=>{const a=(data.myProduction?.[t.id]?.lifeApps)||[];return s+a.reduce((ss,a)=>ss+(Number(a.premium)||0),0);},0);
  const totRecs = reps.length;
  const totLic = reps.filter(r=>r.isLicensed).length;
  return <Card style={{marginBottom:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:13,fontWeight:700,color:C.text}}>Team Production</div><button onClick={()=>setEditG(!editG)} style={{fontSize:11,padding:"3px 9px",borderRadius:6,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.textMid}}>{editG?"Cancel":"Edit Goals"}</button></div>
    {editG&&<div style={{background:C.surface,borderRadius:8,padding:9,marginBottom:10}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}>{[["premium","Annual Premium $",gd.premium],["recruits","Recruits",gd.recruits],["licensed","Licensed Agents",gd.licensed]].map(([k,l,v])=><div key={k}><div style={{fontSize:10,color:C.textMid,marginBottom:3}}>{l}</div><input type="number" value={v} onChange={e=>setGd({...gd,[k]:Number(e.target.value)})} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,boxSizing:"border-box",color:C.text}}/></div>)}</div>
      <button onClick={()=>{onUpdateData({...data,goals:gd});setEditG(false);}} style={{marginTop:7,width:"100%",padding:"6px",borderRadius:7,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:11,fontWeight:600}}>Save Goals</button>
    </div>}
    {[{l:"Annual Premium",v:totPremMo*12,goal:goals.premium,fmt:v=>`$${Math.round(v).toLocaleString()}`,c:C.teal,sub:`$${totPremMo.toFixed(0)}/mo`},{l:"New Recruits",v:totRecs,goal:goals.recruits,fmt:v=>v,c:C.purple},{l:"Licensed Agents",v:totLic,goal:goals.licensed,fmt:v=>v,c:C.gold}].map(g=><div key={g.l} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:C.textMid}}>{g.l}</span><span style={{fontSize:12,fontWeight:600,color:g.v>=g.goal?C.success:C.text}}>{g.fmt(g.v)} / {g.fmt(g.goal)}</span></div>{g.sub&&<div style={{fontSize:10,color:C.textLight,marginBottom:3}}>{g.sub}</div>}<Bar pct={(g.v/g.goal)*100} color={g.v>=g.goal?C.success:g.c}/></div>)}
    <div style={{marginTop:10}}><div style={{fontSize:10,fontWeight:700,color:C.textMid,marginBottom:5}}>Update Rep Premium</div>{reps.map(r=><div key={r.id} style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}><span style={{fontSize:11,color:C.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</span><input type="number" placeholder="$/mo" value={r.premiumSubmitted||""} onChange={e=>onUpdateData({...data,reps:data.reps.map(rep=>rep.id===r.id?{...rep,premiumSubmitted:Number(e.target.value)}:rep)})} style={{width:75,padding:"3px 6px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}/><label style={{display:"flex",alignItems:"center",gap:3,fontSize:10,color:C.textMid,cursor:"pointer"}}><input type="checkbox" checked={!!r.isLicensed} onChange={e=>onUpdateData({...data,reps:data.reps.map(rep=>rep.id===r.id?{...rep,isLicensed:e.target.checked}:rep)})}/>Lic</label></div>)}</div>
  </Card>;
}

function AddRep({onAdd,onClose,trainers}) {
  const [f,setF] = useState({name:"",phone:"",track:"fast",trainerId:"",startDate:new Date().toISOString().split("T")[0],graduationDate:""});
  const fmtP = v=>{const d=v.replace(/\D/g,"").slice(0,10);if(d.length>=7)return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;if(d.length>=4)return `${d.slice(0,3)}-${d.slice(3)}`;return d;};
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
    <div style={{background:"white",borderRadius:16,padding:22,width:"100%",maxWidth:420,maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div style={{fontSize:15,fontWeight:700,color:C.text}}>Add New Rep</div><button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.textMid}}>x</button></div>
      {[{fld:"name",l:"Full Name",t:"text"},{fld:"phone",l:"Phone",t:"text"},{fld:"startDate",l:"Start Date",t:"date"},{fld:"graduationDate",l:"Target Graduation",t:"date"}].map(({fld,l,t})=><div key={fld} style={{marginBottom:9}}><label style={{fontSize:11,color:C.textMid,display:"block",marginBottom:3}}>{l}</label><input type={t} value={f[fld]} onChange={e=>setF({...f,[fld]:fld==="phone"?fmtP(e.target.value):e.target.value})} style={{width:"100%",padding:"8px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text,boxSizing:"border-box"}}/></div>)}
      <div style={{marginBottom:9}}><label style={{fontSize:11,color:C.textMid,display:"block",marginBottom:5}}>Track</label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>{Object.entries(TRACK_INFO).map(([k,ti])=><button key={k} onClick={()=>setF({...f,track:k})} style={{padding:"7px",borderRadius:8,border:`2px solid ${f.track===k?ti.color:C.border}`,background:f.track===k?ti.color+"11":"white",cursor:"pointer"}}><div style={{fontSize:10,fontWeight:700,color:f.track===k?ti.color:C.textMid}}>{ti.label}</div><div style={{fontSize:9,color:C.textLight}}>{ti.days}</div></button>)}</div></div>
      {trainers.length>0&&<div style={{marginBottom:9}}><label style={{fontSize:11,color:C.textMid,display:"block",marginBottom:3}}>Assign Trainer</label><select value={f.trainerId} onChange={e=>setF({...f,trainerId:e.target.value})} style={{width:"100%",padding:"8px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text}}><option value="">No trainer</option>{trainers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>}
      <button onClick={()=>{if(f.name){onAdd(f);onClose();}}} style={{width:"100%",padding:"10px",borderRadius:8,background:C.teal,color:"white",border:"none",fontWeight:600,fontSize:13,cursor:"pointer",marginTop:4}}>Add Rep</button>
    </div>
  </div>;
}

function ManageTeam({data,onUpdate,onClose}) {
  const [nt,setNt] = useState({name:"",pin:"",bookingLink:""});
  const [na,setNa] = useState({name:"",pin:""});
  const trainers = data.trainers||[];
  const admins = data.admins||[{id:"superadmin",name:"Admin (You)",pin:"1234",isSuperAdmin:true}];
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
    <div style={{background:"white",borderRadius:16,padding:22,width:"100%",maxWidth:460,maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}><div style={{fontSize:15,fontWeight:700,color:C.text}}>Manage Team</div><button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.textMid}}>x</button></div>
      <div style={{marginBottom:14}}><div style={{fontSize:12,fontWeight:700,color:C.textMid,marginBottom:7}}>Admins</div>
        {admins.map((a,i)=><div key={a.id} style={{display:"flex",gap:7,alignItems:"center",marginBottom:5}}><span style={{fontSize:12,flex:1,color:C.text}}>{a.name}</span><input placeholder="PIN" maxLength={6} value={a.pin} onChange={e=>{const u=admins.map((ad,j)=>j===i?{...ad,pin:e.target.value.replace(/\D/,"")}:ad);onUpdate({...data,admins:u});}} style={{width:65,padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,textAlign:"center",letterSpacing:"2px",color:C.text}}/>{!a.isSuperAdmin&&<button onClick={()=>onUpdate({...data,admins:admins.filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer"}}>x</button>}</div>)}
        <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:5,marginTop:6}}><input placeholder="Admin name" value={na.name} onChange={e=>setNa({...na,name:e.target.value})} style={{padding:"5px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}/><input placeholder="PIN" maxLength={6} value={na.pin} onChange={e=>setNa({...na,pin:e.target.value.replace(/\D/,"")})} style={{width:60,padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,textAlign:"center",letterSpacing:"2px",color:C.text}}/><button onClick={()=>{if(na.name&&na.pin){onUpdate({...data,admins:[...admins,{...na,id:"admin_"+Date.now()}]});setNa({name:"",pin:""});}}} style={{padding:"5px 10px",borderRadius:6,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:11}}>Add</button></div>
      </div>
      <div><div style={{fontSize:12,fontWeight:700,color:C.textMid,marginBottom:7}}>Field Trainers</div>
        {trainers.map((t,i)=><div key={t.id} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:9,marginBottom:7}}><div style={{display:"flex",gap:7,alignItems:"center",marginBottom:5}}><span style={{fontSize:12,flex:1,fontWeight:600,color:C.text}}>{t.name}</span><input placeholder="PIN" maxLength={6} value={t.pin} onChange={e=>{const u=trainers.map((tr,j)=>j===i?{...tr,pin:e.target.value.replace(/\D/,"")}:tr);onUpdate({...data,trainers:u});}} style={{width:65,padding:"3px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,textAlign:"center",letterSpacing:"2px",color:C.text}}/><button onClick={()=>onUpdate({...data,trainers:trainers.filter((_,j)=>j!==i)})} style={{color:C.danger,background:"none",border:"none",cursor:"pointer"}}>x</button></div><input placeholder="Booking link" value={t.bookingLink||""} onChange={e=>{const u=trainers.map((tr,j)=>j===i?{...tr,bookingLink:e.target.value}:tr);onUpdate({...data,trainers:u});}} style={{width:"100%",padding:"4px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:10,color:C.text,boxSizing:"border-box"}}/></div>)}
        <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:5,marginTop:6}}><input placeholder="Trainer name" value={nt.name} onChange={e=>setNt({...nt,name:e.target.value})} style={{padding:"5px 9px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}/><input placeholder="PIN" maxLength={6} value={nt.pin} onChange={e=>setNt({...nt,pin:e.target.value.replace(/\D/,"")})} style={{width:60,padding:"5px 7px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,textAlign:"center",letterSpacing:"2px",color:C.text}}/><button onClick={()=>{if(nt.name&&nt.pin){onUpdate({...data,trainers:[...trainers,{...nt,id:"trainer_"+Date.now()}]});setNt({name:"",pin:"",bookingLink:""});}}} style={{padding:"5px 10px",borderRadius:6,background:C.teal,color:"white",border:"none",cursor:"pointer",fontSize:11}}>Add</button></div>
      </div>
    </div>
  </div>;
}

function Dashboard({data,onUpdate,userRole,userId,onSelectRep}) {
  const [search,setSearch] = useState("");
  const [filter,setFilter] = useState("all");
  const [showAdd,setShowAdd] = useState(false);
  const [showManage,setShowManage] = useState(false);
  const reps = (data.reps||[]).filter(r=>userRole==="trainer"?r.trainerId===userId:true);
  const filtered = reps.filter(r=>(r.name.toLowerCase().includes(search.toLowerCase())||r.phone?.includes(search))&&(filter==="all"||r.track===filter));
  const addRep = f => onUpdate({...data,reps:[...(data.reps||[]),{...f,id:"rep_"+Date.now(),checked:{},trainerChecked:{},appointments:[],references:[],checkIns:[],repPin:null}]});
  const trainers = data.trainers||[];
  const stats = [{l:"Total Reps",v:reps.length,c:C.teal},{l:"Fast Start",v:reps.filter(r=>r.track==="fast").length,c:C.teal},{l:"Licensed",v:reps.filter(r=>r.track==="licensed").length,c:C.gold},{l:"Graduated",v:reps.filter(r=>{const cl=TRACK_INFO[r.track]?.checklist||[];return cl.length>0&&cl.every(i=>(r.checked||{})[i.id])}).length,c:C.success}];
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:14}}>
      {stats.map(s=><Card key={s.l} style={{padding:"9px 11px",textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:C.textMid,textTransform:"uppercase",letterSpacing:"0.5px"}}>{s.l}</div></Card>)}
    </div>
    {(userRole==="admin"||userRole==="superadmin")&&<ProdDash data={data} onUpdateData={onUpdate}/>}
    {userRole==="trainer"&&<MyProd myProd={(data.myProduction||{})[userId]||{}} onUpdate={p=>onUpdate({...data,myProduction:{...(data.myProduction||{}),[userId]:p}})}/>}
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
      const stalled=ds===null||ds>=7;
      const grad=cl.length>0&&cl.every(i=>(rep.checked||{})[i.id]);
      const trainer=trainers.find(t=>t.id===rep.trainerId);
      return <div key={rep.id} onClick={()=>onSelectRep(rep.id)} style={{background:"white",borderRadius:12,border:`1px solid ${stalled&&!grad?C.danger+"44":C.border}`,padding:"12px 14px",marginBottom:7,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.borderColor=grad?C.success:C.teal} onMouseLeave={e=>e.currentTarget.style.borderColor=stalled&&!grad?C.danger+"44":C.border}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:7}}>
          <div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:7}}><span style={{fontSize:13,fontWeight:700,color:C.text}}>{rep.name}</span>{grad&&<Badge color={C.success} small>Graduated</Badge>}{stalled&&!grad&&<Badge color={C.danger} small>Stalled</Badge>}</div><div style={{fontSize:11,color:C.textMid,marginTop:1}}>{rep.phone}{trainer&&<span> &middot; {trainer.name}</span>}</div></div>
          <Badge color={track?.color||C.teal} small>{track?.label}</Badge>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:5}}>
          <div><div style={{fontSize:9,color:C.textMid,marginBottom:2}}>Trainer {trPct}%</div><Bar pct={trPct} h={3}/></div>
          <div><div style={{fontSize:9,color:C.textMid,marginBottom:2}}>Rep {pct}%</div><Bar pct={pct} color={track?.color||C.purple} h={3}/></div>
        </div>
        <div style={{fontSize:10,color:C.textLight}}>{ds===null?"No check-ins":ds===0?"Checked in today":`${ds}d since check-in`}{rep.dgoDate&&<span> &middot; DGO: {rep.dgoDate}</span>}</div>
      </div>;
    })}
    {showAdd&&<AddRep onAdd={addRep} onClose={()=>setShowAdd(false)} trainers={trainers}/>}
    {showManage&&<ManageTeam data={data} onUpdate={onUpdate} onClose={()=>setShowManage(false)}/>}
  </div>;
}

function LoginScreen({data,onLogin}) {
  const [mode,setMode] = useState("select");
  const [pin,setPin] = useState("");
  const [search,setSearch] = useState("");
  const [selRep,setSelRep] = useState(null);
  const [rPin,setRPin] = useState("");
  const [rPinC,setRPinC] = useState("");
  const [step,setStep] = useState("find");
  const [err,setErr] = useState("");
  const admins = data.admins||[{id:"superadmin",name:"Admin (You)",pin:"1234",isSuperAdmin:true}];
  const trainers = data.trainers||[];
  const reps = data.reps||[];
  const doAdminLogin = () => { const f=admins.find(a=>a.pin===pin); if(f){setErr("");onLogin("admin",f.id,f);}else setErr("Incorrect PIN"); };
  const doTrainerLogin = () => { const f=trainers.find(t=>t.pin===pin); if(f){setErr("");onLogin("trainer",f.id,f);}else setErr("Incorrect PIN"); };
  const doRepLogin = () => {
    if(step==="create"){if(rPin.length!==4){setErr("PIN must be 4 digits");return;}if(rPin!==rPinC){setErr("PINs do not match");return;}onLogin("rep",selRep.id,selRep,rPin);}
    else{if(rPin===selRep.repPin){setErr("");onLogin("rep",selRep.id,selRep);}else{setErr("Incorrect PIN");setRPin("");}}
  };
  const filtReps = search.length>0?reps.filter(r=>r.name.toLowerCase().includes(search.toLowerCase())):[];
  const inp = {width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid rgba(0,0,0,0.12)`,fontSize:13,outline:"none",background:"white",boxSizing:"border-box",color:C.text};
  return <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${C.navy} 0%,${C.navyMid} 60%,${C.navyLight} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{width:"100%",maxWidth:420}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:60,height:60,background:"rgba(14,165,160,0.15)",border:"1px solid rgba(14,165,160,0.3)",borderRadius:15,marginBottom:10}}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 3L2 9V19L14 25L26 19V9L14 3Z" stroke={C.teal} strokeWidth="2" fill="none"/><path d="M8 14L12 18L20 10" stroke={C.teal} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{color:"white",fontSize:20,fontWeight:700}}>NextLevel Field Training Hub</div>
        <div style={{color:"rgba(255,255,255,0.45)",fontSize:12,marginTop:3}}>Team Onboarding and Production Tracker</div>
      </div>
      <div style={{background:"white",borderRadius:16,padding:24,boxShadow:"0 20px 50px rgba(0,0,0,0.3)"}}>
        {mode==="select"&&<div>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:4}}>Welcome back</div>
          <div style={{fontSize:12,color:C.textMid,marginBottom:16}}>How are you accessing the app?</div>
          {[{k:"admin",l:"Admin / Super Admin",icon:"??",s:"Full system access"},{k:"trainer",l:"Field Trainer",icon:"??",s:"Manage your reps"},{k:"rep",l:"New Rep",icon:"??",s:"View your checklist"}].map(o=><button key={o.k} onClick={()=>{setMode(o.k);setPin("");setErr("");}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:10,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",marginBottom:7,textAlign:"left"}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.teal} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}><span style={{fontSize:18}}>{o.icon}</span><div><div style={{fontSize:13,fontWeight:600,color:C.text}}>{o.l}</div><div style={{fontSize:11,color:C.textMid}}>{o.s}</div></div><span style={{marginLeft:"auto",color:C.textLight,fontSize:16}}>›</span></button>)}
        </div>}
        {(mode==="admin"||mode==="trainer")&&<div>
          <button onClick={()=>{setMode("select");setErr("");setPin("");}} style={{background:"none",border:"none",color:C.teal,cursor:"pointer",fontSize:12,marginBottom:14,padding:0}}>&larr; Back</button>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:14}}>{mode==="admin"?"Admin Login":"Trainer Login"}</div>
          <input type="password" maxLength={6} placeholder="Enter PIN" value={pin} onChange={e=>{setPin(e.target.value.replace(/\D/,""));setErr("");}} onKeyDown={e=>e.key==="Enter"&&(mode==="admin"?doAdminLogin():doTrainerLogin())} style={{...inp,marginBottom:10,letterSpacing:"6px",textAlign:"center"}}/>
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
          <div style={{fontSize:11,color:C.textMid,marginBottom:14}}>{step==="create"?"Choose a 4-digit PIN to secure your account":"Enter your 4-digit PIN"}</div>
          <input type="password" maxLength={4} placeholder="4-digit PIN" value={rPin} onChange={e=>{setRPin(e.target.value.replace(/\D/,""));setErr("");}} style={{...inp,marginBottom:9,textAlign:"center",fontSize:22,letterSpacing:"10px"}} autoFocus/>
          {step==="create"&&<input type="password" maxLength={4} placeholder="Confirm PIN" value={rPinC} onChange={e=>{setRPinC(e.target.value.replace(/\D/,""));setErr("");}} onKeyDown={e=>e.key==="Enter"&&doRepLogin()} style={{...inp,marginBottom:9,textAlign:"center",fontSize:22,letterSpacing:"10px"}}/>}
          {err&&<div style={{color:C.danger,fontSize:11,marginBottom:8}}>{err}</div>}
          <button onClick={doRepLogin} style={{width:"100%",padding:"10px",borderRadius:8,background:C.teal,color:"white",border:"none",fontWeight:600,fontSize:13,cursor:"pointer"}}>{step==="create"?"Create PIN and Continue":"Sign In"}</button>
        </div>}
      </div>
      <div style={{textAlign:"center",color:"rgba(255,255,255,0.25)",fontSize:10,marginTop:14}}>NextLevel Field Training Hub 2025</div>
    </div>
  </div>;
}

function Sidebar({section,onNav,role,name,onSignOut,onClose}) {
  const nav = [
    {k:"dashboard",l:"Dashboard",d:"M3 12L12 3L21 12V20H15V14H9V20H3V12Z"},
    {k:"reps",l:"My Reps",d:"M17 21V19C17 17.9 16.1 17 15 17H9C7.9 17 7 17.9 7 19V21M12 14C9.8 14 8 12.2 8 10C8 7.8 9.8 6 12 6C14.2 6 16 7.8 16 10C16 12.2 14.2 14 12 14Z"},
    {k:"production",l:"Production",d:"M3 3H21V5H3ZM3 8H15V10H3ZM3 13H21V15H3ZM3 18H15V20H3Z"},
    {k:"schedule",l:"Schedule",d:"M8 2V5M16 2V5M3.5 9H20.5M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z"},
    {k:"scripts",l:"Scripts",d:"M9 5H7C5.9 5 5 5.9 5 7V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V7C19 5.9 18.1 5 17 5H15M9 5C9 5.6 9.4 6 10 6H14C14.6 6 15 5.6 15 5M9 5C9 4.4 9.4 4 10 4H14C14.6 4 15 4.4 15 5"},
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
      {nav.map(item=><button key={item.k} onClick={()=>{onNav(item.k);onClose?.();}} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"8px 9px",borderRadius:7,border:"none",cursor:"pointer",textAlign:"left",marginBottom:1,background:section===item.k?"rgba(14,165,160,0.15)":"transparent",color:section===item.k?C.teal:"rgba(255,255,255,0.6)",transition:"all 0.12s"}} onMouseEnter={e=>{if(section!==item.k)e.currentTarget.style.background="rgba(255,255,255,0.05)";}} onMouseLeave={e=>{if(section!==item.k)e.currentTarget.style.background="transparent";}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.d}/></svg>
        <span style={{fontSize:12,fontWeight:section===item.k?600:400}}>{item.l}</span>
        {section===item.k&&<div style={{marginLeft:"auto",width:3,height:3,borderRadius:2,background:C.teal}}/>}
      </button>)}
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

export default function App() {
  const [data,setData] = useState(()=>loadData());
  const [session,setSession] = useState(null);
  const [section,setSection] = useState("dashboard");
  const [selRepId,setSelRepId] = useState(null);
  const [mobileOpen,setMobileOpen] = useState(false);

  const upd = useCallback((d)=>{setData(d);saveData(d);},[]);

  const handleLogin = (role,id,userData,newPin) => {
    if(role==="rep"&&newPin){const ur=(data.reps||[]).map(r=>r.id===id?{...r,repPin:newPin}:r);upd({...data,reps:ur});}
    setSession({role,id,name:userData?.name||(role==="admin"?"Admin":"User")});
    setSection("dashboard");
  };

  const signOut = () => {setSession(null);setSelRepId(null);};

  if(!session) return <LoginScreen data={data} onLogin={handleLogin}/>;

  if(session.role==="rep") {
    const rep=(data.reps||[]).find(r=>r.id===session.id);
    if(!rep) return <div style={{padding:24,color:C.textMid}}>Not found - ask your trainer to add you.</div>;
    return <div style={{minHeight:"100vh",background:C.surface}}>
      <div style={{background:C.navy,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{color:"white",fontWeight:700,fontSize:13}}>NextLevel Field Training Hub</div>
        <button onClick={signOut} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.6)",padding:"4px 9px",borderRadius:6,cursor:"pointer",fontSize:11}}>Sign Out</button>
      </div>
      <div style={{maxWidth:580,margin:"0 auto",padding:14}}>
        <RepView rep={rep} data={data} onUpdate={(id,u)=>upd({...data,reps:data.reps.map(r=>r.id===id?u:r)})} readOnly={false}/>
      </div>
    </div>;
  }

  const selRep = selRepId?(data.reps||[]).find(r=>r.id===selRepId):null;

  const navTo = (s) => {setSection(s);setSelRepId(null);};

  const renderContent = () => {
    if(selRep&&(section==="reps"||section==="dashboard")) return <RepProfile rep={selRep} data={data} onUpdate={(id,u)=>upd({...data,reps:data.reps.map(r=>r.id===id?u:r)})} onBack={()=>setSelRepId(null)}/>;
    if(section==="dashboard"||section==="reps") return <Dashboard data={data} onUpdate={upd} userRole={session.role} userId={session.id} onSelectRep={(id)=>{setSelRepId(id);setSection("dashboard");}}/>;
    if(section==="production") return <div><div style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:14}}>Production</div><ProdDash data={data} onUpdateData={upd}/><MyProd myProd={(data.myProduction||{})[session.id]||{}} onUpdate={p=>upd({...data,myProduction:{...(data.myProduction||{}),[session.id]:p}})}/></div>;
    if(section==="schedule") return <div><div style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:14}}>Team Schedule</div>{TEAM_SCHEDULE.map((s,i)=><Card key={i} style={{marginBottom:8,display:"flex",gap:12,alignItems:"flex-start"}}><div><div style={{fontSize:13,fontWeight:700,color:C.text}}>{s.day} - {s.title}</div><div style={{fontSize:11,color:C.textLight,marginTop:2}}>{s.time}</div>{s.note&&<div style={{fontSize:11,color:C.textLight}}>{s.note}</div>}</div></Card>)}</div>;
    if(section==="scripts") return <div><div style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:14}}>Scripts</div>{SCRIPTS.map((s,i)=><Card key={i} style={{marginBottom:10}}><div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:8}}>{s.title}</div><div style={{background:C.surface,borderRadius:8,padding:"10px 12px",fontSize:12,color:C.textMid,lineHeight:1.6}}>"{s.content}"</div></Card>)}</div>;
    if(section==="team") return <div><div style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:14}}>Team Management</div><Card><div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:10}}>Field Trainers</div>{(data.trainers||[]).map(t=><div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.border}`}}><div><div style={{fontSize:12,color:C.text}}>{t.name}</div><div style={{fontSize:10,color:C.textLight}}>{(data.reps||[]).filter(r=>r.trainerId===t.id).length} reps</div></div><Badge color={C.teal} small>Trainer</Badge></div>)}</Card></div>;
    return null;
  };

  return <div style={{display:"flex",height:"100vh",background:C.surface,overflow:"hidden"}}>
    <div style={{display:"flex",flexShrink:0}}>
      <Sidebar section={section} onNav={navTo} role={session.role} name={session.name} onSignOut={signOut}/>
    </div>
    {mobileOpen&&<div style={{position:"fixed",inset:0,zIndex:200,display:"flex"}}>
      <Sidebar section={section} onNav={navTo} role={session.role} name={session.name} onSignOut={signOut} onClose={()=>setMobileOpen(false)}/>
      <div style={{flex:1,background:"rgba(0,0,0,0.4)"}} onClick={()=>setMobileOpen(false)}/>
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
        <div style={{maxWidth:820,margin:"0 auto"}}>{renderContent()}</div>
      </div>
    </div>
  </div>;
}
