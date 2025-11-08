"use client";

import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import Card from '../card/card';
import Notification, { NotificationVariant } from '../notification/notification';

export default function AISectionSelected() {
    type SelectedPlace = { ref_id: string; name: string; address: string; distance: number | null };
    const [selectedPlaces, setSelectedPlaces] = useState<SelectedPlace[]>([]);
    const [prompt, setPrompt] = useState('');
    const [submittedPrompt, setSubmittedPrompt] = useState<string | null>(null);
    const [scheduling, setScheduling] = useState(false);
    const [scheduleLog, setScheduleLog] = useState<string[]>([]);
    const [scheduledPlaces, setScheduledPlaces] = useState<any[]>([]);
    const [placeStatuses, setPlaceStatuses] = useState<Record<string, { status: string; message?: string; data?: any }>>({});
    const [toasts, setToasts] = useState<Array<{ id: string; variant: NotificationVariant; message: React.ReactNode; duration?: number }>>([]);

    // ensure simple slide-down animation CSS is present
    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (document.getElementById('ai-toast-styles')) return;
        const style = document.createElement('style');
        style.id = 'ai-toast-styles';
        style.innerHTML = `
            @keyframes ai-slide-down { from { transform: translateY(-10px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
            .ai-toast-anim { animation: ai-slide-down 320ms cubic-bezier(.2,.8,.2,1) both; will-change: transform, opacity; }
            .ai-toast-fadeout { transition: opacity 240ms ease, transform 240ms ease; opacity: 0; transform: translateY(-6px); }
        `;
        document.head.appendChild(style);
    }, []);

    const normalizePlace = (raw: any): SelectedPlace | null => {
        if (!raw) return null;
        const ref = raw.ref_id ?? raw.refId ?? raw.id ?? raw.ref ?? null;
        if (ref == null) return null;
        return {
            ref_id: String(ref),
            name: raw.name ?? raw.display ?? raw.title ?? '',
            address: raw.address ?? raw.addr ?? raw.vicinity ?? '',
            distance: raw.distance ?? raw.dist ?? null,
        };
    };

    useEffect(() => {
        const load = () => {
            try {
                const raw = localStorage.getItem('ai:selectedPlaces');
                if (!raw) {
                    setSelectedPlaces([]);
                    return;
                }
                const arr = JSON.parse(raw) as any[];
                if (!Array.isArray(arr)) {
                    setSelectedPlaces([]);
                    return;
                }
                const normalized: SelectedPlace[] = arr.map(a => normalizePlace(a)).filter(Boolean) as SelectedPlace[];
                setSelectedPlaces(normalized);
            } catch (e) {
                setSelectedPlaces([]);
            }
        };

        load();

        // listen for storage events (other tabs) and update
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'ai:selectedPlaces') load();
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const persistSelected = (arr: SelectedPlace[]) => {
        try {
            localStorage.setItem('ai:selectedPlaces', JSON.stringify(arr));
        } catch (e) {
            // ignore
        }
    };

    const handleDelete = (refId: string) => {
        setSelectedPlaces(prev => {
            const next = prev.filter(p => p.ref_id !== refId);
            persistSelected(next);
            return next;
        });
    };

        const pushToast = (message: React.ReactNode, variant: NotificationVariant = 'info', duration = 4000) => {
            // log to console for testing as well as show toast
            try {
                // stringify message when it's not a string
                if (typeof message === 'string') console.log(`[toast:${variant}]`, message);
                else console.log(`[toast:${variant}]`, message);
            } catch (e) {
                // ignore logging errors
            }
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            setToasts(prev => [{ id, variant, message, duration }, ...prev]);
            return id;
        };

        const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        // persist a small marker and notify Folder via a custom window event
        const payload = { prompt, places: selectedPlaces };
        try {
            localStorage.setItem('ai:created', JSON.stringify(payload));
        } catch (err) {
            // ignore
        }
        try {
            // dispatch an event in the same tab - Folder listens for this
            window.dispatchEvent(new CustomEvent('ai:created', { detail: payload }));
        } catch (err) {
            // ignore
        }

        // placeholder behaviour: store last submitted prompt and clear input
        setSubmittedPrompt(prompt);
        setPrompt('');
        // In a real app: call backend / AI API with selectedIndices and prompt
        console.log('Submitting prompt for places', selectedPlaces, 'prompt:', prompt);
    };

    const handleSchedule = async () => {
        if (selectedPlaces.length === 0) return;
        // close modal in parent (Folder) immediately
        try {
            window.dispatchEvent(new CustomEvent('ai:closeModal'));
        } catch (e) {
            // ignore
        }

        setScheduling(true);

        const scheduleRequest = { places: selectedPlaces.map(p => ({ ref_id: p.ref_id, name: p.name, address: p.address, distance: p.distance, url: null })) };

        try {
            const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://127.0.0.1:8000';
            const url = `${base.replace(/\/$/, '')}/schedule`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scheduleRequest),
            });

            if (!response.ok) {
                const text = await response.text();
                console.error(`Request failed: ${response.status} ${text}`);
                setScheduling(false);
                return;
            }

            const reader = response.body?.getReader();
            if (!reader) {
                // not a stream: try parse full body
                const data = await response.json();
                try { console.log('[ai:schedule] full response', data); } catch (e) {}
                setScheduleLog(prev => [...prev, 'Received full response']);
                setScheduledPlaces(data.places ?? []);
                setScheduling(false);
                return;
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                // split events separated by double newline
                const parts = buffer.split('\n\n');
                // keep last part as remainder if not ending with separator
                buffer = parts.pop() || '';

                for (const part of parts) {
                    const line = part.trim();
                    if (!line) continue;
                    // expect lines like: data: {json}
                    if (line.startsWith('data: ')) {
                        try {
                            const obj = JSON.parse(line.slice(6));
                            if (obj.status === 'place_scheduled') {
                                // data.place contains ref_id or identifier
                                const placeRef = obj.place;
                                // show console and notify Folder (so toast remains after modal close)
                                pushToast(`${placeRef} đã được lập lịch`, 'success');
                                try {
                                    window.dispatchEvent(new CustomEvent('ai:toast', { detail: { id: `place-${placeRef}`, action: 'update', variant: 'success', message: `${placeRef} đã được lập lịch`, autoHide: true, duration: 3000 } }));
                                } catch (e) {}
                                setPlaceStatuses(prev => ({ ...prev, [placeRef]: { status: 'scheduled', data: obj.data } }));
                                setScheduledPlaces(prev => [...prev, obj.data]);
                            } else if (obj.status === 'ai_processing_place') {
                                const placeRef = obj.place;
                                const msg = `🤖 AI đang lập lịch cho ${obj.message || placeRef}`;
                                pushToast(msg, 'info');
                                try {
                                    // send persistent toast id so Folder can update it later
                                    window.dispatchEvent(new CustomEvent('ai:toast', { detail: { id: `place-${placeRef}`, action: 'push', variant: 'info', message: msg, autoHide: false } }));
                                } catch (e) {}
                                setPlaceStatuses(prev => ({ ...prev, [placeRef]: { status: 'processing', message: obj.message } }));
                            } else if (obj.status === 'completed') {
                                // final completed payload
                                try { console.log('[ai:scheduleCompleted]', obj); } catch (e) {}
                                pushToast('Lập lịch hoàn tất', 'success');
                                try {
                                    window.dispatchEvent(new CustomEvent('ai:toast', { detail: { id: 'ai-start', action: 'update', variant: 'success', message: 'Lập lịch hoàn tất', autoHide: true, duration: 4000 } }));
                                } catch (e) {}
                                try {
                                    localStorage.setItem('ai:scheduleResult', JSON.stringify(obj));
                                } catch (e) {
                                    // ignore
                                }
                                try {
                                    window.dispatchEvent(new CustomEvent('ai:scheduleCompleted', { detail: obj }));
                                } catch (e) {
                                    // ignore
                                }
                            } else {
                                const j = JSON.stringify(obj);
                                pushToast(j, 'info');
                                try { window.dispatchEvent(new CustomEvent('ai:toast', { detail: { action: 'push', variant: 'info', message: j, autoHide: true, duration: 4000 } })); } catch (e) {}
                            }
                        } catch (e) {
                            console.error('parse error on chunk:', e);
                        }
                    } else {
                        // unknown chunk
                        pushToast(line, 'info');
                    }
                }
            }

            // final buffer flush
            if (buffer.trim()) {
                const lines = buffer.split('\n\n');
                for (const l of lines) {
                    const line = l.trim();
                    if (!line) continue;
                    if (line.startsWith('data: ')) {
                        try {
                            const obj = JSON.parse(line.slice(6));
                            if (obj.status === 'place_scheduled') {
                                const placeRef = obj.place;
                                pushToast(`${placeRef} đã được lập lịch`, 'success');
                                try { window.dispatchEvent(new CustomEvent('ai:toast', { detail: { id: `place-${placeRef}`, action: 'update', variant: 'success', message: `${placeRef} đã được lập lịch`, autoHide: true, duration: 3000 } })); } catch (e) {}
                                setPlaceStatuses(prev => ({ ...prev, [placeRef]: { status: 'scheduled', data: obj.data } }));
                                setScheduledPlaces(prev => [...prev, obj.data]);
                            } else if (obj.status === 'ai_processing_place') {
                                const placeRef = obj.place;
                                const msg = `${obj.message || placeRef}`;
                                pushToast(msg, 'info');
                                try { window.dispatchEvent(new CustomEvent('ai:toast', { detail: { id: `place-${placeRef}`, action: 'push', variant: 'info', message: msg, autoHide: false } })); } catch (e) {}
                                setPlaceStatuses(prev => ({ ...prev, [placeRef]: { status: 'processing', message: obj.message } }));
                            } else if (obj.status === 'completed') {
                                try { console.log('[ai:scheduleCompleted]', obj); } catch (e) {}
                                pushToast('Lập lịch hoàn tất', 'success');
                                try { window.dispatchEvent(new CustomEvent('ai:toast', { detail: { id: 'ai-start', action: 'update', variant: 'success', message: 'Lập lịch hoàn tất', autoHide: true, duration: 4000 } })); } catch (e) {}
                                try { localStorage.setItem('ai:scheduleResult', JSON.stringify(obj)); } catch (e) {}
                                try { window.dispatchEvent(new CustomEvent('ai:scheduleCompleted', { detail: obj })); } catch (e) {}
                            } else {
                                const j = JSON.stringify(obj);
                                pushToast(j, 'info');
                                try { window.dispatchEvent(new CustomEvent('ai:toast', { detail: { action: 'push', variant: 'info', message: j, autoHide: true, duration: 4000 } })); } catch (e) {}
                            }
                        } catch (e) {
                            console.error('parse error on final chunk:', e);
                        }
                    } else {
                        pushToast(line, 'info');
                        try { window.dispatchEvent(new CustomEvent('ai:toast', { detail: { action: 'push', variant: 'info', message: line, autoHide: true, duration: 4000 } })); } catch (e) {}
                    }
                }
            }

        } catch (err) {
            console.error('schedule error:', err);
        } finally {
            setScheduling(false);
        }
    };

    return (
        <section className="max-w-7xl mx-auto px-6 py-8">
            {/* Toast container (top-right) */}
            <div aria-live="polite" role="status" className="fixed top-6 right-6 flex flex-col gap-2 items-end pointer-events-none" style={{ zIndex: 9999999 }}>
                {toasts.map(t => (
                    <div key={t.id} className="pointer-events-auto ai-toast-anim shadow-lg">
                        <Notification
                            id={t.id}
                            variant={t.variant}
                            message={t.message}
                            autoHide={true}
                            duration={t.duration}
                            onClose={() => removeToast(t.id)}
                        />
                    </div>
                ))}
            </div>
            <h3 className="text-lg font-semibold mb-4">Danh sách địa điểm đã chọn</h3>

            {selectedPlaces.length === 0 ? (
                <div className="text-sm text-gray-600 mb-6">Bạn chưa chọn địa điểm nào. Quay lại phần gợi ý để chọn.</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {selectedPlaces.map((p, index) => (
                        <Card
                            key={p.ref_id}
                            className="w-full max-w-none"
                            title={p.name || `Địa điểm ${index + 1}`}
                            distance={p.distance != null ? `${Number(p.distance).toFixed(2)} km` : undefined}
                            address={p.address}
                            href="#"
                            control={(
                                <button
                                    type="button"
                                    aria-label={`Xóa ${p.name}`}
                                    onClick={(e) => { e.stopPropagation(); handleDelete(p.ref_id); }}
                                    className="p-1 bg-gray-100 text-[#333333] rounded hover:bg-gray-200"
                                >
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            )}
                        />
                    ))}
                </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4">
                <label htmlFor="ai-prompt" className="block text-sm font-medium mb-2">Nhập prompt cho AI</label>
                <textarea
                    id="ai-prompt"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Mô tả yêu cầu, ví dụ: Lập lịch 3 ngày khám phá ẩm thực địa phương"
                    className="w-full min-h-[88px] p-3 border border-gray-200 rounded resize-vertical"
                />
                <div className="flex items-center justify-between mt-3">
                    <div className="text-sm text-gray-700">{selectedPlaces.length} địa điểm hiện có</div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleSchedule}
                            disabled={scheduling || selectedPlaces.length === 0}
                            className={`px-4 py-2 rounded inline-flex items-center ${scheduling ? 'bg-gray-400 text-white' : 'bg-green-600 text-white'}`}
                        >
                            {scheduling ? 'Đang lập lịch...' : 'Lập lịch'}
                        </button>

                        {submittedPrompt && <div className="text-sm text-gray-600">Đã gửi: "{submittedPrompt}"</div>}
                    </div>
                </div>
            </form>

            {/* scheduling handled by background process; logs are sent to console */}
        </section>
    );
}
