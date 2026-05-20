import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

const S = {
  app: {fontFamily:"Georgia,serif",background:"#FAFAF7",minHeight:"100vh",color:"#2C2C2C",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"},
  card: {background:"#FFF",border:"1px solid #DDD",borderRadius:8,padding:"2rem",maxWidth:420,width:"100%",boxShadow:"0 4px 16px rgba(0,0,0,.06)"},
  input: {fontFamily:"Georgia,serif",padding:"8px 10px",border:"1px solid #CCC",borderRadius:4,fontSize:14,width:"100%",boxSizing:"border-box",background:"#FFF",outline:"none"},
  btn: {fontFamily:"Georgia,serif",cursor:"pointer",padding:"8px 14px",border:"none",borderRadius:4,fontSize:14,background:"#2C2C2C",color:"#FFF",width:"100%"},
  msg: {fontSize:13,padding:"10px 12px",borderRadius:4,marginTop:12},
};

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const sendMagicLink = async (e) => {
    e?.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    setSending(false);
    if (error) {
      setMsg({ type: "error", text: error.message });
    } else {
      setMsg({ type: "success", text: `Check your email — we sent a login link to ${email.trim()}.` });
    }
  };

  if (loading) {
    return <div style={{...S.app}}><div style={{color:"#aaa"}}>Loading…</div></div>;
  }

  if (!session) {
    return (
      <div style={S.app}>
        <div style={S.card}>
          <h1 style={{fontSize:22,margin:"0 0 6px",fontWeight:"bold"}}>Ash's To-Do</h1>
          <p style={{fontSize:14,color:"#666",margin:"0 0 20px"}}>Sign in with your email — we'll send you a magic link.</p>
          <form onSubmit={sendMagicLink}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              style={S.input}
            />
            <div style={{height:10}} />
            <button type="submit" disabled={sending || !email.trim()} style={{...S.btn, opacity: sending || !email.trim() ? 0.5 : 1}}>
              {sending ? "Sending…" : "Send magic link"}
            </button>
          </form>
          {msg && (
            <div style={{...S.msg, background: msg.type==="error" ? "#FADBD8" : "#D5F5E3", color: msg.type==="error" ? "#C0392B" : "#1E8449"}}>
              {msg.text}
            </div>
          )}
          <div style={{fontSize:11,color:"#999",marginTop:20,lineHeight:1.5}}>
            Click the link in your email to sign in. The link works once, and your session lasts on this device until you sign out.
          </div>
        </div>
      </div>
    );
  }

  // Signed in — render the app, pass session info to it
  return children({ session, signOut: () => supabase.auth.signOut() });
}
