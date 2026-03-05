import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

const SETTINGS_FILE = path.join(__dirname, 'settings.json');

// ─── Settings helpers ───────────────────────────────────────────
interface Settings {
    jiraProject: string;
    jiraEmail: string;
    jiraApiKey: string;
    jiraUrl: string;
    jiraIssueType: string;
    groqApiKey: string;
}

function loadSettings(): Settings {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        }
    } catch { /* ignore */ }
    return { jiraProject: '', jiraEmail: '', jiraApiKey: '', jiraUrl: '', jiraIssueType: 'Bug', groqApiKey: '' };
}

function saveSettings(s: Settings) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf-8');
}

// ─── GET /api/settings ──────────────────────────────────────────
app.get('/api/settings', (_req, res) => {
    res.json(loadSettings());
});

// ─── POST /api/settings ─────────────────────────────────────────
app.post('/api/settings', (req, res) => {
    const s: Settings = req.body;
    saveSettings(s);
    res.json({ ok: true });
});

// ─── POST /api/test-jira ────────────────────────────────────────
app.post('/api/test-jira', async (req, res) => {
    try {
        const { jiraUrl, jiraEmail, jiraApiKey, jiraProject } = req.body as Settings;
        if (!jiraUrl || !jiraEmail || !jiraApiKey || !jiraProject) {
            res.status(400).json({ ok: false, error: 'Missing Jira settings' });
            return;
        }
        const base = jiraUrl.replace(/\/+$/, '');
        const auth = Buffer.from(`${jiraEmail}:${jiraApiKey}`).toString('base64');
        // Try v2 first (most compatible), fall back to v3
        let response;
        try {
            response = await axios.get(`${base}/rest/api/2/project/${jiraProject}`, {
                headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
                timeout: 10000,
            });
        } catch {
            response = await axios.get(`${base}/rest/api/3/project/${jiraProject}`, {
                headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
                timeout: 10000,
            });
        }
        console.log('Jira test-connection response:', JSON.stringify(response.data, null, 2));
        res.json({ ok: true, projectName: response.data.name || response.data.key });
    } catch (err: any) {
        console.error('test-jira error:', err.response?.data || err.message);
        const msg = err.response?.data?.errorMessages?.[0] || err.message || 'Connection failed';
        res.status(400).json({ ok: false, error: msg });
    }
});

// ─── POST /api/test-groq ────────────────────────────────────────
app.post('/api/test-groq', async (req, res) => {
    try {
        const { groqApiKey } = req.body as Settings;
        if (!groqApiKey) {
            res.status(400).json({ ok: false, error: 'Missing Groq API key' });
            return;
        }
        const groq = new Groq({ apiKey: groqApiKey });
        const chat = await groq.chat.completions.create({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [{ role: 'user', content: 'Say "connected" in one word.' }],
            max_tokens: 10,
        });
        res.json({ ok: true, reply: chat.choices[0]?.message?.content?.trim() });
    } catch (err: any) {
        res.status(400).json({ ok: false, error: err.message || 'Connection failed' });
    }
});

