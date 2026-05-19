import { useState, useEffect, useRef } from "react";

const SECTIONS = [
  { id: "parking", label: "Parking Lot", color: "#8B7355" },
  { id: "today", label: "Today", color: "#C0392B" },
  { id: "wf-urgent", label: "Waiting For — Urgent", color: "#8E44AD" },
  { id: "wf-other", label: "Waiting For — Other", color: "#7D3C98" },
  { id: "after", label: "After Today", color: "#E67E22" },
  { id: "noschedule", label: "No Schedule", color: "#7F8C8D" },
  { id: "done", label: "Done", color: "#AAB7B8" },
];

const PRIORITY_OPTIONS = ["High", "Medium", "Low"];
const STATE_OPTIONS = ["To Do", "Waiting For"];
const STAKEHOLDER_OPTIONS = ["Rob", "Phi", "Zack", "Zoey"];
const RECUR_TYPES = ["None", "Daily", "Weekly", "Multi-Day", "Monthly", "Every X", "Annual"];
const RECUR_UNITS = ["Days", "Weeks", "Months", "Years"];
const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MIGRATION_MAP = { "Job Search":"Work","Family":"Personal","Rob":"Personal","Phi/Nanny":"Personal" };

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const priorityColor = p => p==="High"?"#C0392B":p==="Medium"?"#E67E22":"#27AE60";
const priorityBg = p => p==="High"?"#FADBD8":p==="Medium"?"#FDEBD0":"#D5F5E3";
const priorityOrder = p => p==="High"?0:p==="Medium"?1:2;

const deriveSection = task => {
  const today = todayStr();
  if (task.done) return "done";
  if (task.state==="Waiting For" && task.priority==="High") return "wf-urgent";
  if (task.state==="Waiting For") return "wf-other";
  if (task.recurType && task.recurType!=="None") {
    // Recurring tasks: due today (or recurring today) → Today; otherwise After Today
    if (isRecurringToday(task) || (task.dueDate && task.dueDate<=today)) return "today";
    return "after";
  }
  // If a due date exists, it determines placement (overrides stale section assignment)
  if (task.dueDate) {
    if (task.dueDate<=today) return "today";
    return "after";
  }
  // No due date: respect explicit section
  if (task.section==="parking") return "parking";
  if (task.section==="noschedule") return "noschedule";
  if (task.section==="today") return "today";
  if (task.section==="after") return "after";
  return "parking";
};

const isRecurringToday = task => {
  if (!task.recurType || task.recurType==="None") return false;
  // If a specific dueDate is set, that date is authoritative — only "recurring today" if dueDate IS today
  if (task.dueDate) return task.dueDate === todayStr();
  const today = new Date();
  const todayISO = todayStr();
  const dow = today.getDay();
  const dom = today.getDate();
  const month = today.getMonth();
  if (task.recurEndDate && todayISO>task.recurEndDate) return false;
  if (task.recurType==="Daily") return true;
  if (task.recurType==="Weekly") return task.recurDay===dow;
  if (task.recurType==="Multi-Day") return Array.isArray(task.recurDays)&&task.recurDays.includes(dow);
  if (task.recurType==="Monthly") return task.recurDOM===dom;
  if (task.recurType==="Every X") {
    const interval = task.recurInterval || 1;
    const unit = task.recurUnit || "Days";
    const anchor = task.recurAnchor || task.created;
    if (!anchor || interval < 1) return false;
    const [ay, am, ad] = anchor.split("-").map(Number);
    const anchorDate = new Date(ay, am-1, ad);
    anchorDate.setHours(0,0,0,0);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    if (unit === "Days") {
      const daysDiff = Math.round((todayMidnight - anchorDate.getTime()) / 86400000);
      return daysDiff >= 0 && daysDiff % interval === 0;
    }
    if (unit === "Weeks") {
      if (anchorDate.getDay() !== dow) return false;
      const daysDiff = Math.round((todayMidnight - anchorDate.getTime()) / 86400000);
      return daysDiff >= 0 && (daysDiff / 7) % interval === 0;
    }
    if (unit === "Months") {
      if (ad !== dom) return false;
      const monthsDiff = (today.getFullYear() - ay) * 12 + (month - (am - 1));
      return monthsDiff >= 0 && monthsDiff % interval === 0;
    }
    if (unit === "Years") {
      if (ad !== dom || (am - 1) !== month) return false;
      const yearsDiff = today.getFullYear() - ay;
      return yearsDiff >= 0 && yearsDiff % interval === 0;
    }
    return false;
  }
  if (task.recurType==="Annual") return task.recurMonth===month&&task.recurDOM===dom;
  return false;
};

const nextRecurDate = task => {
  const today = new Date();
  const base = new Date(today);
  base.setDate(base.getDate()+1);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  if (task.recurType==="Daily") return fmt(base);
  if (task.recurType==="Weekly") { const diff=(task.recurDay-base.getDay()+7)%7||7; base.setDate(base.getDate()+diff-1); return fmt(base); }
  if (task.recurType==="Multi-Day") { if(!task.recurDays||!task.recurDays.length)return null; for(let i=0;i<8;i++){const d=new Date(today);d.setDate(d.getDate()+1+i);if(task.recurDays.includes(d.getDay()))return fmt(d);} }
  if (task.recurType==="Monthly") { const d=new Date(today.getFullYear(),today.getMonth()+1,task.recurDOM||1); return fmt(d); }
  if (task.recurType==="Every X") {
    const interval = task.recurInterval || 1;
    const unit = task.recurUnit || "Days";
    const d = new Date(today);
    if (unit === "Days") d.setDate(d.getDate() + interval);
    else if (unit === "Weeks") d.setDate(d.getDate() + 7 * interval);
    else if (unit === "Months") {
      const dom = task.recurDOM || today.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + interval);
      d.setDate(dom);
    }
    else if (unit === "Years") {
      const dom = task.recurDOM || today.getDate();
      const mo = task.recurMonth ?? today.getMonth();
      d.setFullYear(d.getFullYear() + interval);
      d.setMonth(mo);
      d.setDate(dom);
    }
    return fmt(d);
  }
  if (task.recurType==="Annual") { let yr=today.getFullYear(); const d=new Date(yr,task.recurMonth||0,task.recurDOM||1); if(d<=today)d.setFullYear(yr+1); return fmt(d); }
  return null;
};

const sortTasks = tasks => {
  const today = todayStr();
  const effDate = t => {
    // Recurring tasks with no explicit dueDate that recur today → use today for sort
    if (t.recurType && t.recurType!=="None" && !t.dueDate && isRecurringToday(t)) return today;
    return t.dueDate || "9999-99-99";
  };
  return [...tasks].sort((a,b) => {
    const da = effDate(a), db = effDate(b);
    if (da!==db) return da<db?-1:1;
    // Tiebreaker: priority (tasks without priority sort last)
    const ap = a.priority ? priorityOrder(a.priority) : 99;
    const bp = b.priority ? priorityOrder(b.priority) : 99;
    return ap-bp;
  });
};

const mkTask = o => ({
  id:genId(), text:"", section:"parking", state:"To Do", priority:"", area:"", project:"",
  blocker:"", notes:"", stakeholders:[], done:false, created:todayStr(),
  recurType:"None", recurDay:null, recurDate:null, recurDays:[], recurMonth:null, recurDOM:null,
  recurInterval:null, recurUnit:null, recurAnchor:null,
  recurEndDate:null, dueDate:null, ...o
});

