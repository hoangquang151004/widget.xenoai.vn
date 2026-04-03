import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="bg-surface text-on-surface min-h-screen">
      {/* TopAppBar */}
      <header className="fixed top-0 right-0 left-0 z-30 flex justify-between items-center px-8 h-20 w-full bg-[#fbf8fc]/80 backdrop-blur-2xl shadow-sm shadow-indigo-500/5">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold bg-gradient-to-r from-[#3525cd] to-[#4f46e5] bg-clip-text text-transparent">
            XenoAI - Chatbot Thông minh
          </span>
        </div>
        <nav className="hidden md:flex gap-8 items-center">
          <a
            className="text-[#3525cd] border-b-2 border-[#3525cd] font-semibold py-2"
            href="#"
          >
            Sản phẩm
          </a>
          <a
            className="text-slate-500 hover:text-[#3525cd] transition-colors font-semibold py-2"
            href="#"
          >
            Giải pháp
          </a>
          <a
            className="text-slate-500 hover:text-[#3525cd] transition-colors font-semibold py-2"
            href="#"
          >
            Bảng giá
          </a>
          <a
            className="text-slate-500 hover:text-[#3525cd] transition-colors font-semibold py-2"
            href="#"
          >
            Tài liệu
          </a>
        </nav>
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-slate-500 cursor-pointer p-2 hover:bg-surface-container-low rounded-full transition-all">
            notifications
          </span>
          <Link
            href="/login"
            className="bg-primary text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
          >
            Đăng nhập
          </Link>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Hero Bento */}
          <div className="md:col-span-8 bg-surface-container-lowest rounded-xl p-10 flex flex-col justify-center min-h-[400px] relative overflow-hidden group border border-zinc-100 shadow-sm">
            <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none">
              <img
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGsaIzXEe3GS4eTtMt-eyORRWvrUgbmXAv6gdmPeuQsJbVDARiVSMcvjMsxyQVRfKvd-t91kESCx3Us0uPXH6vh3SfJKRqccqMGSpQJLTTqTcBRETVVjVwLxkNuNKmnLgsG1EdsRbvdB-kvaiZp05BW1RLSeFOTXIGCMg8oo9XZy2eLfURdEHAtlbLSTxp2B1IpNz0X7LgenQ_iQ4HsogOMuRw_TqsQWEXOcoAARWAKaBgZwCD0OgVHlIcUO4r8cCTqr0lY_IR5Wbn"
                alt="Hero background"
              />
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tight text-on-surface leading-[1.1] mb-6 z-10">
              Tương lai của <br />
              <span className="text-primary">Giao tiếp Thông minh.</span>
            </h1>
            <p className="text-lg text-on-surface-variant max-w-xl mb-8 leading-relaxed z-10">
              Tích hợp AI Chatbot vào website của bạn chỉ trong vài phút. Trải
              nghiệm sự mượt mà của ngôn ngữ tự nhiên và hiệu suất vượt trội.
            </p>
            <div className="flex gap-4 z-10">
              <button className="bg-primary text-white px-8 py-4 rounded-full font-bold shadow-xl shadow-indigo-500/30 active:scale-95 transition-all">
                Dùng thử miễn phí
              </button>
              <button className="bg-secondary-container text-on-secondary-container px-8 py-4 rounded-full font-bold hover:bg-surface-container-highest transition-all">
                Xem Demo
              </button>
            </div>
          </div>

          {/* Side Bento Info */}
          <div className="md:col-span-4 flex flex-col gap-8">
            <div className="bg-primary-container text-on-primary-container rounded-xl p-8 flex-1 flex flex-col justify-between">
              <span
                className="material-symbols-outlined text-4xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                bolt
              </span>
              <div>
                <h3 className="text-2xl font-bold mb-2">Tốc độ vượt trội</h3>
                <p className="text-sm opacity-80">
                  Phản hồi tin nhắn dưới 0.5s nhờ hạ tầng Edge Computing tiên
                  tiến nhất.
                </p>
              </div>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8 flex-1 flex flex-col justify-between border border-zinc-100">
              <span className="material-symbols-outlined text-4xl text-primary">
                security
              </span>
              <div>
                <h3 className="text-2xl font-bold mb-2">Bảo mật tuyệt đối</h3>
                <p className="text-sm text-on-surface-variant">
                  Dữ liệu được mã hóa đầu cuối và tuân thủ các tiêu chuẩn GDPR
                  toàn cầu.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-surface-container-lowest rounded-xl p-6 flex items-center gap-6 shadow-sm border border-zinc-100">
            <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">
                auto_stories
              </span>
            </div>
            <div>
              <div className="text-xl font-bold">1M+</div>
              <div className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">
                Hội thoại mỗi ngày
              </div>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-6 flex items-center gap-6 shadow-sm border border-zinc-100">
            <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">
                database
              </span>
            </div>
            <div>
              <div className="text-xl font-bold">99.9%</div>
              <div className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">
                Thời gian duy trì
              </div>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-6 flex items-center gap-6 shadow-sm border border-zinc-100">
            <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">
                settings_suggest
              </span>
            </div>
            <div>
              <div className="text-xl font-bold">24/7</div>
              <div className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">
                Hỗ trợ kỹ thuật
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Chat Bubble (Preview) */}
      <div className="fixed bottom-8 right-8 z-50">
        <span className="absolute inset-0 rounded-full bg-primary animate-ping-soft opacity-75"></span>
        <button className="relative w-[60px] h-[60px] bg-primary text-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all">
          <span
            className="material-symbols-outlined text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            sms
          </span>
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            2
          </span>
        </button>
      </div>
    </div>
  );
}
