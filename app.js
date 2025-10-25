// PWA (no sync) with CSV export compatible with the desktop app.
// Data model v2 stored in localStorage under 'gct_v2'.
// CSV formats match desktop import/export.

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const state = { cards: [], txs: [], lastSavedAt: '' };
const STORAGE_KEY = 'gct_v2';

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const data = JSON.parse(raw);
    if(data?._format==='giftcards_v2'){
      state.cards = data.cards || [];
      state.txs = data.transactions || [];
      state.lastSavedAt = data.saved_at || '';
    }
  }catch(e){}
}
function save(){
  const payload = {
    _format: 'giftcards_v2',
    saved_at: new Date().toISOString(),
    cards: state.cards,
    transactions: state.txs,
  };
  state.lastSavedAt = payload.saved_at;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function uid(){ return crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2); }

const PLAIN_ICONS=[['starbucks','[coffee]'],['coffee','[coffee]'],['amazon','[shop]'],['walmart','[shop]'],['target','[target]'],['apple','[apple]'],['best buy','[tech]'],['gamestop','[game]'],['steam','[game]'],['xbox','[game]'],['playstation','[game]'],['psn','[game]'],['visa','[card]'],['mastercard','[card]'],['prepaid','[card]'],['uber','[ride]'],['lyft','[ride]'],['doordash','[food]'],['grubhub','[food]'],['chipotle','[food]'],['mcdonald','[food]'],['subway','[food]'],['lowe','[tools]'],['home depot','[tools]'],['shell','[fuel]'],['bp','[fuel]']];
function defaultIcon(merchant=''){ const m=merchant.toLowerCase(); for(const [k,v] of PLAIN_ICONS){ if(m.includes(k)) return v; } return '[card]'; }
function fmt(n){ return Number(n||0).toFixed(2); }

function render(){
  const q=$('#search').value.trim().toLowerCase();
  const hideArchived=$('#hideArchived').checked;
  const tbody=$('#cardsBody'); tbody.innerHTML='';
  let filtered=state.cards.filter(c=>{
    if(hideArchived && c.archived) return false;
    const hay=(c.merchant+' '+c.last4+' '+(c.expiration||'')+' '+c.notes).toLowerCase();
    return hay.includes(q);
  });
  filtered.sort((a,b)=>(b.updated_at||'').localeCompare(a.updated_at||''));
  const now=new Date(), soon=new Date(now.getTime()+1000*60*60*24*30);
  let totalActive=0;
  for(const c of filtered){
    if(!c.archived) totalActive += Number(c.balance||0);
    const low=(!c.archived && Number(c.balance||0)<10);
    let expClass=''; if(c.expiration){ const d=new Date(c.expiration+'T00:00:00'); if(d<now) expClass='badge low'; else if(d<soon) expClass='badge expSoon'; }
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td class="iconcell">${c.icon || defaultIcon(c.merchant)}</td>
      <td>${c.merchant}</td>
      <td>${c.last4}</td>
      <td>${low?'<span class="badge low">$'+fmt(c.balance)+'</span>':'$'+fmt(c.balance)}</td>
      <td>${c.expiration?'<span class="'+expClass+'">'+c.expiration+'</span>':'—'}</td>
      <td>${(c.notes||'').length>120?(c.notes.slice(0,118)+'…'):(c.notes||'')}</td>
      <td>${c.archived?'Yes':'No'}</td>
      <td>${c.updated_at||''}</td>
      <td class="controls">
        <button data-act="edit" data-id="${c.id}" class="secondary">Edit</button>
        <button data-act="spend" data-id="${c.id}">Spend</button>
        <button data-act="reload" data-id="${c.id}">Reload</button>
        <button data-act="archive" data-id="${c.id}">${c.archived?'Unarchive':'Archive'}</button>
        <button data-act="delete" data-id="${c.id}" class="secondary">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  }
  $('#totalActive').textContent='$'+fmt(totalActive);
}

function isoNow(){ const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,19); }

function openCardDialog(card=null){
  const dlg=$('#cardDialog');
  $('#dlgTitle').textContent = card ? `Edit: ${card.merchant}` : 'Add Card';
  $('#fMerchant').value=card?.merchant||'';
  $('#fLast4').value=card?.last4||'';
  $('#fPin4').value=card?.pin_last4||'';
  $('#fBalance').value=card?Number(card.balance||0):'';
  $('#fExp').value=card?.expiration||'';
  $('#fNoExp').checked=!(card?.expiration); toggleExp();
  $('#fNotes').value=card?.notes||'';
  $('#fIcon').value=card?.icon||'';
  dlg.showModal();
  
  $("#cancelCardBtn").onclick = () => dlg.close("cancel");
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close("backdrop"); });
$('#saveCardBtn').onclick=()=>{
    const merchant=$('#fMerchant').value.trim();
    const last4=$('#fLast4').value.trim();
    const pin4=$('#fPin4').value.trim();
    const balance=Number($('#fBalance').value||0);
    const exp=$('#fNoExp').checked?'':$('#fExp').value.trim();
    const notes=$('#fNotes').value.trim();
    const icon=$('#fIcon').value.trim()||defaultIcon(merchant);
    if(!merchant||!last4||isNaN(balance)) return;
    if(card){
      card.merchant=merchant; card.last4=last4; card.pin_last4=pin4; card.balance=Number(balance.toFixed(2));
      card.expiration=exp; card.notes=notes; card.icon=icon; card.updated_at=isoNow();
    }else{
      state.cards.push({ id:uid(), merchant, last4, pin_last4:pin4, balance:Number(balance.toFixed(2)), expiration:exp, notes, archived:false, icon, created_at:isoNow(), updated_at:isoNow() });
    }
    save(); render(); dlg.close();
  };
}