const nrmTask = t => mkTask({
  id:t.id||genId(), text:t.text||"", section:t.section||"parking", state:t.state||"To Do",
  priority:t.priority||"", area:t.area||"", project:t.project||"",
  blocker:t.blocker||"", notes:t.notes||"", stakeholders:t.stakeholders||[],
  done:t.done===true, created:t.created||todayStr(),
  recurType:t.recurType==="Every-X-Months"?"Every X":(t.recurType||"None"), recurDay:t.recurDay??null, recurDate:t.recurDate??null,
  recurDays:t.recurDays||[], recurMonth:t.recurMonth??null,
  recurDOM:t.recurDOM??t.recurDayOfMonth??null,
  recurInterval:t.recurInterval??null, recurUnit:t.recurUnit||(t.recurType==="Every-X-Months"?"Months":null), recurAnchor:t.recurAnchor||null,
  recurEndDate:t.recurEndDate||null, dueDate:t.dueDate||null,
});

const DEFAULT_TASKS = [
  mkTask({text:"Apply to 3 CMO roles",section:"today",priority:"High",area:"Work",dueDate:todayStr()}),
  mkTask({text:"Post LinkedIn content",section:"today",priority:"High",area:"Work",blocker:"Draft needs review",dueDate:todayStr()}),
  mkTask({text:"Date night with Rob",section:"after",priority:"Medium",area:"Personal",stakeholders:["Rob"],dueDate:new Date(Date.now()+5*86400000).toISOString().slice(0,10)}),
];

const S = {
  app: {fontFamily:"Georgia,serif",background:"#FAFAF7",minHeight:"100vh",color:"#2C2C2C"},
  input: {fontFamily:"Georgia,serif",padding:"5px 8px",border:"1px solid #CCC",borderRadius:4,fontSize:14,background:"#FFF"},
  btn: {fontFamily:"Georgia,serif",cursor:"pointer",padding:"4px 10px",border:"1px solid #CCC",borderRadius:4,fontSize:13,background:"#FFF"},
  tog: on => ({fontFamily:"Georgia,serif",cursor:"pointer",padding:"3px 10px",border:`1px solid ${on?"#2C2C2C":"#CCC"}`,borderRadius:4,fontSize:12,background:on?"#2C2C2C":"#FFF",color:on?"#FFF":"#555"}),
  lbl: {fontSize:12,color:"#888",marginBottom:3,display:"block"},
  row: {marginBottom:14},
  overlay: {position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"20px 0"},
  modal: {background:"#FFF",borderRadius:8,padding:24,width:"min(600px,95vw)",position:"relative",margin:"auto"},
  popover: {position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:80,background:"#FFF",border:"1px solid #DDD",borderRadius:6,padding:8,boxShadow:"0 4px 12px rgba(0,0,0,.12)",minWidth:160},
};

const Tog = ({active,onClick,children,color}) => (
  <button onClick={onClick} style={{...S.tog(active),...(active&&color?{background:color,borderColor:color,color:"#FFF"}:{})}}>{children}</button>
);

const usePopover = (open, onClose) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handle = e => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handle), 0);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handle); };
  }, [open, onClose]);
  return ref;
};

