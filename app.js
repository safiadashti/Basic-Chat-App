// ChatNova — Firebase-powered chat starter.
// 1) Create a Firebase project, enable Email/Password Authentication, Firestore, and Storage.
// 2) Paste your web app config below. Never publish permissive database rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyBfeFug9SsUdKr_ebop2-sAYFSNhF5hWSI",
    authDomain: "authentication-app-4afe1.firebaseapp.com",
    databaseURL: "https://authentication-app-4afe1-default-rtdb.firebaseio.com",
    projectId: "authentication-app-4afe1",
    storageBucket: "authentication-app-4afe1.firebasestorage.app",
    messagingSenderId: "640696005984",
    appId: "1:640696005984:web:1fc9469088d7664e519a05",
    measurementId: "G-C44LPZ3127"
  };
const configured = !Object.values(firebaseConfig).some(v => String(v).startsWith("YOUR_"));
let app, auth, db, storage;
if (configured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

const $ = id => document.getElementById(id);
const state = { user:null, profile:null, selected:null, selectedType:null, stopMessages:null, stopUsers:null, stopStatuses:null, users:[], mediaRecorder:null, audioChunks:[], localStream:null, peer:null, callDoc:null, callUnsub:null };
const avatarFor = (name="User") => `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`;
const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),3200)}
function friendlyError(error){console.error(error);const map={"auth/invalid-credential":"Email ya password sahi nahi hai.","auth/email-already-in-use":"Is email ka account pehle se hai.","auth/weak-password":"Password kam az kam 6 characters ka rakho.","auth/invalid-email":"Email address check karo.","permission-denied":"Firebase rules access deny kar rahe hain.","storage/unauthorized":"Storage rules upload allow nahi kar rahe."};return map[error?.code]||error?.message||"Kuch ghalat ho gaya."}
function setAuthMessage(message){$("authMessage").textContent=message}
function showApp(signedIn){$("authPanel").classList.toggle("hidden",signedIn);$("mainPanel").classList.toggle("hidden",!signedIn)}
function userDisplay(user){return user.displayName||user.email?.split("@")[0]||"ChatNova user"}
function formatTime(ts){try{return ts?.toDate?ts.toDate().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}):"now"}catch{return "now"}}
function dateValue(ts){return ts?.toDate?ts.toDate().getTime():Date.now()}
function isImage(type){return type?.startsWith("image/")} function isVideo(type){return type?.startsWith("video/")}
function applyTheme(theme){document.body.dataset.theme=theme;localStorage.setItem("chatnova-theme",theme);const select=$("themeSelect");if(select)select.value=theme;}
function themeCycle(){const themes=["light","dark","lavender","rose","ocean","mint"];const current=document.body.dataset.theme||"light";const next=themes[(themes.indexOf(current)+1)%themes.length];applyTheme(next);toast(`Theme: ${next}`)}
applyTheme(localStorage.getItem("chatnova-theme")||"lavender");
$("themeButton").addEventListener("click",themeCycle);$("chatThemeButton").addEventListener("click",themeCycle);
$("themeSelect").addEventListener("change",e=>{applyTheme(e.target.value);toast(`Theme changed: ${e.target.options[e.target.selectedIndex].text}`)});
const savedAccent=localStorage.getItem("chatnova-accent");if(savedAccent){document.documentElement.style.setProperty("--accent",savedAccent);document.documentElement.style.setProperty("--accent-strong",savedAccent);$("accentPicker").value=savedAccent;}
$("accentPicker").addEventListener("input",e=>{const color=e.target.value;document.documentElement.style.setProperty("--accent",color);document.documentElement.style.setProperty("--accent-strong",color);localStorage.setItem("chatnova-accent",color);});
function setView(view){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===view));$("chatList").classList.toggle("hidden",view!=="chats");$("communityPanel").classList.toggle("hidden",view!=="community");$("statusPanel").classList.toggle("hidden",view!=="status")}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
$("signUpButton").addEventListener("click",async()=>{if(!configured)return toast("Pehle app.js mein Firebase config add karo.");const email=$("email").value.trim(),password=$("password").value,name=$("displayName").value.trim()||email.split("@")[0];if(!email||password.length<6)return setAuthMessage("Valid email aur kam az kam 6-character password dalo.");try{const cred=await createUserWithEmailAndPassword(auth,email,password);await updateProfile(cred.user,{displayName:name});await setDoc(doc(db,"users",cred.user.uid),{uid:cred.user.uid,name,email:email.toLowerCase(),photoURL:avatarFor(name),createdAt:serverTimestamp(),lastSeen:serverTimestamp()});toast("Account ban gaya!")}catch(e){setAuthMessage(friendlyError(e))}});
$("authForm").addEventListener("submit",async e=>{e.preventDefault();if(!configured)return toast("Pehle app.js mein Firebase config add karo.");try{await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value)}catch(err){setAuthMessage(friendlyError(err))}});
$("signOutButton").addEventListener("click",()=>signOut(auth));
if (!configured) {
  showApp(false);
  setAuthMessage("Firebase config placeholders replace karo, phir reload karo.");
} else {
  onAuthStateChanged(auth, async user=>{
    state.user=user;
    showApp(!!user);
    if(user){
      await ensureProfile(user);
      startUserList();
      startStatuses();
      $("myName").textContent=userDisplay(user);
      $("myEmail").textContent=user.email||"";
      const profile=(await getDoc(doc(db,"users",user.uid))).data();
      state.profile=profile||null;
      $("myAvatar").src=profile?.photoURL||avatarFor(userDisplay(user));
    }else{
      stopLiveListeners();
      $("welcomeView").classList.remove("hidden");
      $("conversationView").classList.add("hidden");
      document.querySelector(".app-shell").classList.remove("chat-open");
    }
  });
}
async function ensureProfile(user){const p=doc(db,"users",user.uid),snap=await getDoc(p);if(!snap.exists())await setDoc(p,{uid:user.uid,name:userDisplay(user),email:(user.email||"").toLowerCase(),photoURL:user.photoURL||avatarFor(userDisplay(user)),createdAt:serverTimestamp(),lastSeen:serverTimestamp()},{merge:true});}
function stopLiveListeners(){state.stopUsers?.();state.stopStatuses?.();state.stopMessages?.();state.stopMessages=null}
function startUserList(){state.stopUsers?.();state.stopUsers=onSnapshot(collection(db,"users"),snap=>{state.users=snap.docs.map(d=>d.data()).filter(u=>u.uid!==state.user.uid);renderUsers($("userSearch").value.trim().toLowerCase())},e=>toast(friendlyError(e)))}
$("userSearch").addEventListener("input",()=>renderUsers($("userSearch").value.trim().toLowerCase()));
function renderUsers(search=""){const root=$("chatList");const people=state.users.filter(u=>`${u.name||""} ${u.email||""}`.toLowerCase().includes(search));if(!people.length){root.innerHTML=`<div class="empty-state"><span>⌕</span><strong>No people found</strong><p>Ask them to create a ChatNova account first.</p></div>`;return}root.innerHTML=people.map(u=>`<button class="person-row ${state.selected?.uid===u.uid?"selected":""}" data-uid="${safe(u.uid)}"><img src="${safe(u.photoURL||avatarFor(u.name))}" alt=""><span class="person-meta"><strong>${safe(u.name||"User")}</strong><small>${safe(u.email||"ChatNova member")}</small></span><span class="arrow">›</span></button>`).join("");root.querySelectorAll("[data-uid]").forEach(b=>b.addEventListener("click",()=>{const u=state.users.find(x=>x.uid===b.dataset.uid);if(u)openDirectChat(u)}))}
function conversationId(uidA,uidB){return [uidA,uidB].sort().join("_")}
async function openDirectChat(person){state.selected=person;state.selectedType="direct";$("welcomeView").classList.add("hidden");$("conversationView").classList.remove("hidden");document.querySelector(".app-shell").classList.add("chat-open");$("chatTitle").textContent=person.name||"ChatNova user";$("chatSubtitle").textContent=person.email||"Direct chat";$("chatAvatar").src=person.photoURL||avatarFor(person.name);listenMessages(`direct_${conversationId(state.user.uid,person.uid)}`);renderUsers($("userSearch").value.trim().toLowerCase())}
$("openCommunityButton").addEventListener("click",()=>{state.selected={uid:"lounge",name:"ChatNova Lounge",photoURL:avatarFor("ChatNova Lounge")};state.selectedType="community";$("welcomeView").classList.add("hidden");$("conversationView").classList.remove("hidden");document.querySelector(".app-shell").classList.add("chat-open");$("chatTitle").textContent="ChatNova Lounge";$("chatSubtitle").textContent="Open community · all signed-in users";$("chatAvatar").src=avatarFor("ChatNova Lounge");listenMessages("community_lounge")});
function listenMessages(roomId){state.stopMessages?.();$("messages").innerHTML=`<div class="empty-state"><p>Loading messages…</p></div>`;const q=query(collection(db,"rooms",roomId,"messages"),orderBy("createdAt","asc"));state.stopMessages=onSnapshot(q,snap=>{const root=$("messages");root.innerHTML="";snap.forEach(d=>root.appendChild(messageElement(d.data())));root.scrollTop=root.scrollHeight},e=>{toast(friendlyError(e));$("messages").innerHTML=`<div class="empty-state"><strong>Couldn't load messages</strong><p>Check Firestore rules and room access.</p></div>`})}
function messageElement(m){const mine=m.senderId===state.user.uid;const row=document.createElement("div");row.className=`message-row ${mine?"mine":"theirs"}`;const img=document.createElement("img");img.className="message-avatar";img.src=m.photoURL||avatarFor(m.senderName);img.alt="";const bubble=document.createElement("div");bubble.className="message-bubble";if(!mine&&state.selectedType==="community"){const sender=document.createElement("div");sender.className="message-sender";sender.textContent=m.senderName||"Member";bubble.appendChild(sender)}if(m.type==="image"||m.type==="video"){const media=document.createElement(m.type==="video"?"video":"img");media.src=m.mediaURL;media.className="message-media";if(m.type==="video"){media.controls=true;media.playsInline=true}else media.alt="Shared photo";bubble.appendChild(media);if(m.text){const cap=document.createElement("div");cap.className="message-text";cap.textContent=m.text;bubble.appendChild(cap)}}else if(m.type==="audio"){const audio=document.createElement("audio");audio.controls=true;audio.src=m.mediaURL;audio.style.maxWidth="220px";bubble.appendChild(audio)}else{const text=document.createElement("div");text.className="message-text";text.textContent=m.text||"";bubble.appendChild(text)}const time=document.createElement("div");time.className="message-time";time.textContent=formatTime(m.createdAt)+(mine?" ✓":"");bubble.appendChild(time);row.append(img,bubble);return row}
async function sendMessage({text="",type="text",mediaURL=""}={}){if(!state.user||!state.selected)return toast("Pehle chat select karo.");if(!text.trim()&&!mediaURL)return;const roomId=state.selectedType==="community"?"community_lounge":`direct_${conversationId(state.user.uid,state.selected.uid)}`;try{await addDoc(collection(db,"rooms",roomId,"messages"),{senderId:state.user.uid,senderName:userDisplay(state.user),photoURL:state.profile?.photoURL||$("myAvatar").src,type,text:text.trim(),mediaURL,createdAt:serverTimestamp()});$("messageInput").value="";$("messageInput").style.height="auto"}catch(e){toast(friendlyError(e))}}
$("sendButton").addEventListener("click",()=>sendMessage({text:$("messageInput").value}));$("messageInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage({text:$("messageInput").value})}});$("messageInput").addEventListener("input",e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"});
async function uploadFile(file,path){if(!file)throw new Error("File select nahi hui.");const fileRef=ref(storage,`${path}/${state.user.uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`);await uploadBytes(fileRef,file);return getDownloadURL(fileRef)}
$("mediaInput").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;if(file.size>30*1024*1024){toast("File 30 MB se chhoti rakho.");e.target.value="";return}try{toast("Uploading media…");const url=await uploadFile(file,"chat-media");await sendMessage({type:isImage(file.type)?"image":isVideo(file.type)?"video":"text",mediaURL:url,text:""});toast("Media sent")}catch(err){toast(friendlyError(err))}finally{e.target.value=""}});
$("profilePhotoButton").addEventListener("click",()=>$("profilePhotoInput").click());$("profilePhotoInput").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;if(!isImage(file.type))return toast("Image file select karo.");try{const url=await uploadFile(file,"profile-photos");await updateDoc(doc(db,"users",state.user.uid),{photoURL:url});await updateProfile(state.user,{photoURL:url});$("myAvatar").src=url;state.profile={photoURL:url};toast("Profile picture updated")}catch(err){toast(friendlyError(err))}e.target.value=""});
async function startStatuses(){state.stopStatuses?.();const q=query(collection(db,"statuses"),orderBy("createdAt","desc"));state.stopStatuses=onSnapshot(q,snap=>{const now=Date.now(),items=snap.docs.map(d=>({id:d.id,...d.data()})).filter(s=>now-dateValue(s.createdAt)<24*60*60*1000);$("statusList").innerHTML=items.map(s=>`<div class="status-item"><img src="${safe(s.photoURL||avatarFor(s.userName))}" alt=""><div><strong>${safe(s.userName||"User")}</strong><p>${safe(s.text||"")}</p><small>${formatTime(s.createdAt)}${s.mediaURL?" · media attached":""}</small></div>${s.mediaURL?`<a href="${safe(s.mediaURL)}" target="_blank" rel="noopener">View</a>`:""}</div>`).join("")||`<p class="hint">No recent statuses yet.</p>`},e=>toast(friendlyError(e)))}
$("addStatusButton").addEventListener("click",async()=>{
  if(!state.user)return;
  const text=$("statusText").value.trim();
  if(text){
    $("statusFileInput").dataset.text=text;
    $("statusFileInput").click();
  } else {
    $("statusFileInput").dataset.text="";
    $("statusFileInput").click();
  }
});
$("statusFileInput").addEventListener("change",async e=>{const file=e.target.files[0];const text=e.target.dataset.text||$("statusText").value.trim();if(!file&&!text)return;if(file&&file.size>30*1024*1024)return toast("File 30 MB se chhoti rakho.");try{let mediaURL="";if(file)mediaURL=await uploadFile(file,"statuses");await addDoc(collection(db,"statuses"),{userId:state.user.uid,userName:userDisplay(state.user),photoURL:$("myAvatar").src,text,mediaURL,createdAt:serverTimestamp()});$("statusText").value="";toast("Status shared")}catch(err){toast(friendlyError(err))}e.target.value=""});
// Voice notes
$("voiceRecordButton").addEventListener("click",async()=>{if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return toast("Voice recording is not supported by this browser.");if(state.mediaRecorder?.state==="recording"){state.mediaRecorder.stop();$("voiceRecordButton").textContent="🎙";return}try{state.localStream=await navigator.mediaDevices.getUserMedia({audio:true});state.audioChunks=[];state.mediaRecorder=new MediaRecorder(state.localStream);state.mediaRecorder.ondataavailable=e=>{if(e.data.size)state.audioChunks.push(e.data)};state.mediaRecorder.onstop=async()=>{try{const blob=new Blob(state.audioChunks,{type:state.mediaRecorder.mimeType||"audio/webm"});const file=new File([blob],"voice-note.webm",{type:blob.type});const url=await uploadFile(file,"voice-notes");await sendMessage({type:"audio",mediaURL:url});toast("Voice note sent")}catch(e){toast(friendlyError(e))}finally{state.localStream?.getTracks().forEach(t=>t.stop());state.localStream=null}};state.mediaRecorder.start();$("voiceRecordButton").textContent="■";toast("Recording… dobara dabao to send ho jayegi")}catch(e){toast("Microphone permission allow karo.")}});
// Basic WebRTC call signaling; test with two devices and configure TURN for networks that need it.
const rtcConfig={iceServers:[{urls:"stun:stun.l.google.com:19302"}]};
async function startCall(video){if(!state.selected||state.selectedType!=="direct")return toast("Call ke liye pehle kisi user ki direct chat open karo.");if(!navigator.mediaDevices?.getUserMedia)return toast("Calls ke liye camera/microphone permission chahiye.");try{state.localStream=await navigator.mediaDevices.getUserMedia({audio:true,video});$("localVideo").srcObject=video?state.localStream:null;$("remoteVideo").srcObject=null;$("callModal").classList.remove("hidden");$("callTitle").textContent=video?"Video call":"Voice call";$("callStatus").textContent="Call signaling starter: incoming-call acceptance UI and TURN server setup are needed for production.";state.peer=new RTCPeerConnection(rtcConfig);state.localStream.getTracks().forEach(t=>state.peer.addTrack(t,state.localStream));state.peer.ontrack=e=>{$("remoteVideo").srcObject=e.streams[0]};toast("Media permission ready. Full incoming/outgoing call flow needs signaling deployment.")}catch(e){toast("Camera/microphone permission allow karo.")}}
$("voiceCallButton").addEventListener("click",()=>startCall(false));$("videoCallButton").addEventListener("click",()=>startCall(true));$("endCallButton").addEventListener("click",()=>{state.peer?.close();state.peer=null;state.localStream?.getTracks().forEach(t=>t.stop());state.localStream=null;$("callModal").classList.add("hidden");$("localVideo").srcObject=null;$("remoteVideo").srcObject=null;$("callStatus").textContent="Call ended"});
