'use client';

import React, { useState, useEffect } from 'react';
// @ts-ignore: Importing CSS without type declarations
import './folder.css';
import CurvedLoop from '../curve-loop/CurvedLoop';
import AISection from '../ai/ai-section-1';
import AISectionSelected from '../ai/ai-section-2';
import Schedule from '../schedule/schedule';

interface FolderProps {
  color?: string;
  size?: number;
  items?: React.ReactNode[];
  className?: string;
}

const darkenColor = (hex: string, percent: number): string => {
  let color = hex.startsWith('#') ? hex.slice(1) : hex;
  if (color.length === 3) {
    color = color
      .split('')
      .map(c => c + c)
      .join('');
  }
  const num = parseInt(color, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.min(255, Math.floor(r * (1 - percent))));
  g = Math.max(0, Math.min(255, Math.floor(g * (1 - percent))));
  b = Math.max(0, Math.min(255, Math.floor(b * (1 - percent))));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

const Folder: React.FC<FolderProps> = ({ color = '#161853', size = 1.5, items = [], className = '' }) => {
  const maxItems = 3;
  const papers = items.slice(0, maxItems);
  while (papers.length < maxItems) {
    papers.push(null);
  }

  const [open, setOpen] = useState(false);
  const [paperOffsets, setPaperOffsets] = useState<{ x: number; y: number }[]>(
    Array.from({ length: maxItems }, () => ({ x: 0, y: 0 }))
  );
  const [resultPaper, setResultPaper] = useState<React.ReactNode | null>(null);

  const folderBackColor = darkenColor(color, 0.08);
  const paper1 = darkenColor('#ffffff', 0.1);
  const paper2 = darkenColor('#ffffff', 0.05);
  const paper3 = '#ffffff';

  const handleClick = () => {
    setOpen(prev => !prev);
    if (open) {
      setPaperOffsets(Array.from({ length: maxItems }, () => ({ x: 0, y: 0 })));
    }
  };

  const handlePaperMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>, index: number) => {
    if (!open) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const offsetX = (e.clientX - centerX) * 0.15;
    const offsetY = (e.clientY - centerY) * 0.15;
    setPaperOffsets(prev => {
      const newOffsets = [...prev];
      newOffsets[index] = { x: offsetX, y: offsetY };
      return newOffsets;
    });
  };

  const handlePaperMouseLeave = (e: React.MouseEvent<HTMLDivElement, MouseEvent>, index: number) => {
    setPaperOffsets(prev => {
      const newOffsets = [...prev];
      newOffsets[index] = { x: 0, y: 0 };
      return newOffsets;
    });
  };

  // which paper opened the modal (null = closed). Use the paper index (0 or 2)
  const [modalPaper, setModalPaper] = useState<number | null>(null);
  const modalOpen = modalPaper !== null;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    const prevPadding = document.body.style.paddingRight;

    if (modalOpen) {
      // prevent body scroll and compensate for scrollbar to avoid layout shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = prevOverflow || '';
      document.body.style.paddingRight = prevPadding || '';
    }

    return () => {
      document.body.style.overflow = prevOverflow || '';
      document.body.style.paddingRight = prevPadding || '';
    };
  }, [modalOpen]);

  // listen for creation events from ai-section-2 (same-tab custom event)
  useEffect(() => {
    const handler = (e: any) => {
      // close modal and folder, then show the center paper (empty modal placeholder)
      setModalPaper(null);
      setOpen(false);
      setResultPaper(<div />);
    };
    window.addEventListener('ai:created', handler as EventListener);
    return () => window.removeEventListener('ai:created', handler as EventListener);
  }, []);

  const folderStyle: React.CSSProperties = {
    '--folder-color': color,
    '--folder-back-color': folderBackColor,
    '--paper-1': paper1,
    '--paper-2': paper2,
    '--paper-3': paper3
  } as React.CSSProperties;

  const folderClassName = `folder ${open ? 'open' : ''}`.trim();
  const scaleStyle = { transform: `scale(${size})` };
  // render center paper (index 1) only when `resultPaper` is present (paper 2 succeeded)
  const renderOrder = resultPaper ? [0, 2, 1] : [0, 2];

  return (
    <div className="h-screen flex flex-col justify-center items-center gap-8 px-6 relative">
      {/* Header / instructions */}
      <div className="absolute top-20 text-center max-w-3xl">
        <h2 className="text-2xl md:text-3xl font-bold text-black uppercase">CHỌN ĐỊA ĐIỂM BẠN YÊU THÍCH NHẤT</h2>
        <p className="mt-5 text-lg text-gray-600">Click vào folder bên dưới, chọn file 1 để xem gợi ý và lọc địa điểm bạn mong muốn; file còn lại là nơi bạn nhập prompt và kiểm tra địa điểm đã chọn.</p>
      </div>

      <div style={scaleStyle} className={className}>
        <div className={folderClassName} style={folderStyle} onClick={handleClick}>
          <div className="folder__back">
            {renderOrder.map(i => {
              const item = papers[i];
              // if center (i===1) and no resultPaper, skip rendering it
              if (i === 1 && !resultPaper) return null;
              return (
                <div
                  key={i}
                  className={`paper paper-${i + 1}`}
                  onMouseMove={e => handlePaperMouseMove(e, i)}
                  onMouseLeave={e => handlePaperMouseLeave(e, i)}
                  onClick={e => {
                    e.stopPropagation();
                    // open modal: paper 0 -> ai-section-1, paper 1 -> Schedule, paper 2 -> ai-section-2
                    if (i === 0) setModalPaper(0);
                    if (i === 1 && resultPaper) setModalPaper(1);
                    if (i === 2) setModalPaper(2);
                  }}
                  style={
                    open
                      ? ({
                          '--magnet-x': `${paperOffsets[i]?.x || 0}px`,
                          '--magnet-y': `${paperOffsets[i]?.y || 0}px`
                        } as React.CSSProperties)
                      : {}
                  }
                >
                  {/* numeric badge above the paper: left=1, middle=3 (when present), right=2 */}
                  {(i === 0 || i === 2 || (i === 1 && resultPaper)) && (
                    <div className="paper-badge">{i === 0 ? '1' : i === 1 ? '3' : '2'}</div>
                  )}
                  {/* render either provided item or the generated resultPaper in the center */}
                  {i === 1 && resultPaper ? resultPaper : item}
                </div>
              );
            })}
            <div className="folder__front"></div>
            <div className="folder__front right"></div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-20 w-full">
        <CurvedLoop marqueeText={"Gợi ý hàng đầu • Chạm để khám phá • Chọn địa điểm yêu thích"} speed={1.6} curveAmount={36} className="text-base text-black" interactive={false} />
      </div>
      {/* Modal for AISection and Schedule (opens when clicking papers) */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalPaper(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModalPaper(null)} aria-label="Close">×</button>
            {modalPaper === 0 && <AISection />}
            {modalPaper === 1 && <Schedule />}
            {modalPaper === 2 && <AISectionSelected />}
          </div>
        </div>
      )}
    </div>
  );
};

export default Folder;