const RecurEditor = ({task,onChange}) => {
  const rt = task.recurType||"None";
  return (
    <div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
        {RECUR_TYPES.map(r=><Tog key={r} active={rt===r} onClick={()=>onChange({...task,recurType:r})}>{r}</Tog>)}
      </div>
      {rt==="Weekly"&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{DAYS_OF_WEEK.map((d,i)=><Tog key={d} active={task.recurDay===i} onClick={()=>onChange({...task,recurDay:i})}>{d.slice(0,3)}</Tog>)}</div>}
      {rt==="Multi-Day"&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{DAYS_OF_WEEK.map((d,i)=><Tog key={d} active={(task.recurDays||[]).includes(i)} onClick={()=>{const rd=task.recurDays||[];onChange({...task,recurDays:rd.includes(i)?rd.filter(x=>x!==i):[...rd,i]});}}>{d.slice(0,3)}</Tog>)}</div>}
      {rt==="Monthly"&&<div><span style={{fontSize:12,color:"#888"}}>Day of month: </span><select value={task.recurDOM||1} onChange={e=>onChange({...task,recurDOM:+e.target.value})} style={S.input}>{Array.from({length:31},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></div>}
      {rt==="Every X"&&(()=>{
        const unit = task.recurUnit || "Days";
        const showDOM = unit==="Months" || unit==="Years";
        const showMonth = unit==="Years";
        return (
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:12,color:"#888"}}>Every</span>
            <select value={task.recurInterval||2} onChange={e=>onChange({...task,recurInterval:+e.target.value,recurAnchor:task.recurAnchor||todayStr()})} style={S.input}>
              {Array.from({length:99},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}
            </select>
            <select value={unit} onChange={e=>onChange({...task,recurUnit:e.target.value,recurAnchor:task.recurAnchor||todayStr()})} style={S.input}>
              {RECUR_UNITS.map(u=><option key={u} value={u}>{u}</option>)}
            </select>
            {showMonth && (
              <>
                <span style={{fontSize:12,color:"#888"}}>in</span>
                <select value={task.recurMonth??new Date().getMonth()} onChange={e=>onChange({...task,recurMonth:+e.target.value,recurAnchor:task.recurAnchor||todayStr()})} style={S.input}>
                  {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
                </select>
              </>
            )}
            {showDOM && (
              <>
                <span style={{fontSize:12,color:"#888"}}>on day</span>
                <select value={task.recurDOM||new Date().getDate()} onChange={e=>onChange({...task,recurDOM:+e.target.value,recurAnchor:task.recurAnchor||todayStr()})} style={S.input}>
                  {Array.from({length:31},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}
                </select>
              </>
            )}
          </div>
        );
      })()}
      {rt==="Annual"&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <div><span style={{fontSize:12,color:"#888"}}>Month: </span><select value={task.recurMonth||0} onChange={e=>onChange({...task,recurMonth:+e.target.value})} style={S.input}>{MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}</select></div>
        <div><span style={{fontSize:12,color:"#888"}}>Day: </span><select value={task.recurDOM||1} onChange={e=>onChange({...task,recurDOM:+e.target.value})} style={S.input}>{Array.from({length:31},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></div>
      </div>}
      {rt!=="None"&&<div style={{marginTop:8}}><span style={{fontSize:12,color:"#888"}}>End date (optional): </span><input type="date" value={task.recurEndDate||""} onChange={e=>onChange({...task,recurEndDate:e.target.value||null})} style={S.input} /></div>}
    </div>
  );
};

const FieldEditorOverlay = ({title,storageKey,tasks,onClose}) => {
  const [items,setItems] = useState(()=>{ try{return JSON.parse(localStorage.getItem(storageKey))||[];}catch{return[];} });
  const [nv,setNv] = useState("");
  const [ren,setRen] = useState(null);
  const [renVal,setRenVal] = useState("");
  const fkey = storageKey==="ash-areas"?"area":"project";
  const countFor = v => tasks.filter(t=>t[fkey]===v).length;
  const save = ni => { setItems(ni); try{localStorage.setItem(storageKey,JSON.stringify(ni));}catch{} };
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{...S.modal,maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <button onClick={onClose} style={{position:"absolute",top:12,right:12,background:"none",border:"none",fontSize:20,cursor:"pointer"}}>✕</button>
        <h2 style={{marginTop:0,fontSize:18}}>Edit {title}</h2>
        {items.map((item,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"6px 10px",background:"#F8F8F5",borderRadius:4}}>
            {ren===i?(
              <>
                <input value={renVal} onChange={e=>setRenVal(e.target.value)} style={{...S.input,flex:1}} autoFocus />
                <button style={S.btn} onClick={()=>{const n=[...items];n[i]=renVal;save(n);setRen(null);}}>Save</button>
                <button style={S.btn} onClick={()=>setRen(null)}>Cancel</button>
              </>
            ):(
              <>
                <span style={{flex:1}}>{item}</span>
                <span style={{fontSize:12,color:"#999"}}>{countFor(item)} tasks</span>
                <button style={S.btn} onClick={()=>{setRen(i);setRenVal(item);}}>Rename</button>
                <button style={{...S.btn,color:"#C00"}} onClick={()=>save(items.filter((_,j)=>j!==i))}>Delete</button>
              </>
            )}
          </div>
        ))}
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <input value={nv} onChange={e=>setNv(e.target.value)} placeholder={`New ${title.slice(0,-1)}`} style={{...S.input,flex:1}} onKeyDown={e=>{if(e.key==="Enter"&&nv.trim()){save([...items,nv.trim()]);setNv("");}}} />
          <button style={S.btn} onClick={()=>{if(nv.trim()){save([...items,nv.trim()]);setNv("");}  }}>Add</button>
        </div>
      </div>
    </div>
  );
};

const EditModal = ({task,tasks,onSave,onClose,areas,projects,onAreasChange,onProjectsChange}) => {
  const [t,setT] = useState({...task});
  const [showAE,setShowAE] = useState(false);
  const [showPE,setShowPE] = useState(false);
  const [newProj,setNewProj] = useState("");
  const [otherSH,setOtherSH] = useState("");

  const addProj = () => {
    if (!newProj.trim()) return;
    const updated = [...projects,newProj.trim()];
    try{localStorage.setItem("ash-projects",JSON.stringify(updated));}catch{}
    onProjectsChange(updated);
    setT(p=>({...p,project:newProj.trim()}));
    setNewProj("");
  };

  const togSH = s => { const sh=t.stakeholders||[]; setT(p=>({...p,stakeholders:sh.includes(s)?sh.filter(x=>x!==s):[...sh,s]})); };
  const addOtherSH = () => { if(!otherSH.trim())return; const sh=t.stakeholders||[]; if(!sh.includes(otherSH.trim()))setT(p=>({...p,stakeholders:[...sh,otherSH.trim()]})); setOtherSH(""); };

  const whereOpts = ["Today","After Today","Parking Lot","No Schedule"];
  const secToWhere = s => s==="today"?"Today":s==="after"?"After Today":s==="parking"?"Parking Lot":"No Schedule";
  const whereToSec = w => w==="Today"?"today":w==="After Today"?"after":w==="Parking Lot"?"parking":"noschedule";

  const aStale = t.area && !areas.includes(t.area);
  const pStale = t.project && !projects.includes(t.project);

  return (
    <>
      <div style={S.overlay} onClick={onClose}>
        <div style={{...S.modal,maxHeight:"90vh",overflowY:"auto",padding:0}} onClick={e=>e.stopPropagation()}>
          {/* Sticky action bar at top */}
          <div style={{position:"sticky",top:0,zIndex:10,background:"#FFF",borderBottom:"1px solid #EEE",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
            <div style={{fontSize:13,fontWeight:"bold",color:"#666"}}>Edit Task</div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button style={S.btn} onClick={onClose}>Cancel</button>
              <button style={{...S.btn,background:"#2C2C2C",color:"#FFF",border:"none"}} onClick={()=>onSave(t)}>Save</button>
              <button onClick={onClose} title="Close" style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#999",lineHeight:1,padding:"0 4px"}}>✕</button>
            </div>
          </div>
          <div style={{padding:"16px 24px 24px"}}>
          <div style={S.row}>
            <input value={t.text} onChange={e=>setT(p=>({...p,text:e.target.value}))} style={{...S.input,width:"100%",fontSize:16,boxSizing:"border-box"}} autoFocus placeholder="Task title…" />
          </div>
          <div style={S.row}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <label style={{...S.lbl,marginBottom:0}}>Area</label>
              <button style={{...S.btn,fontSize:11,padding:"2px 8px"}} onClick={()=>setShowAE(true)}>✎ Edit</button>
            </div>
            {aStale&&<div style={{fontSize:11,color:"#E67E22",marginBottom:4}}>⚠ "{t.area}" no longer valid</div>}
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <Tog active={!t.area} onClick={()=>setT(p=>({...p,area:""}))}>— none —</Tog>
              {areas.map(a=><Tog key={a} active={t.area===a} onClick={()=>setT(p=>({...p,area:a}))}>{a}</Tog>)}
            </div>
          </div>
          <div style={S.row}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <label style={{...S.lbl,marginBottom:0}}>Project</label>
              <button style={{...S.btn,fontSize:11,padding:"2px 8px"}} onClick={()=>setShowPE(true)}>✎ Edit</button>
            </div>
            {pStale&&<div style={{fontSize:11,color:"#E67E22",marginBottom:4}}>⚠ "{t.project}" no longer valid</div>}
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              <Tog active={!t.project} onClick={()=>setT(p=>({...p,project:""}))}>— none —</Tog>
              {projects.map(pr=><Tog key={pr} active={t.project===pr} onClick={()=>setT(p=>({...p,project:pr}))}>{pr}</Tog>)}
              <input value={newProj} onChange={e=>setNewProj(e.target.value)} placeholder="New project…" style={{...S.input,width:130}} onKeyDown={e=>{if(e.key==="Enter")addProj();}} />
              <button style={S.btn} onClick={addProj}>+ New</button>
            </div>
          </div>
          <div style={S.row}>
            <label style={S.lbl}>Due Date</label>
            <input type="date" value={t.dueDate||""} onChange={e=>setT(p=>({...p,dueDate:e.target.value||null}))} style={S.input} />
            {t.dueDate&&<button style={{...S.btn,marginLeft:8}} onClick={()=>setT(p=>({...p,dueDate:null}))}>Clear</button>}
          </div>
          <div style={S.row}>
            <label style={S.lbl}>Recurrence</label>
            <RecurEditor task={t} onChange={setT} />
          </div>
          <div style={S.row}>
            <label style={S.lbl}>Where</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {whereOpts.map(w=><Tog key={w} active={secToWhere(t.section)===w} onClick={()=>setT(p=>({...p,section:whereToSec(w)}))}>{w}</Tog>)}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            <div>
              <label style={S.lbl}>State</label>
              <div style={{display:"flex",gap:6}}>
                {STATE_OPTIONS.map(s=><Tog key={s} active={t.state===s} onClick={()=>setT(p=>({...p,state:s}))}>{s}</Tog>)}
              </div>
            </div>
            <div>
              <label style={S.lbl}>Priority</label>
              <div style={{display:"flex",gap:6}}>
                {PRIORITY_OPTIONS.map(p=>{
                  const on=t.priority===p;
                  return <button key={p} onClick={()=>setT(prev=>({...prev,priority:prev.priority===p?"":p}))} style={{fontFamily:"Georgia,serif",cursor:"pointer",padding:"3px 10px",borderRadius:4,fontSize:12,border:`1px solid ${on?priorityColor(p):"#CCC"}`,background:on?priorityBg(p):"#FFF",color:on?priorityColor(p):"#555",fontWeight:on?"bold":"normal"}}>{p}</button>;
                })}
              </div>
            </div>
          </div>
          <div style={S.row}>
            <label style={S.lbl}>Stakeholders</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:6}}>
              {STAKEHOLDER_OPTIONS.map(s=><Tog key={s} active={(t.stakeholders||[]).includes(s)} onClick={()=>togSH(s)}>{s}</Tog>)}
              <input value={otherSH} onChange={e=>setOtherSH(e.target.value)} placeholder="Other…" style={{...S.input,width:90}} onKeyDown={e=>{if(e.key==="Enter")addOtherSH();}} />
              <button style={S.btn} onClick={addOtherSH}>Add</button>
            </div>
            {(t.stakeholders||[]).filter(s=>!STAKEHOLDER_OPTIONS.includes(s)).map(s=>(
              <span key={s} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12,padding:"2px 8px",borderRadius:10,background:"#555",color:"#FFF",marginRight:4,cursor:"pointer"}} onClick={()=>setT(p=>({...p,stakeholders:(p.stakeholders||[]).filter(x=>x!==s)}))}>✕ {s}</span>
            ))}
          </div>
          <div style={S.row}>
            <label style={{...S.lbl,color:"#C0392B",fontWeight:"bold"}}>Blocker / Next Step</label>
            <input value={t.blocker||""} onChange={e=>setT(p=>({...p,blocker:e.target.value}))} style={{...S.input,width:"100%",boxSizing:"border-box"}} placeholder="What's blocking this?" />
          </div>
          <div style={S.row}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
              <label style={{...S.lbl,color:"#B7950B",fontWeight:"bold"}}>Notes</label>
              <span style={{fontSize:11,color:"#999"}}>{(t.notes||"").length} chars</span>
            </div>
            <textarea value={t.notes||""} onChange={e=>setT(p=>({...p,notes:e.target.value}))} rows={8} style={{...S.input,width:"100%",boxSizing:"border-box",resize:"vertical"}} />
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button style={S.btn} onClick={onClose}>Cancel</button>
            <button style={{...S.btn,background:"#2C2C2C",color:"#FFF",border:"none"}} onClick={()=>onSave(t)}>Save</button>
          </div>
          </div>{/* end padding wrapper */}
        </div>
      </div>
      {showAE&&<FieldEditorOverlay title="Areas" storageKey="ash-areas" tasks={tasks} onClose={()=>{setShowAE(false);try{onAreasChange(JSON.parse(localStorage.getItem("ash-areas"))||["Work","Personal"]);}catch{}}} />}
      {showPE&&<FieldEditorOverlay title="Projects" storageKey="ash-projects" tasks={tasks} onClose={()=>{setShowPE(false);try{onProjectsChange(JSON.parse(localStorage.getItem("ash-projects"))||[]);}catch{}}} />}
    </>
  );
};

// ---------- Inline editors (list view) ----------

// --- Custom Calendar Picker (no native input, just a calendar grid) ---
const CalendarPicker = ({value, onSelect, onClear, onClose}) => {
  // Parse value (YYYY-MM-DD) or default to current month
  const parseISO = s => {
    if (!s) return null;
    const [y,m,d] = s.split("-").map(Number);
    return new Date(y, m-1, d);
  };
  const initial = parseISO(value) || new Date();
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [viewYear, setViewYear] = useState(initial.getFullYear());

  const today = new Date();
  const tYr = today.getFullYear(), tMo = today.getMonth(), tDay = today.getDate();

  const selected = parseISO(value);
  const selYr = selected?.getFullYear(), selMo = selected?.getMonth(), selDay = selected?.getDate();

  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells = [];
  // leading days from prev month
  for (let i = firstDay-1; i >= 0; i--) {
    cells.push({day: daysInPrevMonth-i, otherMonth: true, monthOffset: -1});
  }
  // current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({day: d, otherMonth: false, monthOffset: 0});
  }
  // trailing days to fill week
  while (cells.length % 7 !== 0) {
    cells.push({day: cells.length - firstDay - daysInMonth + 1, otherMonth: true, monthOffset: 1});
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y=>y-1); }
    else setViewMonth(m=>m-1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y=>y+1); }
    else setViewMonth(m=>m+1);
  };

  const pick = (cell) => {
    const y = viewYear, m = viewMonth + cell.monthOffset;
    const d = new Date(y, m, cell.day);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    onSelect(iso);
  };

  const goToday = () => {
    setViewMonth(tMo); setViewYear(tYr);
    onSelect(`${tYr}-${String(tMo+1).padStart(2,"0")}-${String(tDay).padStart(2,"0")}`);
  };

  const navBtn = {background:"none",border:"none",cursor:"pointer",fontSize:16,padding:"2px 8px",color:"#555",borderRadius:4,fontFamily:"Georgia,serif"};
  const dayHeaderStyle = {textAlign:"center",fontSize:10,fontWeight:"bold",color:"#888",padding:"4px 0",textTransform:"uppercase",letterSpacing:".05em"};

  const cellStyle = (cell) => {
    const isToday = !cell.otherMonth && cell.day === tDay && viewMonth === tMo && viewYear === tYr;
    const isSel = !cell.otherMonth && selected && cell.day === selDay && viewMonth === selMo && viewYear === selYr;
    return {
      textAlign:"center",
      padding:"6px 0",
      fontSize:13,
      fontFamily:"Georgia,serif",
      cursor:"pointer",
      borderRadius:4,
      color: cell.otherMonth ? "#CCC" : (isSel ? "#FFF" : (isToday ? "#C0392B" : "#2C2C2C")),
      background: isSel ? "#2C2C2C" : "transparent",
      fontWeight: isToday || isSel ? "bold" : "normal",
      border: isToday && !isSel ? "1px solid #C0392B" : "1px solid transparent",
      userSelect:"none"
    };
  };

  return (
    <div style={{
      background:"#FFF",
      border:"1px solid #DDD",
      borderRadius:8,
      padding:10,
      boxShadow:"0 4px 16px rgba(0,0,0,.15)",
      width:240,
      fontFamily:"Georgia,serif"
    }} onClick={e=>e.stopPropagation()}>
      {/* Header: month/year + left/right nav */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <button onClick={prevMonth} style={navBtn} title="Previous month">‹</button>
        <div style={{fontWeight:"bold",fontSize:13}}>{MONTHS[viewMonth]} {viewYear}</div>
        <button onClick={nextMonth} style={navBtn} title="Next month">›</button>
      </div>
      {/* Day-of-week headers */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {["S","M","T","W","T","F","S"].map((d,i)=>(
          <div key={i} style={dayHeaderStyle}>{d}</div>
        ))}
      </div>
      {/* Calendar grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {cells.map((c,i)=>(
          <div key={i} onClick={()=>pick(c)} style={cellStyle(c)}>{c.day}</div>
        ))}
      </div>
      {/* Footer */}
      <div style={{display:"flex",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:"1px solid #EEE"}}>
        <button onClick={goToday} style={{...S.btn,fontSize:11,padding:"3px 8px"}}>Today</button>
        <div style={{display:"flex",gap:4}}>
          {value && <button onClick={onClear} style={{...S.btn,fontSize:11,padding:"3px 8px",color:"#C0392B"}}>Clear</button>}
          <button onClick={onClose} style={{...S.btn,fontSize:11,padding:"3px 8px"}}>Close</button>
        </div>
      </div>
    </div>
  );
};

const InlineDate = ({task, onSave, rowHovered}) => {
  const [open, setOpen] = useState(false);
  const popoverRef = usePopover(open, () => setOpen(false));
  const today = todayStr();
  const isOverdue = task.dueDate && task.dueDate<today && !task.done;
  const rl = task.recurType && task.recurType!=="None";

  if (rl) return null;

  const clearDate = e => {
    e.stopPropagation();
    onSave({...task, dueDate: null});
  };

  const labelStyle = task.dueDate
    ? {fontSize:11,fontWeight:"bold",color:isOverdue?"#C0392B":"#888",background:isOverdue?"#FADBD8":"transparent",padding:"1px 5px",borderRadius:3,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap"}
    : {fontSize:11,color:"#CCC",cursor:"pointer",borderBottom:"1px dashed #DDD",userSelect:"none",whiteSpace:"nowrap"};

  const labelText = task.dueDate ? `${isOverdue?"⚠ ":""}${task.dueDate}` : "No date";

  return (
    <span ref={popoverRef} style={{position:"relative",display:"inline-flex",alignItems:"center",gap:2}}>
      <span onClick={e=>{e.stopPropagation();setOpen(o=>!o);}} style={labelStyle}>{labelText}</span>
      {task.dueDate && rowHovered && (
        <button
          onClick={clearDate}
          title="Clear date"
          style={{
            background:"none",border:"none",cursor:"pointer",
            color:"#999",fontSize:11,lineHeight:1,padding:"0 2px",
            fontFamily:"Georgia,serif"
          }}
        >✕</button>
      )}
      {open && (
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:90}}>
          <CalendarPicker
            value={task.dueDate}
            onSelect={iso=>{ onSave({...task, dueDate: iso}); setOpen(false); }}
            onClear={()=>{ onSave({...task, dueDate: null}); setOpen(false); }}
            onClose={()=>setOpen(false)}
          />
        </div>
      )}
    </span>
  );
};

