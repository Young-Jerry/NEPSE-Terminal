(function(){
  const KEYS={daily:'sm_lifeos_daily_v1',skills:'sm_lifeos_skills_v1',habits:'sm_lifeos_habits_v1'};
  const MOODS=['focused','disciplined','sharp','distracted','impulsive','exhausted'];
  const BASE_ACT=[['sleep',1],['reading',1],['deep work',1],['trading study',1],['gym/workout',2],['doomscrolling',-2]];
  const today=()=>new Date().toISOString().slice(0,10);
  const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||JSON.stringify(d));return v??d;}catch{return d;}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  function scoreDay(day){return (day.activities||[]).reduce((s,a)=>s+(Number(a.hours||0)*Number(a.weight||0)),0)+Number(day.noTradeDisciplined?2:0);}
  function getDaily(){const all=read(KEYS.daily,{});if(!all[today()]) all[today()]={mood:'focused',notes:'',reflection:'',noTradeDisciplined:false,activities:BASE_ACT.map(([n,w])=>({name:n,hours:0,weight:w}))};return all;}
  function heat(score){if(score>=8)return 'good';if(score>=2)return 'mixed';if(score>=0)return 'neutral';return 'bad';}
  function renderLifeOS(container){
    const data=getDaily();write(KEYS.daily,data);
    const skills=read(KEYS.skills,[{title:'economics',level:'intermediate',days:0,milestones:0,focus:'macro cycles',notes:''},{title:'forex execution',level:'developing',days:0,milestones:0,focus:'risk adherence',notes:''}]);
    const d=data[today()];
    const weekly=Object.entries(data).slice(-7).map(([date,v])=>({date,score:scoreDay(v)}));
    container.innerHTML=`<div class="lifeos-grid">
      <section class="life-card"><h3>DAILY DISCIPLINE</h3><div class="life-sub">${today()}</div>
        <div class="activity-list">${d.activities.map((a,i)=>`<div class='activity-row'><input data-k='name' data-i='${i}' value='${a.name}'/><input data-k='hours' data-i='${i}' type='number' step='0.5' value='${a.hours}'/><span class='w'>x ${a.weight}</span></div>`).join('')}</div>
        <div class='activity-actions'><button id='addAct'>+ Activity</button><label><input type='checkbox' id='noTrade' ${d.noTradeDisciplined?'checked':''}/> disciplined no-trade day</label></div>
        <div class='life-inline'><label>Mood</label><select id='moodSel'>${MOODS.map(m=>`<option ${d.mood===m?'selected':''}>${m}</option>`).join('')}</select></div>
        <textarea id='lifeNotes' placeholder='Notes'>${d.notes||''}</textarea>
      </section>
      <section class='life-card'><h3>HABIT + SCORE</h3><div class='score-big'>${scoreDay(d).toFixed(1)}</div><div class='bar'><div class='fill ${heat(scoreDay(d))}' style='width:${Math.min(100,Math.max(0,(scoreDay(d)+10)*4))}%'></div></div>
      <div class='mini-heat'>${weekly.map(w=>`<div class='cell ${heat(w.score)}' title='${w.date}: ${w.score.toFixed(1)}'></div>`).join('')}</div></section>
      <section class='life-card'><h3>SKILL PROGRESS</h3>${skills.map((s,idx)=>`<div class='skill-row' data-idx='${idx}'><strong contenteditable='true' data-field='title'>${s.title}</strong><span contenteditable='true' data-field='level'>${s.level}</span><small>${s.focus}</small></div>`).join('')}<button id='addSkill'>+ Skill</button></section>
    </div>`;
    container.querySelectorAll('.activity-row input').forEach(el=>el.addEventListener('change',()=>{const i=Number(el.dataset.i);const k=el.dataset.k;d.activities[i][k]=k==='hours'?Number(el.value||0):el.value;write(KEYS.daily,data);renderLifeOS(container);}));
    container.querySelector('#noTrade').addEventListener('change',e=>{d.noTradeDisciplined=e.target.checked;write(KEYS.daily,data);renderLifeOS(container);});
    container.querySelector('#moodSel').addEventListener('change',e=>{d.mood=e.target.value;write(KEYS.daily,data);});
    container.querySelector('#lifeNotes').addEventListener('input',e=>{d.notes=e.target.value;write(KEYS.daily,data);});
    container.querySelector('#addAct').addEventListener('click',()=>{d.activities.push({name:'custom',hours:0,weight:1});write(KEYS.daily,data);renderLifeOS(container);});
    container.querySelector('#addSkill').addEventListener('click',()=>{skills.push({title:'new skill',level:'developing',days:0,milestones:0,focus:'',notes:''});write(KEYS.skills,skills);renderLifeOS(container);});
    container.querySelectorAll('.skill-row [contenteditable=true]').forEach(el=>el.addEventListener('blur',()=>{const row=el.closest('.skill-row');const i=Number(row.dataset.idx);skills[i][el.dataset.field]=el.textContent.trim();write(KEYS.skills,skills);}));
  }
  window._renderLifeOS=renderLifeOS;
})();
