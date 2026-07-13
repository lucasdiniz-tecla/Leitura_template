const express = require("express");
const fs = require("fs");
const path = require("path");

const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const app = express();

app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 3000;
const TEMPLATE_FOLDER = process.env.TEMPLATE_FOLDER || path.join(__dirname, "templates");
const API_KEY = process.env.API_KEY;

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

        const body = req.body;

        if (!body.template) {

            return res.status(400).json({
                error: "Campo template é obrigatório."
            });

        }

        const templatePath = path.join(
            TEMPLATE_FOLDER,
            `${body.template}.docx`
        );

        if (!fs.existsSync(templatePath)) {

            return res.status(404).json({
                error: "Template não encontrado."
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
            `attachment; filename="${body.template}.docx"`
        );

        res.send(buffer);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });

    }

});

app.listen(PORT, () => {

    console.log(`Document Service iniciado na porta ${PORT}`);

});