function openTxDialog(card,action='Spend'){
  const dlg=$('#txDialog'); $('#txTitle').textContent=`${action} on ${card.merchant}`;
  $('#txAction').value=action; $('#txAmount').value=''; $('#txNote').value='';
  $$('.pill').forEach(p=>{ p.classList.toggle('active', p.dataset.act===action); p.onclick=()=>openTxDialog(card,p.dataset.act); });
  dlg.showModal();
  
  $("#txCancelBtn").onclick = () => dlg.close("cancel");
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close("backdrop"); });
$('#txApplyBtn').onclick=()=>{
    const act=$('#txAction').value; const amt=Number($('#txAmount').value||0); const note=$('#txNote').value.trim();
    if(!(amt>0)) return;
    if(act==='Spend' && amt>Number(card.balance||0)+1e-9){ alert('Cannot spend more than current balance.'); return; }
    card.balance=Number((act==='Spend'?card.balance-amt:card.balance+amt).toFixed(2));
    const stamp=new Date().toISOString().slice(0,16).replace('T',' ');
    card.notes=(`[${stamp}] ${act}: ${amt.toFixed(2)}`+(note?` — ${note}`:'')+"\n"+(card.notes||'')).slice(0,2000);
    card.updated_at=isoNow(); state.txs.push({ id:uid(), card_id:card.id, merchant:card.merchant, action:act, amount:amt, note, timestamp:isoNow() });
    save(); render(); dlg.close();
  };
}

function toggleExp(){ const noExp=$('#fNoExp').checked; $('#fExp').disabled=noExp; if(noExp) $('#fExp').value=''; }

// ---- Export helpers ----
function download(name, text, type='text/plain'){
  const blob=new Blob([text],{type}); const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}
function toCSVRow(arr){
  // Escape values: wrap in quotes, double any embedded quotes
  return arr.map(v=>{
    let s = (v===null||v===undefined) ? '' : String(v);
    s = s.replace(/"/g,'""');
    return `"${s}"`;
  }).join(',') + '\n';
}
function exportCardsCSV(){
  const header = ["merchant","icon","last4","pin_last4","balance","expiration","notes","archived","created_at","updated_at"];
  let csv = toCSVRow(header);
  for(const c of state.cards){
    csv += toCSVRow([
      c.merchant, c.icon||'', c.last4, c.pin_last4||'', Number(c.balance||0).toFixed(2),
      c.expiration||'', c.notes||'', c.archived? 'true':'false', c.created_at||'', c.updated_at||''
    ]);
  }
  download('cards.csv', csv, 'text/csv');
}
function exportTxCSV(){
  const header = ["timestamp","action","merchant","amount","note","card_last4","card_id"];
  let csv = toCSVRow(header);
  const byId = Object.fromEntries(state.cards.map(c=>[c.id, c]));
  // newest first (to match desktop feel)
  const txs = [...state.txs].sort((a,b)=>(b.timestamp||'').localeCompare(a.timestamp||''));
  for(const t of txs){
    const card = byId[t.card_id] || null;
    csv += toCSVRow([
      t.timestamp||'', t.action||'', t.merchant||'', Number(t.amount||0).toFixed(2), t.note||'',
      card ? (card.last4||'') : '', t.card_id||''
    ]);
  }
  download('spend_log.csv', csv, 'text/csv');
}

// ---- Wire up UI ----
$('#newCardBtn').onclick = ()=> openCardDialog(null);
$('#hideArchived').onchange = render;
$('#search').oninput = render;
$('#exportJsonBtn').onclick = ()=>{
  const payload = localStorage.getItem(STORAGE_KEY) || '{"_format":"giftcards_v2"}';
  download('giftcards_export.json', payload, 'application/json');
};
$('#exportCardsCsvBtn').onclick = exportCardsCSV;
$('#exportTxCsvBtn').onclick = exportTxCSV;
$('#importFile').onchange = async (e)=>{
  const file=e.target.files[0]; if(!file) return;
  try {
    const text=await file.text(); const data=JSON.parse(text); if(!data||!data._format) throw new Error('Invalid file');
    localStorage.setItem(STORAGE_KEY, text);
    load(); render();
    alert('Import successful.');
  } catch(err){ alert('Import failed: '+err.message); }
  e.target.value='';
};

$('#cardsBody').onclick = (e)=>{
  const btn=e.target.closest('button'); if(!btn) return;
  const id=btn.dataset.id; const card=state.cards.find(c=>c.id===id); if(!card) return;
  const act=btn.dataset.act;
  if(act==='edit') openCardDialog(card);
  else if(act==='spend') openTxDialog(card,'Spend');
  else if(act==='reload') openTxDialog(card,'Reload');
  else if(act==='archive'){ card.archived=!card.archived; card.updated_at=isoNow(); save(); render(); }
  else if(act==='delete'){
    if(confirm(`Delete ${card.merchant} (last4 ${card.last4})? This cannot be undone.`)){
      const idx=state.cards.findIndex(c=>c.id===id); if(idx>=0) state.cards.splice(idx,1);
      state.txs = state.txs.filter(t=>t.card_id!==id); save(); render();
    }
  }
};

// Boot
load(); render();
