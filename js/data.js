// ─── APPLICATION STATE & DATA ─────────────────────────
let currentRole = 'participant';

const announcements = [
  { id:1, title:"Hacking has begun! 🚀", body:"The 36-hour clock is ticking. All the best to all teams!", priority:"info", time:"11:00 AM", icon:"🚀" },
  { id:2, title:"Wi-Fi Credentials Updated", body:"SSID: HackPortal_2025  |  Password: h4ck3rz2025", priority:"warning", time:"11:15 AM", icon:"📶" },
  { id:3, title:"Mentor Office Hours", body:"Mentors are available in Rooms 201–206. Check the board for their expertise areas.", priority:"info", time:"2:45 PM", icon:"🧑‍💼" },
  { id:4, title:"🍕 Lunch Ready!", body:"Head to the Cafeteria now. Vegetarian and vegan options available. First come first served!", priority:"info", time:"1:00 PM", icon:"🍕" },
];

let participants = [
  { id:"HACK-2025-0001", name:"Alice Johnson",  email:"alice@email.com",  team:"Neural Ninjas",   track:"AI / ML",  status:"pending",  time:"—" },
  { id:"HACK-2025-0002", name:"Arjun Kumar",    email:"arjun@email.com",  team:"Chain Gang",      track:"Web3",     status:"checkedin",time:"11:02 AM" },
  { id:"HACK-2025-0003", name:"Shreya Nair",    email:"shreya@email.com", team:"Byte Busters",    track:"CyberSec", status:"checkedin",time:"11:08 AM" },
  { id:"HACK-2025-0004", name:"Riya Patel",     email:"riya@email.com",   team:"Neural Ninjas",   track:"AI / ML",  status:"checkedin",time:"10:57 AM" },
  { id:"HACK-2025-0005", name:"Karan Mehta",    email:"karan@email.com",  team:"App Alchemists",  track:"Mobile",   status:"pending",  time:"—" },
  { id:"HACK-2025-0006", name:"Priya Singh",    email:"priya@email.com",  team:"Zero Day",        track:"CyberSec", status:"checkedin",time:"11:14 AM" },
  { id:"HACK-2025-0007", name:"Dev Joshi",      email:"dev@email.com",    team:"Chain Gang",      track:"Web3",     status:"pending",  time:"—" },
  { id:"HACK-2025-0008", name:"Meera Iyer",     email:"meera@email.com",  team:"App Alchemists",  track:"Mobile",   status:"checkedin",time:"11:23 AM" },
];
