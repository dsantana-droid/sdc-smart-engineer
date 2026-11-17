# SDC SMART ENGINEER — versão inicial 0.1.0

## O que está funcional
- PWA instalável e interface responsiva.
- Execução local de verificações textuais preliminares.
- Identificação de itens pendentes, riscos e dados ausentes.
- Histórico local no navegador.
- Exportação do relatório em TXT.
- Funcionamento offline após o primeiro carregamento.

## Limitações importantes
Esta versão não consulta datasheets online, não interpreta PDF/DOCX/XLSX e não certifica compatibilidade. O índice exibido mede cobertura de evidências textuais detectadas, não percentual de conformidade. Não use um resultado sem alertas como aprovação técnica final.

## Publicação gratuita de interface
1. Extraia o ZIP.
2. Crie um repositório público no GitHub chamado `sdc-smart-engineer`.
3. Envie todos os arquivos e pastas desta pasta para a raiz do repositório.
4. Abra Settings > Pages.
5. Em Build and deployment, escolha Deploy from a branch.
6. Selecione `main` e `/ (root)`, depois Save.
7. Aguarde a publicação e abra a URL fornecida pelo GitHub Pages.

Para testar localmente, use um servidor HTTP local. Service Workers e instalação PWA não funcionam corretamente abrindo o arquivo `index.html` diretamente por `file://`.

## Próxima etapa de arquitetura
Para IA híbrida real, implementar backend seguro (ex.: Python/FastAPI) com:
- endpoint de análise;
- chave de API mantida exclusivamente no servidor;
- extração de PDF/DOCX/XLSX;
- base versionada de componentes e documentos oficiais;
- regras determinísticas por categoria;
- respostas estruturadas com evidências, URLs, data e nível de confiança;
- trilha de auditoria e aprovação humana.

Nunca colocar segredo/API key no JavaScript do navegador ou em repositório público.
