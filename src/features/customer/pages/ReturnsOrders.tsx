import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, CalendarDays, CheckCircle2, ChevronRight, Clock3, Package, RotateCcw, Search, ShoppingBag, Truck, X } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import "./ReturnsOrders.css";

type Item = { id:string; product_id:string|null; product_name:string; product_image_url:string|null; quantity:number; unit_price:number; line_total:number };
type Order = { id:string; order_code:string; status:string; payment_status:string; payment_method:string; grand_total:number; created_at:string; delivered_at:string|null; expected_delivery_date:string|null; tracking_number:string|null; courier_name:string|null; order_items:Item[] };
type ReturnRequest = { id:string; order_id:string; order_item_id:string|null; reason:string; description:string|null; status:string; created_at:string };
type Filter = "all"|"processing"|"shipped"|"delivered"|"cancelled"|"returned";
const DAYS=7;
const filters:{value:Filter;label:string}[]=[{value:"all",label:"All orders"},{value:"processing",label:"Processing"},{value:"shipped",label:"Shipped"},{value:"delivered",label:"Delivered"},{value:"cancelled",label:"Cancelled"},{value:"returned",label:"Returned"}];
const labels:Record<string,string>={new:"Order placed",confirmed:"Confirmed",ready_for_meesho:"Preparing",ordered_on_meesho:"Supplier ordered",shipped:"Shipped",out_for_delivery:"Out for delivery",delivered:"Delivered",cancelled:"Cancelled",returned:"Returned"};
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n||0));
const date=(v:string)=>new Date(v).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
const filterFor=(s:string):Filter=>s==="delivered"?"delivered":s==="cancelled"?"cancelled":s==="returned"?"returned":s==="shipped"||s==="out_for_delivery"?"shipped":"processing";
const daysLeft=(v:string|null)=>v?Math.max(0,DAYS-Math.floor((Date.now()-new Date(v).getTime())/86400000)):0;

