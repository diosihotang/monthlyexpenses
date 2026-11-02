// Deklarasi supaya TypeScript tidak komplain saat import file CSS.
// Next.js handle CSS imports secara native, tapi TS tidak tahu itu.
// Sengaja dipisah dari next-env.d.ts karena file itu ditulis ulang otomatis oleh `next build`.
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
