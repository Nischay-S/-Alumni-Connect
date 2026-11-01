// Fills portal.db with demo data. Run once:  npm run seed   (add --force to wipe and reseed)
const{DatabaseSync:DB}=require('node:sqlite'),bc=require('bcryptjs'),db=new DB('portal.db');
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name,email UNIQUE,pass,role,branch,batch INT,company,title,city,skills,bio,resume,otp,approved INT DEFAULT 0,points INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY,uid INT,title,company,skills,slots INT);
CREATE TABLE IF NOT EXISTS referrals(id INTEGER PRIMARY KEY,job INT,uid INT,status DEFAULT 'Requested');
CREATE TABLE IF NOT EXISTS mentor(id INTEGER PRIMARY KEY,student INT,mentor INT,goal,slot,status DEFAULT 'Pending');
CREATE TABLE IF NOT EXISTS msgs(id INTEGER PRIMARY KEY,a INT,b INT,body,t DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS exp(id INTEGER PRIMARY KEY,uid INT,company,role,rounds,tips);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,title,date,batch);
CREATE TABLE IF NOT EXISTS rsvp(event INT,uid INT,code,checked INT DEFAULT 0,PRIMARY KEY(event,uid));
CREATE TABLE IF NOT EXISTS gifts(id INTEGER PRIMARY KEY,uid INT,amount INT,fund);`);
const run=(s,...p)=>db.prepare(s).run(...p),one=(s,...p)=>db.prepare(s).get(...p);
if(process.argv.includes('--force'))['users','jobs','referrals','mentor','msgs','exp','events','rsvp','gifts'].forEach(t=>run('DELETE FROM '+t));
if(one("SELECT 1 FROM users WHERE role!='admin'")){console.log('Data already exists. Use: npm run seed -- --force');process.exit()}
if(!one("SELECT 1 FROM users WHERE role='admin'"))run("INSERT INTO users(name,email,pass,role,approved) VALUES('Admin','admin@portal.local',?, 'admin',1)",bc.hashSync('admin123',8));
const pw=bc.hashSync('demo123',8),id={};
const U=[['Rahul Sharma','alumni','CSE',2020,'Google','Software Engineer','Bangalore','python backend java system design',95],['Priya Nair','alumni','CSE',2019,'Microsoft','Software Engineer','Hyderabad','java cloud azure backend',45],
['Aman Gupta','alumni','ECE',2018,'Qualcomm','Design Engineer','Bangalore','vlsi embedded c verilog',20],['Sneha Kapoor','alumni','CCE',2021,'Amazon','SDE','Gurgaon','python aws data structures backend',60],
['Vikram Singh','alumni','MECH',2017,'Tata Motors','Design Lead','Pune','cad ansys design manufacturing',15],['Neha Joshi','alumni','CSE',2022,'Deloitte','Data Analyst','Mumbai','sql python tableau analytics',35],
['Karan Mehta','alumni','CCE',2020,'Flipkart','Data Scientist','Bangalore','python machine learning sql data',40],['Divya Rao','alumni','IT',2019,'Infosys','Consultant','Chennai','java sql consulting testing',10],
['Asha Verma','student','CSE',2027,'','','Jaipur','python sql',10],['Rohan Das','student','CCE',2027,'','','Jaipur','java backend',5],['Ishita Jain','student','ECE',2028,'','','Jaipur','embedded c',0],
['Mohit Yadav','student','CSE',2026,'','','Jaipur','python data machine learning',20],['Kritika Soni','student','IT',2027,'','','Jaipur','sql analytics',0],['Arjun Rathore','student','MECH',2027,'','','Jaipur','cad design',0]];
for(const u of U){const e=u[0].split(' ')[0].toLowerCase()+'@demo.com';run('INSERT INTO users(name,email,pass,role,branch,batch,company,title,city,skills,approved,points) VALUES(?,?,?,?,?,?,?,?,?,?,1,?)',u[0],e,pw,u[1],u[2],u[3],u[4],u[5],u[6],u[7],u[8]);id[u[0].split(' ')[0]]=one('SELECT id FROM users WHERE email=?',e).id}
const J=[['Rahul','Backend Intern','Google','python java sql',3],['Sneha','SDE Intern','Amazon','python aws data structures',2],['Neha','Data Analyst Trainee','Deloitte','sql python tableau',2],['Karan','ML Intern','Flipkart','python machine learning sql',2]];
J.forEach(j=>run('INSERT INTO jobs(uid,title,company,skills,slots) VALUES(?,?,?,?,?)',id[j[0]],j[1],j[2],j[3],j[4]));
[[1,'Asha','Referred'],[1,'Rohan','Interview'],[4,'Mohit','Selected'],[3,'Kritika','Requested'],[2,'Asha','Requested']].forEach(r=>run('INSERT INTO referrals(job,uid,status) VALUES(?,?,?)',r[0],id[r[1]],r[2]));
[['Asha','Rahul','backend internship at Google','Accepted'],['Rohan','Priya','cloud and Java career','Accepted'],['Mohit','Karan','machine learning projects','Accepted'],['Kritika','Neha','data analyst roles','Pending'],['Ishita','Aman','embedded systems careers','Pending']].forEach(m=>run('INSERT INTO mentor(student,mentor,goal,status) VALUES(?,?,?,?)',id[m[0]],id[m[1]],m[2],m[3]));
[['Asha','Rahul','Hi Rahul, thank you for accepting. Can you review my resume?'],['Rahul','Asha','Sure. Add two projects with numbers and share your GitHub link.'],['Asha','Rahul','Will do, thanks!']].forEach(m=>run('INSERT INTO msgs(a,b,body) VALUES(?,?,?)',id[m[0]],id[m[1]],m[2]));
[['Rahul','Google','Software Engineer Intern','Round 1: online test with 2 DSA problems (arrays, hash maps). Round 2: coding interview on graphs. Round 3: project discussion and behavioural.','Practise on a whiteboard, explain your thinking aloud, and know your project deeply.'],
['Priya','Microsoft','SDE','Round 1: aptitude and coding. Round 2: system design basics. Round 3: managerial round.','Be clear on OOP and SQL. Ask good questions at the end.'],
['Sneha','Amazon','SDE Intern','Online assessment with 2 coding questions and a work-style survey, then two interviews built on leadership principles.','Prepare 5 STAR stories from your own projects.'],
['Karan','Flipkart','Data Science Intern','SQL test, then a case study on recommendations, then a statistics and ML fundamentals interview.','Know bias-variance, metrics and how you would clean messy data.'],
['Neha','Deloitte','Analyst','Aptitude test, group discussion, then a technical and HR interview.','Brush up Excel and SQL joins.']].forEach(x=>run('INSERT INTO exp(uid,company,role,rounds,tips) VALUES(?,?,?,?,?)',id[x[0]],x[1],x[2],x[3],x[4]));
[['Alumni Meet 2026','2026-12-20','All'],['Batch 2020 Reunion','2026-12-14','2020'],['Career Talk: Cracking Product Companies','2026-11-15','All']].forEach(e=>run('INSERT INTO events(title,date,batch) VALUES(?,?,?)',...e));
[[1,'Rahul'],[1,'Priya'],[1,'Asha'],[3,'Asha'],[3,'Mohit']].forEach(r=>run('INSERT INTO rsvp(event,uid,code,checked) VALUES(?,?,?,?)',r[0],id[r[1]],'E'+r[0]+'-'+r[1].slice(0,3).toUpperCase()+'01',r[0]===3?1:0));
[['Rahul',5000,'Scholarship fund'],['Priya',2500,'Scholarship fund'],['Sneha',3000,'Lab and equipment'],['Karan',1500,'Emergency student aid'],['Aman',2000,'Lab and equipment']].forEach(g=>run('INSERT INTO gifts(uid,amount,fund) VALUES(?,?,?)',id[g[0]],g[1],g[2]));
console.log('Demo data added. Log in with e.g. rahul@demo.com (alumnus) or asha@demo.com (student), password demo123. Admin: admin@portal.local / admin123');
