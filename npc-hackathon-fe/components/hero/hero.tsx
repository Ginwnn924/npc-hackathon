"use client";

import React, { useEffect, useRef } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAnglesDown } from '@fortawesome/free-solid-svg-icons';

type HeroProps = {
	videoSrc: string;
	className?: string;
	children?: React.ReactNode;
	overlayOpacity?: number; // 0 - 100
	/** Enable a white gradient overlay at the bottom (bottom -> top) */
	bottomGradient?: boolean;
	/** Height of the bottom gradient (CSS units) */
	bottomGradientHeight?: string;

	/** Optional id of the element to scroll to when the down button is clicked. */
	scrollTargetId?: string;
};

export default function Hero({
	videoSrc,
	className = "",
	children,
	overlayOpacity = 40,
	bottomGradient = true,
	bottomGradientHeight = '25vh',
	scrollTargetId,
}: HeroProps) {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const sectionRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		// Respect prefers-reduced-motion: if user prefers reduced motion, pause autoplay
		const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
		if (mq?.matches) {
			if (videoRef.current) {
				videoRef.current.pause();
				videoRef.current.removeAttribute("autoplay");
				videoRef.current.loop = false;
			}
		}
	}, []);

	return (
		<section
			ref={sectionRef}
			className={`relative w-full h-screen overflow-hidden ${className}`}
			aria-label="Hero"
		>
			{/* Background video */}
			<video
				ref={videoRef}
				className="absolute inset-0 w-full h-full object-cover"
				src={videoSrc}
				autoPlay
				muted
				loop
				playsInline
				aria-hidden="true"
			/>

			{/* Overlay to improve text contrast */}
			<div
				className="absolute inset-0"
				style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity / 100})` }}
				aria-hidden="true"
			/>

			{/* Content */}
			<div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
				<div className="max-w-3xl text-white">
					{children}
				</div>
			</div>

			{/* Scroll down button */}
			<button
				type="button"
				aria-label="Scroll down"
				onClick={() => {
					try {
						if (scrollTargetId) {
							const el = document.getElementById(scrollTargetId);
							if (el) return el.scrollIntoView({ behavior: 'smooth' });
						}
						const sec = sectionRef.current;
						const next = sec?.nextElementSibling as HTMLElement | null;
						if (next) {
							next.scrollIntoView({ behavior: 'smooth' });
						} else {
							window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
						}
					} catch (e) {
						// ignore
					}
				}}
				className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 shadow-lg focus:outline-none focus:ring-2 focus:ring-white animate-bounce"
			>
				<FontAwesomeIcon icon={faAnglesDown} className="w-5 h-5" aria-hidden="true" />
			</button>
		</section>
	);
}