const InlinePriority = ({task, onSave}) => {
  const [open, setOpen] = useState(false);
  const ref = usePopover(open, () => setOpen(false));
  return (
    <span ref={ref} style={{position:"relative",display:"inline-flex",alignItems:"center"}}>
      <span
        onClick={e=>{e.stopPropagation();setOpen(o=>!o);}}
        title={task.priority||"Set priority"}
        style={{
          width:10,height:10,borderRadius:"50%",
          background:task.priority?priorityColor(task.priority):"transparent",
          border:task.priority?"none":"1.5px dashed #CCC",
          display:"inline-block",cursor:"pointer",flexShrink:0
        }}
      />
      {open && (
        <span style={{...S.popover, padding:6, minWidth:0, display:"flex", gap:4}} onClick={e=>e.stopPropagation()}>
          {PRIORITY_OPTIONS.map(p => {
            const on = task.priority===p;
            return (
              <button key={p}
                onClick={()=>{ onSave({...task, priority: on?"":p}); setOpen(false); }}
                style={{
                  fontFamily:"Georgia,serif",cursor:"pointer",padding:"3px 8px",borderRadius:4,fontSize:11,
                  border:`1px solid ${on?priorityColor(p):"#CCC"}`,
                  background:on?priorityBg(p):"#FFF",
                  color:on?priorityColor(p):"#555",
                  fontWeight:on?"bold":"normal"
                }}
              >{p}</button>
            );
          })}
          {task.priority && (
            <button onClick={()=>{onSave({...task,priority:""});setOpen(false);}} style={{...S.btn,fontSize:11,padding:"3px 8px"}}>✕</button>
          )}
        </span>
      )}
    </span>
  );
};

