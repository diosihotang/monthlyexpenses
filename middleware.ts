import { NextResponse, type NextRequest } from 'next/server';

// Proteksi seluruh aplikasi dengan HTTP Basic Auth.
// Tanpa ini, siapa pun yang tahu URL production bisa menambah/mengubah/menghapus transaksi,
// karena Server Actions berjalan dengan kredensial database milik server.
// Kredensial diambil dari env BASIC_AUTH_USER dan BASIC_AUTH_PASSWORD.

// Bandingkan string tanpa berhenti di karakter pertama yang beda,
// supaya waktu respons tidak membocorkan berapa karakter password yang sudah benar.
function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function middleware(request: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  // Fail closed: kalau kredensial lupa di-set, jangan biarkan aplikasi terbuka
  if (!user || !password) {
    return new NextResponse('Auth belum dikonfigurasi (BASIC_AUTH_USER / BASIC_AUTH_PASSWORD)', {
      status: 503,
    });
  }

  const header = request.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice('Basic '.length));
      const separator = decoded.indexOf(':');
      const givenUser = decoded.slice(0, separator);
      const givenPassword = decoded.slice(separator + 1);
      if (separator !== -1 && safeEqual(givenUser, user) && safeEqual(givenPassword, password)) {
        return NextResponse.next();
      }
    } catch {
      // Header base64 rusak — perlakukan sebagai tidak terautentikasi
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Monthly Expense Tracker", charset="UTF-8"' },
  });
}

export const config = {
  // Semua halaman & Server Actions diproteksi, kecuali health check (untuk monitoring)
  // dan aset statis Next.js.
  matcher: ['/((?!api/health|_next/static|_next/image|favicon.ico).*)'],
};
