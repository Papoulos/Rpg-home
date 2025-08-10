import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const MarkdownPage = () => {
    const [markdownText, setMarkdownText] = useState('');
    const [isEditMode, setIsEditMode] = useState(true);

    // Load saved text from localStorage on initial render
    useEffect(() => {
        try {
            const savedText = localStorage.getItem('markdownNotes');
            if (savedText) {
                setMarkdownText(savedText);
            } else {
                // Set a default value if nothing is saved
                setMarkdownText('# Your Notes\n\nStart typing here...');
            }
        } catch (error) {
            console.error("Failed to load notes from local storage", error);
            setMarkdownText('# Your Notes\n\nCould not load saved notes.');
        }
    }, []);

    // Save text to localStorage when it changes, with a debounce
    useEffect(() => {
        const handler = setTimeout(() => {
            try {
                localStorage.setItem('markdownNotes', markdownText);
            } catch (error) {
                console.error("Failed to save notes to local storage", error);
            }
        }, 500); // Debounce saving by 500ms

        // Cleanup function to clear the timeout if the component unmounts or text changes again
        return () => {
            clearTimeout(handler);
        };
    }, [markdownText]);

    const getSanitizedHtml = (text) => {
        const rawMarkup = marked(text, { breaks: true, gfm: true });
        return { __html: DOMPurify.sanitize(rawMarkup) };
    };

    const styles = {
        container: { padding: '10px', fontFamily: 'sans-serif', height: '100%', display: 'flex', flexDirection: 'column' },
        header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexShrink: 0 },
        toggleButton: { padding: '8px 16px', cursor: 'pointer', borderRadius: '8px', border: '1px solid #ccc' },
        editor: {
            width: '100%',
            flexGrow: 1,
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '10px',
            fontFamily: 'monospace',
            boxSizing: 'border-box',
            resize: 'none'
        },
        preview: {
            width: '100%',
            flexGrow: 1,
            border: '1px solid #eee',
            borderRadius: '8px',
            padding: '10px',
            overflowY: 'auto',
            boxSizing: 'border-box'
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2>Markdown Notes</h2>
                <button onClick={() => setIsEditMode(!isEditMode)} style={styles.toggleButton}>
                    {isEditMode ? 'View' : 'Edit'}
                </button>
            </div>
            {isEditMode ? (
                <textarea
                    value={markdownText}
                    onChange={(e) => setMarkdownText(e.target.value)}
                    style={styles.editor}
                />
            ) : (
                <div
                    style={styles.preview}
                    dangerouslySetInnerHTML={getSanitizedHtml(markdownText)}
                />
            )}
        </div>
    );
};

export default MarkdownPage;
