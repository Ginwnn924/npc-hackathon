"use client";

import React, { useEffect, useState } from "react";

export default function Schedule({ scheduleResult }: { scheduleResult?: any }) {
	const [data, setData] = useState<any | null>(scheduleResult ?? null);

	useEffect(() => {
		if (data) return;
		try {
			const raw = localStorage.getItem('ai:scheduleResult');
			if (raw) {
				setData(JSON.parse(raw));
			}
		} catch (err) {
			// ignore
		}
	}, [data]);

	const items: any[] | null =
		data?.result?.schedule?.schedule ?? data?.schedule?.schedule ?? data?.schedule ?? null;

	if (!items || items.length === 0) {
		return (
			<section className="relative bg-stone-50 py-24">
				<div className="w-full max-w-7xl mx-auto px-6 lg:px-8 overflow-x-auto">
					<div className="flex flex-col md:flex-row max-md:gap-3 items-center justify-between mb-5">
						<div className="flex items-center gap-4">
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
								<path d="M17 4.50001L17 5.15001L17 4.50001ZM6.99999 4.50002L6.99999 3.85002L6.99999 4.50002ZM8.05078 14.65C8.40977 14.65 8.70078 14.359 8.70078 14C8.70078 13.641 8.40977 13.35 8.05078 13.35V14.65ZM8.00078 13.35C7.6418 13.35 7.35078 13.641 7.35078 14C7.35078 14.359 7.6418 14.65 8.00078 14.65V13.35ZM8.05078 17.65C8.40977 17.65 8.70078 17.359 8.70078 17C8.70078 16.641 8.40977 16.35 8.05078 16.35V17.65ZM8.00078 16.35C7.6418 16.35 7.35078 16.641 7.35078 17C7.35078 17.359 7.6418 17.65 8.00078 17.65V16.35ZM12.0508 14.65C12.4098 14.65 12.7008 14.359 12.7008 14C12.7008 13.641 12.4098 13.35 12.0508 13.35V14.65ZM12.0008 13.35C11.6418 13.35 11.3508 13.641 11.3508 14C11.3508 14.359 11.6418 14.65 12.0008 14.65V13.35Z" fill="#111827"></path>
							</svg>
							<h6 className="text-xl leading-8 font-semibold text-gray-900">Kế hoạch chuyến đi</h6>
						</div>
					</div>
					<div className="text-gray-600">Không có dữ liệu lịch trình. Hãy tạo lịch bằng AI.</div>
				</div>
			</section>
		);
	}

	// items is an array of schedule entries
		// We'll render a single-day calendar grid (hours on the left, day column on the right)
		const hours = Array.from({ length: 12 }, (_, i) => 7 + i); // 7..18

		// helper to parse 'HH:MM' to minutes from midnight
		const parseHM = (s?: string) => {
			if (!s || typeof s !== 'string') return null;
			const m = s.match(/(\d{1,2}):(\d{2})/);
			if (!m) return null;
			const hh = parseInt(m[1], 10);
			const mm = parseInt(m[2], 10);
			return hh * 60 + mm;
		};

		// group items by start hour (for simple placement)
		const byHour: Record<number, any[]> = {};
		items.forEach((it: any) => {
			const start = parseHM(it.start_time ?? it.start ?? it.start_time ?? '');
			if (start === null) return;
			const h = Math.floor(start / 60);
			if (!byHour[h]) byHour[h] = [];
			byHour[h].push(it);
		});

		return (
			<section className="relative bg-stone-50 py-24">
				<div className="w-full max-w-7xl mx-auto px-6 lg:px-8 overflow-x-auto">
					<div className="flex flex-col md:flex-row max-md:gap-3 items-center justify-between mb-5">
						<div className="flex items-center gap-4">
							<h6 className="text-xl leading-8 font-semibold text-gray-900">Kế hoạch chuyến đi (Ngày)</h6>
						</div>
						<div className="flex items-center gap-px rounded-lg bg-gray-100 p-1">
							<button className="rounded-lg py-2.5 px-5 text-sm font-medium text-indigo-600 bg-white">Day</button>
							<button className="rounded-lg py-2.5 px-5 text-sm font-medium text-gray-500">Week</button>
							<button className="rounded-lg py-2.5 px-5 text-sm font-medium text-gray-500">Month</button>
						</div>
					</div>

					<div className="relative">
						<div className="grid grid-cols-[120px_1fr] border-t border-gray-200">
							{/* header row for day label */}
							<div className="p-3.5"></div>
							<div className="p-3.5 flex items-center justify-start text-sm font-medium text-gray-900">Today</div>
						</div>

						<div className="hidden sm:grid w-full grid-cols-[120px_1fr]">
							{/* left column: times */}
							<div className="flex flex-col">
								{hours.map(h => (
									<div key={h} className="h-20 p-0.5 md:p-3.5 border-t border-r border-gray-200 flex items-end">
										<span className="text-xs font-semibold text-gray-400">{String(h).padStart(2, '0')}:00</span>
									</div>
								))}
							</div>

							{/* right column: day column with rows where items are placed */}
							<div className="overflow-x-auto">
								<div className="flex flex-col">
									{hours.map(h => (
										<div key={h} className="h-20 p-0.5 md:p-3.5 border-t border-gray-200 relative">
											{/* put items that start in this hour */}
											{((byHour[h] || []) as any[]).map((it, idx) => {
												const start = parseHM(it.start_time ?? it.start ?? it.start_time ?? '') || 0;
												const end = parseHM(it.end_time ?? it.end ?? it.end_time ?? '') || (start + (it.duration_minutes ?? 60));
												// show a compact block with name + time
												const label = `${it.place_name ?? it.place?.name ?? it.name ?? ''} — ${it.start_time ?? it.start ?? ''}${it.end_time || it.end ? ` - ${it.end_time ?? it.end ?? ''}` : ''}`;
												return (
													<div key={idx} className="rounded p-2 border-l-2 border-indigo-600 bg-indigo-50 max-w-md">
														<p className="text-sm font-semibold text-gray-900">{it.place_name ?? it.place?.name ?? it.name}</p>
														<p className="text-xs text-gray-600 mt-1">{(it.start_time ?? it.start ?? '')}{it.end_time || it.end ? ` - ${it.end_time ?? it.end ?? ''}` : ''}</p>
													</div>
												);
											})}
										</div>
									))}
								</div>
							</div>
						</div>

						{/* mobile stacked view */}
						<div className="sm:hidden">
							<div className="flex flex-col gap-3">
								{items.map((it: any, idx: number) => (
									<div key={idx} className="p-3 bg-white rounded shadow-sm border">
										<div className="flex justify-between">
											<div className="text-sm font-semibold">{it.place_name ?? it.place?.name ?? it.name}</div>
											<div className="text-xs text-gray-500">{it.start_time ?? it.start ?? ''}{it.end_time || it.end ? ` - ${it.end_time ?? it.end ?? ''}` : ''}</div>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</section>
		);
}