// ─── POST /api/analyze-and-push ─────────────────────────────────
app.post('/api/analyze-and-push', upload.single('screenshot'), async (req, res) => {
    try {
        const settings = loadSettings();
        if (!settings.groqApiKey) {
            res.status(400).json({ ok: false, error: 'Groq API key not configured. Go to Settings.' });
            return;
        }
        if (!settings.jiraUrl || !settings.jiraEmail || !settings.jiraApiKey || !settings.jiraProject) {
            res.status(400).json({ ok: false, error: 'Jira settings incomplete. Go to Settings.' });
            return;
        }

        const file = req.file;
        if (!file) {
            res.status(400).json({ ok: false, error: 'No screenshot uploaded' });
            return;
        }

        const additionalNotes = req.body.notes || '';
        const base64Image = file.buffer.toString('base64');
        const mimeType = file.mimetype || 'image/png';

        // ── Step 1: Analyze with Groq Llama Scout ──
        const groq = new Groq({ apiKey: settings.groqApiKey });
        const chat = await groq.chat.completions.create({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `You are a senior QA engineer. Analyze the following screenshot of a software bug and produce a structured bug report in this exact JSON format:
{
  "title": "Short, descriptive bug title",
  "description": "Detailed description of the bug visible in the screenshot",
  "stepsToReproduce": "Numbered steps to reproduce the bug based on what you see",
  "expectedBehavior": "What should happen instead",
  "actualBehavior": "What is actually happening as seen in the screenshot",
  "severity": "Critical | Major | Minor | Trivial"
}

${additionalNotes ? `Additional context from the reporter: ${additionalNotes}` : ''}

Respond ONLY with valid JSON, no markdown fences or extra text.`,
                        },
                        {
                            type: 'image_url',
                            image_url: { url: `data:${mimeType};base64,${base64Image}` },
                        },
                    ],
                },
            ],
            max_tokens: 1024,
        });

        const aiRaw = chat.choices[0]?.message?.content?.trim() || '';
        let bugReport: any;
        try {
            // Try to parse the JSON response, stripping markdown fences if present
            const cleaned = aiRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            bugReport = JSON.parse(cleaned);
        } catch {
            bugReport = {
                title: 'Bug found in screenshot',
                description: aiRaw,
                stepsToReproduce: 'See screenshot',
                expectedBehavior: 'N/A',
                actualBehavior: 'See screenshot',
                severity: 'Major',
            };
        }

        // ── Step 2: Create Jira ticket ──
        const jiraBase = settings.jiraUrl.replace(/\/+$/, '');
        const auth = Buffer.from(`${settings.jiraEmail}:${settings.jiraApiKey}`).toString('base64');

        // Build plain-text description (API v2 compatible)
        const descriptionText = [
            `*Description:*`,
            bugReport.description,
            ``,
            `*Steps to Reproduce:*`,
            bugReport.stepsToReproduce,
            ``,
            `*Expected Behavior:*`,
            bugReport.expectedBehavior,
            ``,
            `*Actual Behavior:*`,
            bugReport.actualBehavior,
            ``,
            `*Severity:* ${bugReport.severity}`,
            ...(additionalNotes ? [``, `*Additional Notes:*`, additionalNotes] : []),
        ].join('\n');

        const jiraPayload = {
            fields: {
                project: { key: settings.jiraProject },
                summary: bugReport.title,
                description: descriptionText,
                issuetype: { name: settings.jiraIssueType || 'Bug' },
            },
        };

        console.log('Creating Jira issue with payload:', JSON.stringify(jiraPayload, null, 2));

        // Use API v2 (most compatible with all Jira versions)
        const jiraRes = await axios.post(`${jiraBase}/rest/api/2/issue`, jiraPayload, {
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            timeout: 15000,
        });

        console.log('Jira API response:', JSON.stringify(jiraRes.data, null, 2));

        const issueKey = jiraRes.data.key || jiraRes.data.id || '';
        const issueSelf = jiraRes.data.self || '';
        const issueUrl = issueKey
            ? `${jiraBase}/browse/${issueKey}`
            : issueSelf || jiraBase;

        // ── Step 3: Attach screenshot to the Jira issue ──
        try {
            const FormData = (await import('form-data')).default;
            const form = new FormData();
            form.append('file', file.buffer, { filename: file.originalname || 'screenshot.png', contentType: mimeType });

            await axios.post(`${jiraBase}/rest/api/2/issue/${issueKey}/attachments`, form, {
                headers: {
                    Authorization: `Basic ${auth}`,
                    'X-Atlassian-Token': 'no-check',
                    ...form.getHeaders(),
                },
                timeout: 15000,
            });
        } catch {
            // Attachment is best-effort; don't fail the whole flow
        }

        res.json({
            ok: true,
            issueKey,
            issueUrl,
            bugReport,
        });
    } catch (err: any) {
        console.error('analyze-and-push error:', err.response?.data || err.message);
        let msg = 'Something went wrong';
        if (err.response?.data?.errorMessages?.length) {
            msg = err.response.data.errorMessages.join(', ');
        } else if (err.response?.data?.errors) {
            msg = JSON.stringify(err.response.data.errors);
        } else if (err.message) {
            msg = err.message;
        }
        res.status(500).json({ ok: false, error: msg });
    }
});

app.listen(PORT, () => {
    console.log(`🐛 BugSnap server running on http://localhost:${PORT}`);
});
