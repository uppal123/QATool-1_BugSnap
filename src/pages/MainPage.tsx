import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './MainPage.css';

export default function MainPage() {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; issueKey?: string; issueUrl?: string; error?: string; bugReport?: any } | null>(null);
    const [dragActive, setDragActive] = useState(false);

    const handleFile = useCallback((f: File) => {
        setFile(f);
        setResult(null);
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(f);
    }, []);

    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragActive(true); };
    const onDragLeave = () => setDragActive(false);
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        const f = e.dataTransfer.files[0];
        if (f && f.type.startsWith('image/')) handleFile(f);
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) handleFile(f);
    };

    const handleSubmit = async () => {
        if (!file) return;
        setLoading(true);
        setResult(null);
        try {
            const formData = new FormData();
            formData.append('screenshot', file);
            formData.append('notes', notes);
            const res = await fetch('/api/analyze-and-push', { method: 'POST', body: formData });
            const data = await res.json();
            setResult(data);
        } catch (err: any) {
            setResult({ ok: false, error: err.message || 'Network error' });
        } finally {
            setLoading(false);
        }
    };

    const clearFile = () => {
        setFile(null);
        setPreview(null);
        setResult(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="main-page">
            <div className="container">
                {/* Header */}
                <header className="main-header">
                    <div className="header-left">
                        <div className="logo-icon">🐛</div>
                        <div>
                            <h1 className="header-title">Bug Report Enhancer</h1>
                            <p className="header-subtitle">Drop a screenshot → AI analyzes → Jira ticket created</p>
                        </div>
                    </div>
                    <button
                        id="settings-button"
                        className="btn btn-secondary settings-btn"
                        onClick={() => navigate('/settings')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                        Settings
                    </button>
                </header>

                {/* Drop Zone */}
                <div
                    id="drop-zone"
                    className={`drop-zone ${dragActive ? 'drag-active' : ''} ${preview ? 'has-preview' : ''}`}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={() => !preview && fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={onFileChange}
                        style={{ display: 'none' }}
                        id="file-input"
                    />

                    {preview ? (
                        <div className="preview-container">
                            <img src={preview} alt="Screenshot preview" className="preview-image" />
                            <button className="clear-btn" onClick={(e) => { e.stopPropagation(); clearFile(); }} title="Remove screenshot">
                                ✕
                            </button>
                        </div>
                    ) : (
                        <div className="drop-placeholder">
                            <div className="drop-icon">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                </svg>
                            </div>
                            <p className="drop-text">Drag and Drop Screenshot</p>
                            <p className="drop-subtext">or click to browse</p>
                        </div>
                    )}
                </div>

                {/* Additional Notes */}
                <div className="form-group notes-section">
                    <label htmlFor="notes-input" className="form-label">Additional Notes</label>
                    <textarea
                        id="notes-input"
                        className="form-input"
                        placeholder="Describe the bug, steps to reproduce, expected behavior..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={4}
                    />
                </div>

                {/* Submit Button */}
                <button
                    id="analyze-button"
                    className="btn btn-primary submit-btn"
                    onClick={handleSubmit}
                    disabled={!file || loading}
                >
                    {loading ? (
                        <>
                            <div className="spinner" />
                            Analysing & creating Jira ticket...
                        </>
                    ) : (
                        <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                                <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                            </svg>
                            Create Jira Ticket
                        </>
                    )}
                </button>

                {result && (
                    <div className={`status-message ${result.ok ? 'status-success' : 'status-error'}`} id="result-message">
                        {result.ok ? (
                            <div className="result-content">
                                <span className="result-icon">✅</span>
                                <div className="result-details">
                                    <strong>Jira ticket created successfully!</strong>
                                    {result.issueKey && (
                                        <div className="ticket-badge">
                                            <span className="badge-label">Bug ID:</span>
                                            <span className="badge-value">{result.issueKey}</span>
                                        </div>
                                    )}
                                    {result.bugReport?.title && (
                                        <div className="ticket-title">
                                            <span className="title-label">Title:</span> {result.bugReport.title}
                                        </div>
                                    )}
                                    {result.issueUrl && (
                                        <a
                                            href={result.issueUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ticket-link"
                                        >
                                            🔗 Open {result.issueKey || 'ticket'} in Jira →
                                        </a>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="result-content">
                                <span className="result-icon">❌</span>
                                <span>{result.error}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
