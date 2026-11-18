import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, CircleHelp, ClipboardList, Flower2, Heart, HeartPulse, Home, LockKeyhole, Menu, Moon, Plus, Printer, ShieldCheck, Sparkles, Watch, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { toast } from "sonner";
import { api, type Cycle } from "@/lib/femora-api";
import { authClient, useAuthSession } from "@/lib/auth-client";
import "../App.css";
import "../client.css";

type NavPage = "Overview" | "Cycle insights" | "Symptom journal" | "Clinical report" | "Family tree" | "Connections";
type SymptomEntry = { id: number; symptom_code: string; severity: number; recorded_on: string };
type Forecast = { estimate: string | null; earliest: string | null; latest: string | null; cycle_length_days: number | null; confidence: string; explanation: string };
const navItems: NavPage[] = ["Overview", "Cycle insights", "Symptom journal", "Clinical report", "Family tree", "Connections"];
const chartData = [{day:"Mon",value:62},{day:"Tue",value:74},{day:"Wed",value:67},{day:"Thu",value:81},{day:"Fri",value:72},{day:"Sat",value:88},{day:"Sun",value:78}];
const demoCycles: Cycle[] = [{start_date:"2025-12-17",flow:"medium"},{start_date:"2026-01-17",flow:"light"},{start_date:"2026-02-16",flow:"medium"},{start_date:"2026-03-18",flow:"medium"}];
const apiError = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";

