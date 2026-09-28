const AI4D_TOKEN_KEY="ai4d_access_token";
const AI4D_USER_KEY="ai4d_user_id";

function getAuthToken(){return localStorage.getItem(AI4D_TOKEN_KEY);}
function getApiBase(){
  const input=document.querySelector("#apiUrl");
  return (input?.value||localStorage.getItem("ai4d_api_url")||"http://localhost:8000").trim().replace(/\/$/,"");
}
function setAuthSession(data){
  localStorage.setItem(AI4D_TOKEN_KEY,data.access_token);
  localStorage.setItem(AI4D_USER_KEY,String(data.user_id));
  updateAuthUI();
}
function clearAuthSession(){
  localStorage.removeItem(AI4D_TOKEN_KEY);
  localStorage.removeItem(AI4D_USER_KEY);
  updateAuthUI();
}
function updateAuthUI(){
  const token=getAuthToken();
  const badge=document.querySelector("#authBadge");
  const status=document.querySelector("#authStatus");
  const logout=document.querySelector("#logoutBtn");
  if(!badge||!status||!logout)return;
  if(token){
    badge.textContent="Conectado";
    status.textContent="Conta autenticada. O histórico sincronizado pertence ao usuário atual.";
    logout.classList.remove("hidden");
  }else{
    badge.textContent="Não conectado";
    status.textContent="Crie uma conta ou entre para sincronizar seu histórico com a API.";
    logout.classList.add("hidden");
  }
}
async function authRequest(path,payload){
  const base=getApiBase();
  localStorage.setItem("ai4d_api_url",base);
  const response=await fetch(base+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.detail||"Não foi possível concluir a operação.");
  return data;
}

document.addEventListener("DOMContentLoaded",()=>{
  const register=document.querySelector("#registerForm");
  const login=document.querySelector("#loginForm");
  const logout=document.querySelector("#logoutBtn");
  const apiInput=document.querySelector("#apiUrl");
  if(apiInput){
    apiInput.value=localStorage.getItem("ai4d_api_url")||"http://localhost:8000";
    apiInput.addEventListener("change",()=>localStorage.setItem("ai4d_api_url",apiInput.value.trim().replace(/\/$/,"")));
  }
  register?.addEventListener("submit",async event=>{
    event.preventDefault();
    try{
      const data=await authRequest("/auth/register",{email:document.querySelector("#registerEmail").value,password:document.querySelector("#registerPassword").value});
      setAuthSession(data);
      register.reset();
      document.querySelector("#authStatus").textContent="Conta criada e sessão iniciada.";
    }catch(error){document.querySelector("#authStatus").textContent=error.message;}
  });
  login?.addEventListener("submit",async event=>{
    event.preventDefault();
    try{
      const data=await authRequest("/auth/login",{email:document.querySelector("#loginEmail").value,password:document.querySelector("#loginPassword").value});
      setAuthSession(data);
      login.reset();
      document.querySelector("#authStatus").textContent="Login realizado.";
    }catch(error){document.querySelector("#authStatus").textContent=error.message;}
  });
  logout?.addEventListener("click",()=>clearAuthSession());
  updateAuthUI();
});

const originalFetch=window.fetch.bind(window);
window.fetch=async (input,init={})=>{
  const url=typeof input==="string"?input:input.url;
  const token=getAuthToken();
  const protectedRequest=/\/sessions(?:\?|$)/.test(url||"");
  if(token&&protectedRequest){
    const headers=new Headers(init.headers||((typeof input!=="string")?input.headers:undefined));
    headers.set("Authorization","Bearer "+token);
    init={...init,headers};
  }
  const response=await originalFetch(input,init);
  if(protectedRequest&&response.status===401){
    clearAuthSession();
  }
  return response;
};
