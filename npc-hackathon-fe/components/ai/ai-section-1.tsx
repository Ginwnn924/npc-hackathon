"use client";

import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLocationDot } from '@fortawesome/free-solid-svg-icons';
import Card from '../card/card';

const CATEGORY_MAPPING: Record<string, string[]> = {
    "1001": ["Quán Giải Khát"],
    "1002": ["Nhà Hàng Quán Ăn"],
    "1003": ["Khu Ăn Uống"],
    "2000": ["Khách Sạn", "Nhà Nghỉ"],
    "2001": ["Khách Sạn"],
    "2002": ["Nhà Nghỉ"],
    "3004": ["Cửa Hàng"],
    "4004": ["Du Lịch"],
    "4001-3": ["Văn Hóa", "Trung Tâm Văn Hóa Thể Thao"],
    "4001-4": ["Văn Hóa", "Thư Viện"],
    "4001-5": ["Văn Hóa", "Bảo Tàng"],
    "4002-2": ["Giải Trí", "Công Viên"],
    "4002-6": ["Giải Trí", "Bar Pub"],
    "4002-10": ["Giải Trí", "Bida"],
    "4002-11": ["Giải Trí", "Karaoke"],
    "4002-14": ["Giải Trí", "Khu Vui Chơi Giải Trí"],
    "4003-1": ["Làm Đẹp", "Hair Salon"],
    "4003-2": ["Làm Đẹp", "Spa"],
    "4003-3": ["Làm Đẹp", "Xông Hơi Massage"],
    "4004-1": ["Du Lịch", "Di Tích Văn Hóa Lịch Sử"],
    "4004-2": ["Du Lịch", "Danh Lam Thắng Cảnh"],
    "4004-3": ["Du Lịch", "Vườn Quốc Gia"],
    "4004-5": ["Du Lịch", "Khu Du Lịch"],
    "4004-6": ["Du Lịch", "Bãi Biển"],
    "4004-7": ["Du Lịch", "Địa Danh"],
    "4004-8": ["Du Lịch", "Điểm Du Lịch"]
};

