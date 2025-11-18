"use client";

import React, { useEffect } from "react";

export type NotificationVariant = "success" | "danger" | "warning" | "info";

export interface NotificationProps {
	id?: string;
	variant?: NotificationVariant;
	message: React.ReactNode;
	autoHide?: boolean;
	duration?: number; // ms
	onClose?: () => void;
}

const ICONS: Record<NotificationVariant, React.ReactElement> = {
	success: (
		<svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
			<path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z" />
		</svg>
	),
	danger: (
		<svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
			<path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 11.793a1 1 0 1 1-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L8.586 10 6.293 7.707a1 1 0 0 1 1.414-1.414L10 8.586l2.293-2.293a1 1 0 0 1 1.414 1.414L11.414 10l2.293 2.293Z" />
		</svg>
	),
	warning: (
		<svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
			<path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM10 15a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-4a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v5Z" />
		</svg>
	),
	info: (
		<svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
			<path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 12h-2v-6h2v6zm0-8h-2V4h2v2z" />
		</svg>
	)
};

const VARIANT_STYLES: Record<NotificationVariant, { iconBg: string; iconText: string }> = {
	success: { iconBg: "bg-green-100 dark:bg-green-800", iconText: "text-green-500 dark:text-green-200" },
	danger: { iconBg: "bg-red-100 dark:bg-red-800", iconText: "text-red-500 dark:text-red-200" },
	warning: { iconBg: "bg-orange-100 dark:bg-orange-700", iconText: "text-orange-500 dark:text-orange-200" },
	info: { iconBg: "bg-sky-100 dark:bg-sky-800", iconText: "text-sky-500 dark:text-sky-200" }
};

export default function Notification({ id, variant = "success", message, autoHide = true, duration = 4000, onClose }: NotificationProps) {
	useEffect(() => {
		if (!autoHide) return;
		const t = setTimeout(() => {
			onClose?.();
		}, duration);
		return () => clearTimeout(t);
	}, [autoHide, duration, onClose]);

	const styles = VARIANT_STYLES[variant];
	const containerId = id ?? `toast-${variant}`;

	return (
		<div
			id={containerId}
			role="alert"
			className="flex items-center w-full max-w-xs p-4 mb-4 text-gray-500 bg-white rounded-lg shadow-sm dark:text-gray-400 dark:bg-gray-800"
		>
			<div className={`inline-flex items-center justify-center shrink-0 w-8 h-8 ${styles.iconText} ${styles.iconBg} rounded-lg`}>
				{ICONS[variant]}
				<span className="sr-only">{variant} icon</span>
			</div>
			<div className="ml-3 text-sm font-normal">{message}</div>
			<button
				type="button"
				onClick={() => onClose?.()}
				className="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700"
				aria-label="Close"
			>
				<span className="sr-only">Close</span>
				<svg className="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
					<path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
				</svg>
			</button>
		</div>
	);
}

// Usage example (not exported):
// <Notification variant="success" message="Item moved successfully." onClose={() => setShow(false)} />

