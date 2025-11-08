import React from 'react';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-linear-to-r from-[#161853] to-[#6ea8ff] text-white">
      <div className="max-w-7xl mx-auto px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                {/* small decorative mark */}
                <span className="sr-only">NPC Travel logo</span>
                {/* Use Next/Image so logo stays crisp; parent has fixed w-10 h-10 (40px)
                    ensure the Image dimensions match the parent to avoid Next.js
                    warning about modifying only width or height via CSS. */}
                <Image
                  src="/logo.png"
                  alt="NPC Travel"
                  width={40}
                  height={40}
                  className="object-contain w-full h-full"
                  style={{ width: 'auto', height: 'auto' }}
                />
              </div>
              <span className="font-semibold text-xl">Smart Travel</span>
            </div>
            <p className="text-sm text-white/90">Khám phá những điểm đến độc đáo, lên kế hoạch chuyến đi và lưu lại kỷ niệm đáng nhớ cùng NPC.</p>
            <div className="flex items-center gap-3">
              <a aria-label="Facebook" href="#" className="p-2 rounded bg-white/10 hover:bg-white/20">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M22 12C22 6.477 17.523 2 12 2S2 6.477 2 12c0 5.022 3.657 9.182 8.438 9.88v-6.99H7.898v-2.89h2.54V9.797c0-2.507 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.463h-1.26c-1.242 0-1.63.771-1.63 1.562v1.875h2.773l-.444 2.89h-2.33v6.99C18.343 21.182 22 17.022 22 12z" fill="currentColor" />
                </svg>
              </a>
              <a aria-label="Instagram" href="#" className="p-2 rounded bg-white/10 hover:bg-white/20">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M17.5 6.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a aria-label="Twitter" href="#" className="p-2 rounded bg-white/10 hover:bg-white/20">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53A4.48 4.48 0 0 0 22.43 1c-.88.52-1.86.9-2.9 1.1A4.48 4.48 0 0 0 11 6.4v.56A12.94 12.94 0 0 1 3 2s-4 9 5 13a13 13 0 0 1-8 2c9 5 20 0 20-11.5A4.5 4.5 0 0 0 23 3z" fill="currentColor" />
                </svg>
              </a>
            </div>
          </div>

          <nav className="md:col-span-2 grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Liên kết nhanh</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:underline">Trang chủ</a></li>
                <li><a href="#" className="hover:underline">Điểm đến</a></li>
                <li><a href="#" className="hover:underline">Kinh nghiệm</a></li>
                <li><a href="#" className="hover:underline">Liên hệ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Hỗ trợ</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:underline">Hỏi đáp</a></li>
                <li><a href="#" className="hover:underline">Chính sách bảo mật</a></li>
                <li><a href="#" className="hover:underline">Điều khoản</a></li>
                <li><a href="#" className="hover:underline">Báo lỗi</a></li>
              </ul>
            </div>
          </nav>

          <div>
            <h4 className="font-semibold mb-3">Nhận bản tin</h4>
            <p className="text-sm mb-4">Đăng ký để nhận các gợi ý và ưu đãi mới nhất.</p>
            <div className="flex gap-2">
              <input placeholder="Email của bạn" className="w-full px-3 py-2 rounded bg-white/10 placeholder-white/70 text-white focus:outline-none" />
              <button type="button" className="px-4 py-2 bg-white text-[#161853] font-semibold rounded whitespace-nowrap shrink-0">Đăng ký</button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between text-sm text-white/90">
          <span>© {new Date().getFullYear()} Smart Travel. All rights reserved.</span>
          <span className="mt-2 md:mt-0">Thiết kế bởi đội Smart Travel • <a href="#" className="underline">Điều khoản</a></span>
        </div>
      </div>
    </footer>
  );
}
