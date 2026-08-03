const express = require("express");
const fs = require("fs");
const path = require("path");

const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const app = express();

app.use(express.json({ limit: "50mb" }));

const PORT = process.env.PORT || 3000;
const TEMPLATE_FOLDER =
    process.env.TEMPLATE_FOLDER || path.join(__dirname, "template");

const API_KEY = process.env.API_KEY;

app.get("/", (req, res) => {
    res.json({
        service: "Document Service",
        status: "online"
    });
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    });
});

app.post("/generate", (req, res) => {
    try {
        // Validação de API Key se configurada
        if (API_KEY) {
            const key = req.headers["x-api-key"];
            if (key !== API_KEY) {
                return res.status(401).json({ error: "API Key inválida." });
            }
        }

        console.log("====================================");
        console.log("Nova requisição de geração de documento");

        let body = req.body;

        // Se o n8n enviar um array, pega o primeiro item
        if (Array.isArray(body)) {
            if (body.length === 0) {
                return res.status(400).json({ error: "Array recebido vazio." });
            }
            body = body[0];
            console.log("Recebido Array do n8n. Utilizando o primeiro item.");
        }

        console.log("Payload recebido:\n", JSON.stringify(body, null, 2));

        if (!body.template) {
            return res.status(400).json({ error: "Campo 'template' é obrigatório." });
        }

        const templateName = body.template.replace(/\.docx$/i, "").trim();
        const templatePath = path.join(TEMPLATE_FOLDER, `${templateName}.docx`);

        console.log("Template solicitado:", templatePath);

        if (!fs.existsSync(templatePath)) {
            return res.status(404).json({
                error: "Template não encontrado.",
                template: templateName,
                caminho: templatePath,
                templatesDisponiveis: fs.readdirSync(TEMPLATE_FOLDER)
            });
        }

        const content = fs.readFileSync(templatePath, "binary");
        const zip = new PizZip(content);

        // Instancia o Docxtemplater com suporte a loops em tabelas e quebras de linha
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: {
                start: "{{",
                end: "}}"
            }
        });

        const data = { ...body };
        delete data.template;

        // Renderiza o documento substituindo variáveis e expandindo o loop da tabela
        doc.render(data);

        const buffer = doc.getZip().generate({
            type: "nodebuffer",
            compression: "DEFLATE"
        });

        // Formatação do nome do arquivo em MAIÚSCULO
        const rawNome = body.nome_empresa || body.nome_completo || body.numero_contrato || "DOCUMENTO";
        const nomeLimpo = String(rawNome)
            .toUpperCase()
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
            .trim();

        const nomeArquivo = `CONTRATO - ${nomeLimpo}.docx`;

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${nomeArquivo}"`
        );

        return res.send(buffer);

    } catch (error) {
        console.error("Erro na geração:", error);

        if (error.properties && error.properties.errors) {
            return res.status(500).json({
                error: "Erro na sintaxe de tags do Template Docx.",
                detalhes: error.properties.errors
            });
        }

        return res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

app.listen(PORT, () => {
    console.log(`Document Service rodando na porta ${PORT}`);
    console.log(`Diretório de Templates: ${TEMPLATE_FOLDER}`);
});
