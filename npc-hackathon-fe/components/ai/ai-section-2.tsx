"use client";

import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import Card from '../card/card';

export default function AISectionSelected() {
    type SelectedPlace = { ref_id: string; name: string; address: string; distance: number | null };
    const [selectedPlaces, setSelectedPlaces] = useState<SelectedPlace[]>([]);
    const [prompt, setPrompt] = useState('');
    const [submittedPrompt, setSubmittedPrompt] = useState<string | null>(null);

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

    return (
        <section className="max-w-7xl mx-auto px-6 py-8">
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
                            description={`${p.address}${p.distance != null ? ` — ${Number(p.distance).toFixed(2)} km` : ''}`}
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
                        <button type="submit" className="px-4 py-2 bg-[#161853] text-white rounded inline-flex items-center">
                            Gửi
                            <FontAwesomeIcon icon={faPaperPlane} className="ml-2" />
                        </button>
                        {submittedPrompt && <div className="text-sm text-gray-600">Đã gửi: "{submittedPrompt}"</div>}
                    </div>
                </div>
            </form>
        </section>
    );
}