export default function AISection() {
    const [location, setLocation] = useState('');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [suppressSuggestions, setSuppressSuggestions] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [categoryOpen, setCategoryOpen] = useState(false);
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedPlaceInfo, setSelectedPlaceInfo] = useState<{ name?: string; address?: string } | null>(null);
    const [searchResults, setSearchResults] = useState<any[] | null>(null);
    const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
    const skipInitialPersist = React.useRef(true);

    const SECTION1_KEY = 'ai:section1';

    // --- SELECTION STATES ---
    const [selectedResults, setSelectedResults] = useState<Record<string, boolean>>({});
    const [selectedPlaceMap, setSelectedPlaceMap] = useState<Record<string, any>>({});

    // --- HELPERS ---
    const labelFor = (id: string) => {
        const arr = CATEGORY_MAPPING[id];
        return arr ? (arr[1] ?? arr[0]) : id;
    };

    const normalizePlace = (raw: any) => {
        if (!raw) return null;
        const ref = raw.ref_id ?? raw.refId ?? raw.id ?? null;
        if (!ref) return null;
        return {
            ref_id: String(ref),
            name: raw.name ?? raw.display ?? raw.title ?? '',
            address: raw.address ?? raw.addr ?? raw.vicinity ?? '',
            distance: raw.distance ?? raw.dist ?? null,
            url: raw.url ?? null,
        };
    };

    // helper to extract numeric distance (used for sorting). Missing/invalid -> Infinity
    const getDistance = (r: any) => {
        const raw = r?.distance ?? r?.dist ?? null;
        const n = typeof raw === 'string' ? Number(raw) : raw;
        return typeof n === 'number' && !isNaN(n) ? n : Infinity;
    };

    // --- PERSIST FUNCTION (sửa và tối ưu) ---
    const persistSection1 = (overrides?: {
        location?: string;
        selected?: string[];
        selectedLocation?: { lat: number; lng: number } | null;
        selectedPlaceInfo?: { name?: string; address?: string } | null;
        selectedLabels?: string[];
        lastResults?: any[] | null;
    }) => {
        const baseLast = overrides?.lastResults ?? searchResults ?? null;
        let augmentedLast: any[] | null = null;

        if (Array.isArray(baseLast)) {
            augmentedLast = baseLast.map(r => {
                const id = String(r?.ref_id ?? r?.refId ?? r?.id ?? '');
                const isSel = Boolean(selectedResults[id] || selectedPlaceMap[id]);
                const norm = normalizePlace(r) ?? {
                    ref_id: id,
                    name: r?.name ?? '',
                    address: r?.address ?? '',
                    distance: r?.distance ?? null,
                };
                return { ...norm, isSelected: isSel };
            });
        }

        const payload = {
            location: overrides?.location ?? location,
            selected: overrides?.selected ?? selected,
            selectedLabels:
                overrides?.selectedLabels ??
                (overrides?.selected
                    ? overrides.selected.map(id => labelFor(id))
                    : selectedLabels),
            selectedLocation: overrides?.selectedLocation ?? selectedLocation,
            selectedPlaceInfo: overrides?.selectedPlaceInfo ?? selectedPlaceInfo,
            lastResults: augmentedLast,
        };

        localStorage.setItem(SECTION1_KEY, JSON.stringify(payload));
    };

    // --- HYDRATE STATE ---
    useEffect(() => {
        try {
            const raw = localStorage.getItem(SECTION1_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (typeof parsed !== 'object') return;

            if (parsed.selectedPlaceInfo) {
                const { name, address } = parsed.selectedPlaceInfo;
                setSelectedPlaceInfo({ name, address });
                setLocation(name || parsed.location || '');
            } else if (parsed.location) {
                setLocation(parsed.location);
            }

            if (Array.isArray(parsed.selected)) setSelected(parsed.selected);
            if (Array.isArray(parsed.selectedLabels)) setSelectedLabels(parsed.selectedLabels);
            if (parsed.selectedLocation?.lat && parsed.selectedLocation?.lng)
                setSelectedLocation(parsed.selectedLocation);

            if (Array.isArray(parsed.lastResults)) {
                const clean = parsed.lastResults.filter((r: { name: any; }) => r && r.name);
                // sort overall by distance ascending so smallest distance appears first
                const sorted = clean.slice().sort((a: any, b: any) => getDistance(a) - getDistance(b));
                setSearchResults(sorted);
            }

            setSuppressSuggestions(true);
        } catch (err) {
            console.warn('Hydrate failed', err);
        }
    }, []);

    // --- AUTO PERSIST CHANGES ---
    useEffect(() => {
        if (skipInitialPersist.current) {
            skipInitialPersist.current = false;
            return;
        }
        persistSection1();
    }, [location, selected, selectedLocation, selectedLabels, selectedPlaceInfo]);

    // --- LOAD SELECTED PLACES ---
    useEffect(() => {
        try {
            const raw = localStorage.getItem('ai:selectedPlaces');
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return;

            const rec: Record<string, boolean> = {};
            const map: Record<string, any> = {};

            parsed.forEach(v => {
                if (typeof v === 'string' || typeof v === 'number') {
                    rec[String(v)] = true;
                } else if (typeof v === 'object') {
                    const norm = normalizePlace(v);
                    if (norm) {
                        rec[norm.ref_id] = true;
                        map[norm.ref_id] = norm;
                    }
                }
            });

            setSelectedResults(rec);
            setSelectedPlaceMap(map);
        } catch (e) {
            console.warn('Failed to load selected places', e);
        }
    }, []);

    // --- CATEGORY LOGIC ---
    const toggleCategory = (id: string) => {
        setSelected(prev => {
            const next = prev.includes(id)
                ? prev.filter(c => c !== id)
                : [...prev, id];
            const labels = next.map(labelFor);
            setSelectedLabels(labels);
            persistSection1({ selected: next, selectedLabels: labels });
            return next;
        });
    };

    const groups = React.useMemo(() => {
        const m: Record<string, Array<{ id: string; label: string }>> = {};
        Object.entries(CATEGORY_MAPPING).forEach(([id, labels]) => {
            const parent = labels[0];
            const child = labels[1] ?? parent;
            if (!m[parent]) m[parent] = [];
            m[parent].push({ id, label: child });
        });
        const ordered: Record<string, Array<{ id: string; label: string }>> = {};
        Object.keys(m)
            .sort()
            .forEach(k => {
                ordered[k] = m[k];
            });
        return ordered;
    }, []);

    // --- OUTSIDE CLICK CLOSE ---
    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (categoryOpen && containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setCategoryOpen(false);
            }
        };
        document.addEventListener('click', onDoc);
        return () => document.removeEventListener('click', onDoc);
    }, [categoryOpen]);

    // --- SEARCH SUBMIT ---
    const submitPrompt = async () => {
        if (!selectedLocation) {
            alert('Vui lòng chọn vị trí bắt đầu (chọn một gợi ý)');
            return;
        }

        setLoading(true);
        setSearchResults(null);

        try {
            const payload = { location: selectedLocation, categories: selected };
            const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://127.0.0.1:8000';
            const url = `${base.replace(/\/$/, '')}/search`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(`search failed ${res.status}`);
            const data = await res.json();
            let results = Array.isArray(data) ? data : [];

            // sort by numeric distance ascending (small first). If distance missing/invalid, treat as Infinity so it appears last.
            results = results.slice().sort((a: any, b: any) => getDistance(a) - getDistance(b));

            setSearchResults(results);
            persistSection1({ lastResults: results });
        } catch (err) {
            console.warn('search error', err);
            setSearchResults([]);
        } finally {
            setLoading(false);
        }
    };

    // --- TOGGLE RESULT SELECTION ---
    const toggleResultSelected = (item: any) => {
        const refId = String(item?.ref_id ?? item?.refId ?? item?.id ?? '');
        if (!refId) return;

        setSelectedResults(prev => {
            const next = { ...prev, [refId]: !prev[refId] };
            setSelectedPlaceMap(prevMap => {
                const mapNext = { ...prevMap };
                if (next[refId]) {
                    mapNext[refId] = normalizePlace(item);
                } else {
                    delete mapNext[refId];
                }

                const arr = Object.values(mapNext);
                localStorage.setItem('ai:selectedPlaces', JSON.stringify(arr));
                persistSection1({ lastResults: searchResults });
                return mapNext;
            });
            return next;
        });
    };

    // --- DEBOUNCE ---
    const useDebounce = <T,>(value: T, delay = 350) => {
        const [debounced, setDebounced] = useState(value);
        useEffect(() => {
            const t = setTimeout(() => setDebounced(value), delay);
            return () => clearTimeout(t);
        }, [value, delay]);
        return debounced;
    };

    const debouncedLocation = useDebounce(location);

    // --- AUTOCOMPLETE ---
    useEffect(() => {
        const q = debouncedLocation.trim();
        if (suppressSuggestions || q.length < 2) {
            setSuggestions([]);
            return;
        }

        const apikey = process.env.NEXT_PUBLIC_VIETMAP_API_KEY;
        if (!apikey) return;

        let cancelled = false;
        setSuggestionsLoading(true);
        const url = `https://maps.vietmap.vn/api/autocomplete/v3?apikey=${apikey}&text=${encodeURIComponent(q)}`;
        fetch(url)
            .then(res => res.ok ? res.json() : [])
            .then((data: any) => {
                if (!cancelled) setSuggestions(Array.isArray(data) ? data : []);
            })
            .catch(() => !cancelled && setSuggestions([]))
            .finally(() => !cancelled && setSuggestionsLoading(false));

        return () => { cancelled = true; };
    }, [debouncedLocation, suppressSuggestions]);

    // --- SELECT AUTOCOMPLETE ITEM ---
    const handleSuggestionSelect = async (s: any) => {
        const val = s.display || s.name || '';
        const refid = s.ref_id || s.refId || s.ref || null;
        setLocation(val);
        persistSection1({ location: val });
        setSuggestions([]);
        setSuppressSuggestions(true);

        if (!refid) return;

        const apikey = process.env.NEXT_PUBLIC_VIETMAP_API_KEY;
        if (!apikey) return;

        try {
            const url = `https://maps.vietmap.vn/api/place/v4?apikey=${apikey}&refid=${refid}`;
            const res = await fetch(url);
            const data = await res.json();
            const lat = data?.lat ?? data?.location?.lat ?? null;
            const lng = data?.lng ?? data?.location?.lng ?? null;
            if (lat && lng) {
                const loc = { lat: Number(lat), lng: Number(lng) };
                const name = data?.name ?? val;
                const address = data?.address ?? '';
                setSelectedLocation(loc);
                setSelectedPlaceInfo({ name, address });
                persistSection1({ selectedLocation: loc, selectedPlaceInfo: { name, address }, location: val });
            }
        } catch {
            console.warn('failed to fetch place details');
        }
    };

    return (
        <section className="h-screen max-w-7xl mx-auto px-6 py-12">
            <div className="bg-white/5 border border-white/6 rounded-xl p-6 flex flex-col h-full">
                <h3 className="text-xl font-semibold text-black mb-4">Gợi ý địa điểm</h3>

                <div className="flex-1">
                    {/* Location input */}
                    <label className="block text-sm text-black/80 mb-2">Vị trí bắt đầu</label>
                    <div className="flex items-center gap-3 mb-4 relative">
                        <div className="flex items-center justify-center w-10 h-10 rounded bg-[#161853] text-white">
                            <FontAwesomeIcon icon={faLocationDot} />
                        </div>
                        <input
                            value={location}
                            onChange={e => {
                                setLocation(e.target.value);
                                // clear any previously selected place info when user edits free text
                                setSelectedPlaceInfo(null);
                                // enable suggestions again when the user types
                                setSuppressSuggestions(false);
                                // persist immediately to avoid losing input if modal closes
                                persistSection1({ location: e.target.value, selectedPlaceInfo: null });
                            }}
                            placeholder="Nhập vị trí khởi đầu của bạn"
                            className="flex-1 h-10 px-4 rounded bg-transparent border border-gray-200 placeholder-gray-400 text-black focus:outline-none"
                        />
                        {/* suggestions dropdown */}
                        {((suggestions && suggestions.length > 0) || suggestionsLoading) && (
                            <div className="absolute left-14 right-0 top-full mt-2 bg-white border border-gray-200 rounded shadow z-50 max-h-64 overflow-auto">
                                {suggestionsLoading && (
                                    <div className="p-3 text-sm text-gray-500">Đang tìm...</div>
                                )}
                                {suggestions.map((s, i) => (
                                    <button
                                        key={s.ref_id || i}
                                        type="button"
                                        onClick={() => handleSuggestionSelect(s)}
                                        className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-b-0"
                                    >
                                        <div className="text-sm font-medium text-gray-900">{s.name || s.display}</div>
                                        <div className="text-xs text-gray-500">{s.display}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="mb-4 flex items-end gap-3">
                        <div className="flex-1" ref={containerRef}>
                            {/* Categories (combo box) */}
                            <div>
                                <div className="text-sm text-black/80 mb-2">Bạn muốn loại trải nghiệm nào?</div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setCategoryOpen(v => !v)}
                                        className="w-full text-left px-3 py-2 border border-gray-200 rounded bg-white flex items-center justify-between"
                                    >
                                        <div className="text-sm text-gray-800">
                                            {selected.length === 0 ? (
                                                (selectedLabels.length > 0) ? (
                                                    <span>{selectedLabels.join(', ')}</span>
                                                ) : (
                                                    <span className="text-gray-500">Chọn loại trải nghiệm...</span>
                                                )
                                            ) : (
                                                <span>{selected.map(id => labelFor(id)).join(', ')}</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500">▾</div>
                                    </button>

                                    {categoryOpen && (
                                        <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded shadow z-40 max-h-60 overflow-auto">
                                            {Object.entries(groups).map(([parent, items]) => (
                                                <div key={parent} className="border-b last:border-b-0">
                                                    <div className="px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-700">{parent}</div>
                                                    {items.map(item => {
                                                        const active = selected.includes(item.id);
                                                        return (
                                                            <div key={item.id} className={`flex items-center gap-3 p-3 hover:bg-gray-50 border-t category-${item.id}`}>
                                                                <input
                                                                    id={`cat-${item.id}`}
                                                                    type="checkbox"
                                                                    checked={active}
                                                                    onChange={() => toggleCategory(item.id)}
                                                                    className="h-4 w-4 text-[#161853] border border-gray-300 rounded"
                                                                />
                                                                <label htmlFor={`cat-${item.id}`} className="flex-1 text-sm text-gray-800 cursor-pointer">
                                                                    <div className="font-medium">{item.label}</div>
                                                                </label>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="shrink-0">
                            <button
                                type="button"
                                onClick={submitPrompt}
                                className="px-4 py-2 bg-[#161853] text-white rounded disabled:opacity-60"
                                disabled={loading}
                            >
                                {loading ? 'Đang tìm...' : 'Tìm kiếm'}
                            </button>
                        </div>
                    </div>
                    {/* Search results area: show message when no data, otherwise render cards */}
                    <div className="mt-6 mb-6">
                        {searchResults === null ? (
                            <div className="text-sm text-gray-500">Chưa có dữ liệu. Vui lòng chọn vị trí và bấm Tìm kiếm.</div>
                        ) : (
                            <>
                                <h4 className="text-lg font-medium text-black mb-3">Kết quả tìm kiếm (click vào card để chọn)</h4>
                                {searchResults.length === 0 ? (
                                    <div className="text-sm text-gray-500">Không tìm thấy kết quả.</div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {searchResults.map((item, idx) => {
                                            const id = item.ref_id ?? item.refId ?? item.id ?? idx;
                                            const isSelected = !!selectedResults[String(id)];

                                            // normalize address & distance for display
                                            const addr = item.address ?? item.addr ?? item.vicinity ?? '';
                                            const rawDist = item.distance ?? item.dist ?? null;
                                            let distText: string | undefined = undefined;
                                            if (typeof rawDist === 'number') {
                                                // assume numeric distances are in km
                                                distText = `${rawDist.toFixed(2)} km`;
                                            } else if (rawDist != null) {
                                                distText = String(rawDist);
                                            }

                                            return (
                                                <div key={id} className="h-full">
                                                    <div
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={(e) => {
                                                            // if the user clicked a link inside the card, don't toggle selection
                                                            // (links are <a> elements inside the Card)
                                                            if ((e.target as HTMLElement).closest('a')) return;
                                                            toggleResultSelected(item);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                toggleResultSelected(item);
                                                            }
                                                        }}
                                                        className="w-full h-full rounded-lg"
                                                    >
                                                        <Card
                                                            className="w-full max-w-none"
                                                            selected={isSelected}
                                                            title={item.name || item.display}
                                                            distance={distText}
                                                            address={addr}
                                                            href={item.url || undefined}
                                                            target={item.url ? '_blank' : undefined}
                                                            rel={item.url ? 'noopener noreferrer' : undefined}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
