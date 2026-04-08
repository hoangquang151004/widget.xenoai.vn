import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  const features = [
    {
      title: "Knowledge Base (RAG)",
      description:
        "Tải lên PDF, Docx hoặc dán URL. AI sẽ học toàn bộ dữ liệu và trả lời khách hàng chính xác dựa trên nguồn tin cậy.",
      icon: "auto_stories",
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Smart Data (SQL Agent)",
      description:
        "Kết nối trực tiếp với Database (MySQL/Postgres). Chatbot có thể tra cứu tồn kho, trạng thái đơn hàng và báo cáo doanh thu.",
      icon: "database",
      color: "bg-blue-50 text-blue-600",
    },
    {
      title: "Widget Tùy biến Cao",
      description:
        "Thay đổi màu sắc, logo, lời chào và vị trí hiển thị để phù hợp hoàn hảo với thương hiệu của bạn.",
      icon: "palette",
      color: "bg-purple-50 text-purple-600",
    },
    {
      title: "Hỗ trợ Đa ngôn ngữ",
      description:
        "Tự động nhận diện và phản hồi bằng hơn 50 ngôn ngữ khác nhau với ngữ điệu tự nhiên như người thật.",
      icon: "translate",
      color: "bg-orange-50 text-orange-600",
    },
  ];

  const pricing = [
    {
      name: "Miễn phí",
      price: "0đ",
      description: "Bắt đầu nhanh với RAG từ tài liệu tải lên.",
      features: [
        "Tư vấn từ tài liệu tải lên",
        "Tối đa 2 tài liệu (~20 trang)",
        "Tối đa 50 yêu cầu / tháng",
        "Widget cơ bản",
        "Hỗ trợ cộng đồng",
      ],
      button: "Bắt đầu ngay",
      popular: false,
    },
    {
      name: "Cơ bản",
      price: "399k",
      description: "Widget + RAG + tư vấn dữ liệu sản phẩm trong database.",
      features: [
        "Dung lượng tài liệu 100MB",
        "Tùy chỉnh giao diện widget",
        "Tư vấn thông tin sản phẩm (SQL)",
        "Tối đa 400 yêu cầu / ngày",
        "Xóa nhãn thương hiệu",
        "Hỗ trợ ưu tiên",
      ],
      button: "Nâng cấp ngay",
      popular: false,
    },
    {
      name: "Doanh nghiệp",
      price: "999k",
      description:
        "Nền tảng đầy đủ: nhiều widget, bán hàng và trải nghiệm nâng cao.",
      features: [
        "2 widget: cửa hàng và admin",
        "Dung lượng tài liệu 500MB",
        "Hỗ trợ câu hỏi phức tạp",
        "Tính năng bán hàng trên chatbot",
        "Text-to-speech (Giọng đọc AI)",
        "Lưu chat phía client",
      ],
      button: "Chọn Doanh nghiệp",
      popular: true,
    },
    {
      name: "Doanh nghiệp Pro",
      price: "2tr499",
      description: "Bản nâng cấp tối thượng với phân tích hành vi chuyên sâu.",
      features: [
        "Kế thừa toàn bộ gói Doanh nghiệp",
        "Dung lượng tài liệu 2GB",
        "Lưu đoạn chat vào database",
        "Phân tích xu hướng mua hàng",
        "Giảm 5% gói Orchestration",
        "Quản lý tài khoản riêng",
      ],
      button: "Liên hệ nâng cấp",
      popular: false,
    },
  ];

  return (
    <div className="bg-white text-slate-900 font-sans scroll-smooth">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[20px]">
                psychology
              </span>
            </div>
            <span className="text-xl font-black tracking-tight text-indigo-900">
              XenoAI
            </span>
          </div>
          <div className="hidden md:flex items-center gap-10">
            <a
              href="#features"
              className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Tính năng
            </a>
            <a
              href="#solutions"
              className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Giải pháp
            </a>
            <a
              href="#pricing"
              className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Bảng giá
            </a>
            <a
              href="#faq"
              className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              FAQ
            </a>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-bold text-slate-700 hover:text-indigo-600"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
            >
              Bắt đầu ngay
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center relative">
          {/* Background Blobs */}
          <div className="absolute -top-24 -left-20 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50 -z-10 animate-pulse"></div>
          <div className="absolute top-40 -right-20 w-80 h-80 bg-purple-100 rounded-full blur-3xl opacity-50 -z-10"></div>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-600 text-xs font-black uppercase tracking-widest mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
            </span>
            Thế hệ Chatbot mới đã sẵn sàng
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-[1.1] tracking-tight mb-8">
            AI hiểu doanh nghiệp của bạn <br />
            <span className="text-indigo-600">hơn cả nhân viên tư vấn.</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto mb-12 leading-relaxed">
            Biến dữ liệu khô khan thành những cuộc hội thoại thông minh. Tích
            hợp RAG và SQL Agent giúp Chatbot trả lời chính xác dựa trên tài
            liệu và cơ sở dữ liệu thật của bạn.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/register"
              className="w-full md:w-auto bg-indigo-600 text-white px-10 py-5 rounded-2xl text-lg font-black shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 transition-all active:scale-95"
            >
              Bắt đầu miễn phí
            </Link>
            <button className="w-full md:w-auto bg-white text-slate-900 border border-slate-200 px-10 py-5 rounded-2xl text-lg font-black hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
              <span className="material-symbols-outlined">play_circle</span>
              Xem Video Demo
            </button>
          </div>

          <div className="relative max-w-5xl mx-auto rounded-3xl border border-slate-200 shadow-2xl overflow-hidden bg-white group">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Image
              src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80"
              alt="Dashboard Preview"
              width={2000}
              height={1200}
              className="w-full h-auto object-cover"
            />
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/90 backdrop-blur px-6 py-4 rounded-2xl border border-white shadow-xl">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden"
                  >
                    <Image
                      src={`https://i.pravatar.cc/100?u=${i}`}
                      alt="user"
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              <div className="text-sm font-bold text-slate-700">
                1,200+ Doanh nghiệp đã tham gia
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-slate-50 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-sm font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">
              Tính năng nổi bật
            </h2>
            <h3 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
              Vượt xa một khung chat thông thường
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-white p-8 rounded-3xl border border-slate-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group"
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${f.color}`}
                >
                  <span className="material-symbols-outlined text-3xl">
                    {f.icon}
                  </span>
                </div>
                <h4 className="text-xl font-bold mb-4 text-slate-900">
                  {f.title}
                </h4>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions Showcase (RAG & SQL) */}
      <section id="solutions" className="py-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-32">
          {/* RAG Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest mb-6 border border-emerald-100">
                Smart Knowledge Base
              </div>
              <h3 className="text-4xl font-black mb-6 text-slate-900 tracking-tight">
                AI tự học từ kho tài liệu khổng lồ của bạn.
              </h3>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                Thay vì phải thiết lập hàng ngàn kịch bản thủ công, chỉ cần tải
                lên quy trình công ty, tài liệu sản phẩm hoặc PDF hướng dẫn. Hệ
                thống <b>Retrieval-Augmented Generation (RAG)</b> sẽ tự động
                trích xuất thông tin và trả lời chính xác nhất.
              </p>
              <ul className="space-y-4 mb-10 text-slate-700 font-medium">
                <li className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-emerald-500">
                    check_circle
                  </span>
                  Hỗ trợ PDF, Docx, TXT và Website URL
                </li>
                <li className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-emerald-500">
                    check_circle
                  </span>
                  Tự động cập nhật kiến thức thời gian thực
                </li>
                <li className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-emerald-500">
                    check_circle
                  </span>
                  Dẫn nguồn minh bạch cho mỗi câu trả lời
                </li>
              </ul>
              <button className="text-indigo-600 font-black flex items-center gap-2 group">
                Tìm hiểu về công nghệ RAG
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </button>
            </div>
            <div className="order-1 lg:order-2 relative">
              <div className="absolute inset-0 bg-emerald-400 blur-[120px] opacity-20 -z-10"></div>
              <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-800">
                <div className="flex gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                </div>
                <div className="space-y-4 font-mono text-sm">
                  <div className="text-slate-400">
                    # Trích xuất từ &quot;chinh-sach-bao-hanh.pdf&quot;
                  </div>
                  <div className="text-emerald-400">
                    Context: &quot;Sản phẩm được bảo hành 12 tháng kể từ ngày
                    mua...&quot;
                  </div>
                  <div className="text-white border-l-2 border-indigo-500 pl-4 py-2 bg-indigo-500/10">
                    User: &quot;Sản phẩm của tôi được bảo hành bao lâu?&quot;{" "}
                    <br />
                    AI: &quot;Sản phẩm của bạn được bảo hành 12 tháng. Bạn cần
                    giữ lại hóa đơn khi đi bảo hành nhé!&quot;
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SQL Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-400 blur-[120px] opacity-20 -z-10"></div>
              <div className="bg-white rounded-3xl p-8 shadow-2xl border border-slate-100">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                      <span className="material-symbols-outlined">
                        database
                      </span>
                    </div>
                    <span className="font-bold text-slate-800">
                      Order_DB Connection
                    </span>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase">
                    Connected
                  </span>
                </div>
                <div className="space-y-6">
                  <div className="flex justify-end">
                    <div className="bg-indigo-600 text-white rounded-2xl px-4 py-3 text-sm font-medium shadow-lg">
                      &quot;Kiểm tra giúp tôi đơn hàng #W-9928&quot;
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-slate-100 text-slate-800 rounded-2xl px-4 py-3 text-sm border border-slate-200">
                      <div className="flex items-center gap-2 mb-2 text-indigo-600 font-bold">
                        <span className="material-symbols-outlined text-[16px]">
                          code
                        </span>
                        Executing SQL...
                      </div>
                      Đơn hàng #W-9928 của bạn đang ở trạng thái{" "}
                      <b>Đang giao</b>. <br />
                      Dự kiến bạn sẽ nhận được hàng vào 14:00 chiều nay.
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest mb-6 border border-indigo-100">
                Text-to-SQL Agent
              </div>
              <h3 className="text-4xl font-black mb-6 text-slate-900 tracking-tight">
                Trò chuyện trực tiếp với dữ liệu doanh nghiệp.
              </h3>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                Tích hợp thông minh với MySQL, PostgreSQL. AI tự động sinh lệnh
                SQL để tra cứu dữ liệu khách hàng theo thời gian thực mà không
                cần lập trình API phức tạp.
              </p>
              <ul className="space-y-4 mb-10 text-slate-700 font-medium">
                <li className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-indigo-500">
                    check_circle
                  </span>
                  Tra cứu trạng thái đơn hàng & tồn kho tự động
                </li>
                <li className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-indigo-500">
                    check_circle
                  </span>
                  An toàn tuyệt đối với quyền Read-only SELECT
                </li>
                <li className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-indigo-500">
                    check_circle
                  </span>
                  Hỗ trợ tạo báo cáo nhanh qua ngôn ngữ tự nhiên
                </li>
              </ul>
              <button className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95">
                Thử nghiệm SQL Agent ngay
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-slate-900 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-sm font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">
              Bảng giá minh bạch
            </h2>
            <h3 className="text-4xl md:text-5xl font-black text-white tracking-tight">
              Phù hợp cho mọi quy mô
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricing.map((p, i) => (
              <div
                key={i}
                className={`relative p-8 rounded-3xl border ${p.popular ? "bg-indigo-600 border-indigo-400 shadow-2xl shadow-indigo-500/20 md:scale-105 z-10" : "bg-slate-800 border-slate-700"} flex flex-col`}
              >
                {p.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white text-indigo-600 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
                    Phổ biến nhất
                  </div>
                )}
                <h4 className="text-xl font-black text-white mb-2">{p.name}</h4>
                <div className="mb-6">
                  <span className="text-4xl font-black text-white">
                    {p.price}
                  </span>
                  {p.price !== "Custom" && (
                    <span className="text-slate-400 text-xs font-bold ml-2">
                      / tháng
                    </span>
                  )}
                </div>
                <p
                  className={`text-[13px] mb-8 leading-relaxed ${p.popular ? "text-indigo-100" : "text-slate-400"}`}
                >
                  {p.description}
                </p>
                <div className="space-y-4 mb-10 flex-1">
                  {p.features.map((feat, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-3 text-xs font-medium text-white"
                    >
                      <span
                        className={`material-symbols-outlined text-[16px] ${p.popular ? "text-indigo-300" : "text-emerald-500"}`}
                      >
                        check_circle
                      </span>
                      {feat}
                    </div>
                  ))}
                </div>
                <button
                  className={`w-full py-4 rounded-2xl font-black transition-all active:scale-95 ${p.popular ? "bg-white text-indigo-600 hover:bg-slate-100" : "bg-slate-700 text-white hover:bg-slate-600"}`}
                >
                  {p.button}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-sm font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">
              Giải đáp
            </h2>
            <h3 className="text-4xl font-black text-slate-900 tracking-tight">
              Câu hỏi thường gặp
            </h3>
          </div>
          <div className="space-y-6">
            {[
              {
                q: "Việc tích hợp mất bao lâu?",
                a: "Chỉ mất chưa đầy 5 phút. Bạn chỉ cần copy đoạn script duy nhất và dán vào thẻ <head> trên website của mình.",
              },
              {
                q: "Dữ liệu của tôi có được bảo mật không?",
                a: "Chúng tôi sử dụng mã hóa AES-256 cho các kết nối Database và không bao giờ lưu trữ dữ liệu gốc từ Knowledge Base của bạn, chỉ lưu trữ các vector đại diện cho tìm kiếm.",
              },
              {
                q: "Tôi có thể sử dụng logo thương hiệu riêng không?",
                a: "Hoàn toàn được. Gói Pro cho phép bạn tùy chỉnh logo, tên Bot và xóa hoàn toàn nhãn 'Powered by XenoAI'.",
              },
              {
                q: "Làm thế nào để chatbot trả lời dựa trên file PDF?",
                a: "Trong trang dashboard, bạn chỉ cần kéo thả file vào mục 'Knowledge Base', AI sẽ tự động xử lý và học nội dung file ngay lập tức.",
              },
            ].map((faq, i) => (
              <div
                key={i}
                className="p-8 bg-slate-50 rounded-3xl border border-slate-100"
              >
                <h4 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black">
                    Q
                  </span>
                  {faq.q}
                </h4>
                <p className="text-slate-600 leading-relaxed text-sm ml-9">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-slate-100 bg-white px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[20px]">
                  psychology
                </span>
              </div>
              <span className="text-xl font-black tracking-tight text-indigo-900">
                XenoAI
              </span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              Định nghĩa lại cách doanh nghiệp giao tiếp với khách hàng thông
              qua sức mạnh của Trí tuệ nhân tạo thế hệ mới.
            </p>
          </div>
          <div>
            <h5 className="font-black text-slate-900 mb-6 uppercase tracking-widest text-[10px]">
              Sản phẩm
            </h5>
            <ul className="space-y-4 text-sm font-bold text-slate-500">
              <li>
                <a href="#" className="hover:text-indigo-600 transition-colors">
                  Tính năng RAG
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-indigo-600 transition-colors">
                  SQL Agent
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-indigo-600 transition-colors">
                  Custom Widget
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="font-black text-slate-900 mb-6 uppercase tracking-widest text-[10px]">
              Công ty
            </h5>
            <ul className="space-y-4 text-sm font-bold text-slate-500">
              <li>
                <a href="#" className="hover:text-indigo-600 transition-colors">
                  Về chúng tôi
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-indigo-600 transition-colors">
                  Tuyển dụng
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-indigo-600 transition-colors">
                  Blog
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="font-black text-slate-900 mb-6 uppercase tracking-widest text-[10px]">
              Kết nối
            </h5>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">
                  public
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">
                  mail
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[12px] font-medium text-slate-400">
            © 2026 XenoAI Inc. Mọi quyền được bảo lưu.
          </p>
          <div className="flex gap-8 text-[12px] font-medium text-slate-400">
            <a href="#" className="hover:text-indigo-600">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-indigo-600">
              Terms of Service
            </a>
          </div>
        </div>
      </footer>

      {/* CTA Floating Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <Link
          href="/register"
          className="flex items-center gap-3 bg-indigo-600 text-white px-6 py-4 rounded-full font-black shadow-2xl hover:bg-indigo-700 hover:-translate-y-2 transition-all active:scale-95"
        >
          <span>Dùng thử miễn phí</span>
          <span className="material-symbols-outlined">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
}