export default function Index() {
  const [page, setPage] = useState<NavPage>("Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [cycles, setCycles] = useState<Cycle[]>(demoCycles);
  const { data: sessionData, isPending: sessionPending } = useAuthSession();
  const token = sessionData?.user.id ?? "";
  const email = sessionData?.user.email ?? "";
  const [authOpen, setAuthOpen] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [flow, setFlow] = useState("medium");
  const [consented, setConsented] = useState(false);
  const [clinicalText, setClinicalText] = useState("");
  const [summary, setSummary] = useState<{metrics:{column:string;count:number;mean:number;min:number;max:number;standard_deviation:number}[]}|null>(null);
  const [busy, setBusy] = useState(false);
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>([]);
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().slice(0, 10));
  const [symptomCode, setSymptomCode] = useState("cramps");
  const [severity, setSeverity] = useState(3);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [wearableConsent, setWearableConsent] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const average = useMemo(() => {
    if (cycles.length < 2) return 30;
    const ordered = [...cycles].sort((a,b) => a.start_date.localeCompare(b.start_date));
    const gaps = ordered.slice(1).map((cycle,index) => (new Date(cycle.start_date).getTime() - new Date(ordered[index].start_date).getTime()) / 86400000);
    return Math.round(gaps.reduce((a,b) => a+b,0)/gaps.length);
  }, [cycles]);

  useEffect(() => {
    if (!token) { setCycles(demoCycles); return; }
    let active = true;
    api<Cycle[]>("/api/cycles", token).then(records => {
      if (active) setCycles(records);
    }).catch(error => {
      if (active) toast.error("Could not load your account data", {description:apiError(error)});
    });
    api<{purpose:string;granted:boolean}[]>("/api/consents", token).then(items => {
      if (!active) return;
      const allowed = items.some(item => item.purpose === "ml_analysis" && item.granted);
      setConsented(allowed);
      setWearableConsent(items.some(item => item.purpose === "wearable_sync" && item.granted));
      if (allowed) api<Forecast>("/api/forecast/cycle", token).then(value => { if (active) setForecast(value); }).catch(() => undefined);
    }).catch(() => undefined);
    api<SymptomEntry[]>("/api/symptoms", token).then(items => { if (active) setSymptoms(items); }).catch(() => undefined);
    return () => { active = false; };
  }, [token]);

  const go = (item: NavPage) => {
    setPage(item); setMenuOpen(false);
    const id: Record<NavPage,string> = {Overview:"overview", "Cycle insights":"cycle-section", "Symptom journal":"symptom-section", "Clinical report":"report-section", "Family tree":"family-section", Connections:"connections"};
    document.getElementById(id[item])?.scrollIntoView({behavior:"smooth",block:"start"});
  };

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setAuthBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const address = String(form.get("email")); const password = String(form.get("password"));
      const result = registerMode ? await authClient.signUp.email({ email: address, password, name: address.split("@")[0] }) : await authClient.signIn.email({ email: address, password });
      if (result.error) throw new Error(result.error.message);
      setAuthOpen(false);
      toast.success(registerMode ? "Your account is ready" : "Welcome back", {description:"Your account is protected by Neon Auth."});
    } catch(error) { toast.error(registerMode ? "Account could not be created" : "Sign-in failed", {description:apiError(error)}); }
    finally { setAuthBusy(false); }
  };

  const saveCycle = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      if (token) {
        await api("/api/cycles", token, {method:"POST",body:JSON.stringify({start_date:date,flow})});
        setCycles(await api<Cycle[]>("/api/cycles", token));
        toast.success("Cycle update synced to your account");
      } else {
        setAuthOpen(true);
        toast.info("Sign in to save your private cycle record");
        return;
      }
      setModal(false);
    } catch(error) { toast.error("Could not save your update", {description:apiError(error)}); }
    finally { setBusy(false); }
  };

  const updateConsent = async () => {
    if (!token) { setAuthOpen(true); toast.info("Sign in to manage account consent"); return; }
    try {
      await api("/api/consents", token, {method:"PUT",body:JSON.stringify({purpose:"ml_analysis",granted:!consented,policy_version:"2026-01"})});
      setConsented(!consented);
      if (!consented) api<Forecast>("/api/forecast/cycle", token).then(setForecast).catch(() => setForecast(null));
      else setForecast(null);
      toast.success(!consented ? "ML analysis consent enabled" : "ML analysis consent withdrawn");
    } catch(error) { toast.error("Could not update consent", {description:apiError(error)}); }
  };

  const requestWearablePermission = async () => {
    if (!token) { setAuthOpen(true); toast.info("Sign in before managing device permissions"); return; }
    try {
      await api("/api/consents", token, { method: "PUT", body: JSON.stringify({ purpose: "wearable_sync", granted: !wearableConsent, policy_version: "2026-01" }) });
      setWearableConsent(!wearableConsent);
      toast.success(!wearableConsent ? "Device data permission recorded" : "Device data permission withdrawn", { description: "Health platform authorization is still required and is not active in this web build." });
    } catch (error) { toast.error("Could not update device permission", { description: apiError(error) }); }
  };

  const saveSymptom = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) { setAuthOpen(true); toast.info("Sign in to save your private check-in"); return; }
    setBusy(true);
    try {
      await api("/api/symptoms", token, { method: "POST", body: JSON.stringify({ symptom_code: symptomCode, severity, recorded_on: selectedDay }) });
      setSymptoms(await api<SymptomEntry[]>(`/api/symptoms?day=${selectedDay}`, token));
      toast.success("Check-in saved privately");
    } catch (error) { toast.error("Could not save check-in", { description: apiError(error) }); }
    finally { setBusy(false); }
  };

  const calendarCells = (() => { const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1); const offset = (first.getDay() + 6) % 7; const count = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate(); return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)]; })();

  const createSummary = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) { setAuthOpen(true); toast.info("Sign in to create a private clinical summary"); return; }
    if (!consented) { toast.error("Enable ML analysis consent first"); return; }
    const lines = clinicalText.trim().split(/\r?\n/).filter(Boolean);
    const headers = lines[0]?.split(",").map(value=>value.trim());
    if (!headers || lines.length < 2) { toast.error("Paste Kaggle CSV data with a header and at least one row"); return; }
    const rows = lines.slice(1,5001).map(line => Object.fromEntries(line.split(",").map((value,index)=>[headers[index], Number(value.trim())]).filter(([key,value])=>key && Number.isFinite(value))));
    setBusy(true);
    try { setSummary(await api("/api/kaggle/analyze",token,{method:"POST",body:JSON.stringify({dataset_name:"Kaggle CSV upload",rows})})); }
    catch(error) { toast.error("Summary could not be created", {description:apiError(error)}); }
    finally { setBusy(false); }
  };

  if (sessionPending) return <div className="femora-app" aria-busy="true"/>;

  return <div className="femora-app">
    <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
      <a className="brand" href="#home" aria-label="Femora home"><span className="brand-icon"><Flower2 size={21}/></span><span>femora<small>WELLNESS, IN YOUR RHYTHM</small></span></a>
      <div className="side-label">YOUR SPACE</div>
      <nav className="side-nav">{navItems.map((item,index) => {const Icon=[Home,CalendarDays,Heart,ClipboardList,Flower2,Watch][index];return <button className={page===item?"nav-link selected":"nav-link"} key={item} onClick={()=>go(item)}><Icon size={18}/><span>{item}</span></button>;})}</nav>
      <div className="sidebar-spacer"/><div className="privacy-card"><ShieldCheck size={18}/><div><b>Your health, your choice</b><span>{token?"Secure account session":"Preview data stays in this browser"}</span></div></div>
      <button className="nav-link settings-link" onClick={()=>token?authClient.signOut({}):setAuthOpen(true)}><LockKeyhole size={17}/>{token?"Sign out":"Sign in / create account"}</button>
      <div className="profile"><span className="profile-avatar">{token?email.charAt(0).toUpperCase():"F"}</span><span><b>{token?email:"Preview space"}</b><small>{token?"Account connected":"Not signed in"}</small></span><ChevronDown size={16}/></div>
    </aside>
    {menuOpen && <button aria-label="Close navigation" className="mobile-scrim" onClick={()=>setMenuOpen(false)}/>}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" onClick={()=>setMenuOpen(true)} aria-label="Open menu"><Menu/></button><div className="crumb">My space <span>/</span> <b>{page}</b></div><div className="topbar-right"><span className="today-label"><span className="live-dot"/>{token?"Account connected":"Private preview"}</span>{token?<button className="connect-button" onClick={()=>authClient.signOut({})}>Sign out</button>:<button className="connect-button" onClick={()=>setAuthOpen(true)}>Sign in</button>}<button className="round-icon" aria-label="Notifications" onClick={()=>toast("All caught up",{description:"There are no new notifications."})}><Bell size={17}/></button><span className="tiny-avatar">{token?email.charAt(0).toUpperCase():"F"}</span></div></header>
      <div className="page-content" id="overview">
        <section className="greeting"><div><div className="eyebrow"><Sparkles size={14}/> YOUR HEALTH, IN CONTEXT</div><h1>A little more in tune,<br/><em>every day.</em></h1><p>Small check-ins. Meaningful patterns. A space that moves with you.</p></div><div className="date-stamp"><CalendarDays size={16}/>{new Intl.DateTimeFormat("en",{weekday:"long",month:"long",day:"numeric"}).format(new Date())}</div></section>
        <section className="hero-panel"><div className="hero-copy"><div className="hero-kicker"><span/> YOUR CYCLE, YOUR RHYTHM</div><h2>Know your rhythm.<br/><i>Trust your journey.</i></h2><p>{token?"Your account timeline is ready for thoughtful check-ins.":"Sign in to sync your cycle timeline across sessions."}</p><button className="primary-button" onClick={()=>setModal(true)}>Log a cycle update <ArrowUpRight size={17}/></button><small className="estimate-note"><ShieldCheck size={13}/> Personal estimates, not medical predictions</small></div><div className="hero-visual" aria-hidden="true"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="orbit orbit-c"/><div className="flower-core"><Flower2 size={60} strokeWidth={1.1}/></div><span className="orbit-dot dot-a"/><span className="orbit-dot dot-b"/><span className="orbit-dot dot-c"/><div className="phase-chip"><Moon size={14}/> Your cycle, in bloom</div></div><div className="hero-number"><span>AVG</span><b>{average}</b><small>days between starts</small></div></section>
        <section className="cycle-experience" id="cycle-section"><article className="panel cycle-calendar"><div className="panel-heading"><div><div className="insight-tag"><CalendarDays size={13}/> YOUR CYCLE CALENDAR</div><h3>{new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(calendarMonth)}</h3><p>Tap a date to review or add a check-in.</p></div><div className="calendar-controls"><button className="icon-action" aria-label="Previous month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>‹</button><button className="icon-action" aria-label="Next month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>›</button></div></div><div className="calendar-grid calendar-weekdays">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day=><span key={day}>{day}</span>)}</div><div className="calendar-grid">{calendarCells.map((day,index)=>{if(!day)return <span key={`empty-${index}`}/>;const key=`${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth()+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;const period=cycles.some(cycle=>cycle.start_date===key);const logged=symptoms.some(item=>item.recorded_on===key);return <button key={key} className={`calendar-day ${selectedDay===key?"active":""} ${period?"period-day":""} ${logged?"logged-day":""}`} onClick={()=>setSelectedDay(key)} aria-label={`${key}${period?", period start":""}${logged?", check-in logged":""}`}>{day}{logged&&<i/>}</button>;})}</div><div className="calendar-legend"><span><i className="legend-period"/>Period start</span><span><i className="legend-log"/>Check-in logged</span></div></article><article className="panel cycle-prediction"><div className="insight-tag"><Sparkles size={13}/> PERSONAL CYCLE INSIGHT</div>{forecast?.estimate?<><strong className="prediction-date">{new Intl.DateTimeFormat("en",{month:"short",day:"numeric"}).format(new Date(`${forecast.estimate}T12:00:00`))}</strong><p>Estimated next period · {forecast.earliest && new Intl.DateTimeFormat("en",{month:"short",day:"numeric"}).format(new Date(`${forecast.earliest}T12:00:00`))}–{forecast.latest && new Intl.DateTimeFormat("en",{month:"short",day:"numeric"}).format(new Date(`${forecast.latest}T12:00:00`))} window</p><span className="forecast-confidence">{forecast.confidence} confidence · based on your history</span><small>{forecast.explanation}</small></>:<><strong className="prediction-date">{token?"Learning your rhythm":"Your rhythm, your story"}</strong><p>{token?(consented?"Add at least three period starts for a personal estimate.":"Enable cycle insights consent to view a personal estimate."):"Sign in and log cycle starts to unlock personal estimates."}</p><small>Predictions are estimates—not contraception or medical advice.</small></>}{token&&!consented&&<button className="panel-link" onClick={updateConsent}>Enable insights with consent <ArrowUpRight size={14}/></button>}</article></section>
        <div className="section-title" id="wellbeing-section"><div><h2>Your wellbeing, at a glance</h2><p>{token?"Account-backed cycle history":"Clearly labeled sample cycle history"}</p></div><button className="subtle-button" onClick={()=>go("Clinical report")}>Prepare a visit summary <ArrowUpRight size={15}/></button></div>
        <section className="metric-grid"><article className="metric-card"><div className="metric-heading"><span className="metric-icon lavender"><CalendarDays size={18}/></span><span className="metric-label">CYCLE LENGTH</span><span className="trend positive"><ArrowDownRight size={14}/> {cycles.length} records</span></div><div className="metric-value">{average}<small> days</small></div><p>Average between recorded starts</p><div className="tiny-bars">{[35,52,43,68,58,76,63,88,69,81,72,92].map((height,i)=><i key={i} style={{height:`${height}%`}}/>)}</div></article>
        <article className="metric-card"><div className="metric-heading"><span className="metric-icon coral"><Heart size={18}/></span><span className="metric-label">LIFE STAGE</span><span className="trend neutral">Your choice</span></div><div className="metric-value phase-value">Personal</div><p>Life-stage dashboards are not yet configured</p><button className="panel-link" onClick={()=>toast("Life-stage setup",{description:"Choose life-stage metrics during account setup in a future phase."})}>Learn about stages <ArrowUpRight size={14}/></button></article>
        <article className="metric-card recovery-card"><div className="metric-heading"><span className="metric-icon mint"><HeartPulse size={18}/></span><span className="metric-label">REST & RECOVERY</span><span className="trend neutral">Demo only</span></div><div className="metric-value">78<small> <span className="score-unit">/ 100</span></small></div><p>Illustrative sample data, not from a wearable</p><div className="chart-wrap"><ResponsiveContainer width="100%" height="56"><AreaChart data={chartData}><defs><linearGradient id="recoveryFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b47bff" stopOpacity={0.3}/><stop offset="100%" stopColor="#b47bff" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#ffffff10" vertical={false}/><XAxis dataKey="day" hide/><Tooltip contentStyle={{background:"#21172d",border:"1px solid #ffffff18",borderRadius:12,color:"#f4edf9"}}/><Area type="monotone" dataKey="value" stroke="#be91ff" strokeWidth={2} fill="url(#recoveryFill)"/></AreaChart></ResponsiveContainer></div></article></section>
        <section className="lower-grid"><article className="panel cycle-panel"><div className="panel-heading"><div><h3>Your cycle timeline</h3><p>{token?"Synced to your account":"Sample preview · sign in for private account sync"}</p></div><button className="icon-action" onClick={()=>setModal(true)} aria-label="Add cycle"><Plus size={17}/></button></div><div className="timeline-list">{[...cycles].sort((a,b)=>b.start_date.localeCompare(a.start_date)).slice(0,4).map((cycle,index)=><div className="timeline-row" key={cycle.id??cycle.start_date}><span className={`timeline-marker ${index===0?"latest":""}`}/><div><b>{new Intl.DateTimeFormat("en",{month:"short",day:"numeric",year:"numeric"}).format(new Date(`${cycle.start_date}T12:00:00`))}</b><span>Period started · {cycle.flow??"flow not recorded"}</span></div><small>{index===0?"Latest":"Logged"}</small></div>)}</div><button className="panel-link" onClick={()=>go("Cycle insights")}>View cycle insights <ArrowUpRight size={14}/></button></article>
        <article className="panel insight-panel"><div className="insight-illustration"><span className="insight-orbit one"/><span className="insight-orbit two"/><Flower2 size={39}/><Sparkles className="sparkle-one" size={15}/></div><div className="insight-copy"><div className="insight-tag"><Sparkles size={13}/> A GENTLE REMINDER</div><h3>Your patterns are uniquely yours.</h3><p>Cycle length can change over time. Estimates may be limited when there is little history.</p><button className="panel-link" onClick={()=>setModal(true)}>Add a check-in <ArrowUpRight size={14}/></button></div></article></section>
        <section className="symptom-tracker panel" id="symptom-section"><div className="panel-heading"><div><div className="insight-tag"><HeartPulse size={13}/> DAILY CHECK-IN</div><h3>How are you feeling today?</h3><p>{new Intl.DateTimeFormat("en",{weekday:"long",month:"long",day:"numeric"}).format(new Date(selectedDay+"T12:00:00"))} · your entries stay private</p></div><span className="metric-icon coral"><Heart size={18}/></span></div><form className="symptom-form" onSubmit={saveSymptom}><label>Choose what you want to track<select value={symptomCode} onChange={event=>setSymptomCode(event.target.value)}><option value="cramps">Cramps</option><option value="headache">Headache</option><option value="bloating">Bloating</option><option value="fatigue">Energy / fatigue</option><option value="mood_low">Low mood</option><option value="mood_good">Mood uplift</option><option value="tender_breasts">Breast tenderness</option><option value="sleep_disruption">Sleep</option><option value="libido_change">Libido</option></select></label><label>Intensity <span>{severity}/10</span><input aria-label="Intensity" type="range" min="1" max="10" value={severity} onChange={event=>setSeverity(Number(event.target.value))}/></label><button className="primary-button" disabled={busy}>{busy?"Saving…":"Save check-in"}<Check size={15}/></button></form><div className="symptom-entries">{symptoms.filter(entry=>entry.recorded_on===selectedDay).map(entry=><span className="symptom-chip" key={entry.id}>{entry.symptom_code.replace(/_/g," ")} <b>{entry.severity}/10</b></span>)}{!symptoms.some(entry=>entry.recorded_on===selectedDay)&&<span className="symptom-empty">No check-ins logged for this date yet.</span>}</div><p className="symptom-safety">Tracking supports reflection, not diagnosis. Contact a qualified clinician for health concerns.</p></section>
        <section className="extended-grid" id="journal-section"><article className="panel feature-panel"><div className="panel-heading"><div><div className="insight-tag"><HeartPulse size={13}/> KAGGLE DATASET ANALYSIS</div><h3>Kaggle dataset analysis</h3><p>Paste a Kaggle-exported CSV for private descriptive analysis.</p></div><ClipboardList size={21} className="feature-heading-icon"/></div><form className="clinical-form" onSubmit={createSummary}><textarea value={clinicalText} onChange={event=>setClinicalText(event.target.value)} maxLength={500000} placeholder="Paste Kaggle CSV data here (header row + up to 5,000 data rows)…"/><button className="primary-button" disabled={busy||!clinicalText.trim()}>{busy?"Preparing…":"Analyze Kaggle dataset"}<ArrowUpRight size={15}/></button></form><div className="consent-row"><span><ShieldCheck size={14}/> Allow dataset analysis for this account</span><button type="button" className={`consent-toggle ${consented?"on":""}`} onClick={updateConsent} aria-pressed={consented}><i/></button></div>{summary&&<div className="summary-result"><b>Numeric column analysis</b>{summary.metrics.map(metric=><p key={metric.column}>{metric.column}: mean {metric.mean} · range {metric.min}–{metric.max} · n={metric.count}</p>)}<small>Descriptive dataset statistics only; not a medical prediction.</small></div>}</article>
        <article className="panel feature-panel report-panel" id="report-section"><div className="panel-heading"><div><div className="insight-tag"><ClipboardList size={13}/> APPOINTMENT PREP</div><h3>Clinical visit brief</h3><p>Review your own account timeline before printing.</p></div><Printer size={21} className="feature-heading-icon"/></div><div className="brief-preview"><div><span>RECORDED CYCLE STARTS</span><b>{cycles.length}</b></div><div><span>AVERAGE INTERVAL</span><b>{cycles.length>1?`${average} days`:"Not enough entries"}</b></div><div><span>DATA SOURCE</span><b>{token?"Your account":"Sample preview"}</b></div></div><p className="report-caveat">This is not a diagnosis, medical record, or FHIR export. Confirm all information with your clinician.</p><button className="subtle-button" onClick={()=>window.print()}><Printer size={14}/> Print this page</button></article></section>
        <section className="family-panel panel" id="family-section"><div className="panel-heading"><div><div className="insight-tag"><Flower2 size={13}/> GENERATIONS, WITH PERMISSION</div><h3>Family health circle</h3><p>Daily symptom tracking can help you notice personal patterns over time.</p></div><ShieldCheck className="feature-heading-icon" size={21}/></div><div className="family-tree"><div className="family-member"><span className="family-avatar">M</span><b>Mother</b><small>Connection not linked</small></div><span className="tree-line"/><div className="family-member self"><span className="family-avatar">Y</span><b>Your account</b><small>{token?"Signed in":"Preview only"}</small></div><span className="tree-line"/><div className="family-member"><span className="family-avatar">D</span><b>Daughter / relative</b><small>Connection not linked</small></div></div><p className="feature-footnote">Illustrative layout only. Family invitations, verified handshakes, and scoped sharing are not implemented.</p></section>
        <section className="connections-section" id="connections"><div className="section-title"><div><h2>Bring your health into focus</h2><p>Choose whether to allow future sync; no device data is accessed yet</p></div><span className="coming-badge"><ShieldCheck size={13}/> Permission first</span></div><div className="device-grid">{["Apple Health","Health Connect","Fitbit"].map((device,index)=><article className="device-card" key={device}><span className={`device-icon device-${index}`}><Watch size={19}/></span><div className="device-copy"><b>{device}</b><span>{index===0?"iPhone & Apple Watch":index===1?"Android & Wear OS":"Cross-platform wearable"}</span></div><button className="connect-button" onClick={requestWearablePermission}>{wearableConsent?"Permission recorded":"Request permission"}</button></article>)}</div><p className="wearable-note"><CircleHelp size={14}/> No biometric data is being read from these platforms.</p></section>
        <footer className="footer-note"><ShieldCheck size={14}/><span>Femora is a personal wellness companion, not a medical device. Estimates are educational and not a diagnosis.</span><button onClick={()=>toast("Privacy first",{description:token?"Your session is managed securely by Neon Auth.":"No account or cloud sync is active until you sign in."})}>Privacy & data</button></footer>
      </div>
    </main>
    {modal&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setModal(false)}}><form className="cycle-modal" onSubmit={saveCycle}><button type="button" className="modal-close" onClick={()=>setModal(false)} aria-label="Close"><X size={18}/></button><div className="modal-icon"><CalendarDays size={20}/></div><div className="eyebrow">A MOMENT FOR YOU</div><h2>Log a cycle update</h2><p>{token?"Saved to your account.":"Sign in to store this update privately."}</p><label htmlFor="cycle-date">Period start date</label><input id="cycle-date" type="date" value={date} onChange={event=>setDate(event.target.value)} required/><label htmlFor="cycle-flow">Flow</label><select id="cycle-flow" value={flow} onChange={event=>setFlow(event.target.value)}><option value="light">Light</option><option value="medium">Moderate</option><option value="heavy">Heavy</option></select><button className="primary-button modal-submit" disabled={busy}>{busy?"Saving…":"Save check-in"}<ArrowUpRight size={16}/></button><div className="modal-privacy"><ShieldCheck size={14}/>{token?"Stored under your signed-in account":"No account sync until sign-in"}</div></form></div>}
    {authOpen&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setAuthOpen(false)}}><form className="cycle-modal" onSubmit={signIn}><button type="button" className="modal-close" onClick={()=>setAuthOpen(false)} aria-label="Close"><X size={18}/></button><div className="modal-icon"><LockKeyhole size={20}/></div><div className="eyebrow">PRIVATE ACCOUNT SYNC</div><h2>{registerMode?"Create your account":"Welcome back"}</h2><p>Sign in securely to sync your account and health records.</p><label htmlFor="auth-email">Email</label><input id="auth-email" name="email" type="email" defaultValue={email} autoComplete="email" required/><label htmlFor="auth-password">Password</label><input id="auth-password" name="password" type="password" minLength={registerMode?12:1} maxLength={128} autoComplete={registerMode?"new-password":"current-password"} required/><button className="primary-button modal-submit" disabled={authBusy}>{authBusy?"Connecting…":registerMode?"Create account":"Sign in"}<ArrowUpRight size={16}/></button><button type="button" className="panel-link auth-switch" onClick={()=>setRegisterMode(!registerMode)}>{registerMode?"Already have an account? Sign in":"New here? Create an account"}</button></form></div>}
  </div>;
}
