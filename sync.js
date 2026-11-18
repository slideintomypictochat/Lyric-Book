// Accounts + automatic sync through Supabase (set up in config.js and supabase/setup.sql).
// Songs are always saved on the device first and synced in the background, so the app keeps working offline.
// Each song syncs as a whole; when two devices edited the same song, the newest edit wins.
(()=>{
const CFG=window.LYRIC_SYNC||{};
const sb=CFG.url&&CFG.key&&window.supabase
  ?supabase.createClient(CFG.url,CFG.key,{auth:{flowType:'implicit',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const HERE=location.origin+location.pathname;
let user=null, profile=null, state='off', lastErr='', syncing=false, again=false, timer=null, lastSynced=0;
let view='signin', note=null, recovering=/type=recovery/.test(location.hash), adminUsers=null, newCode='';
window.syncUser=()=>user;
window.syncSoon=()=>{ if(!user) return; clearTimeout(timer); timer=setTimeout(sync,1500) };

const $=id=>document.getElementById(id);
const drawer=()=>$('drawer');
const acctOpen=()=>!drawer().hidden&&drawer().dataset.mode==='acct';
function setState(s,err){ state=s; lastErr=err||''; $('acctBtn').dataset.state=s; if(acctOpen()) render() }

// ---------- Which songs are on screen ----------
function useStore(uid){
  const key=uid?KEY+'.'+uid:KEY; if(key===storeKey) return;
  let guest=[]; if(uid){ try{guest=JSON.parse(localStorage.getItem(KEY))||[]}catch(e){} }
  storeKey=key; load();
  // songs written while signed out move into the first account that signs in on this device
  if(uid&&guest.length){ guest.forEach(g=>{ if(!projects.some(p=>p.id===g.id)) projects.push({...g,dirty:true}) });
    persist(); try{localStorage.removeItem(KEY)}catch(e){} }
  current=sorted()[0]||null; renderList(); renderMain();
  if(window.innerWidth<=720) $('app').classList.remove('editing');
}

// ---------- Sync ----------
async function sync(){
  if(!user) return; if(syncing){again=true;return}
  syncing=true; setState('syncing');
  try{
    if(!navigator.onLine) throw {offline:true};
    const LAST='lyricbook.lastPull.'+user.id;
    let since=localStorage.getItem(LAST)||'1970-01-01T00:00:00Z', touched=false, openChanged=false;
    // 1. Fetch songs changed on other devices since last time
    for(;;){
      const {data,error}=await sb.from('projects').select('id,title,body,study,deleted,updated,modified_at')
        .gt('modified_at',since).order('modified_at').limit(500);
      if(error) throw error;
      for(const r of data){ since=r.modified_at;
        const l=projects.find(p=>p.id===r.id);
        if(l&&l.updated>=r.updated) continue; // this device's copy is as new or newer
        const row={id:r.id,title:r.title,body:r.body,study:r.study,deleted:r.deleted,updated:r.updated,dirty:false};
        if(l) Object.assign(l,row); else projects.push(row);
        touched=true; if(current&&current.id===r.id) openChanged=true;
      }
      if(data.length<500) break;
    }
    // 2. Send songs changed on this device
    const dirty=projects.filter(p=>p.dirty);
    if(dirty.length){
      const sent=new Map(dirty.map(p=>[p.id,p.updated]));
      const {error}=await sb.from('projects').upsert(dirty.map(p=>({id:p.id,user_id:user.id,title:p.title||'',body:p.body||'',
        study:!!p.study,deleted:!!p.deleted,updated:p.updated})),{onConflict:'user_id,id'});
      if(error) throw error;
      dirty.forEach(p=>{ if(sent.get(p.id)===p.updated) p.dirty=false }); // edited again meanwhile: stays dirty
    }
    persist(); localStorage.setItem(LAST,since);
    if(touched) refresh(openChanged);
    lastSynced=Date.now(); setState('synced');
  }catch(e){ setState(e&&e.offline||!navigator.onLine?'offline':'error', e&&e.message) }
  syncing=false; if(again){again=false;sync()}
}
function refresh(openChanged){ // show songs that arrived from another device
  if(current&&current.deleted) current=null;
  if(!openChanged){ renderList(); return }
  const b=$('body'), focused=b&&document.activeElement===b, pos=b&&b.selectionStart;
  renderList(); renderMain();
  if(focused&&$('body')){ const nb=$('body'); nb.focus(); nb.setSelectionRange(Math.min(pos,nb.value.length),Math.min(pos,nb.value.length)) }
}
addEventListener('online',()=>sync());
addEventListener('focus',()=>sync());
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') sync() });
setInterval(()=>{ if(document.visibilityState==='visible') sync() },20000);

// ---------- Sign in state ----------
if(sb) sb.auth.onAuthStateChange((ev,session)=>{
  const u=session?session.user:null;
  if(ev==='PASSWORD_RECOVERY') recovering=true;
  setTimeout(()=>{ // (supabase asks not to await its own calls inside this callback)
    if((u&&u.id)!==(user&&user.id)){
      user=u; profile=null; adminUsers=null; useStore(u&&u.id);
      if(u){ loadProfile(); sync() } else setState('off');
    }
    if(recovering){ view='newpass'; open() } else if(acctOpen()) render();
  },0);
});
async function loadProfile(){
  const {data}=await sb.from('profiles').select('username,is_admin').eq('id',user.id).maybeSingle();
  profile=data; if(acctOpen()) render();
}

// ---------- Account drawer ----------
function open(){ const d=drawer(); d.dataset.mode='acct'; d.hidden=false; $('drClose').onclick=()=>{d.hidden=true;note=null}; render() }
$('acctBtn').onclick=()=>{ note=null; adminUsers=null; if(!user&&!recovering) view='signin'; open() };

const say=(text,err)=>{ note={text,err}; render() };
const field=(id,label,type='text',extra='')=>`<label>${label}<input id="${id}" type="${type}" ${extra}></label>`;
const val=id=>($(id)&&$(id).value||'').trim();
function ago(t){ const s=Math.round((Date.now()-t)/1000); return s<10?'just now':s<60?s+' seconds ago':Math.round(s/60)+' min ago' }

function render(){
  $('drTitle').textContent='Account';
  const body=$('drBody'), msg=note?`<div class="msg${note.err?' err':''}">${esc(note.text)}</div>`:'';
  if(!sb){ body.innerHTML='<p>Accounts and sync aren\'t switched on yet.</p><p class="note">Songs are saved on this device only.</p>'; return }
  if(recovering&&user){ body.innerHTML=msg+`<h4>Choose a new password</h4><form class="form" id="f">${field('pw','New password','password','autocomplete="new-password" minlength="6"')}
    <button class="ai-btn">Save password</button></form>`;
    $('f').onsubmit=async e=>{ e.preventDefault(); const {error}=await sb.auth.updateUser({password:val('pw')});
      if(error) return say(error.message,1); recovering=false; history.replaceState(null,'',HERE); say('Password changed. You\'re signed in.') }; return }
  if(user) return renderSignedIn(body,msg);
  const views={
    signin:()=>`<h4>Sign in</h4><p class="note">Sign in on every device to keep your songs in sync.</p>
      <form class="form" id="f">${field('who','Username or email','text','autocomplete="username" autocapitalize="off"')}
      ${field('pw','Password','password','autocomplete="current-password"')}<button class="ai-btn">Sign in</button></form>
      <button class="linkbtn" data-v="forgot">Forgot password?</button><br><button class="linkbtn" data-v="signup">Create an account</button>
      <br><button class="linkbtn" data-v="recover">Admin recovery code</button>`,
    signup:()=>`<h4>Create an account</h4><form class="form" id="f">
      ${field('un','Username','text','autocomplete="username" autocapitalize="off" pattern="[A-Za-z0-9_.]{3,24}" title="3–24 letters, numbers, _ or ."')}
      ${field('em','Email','email','autocomplete="email"')}${field('pw','Password (at least 6 characters)','password','autocomplete="new-password" minlength="6"')}
      <button class="ai-btn">Create account</button></form><button class="linkbtn" data-v="signin">I already have an account</button>`,
    forgot:()=>`<h4>Forgot password</h4><p class="note">We'll email you a link to choose a new one.</p><form class="form" id="f">
      ${field('who','Username or email','text','autocapitalize="off"')}<button class="ai-btn">Send reset link</button></form>
      <button class="linkbtn" data-v="signin">Back to sign in</button>`,
    recover:()=>`<h4>Admin recovery</h4><p class="note">For the admin account: set a new password with your recovery code, no email needed.</p>
      <form class="form" id="f">${field('un','Admin username','text','autocapitalize="off"')}${field('code','Recovery code','text','autocapitalize="characters" autocomplete="off"')}
      ${field('pw','New password','password','autocomplete="new-password" minlength="6"')}<button class="ai-btn">Set password and sign in</button></form>
      <button class="linkbtn" data-v="signin">Back to sign in</button>`,
    newpass:()=>`<p>Opening your reset link…</p>`};
  body.innerHTML=msg+(views[view]||views.signin)();
  body.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{view=b.dataset.v;note=null;render()});
  const f=$('f'); if(f) f.onsubmit=e=>{e.preventDefault(); submit(view)};
}
async function emailFor(who){
  if(who.includes('@')) return who;
  const {data,error}=await sb.rpc('email_for_username',{p_username:who}); if(error) throw error; return data;
}
async function submit(v){
  const btn=$('f').querySelector('button'); btn.disabled=true;
  try{
    if(v==='signin'){ const email=await emailFor(val('who'));
      if(!email) return say('No account with that username.',1);
      const {error}=await sb.auth.signInWithPassword({email,password:$('pw').value});
      if(error) return say(/confirm/i.test(error.message)?'Confirm your email first: open the link we sent you.':error.message==='Invalid login credentials'?'Wrong password.':error.message,1);
      note=null }
    if(v==='signup'){ const un=val('un');
      if(!/^[A-Za-z0-9_.]{3,24}$/.test(un)) return say('Usernames are 3–24 letters, numbers, _ or .',1);
      const {data:free,error:e1}=await sb.rpc('username_available',{p_username:un}); if(e1) throw e1;
      if(!free) return say('That username is taken.',1);
      const {data,error}=await sb.auth.signUp({email:val('em'),password:$('pw').value,options:{data:{username:un},emailRedirectTo:HERE}});
      if(error) return say(error.message,1);
      if(!data.session){ view='signin'; say('Account created. Check '+val('em')+' for a link to confirm it, then sign in.') } }
    if(v==='forgot'){ const email=await emailFor(val('who'));
      if(email){ const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:HERE}); if(error) return say(error.message,1) }
      say('If that account exists, a reset link is on its way. Check your email.') }
    if(v==='recover'){ const un=val('un'), pw=$('pw').value;
      const {error}=await sb.rpc('admin_recover',{p_username:un,p_code:(val('code').toUpperCase().replace(/[^A-Z0-9]/g,'').match(/.{1,4}/g)||[]).join('-'),p_password:pw});
      if(error) return say(error.message,1);
      const {error:e2}=await sb.auth.signInWithPassword({email:await emailFor(un),password:pw}); if(e2) return say(e2.message,1);
      note={text:'Password changed. You\'re signed in.'} }
  }catch(e){ say(navigator.onLine?(e.message||'Something went wrong.'):'You\'re offline. Connect to the internet and try again.',1) }
  finally{ if($('f')&&$('f').querySelector('button')) $('f').querySelector('button').disabled=false }
}

function renderSignedIn(body,msg){
  const status={synced:'Synced '+ago(lastSynced),syncing:'Syncing…',offline:'Offline: changes will sync when you\'re back online',
    error:'Sync problem: '+lastErr,off:''}[state];
  body.innerHTML=msg+`<p>Signed in as <b>${esc(profile?profile.username:user.email)}</b>${profile&&profile.is_admin?' <span class="tag">Admin</span>':''}<br>
    <span class="note">${esc(user.email)}</span></p><p class="note">${esc(status)}</p>
    <button class="tog" id="syncNow">Sync now</button> <button class="tog" id="out">Sign out</button>
    <h4>Change password</h4><form class="form" id="f">${field('pw','New password','password','autocomplete="new-password" minlength="6"')}
    <button class="ai-btn">Change password</button></form>
    ${profile&&profile.is_admin?`<h4>Admin</h4><div id="admin"></div>`:''}`;
  $('syncNow').onclick=()=>sync();
  $('out').onclick=async()=>{ await sb.auth.signOut(); note=null; view='signin' };
  $('f').onsubmit=async e=>{ e.preventDefault(); const {error}=await sb.auth.updateUser({password:$('pw').value});
    say(error?error.message:'Password changed.',!!error) };
  if(profile&&profile.is_admin) renderAdmin();
}
async function renderAdmin(){
  let el=$('admin'); if(!el) return;
  if(!adminUsers){ el.innerHTML='<p class="note">Loading accounts…</p>';
    const {data,error}=await sb.rpc('admin_list_users');
    if(error){ if(el.isConnected) el.innerHTML=`<p class="msg err">${esc(error.message)}</p>`; return }
    adminUsers=data; el=$('admin'); if(!el) return; } // the drawer may have been redrawn while loading
  el.innerHTML=`<p class="note">Set any account's password, including your own. No email needed.</p><div class="users">${adminUsers.map((u,i)=>`
    <div class="user"><b>${esc(u.username)}</b>${u.is_admin?' <span class="tag">Admin</span>':''}<br><span class="note">${esc(u.email)}</span>
    <div class="row form" style="margin:8px 0 0;flex-direction:row"><input id="np${i}" type="password" placeholder="New password" autocomplete="new-password">
    <button class="tog" data-i="${i}">Set</button></div></div>`).join('')}</div>
    <h4>Recovery code</h4><p class="note">If you forget your password while signed out, use <b>Admin recovery code</b> on the sign-in screen.
    Making a new code replaces the old one.</p>${newCode?`<div class="code">${newCode}</div><p class="note">Save this somewhere safe, like your Notes app. It won't be shown again.</p>`:''}
    <button class="tog" id="mkCode">Make a new recovery code</button>`;
  el.querySelectorAll('[data-i]').forEach(b=>b.onclick=async()=>{ const u=adminUsers[b.dataset.i], pw=$('np'+b.dataset.i).value;
    const {error}=await sb.rpc('admin_set_password',{p_username:u.username,p_password:pw});
    say(error?error.message:'Password set for '+u.username+'.',!!error) });
  $('mkCode').onclick=async()=>{ const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r=crypto.getRandomValues(new Uint8Array(20));
    const code=[...r].map(x=>A[x%A.length]).join('').match(/.{4}/g).join('-');
    const {error}=await sb.rpc('admin_set_recovery_code',{p_code:code});
    if(error) return say(error.message,1); newCode=code; note=null; render() };
}
})();
