import puppeteer from "puppeteer";
import fs from "fs";
const CHROME="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
async function main(){
  const b=await puppeteer.launch({headless:true,executablePath:fs.existsSync(CHROME)?CHROME:undefined,args:["--no-sandbox"]});
  const p=await b.newPage();
  const logs:string[]=[];
  p.on("console",m=>logs.push(`[${m.type()}] ${m.text().slice(0,220)}`));
  p.on("pageerror",e=>logs.push(`[pageerror] ${String(e).slice(0,220)}`));
  p.on("requestfailed",r=>logs.push(`[reqfail] ${r.url().slice(0,110)} ${r.failure()?.errorText}`));
  await p.goto("http://localhost:3000/studio",{waitUntil:"networkidle2",timeout:90000});
  await new Promise(r=>setTimeout(r,9000));
  const hasLoader=await p.evaluate(()=>document.body.innerText.includes("Loading editor"));
  console.log("SHOWING_LOADER:",hasLoader);
  console.log("MONACO_DOM:",await p.evaluate(()=>Boolean(document.querySelector(".monaco-editor"))));
  console.log("--- LOGS ---");
  logs.slice(-25).forEach(l=>console.log(l));
  await b.close();
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,200));process.exit(1)});
