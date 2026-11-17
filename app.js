const $ = id => document.getElementById(id);
let lastReport = "";
let deferredInstall = null;

const sample = {
  name: "Servidor CFTV - Projeto exemplo",
  category: "Servidor",
  purpose: "Gravação e gerenciamento de câmeras IP",
  requirements: "Atender 200 câmeras IP, gravação 24x7, retenção de 30 dias, RAID 6, rede 10GbE e possibilidade de expansão.",
  spec: `1x Gabinete rack 2U com 12 baias 3.5 LFF e fonte redundante 1+1 800W
1x Placa-mãe Intel C262, socket LGA1700, 4 slots DDR5
1x Processador Intel Xeon E-2478
4x Memória DDR5 ECC UDIMM 32GB
1x Controladora RAID PCIe x8
8x SSD SATA 3.84TB
1x Placa de rede dual port 10GbE PCIe x8
2x Fonte redundante 800W`
};

function addFinding(list, status, title, detail, evidence="") { list.push({status,title,detail,evidence}); }
function analyze(text, requirements, category) {
  const s = text.toLowerCase(), r = requirements.toLowerCase(), findings = [];
  const has = (re) => re.test(s);
  const reqHas = (re) => re.test(r);
  // Evidence-based textual checks only; no manufacturer compatibility is inferred.
  const socket = (s.match(/socket\s*[-:]?\s*([a-z0-9]+)/i)||[])[1];
  const cpuSocket = (s.match(/(?:xeon|ryzen|core)\s+[a-z0-9 -]+/i)||[])[0];
  if (socket) addFinding(findings,"pending","Socket e processador identificados",`Socket declarado: ${socket.toUpperCase()}. A correspondência exata entre CPU, chipset, revisão da placa e BIOS precisa ser confirmada no suporte oficial do fabricante.`,`CPU identificada no texto: ${cpuSocket || "não identificada"}`);
  else addFinding(findings,"pending","Compatibilidade de processador e placa-mãe","Não foi possível identificar claramente o socket. Informar fabricante/modelo exato da placa-mãe e processador.");
  const ddr = [...s.matchAll(/\bddr[345]\b/gi)].map(x=>x[0].toUpperCase());
  if (ddr.length) {
    const types=[...new Set(ddr)];
    addFinding(findings,types.length>1?"warn":"pending","Tecnologia de memória",types.length>1?`Foram encontradas tecnologias distintas (${types.join(", ")}). Verifique se pertencem a componentes diferentes ou se há conflito.`:`Tecnologia declarada: ${types[0]}. Confirmar tipo de módulo (UDIMM/RDIMM/LRDIMM), ECC, frequência, capacidade máxima e população suportada.`, "Apenas a menção textual foi verificada; não foi consultada QVL.");
  } else addFinding(findings,"pending","Memória RAM","Tipo, capacidade, ECC e formato dos módulos não estão suficientemente identificados.");
  const pcieNeed = (s.match(/pcie\s*x\d+/gi)||[]).map(x=>x.toLowerCase());
  const pcieSlots = (s.match(/\d+\s*(?:x|×)\s*(?:slot[s]?\s*)?pcie/gi)||[]);
  if (pcieNeed.length || pcieSlots.length) addFinding(findings,"pending","Expansão PCIe",`Referências encontradas: ${[...new Set(pcieNeed)].join(", ") || pcieSlots.join(", ")}. Validar slots físicos e elétricos, geração, bifurcação, lanes disponíveis, compartilhamento com M.2/SATA e espaço entre placas.`);
  else addFinding(findings,"pending","Expansão PCIe","Não há dados suficientes para validar controladoras RAID, placas de rede ou aceleradores. Informar quantidade, geração e largura dos slots.");
  const drives = [...s.matchAll(/(\d+)\s*x\s*(?:hd|hdd|ssd|discos?)\s*[^\\n,;]*?(\d+(?:[.,]\d+)?)\s*(tb|gb)/gi)];
  if (drives.length) {
    const total = drives.reduce((a,m)=>a+Number(m[1])*Number(m[2].replace(",","."))*(m[3].toLowerCase()==="gb"?0.001:1),0);
    addFinding(findings,"pending","Capacidade de discos identificada",`Capacidade bruta textual estimada: ${total.toFixed(2)} TB. Capacidade útil depende de RAID, hot spare, formatação, filesystem e unidade decimal/binária.`,drives.map(m=>m[0]).join("; "));
  } else addFinding(findings,"pending","Capacidade e discos","Não foi possível extrair quantidade e capacidade dos discos de forma confiável.");
  if (/raid\s*6/i.test(s) && reqHas(/raid\s*6/)) addFinding(findings,"ok","Requisito RAID 6 mencionado","A especificação menciona RAID 6, assim como o requisito. Ainda é necessário confirmar suporte da controladora, número mínimo de discos, cache protegido e discos homologados.","Correspondência textual, não teste funcional.");
  else if (reqHas(/raid\s*6/)) addFinding(findings,"warn","Requisito RAID 6","O projeto solicita RAID 6, mas a especificação não declara claramente essa configuração ou capacidade.");
  if (reqHas(/10\s*gb|10gbe|10g\b/) && !/10\s*gb(e|ps)?|10gbase/i.test(s)) addFinding(findings,"warn","Rede 10GbE","O requisito menciona 10GbE, mas não foi localizada interface correspondente na especificação.");
  else if (/10\s*gb(e|ps)?|10gbase/i.test(s)) addFinding(findings,"pending","Conectividade de rede 10GbE","Há menção a 10GbE. Confirmar quantidade de portas, mídia (SFP+/Base-T), transceptores, cabos e compatibilidade de driver.");
  if (reqHas(/redund|fonte/) && !/fonte|psu|power supply/i.test(s)) addFinding(findings,"warn","Alimentação","O requisito aparenta exigir redundância ou fonte, mas não há fonte claramente descrita.");
  else if (/fonte|psu|power supply/i.test(s)) addFinding(findings,"pending","Fonte e redundância","Validar potência contínua, eficiência, conectores, alimentação AC, redundância 1+1 e operação com uma fonte em falha.");
  if (/sata/i.test(s) && /sas/i.test(s)) addFinding(findings,"warn","Interfaces de armazenamento","A especificação menciona SATA e SAS. Confirmar interface de cada disco, backplane, cabos e controladora; não presumir interoperabilidade.");
  if (/nvme/i.test(s) && /sata/i.test(s)) addFinding(findings,"warn","Mistura de SATA e NVMe","Confirmar que backplane, controladora, slots e cabeamento suportam as interfaces especificadas.");
  if (/12\s*baias|8\s*baias|24\s*baias|36\s*baias/i.test(s)) addFinding(findings,"pending","Gabinete e backplane","Quantidade de baias mencionada. Validar backplane, tipo LFF/SFF, protocolo, conectores, expansores e suporte a hot-swap.");
  if (reqHas(/câmeras|cameras|cftv|vms|retenção|retencao|gravação|gravacao/)) addFinding(findings,"pending","Dimensionamento da aplicação CFTV/VMS","Para validar desempenho e retenção, faltam ou precisam ser confirmados: quantidade de câmeras, resolução, FPS, codec, bitrate médio, gravação contínua/evento, dias de retenção, overhead e perfil do VMS.");
  if (reqHas(/virtualiza|máquina virtual|maquina virtual|hyper-v|vmware|proxmox/)) addFinding(findings,"pending","Dimensionamento para virtualização","Informar quantidade de VMs, vCPU, RAM por VM, armazenamento, IOPS, hipervisor e requisitos de alta disponibilidade.");
  addFinding(findings,"pending","Documentação oficial e homologação","Anexar datasheets e manuais dos modelos exatos. Confirmar CPU support list, QVL de memória, matriz de compatibilidade de discos/controladoras e lista de sistemas operacionais.");
  addFinding(findings,"pending","Consumo, térmica e acústica","Validar consumo em carga e pico, dissipação, airflow, limites térmicos, ruído e condições ambientais do local.");
  return findings;
}

