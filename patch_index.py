#!/usr/bin/env python3
import re

with open('public/index.html', 'r') as f:
    html = f.read()

# 1. Add Financials tab to owner tabs
html = html.replace(
    "{id:'ojg',l:'Job gallery'}],'ov')",
    "{id:'ojg',l:'Job gallery'},{id:'ofc',l:'Financials'}],'ov')"
)

# 2. Add renderOfc() call in refreshOwner after loadOwnerGallery()
html = html.replace(
    'loadOwnerGallery();
}',
    'loadOwnerGallery();
  renderOfc();
}'
)

# 3. Add the renderOfc function and helpers before </script>
new_func = '''
// ── FINANCIALS TAB ──
async function renderOfc(){
  const el=document.getElementById('ofc');if(!el)return;
  const[costs,allSalesR]=await Promise.all([
    api('GET','/api/light-costs'),
    fetch('/api/all-sales',{credentials:'include'}).then(r=>r.json())
  ]);
  const totalRevenue=allSalesR.reduce((s,x)=>s+x.amount,0);
  const totalCosts=costs.reduce((s,x)=>s+x.amount,0);
  const profit=totalRevenue-totalCosts;
  const today=new Date().toISOString().split('T')[0];
  el.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:1.25rem;">
      <div style="background:#EAF3DE;border-radius:14px;padding:1.25rem;text-align:center;">
        <div style="font-size:11px;font-weight:600;color:#1D9E75;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px;">Total Revenue</div>
        <div style="font-family:'DM Serif Display',serif;font-size:32px;color:#085041;line-height:1;">${fmt(totalRevenue)}</div>
      </div>
      <div style="background:#FAEEDA;border-radius:14px;padding:1.25rem;text-align:center;">
        <div style="font-size:11px;font-weight:600;color:#BA7517;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px;">Cost of Lights</div>
        <div style="font-family:'DM Serif Display',serif;font-size:32px;color:#633806;line-height:1;">${fmt(totalCosts)}</div>
      </div>
      <div style="background:${profit>=0?'#EAF3DE':'#FAECE7'};border-radius:14px;padding:1.25rem;text-align:center;">
        <div style="font-size:11px;font-weight:600;color:${profit>=0?'#1D9E75':'#D85A30'};letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px;">Profit</div>
        <div style="font-family:'DM Serif Display',serif;font-size:32px;color:${profit>=0?'#085041':'#712B13'};line-height:1;">${fmt(profit)}</div>
      </div>
    </div>
    <div class="card">
      <div class="sl">Add light cost</div>
      <div class="fr c3">
        <div><label style="font-size:12px;color:var(--mut);display:block;margin-bottom:4px;">Description</label><input type="text" id="lcd" placeholder="e.g. 500ft warm white from supplier"></div>
        <div><label style="font-size:12px;color:var(--mut);display:block;margin-bottom:4px;">Amount $</label><input type="number" id="lca" placeholder="e.g. 340"></div>
        <div><label style="font-size:12px;color:var(--mut);display:block;margin-bottom:4px;">Date</label><input type="date" id="lcdt" value="${today}"></div>
      </div>
      <button class="btn bg" onclick="addLightCost()" style="margin-top:4px;width:100%;padding:11px;">+ Add cost</button>
      <div id="lcc" class="hidden" style="font-size:13px;color:var(--green);margin-top:8px;font-weight:500;text-align:center;">Cost added!</div>
    </div>
    <div class="card">
      <div class="sl">Light cost history (${costs.length} entries · ${fmt(totalCosts)} total)</div>
      ${costs.length===0
        ?'<div style="font-size:13px;color:var(--mut);">No costs entered yet. Add your first light purchase above.</div>'
        :costs.map(c=>`<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--brd);"><div style="flex:1;"><div style="font-size:13px;font-weight:500;">${c.description||'Light purchase'}</div><div style="font-size:11px;color:var(--mut);">${c.date}</div></div><div style="font-size:15px;font-weight:600;color:#633806;">${fmt(c.amount)}</div><button onclick="deleteLightCost(${c.id})" style="padding:4px 8px;border-radius:6px;border:1px solid #E24B4A;background:transparent;color:#E24B4A;font-size:11px;cursor:pointer;">Del</button></div>`).join('')
      }
    </div>`;
}
async function addLightCost(){
  const d=document.getElementById('lcd').value.trim(),a=document.getElementById('lca').value,dt=document.getElementById('lcdt').value;
  if(!a){alert('Please enter an amount.');return;}
  await api('POST','/api/light-costs',{description:d,amount:a,date:dt});
  document.getElementById('lcd').value='';document.getElementById('lca').value='';
  const c=document.getElementById('lcc');c.classList.remove('hidden');
  setTimeout(()=>c.classList.add('hidden'),3000);
  renderOfc();
}
async function deleteLightCost(id){
  if(!confirm('Delete this cost entry?'))return;
  await api('DELETE','/api/light-costs/'+id);
  renderOfc();
}'''

html = html.replace('</script>', new_func + '
</script>')

with open('public/index.html', 'w') as f:
    f.write(html)

print("SUCCESS - index.html updated")
