import React from 'react';

interface CardProps {
    title?: string;
    description?: string;
    href?: string;
    /** optional anchor target, e.g. _blank */
    target?: string;
    /** optional anchor rel, e.g. noopener noreferrer */
    rel?: string;
    className?: string;
    /** optional control to render inside the card (e.g. checkbox) */
    control?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({
    title = 'Need a help in Claim?',
    description = 'Go to this step by step guideline process on how to certify for your weekly benefits:',
    href = '#',
    target,
    rel,
    className = '',
    control
}) => {
    return (
        <div className={`relative flex flex-col h-full p-6 bg-white border border-gray-200 rounded-lg shadow-sm text-[#333333] ${className}`}>
            {/* control placed inside card (top-right) */}
            {control && <div className="absolute top-4 right-4">{control}</div>}

            {/* Title is plain text so clicking the card (including title) triggers parent selection.
                Only the detail link below is an actual anchor that navigates. */}
            <h5 className="mb-2 text-2xl font-semibold tracking-tight">{title}</h5>

            <p className="mb-3 font-normal">{description}</p>
            {href && href !== '#' ? (
                <a href={href} target={target} rel={rel} className="mt-auto inline-flex font-medium items-center text-blue-600 hover:underline">
                    Xem chi tiết địa điểm này
                    <svg className="w-3 h-3 ms-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 18 18">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11v4.833A1.166 1.166 0 0 1 13.833 17H2.167A1.167 1.167 0 0 1 1 15.833V4.167A1.166 1.166 0 0 1 2.167 3h4.618m4.447-2H17v5.768M9.111 8.889l7.778-7.778" />
                    </svg>
                </a>
            ) : (
                // keep layout spacing when there's no link
                <div className="mt-auto text-sm text-gray-500">&nbsp;</div>
            )}
        </div>
    );
};

export default Card;