function statusLabel(s){return ({ok:"ATENDE • TEXTO",warn:"VERIFICAR",fail:"ALERTA",pending:"PENDENTE"})[s]}
function escapeHtml(x){return String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renderFindings(findings) {
  $("findings").innerHTML = findings.map(f=>`<article class="finding"><div class="finding-top"><b>${escapeHtml(f.title)}</b><span class="status ${f.status}">${statusLabel(f.status)}</span></div><p>${escapeHtml(f.detail)}</p>${f.evidence?`<div class="evidence">Evidência: ${escapeHtml(f.evidence)}</div>`:""}</article>`).join("");
}
function runAnalysis() {
  const name=$("projectName").value.trim()||"Projeto sem nome", category=$("category").value, purpose=$("purpose").value.trim(), req=$("requirements").value.trim(), spec=$("specification").value.trim();
  if(!spec){alert("Insira a especificação proposta antes de executar a análise.");return;}
  const findings=analyze(spec,req,category);
  const counts={ok:0,warn:0,fail:0,pending:0}; findings.forEach(f=>counts[f.status]++);
  // Coverage is a measure of checks with explicit textual evidence, not a pass score.
  const coverage=Math.round(((findings.length-counts.pending)/findings.length)*100);
  $("resultTitle").textContent=name; $("resultSub").textContent=`${category}${purpose?" • "+purpose:""} • ${new Date().toLocaleString("pt-BR")}`;
  $("score").textContent=coverage+"%"; $("countOk").textContent=counts.ok; $("countWarn").textContent=counts.warn; $("countFail").textContent=counts.fail; $("countPending").textContent=counts.pending;
  renderFindings(findings);
  lastReport = `SDC SMART ENGINEER — RELATÓRIO PRELIMINAR\nProjeto: ${name}\nCategoria: ${category}\nFinalidade: ${purpose}\nData: ${new Date().toLocaleString("pt-BR")}\nÍndice de cobertura textual: ${coverage}% (não representa percentual de compatibilidade)\n\nREQUISITOS:\n${req||"Não informados"}\n\nESPECIFICAÇÃO:\n${spec}\n\nRESULTADOS:\n`+findings.map(f=>`[${statusLabel(f.status)}] ${f.title}\n${f.detail}${f.evidence?"\nEvidência: "+f.evidence:""}`).join("\n\n")+`\n\nRESSALVA: análise preliminar por regras textuais. Não certifica compatibilidade de fabricante nem substitui datasheets, QVL, manuais e testes.`;
  $("results").hidden=false; $("results").scrollIntoView({behavior:"smooth",block:"start"});
  const history=JSON.parse(localStorage.getItem("sdcHistory")||"[]"); history.unshift({name,category,date:new Date().toISOString(),report:lastReport}); localStorage.setItem("sdcHistory",JSON.stringify(history.slice(0,30)));
}
function showHistory(){ $("analysisView").hidden=true; $("historyView").hidden=false; document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.view==="history")); const h=JSON.parse(localStorage.getItem("sdcHistory")||"[]"); $("historyList").innerHTML=h.length?h.map((x,i)=>`<div class="history-item"><b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.category)} • ${new Date(x.date).toLocaleString("pt-BR")}</small><p><button class="btn secondary" data-history="${i}">Abrir relatório</button></p></div>`).join(""):'<p class="muted">Nenhuma análise salva ainda.</p>'; }
document.querySelectorAll(".nav").forEach(n=>n.addEventListener("click",()=>{if(n.dataset.view==="history")showHistory();else{$("analysisView").hidden=false;$("historyView").hidden=true;document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x===n));}}));
$("historyList").addEventListener("click",e=>{const b=e.target.closest("[data-history]");if(!b)return;const h=JSON.parse(localStorage.getItem("sdcHistory")||"[]");lastReport=h[Number(b.dataset.history)].report;alert(lastReport);});
$("sampleBtn").addEventListener("click",()=>{$("projectName").value=sample.name;$("category").value=sample.category;$("purpose").value=sample.purpose;$("requirements").value=sample.requirements;$("specification").value=sample.spec;});
$("analyzeBtn").addEventListener("click",runAnalysis);
$("copyBtn").addEventListener("click",async()=>{if(!lastReport)return;await navigator.clipboard.writeText(lastReport);$("copyBtn").textContent="Copiado ✓";setTimeout(()=>$("copyBtn").textContent="Copiar relatório",1600);});
$("downloadBtn").addEventListener("click",()=>{const blob=new Blob([lastReport],{type:"text/plain;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="SDC-SMART-ENGINEER-relatorio.txt";a.click();URL.revokeObjectURL(a.href);});
$("fileInput").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;$("fileName").textContent=f.name;const ext=f.name.split(".").pop().toLowerCase();if(["txt","csv","md","json"].includes(ext)){const content=await f.text();$("specification").value+=($("specification").value?"\n":"")+content;}else alert("Arquivo selecionado. Nesta versão, PDF/DOCX/XLSX ainda não são interpretados. Cole o texto extraído no campo de especificação.");});
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;$("installBtn").hidden=false;});
$("installBtn").addEventListener("click",async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$("installBtn").hidden=true;});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