const InlineArea = ({task, onSave, areas}) => {
  const [open, setOpen] = useState(false);
  const ref = usePopover(open, () => setOpen(false));
  const aStale = task.area && !areas.includes(task.area);
  const trigger = task.area ? (
    <span style={{fontSize:11,fontWeight:"bold",color:aStale?"#E67E22":"#888",textTransform:"uppercase",letterSpacing:".04em",background:aStale?"#FEF9EF":"transparent",padding:"1px 5px",borderRadius:3,cursor:"pointer"}}>
      {aStale&&"⚠ "}{task.area}
    </span>
  ) : (
    <span style={{fontSize:11,color:"#CCC",cursor:"pointer",borderBottom:"1px dashed #DDD",textTransform:"uppercase",letterSpacing:".04em"}}>+ area</span>
  );
  return (
    <span ref={ref} style={{position:"relative",display:"inline-block"}}>
      <span onClick={e=>{e.stopPropagation();setOpen(o=>!o);}}>{trigger}</span>
      {open && (
        <span style={{...S.popover, display:"flex", flexWrap:"wrap", gap:4}} onClick={e=>e.stopPropagation()}>
          <Tog active={!task.area} onClick={()=>{onSave({...task,area:""});setOpen(false);}}>— none —</Tog>
          {areas.map(a => <Tog key={a} active={task.area===a} onClick={()=>{onSave({...task,area:a});setOpen(false);}}>{a}</Tog>)}
        </span>
      )}
    </span>
  );
};

const InlineProject = ({task, onSave, projects, onProjectsChange}) => {
  const [open, setOpen] = useState(false);
  const [newProj, setNewProj] = useState("");
  const ref = usePopover(open, () => setOpen(false));
  const pStale = task.project && !projects.includes(task.project);

  const addProj = () => {
    const v = newProj.trim();
    if (!v) return;
    const updated = [...projects, v];
    try{localStorage.setItem("ash-projects",JSON.stringify(updated));}catch{}
    onProjectsChange(updated);
    onSave({...task, project: v});
    setNewProj("");
    setOpen(false);
  };

  const trigger = task.project ? (
    <span style={{fontSize:11,fontWeight:"bold",color:pStale?"#E67E22":"#2471A3",background:pStale?"#FEF9EF":"#EAF2FB",padding:"1px 6px",borderRadius:10,cursor:"pointer"}}>
      {pStale&&"⚠ "}{task.project}
    </span>
  ) : (
    <span style={{fontSize:11,color:"#CCC",cursor:"pointer",borderBottom:"1px dashed #DDD"}}>+ project</span>
  );

  return (
    <span ref={ref} style={{position:"relative",display:"inline-block"}}>
      <span onClick={e=>{e.stopPropagation();setOpen(o=>!o);}}>{trigger}</span>
      {open && (
        <span style={{...S.popover, display:"flex", flexDirection:"column", gap:6, minWidth:220}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            <Tog active={!task.project} onClick={()=>{onSave({...task,project:""});setOpen(false);}}>— none —</Tog>
            {projects.map(pr => <Tog key={pr} active={task.project===pr} onClick={()=>{onSave({...task,project:pr});setOpen(false);}}>{pr}</Tog>)}
          </div>
          <div style={{display:"flex",gap:4}}>
            <input value={newProj} onChange={e=>setNewProj(e.target.value)} placeholder="New project…" style={{...S.input,flex:1,fontSize:12,padding:"3px 6px"}} onKeyDown={e=>{if(e.key==="Enter")addProj();}} />
            <button style={{...S.btn,fontSize:11,padding:"3px 8px"}} onClick={addProj}>+</button>
          </div>
        </span>
      )}
    </span>
  );
};

const InlineStakeholders = ({task, onSave}) => {
  const [open, setOpen] = useState(false);
  const [other, setOther] = useState("");
  const ref = usePopover(open, () => setOpen(false));
  const sh = task.stakeholders || [];
  const togSH = s => {
    const next = sh.includes(s) ? sh.filter(x=>x!==s) : [...sh, s];
    onSave({...task, stakeholders: next});
  };
  const addOther = () => {
    const v = other.trim();
    if (!v || sh.includes(v)) { setOther(""); return; }
    onSave({...task, stakeholders: [...sh, v]});
    setOther("");
  };

  return (
    <span ref={ref} style={{position:"relative",display:"inline-block"}}>
      <span onClick={e=>{e.stopPropagation();setOpen(o=>!o);}} style={{cursor:"pointer",fontSize:11,color:"#888",borderBottom:sh.length?"none":"1px dashed #DDD"}}>
        {sh.length ? sh.map(s=>`(${s})`).join(" ") : "+ who"}
      </span>
      {open && (
        <span style={{...S.popover, display:"flex", flexDirection:"column", gap:6, minWidth:220}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {STAKEHOLDER_OPTIONS.map(s => <Tog key={s} active={sh.includes(s)} onClick={()=>togSH(s)}>{s}</Tog>)}
          </div>
          {sh.filter(s=>!STAKEHOLDER_OPTIONS.includes(s)).length>0 && (
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {sh.filter(s=>!STAKEHOLDER_OPTIONS.includes(s)).map(s=>(
                <span key={s} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,padding:"2px 8px",borderRadius:10,background:"#555",color:"#FFF",cursor:"pointer"}} onClick={()=>togSH(s)}>✕ {s}</span>
              ))}
            </div>
          )}
          <div style={{display:"flex",gap:4}}>
            <input value={other} onChange={e=>setOther(e.target.value)} placeholder="Other…" style={{...S.input,flex:1,fontSize:12,padding:"3px 6px"}} onKeyDown={e=>{if(e.key==="Enter")addOther();}} />
            <button style={{...S.btn,fontSize:11,padding:"3px 8px"}} onClick={addOther}>+</button>
          </div>
        </span>
      )}
    </span>
  );
};

