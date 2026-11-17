const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.8-flash-lite"];

async function executeGeminiTurn(triggerButton, loadingLabel) {
  const originalLabel = triggerButton.textContent;
  triggerButton.disabled = true;
  triggerButton.textContent = loadingLabel;

  if (state.conversationHistory.length === 1) {
    elements.resultContainer.classList.remove("empty");
    elements.resultContainer.textContent = "Conectando à IA do Google e auditando requisitos de hardware...";
  }

  let lastError = null;

  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const currentModel = GEMINI_MODELS[i];
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${encodeURIComponent(state.apiKey)}`;

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
        const msg = data.error?.message || `Erro HTTP ${response.status}`;
        if ((response.status === 503 || response.status === 429) && i < GEMINI_MODELS.length - 1) {
          elements.resultContainer.textContent = `Alta demanda no modelo principal. Alternando automaticamente para ${GEMINI_MODELS[i + 1]}...`;
          continue;
        }
        throw new Error(msg);
      }

      const aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiReply) throw new Error("A API retornou uma resposta vazia.");

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
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    state.conversationHistory.pop();
    const errorMsg = `Falha na execução: ${lastError.message}\nAguarde alguns segundos e tente novamente.`;
    if (state.conversationHistory.length === 0) {
      elements.resultContainer.textContent = errorMsg;
    } else {
      appendMessageToOutput(`\n[ERRO]: ${errorMsg}`);
    }
  }

  triggerButton.disabled = false;
  triggerButton.textContent = originalLabel;
}