export default function ReturnsOrders(){
 const navigate=useNavigate();
 const [orders,setOrders]=useState<Order[]>([]);
 const [requests,setRequests]=useState<ReturnRequest[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [filter,setFilter]=useState<Filter>("all");
 const [search,setSearch]=useState("");
 const [order,setOrder]=useState<Order|null>(null);
 const [item,setItem]=useState<Item|null>(null);
 const [reason,setReason]=useState("Damaged product");
 const [description,setDescription]=useState("");
 const [submitting,setSubmitting]=useState(false);
 const [message,setMessage]=useState("");

 const load=useCallback(async()=>{
  setLoading(true);setError("");
  const {data:auth,error:authError}=await supabase.auth.getUser();
  if(authError||!auth.user){navigate("/login",{replace:true,state:{from:"/account/returns-orders"}});return;}
  const [a,b]=await Promise.all([
   supabase.from("orders").select("id,order_code,status,payment_status,payment_method,grand_total,created_at,delivered_at,expected_delivery_date,tracking_number,courier_name,order_items(id,product_id,product_name,product_image_url,quantity,unit_price,line_total)").eq("user_id",auth.user.id).order("created_at",{ascending:false}),
   supabase.from("return_requests").select("id,order_id,order_item_id,reason,description,status,created_at").eq("user_id",auth.user.id).order("created_at",{ascending:false})
  ]);
  if(a.error){setError(a.error.message);setOrders([]);}else setOrders((a.data||[]) as unknown as Order[]);
  if(b.error){console.warn("Return request history:",b.error.message);setRequests([]);}else setRequests((b.data||[]) as ReturnRequest[]);
  setLoading(false);
 },[navigate]);
 useEffect(()=>{void load();},[load]);

 const visible=useMemo(()=>orders.filter(o=>(filter==="all"||filterFor(o.status)===filter)&&(!search.trim()||o.order_code.toLowerCase().includes(search.toLowerCase())||o.order_items.some(i=>i.product_name.toLowerCase().includes(search.toLowerCase())))),[orders,filter,search]);
 const getRequest=(o:string,i:string)=>requests.find(r=>r.order_id===o&&(r.order_item_id===i||r.order_item_id===null));
 function startReturn(o:Order,i:Item){setOrder(o);setItem(i);setReason("Damaged product");setDescription("");setMessage("");}
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!order||!item)return;
  if(order.status!=="delivered"||daysLeft(order.delivered_at)<=0){setMessage("The 7-day return window has ended.");return;}
  setSubmitting(true);setMessage("");
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user){setMessage("Please sign in again.");setSubmitting(false);return;}
  const {error:insertError}=await supabase.from("return_requests").insert({order_id:order.id,order_item_id:item.id,user_id:auth.user.id,reason,description:description.trim()||null});
  if(insertError){setMessage(insertError.code==="23505"?"A return request already exists for this item.":insertError.message);setSubmitting(false);return;}
  setMessage("Your return request has been submitted.");
  await load();setSubmitting(false);window.setTimeout(()=>{setOrder(null);setItem(null);},800);
 }
 if(loading)return <div className="ro-state">Loading your orders...</div>;

 return <div className="ro-page">
  <header className="ro-top"><Link to="/" className="ro-logo">999<span>+</span> KART</Link><Link to="/account/dashboard"><ArrowLeft size={16}/> My account</Link></header>
  <main className="ro-main">
   <div className="ro-crumb"><Link to="/">Home</Link><ChevronRight size={14}/> Returns & Orders</div>
   <section className="ro-hero"><div><p className="ro-kicker">YOUR SHOPPING, ALL IN ONE PLACE</p><h1>Returns <span>&</span> Orders</h1><p>View purchases, follow deliveries and manage eligible returns.</p></div><Package size={34}/></section>
   <section className="ro-stats">
    <div><span>Total orders</span><b>{orders.length}</b></div><div><span>In progress</span><b>{orders.filter(o=>["new","confirmed","ready_for_meesho","ordered_on_meesho"].includes(o.status)).length}</b></div><div><span>Delivered</span><b>{orders.filter(o=>o.status==="delivered").length}</b></div><div><span>Return requests</span><b>{requests.length}</b></div>
   </section>
   <section className="ro-panel">
    <div className="ro-toolbar"><div><p className="ro-kicker">ORDER HISTORY</p><h2>Your orders</h2></div><label className="ro-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search order or product"/>{search&&<button type="button" onClick={()=>setSearch("")}><X size={15}/></button>}</label></div>
    <div className="ro-tabs">{filters.map(f=><button type="button" key={f.value} className={filter===f.value?"active":""} onClick={()=>setFilter(f.value)}>{f.label}</button>)}</div>
    {error&&<p className="ro-error">{error}</p>}
    {!visible.length?<div className="ro-empty"><ShoppingBag size={30}/><h3>{orders.length?"No matching orders":"No orders yet"}</h3><p>{orders.length?"Try another filter or search term.":"Your purchases will appear here after you place an order."}</p>{!orders.length&&<Link to="/shop">Explore products <ArrowUpRight size={15}/></Link>}</div>:
    <div className="ro-list">{visible.map(o=>{const left=daysLeft(o.delivered_at);return <article className="ro-card" key={o.id}>
     <div className="ro-card-head"><div className="ro-meta"><div><small>ORDER PLACED</small><b>{date(o.created_at)}</b></div><div><small>ORDER ID</small><b>{o.order_code}</b></div><div><small>TOTAL</small><b>{money(o.grand_total)}</b></div></div><span className={`ro-status status-${o.status.replace(/[^a-z0-9]+/g,"-")}`}>{labels[o.status]||o.status.replace(/_/g," ")}</span></div>
     <div className="ro-items">{o.order_items.map(i=>{const req=getRequest(o.id,i.id);const can=o.status==="delivered"&&left>0&&!req;return <div className="ro-item" key={i.id}>
      {i.product_image_url?<img src={i.product_image_url} alt={i.product_name}/>:<div className="ro-placeholder"><Package/></div>}
      <div className="ro-item-copy"><b>{i.product_name}</b><span>Qty: {i.quantity} · {money(i.unit_price)} each</span>{req&&<small className="ro-request">Return: {req.status.replace(/_/g," ")}</small>}{can&&<small className="ro-window"><Clock3 size={12}/> {left} day{left===1?"":"s"} left to return</small>}{o.status==="delivered"&&!left&&!req&&<small className="ro-expired">Return window closed</small>}</div>
      <div className="ro-item-action"><b>{money(i.line_total)}</b>{can&&<button type="button" onClick={()=>startReturn(o,i)}><RotateCcw size={14}/> Return item</button>}</div>
     </div>})}</div>
     <div className="ro-card-foot"><span>{o.status==="delivered"?<><CheckCircle2 size={15}/> Delivered {o.delivered_at?date(o.delivered_at):""}</>:o.expected_delivery_date?<><CalendarDays size={15}/> Expected {date(o.expected_delivery_date)}</>:<><Truck size={15}/> Delivery updates in tracking</>}</span><Link to={`/account/orders/${o.id}`}>View order details <ArrowUpRight size={15}/></Link></div>
    </article>})}</div>}
   </section>
   <aside className="ro-policy"><div><RotateCcw size={21}/><p><b>7-day return window</b><span>Eligible items can be requested for return within 7 days of delivery.</span></p></div><Link to="/account/dashboard">Account dashboard <ChevronRight size={15}/></Link></aside>
  </main>
  {order&&item&&<div className="ro-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!submitting){setOrder(null);setItem(null);}}}>
   <section className="ro-modal" role="dialog" aria-modal="true" aria-labelledby="ro-modal-title">
    <div className="ro-modal-head"><div><p className="ro-kicker">RETURN REQUEST</p><h2 id="ro-modal-title">Why are you returning it?</h2></div><button type="button" onClick={()=>{setOrder(null);setItem(null);}} disabled={submitting}><X/></button></div>
    <div className="ro-modal-product">{item.product_image_url?<img src={item.product_image_url} alt={item.product_name}/>:<Package/>}<div><b>{item.product_name}</b><span>Order {order.order_code}</span></div></div>
    <form onSubmit={e=>void submit(e)}>
     <label>Return reason<select value={reason} onChange={e=>setReason(e.target.value)}><option>Damaged product</option><option>Wrong item received</option><option>Size or fit issue</option><option>Product not as described</option><option>Quality issue</option><option>Changed my mind</option><option>Other</option></select></label>
     <label>Additional details <small>(optional)</small><textarea rows={4} maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Tell us a little more about the issue..."/></label>
     <p className="ro-note">Submit your request within 7 days of delivery. Our team will review it.</p>
     {message&&<p className={message.includes("submitted")?"ro-success":"ro-error"}>{message}</p>}
     <button className="ro-submit" disabled={submitting}>{submitting?"Submitting...":"Submit return request"}</button>
    </form>
   </section>
  </div>}
  <footer className="ro-footer">© 2026 999+ KART. All rights reserved.</footer>
 </div>;
}