const InlineText = ({value, onSave, placeholder, style, multiline=false, taskDone=false}) => {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value||"");
  useEffect(()=>{ setV(value||""); }, [value]);
  const commit = () => { setEditing(false); if ((v||"")!==(value||"")) onSave(v); };
  if (editing) {
    return multiline ? (
      <textarea autoFocus value={v} onChange={e=>setV(e.target.value)} onBlur={commit}
        onKeyDown={e=>{if(e.key==="Escape"){setV(value||"");setEditing(false);}if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))commit();}}
        rows={4}
        style={{...style, fontFamily:"Georgia,serif", border:"1px solid #C8A84B", borderRadius:4, padding:"4px 6px", outline:"none", background:"#FFFBF0", width:"100%", boxSizing:"border-box", resize:"vertical"}}
      />
    ) : (
      <input autoFocus value={v} onChange={e=>setV(e.target.value)} onBlur={commit}
        onKeyDown={e=>{if(e.key==="Enter")commit(); if(e.key==="Escape"){setV(value||"");setEditing(false);}}}
        style={{...style, fontFamily:"Georgia,serif", border:"1px solid #DDD", borderRadius:4, padding:"2px 6px", outline:"none", background:"#FFF"}}
      />
    );
  }
  if (!value) {
    return <span onClick={e=>{e.stopPropagation();setEditing(true);}} style={{...style, color:"#CCC", fontStyle:"italic", cursor:"text"}}>{placeholder}</span>;
  }
  return <span onClick={e=>{e.stopPropagation();setEditing(true);}} style={{...style, cursor:"text", textDecoration:taskDone?"line-through":"none"}}>{value}</span>;
};

const TaskRow = ({task,tasks,onToggleDone,onSave,onDelete,onMoveToToday,isParking,areas,projects,onProjectsChange}) => {
  const [hovered,setHovered] = useState(false);
  const [editing,setEditing] = useState(false);
  const [showNotes,setShowNotes] = useState(false);
  const touchStartX = useRef(null);

  const rl = task.recurType && task.recurType!=="None"
    ? ` (${task.recurType==="Every X" ? `Every ${task.recurInterval||1} ${task.recurUnit||"Days"}` : task.recurType})`
    : "";

  const handleTouchStart = e => { touchStartX.current=e.touches[0].clientX; };
  const handleTouchEnd = e => {
    if (touchStartX.current===null) return;
    const dx = e.changedTouches[0].clientX-touchStartX.current;
    if (dx>60&&isParking) onMoveToToday(task);
    touchStartX.current=null;
  };

  return (
    <>
      <div style={{display:"flex",alignItems:"flex-start",padding:"6px 16px",borderBottom:"1px solid #F0F0F0",gap:8,background:hovered?"#F5F5F0":"transparent",opacity:task.done?0.6:1}}
        onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
      >
        <button onClick={()=>onToggleDone(task)} style={{width:16,height:16,borderRadius:"50%",border:`1.5px solid ${task.done?"#BBB":"#888"}`,background:task.done?"#BBB":"transparent",cursor:"pointer",flexShrink:0,marginTop:4,padding:0}} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",flexWrap:"wrap",alignItems:"baseline",gap:"4px 6px"}}>
            <InlinePriority task={task} onSave={onSave} />
            <InlineDate task={task} onSave={onSave} rowHovered={hovered} />
            {rl && <span style={{fontSize:11,color:"#999",fontStyle:"italic"}}>{rl}</span>}
            <InlineText
              value={task.text}
              onSave={v=>onSave({...task, text:v})}
              placeholder="(untitled)"
              taskDone={task.done}
              style={{fontSize:14, lineHeight:1.4, wordBreak:"break-word"}}
            />
            <InlineArea task={task} onSave={onSave} areas={areas} />
            <InlineProject task={task} onSave={onSave} projects={projects} onProjectsChange={onProjectsChange} />
            <InlineStakeholders task={task} onSave={onSave} />
            {/* Blocker inline — wraps only if needed */}
            {(task.blocker || hovered) && (
              <span style={{fontSize:12,color:"#C0392B",fontStyle:"italic",display:"inline-flex",alignItems:"baseline",gap:3}}>
                <span style={{color:"#C0392B"}}>→</span>
                <InlineText
                  value={task.blocker}
                  onSave={v=>onSave({...task, blocker:v})}
                  placeholder="+ blocker"
                  style={{fontSize:12, color:"#C0392B", fontStyle:"italic"}}
                />
              </span>
            )}
            {/* Notes toggle inline */}
            <button onClick={e=>{e.stopPropagation();setShowNotes(n=>!n);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,padding:0,color:task.notes&&task.notes.trim()?(showNotes?"#8B6914":"#C8A84B"):"#CCC",lineHeight:1.4}}>
              {task.notes&&task.notes.trim() ? (showNotes?"📝 hide":"📋 notes") : (showNotes?"📝 hide":"+ notes")}
            </button>
          </div>
          {showNotes && (
            <div style={{marginTop:4, padding:"6px 10px", background:"#FFFBF0", borderLeft:"2px solid #C8A84B", borderRadius:"0 3px 3px 0"}}>
              <InlineText
                value={task.notes}
                onSave={v=>onSave({...task, notes:v})}
                placeholder="(click to add notes — ⌘+Enter to save)"
                multiline
                style={{fontSize:12, color:"#8B6914", lineHeight:1.5, whiteSpace:"pre-wrap", display:"block"}}
              />
            </div>
          )}
        </div>
        {hovered&&(
          <div style={{display:"flex",gap:4,flexShrink:0}}>
            {isParking&&<button onClick={()=>onMoveToToday(task)} style={{...S.btn,fontSize:11,color:"#C0392B",borderColor:"#C0392B",padding:"2px 8px"}}>→Today</button>}
            <button onClick={()=>setEditing(true)} title="Open full editor" style={{...S.btn,fontSize:11,padding:"2px 8px"}}>✎</button>
            <button onClick={()=>onDelete(task.id)} style={{...S.btn,fontSize:11,color:"#C0392B",padding:"2px 8px"}}>✕</button>
          </div>
        )}
      </div>
      {editing&&<EditModal task={task} tasks={tasks} areas={areas} projects={projects} onAreasChange={()=>{}} onProjectsChange={onProjectsChange} onSave={t=>{onSave(t);setEditing(false);}} onClose={()=>setEditing(false)} />}
    </>
  );
};

