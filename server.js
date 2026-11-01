const{DatabaseSync:DB}=require('node:sqlite');
const express=require('express'),bc=require('bcryptjs'),jwt=require('jsonwebtoken'),path=require('path');
const db=new DB('portal.db'),app=express(),SECRET=process.env.JWT_SECRET||'dev-secret',DOM=process.env.COLLEGE_DOMAIN||'';
app.use(express.json(),express.static(path.join(__dirname,'public')));
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name,email UNIQUE,pass,role,branch,batch INT,company,title,city,skills,bio,resume,otp,approved INT DEFAULT 0,points INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY,uid INT,title,company,skills,slots INT);
CREATE TABLE IF NOT EXISTS referrals(id INTEGER PRIMARY KEY,job INT,uid INT,status DEFAULT 'Requested');
CREATE TABLE IF NOT EXISTS mentor(id INTEGER PRIMARY KEY,student INT,mentor INT,goal,slot,status DEFAULT 'Pending');
CREATE TABLE IF NOT EXISTS msgs(id INTEGER PRIMARY KEY,a INT,b INT,body,t DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS exp(id INTEGER PRIMARY KEY,uid INT,company,role,rounds,tips);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,title,date,batch);
CREATE TABLE IF NOT EXISTS rsvp(event INT,uid INT,code,checked INT DEFAULT 0,PRIMARY KEY(event,uid));
CREATE TABLE IF NOT EXISTS gifts(id INTEGER PRIMARY KEY,uid INT,amount INT,fund);`);
if(!db.prepare('SELECT 1 FROM users WHERE role=?').get('admin'))db.prepare('INSERT INTO users(name,email,pass,role,approved) VALUES(?,?,?,?,1)').run('Admin','admin@portal.local',bc.hashSync('admin123',8),'admin');
const all=(s,...p)=>db.prepare(s).all(...p),one=(s,...p)=>db.prepare(s).get(...p),run=(s,...p)=>db.prepare(s).run(...p);
const pts=(u,n)=>run('UPDATE users SET points=points+? WHERE id=?',n,u);
const auth=(roles)=>(req,res,next)=>{try{req.u=jwt.verify((req.headers.authorization||'').slice(7),SECRET);if(roles&&!roles.includes(req.u.role))return res.status(403).json({error:'Not allowed'});next()}catch{res.status(401).json({error:'Please log in'})}};
const toks=s=>(s||'').toLowerCase().split(/[^a-z0-9+#.]+/).filter(x=>x.length>1);
const safe=u=>{const{pass,otp,resume,...r}=u;return r};
// 1 verified onboarding: college domain + OTP + admin approval
app.post('/api/register',(req,res)=>{const b=req.body;
 if(!b.email||!b.password||!b.name)return res.status(400).json({error:'Name, email and password are required'});
 if(DOM&&!b.email.endsWith('@'+DOM))return res.status(400).json({error:'Use your @'+DOM+' email'});
 if(one('SELECT 1 FROM users WHERE email=?',b.email))return res.status(400).json({error:'Email already registered'});
 const otp=String(Math.floor(100000+Math.random()*900000));console.log(`OTP for ${b.email}: ${otp}`);
 run('INSERT INTO users(name,email,pass,role,branch,batch,company,title,city,skills,bio,otp) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',b.name,b.email,bc.hashSync(b.password,8),b.role==='alumni'?'alumni':'student',b.branch||'',+b.batch||0,b.company||'',b.title||'',b.city||'',b.skills||'',b.bio||'',otp);
 res.json({ok:'Account created. Enter the OTP (see server console) to verify your email.'})});
app.post('/api/verify',(req,res)=>{const u=one('SELECT * FROM users WHERE email=?',req.body.email);
 if(!u||u.otp!==req.body.otp)return res.status(400).json({error:'Wrong OTP'});run('UPDATE users SET otp=NULL WHERE id=?',u.id);res.json({ok:'Email verified. An admin must approve your account before you can log in.'})});
app.post('/api/login',(req,res)=>{const u=one('SELECT * FROM users WHERE email=?',req.body.email);
 if(!u||!bc.compareSync(req.body.password||'',u.pass))return res.status(400).json({error:'Wrong email or password'});
 if(u.otp)return res.status(403).json({error:'Verify your email with the OTP first'});
 if(!u.approved)return res.status(403).json({error:'Waiting for admin approval'});
 res.json({token:jwt.sign({id:u.id,role:u.role},SECRET,{expiresIn:'7d'}),user:safe(u)})});
app.get('/api/me',auth(),(req,res)=>res.json(safe(one('SELECT * FROM users WHERE id=?',req.u.id))));
app.put('/api/me',auth(),(req,res)=>{const b=req.body;run('UPDATE users SET company=?,title=?,city=?,skills=?,bio=? WHERE id=?',b.company||'',b.title||'',b.city||'',b.skills||'',b.bio||'',req.u.id);res.json({ok:'Profile saved'})});
// 2 mentorship matching
app.get('/api/mentors/match',auth(),(req,res)=>{const me=one('SELECT * FROM users WHERE id=?',req.u.id),want=new Set([...toks(me.skills),...toks(req.query.goal)]);
 const r=all("SELECT * FROM users WHERE role='alumni' AND approved=1").map(a=>{const ov=toks(a.skills+' '+a.company+' '+a.title).filter(t=>want.has(t));
  const score=new Set(ov).size*3+(a.branch&&a.branch===me.branch?2:0)+(a.batch&&a.batch<me.batch?1:0);return{...safe(a),score,why:[...new Set(ov)]}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,10);res.json(r)});
app.post('/api/mentors/request',auth(['student']),(req,res)=>{run('INSERT INTO mentor(student,mentor,goal,slot) VALUES(?,?,?,?)',req.u.id,req.body.mentor,req.body.goal||'',req.body.slot||'');res.json({ok:'Request sent'})});
app.get('/api/mentors/mine',auth(),(req,res)=>res.json(all(`SELECT m.*,s.name sname,a.name aname FROM mentor m JOIN users s ON s.id=m.student JOIN users a ON a.id=m.mentor WHERE m.student=? OR m.mentor=? ORDER BY m.id DESC`,req.u.id,req.u.id)));
app.post('/api/mentors/:id/:act',auth(['alumni']),(req,res)=>{const st=req.params.act==='accept'?'Accepted':'Declined';run('UPDATE mentor SET status=? WHERE id=? AND mentor=?',st,req.params.id,req.u.id);if(st==='Accepted')pts(req.u.id,10);res.json({ok:st})});
// 3 referral marketplace
app.post('/api/jobs',auth(['alumni']),(req,res)=>{const b=req.body;run('INSERT INTO jobs(uid,title,company,skills,slots) VALUES(?,?,?,?,?)',req.u.id,b.title,b.company,b.skills||'',+b.slots||1);pts(req.u.id,5);res.json({ok:'Job posted'})});
app.get('/api/jobs',auth(),(req,res)=>res.json(all('SELECT j.*,u.name poster,(SELECT COUNT(*) FROM referrals r WHERE r.job=j.id AND r.status!=\'Declined\') used FROM jobs j JOIN users u ON u.id=j.uid ORDER BY j.id DESC')));
app.post('/api/jobs/:id/request',auth(['student']),(req,res)=>{const j=one('SELECT j.*,(SELECT COUNT(*) FROM referrals r WHERE r.job=j.id AND r.status!=\'Declined\') used FROM jobs j WHERE id=?',req.params.id);
 if(!j||j.used>=j.slots)return res.status(400).json({error:'No referral slots left'});if(one('SELECT 1 FROM referrals WHERE job=? AND uid=?',j.id,req.u.id))return res.status(400).json({error:'Already requested'});
 run('INSERT INTO referrals(job,uid) VALUES(?,?)',j.id,req.u.id);res.json({ok:'Referral requested'})});
app.get('/api/referrals',auth(),(req,res)=>res.json(all(`SELECT r.*,j.title,j.company,u.name student,p.name poster,j.uid posterId FROM referrals r JOIN jobs j ON j.id=r.job JOIN users u ON u.id=r.uid JOIN users p ON p.id=j.uid WHERE r.uid=? OR j.uid=? ORDER BY r.id DESC`,req.u.id,req.u.id)));
const FLOW=['Requested','Referred','Interview','Selected','Declined'];
app.post('/api/referrals/:id',auth(['alumni']),(req,res)=>{const st=req.body.status;if(!FLOW.includes(st))return res.status(400).json({error:'Bad status'});
 run('UPDATE referrals SET status=? WHERE id=? AND job IN (SELECT id FROM jobs WHERE uid=?)',st,req.params.id,req.u.id);pts(req.u.id,st==='Selected'?50:st==='Referred'?15:0);res.json({ok:'Updated to '+st})});
// 4 interview library
app.post('/api/exp',auth(['alumni']),(req,res)=>{const b=req.body;run('INSERT INTO exp(uid,company,role,rounds,tips) VALUES(?,?,?,?,?)',req.u.id,b.company,b.role,b.rounds,b.tips);pts(req.u.id,20);res.json({ok:'Shared. +20 points'})});
app.get('/api/exp',auth(),(req,res)=>{const q='%'+(req.query.q||'')+'%';res.json(all('SELECT e.*,u.name author,u.batch FROM exp e JOIN users u ON u.id=e.uid WHERE e.company LIKE ? OR e.role LIKE ? ORDER BY e.id DESC',q,q))});
// 5 events + RSVP + check-in
app.post('/api/events',auth(['admin']),(req,res)=>{run('INSERT INTO events(title,date,batch) VALUES(?,?,?)',req.body.title,req.body.date,req.body.batch||'All');res.json({ok:'Event created'})});
app.get('/api/events',auth(),(req,res)=>res.json(all('SELECT e.*,(SELECT code FROM rsvp WHERE event=e.id AND uid=?) code,(SELECT COUNT(*) FROM rsvp WHERE event=e.id) going,(SELECT COUNT(*) FROM rsvp WHERE event=e.id AND checked=1) attended FROM events e ORDER BY date',req.u.id)));
app.post('/api/events/:id/rsvp',auth(),(req,res)=>{const c='E'+req.params.id+'-'+Math.random().toString(36).slice(2,8).toUpperCase();run('INSERT OR IGNORE INTO rsvp(event,uid,code) VALUES(?,?,?)',req.params.id,req.u.id,c);res.json({ok:'You are going'})});
app.post('/api/checkin',auth(['admin']),(req,res)=>{const r=one('SELECT r.*,u.name FROM rsvp r JOIN users u ON u.id=r.uid WHERE code=?',req.body.code);if(!r)return res.status(400).json({error:'Invalid code'});run('UPDATE rsvp SET checked=1 WHERE code=?',r.code);pts(r.uid,10);res.json({ok:'Checked in: '+r.name})});
// 6 chat (only with an accepted mentorship)
const linked=(a,b)=>one("SELECT 1 FROM mentor WHERE status='Accepted' AND ((student=? AND mentor=?) OR (student=? AND mentor=?))",a,b,b,a);
app.get('/api/chat/people',auth(),(req,res)=>res.json(all("SELECT DISTINCT u.id,u.name FROM mentor m JOIN users u ON u.id=(CASE WHEN m.student=? THEN m.mentor ELSE m.student END) WHERE m.status='Accepted' AND (m.student=? OR m.mentor=?)",req.u.id,req.u.id,req.u.id)));
app.get('/api/chat/:id',auth(),(req,res)=>res.json(all('SELECT * FROM msgs WHERE (a=? AND b=?) OR (a=? AND b=?) ORDER BY id',req.u.id,req.params.id,req.params.id,req.u.id)));
app.post('/api/chat/:id',auth(),(req,res)=>{if(!linked(req.u.id,+req.params.id))return res.status(403).json({error:'Chat opens after a mentor accepts'});run('INSERT INTO msgs(a,b,body) VALUES(?,?,?)',req.u.id,req.params.id,req.body.body);res.json({ok:1})});
// 7 giving back
app.post('/api/gifts',auth(),(req,res)=>{run('INSERT INTO gifts(uid,amount,fund) VALUES(?,?,?)',req.u.id,+req.body.amount,req.body.fund);pts(req.u.id,Math.floor(req.body.amount/100));res.json({ok:'Thank you for giving'})});
app.get('/api/gifts',auth(),(req,res)=>res.json({funds:all('SELECT fund,SUM(amount) total,COUNT(*) donors FROM gifts GROUP BY fund'),total:one('SELECT COALESCE(SUM(amount),0) t FROM gifts').t}));
// 8 resume feedback + job match (rule-based; swap in an LLM call here if you add an API key)
app.put('/api/resume',auth(),(req,res)=>{run('UPDATE users SET resume=? WHERE id=?',req.body.text,req.u.id);res.json({ok:'Resume saved'})});
app.get('/api/resume/analyze',auth(),(req,res)=>{const t=one('SELECT resume,skills FROM users WHERE id=?',req.u.id),txt=t.resume||'',w=new Set(toks(txt+' '+t.skills)),tips=[];
 if(txt.split(/\s+/).length<120)tips.push('Resume is short. Add projects with outcomes.');if(!/\d/.test(txt))tips.push('Add numbers (users, % improvement, scale).');
 if(!/(github|linkedin)/i.test(txt))tips.push('Add GitHub/LinkedIn links.');if(!/(built|designed|led|developed|implemented)/i.test(txt))tips.push('Start bullets with action verbs (built, led, implemented).');
 const jobs=all('SELECT * FROM jobs').map(j=>{const n=[...new Set(toks(j.skills))],hit=n.filter(x=>w.has(x));return{id:j.id,title:j.title,company:j.company,match:n.length?Math.round(100*hit.length/n.length):0,missing:n.filter(x=>!w.has(x))}}).sort((a,b)=>b.match-a.match);
 res.json({tips,jobs})});
// 9 leaderboard + 10 directory/career paths + 11 admin analytics
app.get('/api/leaders',auth(),(req,res)=>res.json(all("SELECT name,role,points FROM users WHERE role!='admin' AND points>0 ORDER BY points DESC LIMIT 10")));
app.get('/api/directory',auth(),(req,res)=>res.json(all("SELECT id,name,branch,batch,company,title,city FROM users WHERE role='alumni' AND approved=1 ORDER BY batch DESC")));
app.get('/api/paths',auth(),(req,res)=>res.json(all("SELECT branch,company,COUNT(*) n FROM users WHERE role='alumni' AND approved=1 AND company!='' GROUP BY branch,company ORDER BY n DESC")));
const stats=()=>({alumni:one("SELECT COUNT(*) n FROM users WHERE role='alumni' AND approved=1").n,students:one("SELECT COUNT(*) n FROM users WHERE role='student' AND approved=1").n,
 employed:one("SELECT COUNT(*) n FROM users WHERE role='alumni' AND approved=1 AND company!=''").n,byBranch:all("SELECT branch,COUNT(*) total,SUM(company!='') employed FROM users WHERE role='alumni' AND approved=1 GROUP BY branch"),
 recruiters:all("SELECT company,COUNT(*) n FROM users WHERE role='alumni' AND approved=1 AND company!='' GROUP BY company ORDER BY n DESC LIMIT 8"),cities:all("SELECT city,COUNT(*) n FROM users WHERE role='alumni' AND approved=1 AND city!='' GROUP BY city ORDER BY n DESC LIMIT 8"),
 referrals:all('SELECT status,COUNT(*) n FROM referrals GROUP BY status'),giving:one('SELECT COALESCE(SUM(amount),0) t FROM gifts').t,mentorships:one("SELECT COUNT(*) n FROM mentor WHERE status='Accepted'").n});
app.get('/api/admin/stats',auth(['admin']),(req,res)=>res.json(stats()));
app.get('/api/admin/report.csv',auth(['admin']),(req,res)=>{const s=stats();res.type('text/csv').send('Branch,Alumni,Employed,Employment %\n'+s.byBranch.map(b=>`${b.branch||'N/A'},${b.total},${b.employed},${Math.round(100*b.employed/b.total)}`).join('\n'))});
app.get('/api/admin/pending',auth(['admin']),(req,res)=>res.json(all("SELECT id,name,email,role,branch,batch FROM users WHERE approved=0 AND otp IS NULL")));
app.post('/api/admin/approve/:id',auth(['admin']),(req,res)=>{run('UPDATE users SET approved=1 WHERE id=?',req.params.id);res.json({ok:'Approved'})});
app.listen(3000,()=>console.log('Alumni Connect running at http://localhost:3000'));
