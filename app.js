const STORAGE_KEY = "sdc_smart_engineer_gemini_key";
const GEMINI_MODEL = "gemini-3.8-flash";

const state = {
  apiKey: localStorage.getItem(STORAGE_KEY) || "",
  conversationHistory: []
};

const elements = {
  apiKeyInput: document.getElementById("apiKeyInput"),
  saveKeyBtn: document.getElementById("saveKeyBtn"),
  keyStatus: document.getElementById("keyStatus"),
  projectType: document.getElementById("projectType"),
  specInput: document.getElementById("specInput"),
  loadExampleBtn: document.getElementById("loadExampleBtn"),
  clearBtn: document.getElementById("clearBtn"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  copyResultBtn: document.getElementById("copyResultBtn"),
  resultContainer: document.getElementById("resultContainer"),
  followupBox: document.getElementById("followupBox"),
  followupInput: document.getElementById("followupInput"),
  followupBtn: document.getElementById("followupBtn")
};

function init() {
  if (state.apiKey) {
    elements.apiKeyInput.value = state.apiKey;
    elements.keyStatus.classList.add("active");
  }

  elements.saveKeyBtn.addEventListener("click", handleSaveKey);
  elements.loadExampleBtn.addEventListener("click", handleLoadExample);
  elements.clearBtn.addEventListener("click", handleClear);
  elements.analyzeBtn.addEventListener("click", handleAnalyzeSpec);
  elements.copyResultBtn.addEventListener("click", handleCopyResult);
  elements.followupBtn.addEventListener("click", handleFollowup);

  elements.followupInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleFollowup();
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function handleSaveKey() {
  const value = elements.apiKeyInput.value.trim();
  state.apiKey = value;

  if (value) {
    localStorage.setItem(STORAGE_KEY, value);
    elements.keyStatus.classList.add("active");
    alert("Chave API salva localmente no seu navegador.");
  } else {
    localStorage.removeItem(STORAGE_KEY);
    elements.keyStatus.classList.remove("active");
    alert("Chave API removida.");
  }
}

function handleLoadExample() {
  elements.projectType.value = "embarcados";
  elements.specInput.value = `Projeto: Controlador Industrial IoT SDC-Node v1
- Alimentação principal: 24V DC (ambiente industrial com ruído de motores)
- Microcontrolador: ESP32-WROOM-32E (3.3V)
- Entradas: 4 entradas digitais 24V e 2 entradas analógicas 4-20mA
- Saídas: 2 relés eletromecânicos 5V para acionamento de carga AC
- Comunicação: RS485 Modbus RTU + Wi-Fi para envio MQTT
- Gabinete: Caixa plástica fechada IP65 sem ventilação forçada
- Requisitos faltantes ainda não definidos pelo cliente.`;
}

function handleClear() {
  elements.specInput.value = "";
  state.conversationHistory = [];
  elements.resultContainer.classList.add("empty");
  elements.resultContainer.innerHTML =
    "Especificação limpa. Insira novos dados para iniciar uma nova verificação.";
  elements.followupBox.hidden = true;
  elements.copyResultBtn.disabled = true;
}

async function handleAnalyzeSpec() {
  const specText = elements.specInput.value.trim();
  const domain = elements.projectType.options[elements.projectType.selectedIndex].text;

  if (!state.apiKey) {
    alert("Por favor, insira e salve sua Google Gemini API Key no topo da página.");
    elements.apiKeyInput.focus();
    return;
  }

  if (!specText) {
    alert("Digite ou cole uma especificação técnica antes de verificar.");
    elements.specInput.focus();
    return;
  }

  const systemPrompt = `Você é o SDC SMART ENGINEER, um Engenheiro Sênior de Hardware e Sistemas Eletrônicos.
Analise criticamente a especificação fornecida no domínio "${domain}" e responda em português técnico claro, estruturado exatamente nestas 5 seções:

1. RESUMO DA ARQUITETURA E VIABILIDADE
2. DADOS AUSENTES E LACUNAS DE ESPECIFICAÇÃO (o que precisa ser definido antes de desenhar o esquemático)
3. RISCOS ELÉTRICOS, TÉRMICOS E DE CONFORMIDADE (EMC, isolamento, queda de tensão, dissipação, níveis lógicos)
4. RECOMENDAÇÕES DE COMPONENTES E TOPOLOGIA
5. CHECKLIST DE PRÓXIMOS PASSOS PARA PROTOTIPAGEM

Especificação para análise:
${specText}`;

  state.conversationHistory = [
    {
      role: "user",
      parts: [{ text: systemPrompt }]
    }
  ];

  await executeGeminiTurn(elements.analyzeBtn, "Analisando engenharia...");
}

async function handleFollowup() {
  const question = elements.followupInput.value.trim();
  if (!question || !state.apiKey || state.conversationHistory.length === 0) return;

  elements.followupInput.value = "";
  state.conversationHistory.push({
    role: "user",
    parts: [{ text: question }]
  });

  appendMessageToOutput(`\n\n----------------------------------------\nENGENHEIRO (VOCÊ): ${question}\n----------------------------------------\n`);
  await executeGeminiTurn(elements.followupBtn, "Respondendo...");
}

async function executeGeminiTurn(triggerButton, loadingLabel) {
  const originalLabel = triggerButton.textContent;
  triggerButton.disabled = true;
  triggerButton.textContent = loadingLabel;

  if (state.conversationHistory.length === 1) {
    elements.resultContainer.classList.remove("empty");
    elements.resultContainer.textContent = "Conectando à IA do Google e auditando requisitos de hardware...";
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(state.apiKey)}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: state.conversationHistory,
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 4096
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `Erro HTTP ${response.status} na API do Google.`);
    }

    const aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiReply) {
      throw new Error("A API retornou uma resposta vazia.");
    }

    state.conversationHistory.push({
      role: "model",
      parts: [{ text: aiReply }]
    });

    if (state.conversationHistory.length === 2) {
      elements.resultContainer.textContent = aiReply;
    } else {
      appendMessageToOutput(aiReply);
    }

    elements.followupBox.hidden = false;
    elements.copyResultBtn.disabled = false;
  } catch (error) {
    state.conversationHistory.pop();
    const errorMsg = `Falha na execução: ${error.message}\nVerifique se sua API Key do Google AI Studio está correta e ativa.`;
    if (state.conversationHistory.length === 0) {
      elements.resultContainer.textContent = errorMsg;
    } else {
      appendMessageToOutput(`\n[ERRO]: ${errorMsg}`);
    }
  } finally {
    triggerButton.disabled = false;
    triggerButton.textContent = originalLabel;
  }
}

function appendMessageToOutput(text) {
  elements.resultContainer.textContent += text;
  elements.resultContainer.scrollTop = elements.resultContainer.scrollHeight;
}

async function handleCopyResult() {
  try {
    await navigator.clipboard.writeText(elements.resultContainer.textContent);
    const prev = elements.copyResultBtn.textContent;
    elements.copyResultBtn.textContent = "Copiado!";
    setTimeout(() => {
      elements.copyResultBtn.textContent = prev;
    }, 2000);
  } catch {
    alert("Não foi possível copiar automaticamente.");
  }
}

init();
