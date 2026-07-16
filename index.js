const express = require("express");
const fs = require("fs");
const path = require("path");

const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const app = express();

app.use(express.json({ limit: "20mb" }));

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

        if (API_KEY) {

            const key = req.headers["x-api-key"];

            if (key !== API_KEY) {
                return res.status(401).json({
                    error: "API Key inválida."
                });
            }

        }

        console.log("====================================");
        console.log("Nova requisição");

        // Aceita objeto OU array (padrão do n8n quando necessário)
        let body = req.body;

        if (Array.isArray(body)) {

            if (body.length === 0) {

                return res.status(400).json({
                    error: "Array recebido vazio."
                });

            }

            body = body[0];

            console.log("Recebido array. Utilizando primeiro item.");

        }

        console.log(JSON.stringify(body, null, 2));

        if (!body.template) {

            return res.status(400).json({
                error: "Campo 'template' é obrigatório."
            });

        }

        // Aceita com ou sem .docx
        const templateName = body.template
            .replace(/\.docx$/i, "")
            .trim();

        const templatePath = path.join(
            TEMPLATE_FOLDER,
            `${templateName}.docx`
        );

        console.log("Template:", templatePath);

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

        doc.render(data);

        const buffer = doc.getZip().generate({
            type: "nodebuffer",
            compression: "DEFLATE"
        });

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${templateName}.docx"`
        );

        return res.send(buffer);

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            error: error.message,
            stack: error.stack
        });

    }

});

app.listen(PORT, () => {

    console.log(`Document Service iniciado na porta ${PORT}`);
    console.log(`Templates: ${TEMPLATE_FOLDER}`);

});