export default function App() {
  const [tasks,setTasks] = useState([]);
  const [loaded,setLoaded] = useState(false);
  const [areas,setAreas] = useState(["Work","Personal"]);
  const [projects,setProjects] = useState([]);
  const [quick,setQuick] = useState("");
  const [view,setView] = useState("both");
  const [filter,setFilter] = useState("");
  const [saved,setSaved] = useState("");
  const [showExp,setShowExp] = useState(false);
  const [imp,setImp] = useState(null);
  const [migr,setMigr] = useState(null);
  const [addingTo,setAddingTo] = useState(null);

  // Undo history — snapshots of previous task states. Capped at 30.
  const history = useRef([]);
  const [historyCount, setHistoryCount] = useState(0);

  // Wrapper: snapshot current tasks before mutating, then apply updater
  const setTasksWithHistory = updater => {
    setTasks(prev => {
      const snapshot = JSON.parse(JSON.stringify(prev));
      history.current.push(snapshot);
      if (history.current.length > 30) history.current.shift();
      setHistoryCount(history.current.length);
      return typeof updater === "function" ? updater(prev) : updater;
    });
  };

  const undo = () => {
    if (!history.current.length) return;
    const prev = history.current.pop();
    setHistoryCount(history.current.length);
    setTasks(prev);
  };

  // Cmd/Ctrl+Z keyboard shortcut for undo
  useEffect(() => {
    const handler = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        // Don't hijack if the user is typing inside an input/textarea/contenteditable
        const t = e.target;
        const tag = t?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(()=>{
    const loadFromStorage = async () => {
      try {
        const stored = localStorage.getItem("ash-todo-v6");
        const raw = stored ? JSON.parse(stored).map(nrmTask) : DEFAULT_TASKS;
        const needsMigr = raw.some(t=>!!MIGRATION_MAP[t.area]);
        if (needsMigr) setMigr(raw); else setTasks(raw);
      } catch {
        setTasks(DEFAULT_TASKS);
      }
      try{ const a=JSON.parse(localStorage.getItem("ash-areas")); if(a&&a.length)setAreas(a); }catch{}
      try{ const p=JSON.parse(localStorage.getItem("ash-projects")); if(p&&p.length)setProjects(p); }catch{}
      setLoaded(true);
    };
    loadFromStorage();
  },[]);

  useEffect(()=>{
    if (!loaded) return;
    try { localStorage.setItem("ash-todo-v6", JSON.stringify(tasks)); } catch {}
    setSaved("Saved");
    const t=setTimeout(()=>setSaved(""),1500);
    return()=>clearTimeout(t);
  },[tasks,loaded]);

  const doMigr = yes => {
    setTasks(yes ? migr.map(t=>({...t,area:MIGRATION_MAP[t.area]||t.area})) : migr);
    setMigr(null);
  };

  const addQ = e => {
    if (e.key==="Enter"&&quick.trim()) {
      setTasksWithHistory(p=>[mkTask({text:quick.trim(),section:"parking"}),...p]);
      setQuick("");
    }
  };

  const toggleDone = task => {
    if (!task.done && task.recurType && task.recurType!=="None") {
      const nd = nextRecurDate(task);
      const expired = task.recurEndDate && nd && nd>task.recurEndDate;
      if (!expired && nd) {
        setTasksWithHistory(p=>[
          ...p.map(t=>t.id===task.id?{...t,done:true}:t),
          mkTask({...task, id:genId(), done:false, dueDate:nd, created:todayStr(), section:""})
        ]);
        return;
      }
    }
    setTasksWithHistory(p=>p.map(t=>t.id===task.id?{...t,done:!t.done}:t));
  };

  const saveTask = updated => {
    setTasksWithHistory(p=>p.map(t=>t.id===updated.id?nrmTask(updated):t));
  };

  const delTask = id => setTasksWithHistory(p=>p.filter(t=>t.id!==id));

  const mv2today = task => setTasksWithHistory(p=>p.map(t=>t.id===task.id?{...t,section:"today",state:"To Do",dueDate:todayStr()}:t));

  const passFilter = t => {
    if (view==="work"&&t.area!=="Work") return false;
    if (view==="personal"&&t.area!=="Personal") return false;
    if (filter) { const q=filter.toLowerCase(); return [t.text,t.notes,t.blocker,t.area,t.project,...(t.stakeholders||[])].some(s=>s&&s.toLowerCase().includes(q)); }
    return true;
  };

  const addToSec = sid => {
    const sm2={"wf-urgent":"Waiting For","wf-other":"Waiting For"},pm={"wf-urgent":"High"};
    const t=mkTask({id:genId(),section:sid,state:sm2[sid]||"To Do",priority:pm[sid]||""});
    setTasksWithHistory(p=>[...p,t]);
    setAddingTo(t);
  };

  if (!loaded) return <div style={{fontFamily:"Georgia,serif",padding:"2rem",color:"#aaa"}}>Loading…</div>;

  if (migr) {
    const cnt = migr.filter(t=>!!MIGRATION_MAP[t.area]).length;
    return (
      <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
        <div style={{background:"#FFF",border:"1.5px solid #1a1a1a",borderRadius:8,padding:"1.5rem",maxWidth:460,width:"100%"}}>
          <div style={{fontSize:15,fontWeight:"bold",marginBottom:10}}>Area field update</div>
          <div style={{fontSize:13,color:"#444",lineHeight:1.6,marginBottom:"1rem"}}>
            Area simplified to <strong>Work</strong> and <strong>Personal</strong>.<br/><br/>
            <strong>{cnt} tasks</strong> can be auto-migrated:<br/>
            <span style={{color:"#666"}}>Job Search → Work · Family/Rob/Phi/Nanny → Personal</span>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={()=>doMigr(false)} style={{...S.btn}}>Keep old values</button>
            <button onClick={()=>doMigr(true)} style={{...S.btn,background:"#2C2C2C",color:"#FFF",border:"none"}}>Auto-migrate</button>
          </div>
        </div>
      </div>
    );
  }

  const sm={};
  SECTIONS.forEach(s=>{sm[s.id]=[];});
  tasks.forEach(t=>{ if(!passFilter(t))return; const sid=deriveSection(t); if(sm[sid])sm[sid].push(t); });
  Object.keys(sm).forEach(k=>{sm[k]=sortTasks(sm[k]);});

  const todayView = view==="today";
  const smartTasks = todayView ? sortTasks(tasks.filter(t=>!t.done&&passFilter(t)&&(t.section==="today"||(t.dueDate&&t.dueDate<=todayStr())||isRecurringToday(t)))) : [];

  const nAct=tasks.filter(t=>!t.done).length;
  const nDone=tasks.filter(t=>t.done).length;
  const nOvd=tasks.filter(t=>t.dueDate&&t.dueDate<todayStr()&&!t.done&&passFilter(t)).length;
  const nStale=tasks.filter(t=>!t.done&&((t.area&&!areas.includes(t.area))||(t.project&&!projects.includes(t.project)))).length;

  const projectsChangeHandler = p=>{setProjects(p);try{localStorage.setItem("ash-projects",JSON.stringify(p));}catch{}};

  const rowProps = (t,sec) => ({
    task:t, tasks, areas, projects,
    onToggleDone:toggleDone, onSave:saveTask, onDelete:delTask,
    onMoveToToday:mv2today, isParking:sec.id==="parking",
    onProjectsChange: projectsChangeHandler
  });

  return (
    <div style={S.app}>
      <div style={{position:"sticky",top:0,zIndex:100,background:"#FAFAF7",borderBottom:"1px solid #DDD",padding:"8px 16px"}}>
        <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap",marginBottom:6}}>
          <span style={{fontSize:17,fontWeight:"bold",fontFamily:"Georgia,serif"}}>Ash's To-Do</span>
          <span style={{fontSize:12,color:"#999",fontFamily:"monospace"}}>
            {nAct} active · {nDone} done
            {nOvd>0&&<span style={{marginLeft:8,color:"#C0392B",fontWeight:"bold"}}>⚠ {nOvd} overdue</span>}
            {nStale>0&&<span style={{marginLeft:8,color:"#E67E22",fontWeight:"bold"}}>⚠ {nStale} stale</span>}
            {saved&&<span style={{marginLeft:8,color:"#27AE60"}}>{saved}</span>}
          </span>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:6,flexWrap:"wrap"}}>
          {["both","work","personal","today"].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{...S.tog(view===v),textTransform:v==="today"?"none":"capitalize"}}>
              {v==="today"?"Today ✦":v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:5}}>
          <span style={{fontSize:12,color:"#8B7355",fontStyle:"italic"}}>+ lot</span>
          <input value={quick} onChange={e=>setQuick(e.target.value)} onKeyDown={addQ} placeholder="Quick capture → Enter to add to Parking Lot" style={{flex:1,border:"none",borderBottom:"1px solid #CCC",background:"transparent",fontSize:13,padding:"3px 0",outline:"none",fontFamily:"Georgia,serif"}} />
        </div>
        <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search…" style={{width:"100%",border:"none",borderBottom:"1px solid #EEE",background:"transparent",fontSize:12,padding:"2px 0",outline:"none",fontFamily:"sans-serif",color:"#666",boxSizing:"border-box",marginBottom:6}} />
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button
            onClick={undo}
            disabled={historyCount===0}
            title={historyCount===0 ? "Nothing to undo" : `Undo (${historyCount} step${historyCount===1?"":"s"} available)`}
            style={{...S.btn, opacity: historyCount===0 ? 0.4 : 1, cursor: historyCount===0 ? "not-allowed" : "pointer"}}
          >↶ Undo{historyCount>0?` (${historyCount})`:""}</button>
          <button onClick={()=>setShowExp(true)} style={S.btn}>↓ Export JSON</button>
          <label style={S.btn}>
            ↑ Import JSON
            <input type="file" accept=".json" style={{display:"none"}} onChange={e=>{
              const f=e.target.files[0]; if(!f)return;
              const r=new FileReader();
              r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(Array.isArray(d))setImp(d.map(nrmTask));else alert("Invalid file.");}catch(err){alert("Error: "+err.message);}};
              r.readAsText(f); e.target.value="";
            }} />
          </label>
        </div>
      </div>

      <div style={{paddingBottom:"3rem"}}>
        {todayView&&(
          <div>
            <div style={{padding:"10px 16px",fontSize:13,color:"#888",fontStyle:"italic"}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
            {smartTasks.length===0&&<div style={{padding:"2rem 16px",color:"#BBB",fontStyle:"italic"}}>Nothing due today. Enjoy the day, Ash. 🌺</div>}
            {smartTasks.map(t=><TaskRow key={t.id} {...rowProps(t,{id:"today"})} />)}
          </div>
        )}
        {!todayView&&SECTIONS.map(sec=>{
          const items=sm[sec.id]||[];
          if (!items.length&&sec.id!=="parking"&&sec.id!=="done") return null;
          if (sec.id==="done"&&!items.length) return null;
          return (
            <div key={sec.id}>
              <div style={{color:sec.color,fontWeight:"bold",fontSize:14,padding:"10px 16px 4px",borderBottom:`2px solid ${sec.color}30`,display:"flex",alignItems:"center",gap:8}}>
                <span>{sec.label}</span>
                <span style={{fontSize:12,color:"#BBB",fontWeight:"normal"}}>{items.length}</span>
                {sec.id!=="done"&&<button onClick={()=>addToSec(sec.id)} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:sec.color,fontSize:18,lineHeight:1}}>＋</button>}
              </div>
              {!items.length&&<div style={{padding:"6px 16px",fontSize:12,color:"#CCC",fontStyle:"italic"}}>Empty</div>}
              {items.map(t=><TaskRow key={t.id} {...rowProps(t,sec)} />)}
            </div>
          );
        })}
      </div>

      {showExp&&(
        <div style={S.overlay} onClick={()=>setShowExp(false)}>
          <div style={{...S.modal,maxHeight:"90vh",display:"flex",flexDirection:"column",gap:10}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:"bold"}}>Export JSON</div>
            <div style={{fontSize:12,color:"#666"}}>Click inside → Cmd+A → Cmd+C → paste into TextEdit (plain text) → save as ash-tasks.json</div>
            <textarea readOnly value={JSON.stringify(tasks,null,2)} onFocus={e=>e.target.select()} style={{flex:1,minHeight:300,fontFamily:"monospace",fontSize:11,padding:8,border:"1px solid #CCC",borderRadius:4,background:"#F9F9F9",resize:"vertical"}} />
            <div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={()=>setShowExp(false)} style={{...S.btn,background:"#2C2C2C",color:"#FFF",border:"none"}}>Done</button></div>
          </div>
        </div>
      )}

      {imp&&(
        <div style={S.overlay} onClick={()=>setImp(null)}>
          <div style={S.modal} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:"bold",marginBottom:8}}>Import {imp.length} tasks?</div>
            <div style={{fontSize:13,color:"#666",marginBottom:"1rem"}}>This will replace all current tasks.</div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
              <button onClick={()=>setImp(null)} style={S.btn}>Cancel</button>
              <button onClick={()=>{setTasksWithHistory(imp);setImp(null);}} style={{...S.btn,background:"#2C2C2C",color:"#FFF",border:"none"}}>Import</button>
            </div>
          </div>
        </div>
      )}

      {addingTo&&(
        <EditModal task={addingTo} tasks={tasks} areas={areas} projects={projects}
          onAreasChange={a=>{setAreas(a);try{localStorage.setItem("ash-areas",JSON.stringify(a));}catch{}}}
          onProjectsChange={projectsChangeHandler}
          onSave={t=>{setTasks(p=>p.find(x=>x.id===t.id)?p.map(x=>x.id===t.id?nrmTask(t):x):[...p,nrmTask(t)]);setAddingTo(null);}}
          onClose={()=>{setTasks(p=>p.filter(t=>t.id!==addingTo.id));setAddingTo(null);}}
        />
      )}
    </div>
  );
}
