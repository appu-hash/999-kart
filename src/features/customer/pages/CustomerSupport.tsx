import { useCallback,useEffect,useState,type FormEvent } from "react";
import { Link,useNavigate } from "react-router-dom";
import { ArrowLeft,ChevronRight,Headset,MessageCircle,Plus,Send,TicketCheck,X } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import "./CustomerSupport.css";

type Ticket={id:string;ticket_number:string;subject:string;category:string;priority:string;status:string;created_at:string;updated_at:string};
type Reply={id:string;ticket_id:string;sender_role:string;message:string;created_at:string};
const categories=["Order issue","Payment issue","Delivery problem","Return or refund","Product issue","Account issue","Other"];
const statusName=(s:string)=>s.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
const when=(v:string)=>new Date(v).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});

export default function CustomerSupport(){
 const navigate=useNavigate();
 const [tickets,setTickets]=useState<Ticket[]>([]);
 const [replies,setReplies]=useState<Reply[]>([]);
 const [loading,setLoading]=useState(true);
 const [showForm,setShowForm]=useState(false);
 const [selected,setSelected]=useState<Ticket|null>(null);
 const [subject,setSubject]=useState("");
 const [category,setCategory]=useState(categories[0]);
 const [priority,setPriority]=useState("normal");
 const [message,setMessage]=useState("");
 const [replyText,setReplyText]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);

 const load=useCallback(async()=>{
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user){navigate("/login",{replace:true,state:{from:"/account/support"}});return;}
  const {data,error}=await supabase.from("support_tickets").select("id,ticket_number,subject,category,priority,status,created_at,updated_at").eq("user_id",auth.user.id).order("updated_at",{ascending:false});
  if(error)setNotice(error.message);else setTickets((data||[]) as Ticket[]);
  setLoading(false);
 },[navigate]);
 useEffect(()=>{void load();},[load]);

 const openTicket=async(t:Ticket)=>{
  setSelected(t);setNotice("");
  const {data,error}=await supabase.from("support_ticket_messages").select("id,ticket_id,sender_role,message,created_at").eq("ticket_id",t.id).order("created_at",{ascending:true});
  if(error)setNotice(error.message);else setReplies((data||[]) as Reply[]);
 };
 async function createTicket(e:FormEvent){
  e.preventDefault();setBusy(true);setNotice("");
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user){setBusy(false);return;}
  const {data:ticket,error}=await supabase.from("support_tickets").insert({user_id:auth.user.id,subject:subject.trim(),category,priority}).select("id,ticket_number,subject,category,priority,status,created_at,updated_at").single();
  if(error){setNotice(error.message);setBusy(false);return;}
  const {error:replyError}=await supabase.from("support_ticket_messages").insert({ticket_id:ticket.id,user_id:auth.user.id,sender_role:"customer",message:message.trim()});
  if(replyError){setNotice("Ticket created, but your message could not be added: "+replyError.message);}
  setSubject("");setMessage("");setShowForm(false);setBusy(false);await load();setNotice("Your support ticket has been created.");
 }
 async function sendReply(e:FormEvent){
  e.preventDefault();if(!selected||!replyText.trim())return;
  setBusy(true);
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user){setBusy(false);return;}
  const {error}=await supabase.from("support_ticket_messages").insert({ticket_id:selected.id,user_id:auth.user.id,sender_role:"customer",message:replyText.trim()});
  if(error)setNotice(error.message);else{setReplyText("");await openTicket(selected);await load();}
  setBusy(false);
 }
 if(loading)return <div className="cs-loading">Loading customer support...</div>;
 return <div className="cs-page">
  <header className="cs-top"><Link to="/" className="cs-logo">999<span>+</span> KART</Link><Link to="/account/dashboard"><ArrowLeft size={16}/> My account</Link></header>
  <main className="cs-main">
   <div className="cs-crumb"><Link to="/">Home</Link><ChevronRight size={14}/> Customer Support</div>
   <section className="cs-hero"><div><p>WE'RE HERE TO HELP</p><h1>Customer <span>Support</span></h1><small>Questions, concerns or a little help? We're listening.</small></div><Headset size={42}/></section>
   <div className="cs-actions"><article><MessageCircle/><div><b>Need help?</b><span>Create a support ticket and tell us what's happening.</span></div><button onClick={()=>{setShowForm(true);setSelected(null);}}>Create ticket <Plus size={15}/></button></article><article><TicketCheck/><div><b>Track your requests</b><span>Check replies and updates from our support team.</span></div></article></div>
   <section className="cs-list"><div className="cs-list-head"><div><p>SUPPORT CENTRE</p><h2>Your support tickets</h2></div><span>{tickets.length} ticket{tickets.length===1?"":"s"}</span></div>
    {notice&&<div className="cs-notice">{notice}</div>}
    {!tickets.length?<div className="cs-empty"><Headset size={30}/><h3>No support tickets yet</h3><p>When you contact us, your conversations will appear here.</p><button onClick={()=>setShowForm(true)}>Create your first ticket</button></div>:
     <div className="cs-ticket-list">{tickets.map(t=><button className="cs-ticket-row" key={t.id} onClick={()=>void openTicket(t)}><span className="cs-ticket-icon"><MessageCircle size={18}/></span><span className="cs-ticket-copy"><b>{t.subject}</b><small>#{t.ticket_number} · {t.category} · Updated {when(t.updated_at)}</small></span><span className={`cs-status cs-${t.status}`}>{statusName(t.status)}</span><ChevronRight size={17}/></button>)}</div>}
   </section>
  </main>
  {(showForm||selected)&&<div className="cs-overlay" onMouseDown={e=>{if(e.target===e.currentTarget){setShowForm(false);setSelected(null);}}}>
   <section className="cs-modal" role="dialog" aria-modal="true">
    <div className="cs-modal-head"><div><p>{selected?"TICKET CONVERSATION":"CONTACT SUPPORT"}</p><h2>{selected?selected.subject:"Create a support ticket"}</h2></div><button onClick={()=>{setShowForm(false);setSelected(null);}}><X/></button></div>
    {showForm&&!selected?<form onSubmit={e=>void createTicket(e)}>
     <label>Subject<input required maxLength={120} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Briefly describe your issue"/></label>
     <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
     <label>Priority<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="normal">Normal</option><option value="high">High</option></select></label>
     <label>How can we help?<textarea required rows={5} maxLength={4000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Explain your question or problem..."/></label>
     {notice&&<p className="cs-notice">{notice}</p>}<button className="cs-submit" disabled={busy}>{busy?"Creating...":"Submit ticket"}</button>
    </form>:selected&&<><div className="cs-conversation-meta"><span>#{selected.ticket_number}</span><span className={`cs-status cs-${selected.status}`}>{statusName(selected.status)}</span><span>{selected.category}</span></div><div className="cs-messages">{replies.map(r=><div className={`cs-message ${r.sender_role==="admin"?"from-admin":"from-customer"}`} key={r.id}><small>{r.sender_role==="admin"?"999+ KART Support":"You"} · {when(r.created_at)}</small><p>{r.message}</p></div>)}</div>{!["resolved","closed"].includes(selected.status)&&<form onSubmit={e=>void sendReply(e)} className="cs-reply"><textarea rows={3} required value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="Write a reply..."/><button disabled={busy}><Send size={16}/> Send reply</button></form>}{notice&&<p className="cs-notice">{notice}</p>}</>}
   </section>
  </div>}
 </div>;
}
