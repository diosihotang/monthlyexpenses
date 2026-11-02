'use client';

import { signIn } from '@/app/actions/auth';
import { useState } from 'react';

export default function SignInForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await signIn(formData);
    // Kalau sukses, halaman otomatis dirender ulang (revalidatePath) dan form ini hilang
    if ('error' in result) setError(result.error);
    setPending(false);
  }

  return (
    <div className="form-card signin-card">
      <h2>Masuk</h2>
      <p className="signin-hint">
        Belum punya? Ketik username dan PIN baru, ruang datamu langsung dibuat.
        Di perangkat lain, masuk dengan username dan PIN yang sama untuk melihat data yang sama.
      </p>

      <form action={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              required
              minLength={3}
              maxLength={20}
              pattern="[A-Za-z0-9_]{3,20}"
              autoComplete="username"
              autoCapitalize="none"
              placeholder="contoh: dio"
            />
          </div>

          <div className="form-group">
            <label htmlFor="pin">PIN (4 digit)</label>
            <input
              id="pin"
              name="pin"
              type="password"
              required
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              autoComplete="current-password"
              placeholder="••••"
            />
          </div>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}
