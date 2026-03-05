import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SettingsPage.css';

interface Settings {
    jiraProject: string;
    jiraEmail: string;
    jiraApiKey: string;
    jiraUrl: string;
    jiraIssueType: string;
    groqApiKey: string;
}

const DEFAULT_SETTINGS: Settings = {
    jiraProject: '',
    jiraEmail: '',
    jiraApiKey: '',
    jiraUrl: '',
    jiraIssueType: 'Bug',
    groqApiKey: '',
};

type TestStatus = { state: 'idle' | 'loading' | 'success' | 'error'; message: string };

export default function SettingsPage() {
    const navigate = useNavigate();
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<TestStatus>({ state: 'idle', message: '' });
    const [jiraTest, setJiraTest] = useState<TestStatus>({ state: 'idle', message: '' });
    const [groqTest, setGroqTest] = useState<TestStatus>({ state: 'idle', message: '' });

    useEffect(() => {
        fetch('/api/settings')
            .then((r) => r.json())
            .then((data) => setSettings({ ...DEFAULT_SETTINGS, ...data }))
            .catch(() => { });
    }, []);

    const update = (key: keyof Settings, value: string) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveStatus({ state: 'idle', message: '' });
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            if (res.ok) {
                setSaveStatus({ state: 'success', message: 'Settings saved successfully!' });
            } else {
                setSaveStatus({ state: 'error', message: 'Failed to save settings' });
            }
        } catch {
            setSaveStatus({ state: 'error', message: 'Network error' });
        } finally {
            setSaving(false);
        }
    };

    const testJira = async () => {
        setJiraTest({ state: 'loading', message: 'Testing Jira connection...' });
        try {
            const res = await fetch('/api/test-jira', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            const data = await res.json();
            if (data.ok) {
                setJiraTest({ state: 'success', message: `Connected! Project: ${data.projectName}` });
            } else {
                setJiraTest({ state: 'error', message: data.error || 'Connection failed' });
            }
        } catch (err: any) {
            setJiraTest({ state: 'error', message: err.message || 'Network error' });
        }
    };

    const testGroq = async () => {
        setGroqTest({ state: 'loading', message: 'Testing Groq connection...' });
        try {
            const res = await fetch('/api/test-groq', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            const data = await res.json();
            if (data.ok) {
                setGroqTest({ state: 'success', message: `Connected! Model replied: "${data.reply}"` });
            } else {
                setGroqTest({ state: 'error', message: data.error || 'Connection failed' });
            }
        } catch (err: any) {
            setGroqTest({ state: 'error', message: err.message || 'Network error' });
        }
    };

    return (
        <div className="settings-page">
            <div className="container">
                {/* Header */}
                <header className="settings-header">
                    <button className="btn btn-secondary back-btn" onClick={() => navigate('/')} id="back-button">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                        Back
                    </button>
                    <h1 className="settings-title">Settings</h1>
                    <div style={{ width: 80 }} />
                </header>

                {/* Jira Connection Details */}
                <section className="card settings-section">
                    <div className="section-header">
                        <div className="section-icon jira-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84H11.53zM6.77 6.8a4.36 4.36 0 0 0 4.34 4.34h1.8v1.72a4.36 4.36 0 0 0 4.34 4.34V7.63a.84.84 0 0 0-.84-.84H6.77zM2 11.6a4.35 4.35 0 0 0 4.34 4.34h1.8v1.72a4.35 4.35 0 0 0 4.35 4.34V12.44a.84.84 0 0 0-.84-.84H2z" />
                            </svg>
                        </div>
                        <h2 className="section-title">Jira Connection Details</h2>
                    </div>

                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="jira-project" className="form-label">Project Key</label>
                            <input
                                id="jira-project"
                                className="form-input"
                                placeholder="e.g. VWO"
                                value={settings.jiraProject}
                                onChange={(e) => update('jiraProject', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="jira-email" className="form-label">Email</label>
                            <input
                                id="jira-email"
                                type="email"
                                className="form-input"
                                placeholder="your-email@company.com"
                                value={settings.jiraEmail}
                                onChange={(e) => update('jiraEmail', e.target.value)}
                            />
                        </div>

                        <div className="form-group full-width">
                            <label htmlFor="jira-api-key" className="form-label">API Key / Token</label>
                            <input
                                id="jira-api-key"
                                type="password"
                                className="form-input"
                                placeholder="Your Atlassian API token"
                                value={settings.jiraApiKey}
                                onChange={(e) => update('jiraApiKey', e.target.value)}
                            />
                        </div>

                        <div className="form-group full-width">
                            <label htmlFor="jira-url" className="form-label">Jira Connection URL</label>
                            <input
                                id="jira-url"
                                className="form-input"
                                placeholder="https://bugs.atlassian.net"
                                value={settings.jiraUrl}
                                onChange={(e) => update('jiraUrl', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="jira-issue-type" className="form-label">Issue Type</label>
                            <input
                                id="jira-issue-type"
                                className="form-input"
                                placeholder="Bug"
                                value={settings.jiraIssueType}
                                onChange={(e) => update('jiraIssueType', e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        id="test-jira-button"
                        className="btn btn-outline test-btn"
                        onClick={testJira}
                        disabled={jiraTest.state === 'loading'}
                    >
                        {jiraTest.state === 'loading' ? <><div className="spinner" /> Testing...</> : '🔗 Test Jira Connection'}
                    </button>

                    {jiraTest.state !== 'idle' && jiraTest.state !== 'loading' && (
                        <div className={`status-message ${jiraTest.state === 'success' ? 'status-success' : 'status-error'}`}>
                            {jiraTest.state === 'success' ? '✅' : '❌'} {jiraTest.message}
                        </div>
                    )}
                </section>

                {/* Groq API Key */}
                <section className="card settings-section">
                    <div className="section-header">
                        <div className="section-icon groq-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                <path d="M2 17l10 5 10-5" />
                                <path d="M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <h2 className="section-title">Groq API Key</h2>
                    </div>

                    <div className="form-group">
                        <label htmlFor="groq-api-key" className="form-label">API Key</label>
                        <input
                            id="groq-api-key"
                            type="password"
                            className="form-input"
                            placeholder="gsk_..."
                            value={settings.groqApiKey}
                            onChange={(e) => update('groqApiKey', e.target.value)}
                        />
                        <p className="form-hint">
                            Uses <strong>Llama 4 Scout</strong> (meta-llama/llama-4-scout-17b-16e-instruct) — free tier
                        </p>
                    </div>

                    <button
                        id="test-groq-button"
                        className="btn btn-outline test-btn"
                        onClick={testGroq}
                        disabled={groqTest.state === 'loading'}
                    >
                        {groqTest.state === 'loading' ? <><div className="spinner" /> Testing...</> : '🧠 Test Groq Connection'}
                    </button>

                    {groqTest.state !== 'idle' && groqTest.state !== 'loading' && (
                        <div className={`status-message ${groqTest.state === 'success' ? 'status-success' : 'status-error'}`}>
                            {groqTest.state === 'success' ? '✅' : '❌'} {groqTest.message}
                        </div>
                    )}
                </section>

                {/* Save Button */}
                <div className="save-section">
                    <button
                        id="save-button"
                        className="btn btn-primary save-btn"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? <><div className="spinner" /> Saving...</> : '💾 Save Settings'}
                    </button>

                    {saveStatus.state !== 'idle' && (
                        <div className={`status-message ${saveStatus.state === 'success' ? 'status-success' : 'status-error'}`}>
                            {saveStatus.state === 'success' ? '✅' : '❌'} {saveStatus.message}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
